/* ============================================================
   pos — il POS di Bistrot e ristorante: sala, comande a portate, stampe.

   Spec: docs/superpowers/specs/2026-09-04-pos-design.md
   Piano: docs/superpowers/plans/2026-09-04-pos-fase-1.md

   Un contratto solo (?a=<azione>), servito anche dal server locale sul PC
   del Bistrot (pos-locale/): il palmare non sa con chi parla.

   Dal palmare (x-pos-dispositivo + x-pos-sessione, tranne accesso):
     POST ?a=accesso           → codice + PIN del cameriere → sessione
     GET  ?a=menu              → categorie, articoli, varianti, preferiti
     GET  ?a=sala&locale=      → zone e tavoli con i conti aperti
     POST ?a=conto             → apre un conto su un tavolo
     POST ?a=righe             → aggiunge o cambia righe (prezzo calcolato qui)
     POST ?a=invia             → parte la prima portata e le bevande, il resto aspetta
     POST ?a=vai               → fa partire la portata in attesa
     POST ?a=storna            → storna una riga (permesso), STORNO in cucina se era partita
     POST ?a=chiudi            → chiude un conto (fase 1: senza scontrino)
   Dal server locale (x-hotel-key):
     GET/POST ?a=stampe        → la coda dei biglietti / segnarli stampati
     POST ?a=locale-vivo       → battito: finche' c'e', il cloud non stampa
     POST ?a=allinea-su        → conti, righe, comande, stampe dal locale
     GET  ?a=allinea-giu&da=   → menu', tavoli, personale, dispositivi dal cloud
   Dall'estensione (x-hotel-key):
     POST ?a=importa-menu      → gli articoli letti dalla pagina di Fidra
   Dal back office (accesso dell'hotel, ruolo amministrazione):
     POST ?a=menu-salva, ?a=tavoli-salva, ?a=personale-salva
   Dal cron (x-cron-key):
     POST ?a=stampa-cloud      → stampa lui solo se il locale tace da 90 s

   Le regole stanno nei moduli puri accanto (portate, conto, comanda, menu,
   permessi, ruoli): qui solo il database, la rete e il vetro.
   Le stampanti fiscali non compaiono: non e' questa fase.
   ============================================================ */
import { createClient } from 'supabase';
import { dividi, PORTATE, prossima, type Portata } from './portate.ts';
import { prezzoRiga, totaleCent } from './conto.ts';
import { escpos, testoBiglietto, type Biglietto } from './comanda.ts';
import { importa } from './menu.ts';
import { puo, type Ruolo as RuoloPos } from './permessi.ts';
import { ruoloDi } from './ruoli.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, authorization, x-hotel-key, x-cron-key, x-pos-dispositivo, x-pos-sessione',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

type Riga = Record<string, unknown>;
const risposta = (corpo: unknown, stato = 200) =>
  new Response(JSON.stringify(corpo), { status: stato, headers: { ...CORS, 'content-type': 'application/json' } });
const adesso = () => new Date().toISOString();
const chiaveHotel = (req: Request) => { const k = Deno.env.get('HOTEL_KEY'); return !!k && req.headers.get('x-hotel-key') === k; };
const chiaveCron = (req: Request) => { const k = Deno.env.get('CRON_KEY'); return !!k && req.headers.get('x-cron-key') === k; };
const oraRoma = () => new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
const ePortata = (p: unknown): p is Portata => typeof p === 'string' && (PORTATE as readonly string[]).includes(p);

