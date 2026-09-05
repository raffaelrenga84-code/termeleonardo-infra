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
     POST ?a=importa-sala      → zone e tavoli letti dalla piantina di Fidra
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
import { importa, prezziSensati } from './menu.ts';
import { leggiInCasa } from './in-casa.ts';
import { riepilogo } from './giornata.ts';
import { chiusoCome, importoValido, residuo, resto } from './pagamenti.ts';
import { applicaFascia, fasciaAttiva, minutiDi, oraLocale, prezzoInFascia } from './fasce.ts';
import type { Fascia, PrezzoFascia } from './fasce.ts';
import { cameraCombacia, codiceTessera, dallHotel, ipDi, numeroOrdine, righeOrdine, tavoloFirmato, firmaTavolo, type RigaOspite } from './ospite.ts';
import { apertoOra, leggiOrari, restringi, stampanteAdesso } from './orari.ts';
/* chi ordina dal QR si ferma dieci minuti prima della fine di ogni orario:
   alle 14:30 in punto la cucina non deve trovare un ordine nuovo (la
   proprieta', 5 settembre 2026) */
const MARGINE_OSPITI = 10;
import { chiaveStripe, dividiParametri, firmaValida, parametriLink, segretoWebhook, STRIPE } from './stripe.ts';
import { motivoDelPrezzo, motivoPulito, prezzoCambiato } from './motivi.ts';
import { localeChePrepara, portareA, siStampa } from './dove.ts';
import { categoriaVino } from './vini.ts';
import { chiaveNome, leggiSala } from './sala.ts';
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
/* una firma col dito sta in pochi kilobyte: oltre, qualcosa non torna */
const FIRMA_MAX = 300_000;

/* La tessera della camera. La stessa porta che usa il totem in hall
   (privacy, conto Day Spa): a Fidra si chiede /api/bill-scanner/<codice> e
   torna la camera. Qui serve al cameriere per aprire un conto in camera
   senza chiedere il numero all'ospite, che spesso non lo sa.
   Legge e basta: in Fidra non si scrive niente. */
async function cameraDallaTessera(codice: string): Promise<{ stato: number; camera: string | null; lingua: string | null }> {
  const chiave = Deno.env.get('FIDRA_TOTEM_KEY');
  const base = Deno.env.get('FIDRA_TOTEM_URL');
  if (!chiave || !base) return { stato: 503, camera: null, lingua: null };
  const radice = base.endsWith('/') ? base.slice(0, -1) : base;
  try {
    const r = await fetch(radice + '/api/bill-scanner/' + encodeURIComponent(codice), {
      headers: { authorization: 'Bearer ' + chiave, accept: 'application/json' },
    });
    if (!r.ok) return { stato: r.status, camera: null, lingua: null };
    const dati = await r.json().catch(() => null) as Riga | null;
    const camera = dati && dati.room !== undefined && dati.room !== null ? String(dati.room).trim() : '';
    const lingua = dati && typeof dati.locale === 'string' ? dati.locale : null;
    return { stato: camera ? 200 : 404, camera: camera || null, lingua };
  } catch (e) {
    console.error('tessera: Fidra non risponde', e);
    return { stato: 502, camera: null, lingua: null };
  }
}

/* Come si chiama un conto in sala. Il cameriere puo' scriverci sopra il
   nome di chi paga: al tavolo cinque conti tutti «Esterno» non si
   distinguono («non posso eliminare gli esterni o scrivere nome», la
   proprieta', 4 settembre 2026). */
function titoloConto(c: Riga): string {
  const suo = String(c.nome ?? '').trim();
  if (suo) return suo;
  if (c.tipo === 'camera') return `Camera ${c.camera ?? ''}`.trim() + (c.ospite ? ` · ${c.ospite}` : '');
  return 'Esterno';
}

async function hashPin(codice: string, pin: string): Promise<string> {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${codice}:${pin}`));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

/* Il codice di un palmare: OTTO caratteri senza 0/O/1/I, da digitare a mano
   sul palmare («non basta un codice da 8 cifre?», la proprieta', 4 settembre
   2026). Otto caratteri su trentadue sono mille miliardi di combinazioni, e
   la pagina /pos risponde solo dall'IP dell'hotel: chi provasse a indovinare
   dovrebbe gia' essere in casa, e poi servirebbe anche il PIN di un
   cameriere. I codici lunghi di prima continuano a valere. */
function tokenCasuale(lunghezza = 8): string {
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return [...crypto.getRandomValues(new Uint8Array(lunghezza))].map((b) => a[b % 32]).join('');
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
type RigaStampabile = Riga & { stampante: 'cucina' | 'bar'; locale_stampa: string | null; portata: Portata; stato: string };
async function righeDelConto(conto: string): Promise<RigaStampabile[]> {
  const { data } = await db.from('pos_riga')
    .select('*, art:pos_articolo(stampante, locale_stampa, cat:pos_categoria(stampante, locale_stampa))')
    .eq('conto', conto).order('creata_il');
  return (data ?? []).map((r) => {
    const art = r.art as unknown as
      { stampante: string | null; locale_stampa: string | null; cat: { stampante: string; locale_stampa: string | null } | null } | null;
    const stampante = (art?.stampante ?? art?.cat?.stampante ?? 'cucina') as 'cucina' | 'bar';
    /* dove si prepara: la riga se lo dice, se no l'articolo, se no la
       categoria; il locale del tavolo lo mette creaStampe */
    const locale_stampa = localeChePrepara({
      riga: r.locale_stampa as string | null, articolo: art?.locale_stampa ?? null, categoria: art?.cat?.locale_stampa ?? null, tavolo: '',
    }) || null;
    const { art: _a, ...resto } = r as Riga & { art: unknown };
    return { ...resto, stampante, locale_stampa } as RigaStampabile;
  });
}

/* ---------- le stampe di una portata: un biglietto per stampante ---------- */
async function creaStampe(conto: Riga, righe: RigaStampabile[], portata: Portata, tipo: 'comanda' | 'vai' | 'storno' | 'modifica', cameriere: string) {
  const { data: tavolo } = await db.from('pos_tavolo').select('nome, z:pos_zona(l:pos_locale(id, nome))').eq('id', conto.tavolo as string).single();
  const locale = (tavolo?.z as unknown as { l: { id: string; nome: string } } | null)?.l;
  if (!locale) return;
  /* Un biglietto per ogni coppia (locale che prepara, stampante): di
     regola si prepara dove si mangia, ma il ristorante puo' mandare le
     bevande al Bistrot e allora il biglietto esce di la'. */
  const { data: locali } = await db.from('pos_locale').select('id, nome, stampante_cucina, stampante_bar, orari_cucina');
  const adessoOra = oraLocale(new Date());
  const nomeDelLocale = (id: string) => (locali ?? []).find((l) => l.id === id)?.nome as string ?? null;
  const gruppi = new Map<string, RigaStampabile[]>();
  for (const r of righe) {
    const dove = localeChePrepara({ riga: r.locale_stampa as string | null, tavolo: locale.id });
    /* a cucina chiusa il biglietto della cucina esce al bancone (orari.ts) */
    const stampante = stampanteAdesso(r.stampante, (locali ?? []).find((l) => l.id === dove)?.orari_cucina, adessoOra);
    const chiave = `${dove}|${stampante}|${r.stampante}`;
    gruppi.set(chiave, [...(gruppi.get(chiave) ?? []), r]);
  }
  const stampe = [...gruppi].flatMap(([chiave, rr]) => {
    const [dove, stampante, originale] = chiave.split('|');
    /* dove non c'e' stampante non si stampa: il biglietto resterebbe in
       coda per sempre. La riga resta sul conto, e il giorno che una
       stampante arriva comincia a uscire da sola. */
    if (!siStampa({ stampante: stampante as 'cucina' | 'bar', locale: (locali ?? []).find((l) => l.id === dove) })) return [];
    const b: Biglietto = {
      tipo: tipo.toUpperCase() as Biglietto['tipo'], locale: locale.nome, tavolo: String(tavolo!.nome),
      conto: conto.tipo === 'camera' ? `Camera ${conto.camera ?? ''}`.trim() : 'Esterno',
      coperti: Number(conto.coperti ?? 1), portata, ora: oraRoma(), cameriere,
      righe: rr.map((r) => ({ quantita: Number(r.quantita), nome: String(r.nome), variante: (r.variante as string | null) ?? null, nota: (r.nota as string | null) ?? null })),
      noteVitto: null,
      portareA: portareA({ preparaIn: dove, tavoloIn: locale.id, nomeDelLocale }),
      avviso: stampante !== originale ? 'cucina chiusa: al bancone' : null,
    };
    return [{ id: crypto.randomUUID(), locale: dove, stampante, testo: testoBiglietto(b) }];
  });
  if (stampe.length) await db.from('pos_stampa').insert(stampe);
  await db.from('pos_comanda').insert({ id: crypto.randomUUID(), conto: conto.id, portata, tipo, righe: righe.map((r) => r.id) });
}

/* ---------- allineamento: upsert per id, vince aggiornato_il piu' recente ---------- */
/* ---------- l'ordine dal tavolo (QR): Stripe e la cucina ---------- */
const PAGINA_ORDINA = Deno.env.get('PAGINA_ORDINA') || 'https://www.hoteltermeleonardo.com/ordina';
const POS_PROVA = Deno.env.get('POS_PROVA') === '1';
/* il cameriere fittizio che apre e chiude i conti degli ospiti col QR:
   bloccato, con un codice che nessun tastierino puo' battere */
const OSPITI_QR = 'ospiti-qr';

async function stripe(chiave: string, percorso: string, corpo: Record<string, string>): Promise<Record<string, unknown>> {
  const r = await fetch(STRIPE + percorso, {
    method: 'POST', headers: { authorization: 'Bearer ' + chiave, 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(corpo),
  });
  const j = await r.json().catch(() => ({})) as Record<string, unknown>;
  if (!r.ok) throw new Error(`Stripe ${percorso}: ${r.status} ${String((j.error as { message?: string } | undefined)?.message ?? '')}`);
  return j;
}

const segnaErroreOrdine = (numero: string, messaggio: string) =>
  db.from('pos_ordine_ospite').update({ stato: 'errore', errore: messaggio.slice(0, 300), aggiornato_il: adesso() }).eq('id', numero);

/* L'ordine pagato (o addebitato) diventa un conto vero: le righe, la
   comanda in cucina e al bar con scritto chi l'ha fatto e come ha pagato,
   e la chiusura subito — con la carta gia' incassata (pos_pagamento), o
   in camera nella coda degli addebiti. Le portate partono tutte insieme:
   nessun cameriere premera' «Vai» per un conto gia' chiuso. */
async function mandaInCucina(o: Riga): Promise<void> {
  const ora = adesso();
  const numero = String(o.id);
  const righe = (Array.isArray(o.righe) ? o.righe : []) as RigaOspite[];
  const totale = Number(o.totale_cent) || 0;
  const inCamera = o.modo === 'camera';
  const conto: Riga = {
    id: crypto.randomUUID(), tavolo: String(o.tavolo), tipo: inCamera ? 'camera' : 'esterno',
    camera: inCamera ? String(o.camera ?? '') || null : null, tessera: inCamera ? String(o.tessera ?? '') || null : null,
    ospite: inCamera ? ((o.ospite as string | null) ?? null) : null, nome: `QR ${numero}${!inCamera && o.camera ? ` · camera ${String(o.camera)}` : ''}`, lingua: (o.lingua as string | null) ?? null,
    coperti: 1, stato: 'aperto', aperto_da: OSPITI_QR, aperto_il: ora, aggiornato_il: ora,
  };
  const { error: e1 } = await db.from('pos_conto').insert(conto);
  if (e1) { await segnaErroreOrdine(numero, e1.message); return; }
  const { data: arts } = await db.from('pos_articolo').select('id, portata, cat:pos_categoria(portata)').in('id', righe.map((r) => r.articolo));
  const inserite: Riga[] = righe.map((r) => {
    const a = (arts ?? []).find((x) => x.id === r.articolo);
    const cat = a?.cat as unknown as { portata: Portata } | null;
    const portata = ePortata(r.portata) ? r.portata : (a && ePortata(a.portata) ? a.portata : (cat?.portata ?? 'secondi'));
    return {
      id: crypto.randomUUID(), conto: conto.id, articolo: r.articolo, nome: r.nome, quantita: r.quantita,
      prezzo_listino_cent: r.prezzo_cent, prezzo_cent: r.prezzo_cent, variante: null, nota: r.nota, motivo_prezzo: null, locale_stampa: null,
      portata, stato: 'partita', partita_il: ora, creata_da: OSPITI_QR, aggiornato_il: ora,
    };
  });
  const { error: e2 } = await db.from('pos_riga').insert(inserite);
  if (e2) { await segnaErroreOrdine(numero, e2.message); return; }
  const tutte = await righeDelConto(conto.id as string);
  const chi = inCamera ? `QR · IN CAMERA ${String(conto.camera ?? '')}` : `QR · PAGATO ONLINE${o.camera ? ` · CAMERA ${String(o.camera)}` : ''}`;
  for (const p of PORTATE) {
    const rr = tutte.filter((r) => r.portata === p);
    if (rr.length) await creaStampe(conto, rr, p, 'comanda', chi);
  }
  const come = inCamera ? 'camera' : 'carta';
  await db.from('pos_conto').update({ stato: 'chiuso', chiuso_come: come, chiuso_da: OSPITI_QR, chiuso_il: ora, aggiornato_il: ora }).eq('id', conto.id as string);
  if (!inCamera) {
    await db.from('pos_pagamento').insert({ id: crypto.randomUUID(), conto: conto.id, modo: 'carta', importo_cent: totale, ricevuto_cent: null, cameriere: OSPITI_QR, il: ora, aggiornato_il: ora });
  } else {
    const { data: tv } = await db.from('pos_tavolo').select('z:pos_zona(locale)').eq('id', String(o.tavolo)).maybeSingle();
    const locale = (tv?.z as unknown as { locale: string } | null)?.locale ?? null;
    await db.from('pos_addebito').insert({
      id: crypto.randomUUID(), conto: conto.id, locale, camera: String(conto.camera ?? ''), tessera: conto.tessera ?? null, ospite: conto.ospite ?? null,
      totale_cent: totale, righe: righe.map((r) => ({ quantita: r.quantita, nome: r.nome, totale_cent: r.quantita * r.prezzo_cent })),
      firma: null, firmato_il: null, chiuso_da: OSPITI_QR, chiuso_il: ora, stato: 'da_riportare', aggiornato_il: ora,
    });
  }
  await db.from('pos_ordine_ospite').update({ stato: 'in_cucina', conto: conto.id, aggiornato_il: adesso() }).eq('id', numero);
}

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

  /* ================= dall'ospite al tavolo (QR) =================
     Nessuna sessione: il QR porta l'id del tavolo e la sua firma
     (ospite.ts). Il menu' e' pubblico; l'ordine diventa un conto solo
     dopo il pagamento (Stripe, webhook) o con tessera e camera che
     combaciano (la proprieta', 5 settembre 2026). */
  /* Senza QR: l'ospite sceglie il tavolo da una griglia («puoi anche
     mettere il numero del tavolo a mano», la proprieta', 5 settembre
     2026). L'elenco e' pubblico e porta la firma di ogni tavolo: la firma
     da sola non proteggeva niente di piu' — chi ordina paga prima, e la
     camera vuole tessera e numero. Il QR sul tavolo resta la scorciatoia. */
  if (azione === 'ospite-tavoli') {
    if (!dallHotel(req.headers, Deno.env.get('POS_IP_OSPITI') || Deno.env.get('TOTEM_IP'))) return risposta({ errore: `si ordina dalla rete Wi-Fi dell hotel (il suo indirizzo: ${ipDi(req.headers)})` }, 403);
    const segreto = Deno.env.get('HOTEL_KEY') ?? '';
    const [{ data: locali }, { data: zone }, { data: tavoli }] = await Promise.all([
      db.from('pos_locale').select('id, nome').order('nome'),
      db.from('pos_zona').select('id, locale, nome, posizione').order('posizione'),
      db.from('pos_tavolo').select('id, zona, nome').eq('attivo', true),
    ]);
    const fuori = [];
    for (const tv of tavoli ?? []) fuori.push({ id: tv.id, nome: tv.nome, zona: tv.zona, k: await firmaTavolo(String(tv.id), segreto) });
    fuori.sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'it', { numeric: true }));
    return risposta({ locali: locali ?? [], zone: zone ?? [], tavoli: fuori });
  }

  const azioniOspite = ['ospite-menu', 'ospite-ordine', 'ospite-stato'];
  if (azioniOspite.includes(azione)) {
    /* solo dalla rete dell'hotel (TOTEM_IP): fuori, la pagina non ordina */
    if (!dallHotel(req.headers, Deno.env.get('POS_IP_OSPITI') || Deno.env.get('TOTEM_IP'))) return risposta({ errore: `si ordina dalla rete Wi-Fi dell hotel (il suo indirizzo: ${ipDi(req.headers)})` }, 403);
    const b = req.method === 'POST' ? await corpo() : {};
    const t = String(url.searchParams.get('t') ?? b.t ?? ''), k = String(url.searchParams.get('k') ?? b.k ?? '');
    if (!(await tavoloFirmato(t, k, Deno.env.get('HOTEL_KEY')))) return risposta({ errore: 'tavolo non riconosciuto: inquadri di nuovo il codice sul tavolo' }, 403);
    const { data: tav } = await db.from('pos_tavolo').select('id, nome, attivo, z:pos_zona(nome, locale)').eq('id', t).maybeSingle();
    if (!tav || tav.attivo === false) return risposta({ errore: 'tavolo non trovato' }, 404);
    const zona = tav.z as unknown as { nome: string; locale: string } | null;
    const locale = zona?.locale ?? null;

    if (azione === 'ospite-menu') {
      const [cat, art, fas, pf] = await Promise.all([
        db.from('pos_categoria').select('id, nome, posizione, colore, sotto, per_ospiti, note_rapide, nomi, orari').eq('attiva', true),
        db.from('pos_articolo').select('id, categoria, nome, prezzo_cent, portata, esaurito, prezzo_libero, nomi, descrizioni, allergeni, orari').eq('attivo', true),
        db.from('pos_fascia').select('*').eq('attiva', true),
        db.from('pos_prezzo_fascia').select('*'),
      ]);
      const categorie = (cat.data ?? []).filter((c) => c.per_ospiti !== false);
      /* gli orari del menu (orari.ts): l'articolo vince sulla categoria, la
         categoria figlia eredita dalla madre; vuoto = sempre. Ogni voce dice
         se e' ordinabile adesso (disponibile) e le sue finestre, che la
         pagina mostra tradotte */
      const adessoOra = oraLocale(new Date());
      const perId = new Map(categorie.map((c) => [c.id as string, c]));
      const finestreCat = (c: { orari?: unknown; sotto?: unknown } | undefined) => c ? (leggiOrari(c.orari) ?? (c.sotto ? leggiOrari(perId.get(c.sotto as string)?.orari) : null)) : null;
      const categorieOspite = categorie.map((c) => { const finestre = restringi(finestreCat(c), MARGINE_OSPITI); return { ...c, finestre, disponibile: apertoOra(finestre, adessoOra) }; });
      const idCat = new Set(categorie.map((c) => c.id as string));
      const fascia = fasciaAttiva({ fasce: (fas.data ?? []) as Fascia[], adesso: oraLocale(new Date()), locale });
      const articoli = applicaFascia({
        articoli: (art.data ?? []).filter((a) => idCat.has(a.categoria as string) && !a.prezzo_libero && !a.esaurito) as { id: string; categoria: string | null; prezzo_cent: number }[],
        fascia, prezzi: (pf.data ?? []) as PrezzoFascia[],
      });
      const articoliOspite = articoli.map((a) => { const finestre = restringi(leggiOrari((a as { orari?: unknown }).orari) ?? finestreCat(perId.get(a.categoria as string)), MARGINE_OSPITI); return { ...a, finestre, disponibile: apertoOra(finestre, adessoOra) }; });
      return risposta({ tavolo: { id: tav.id, nome: tav.nome, zona: zona?.nome ?? null, locale }, categorie: categorieOspite, articoli: articoliOspite, fascia: fascia ? { nome: fascia.nome, alle: fascia.alle } : null, prova: POS_PROVA, carta: !!chiaveStripe(POS_PROVA) });
    }

    if (azione === 'ospite-stato') {
      const numero = String(url.searchParams.get('ordine') ?? '');
      const { data: o } = await db.from('pos_ordine_ospite').select('id, stato, modo, totale_cent, errore').eq('id', numero).eq('tavolo', t).maybeSingle();
      if (!o) return risposta({ errore: 'ordine non trovato' }, 404);
      return risposta({ ordine: o });
    }

    /* ospite-ordine */
    if (req.method !== 'POST') return risposta({ errore: 'metodo non ammesso' }, 405);
    const modo = b.modo === 'camera' ? 'camera' : b.modo === 'carta' ? 'carta' : null;
    if (!modo) return risposta({ errore: 'come paga: carta o camera' }, 400);
    const richiesti = [...new Set((Array.isArray(b.righe) ? b.righe as Record<string, unknown>[] : []).map((r) => String(r?.articolo ?? '')).filter(Boolean))];
    const [{ data: arts }, { data: fas }, { data: pf }, { data: madri }] = await Promise.all([
      richiesti.length ? db.from('pos_articolo').select('id, categoria, nome, prezzo_cent, portata, esaurito, prezzo_libero, attivo, orari, cat:pos_categoria(portata, per_ospiti, attiva, sotto, orari)').in('id', richiesti) : Promise.resolve({ data: [] }),
      db.from('pos_fascia').select('*').eq('attiva', true),
      db.from('pos_prezzo_fascia').select('*'),
      db.from('pos_categoria').select('id, orari'),
    ]);
    const adessoOra = oraLocale(new Date());
    const fascia = fasciaAttiva({ fasce: (fas ?? []) as Fascia[], adesso: adessoOra, locale });
    /* gli orari: articolo, se no categoria, se no la categoria madre (orari.ts) */
    const orariMadre = (id: unknown) => (madri ?? []).find((m) => m.id === id)?.orari;
    const finestreDi = (a: { orari?: unknown; cat?: unknown }) => { const c = a.cat as { orari?: unknown; sotto?: unknown } | null; return leggiOrari(a.orari) ?? (c ? (leggiOrari(c.orari) ?? (c.sotto ? leggiOrari(orariMadre(c.sotto)) : null)) : null); };
    const vendibili = (arts ?? []).filter((a) => { const c = a.cat as unknown as { per_ospiti: boolean; attiva: boolean } | null; return !!c && c.attiva && c.per_ospiti !== false; }).map((a) => ({
      id: a.id as string, nome: String(a.nome), categoria: a.categoria as string, esaurito: !!a.esaurito, prezzo_libero: !!a.prezzo_libero, attivo: a.attivo !== false,
      fuori_orario: !apertoOra(restringi(finestreDi(a as { orari?: unknown; cat?: unknown }), MARGINE_OSPITI), adessoOra),
      portata: (a.portata as string | null) ?? ((a.cat as unknown as { portata: string } | null)?.portata ?? null),
      prezzo_cent: prezzoInFascia({ articolo: { id: a.id as string, categoria: a.categoria as string, prezzo_cent: Number(a.prezzo_cent) }, fascia, prezzi: (pf ?? []) as PrezzoFascia[] }) ?? Number(a.prezzo_cent),
    }));
    const esito = righeOrdine(b.righe, vendibili);
    if (!esito.ok) return risposta({ errore: esito.errore }, 400);
    const lingua = ['it', 'en', 'de', 'fr'].includes(String(b.lingua)) ? String(b.lingua) : 'it';
    const numero = numeroOrdine();
    const ora = adesso();
    if (modo === 'camera') {
      /* tessera E numero di camera, che devono combaciare: chi trova una
         tessera per terra non sa la camera */
      const tessera = codiceTessera(b.tessera);
      const camera = String(b.camera ?? '').trim();
      if (!tessera || !camera) return risposta({ errore: 'servono la tessera della camera e il numero della camera' }, 400);
      const f = await cameraDallaTessera(tessera);
      if (f.stato === 503) return risposta({ errore: 'addebito in camera non disponibile: paghi con la carta o chiami il cameriere' }, 503);
      if (f.stato !== 200) return risposta({ errore: 'tessera non riconosciuta' }, 404);
      if (!cameraCombacia(camera, f.camera)) return risposta({ errore: 'il numero di camera non corrisponde alla tessera' }, 403);
      const ordine = { id: numero, tavolo: t, lingua, righe: esito.righe, totale_cent: esito.totale_cent, modo, camera: f.camera, tessera, ospite: String(b.ospite ?? '').trim().slice(0, 40) || null, stato: 'pagato', prova: POS_PROVA, creato_il: ora, aggiornato_il: ora };
      const { error } = await db.from('pos_ordine_ospite').insert(ordine);
      if (error) return risposta({ errore: error.message }, 500);
      await mandaInCucina(ordine);
      return risposta({ numero, stato: 'in_cucina' });
    }
    /* carta: l'ordine aspetta la conferma di Stripe (webhook) */
    const chiave = chiaveStripe(POS_PROVA);
    if (!chiave) return risposta({ errore: 'pagamento con carta non disponibile: chiami il cameriere' }, 503);
    const consegna = String(b.consegna ?? '').trim().slice(0, 10) || null;
    const ordine = { id: numero, tavolo: t, lingua, righe: esito.righe, totale_cent: esito.totale_cent, modo, camera: consegna, stato: 'in_attesa', prova: POS_PROVA, creato_il: ora, aggiornato_il: ora };
    const { error } = await db.from('pos_ordine_ospite').insert(ordine);
    if (error) return risposta({ errore: error.message }, 500);
    try {
      const ritorno = `${PAGINA_ORDINA}?t=${encodeURIComponent(t)}&k=${encodeURIComponent(k)}&ordine=${numero}&l=${lingua}`;
      const { prezzo, link } = dividiParametri(parametriLink({ numero, descrizione: `Hotel Terme Leonardo · ${String(tav.nome)} · ${numero}`, importoCent: esito.totale_cent, redirect: ritorno }));
      const p = await stripe(chiave, '/prices', prezzo);
      const l = await stripe(chiave, '/payment_links', { 'line_items[0][price]': String(p.id), ...link });
      await db.from('pos_ordine_ospite').update({ stripe_link: String(l.id), aggiornato_il: adesso() }).eq('id', numero);
      return risposta({ numero, stato: 'in_attesa', url: String(l.url) });
    } catch (e) {
      await segnaErroreOrdine(numero, (e as Error).message);
      return risposta({ errore: 'il pagamento non parte: riprovi o chiami il cameriere' }, 502);
    }
  }

  /* Stripe conferma l'incasso dell'ordine al tavolo: l'ordine va in cucina.
     Lo stesso evento arriva anche ai webhook dei buoni e del Day Spa, che
     lo ignorano perche' il numero non e' loro; qui vale il contrario. */
  if (azione === 'webhook') {
    if (req.method !== 'POST') return risposta({ errore: 'metodo non ammesso' }, 405);
    const grezzo = await req.text();
    if (!(await firmaValida(grezzo, req.headers.get('stripe-signature'), segretoWebhook(POS_PROVA)))) {
      console.warn('webhook con firma non valida: ignorato');
      return risposta({ errore: 'firma non valida' }, 400);
    }
    const evento = JSON.parse(grezzo) as { type: string; data: { object: Record<string, unknown> } };
    if (evento.type !== 'checkout.session.completed') return risposta({ esito: 'ok', ignorato: evento.type });
    const s = evento.data.object;
    const numero = String((s.metadata as Record<string, string> | null)?.numero ?? '');
    const linkId = String(s.payment_link ?? '');
    let q = db.from('pos_ordine_ospite').select('*');
    q = numero ? q.eq('id', numero) : q.eq('stripe_link', linkId);
    const { data: o } = await q.maybeSingle();
    if (!o) { console.log('webhook per un ordine non nostro', numero || linkId); return risposta({ esito: 'ok', sconosciuto: true }); }
    if (o.stato !== 'in_attesa') return risposta({ esito: 'ok', gia: o.stato });
    await db.from('pos_ordine_ospite').update({ stato: 'pagato', stripe_pagamento: String(s.payment_intent ?? '') || null, aggiornato_il: adesso() }).eq('id', o.id);
    await mandaInCucina({ ...o, stato: 'pagato' });
    return risposta({ esito: 'ok' });
  }

  /* ================= dal palmare ================= */

  if (azione === 'accesso') {
    if (req.method !== 'POST') return risposta({ errore: 'metodo non ammesso' }, 405);
    const disp = await dispositivoDi(req);
    if (!disp) return risposta({ errore: 'dispositivo non registrato' }, 401);
    const b = await corpo();
    const codice = String(b.codice ?? '').trim(), pin = String(b.pin ?? '').trim();
    if (!codice) return risposta({ errore: 'serve il codice' }, 400);
    const { data: c } = await db.from('pos_cameriere').select('*').eq('codice', codice).eq('bloccato', false).maybeSingle();
    /* un codice che non esiste lo si dice subito: chiedere un PIN per un
       cameriere che non c'e' fa perdere tempo e non protegge niente (chi
       ha il palmare e' gia' dentro l'hotel) */
    if (!c) return risposta({ errore: 'codice non riconosciuto' }, 401);
    /* «basta il codice» per chi e' segnato senza PIN: la pagina risponde
       solo dall'IP dell'hotel e il palmare ha gia' il suo codice. Agli
       altri il PIN si chiede, e la pagina lo capisce da questa risposta. */
    const senzaPin = !!c.senza_pin;
    if (!pin && !senzaPin) return risposta({ errore: 'serve il PIN' }, 400);
    if (!senzaPin && c.pin_hash !== await hashPin(codice, pin)) return risposta({ errore: 'PIN sbagliato' }, 401);
    const sessione = crypto.randomUUID();
    const scade = new Date(Date.now() + 14 * 60 * 60 * 1000).toISOString();
    await db.from('pos_sessione').insert({ id: sessione, cameriere: c.id, dispositivo: disp.id, scade_il: scade });
    await db.from('pos_dispositivo').update({ ultimo_accesso: adesso() }).eq('id', disp.id);
    return risposta({ sessione, scade_il: scade, cameriere: { id: c.id, nome: c.nome, ruolo: c.ruolo, storni: c.storni, senza_pin: senzaPin } });
  }

  const cameriere = await cameriereDi(req);
  const azioniPalmare = ['menu', 'sala', 'conto', 'conto-cambia', 'conto-elimina', 'righe', 'invia', 'vai', 'storna', 'sposta', 'chiudi', 'articolo-cambia', 'tessera', 'tavolo-sposta', 'paga'];
  if (azioniPalmare.includes(azione) && !cameriere) return risposta({ errore: 'sessione non valida' }, 401);

  if (azione === 'menu') {
    const [cat, art, vari, pref, fas, pf] = await Promise.all([
      db.from('pos_categoria').select('*').eq('attiva', true).order('posizione'),
      db.from('pos_articolo').select('*').eq('attivo', true).order('posizione'),
      db.from('pos_variante').select('*').order('posizione'),
      db.from('pos_preferito').select('*').order('posizione'),
      db.from('pos_fascia').select('*').eq('attiva', true),
      db.from('pos_prezzo_fascia').select('*'),
    ]);
    /* il listino in vigore adesso, per il locale del palmare (fasce.ts):
       happy hour e prezzo di sera si vedono gia' sul palmare */
    const localeMenu = url.searchParams.get('locale') || '';
    const fascia = fasciaAttiva({ fasce: (fas.data ?? []) as Fascia[], adesso: oraLocale(new Date()), locale: localeMenu });
    const tutte = [...(cat.data ?? []), ...(art.data ?? []), ...(vari.data ?? []), ...(pref.data ?? [])].map((r) => String(r.aggiornato_il));
    /* i locali servono al palmare per «dove si prepara»: il ristorante
       che manda le bevande al Bistrot deve poterlo scegliere */
    const { data: locali } = await db.from('pos_locale').select('id, nome').order('nome');
    return risposta({
      categorie: cat.data ?? [],
      articoli: applicaFascia({ articoli: (art.data ?? []) as { id: string; categoria: string | null; prezzo_cent: number }[], fascia, prezzi: (pf.data ?? []) as PrezzoFascia[] }),
      varianti: vari.data ?? [], preferiti: pref.data ?? [], locali: locali ?? [],
      fascia: fascia ? { id: fascia.id, nome: fascia.nome, alle: fascia.alle } : null,
      aggiornato_il: tutte.sort().pop() ?? null,
    });
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
        nome: c.nome ?? null, titolo: titoloConto(c),
        totale_cent: totaleCent(rr.map((r) => ({ quantita: Number(r.quantita), prezzo_cent: Number(r.prezzo_cent), stato: String(r.stato) }))),
        attesa: rr.some((r) => r.stato === 'inviata'),
        da_inviare: rr.some((r) => r.stato === 'da_inviare'),
        ultima: rr.map((r) => String(r.creata_il)).sort().pop() ?? c.aperto_il,
      };
    });
    /* gli ordini arrivati dal QR sul tavolo negli ultimi venti minuti: il
       cameriere li vede in cima alla sala, anche se la stampante tace
       (il conto e' gia' chiuso, pagato o in camera: qui non ci sarebbe) */
    const daQuando = new Date(Date.now() - 20 * 60 * 1000).toISOString();
    const { data: qr } = idTavoli.length
      ? await db.from('pos_ordine_ospite').select('id, tavolo, totale_cent, modo, camera, creato_il').eq('stato', 'in_cucina').gte('creato_il', daQuando).in('tavolo', idTavoli).order('creato_il', { ascending: false }).limit(20)
      : { data: [] };
    const nomeTavolo = new Map((tavoli ?? []).map((t) => [t.id as string, String(t.nome)]));
    return risposta({
      zone: zone ?? [],
      tavoli: (tavoli ?? []).map((t) => ({ ...t, conti: contiPronti.filter((c) => c.tavolo === t.id) })),
      qr_recenti: (qr ?? []).map((o) => ({ numero: o.id, tavolo: nomeTavolo.get(o.tavolo as string) ?? o.tavolo, totale_cent: o.totale_cent, modo: o.modo, camera: o.camera, creato_il: o.creato_il })),
    });
  }

  if (azione === 'conto') {
    if (req.method === 'GET') {
      /* un conto con le sue righe: il palmare lo riapre da qui */
      const id = url.searchParams.get('id') || '';
      const { data: c } = await db.from('pos_conto').select('*').eq('id', id).maybeSingle();
      if (!c) return risposta({ errore: 'conto non trovato' }, 404);
      /* gli altri conti aperti sullo stesso tavolo: servono al cameriere
         per spostarci una riga quando al tavolo si paga separatamente */
      const { data: fratelli } = await db.from('pos_conto').select('id, tipo, camera, ospite, coperti, nome')
        .eq('tavolo', c.tavolo as string).neq('stato', 'chiuso').neq('id', c.id as string);
      const { data: pagamenti } = await db.from('pos_pagamento').select('*').eq('conto', c.id as string).order('il');
      return risposta({ conto: c, righe: await righeDelConto(c.id as string), fratelli: fratelli ?? [], pagamenti: pagamenti ?? [] });
    }
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
      nome: String(b.nome ?? '').trim().slice(0, 40) || null,
      lingua: ['it', 'en', 'de', 'fr'].includes(String(b.lingua)) ? String(b.lingua) : null,
      coperti: Math.max(1, Number(b.coperti ?? 1) || 1), stato: 'aperto', aperto_da: cameriere!.id,
    };
    const { data, error } = await db.from('pos_conto').insert(conto).select('*').single();
    if (error) return risposta({ errore: error.message }, 500);
    return risposta({ conto: data });
  }

  /* Chi e' in casa oggi, per il palmare: i nomi di una camera, con il
     trattamento e la nota della prenotazione. Cosi' aprendo un conto in
     camera si sceglie l'ospite invece di scriverlo, e in cucina la nota
     arriva insieme alla comanda. */
  if (azione === 'in-casa' && req.method === 'GET') {
    /* la legge il palmare: e' l'elenco degli ospiti, non esce di casa */
    if (!cameriere) return risposta({ errore: 'sessione non valida' }, 401);
    const camera = (url.searchParams.get('camera') || '').trim();
    const oggi = new Date().toISOString().slice(0, 10);
    let q = db.from('pos_in_casa').select('*').eq('giorno', oggi).order('camera');
    if (camera) q = q.eq('camera', camera);
    const { data, error } = await q;
    if (error) return risposta({ errore: error.message }, 500);
    return risposta({ giorno: oggi, ospiti: data ?? [] });
  }

  /* La tessera passata sul palmare: torna solo la camera, mai il conto
     dell'ospite. Al cameriere serve quella. */
  if (azione === 'tessera') {
    const codice = (url.searchParams.get('codice') || '').trim();
    if (!/^[0-9]{4,20}$/.test(codice)) return risposta({ errore: 'codice della tessera non valido' }, 400);
    const f = await cameraDallaTessera(codice);
    if (f.stato === 503) return risposta({ errore: 'lettura della tessera non configurata' }, 503);
    if (f.stato === 404) return risposta({ errore: 'tessera non trovata' }, 404);
    if (f.stato !== 200) return risposta({ errore: f.stato === 502 ? 'Fidra non risponde' : 'Fidra risponde ' + f.stato }, 502);
    return risposta({ camera: f.camera, lingua: f.lingua });
  }

  /* Il nome di chi paga e i coperti, cambiati a conto aperto. */
  if (azione === 'conto-cambia') {
    if (req.method !== 'POST') return risposta({ errore: 'metodo non ammesso' }, 405);
    const b = await corpo();
    const { data: c } = await db.from('pos_conto').select('*').eq('id', String(b.conto ?? '')).maybeSingle();
    if (!c || c.stato === 'chiuso') return risposta({ errore: 'conto non aperto' }, 409);
    const agg: Riga = { aggiornato_il: adesso() };
    if (b.nome !== undefined) agg.nome = String(b.nome ?? '').trim().slice(0, 40) || null;
    if (b.coperti !== undefined) agg.coperti = Math.max(1, Number(b.coperti) || 1);
    /* «In camera» anche a conto gia' aperto come esterno: la tessera si
       passa al momento di pagare (la proprieta', 5 settembre 2026) */
    if (b.camera !== undefined) {
      const camera = String(b.camera ?? '').trim();
      if (!camera) return risposta({ errore: 'serve la camera' }, 400);
      agg.tipo = 'camera'; agg.camera = camera;
      agg.tessera = b.tessera ? String(b.tessera) : null;
      agg.ospite = String(b.ospite ?? '').trim().slice(0, 40) || null;
      agg.lingua = ['it', 'en', 'de', 'fr'].includes(String(b.lingua)) ? String(b.lingua) : null;
    }
    const { data, error } = await db.from('pos_conto').update(agg).eq('id', c.id).select('*').single();
    if (error) return risposta({ errore: error.message }, 500);
    return risposta({ conto: data });
  }

  /* Un conto aperto per sbaglio si toglie di mezzo, ma solo finche' e'
     vuoto: con delle righe dentro si storna o si chiude, cosi' niente
     sparisce senza lasciare traccia. */
  if (azione === 'conto-elimina') {
    if (req.method !== 'POST') return risposta({ errore: 'metodo non ammesso' }, 405);
    const b = await corpo();
    const id = String(b.conto ?? '');
    const { data: c } = await db.from('pos_conto').select('*').eq('id', id).maybeSingle();
    if (!c) return risposta({ errore: 'conto non trovato' }, 404);
    if (c.stato === 'chiuso') return risposta({ errore: 'conto gia chiuso' }, 409);
    const righe = await righeDelConto(id);
    const vive = righe.filter((r) => r.stato !== 'stornata');
    if (vive.length) return risposta({ errore: 'il conto ha delle righe: le storni prima, oppure lo chiuda' }, 409);
    if (righe.length) {
      /* dentro ci sono solo storni: il conto e' a zero ma la traccia degli
         storni (motivo, chi) deve restare per la giornata — si chiude a
         zero invece di sparire («mi dice che ha delle righe anche se e a
         zero», la proprieta', 5 settembre 2026) */
      const ora = adesso();
      const { error } = await db.from('pos_conto').update({ stato: 'chiuso', chiuso_come: null, chiuso_da: cameriere!.id, chiuso_il: ora, aggiornato_il: ora }).eq('id', id);
      if (error) return risposta({ errore: error.message }, 500);
      return risposta({ esito: 'ok', chiuso: true });
    }
    const { error } = await db.from('pos_conto').delete().eq('id', id);
    if (error) return risposta({ errore: error.message }, 500);
    return risposta({ esito: 'ok' });
  }

  /* Prezzo e disponibilita' da dentro il POS, senza andare in back office:
     e' il gesto che si fa in sala quando un piatto finisce o il prezzo del
     giorno cambia. Il prezzo lo tocca solo l'amministrazione; «esaurito»
     anche il capo sala, che e' chi se ne accorge per primo. */
  if (azione === 'articolo-cambia') {
    if (req.method !== 'POST') return risposta({ errore: 'metodo non ammesso' }, 405);
    const b = await corpo();
    const { data: a } = await db.from('pos_articolo').select('*').eq('id', String(b.articolo ?? '')).maybeSingle();
    if (!a) return risposta({ errore: 'articolo non trovato' }, 404);
    const agg: Riga = { aggiornato_il: adesso() };
    let cambio: { da: number; a: number; motivo: string } | null = null;
    if (b.prezzo_cent !== undefined) {
      if (!puo(cameriere!, 'menu')) return risposta({ errore: 'il prezzo lo cambia l\'amministrazione' }, 403);
      const p = Math.round(Number(b.prezzo_cent));
      if (!Number.isFinite(p) || p < 0 || p > 100000) return risposta({ errore: 'prezzo non valido' }, 400);
      /* cambiare il listino lascia traccia: prima, dopo, chi e perche' */
      if (p !== Number(a.prezzo_cent)) {
        const motivo = motivoPulito(b.motivo);
        if (!motivo) return risposta({ errore: 'scriva il motivo della variazione di prezzo' }, 400);
        cambio = { da: Number(a.prezzo_cent), a: p, motivo };
      }
      agg.prezzo_cent = p;
    }
    if (b.esaurito !== undefined) {
      if (!puo(cameriere!, 'prezzo')) return risposta({ errore: 'lo segna il capo sala' }, 403);
      agg.esaurito = !!b.esaurito;
    }
    const { data, error } = await db.from('pos_articolo').update(agg).eq('id', a.id).select('*').single();
    if (error) return risposta({ errore: error.message }, 500);
    if (cambio) {
      await db.from('pos_prezzo_cambiato').insert({
        id: crypto.randomUUID(), articolo: a.id, da_cent: cambio.da, a_cent: cambio.a,
        motivo: cambio.motivo, cameriere: cameriere!.id, quando: adesso(),
      });
    }
    return risposta({ articolo: data });
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
    /* il listino in vigore adesso, nel locale del tavolo (fasce.ts) */
    const { data: tav } = await db.from('pos_tavolo').select('z:pos_zona(locale)').eq('id', c.tavolo as string).maybeSingle();
    const localeConto = (tav?.z as unknown as { locale: string } | null)?.locale ?? null;
    const [{ data: fasce }, { data: prezziFascia }] = await Promise.all([db.from('pos_fascia').select('*').eq('attiva', true), db.from('pos_prezzo_fascia').select('*')]);
    const fascia = fasciaAttiva({ fasce: (fasce ?? []) as Fascia[], adesso: oraLocale(new Date()), locale: localeConto });
    const puoPrezzo = puo(cameriere!, 'prezzo');
    const righe: Riga[] = [];
    for (const r of richieste) {
      const a = (articoli ?? []).find((x) => x.id === r.articolo);
      if (!a) return risposta({ errore: `articolo sconosciuto: ${r.articolo}` }, 400);
      if (a.esaurito) return risposta({ errore: `${a.nome}: esaurito` }, 409);
      const listino = prezzoInFascia({ articolo: { id: a.id as string, categoria: a.categoria as string | null, prezzo_cent: Number(a.prezzo_cent) }, fascia, prezzi: (prezziFascia ?? []) as PrezzoFascia[] }) ?? Number(a.prezzo_cent);
      const v = (varianti ?? []).find((x) => x.id === r.variante_id) ?? null;
      let prezzo: number;
      try {
        prezzo = prezzoRiga({
          articolo: { prezzo_cent: listino, prezzo_libero: !!a.prezzo_libero },
          variante: v ? { supplemento_cent: Number(v.supplemento_cent) } : null,
          prezzo_manuale_cent: r.prezzo_manuale_cent === undefined || r.prezzo_manuale_cent === null ? null : Number(r.prezzo_manuale_cent),
        }, puoPrezzo);
      } catch (e) { return risposta({ errore: (e as Error).message }, 403); }
      /* un prezzo battuto a mano diverso dal listino vuole il perche':
         senza, la riga non entra (la proprieta', 4 settembre 2026) */
      const cambiato = prezzoCambiato({
        prezzoListinoCent: listino, supplementoCent: v ? Number(v.supplemento_cent) : 0,
        prezzoManualeCent: r.prezzo_manuale_cent === undefined || r.prezzo_manuale_cent === null ? null : Number(r.prezzo_manuale_cent),
        prezzoLibero: !!a.prezzo_libero,
      });
      const motivoPrezzo = motivoDelPrezzo({ motivo: r.motivo_prezzo, nota: r.nota });
      if (cambiato && !motivoPrezzo) return risposta({ errore: `${a.nome}: scriva il motivo della variazione di prezzo` }, 400);
      const cat = a.cat as unknown as { portata: Portata } | null;
      const portata = ePortata(r.portata) ? r.portata : (ePortata(a.portata) ? a.portata : (cat?.portata ?? 'secondi'));
      righe.push({
        id: String(r.id ?? crypto.randomUUID()), conto, articolo: a.id, nome: a.nome,
        quantita: Math.max(1, Number(r.quantita ?? 1) || 1),
        prezzo_listino_cent: listino, prezzo_cent: prezzo,
        variante: v ? v.nome : (r.variante ? String(r.variante) : null),
        nota: r.nota ? String(r.nota).slice(0, 200) : null,
        motivo_prezzo: cambiato ? motivoPrezzo : null,
        /* «questa stasera la prepara il Bistrot»: la scelta del cameriere
           batte quella dell'articolo e della categoria */
        locale_stampa: r.locale_stampa ? String(r.locale_stampa) : null,
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
    /* senza motivo non si storna: e' merce che esce e non si paga */
    const motivo = motivoPulito(b.motivo);
    if (!motivo) return risposta({ errore: 'scriva il motivo dello storno' }, 400);
    const ora = adesso();
    const { data: agg } = await db.from('pos_riga')
      .update({ stato: 'stornata', stornata_da: cameriere!.id, stornata_il: ora, motivo_storno: motivo, aggiornato_il: ora })
      .eq('id', r.id).select('*').single();
    if (r.stato === 'partita') {
      const { data: c } = await db.from('pos_conto').select('*').eq('id', r.conto).single();
      const tutte = await righeDelConto(r.conto as string);
      const questa = tutte.filter((x) => x.id === r.id);
      if (c && questa.length) await creaStampe(c, questa, r.portata as Portata, 'storno', cameriere!.nome);
    }
    return risposta({ riga: agg });
  }

  /* Una riga passa a un altro conto DELLO STESSO TAVOLO: gli amici che
     pagano separatamente, o l'ospite che si accorge a meta' cena. Non e'
     uno storno e non tocca la cucina: cambia solo chi paga. */
  if (azione === 'sposta') {
    if (req.method !== 'POST') return risposta({ errore: 'metodo non ammesso' }, 405);
    const b = await corpo();
    const { data: r } = await db.from('pos_riga').select('*').eq('id', String(b.riga ?? '')).maybeSingle();
    if (!r || r.stato === 'stornata') return risposta({ errore: 'riga non trovata o stornata' }, 404);
    const { data: da } = await db.from('pos_conto').select('*').eq('id', r.conto as string).maybeSingle();
    if (!da || da.stato === 'chiuso') return risposta({ errore: 'conto non aperto' }, 409);
    let versoId = String(b.conto ?? '');
    if (b.nuovo) {
      const nuovo = {
        id: crypto.randomUUID(), tavolo: da.tavolo, tipo: 'esterno', coperti: Math.max(1, Number(b.coperti ?? 1) || 1),
        stato: 'aperto', aperto_da: cameriere!.id, aggiornato_il: adesso(),
      };
      const { data, error } = await db.from('pos_conto').insert(nuovo).select('id').single();
      if (error || !data) return risposta({ errore: error?.message ?? 'conto non creato' }, 500);
      versoId = data.id as string;
    }
    const { data: verso } = await db.from('pos_conto').select('*').eq('id', versoId).maybeSingle();
    if (!verso || verso.stato === 'chiuso') return risposta({ errore: 'l altro conto non e aperto' }, 409);
    if (verso.tavolo !== da.tavolo) return risposta({ errore: 'i due conti non sono dello stesso tavolo' }, 409);
    const ora = adesso();
    await db.from('pos_riga').update({ conto: versoId, aggiornato_il: ora }).eq('id', r.id as string);
    return risposta({ esito: 'ok', riga: r.id, conto: versoId });
  }

  /* Tutto il tavolo su un altro: piove sulla terrazza, o il tavolo era
     stato battuto sbagliato (la proprieta', 4 settembre 2026). I conti
     aperti cambiano tavolo tutti insieme, e restano nello stesso locale:
     le stampanti sono quelle, e la cucina non deve cercare il piatto in
     un'altra sala. */
  if (azione === 'tavolo-sposta') {
    if (req.method !== 'POST') return risposta({ errore: 'metodo non ammesso' }, 405);
    const b = await corpo();
    const daId = String(b.da ?? ''), aId = String(b.a ?? '');
    if (!daId || !aId) return risposta({ errore: 'servono il tavolo di partenza e quello di arrivo' }, 400);
    if (daId === aId) return risposta({ errore: 'e lo stesso tavolo' }, 400);
    const { data: tt } = await db.from('pos_tavolo').select('id, nome, z:pos_zona(locale)').in('id', [daId, aId]);
    const da = (tt ?? []).find((t) => t.id === daId), a = (tt ?? []).find((t) => t.id === aId);
    if (!da || !a) return risposta({ errore: 'tavolo non trovato' }, 404);
    const localeDi = (t: { z: unknown }) => (t.z as { locale: string } | null)?.locale ?? null;
    if (localeDi(da) !== localeDi(a)) return risposta({ errore: 'l altro tavolo e di un altro locale: le stampanti non sono le stesse' }, 409);
    const ora = adesso();
    const { data: mossi, error } = await db.from('pos_conto').update({ tavolo: aId, aggiornato_il: ora }).eq('tavolo', daId).neq('stato', 'chiuso').select('id');
    if (error) return risposta({ errore: error.message }, 500);
    if (!mossi?.length) return risposta({ errore: 'questo tavolo non ha conti aperti' }, 409);
    return risposta({ esito: 'ok', conti: mossi.length, tavolo: aId });
  }

  /* Un pagamento: in una volta, in parti uguali o un pezzo per volta
     (pagamenti.ts). Ogni incasso e' una riga di pos_pagamento; quando i
     pagamenti coprono il totale il conto si chiude da solo. «In camera»
     non passa di qui: e' un addebito, e resta in «chiudi». */
  if (azione === 'paga') {
    if (req.method !== 'POST') return risposta({ errore: 'metodo non ammesso' }, 405);
    const b = await corpo();
    const modo = ['contanti', 'carta'].includes(String(b.modo)) ? String(b.modo) : null;
    if (!modo) return risposta({ errore: 'modo: contanti o carta' }, 400);
    const { data: c } = await db.from('pos_conto').select('*').eq('id', String(b.conto ?? '')).maybeSingle();
    if (!c || c.stato === 'chiuso') return risposta({ errore: 'conto non aperto' }, 409);
    const righe = await righeDelConto(c.id as string);
    if (righe.some((r) => r.stato === 'da_inviare')) return risposta({ errore: 'ci sono righe non inviate' }, 409);
    const totale = totaleCent(righe.map((r) => ({ quantita: Number(r.quantita), prezzo_cent: Number(r.prezzo_cent), stato: r.stato })));
    const { data: prima } = await db.from('pos_pagamento').select('modo, importo_cent').eq('conto', c.id as string);
    const daPagare = residuo(totale, (prima ?? []).map((p) => ({ importo_cent: Number(p.importo_cent) })));
    if (!daPagare) return risposta({ errore: 'il conto e gia pagato' }, 409);
    const importo = b.importo_cent === undefined || b.importo_cent === null ? daPagare : Math.round(Number(b.importo_cent));
    if (!importoValido(importo, daPagare)) return risposta({ errore: `l importo deve essere fra 1 centesimo e ${daPagare} centesimi` }, 409);
    const ricevuto = modo === 'contanti' && b.ricevuto_cent !== undefined && b.ricevuto_cent !== null ? Math.round(Number(b.ricevuto_cent)) : null;
    const ora = adesso();
    const pagamento = { id: crypto.randomUUID(), conto: c.id as string, modo, importo_cent: importo, ricevuto_cent: Number.isFinite(ricevuto as number) ? ricevuto : null, cameriere: cameriere!.id, il: ora, aggiornato_il: ora };
    const { error } = await db.from('pos_pagamento').insert(pagamento);
    if (error) return risposta({ errore: error.message }, 500);
    const dopo = daPagare - importo;
    let agg = c;
    if (!dopo) {
      const come = chiusoCome([...(prima ?? []), pagamento]);
      const { data } = await db.from('pos_conto').update({ stato: 'chiuso', chiuso_come: come, chiuso_da: cameriere!.id, chiuso_il: ora, aggiornato_il: ora }).eq('id', c.id).select('*').single();
      if (data) agg = data;
    }
    return risposta({ pagamento, residuo_cent: dopo, chiuso: !dopo, resto_cent: resto(ricevuto, importo), conto: agg });
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
    if (modo === 'camera' && !String(c.camera ?? '').trim()) return risposta({ errore: 'per addebitare serve la camera: apra un conto in camera' }, 409);
    const ora = adesso();
    const totale = totaleCent(righe.map((r) => ({ quantita: Number(r.quantita), prezzo_cent: Number(r.prezzo_cent), stato: r.stato })));
    /* con pagamenti parziali gia' registrati (paga) il modo e' misto; e
       contanti o carta lasciano comunque un pagamento, per la giornata */
    const { data: prima } = await db.from('pos_pagamento').select('modo, importo_cent').eq('conto', c.id as string);
    const come = modo === 'camera' ? 'camera' : chiusoCome([...(prima ?? []), { modo }]);
    const { data: agg } = await db.from('pos_conto')
      .update({ stato: 'chiuso', chiuso_come: come, chiuso_da: cameriere!.id, chiuso_il: ora, aggiornato_il: ora }).eq('id', c.id).select('*').single();
    if (modo !== 'camera') {
      const manca = residuo(totale, (prima ?? []).map((p) => ({ importo_cent: Number(p.importo_cent) })));
      if (manca > 0) await db.from('pos_pagamento').insert({ id: crypto.randomUUID(), conto: c.id, modo, importo_cent: manca, ricevuto_cent: null, cameriere: cameriere!.id, il: ora, aggiornato_il: ora });
    }
    /* «In camera» non e' un incasso: e' un addebito che qualcuno deve
       ancora riportare nel conto camera di Fidra. Finche' e' in questa
       coda, la giornata non e' chiusa. */
    if (modo === 'camera') {
      const { data: t } = await db.from('pos_tavolo').select('z:pos_zona(locale)').eq('id', c.tavolo as string).maybeSingle();
      const locale = (t?.z as unknown as { locale: string } | null)?.locale ?? null;
      /* La firma dell'ospite sul palmare, se l'ha data: e' la prova
         dell'ordine, quella che al check-out chiude la discussione. Non e'
         obbligatoria — capita che l'ospite si alzi prima — e chi guarda la
         coda vede subito quali addebiti non ce l'hanno. */
      const firma = typeof b.firma === 'string' ? b.firma : '';
      if (firma && (!firma.startsWith('data:image/png;base64,') || firma.length > FIRMA_MAX)) {
        return risposta({ errore: 'la firma deve essere un PNG, e piccolo' }, 400);
      }
      const { error } = await db.from('pos_addebito').insert({
        firma: firma || null, firmato_il: firma ? ora : null,
        id: crypto.randomUUID(), conto: c.id, locale, camera: String(c.camera).trim(),
        tessera: c.tessera ?? null, ospite: c.ospite ?? null, totale_cent: totale,
        righe: righe.filter((r) => r.stato !== 'stornata').map((r) => ({
          quantita: Number(r.quantita), nome: String(r.nome), totale_cent: Number(r.quantita) * Number(r.prezzo_cent),
        })),
        chiuso_da: cameriere!.id, chiuso_il: ora, stato: 'da_riportare', aggiornato_il: ora,
      });
      if (error) return risposta({ errore: 'conto chiuso, ma l\'addebito non e\' entrato in coda: ' + error.message }, 500);
    }
    return risposta({ conto: agg, totale_cent: totale });
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
      /* la stampante del locale del biglietto: il ristorante che ordina al
         Bistrot deve stampare al Bistrot, non dove capita. Le due
         variabili d'ambiente restano per il collaudo a un locale solo. */
      const { data: suo } = await db.from('pos_locale').select('stampante_cucina, stampante_bar').eq('id', s.locale as string).maybeSingle();
      /* dal cloud alle stampanti si arriva solo dall'esterno, via router:
         prima i secret (host pubblico:porta), poi l'indirizzo LAN del
         locale, che e' quello del PC del Bistrot e da qui non risponde
         («abilita le stampanti anche da cloud per fare prove», 5 set 2026) */
      const dest = Deno.env.get(s.stampante === 'bar' ? 'POS_STAMPANTE_BAR' : 'POS_STAMPANTE_CUCINA')
        || ((s.stampante === 'bar' ? suo?.stampante_bar : suo?.stampante_cucina) as string | null);
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
        addebiti: await upsertSeNuovi('pos_addebito', Array.isArray(b.addebiti) ? b.addebiti as Riga[] : []),
        stampe: await upsertSeNuovi('pos_stampa', Array.isArray(b.stampe) ? b.stampe as Riga[] : []),
        pagamenti: await upsertSeNuovi('pos_pagamento', Array.isArray(b.pagamenti) ? b.pagamenti as Riga[] : []),
      };
      /* i conti che il PC del Bistrot ha tolto perche' vuoti: la
         cancellazione non viaggia con le scritture, arriva a parte */
      const tolti = (Array.isArray(b.conti_eliminati) ? b.conti_eliminati : []).map(String);
      if (tolti.length) await db.from('pos_conto').delete().in('id', tolti).eq('stato', 'aperto');
      return risposta({ esito: 'ok', ...esito });
    } catch (e) { return risposta({ errore: (e as Error).message }, 500); }
  }

  if (azione === 'allinea-giu') {
    /* lo legge il server locale (chiave hotel) e il back office (amministrazione) */
    if (!chiaveHotel(req)) {
      const acc = await autorizzato(req);
      if (!acc.ok) return risposta({ errore: 'non autorizzato' }, 401);
      if (!['reception', 'amministrazione'].includes(acc.ruolo ?? '')) return risposta({ errore: 'solo reception e amministrazione' }, 403);
    }
    const da = url.searchParams.get('da') || '1970-01-01T00:00:00Z';
    const locale = url.searchParams.get('locale') || '';
    const tabelle = ['pos_locale', 'pos_zona', 'pos_tavolo', 'pos_categoria', 'pos_articolo', 'pos_variante', 'pos_preferito', 'pos_cameriere', 'pos_dispositivo', 'pos_fascia', 'pos_prezzo_fascia'];
    const fuori: Record<string, unknown> = { adesso: adesso() };
    for (const t of tabelle) {
      /* le fasce e i loro prezzi scendono per intero: una fascia tolta o un
         prezzo cancellato non hanno un aggiornato_il che li racconti */
      const { data } = ['pos_fascia', 'pos_prezzo_fascia'].includes(t)
        ? await db.from(t).select('*').limit(5000)
        : await db.from(t).select('*').gt('aggiornato_il', da).limit(5000);
      fuori[t.slice(4)] = data ?? [];
    }
    /* le stampe nate nel cloud (palmare in modalita' cloud) le stampa il locale, se c'e' */
    let q = db.from('pos_stampa').select('*').eq('stato', 'da_stampare').gt('aggiornato_il', da).limit(200);
    if (locale) q = q.eq('locale', locale);
    fuori.stampe = (await q).data ?? [];
    return risposta(fuori);
  }

  /* Chi e' in casa, mandato dall'estensione dalla pagina «In Casa» di
     Fidra. E' la fotografia di un giorno: si riscrive tutta, cosi' una
     camera liberata sparisce invece di restare li'. */
  if (azione === 'in-casa') {
    if (!chiaveHotel(req)) return risposta({ errore: 'non autorizzato' }, 401);
    if (req.method !== 'POST') return risposta({ errore: 'metodo non ammesso' }, 405);
    const b = await corpo();
    const giorno = /^\d{4}-\d{2}-\d{2}$/.test(String(b.giorno)) ? String(b.giorno) : new Date().toISOString().slice(0, 10);
    const righe = leggiInCasa(b.ospiti).map((r, i) => ({ ...r, id: `${giorno}-${r.camera}-${i}`, giorno, aggiornato_il: adesso() }));
    const { error: e1 } = await db.from('pos_in_casa').delete().eq('giorno', giorno);
    if (e1) return risposta({ errore: e1.message }, 500);
    if (righe.length) {
      const { error } = await db.from('pos_in_casa').insert(righe);
      if (error) return risposta({ errore: error.message }, 500);
    }
    return risposta({ esito: 'ok', giorno, ospiti: righe.length, camere: new Set(righe.map((r) => r.camera)).size });
  }

  if (azione === 'importa-menu') {
    if (!chiaveHotel(req)) return risposta({ errore: 'non autorizzato' }, 401);
    const b = await corpo();
    const intestazioni = Array.isArray(b.intestazioni) ? b.intestazioni.map(String) : [];
    const righe = Array.isArray(b.righe) ? (b.righe as unknown[]).map((r) => Array.isArray(r) ? r.map(String) : []) : [];
    /* l'unita' del prezzo la dichiara chi legge: `item-variations` lo da'
       in centesimi interi, la tabella a schermo in euro */
    const letto = importa(intestazioni, righe, b.unita === 'centesimi' ? 'centesimi' : 'euro');
    /* e comunque un listino assurdo non entra in banca dati: meglio
       un'importazione rifiutata che i prezzi per cento sul palmare */
    if (!prezziSensati(letto.articoli)) {
      return risposta({ errore: 'i prezzi letti sembrano moltiplicati per cento: non ho scritto niente' }, 400);
    }
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
    const { data: artEsistenti } = await db.from('pos_articolo').select('id, nome, fidra_id');
    const idArt = new Map((artEsistenti ?? []).filter((a) => a.fidra_id).map((a) => [String(a.fidra_id), a.id as string]));
    /* Un articolo che c'e' gia' col suo nome NON si tocca: il menu' e'
       stato messo a posto categoria per categoria sulle fotografie del POS
       di Fidra, e quelle sono la verita' (la proprieta', 4 settembre
       2026). Questa importazione serve ad aggiungere cio' che manca — i
       vini del ristorante — non a rifare quello che gia' va bene. */
    const uguale = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
    const giaCiSono = new Set((artEsistenti ?? []).map((a) => uguale(String(a.nome))));
    /* Quello che non si riconosce finisce in una categoria a parte e
       SPENTO: si vede nel back office e non compare sul palmare finche'
       non lo si sistema. Meglio da parte che nella categoria sbagliata. */
    const DA_SISTEMARE = 'Da sistemare';
    let daSistemare = idCat.get(DA_SISTEMARE.toLowerCase()) as string | undefined;
    let nuovi = 0, aggiornati = 0, saltati = 0, messiDaParte = 0;
    for (const a of letto.articoli) {
      const esistente = idArt.get(a.fidra_id);
      if (esistente) {
        /* di un articolo gia' nostro si aggiorna solo il nome: prezzo,
           stampante e portata possono essere stati curati nel back office */
        await db.from('pos_articolo').update({ nome: a.nome, aggiornato_il: ora }).eq('id', esistente);
        aggiornati++;
        continue;
      }
      if (giaCiSono.has(uguale(a.nome))) { saltati++; continue; }
      let cat = idCat.get(a.categoria.toLowerCase());
      let attivo = true;
      /* senza categoria dichiarata si prova col nome del vino */
      if (!cat || a.categoria.toLowerCase() === 'varie') {
        const vino = categoriaVino(a.nome);
        cat = vino ? idCat.get(vino.toLowerCase()) : undefined;
        if (!cat) {
          if (!daSistemare) {
            const id = crypto.randomUUID();
            const { error } = await db.from('pos_categoria')
              .insert({ id, nome: DA_SISTEMARE, posizione: 9000, stampante: 'bar', portata: 'bevande', attiva: false, aggiornato_il: ora });
            if (error) return risposta({ errore: error.message }, 500);
            daSistemare = id;
            idCat.set(DA_SISTEMARE.toLowerCase(), id);
          }
          cat = daSistemare;
          attivo = false;
          messiDaParte++;
        }
      }
      const { error } = await db.from('pos_articolo').insert({
        id: crypto.randomUUID(), categoria: cat, nome: a.nome,
        prezzo_cent: a.prezzo_cent, iva: a.iva, fidra_id: a.fidra_id, attivo, aggiornato_il: ora,
      });
      if (error) return risposta({ errore: error.message }, 500);
      giaCiSono.add(uguale(a.nome));
      nuovi++;
    }
    return risposta({ esito: 'ok', articoli: letto.articoli.length, categorie: letto.categorie.length, nuovi, aggiornati, saltati, da_sistemare: messiDaParte, scartate: letto.scartate });
  }

  /* la sala come sta in Fidra: una zona per volta, con i tavoli al loro
     posto sulla pianta. Un tavolo che c'e' gia' (stesso nome nella stessa
     zona) si sposta e basta: non si sdoppia, e non si cancella niente. */
  if (azione === 'importa-sala') {
    if (!chiaveHotel(req)) return risposta({ errore: 'non autorizzato' }, 401);
    const letta = leggiSala(await corpo());
    if (!letta.ok) return risposta({ errore: letta.errore }, 400);
    const s = letta.valore;
    const ora = adesso();
    const { data: loc } = await db.from('pos_locale').select('id').eq('id', s.locale).maybeSingle();
    if (!loc) return risposta({ errore: `locale sconosciuto: ${s.locale}` }, 404);
    const slug = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const { data: zone } = await db.from('pos_zona').select('id, nome, posizione').eq('locale', s.locale);
    const pari = (a: unknown, b: unknown) => String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
    let zona = (zone ?? []).find((z) => pari(z.nome, s.zona));
    if (!zona) {
      const id = `${s.locale}-${slug(s.zona)}`;
      const { data, error } = await db.from('pos_zona')
        .insert({ id, locale: s.locale, nome: s.zona, posizione: (zone ?? []).length, aggiornato_il: ora }).select('id, nome, posizione').single();
      if (error || !data) return risposta({ errore: error?.message ?? 'zona non creata' }, 500);
      zona = data;
    }
    const idZona = zona.id as string;
    const { data: esistenti } = await db.from('pos_tavolo').select('id, nome').eq('zona', idZona);
    const perNome = new Map((esistenti ?? []).map((t) => [chiaveNome(t.nome), t.id as string]));
    let nuovi = 0, spostati = 0;
    for (const t of s.tavoli) {
      const id = perNome.get(chiaveNome(t.nome));
      if (id) {
        const { error } = await db.from('pos_tavolo').update({ nome: t.nome, posti: t.posti, x: t.x, y: t.y, attivo: true, aggiornato_il: ora }).eq('id', id);
        if (error) return risposta({ errore: error.message }, 500);
        spostati++;
      } else {
        const { error } = await db.from('pos_tavolo')
          .insert({ id: `${idZona}-${slug(t.nome)}`, zona: idZona, nome: t.nome, posti: t.posti, x: t.x, y: t.y, attivo: true, aggiornato_il: ora });
        if (error) return risposta({ errore: error.message }, 500);
        nuovi++;
      }
    }
    /* quelli che noi abbiamo e Fidra no: si dicono, non si toccano */
    const arrivati = new Set(s.tavoli.map((t) => chiaveNome(t.nome)));
    const inPiu = (esistenti ?? []).filter((t) => !arrivati.has(chiaveNome(t.nome))).map((t) => t.nome as string);
    return risposta({ esito: 'ok', zona: zona.nome, zona_id: idZona, tavoli: s.tavoli.length, nuovi, spostati, in_piu: inPiu });
  }

  /* ================= dal back office (accesso dell'hotel, amministrazione) ================= */

  const azioniBackOffice = ['menu-salva', 'tavoli-salva', 'personale-salva', 'addebiti', 'addebito-segna', 'giornata', 'fasce-salva', 'tavoli-qr'];
  if (azioniBackOffice.includes(azione)) {
    /* «addebiti» e «giornata» si leggono, le altre si scrivono */
    if (req.method !== 'POST' && !(['addebiti', 'giornata', 'tavoli-qr'].includes(azione) && req.method === 'GET')) return risposta({ errore: 'metodo non ammesso' }, 405);
    const acc = await autorizzato(req);
    if (!acc.ok) return risposta({ errore: 'non autorizzato' }, 401);
    /* la proprieta' lavora con l'account della reception (visto il 4
       settembre 2026): reception e amministrazione scrivono, la spa no */
    if (!acc.chiave && !['reception', 'amministrazione'].includes(acc.ruolo ?? '')) return risposta({ errore: 'solo reception e amministrazione' }, 403);
  }

  /* I listini a fasce dal back office: le fasce si riscrivono, i prezzi
     scritti apposta si sostituiscono per intero fascia per fascia, e le
     fasce tolte se ne vanno coi loro prezzi. Le regole sono in fasce.ts. */
  if (azione === 'fasce-salva') {
    const b = await corpo();
    const ora = adesso();
    try {
      const fasce = (Array.isArray(b.fasce) ? b.fasce as Riga[] : []).map((f) => ({
        id: String(f.id ?? crypto.randomUUID()), nome: String(f.nome ?? '').trim().slice(0, 60), locale: f.locale ? String(f.locale) : null,
        dalle: String(f.dalle ?? '').trim(), alle: String(f.alle ?? '').trim(),
        giorni: Array.isArray(f.giorni) && f.giorni.length ? (f.giorni as unknown[]).map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6) : null,
        sconto_percento: f.sconto_percento === null || f.sconto_percento === undefined || f.sconto_percento === '' ? null : Math.max(0, Math.min(100, Math.round(Number(f.sconto_percento) || 0))),
        categorie: Array.isArray(f.categorie) && f.categorie.length ? (f.categorie as unknown[]).map(String) : null,
        attiva: !!f.attiva, aggiornato_il: ora,
      }));
      if (fasce.some((f) => !f.nome || minutiDi(f.dalle) === null || minutiDi(f.alle) === null)) return risposta({ errore: 'ogni fascia vuole nome, dalle e alle (HH:MM)' }, 400);
      const tolte = (Array.isArray(b.tolte) ? b.tolte : []).map(String);
      if (tolte.length) {
        await db.from('pos_prezzo_fascia').delete().in('fascia', tolte);
        await db.from('pos_fascia').delete().in('id', tolte);
      }
      if (fasce.length) { const { error } = await db.from('pos_fascia').upsert(fasce, { onConflict: 'id' }); if (error) throw new Error(`pos_fascia: ${error.message}`); }
      const idFasce = fasce.map((f) => f.id);
      const prezzi = (Array.isArray(b.prezzi) ? b.prezzi as Riga[] : [])
        .filter((p) => p.articolo && idFasce.includes(String(p.fascia)))
        .map((p) => ({ id: String(p.id ?? crypto.randomUUID()), fascia: String(p.fascia), articolo: String(p.articolo), prezzo_cent: Math.max(0, Math.round(Number(p.prezzo_cent) || 0)), aggiornato_il: ora }));
      if (idFasce.length) await db.from('pos_prezzo_fascia').delete().in('fascia', idFasce);
      if (prezzi.length) { const { error } = await db.from('pos_prezzo_fascia').insert(prezzi); if (error) throw new Error(`pos_prezzo_fascia: ${error.message}`); }
      return risposta({ esito: 'ok', fasce: fasce.length, prezzi: prezzi.length });
    } catch (e) { return risposta({ errore: (e as Error).message }, 500); }
  }

  /* I QR dei tavoli, da stampare: l'indirizzo della pagina dell'ospite con
     l'id del tavolo e la sua firma. Cambia solo se cambia la chiave hotel. */
  if (azione === 'tavoli-qr') {
    const segreto = Deno.env.get('HOTEL_KEY') ?? '';
    const { data: tavoli } = await db.from('pos_tavolo').select('id, nome, attivo, z:pos_zona(nome, posizione, locale)').eq('attivo', true);
    const fuori = [];
    for (const tv of tavoli ?? []) {
      const z = tv.z as unknown as { nome: string; posizione: number; locale: string } | null;
      fuori.push({ id: tv.id, nome: tv.nome, zona: z?.nome ?? null, posizione: z?.posizione ?? 0, locale: z?.locale ?? null, url: `${PAGINA_ORDINA}?t=${encodeURIComponent(String(tv.id))}&k=${await firmaTavolo(String(tv.id), segreto)}` });
    }
    fuori.sort((a, b) => String(a.locale).localeCompare(String(b.locale)) || Number(a.posizione) - Number(b.posizione) || String(a.nome).localeCompare(String(b.nome), 'it', { numeric: true }));
    return risposta({ pagina: PAGINA_ORDINA, tavoli: fuori });
  }

  /* La cassa di fine giornata: i conti chiusi fra «da» e «a» (la
     giornata di un bar non finisce a mezzanotte: la decide chi chiede),
     per modo, per cameriere, gli articoli piu' venduti e gli storni.
     I numeri li fa giornata.ts; qui solo le letture. */
  if (azione === 'giornata') {
    /* «fino», non «a»: «a» e' gia' il nome dell'azione nell'indirizzo (5 set 2026) */
    const da = url.searchParams.get('da') ?? '', a = url.searchParams.get('fino') ?? '';
    if (!da || !a || Number.isNaN(Date.parse(da)) || Number.isNaN(Date.parse(a))) return risposta({ errore: 'servono «da» e «a» come date' }, 400);
    const locale = url.searchParams.get('locale') || '';
    const [{ data: contiTutti, error: e1 }, { data: tavoli }, { data: zone }, { data: camerieri }] = await Promise.all([
      db.from('pos_conto').select('id, tavolo, chiuso_come, chiuso_da, chiuso_il, coperti, camera').eq('stato', 'chiuso').gte('chiuso_il', da).lt('chiuso_il', a),
      db.from('pos_tavolo').select('id, zona'),
      db.from('pos_zona').select('id, locale'),
      db.from('pos_cameriere').select('id, nome'),
    ]);
    if (e1) return risposta({ errore: e1.message }, 500);
    const localeDelTavolo = new Map((tavoli ?? []).map((t) => [t.id as string, (zone ?? []).find((z) => z.id === t.zona)?.locale as string | undefined]));
    const conti = (contiTutti ?? []).filter((c) => !locale || localeDelTavolo.get(c.tavolo as string) === locale);
    const ids = conti.map((c) => c.id as string);
    const righe: Riga[] = [];
    /* PostgREST vuole gli id nell'indirizzo: a blocchi, per non farlo troppo lungo */
    for (let i = 0; i < ids.length; i += 100) {
      const { data, error } = await db.from('pos_riga').select('conto, nome, quantita, prezzo_cent, stato, motivo_storno, stornata_da').in('conto', ids.slice(i, i + 100));
      if (error) return risposta({ errore: error.message }, 500);
      righe.push(...(data ?? []));
    }
    /* i pagamenti dei conti: da qui la divisione contanti/carta di un conto misto */
    const pagamenti: Riga[] = [];
    for (let i = 0; i < ids.length; i += 100) {
      const { data } = await db.from('pos_pagamento').select('conto, modo, importo_cent').in('conto', ids.slice(i, i + 100));
      pagamenti.push(...(data ?? []));
    }
    const nomi = Object.fromEntries((camerieri ?? []).map((c) => [c.id as string, String(c.nome)]));
    return risposta({
      da, a, locale: locale || null,
      giornata: riepilogo({
        conti: conti.map((c) => ({ id: c.id as string, chiuso_come: c.chiuso_come as string | null, chiuso_da: c.chiuso_da as string | null, coperti: Number(c.coperti) || 0, camera: c.camera as string | null })),
        righe: righe.map((r) => ({ conto: String(r.conto), nome: String(r.nome), quantita: Number(r.quantita), prezzo_cent: Number(r.prezzo_cent), stato: String(r.stato), motivo_storno: r.motivo_storno as string | null, stornata_da: r.stornata_da as string | null })),
        pagamenti: pagamenti.map((p) => ({ conto: String(p.conto), modo: p.modo as string | null, importo_cent: Number(p.importo_cent) })),
        nomi,
      }),
    });
  }

  /* La coda dei conti chiusi in camera, per la reception: li riporta nel
     conto camera di Fidra e li segna. Finche' esiste Fidra si fa a mano
     da li'; quando il conto camera sara' nostro, cambia solo chi svuota
     questa coda. */
  if (azione === 'addebiti') {
    const stato = url.searchParams.get('stato') || 'da_riportare';
    let q = db.from('pos_addebito').select('*').order('chiuso_il', { ascending: false }).limit(300);
    if (stato !== 'tutti') q = q.eq('stato', stato);
    const { data, error } = await q;
    if (error) return risposta({ errore: error.message }, 500);
    return risposta({ addebiti: data ?? [] });
  }

  if (azione === 'addebito-segna') {
    const b = await corpo();
    const stato = ['da_riportare', 'riportato', 'annullato'].includes(String(b.stato)) ? String(b.stato) : null;
    if (!stato) return risposta({ errore: 'stato: da_riportare, riportato o annullato' }, 400);
    const ora = adesso();
    const agg: Riga = { stato, aggiornato_il: ora, nota: b.nota ? String(b.nota).slice(0, 200) : null };
    agg.riportato_il = stato === 'da_riportare' ? null : ora;
    agg.riportato_da = stato === 'da_riportare' ? null : String(b.da ?? 'reception');
    const { data, error } = await db.from('pos_addebito').update(agg).eq('id', String(b.id ?? '')).select('*').single();
    if (error) return risposta({ errore: error.message }, 500);
    return risposta({ addebito: data });
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
        const riga: Riga = { id, nome: c.nome, codice, ruolo: c.ruolo ?? 'cameriere', storni: !!c.storni, bloccato: !!c.bloccato, senza_pin: !!c.senza_pin, aggiornato_il: ora };
        const pin = String(c.pin ?? '').trim();
        /* PIN vuoto = lascia com'era. L'impronta vecchia va RIMESSA nella
           riga: un upsert e' un insert che poi diventa update, e Postgres
           controlla «pin_hash not null» sulla riga da inserire, prima di
           accorgersi che quell'id esiste gia' (difetto visto in reception
           il 4 settembre 2026: «null value in column pin_hash»). */
        const { data: e } = await db.from('pos_cameriere').select('pin_hash').eq('id', id).maybeSingle();
        if (pin) riga.pin_hash = await hashPin(codice, pin);
        else if (e) riga.pin_hash = e.pin_hash;
        /* un cameriere nuovo senza PIN: l'impronta resta, ma di una parola
           che nessuno conosce, cosi' se un domani gli si toglie «senza
           PIN» non entra piu' finche' non gliene si da' uno vero */
        else if (c.senza_pin) riga.pin_hash = await hashPin(codice, tokenCasuale(24));
        else return risposta({ errore: `${c.nome}: serve un PIN, oppure la spunta «senza PIN»` }, 400);
        const { error } = await db.from('pos_cameriere').upsert(riga, { onConflict: 'id' });
        if (error) throw new Error(error.message);
      }
      for (const d of dispositivi) {
        const id = String(d.id ?? crypto.randomUUID());
        const { data: e } = await db.from('pos_dispositivo').select('token').eq('id', id).maybeSingle();
        const riga: Riga = { id, nome: d.nome ?? 'Palmare', locale: d.locale ?? null, bloccato: !!d.bloccato, aggiornato_il: ora };
        /* come sopra: il codice del palmare non puo' mancare nella riga.
           Nuovo palmare, o «nuovo codice» chiesto dal back office (palmare
           smarrito): se ne genera uno; altrimenti resta quello che c'e'. */
        if (!e || d.nuovo_token) { riga.token = tokenCasuale(); tokenNuovi.push({ id, nome: String(riga.nome), token: String(riga.token) }); }
        else riga.token = e.token;
        const { error } = await db.from('pos_dispositivo').upsert(riga, { onConflict: 'id' });
        if (error) throw new Error(error.message);
      }
      return risposta({ esito: 'ok', dispositivi_nuovi: tokenNuovi });
    } catch (e) { return risposta({ errore: (e as Error).message }, 500); }
  }

  return risposta({ errore: 'azione sconosciuta' }, 404);
});