async function hashPin(codice: string, pin: string): Promise<string> {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${codice}:${pin}`));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

/* un token per i dispositivi: 24 caratteri senza 0/O/1/I */
function tokenCasuale(): string {
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return [...crypto.getRandomValues(new Uint8Array(24))].map((b) => a[b % 32]).join('');
}

/* ---------- chi entra dal back office (menu', tavoli, personale) ---------- */
type Accesso = { ok: true; ruolo: string | null; chiave: boolean } | { ok: false };
async function autorizzato(req: Request): Promise<Accesso> {
  const attesa = Deno.env.get('HOTEL_KEY');
  if (attesa && req.headers.get('x-hotel-key') === attesa) return { ok: true, ruolo: null, chiave: true };
  const auth = req.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return { ok: false };
  const { data } = await db.auth.getUser(token);
  const ruolo = ruoloDi(data?.user?.email);
  if (!ruolo) return { ok: false };
  return { ok: true, ruolo, chiave: false };
}

/* ---------- la sessione del cameriere: dispositivo + sessione validi ---------- */
type Cameriere = { id: string; nome: string; ruolo: RuoloPos; storni: boolean; bloccato: boolean };
async function dispositivoDi(req: Request): Promise<Riga | null> {
  const token = req.headers.get('x-pos-dispositivo') || '';
  if (!token) return null;
  const { data } = await db.from('pos_dispositivo').select('*').eq('token', token).eq('bloccato', false).maybeSingle();
  return data ?? null;
}
async function cameriereDi(req: Request): Promise<Cameriere | null> {
  const disp = req.headers.get('x-pos-dispositivo') || '', sess = req.headers.get('x-pos-sessione') || '';
  if (!disp || !sess) return null;
  const { data: s } = await db.from('pos_sessione')
    .select('id, scade_il, cam:pos_cameriere(id, nome, ruolo, storni, bloccato), dis:pos_dispositivo(token, bloccato)')
    .eq('id', sess).maybeSingle();
  if (!s || new Date(s.scade_il as string) < new Date()) return null;
  const d = s.dis as unknown as { token: string; bloccato: boolean } | null;
  if (!d || d.token !== disp || d.bloccato) return null;
  const c = s.cam as unknown as Cameriere | null;
  if (!c || c.bloccato) return null;
  return c;
}

/* ---------- le righe di un conto, con la stampante gia' decisa ---------- */
type RigaStampabile = Riga & { stampante: 'cucina' | 'bar'; portata: Portata; stato: string };
async function righeDelConto(conto: string): Promise<RigaStampabile[]> {
  const { data } = await db.from('pos_riga')
    .select('*, art:pos_articolo(stampante, cat:pos_categoria(stampante))')
    .eq('conto', conto).order('creata_il');
  return (data ?? []).map((r) => {
    const art = r.art as unknown as { stampante: string | null; cat: { stampante: string } | null } | null;
    const stampante = (art?.stampante ?? art?.cat?.stampante ?? 'cucina') as 'cucina' | 'bar';
    const { art: _a, ...resto } = r as Riga & { art: unknown };
    return { ...resto, stampante } as RigaStampabile;
  });
}

/* ---------- le stampe di una portata: un biglietto per stampante ---------- */
async function creaStampe(conto: Riga, righe: RigaStampabile[], portata: Portata, tipo: 'comanda' | 'vai' | 'storno' | 'modifica', cameriere: string) {
  const { data: tavolo } = await db.from('pos_tavolo').select('nome, z:pos_zona(l:pos_locale(id, nome))').eq('id', conto.tavolo as string).single();
  const locale = (tavolo?.z as unknown as { l: { id: string; nome: string } } | null)?.l;
  if (!locale) return;
  const perStampante = new Map<'cucina' | 'bar', RigaStampabile[]>();
  for (const r of righe) perStampante.set(r.stampante, [...(perStampante.get(r.stampante) ?? []), r]);
  const stampe = [...perStampante].map(([stampante, rr]) => {
    const b: Biglietto = {
      tipo: tipo.toUpperCase() as Biglietto['tipo'], locale: locale.nome, tavolo: String(tavolo!.nome),
      conto: conto.tipo === 'camera' ? `Camera ${conto.camera ?? ''}`.trim() : 'Esterno',
      coperti: Number(conto.coperti ?? 1), portata, ora: oraRoma(), cameriere,
      righe: rr.map((r) => ({ quantita: Number(r.quantita), nome: String(r.nome), variante: (r.variante as string | null) ?? null, nota: (r.nota as string | null) ?? null })),
      noteVitto: null,
    };
    return { id: crypto.randomUUID(), locale: locale.id, stampante, testo: testoBiglietto(b) };
  });
  if (stampe.length) await db.from('pos_stampa').insert(stampe);
  await db.from('pos_comanda').insert({ id: crypto.randomUUID(), conto: conto.id, portata, tipo, righe: righe.map((r) => r.id) });
}

/* ---------- allineamento: upsert per id, vince aggiornato_il piu' recente ---------- */
async function upsertSeNuovi(tabella: string, righe: Riga[]): Promise<number> {
  if (!righe.length) return 0;
  const ids = righe.map((r) => r.id as string);
  const { data: esistenti } = await db.from(tabella).select('id, aggiornato_il').in('id', ids);
  const vecchie = new Map((esistenti ?? []).map((e) => [e.id as string, new Date(e.aggiornato_il as string).getTime()]));
  const daScrivere = righe.filter((r) => {
    const v = vecchie.get(r.id as string);
    return v === undefined || new Date((r.aggiornato_il as string) ?? 0).getTime() >= v;
  });
  if (!daScrivere.length) return 0;
  const { error } = await db.from(tabella).upsert(daScrivere, { onConflict: 'id' });
  if (error) throw new Error(`${tabella}: ${error.message}`);
  return daScrivere.length;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  const url = new URL(req.url);
  const azione = url.searchParams.get('a') || '';
  const corpo = async () => (req.method === 'POST' ? await req.json().catch(() => ({})) : {}) as Record<string, unknown>;

  /* ================= dal palmare ================= */

  if (azione === 'accesso') {
    if (req.method !== 'POST') return risposta({ errore: 'metodo non ammesso' }, 405);
    const disp = await dispositivoDi(req);
    if (!disp) return risposta({ errore: 'dispositivo non registrato' }, 401);
    const b = await corpo();
    const codice = String(b.codice ?? '').trim(), pin = String(b.pin ?? '').trim();
    if (!codice || !pin) return risposta({ errore: 'codice e PIN' }, 400);
    const { data: c } = await db.from('pos_cameriere').select('*').eq('codice', codice).eq('bloccato', false).maybeSingle();
    if (!c || c.pin_hash !== await hashPin(codice, pin)) return risposta({ errore: 'codice o PIN sbagliati' }, 401);
    const sessione = crypto.randomUUID();
    const scade = new Date(Date.now() + 14 * 60 * 60 * 1000).toISOString();
    await db.from('pos_sessione').insert({ id: sessione, cameriere: c.id, dispositivo: disp.id, scade_il: scade });
    await db.from('pos_dispositivo').update({ ultimo_accesso: adesso() }).eq('id', disp.id);
    return risposta({ sessione, scade_il: scade, cameriere: { id: c.id, nome: c.nome, ruolo: c.ruolo, storni: c.storni } });
  }

  const cameriere = await cameriereDi(req);
  const azioniPalmare = ['menu', 'sala', 'conto', 'righe', 'invia', 'vai', 'storna', 'chiudi'];
  if (azioniPalmare.includes(azione) && !cameriere) return risposta({ errore: 'sessione non valida' }, 401);

  if (azione === 'menu') {
    const [cat, art, vari, pref] = await Promise.all([
      db.from('pos_categoria').select('*').eq('attiva', true).order('posizione'),
      db.from('pos_articolo').select('*').eq('attivo', true).order('posizione'),
      db.from('pos_variante').select('*').order('posizione'),
      db.from('pos_preferito').select('*').order('posizione'),
    ]);
    const tutte = [...(cat.data ?? []), ...(art.data ?? []), ...(vari.data ?? []), ...(pref.data ?? [])].map((r) => String(r.aggiornato_il));
    return risposta({ categorie: cat.data ?? [], articoli: art.data ?? [], varianti: vari.data ?? [], preferiti: pref.data ?? [], aggiornato_il: tutte.sort().pop() ?? null });
  }

  if (azione === 'sala') {
    const locale = url.searchParams.get('locale') || '';
    if (!locale) return risposta({ errore: 'serve il locale' }, 400);
    const { data: zone } = await db.from('pos_zona').select('*').eq('locale', locale).order('posizione');
    const idZone = (zone ?? []).map((z) => z.id as string);
    const { data: tavoli } = idZone.length ? await db.from('pos_tavolo').select('*').in('zona', idZone).eq('attivo', true) : { data: [] };
    const idTavoli = (tavoli ?? []).map((t) => t.id as string);
    const { data: conti } = idTavoli.length ? await db.from('pos_conto').select('*').in('tavolo', idTavoli).neq('stato', 'chiuso') : { data: [] };
    const idConti = (conti ?? []).map((c) => c.id as string);
    const { data: righe } = idConti.length ? await db.from('pos_riga').select('conto, quantita, prezzo_cent, stato, creata_il').in('conto', idConti) : { data: [] };
    const perConto = (id: string) => (righe ?? []).filter((r) => r.conto === id);
    const contiPronti = (conti ?? []).map((c) => {
      const rr = perConto(c.id as string);
      return {
        id: c.id, tavolo: c.tavolo, tipo: c.tipo, camera: c.camera, ospite: c.ospite, coperti: c.coperti, stato: c.stato,
        nome: c.tipo === 'camera' ? `Camera ${c.camera ?? ''}`.trim() + (c.ospite ? ` · ${c.ospite}` : '') : 'Esterno',
        totale_cent: totaleCent(rr.map((r) => ({ quantita: Number(r.quantita), prezzo_cent: Number(r.prezzo_cent), stato: String(r.stato) }))),
        attesa: rr.some((r) => r.stato === 'inviata'),
        da_inviare: rr.some((r) => r.stato === 'da_inviare'),
        ultima: rr.map((r) => String(r.creata_il)).sort().pop() ?? c.aperto_il,
      };
    });
    return risposta({
      zone: zone ?? [],
      tavoli: (tavoli ?? []).map((t) => ({ ...t, conti: contiPronti.filter((c) => c.tavolo === t.id) })),
    });
  }

  if (azione === 'conto') {
    if (req.method !== 'POST') return risposta({ errore: 'metodo non ammesso' }, 405);
    const b = await corpo();
    const tavolo = String(b.tavolo ?? '');
    const tipo = b.tipo === 'camera' ? 'camera' : 'esterno';
    if (!tavolo) return risposta({ errore: 'serve il tavolo' }, 400);
    const conto = {
      id: String(b.id ?? crypto.randomUUID()), tavolo, tipo,
      camera: tipo === 'camera' ? String(b.camera ?? '') || null : null,
      ospite: tipo === 'camera' ? String(b.ospite ?? '') || null : null,
      tessera: tipo === 'camera' ? String(b.tessera ?? '') || null : null,
      coperti: Math.max(1, Number(b.coperti ?? 1) || 1), stato: 'aperto', aperto_da: cameriere!.id,
    };
    const { data, error } = await db.from('pos_conto').insert(conto).select('*').single();
    if (error) return risposta({ errore: error.message }, 500);
    return risposta({ conto: data });
  }

  if (azione === 'righe') {
    if (req.method !== 'POST') return risposta({ errore: 'metodo non ammesso' }, 405);
    const b = await corpo();
    const conto = String(b.conto ?? '');
    const richieste = Array.isArray(b.righe) ? b.righe as Riga[] : [];
    if (!conto || !richieste.length) return risposta({ errore: 'serve il conto e almeno una riga' }, 400);
    const { data: c } = await db.from('pos_conto').select('*').eq('id', conto).maybeSingle();
    if (!c || c.stato === 'chiuso') return risposta({ errore: 'conto non aperto' }, 409);
    const idArt = [...new Set(richieste.map((r) => String(r.articolo ?? '')).filter(Boolean))];
    const { data: articoli } = idArt.length
      ? await db.from('pos_articolo').select('*, cat:pos_categoria(portata, stampante)').in('id', idArt) : { data: [] };
    const idVar = [...new Set(richieste.map((r) => String(r.variante_id ?? '')).filter(Boolean))];
    const { data: varianti } = idVar.length ? await db.from('pos_variante').select('*').in('id', idVar) : { data: [] };
    const puoPrezzo = puo(cameriere!, 'prezzo');
    const righe: Riga[] = [];
    for (const r of richieste) {
      const a = (articoli ?? []).find((x) => x.id === r.articolo);
      if (!a) return risposta({ errore: `articolo sconosciuto: ${r.articolo}` }, 400);
      if (a.esaurito) return risposta({ errore: `${a.nome}: esaurito` }, 409);
      const v = (varianti ?? []).find((x) => x.id === r.variante_id) ?? null;
      let prezzo: number;
      try {
        prezzo = prezzoRiga({
          articolo: { prezzo_cent: Number(a.prezzo_cent), prezzo_libero: !!a.prezzo_libero },
          variante: v ? { supplemento_cent: Number(v.supplemento_cent) } : null,
          prezzo_manuale_cent: r.prezzo_manuale_cent === undefined || r.prezzo_manuale_cent === null ? null : Number(r.prezzo_manuale_cent),
        }, puoPrezzo);
      } catch (e) { return risposta({ errore: (e as Error).message }, 403); }
      const cat = a.cat as unknown as { portata: Portata } | null;
      const portata = ePortata(r.portata) ? r.portata : (ePortata(a.portata) ? a.portata : (cat?.portata ?? 'secondi'));
      righe.push({
        id: String(r.id ?? crypto.randomUUID()), conto, articolo: a.id, nome: a.nome,
        quantita: Math.max(1, Number(r.quantita ?? 1) || 1),
        prezzo_listino_cent: Number(a.prezzo_cent), prezzo_cent: prezzo,
        variante: v ? v.nome : (r.variante ? String(r.variante) : null),
        nota: r.nota ? String(r.nota).slice(0, 200) : null,
        portata, stato: 'da_inviare', creata_da: cameriere!.id, aggiornato_il: adesso(),
      });
    }
    const { data, error } = await db.from('pos_riga').upsert(righe, { onConflict: 'id' }).select('*');
    if (error) return risposta({ errore: error.message }, 500);
    return risposta({ righe: data });
  }

  if (azione === 'invia') {
    if (req.method !== 'POST') return risposta({ errore: 'metodo non ammesso' }, 405);
    const b = await corpo();
    const { data: c } = await db.from('pos_conto').select('*').eq('id', String(b.conto ?? '')).maybeSingle();
    if (!c || c.stato === 'chiuso') return risposta({ errore: 'conto non aperto' }, 409);
    const righe = await righeDelConto(c.id as string);
    const { subito, attesa } = dividi(righe);
    const ora = adesso();
    for (const p of subito) {
      const rr = righe.filter((r) => r.portata === p && r.stato === 'da_inviare');
      await db.from('pos_riga').update({ stato: 'partita', partita_il: ora, aggiornato_il: ora }).in('id', rr.map((r) => r.id as string));
      await creaStampe(c, rr, p, 'comanda', cameriere!.nome);
    }
    for (const p of attesa) {
      const rr = righe.filter((r) => r.portata === p && r.stato === 'da_inviare');
      await db.from('pos_riga').update({ stato: 'inviata', aggiornato_il: ora }).in('id', rr.map((r) => r.id as string));
    }
    return risposta({ partite: subito, attesa });
  }

  if (azione === 'vai') {
    if (req.method !== 'POST') return risposta({ errore: 'metodo non ammesso' }, 405);
    const b = await corpo();
    const { data: c } = await db.from('pos_conto').select('*').eq('id', String(b.conto ?? '')).maybeSingle();
    if (!c || c.stato === 'chiuso') return risposta({ errore: 'conto non aperto' }, 409);
    const righe = await righeDelConto(c.id as string);
    const p = prossima(righe);
    if (!p) return risposta({ errore: 'niente in attesa' }, 409);
    if (ePortata(b.portata) && b.portata !== p) return risposta({ errore: `la prossima e ${p}`, prossima: p }, 409);
    const rr = righe.filter((r) => r.portata === p && r.stato === 'inviata');
    const ora = adesso();
    await db.from('pos_riga').update({ stato: 'partita', partita_il: ora, aggiornato_il: ora }).in('id', rr.map((r) => r.id as string));
    await creaStampe(c, rr, p, 'vai', cameriere!.nome);
    return risposta({ partita: p, prossima: prossima(righe.map((r) => r.portata === p ? { ...r, stato: 'partita' } : r)) });
  }

  if (azione === 'storna') {
    if (req.method !== 'POST') return risposta({ errore: 'metodo non ammesso' }, 405);
    if (!puo(cameriere!, 'storno')) return risposta({ errore: 'storno non permesso' }, 403);
    const b = await corpo();
    const { data: r } = await db.from('pos_riga').select('*').eq('id', String(b.riga ?? '')).maybeSingle();
    if (!r || r.stato === 'stornata') return risposta({ errore: 'riga non trovata o gia stornata' }, 404);
    const ora = adesso();
    const { data: agg } = await db.from('pos_riga')
      .update({ stato: 'stornata', stornata_da: cameriere!.id, stornata_il: ora, motivo_storno: String(b.motivo ?? '').slice(0, 200) || null, aggiornato_il: ora })
      .eq('id', r.id).select('*').single();
    if (r.stato === 'partita') {
      const { data: c } = await db.from('pos_conto').select('*').eq('id', r.conto).single();
      const tutte = await righeDelConto(r.conto as string);
      const questa = tutte.filter((x) => x.id === r.id);
      if (c && questa.length) await creaStampe(c, questa, r.portata as Portata, 'storno', cameriere!.nome);
    }
    return risposta({ riga: agg });
  }

  if (azione === 'chiudi') {
    if (req.method !== 'POST') return risposta({ errore: 'metodo non ammesso' }, 405);
    const b = await corpo();
    const modo = ['contanti', 'carta', 'camera'].includes(String(b.modo)) ? String(b.modo) : null;
    if (!modo) return risposta({ errore: 'modo: contanti, carta o camera' }, 400);
    const { data: c } = await db.from('pos_conto').select('*').eq('id', String(b.conto ?? '')).maybeSingle();
    if (!c || c.stato === 'chiuso') return risposta({ errore: 'conto non aperto' }, 409);
    const righe = await righeDelConto(c.id as string);
    if (righe.some((r) => r.stato === 'da_inviare')) return risposta({ errore: 'ci sono righe non inviate' }, 409);
    const ora = adesso();
    const { data: agg } = await db.from('pos_conto')
      .update({ stato: 'chiuso', chiuso_come: modo, chiuso_da: cameriere!.id, chiuso_il: ora, aggiornato_il: ora }).eq('id', c.id).select('*').single();
    return risposta({ conto: agg, totale_cent: totaleCent(righe.map((r) => ({ quantita: Number(r.quantita), prezzo_cent: Number(r.prezzo_cent), stato: r.stato }))) });
  }

  /* ================= dal server locale e dall'estensione (chiave hotel) ================= */

  if (azione === 'stampe') {
    if (!chiaveHotel(req)) return risposta({ errore: 'non autorizzato' }, 401);
    if (req.method === 'GET') {
      const locale = url.searchParams.get('locale') || '';
      let q = db.from('pos_stampa').select('*').eq('stato', 'da_stampare').order('creato_il').limit(100);
      if (locale) q = q.eq('locale', locale);
      const { data } = await q;
      return risposta({ stampe: data ?? [] });
    }
    const b = await corpo();
    const ora = adesso();
    const fatte = Array.isArray(b.fatte) ? b.fatte.map(String) : [];
    if (fatte.length) await db.from('pos_stampa').update({ stato: 'stampata', stampata_il: ora, stampata_da: String(b.da ?? 'locale'), aggiornato_il: ora }).in('id', fatte);
    for (const e of (Array.isArray(b.errori) ? b.errori as { id: string; errore: string }[] : [])) {
      await db.from('pos_stampa').update({ stato: 'errore', errore: String(e.errore ?? '').slice(0, 300), aggiornato_il: ora }).eq('id', e.id);
    }
    return risposta({ esito: 'ok', fatte: fatte.length });
  }

  if (azione === 'locale-vivo') {
    if (!chiaveHotel(req)) return risposta({ errore: 'non autorizzato' }, 401);
    const b = await corpo();
    const locale = String(b.locale ?? '');
    if (!locale) return risposta({ errore: 'serve il locale' }, 400);
    await db.from('pos_battito').upsert({ locale, visto_il: adesso() }, { onConflict: 'locale' });
    return risposta({ esito: 'ok' });
  }

  if (azione === 'stampa-cloud') {
    if (!chiaveCron(req)) return risposta({ errore: 'non autorizzato' }, 401);
    /* il cloud stampa da se' solo se il PC del Bistrot tace da piu' di 90 s */
    const { data: battiti } = await db.from('pos_battito').select('locale, visto_il');
    const vivi = new Set((battiti ?? []).filter((b) => Date.now() - new Date(b.visto_il as string).getTime() < 90 * 1000).map((b) => b.locale as string));
    const { data: stampe } = await db.from('pos_stampa').select('*').eq('stato', 'da_stampare').order('creato_il').limit(50);
    let fatte = 0, saltate = 0;
    for (const s of stampe ?? []) {
      if (vivi.has(s.locale as string)) { saltate++; continue; }
      const dest = Deno.env.get(s.stampante === 'bar' ? 'POS_STAMPANTE_BAR' : 'POS_STAMPANTE_CUCINA');
      if (!dest) { saltate++; continue; }
      const [hostname, porta] = dest.split(':');
      const ora = adesso();
      try {
        const c = await Deno.connect({ hostname, port: Number(porta) });
        await c.write(escpos(String(s.testo)));
        c.close();
        await db.from('pos_stampa').update({ stato: 'stampata', stampata_il: ora, stampata_da: 'cloud', aggiornato_il: ora }).eq('id', s.id);
        fatte++;
      } catch (e) {
        await db.from('pos_stampa').update({ stato: 'errore', errore: String(e).slice(0, 300), aggiornato_il: ora }).eq('id', s.id);
      }
    }
    return risposta({ esito: 'ok', fatte, saltate });
  }

  if (azione === 'allinea-su') {
    if (!chiaveHotel(req)) return risposta({ errore: 'non autorizzato' }, 401);
    const b = await corpo();
    try {
      const esito = {
        conti: await upsertSeNuovi('pos_conto', Array.isArray(b.conti) ? b.conti as Riga[] : []),
        righe: await upsertSeNuovi('pos_riga', Array.isArray(b.righe) ? b.righe as Riga[] : []),
        comande: await upsertSeNuovi('pos_comanda', Array.isArray(b.comande) ? b.comande as Riga[] : []),
        stampe: await upsertSeNuovi('pos_stampa', Array.isArray(b.stampe) ? b.stampe as Riga[] : []),
      };
      return risposta({ esito: 'ok', ...esito });
    } catch (e) { return risposta({ errore: (e as Error).message }, 500); }
  }

  if (azione === 'allinea-giu') {
    if (!chiaveHotel(req)) return risposta({ errore: 'non autorizzato' }, 401);
    const da = url.searchParams.get('da') || '1970-01-01T00:00:00Z';
    const locale = url.searchParams.get('locale') || '';
    const tabelle = ['pos_locale', 'pos_zona', 'pos_tavolo', 'pos_categoria', 'pos_articolo', 'pos_variante', 'pos_preferito', 'pos_cameriere', 'pos_dispositivo'];
    const fuori: Record<string, unknown> = { adesso: adesso() };
    for (const t of tabelle) {
      const { data } = await db.from(t).select('*').gt('aggiornato_il', da).limit(5000);
      fuori[t.slice(4)] = data ?? [];
    }
    /* le stampe nate nel cloud (palmare in modalita' cloud) le stampa il locale, se c'e' */
    let q = db.from('pos_stampa').select('*').eq('stato', 'da_stampare').gt('aggiornato_il', da).limit(200);
    if (locale) q = q.eq('locale', locale);
    fuori.stampe = (await q).data ?? [];
    return risposta(fuori);
  }

  if (azione === 'importa-menu') {
    if (!chiaveHotel(req)) return risposta({ errore: 'non autorizzato' }, 401);
    const b = await corpo();
    const intestazioni = Array.isArray(b.intestazioni) ? b.intestazioni.map(String) : [];
    const righe = Array.isArray(b.righe) ? (b.righe as unknown[]).map((r) => Array.isArray(r) ? r.map(String) : []) : [];
    const letto = importa(intestazioni, righe);
    const ora = adesso();
    const { data: catEsistenti } = await db.from('pos_categoria').select('id, nome');
    const idCat = new Map((catEsistenti ?? []).map((c) => [String(c.nome).toLowerCase(), c.id as string]));
    let posizione = (catEsistenti ?? []).length;
    for (const c of letto.categorie) {
      if (idCat.has(c.nome.toLowerCase())) continue;
      const id = crypto.randomUUID();
      const { error } = await db.from('pos_categoria').insert({ id, nome: c.nome, posizione: posizione++, stampante: c.stampante, portata: c.portata, aggiornato_il: ora });
      if (error) return risposta({ errore: error.message }, 500);
      idCat.set(c.nome.toLowerCase(), id);
    }
    const { data: artEsistenti } = await db.from('pos_articolo').select('id, fidra_id');
    const idArt = new Map((artEsistenti ?? []).filter((a) => a.fidra_id).map((a) => [String(a.fidra_id), a.id as string]));
    let nuovi = 0, aggiornati = 0;
    for (const a of letto.articoli) {
      const esistente = idArt.get(a.fidra_id);
      if (esistente) {
        /* di un articolo gia' nostro si aggiorna solo il nome: prezzo,
           stampante e portata possono essere stati curati nel back office */
        await db.from('pos_articolo').update({ nome: a.nome, aggiornato_il: ora }).eq('id', esistente);
        aggiornati++;
      } else {
        const { error } = await db.from('pos_articolo').insert({
          id: crypto.randomUUID(), categoria: idCat.get(a.categoria.toLowerCase()), nome: a.nome,
          prezzo_cent: a.prezzo_cent, iva: a.iva, fidra_id: a.fidra_id, aggiornato_il: ora,
        });
        if (error) return risposta({ errore: error.message }, 500);
        nuovi++;
      }
    }
    return risposta({ esito: 'ok', articoli: letto.articoli.length, categorie: letto.categorie.length, nuovi, aggiornati, scartate: letto.scartate });
  }

  /* ================= dal back office (accesso dell'hotel, amministrazione) ================= */

  const azioniBackOffice = ['menu-salva', 'tavoli-salva', 'personale-salva'];
  if (azioniBackOffice.includes(azione)) {
    if (req.method !== 'POST') return risposta({ errore: 'metodo non ammesso' }, 405);
    const acc = await autorizzato(req);
    if (!acc.ok) return risposta({ errore: 'non autorizzato' }, 401);
    if (!acc.chiave && acc.ruolo !== 'amministrazione') return risposta({ errore: 'solo l amministrazione' }, 403);
  }

  if (azione === 'menu-salva') {
    const b = await corpo();
    const ora = adesso();
    const conOra = (r: Riga): Riga => ({ ...r, aggiornato_il: ora });
    try {
      for (const [tabella, chiave] of [['pos_categoria', 'categorie'], ['pos_articolo', 'articoli'], ['pos_variante', 'varianti']] as const) {
        const righe = Array.isArray(b[chiave]) ? (b[chiave] as Riga[]).map(conOra) : [];
        if (righe.length) { const { error } = await db.from(tabella).upsert(righe, { onConflict: 'id' }); if (error) throw new Error(`${tabella}: ${error.message}`); }
      }
      if (Array.isArray(b.preferiti)) {
        const pref = (b.preferiti as Riga[]).map(conOra);
        const locali = [...new Set(pref.map((p) => p.locale as string))];
        for (const l of locali) await db.from('pos_preferito').delete().eq('locale', l);
        if (pref.length) { const { error } = await db.from('pos_preferito').insert(pref); if (error) throw new Error(`pos_preferito: ${error.message}`); }
      }
      return risposta({ esito: 'ok' });
    } catch (e) { return risposta({ errore: (e as Error).message }, 500); }
  }

  if (azione === 'tavoli-salva') {
    const b = await corpo();
    const ora = adesso();
    const conOra = (r: Riga): Riga => ({ ...r, aggiornato_il: ora });
    try {
      for (const [tabella, chiave] of [['pos_locale', 'locali'], ['pos_zona', 'zone'], ['pos_tavolo', 'tavoli']] as const) {
        const righe = Array.isArray(b[chiave]) ? (b[chiave] as Riga[]).map(conOra) : [];
        if (righe.length) { const { error } = await db.from(tabella).upsert(righe, { onConflict: 'id' }); if (error) throw new Error(`${tabella}: ${error.message}`); }
      }
      return risposta({ esito: 'ok' });
    } catch (e) { return risposta({ errore: (e as Error).message }, 500); }
  }

  if (azione === 'personale-salva') {
    const b = await corpo();
    const ora = adesso();
    const camerieri = Array.isArray(b.camerieri) ? b.camerieri as Riga[] : [];
    const dispositivi = Array.isArray(b.dispositivi) ? b.dispositivi as Riga[] : [];
    const tokenNuovi: { id: string; nome: string; token: string }[] = [];
    try {
      for (const c of camerieri) {
        const id = String(c.id ?? crypto.randomUUID());
        const codice = String(c.codice ?? '').trim();
        if (!codice || !c.nome) return risposta({ errore: 'ogni cameriere ha nome e codice' }, 400);
        const riga: Riga = { id, nome: c.nome, codice, ruolo: c.ruolo ?? 'cameriere', storni: !!c.storni, bloccato: !!c.bloccato, aggiornato_il: ora };
        const pin = String(c.pin ?? '').trim();
        if (pin) riga.pin_hash = await hashPin(codice, pin);
        else {
          const { data: e } = await db.from('pos_cameriere').select('pin_hash').eq('id', id).maybeSingle();
          if (!e) return risposta({ errore: `${c.nome}: serve un PIN` }, 400);
        }
        const { error } = await db.from('pos_cameriere').upsert(riga, { onConflict: 'id' });
        if (error) throw new Error(error.message);
      }
      for (const d of dispositivi) {
        const id = String(d.id ?? crypto.randomUUID());
        const { data: e } = await db.from('pos_dispositivo').select('token').eq('id', id).maybeSingle();
        const riga: Riga = { id, nome: d.nome ?? 'Palmare', locale: d.locale ?? null, bloccato: !!d.bloccato, aggiornato_il: ora };
        if (!e) { riga.token = tokenCasuale(); tokenNuovi.push({ id, nome: String(riga.nome), token: String(riga.token) }); }
        const { error } = await db.from('pos_dispositivo').upsert(riga, { onConflict: 'id' });
        if (error) throw new Error(error.message);
      }
      return risposta({ esito: 'ok', dispositivi_nuovi: tokenNuovi });
    } catch (e) { return risposta({ errore: (e as Error).message }, 500); }
  }

  return risposta({ errore: 'azione sconosciuta' }, 404);
});
