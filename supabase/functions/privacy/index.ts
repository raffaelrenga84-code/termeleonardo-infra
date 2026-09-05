/* ============================================================
   privacy — il consenso privacy firmato al totem o sull'iPad.

   Spec: docs/superpowers/specs/2026-09-04-privacy-totem-design.md
   Piano: docs/superpowers/plans/2026-09-04-privacy-totem.md

   Pubblica:
     GET  ?a=testi&lingua=      → le frasi e le parole del modulo, con la versione
   Dall'estensione (x-hotel-key), al check-in:
     POST ?a=attesa             → mette in attesa il consenso di una camera (dati dalla prenotazione Fidra)
   Dal totem e dall'iPad (x-totem-key + IP dell'hotel, come il conto camera):
     GET  ?a=attese             → i consensi in attesa (per l'elenco dell'iPad)
     GET  ?a=tessera&codice=    → dalla tessera la camera (Fidra, sola lettura) e il consenso in attesa
     POST ?a=firma              → salva scelte e firma, manda le email
   Dal back office (reception, amministrazione):
     GET  ?a=elenco             → i consensi (senza le firme)
     GET  ?a=uno&id=            → un consenso intero, per la stampa
     POST ?a=annulla            → annulla un consenso in attesa

   Il consenso vive qui, non in Fidra: Fidra non si puo' scrivere da fuori
   e la sua pagina vuole la firma dell'ospite. Il codice della tessera non
   si salva mai. Le regole stanno in consenso.ts; qui database, rete e vetro.
   ============================================================ */
import { createClient } from 'supabase';
import { emailConsensoOspite, emailConsensoReception, firmaBase64, leggiAttesa, leggiFirma, SCELTE, testiConsenso, VERSIONE_TESTI, type Lingua } from './consenso.ts';
import { ruoloDi } from './ruoli.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, authorization, x-hotel-key, x-totem-key',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
type Riga = Record<string, unknown>;
const risposta = (corpo: unknown, stato = 200) =>
  new Response(JSON.stringify(corpo), { status: stato, headers: { ...CORS, 'content-type': 'application/json' } });
const adesso = () => new Date().toISOString();
const EMAIL_HOTEL = Deno.env.get('EMAIL_HOTEL') || 'info@termeleonardo.com';

function indirizzo(req: Request): string {
  const f = req.headers.get('x-forwarded-for') || '';
  return f.split(',')[0].trim() || 'sconosciuto';
}
const chiaveHotel = (req: Request) => { const k = Deno.env.get('HOTEL_KEY'); return !!k && req.headers.get('x-hotel-key') === k; };

/* il totem e l'iPad: portano l'intestazione x-totem-key e sono la chiave
   del dispositivo, oppure arrivano dall'IP dell'hotel (stessa regola di
   dayspa: chi e' sulla rete dell'hotel senza intestazione non e' un totem) */
const eTotem = (r: Request): boolean => {
  const chiaveTotem = Deno.env.get('TOTEM_KEY');
  const ipTotem = Deno.env.get('TOTEM_IP');
  const portata = r.headers.get('x-totem-key');
  if (portata === null) return false;
  return (!!chiaveTotem && portata === chiaveTotem) || (!!ipTotem && indirizzo(r) === ipTotem);
};

type Accesso = { ok: true; ruolo: string | null; chiave: boolean } | { ok: false };
async function autorizzato(req: Request): Promise<Accesso> {
  if (chiaveHotel(req)) return { ok: true, ruolo: null, chiave: true };
  const auth = req.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return { ok: false };
  const { data } = await db.auth.getUser(token);
  const ruolo = ruoloDi(data?.user?.email);
  if (!ruolo) return { ok: false };
  return { ok: true, ruolo, chiave: false };
}

/* ---------- email con Resend, come i buoni, con gli allegati ---------- */
type Allegato = { filename: string; content: string };
async function inviaEmail(a: string, oggetto: string, html: string, testo: string, allegati: Allegato[] = []): Promise<boolean> {
  const chiave = Deno.env.get('RESEND_API_KEY');
  if (!chiave) { console.error('email non inviata: RESEND_API_KEY mancante ->', a, oggetto); return false; }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${chiave}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: Deno.env.get('MITTENTE_EMAIL') || 'Hotel Terme Leonardo <noreply@hoteltermeleonardo.com>',
      to: [a], subject: oggetto, html, text: testo, ...(allegati.length ? { attachments: allegati } : {}),
    }),
  });
  if (!r.ok) console.error('Resend', r.status, await r.text());
  return r.ok;
}

/* ---------- la camera di una tessera, da Fidra (sola lettura, consenso hldv) ---------- */
async function contoFidra(codice: string): Promise<{ stato: number; camera: string | null }> {
  const chiave = Deno.env.get('FIDRA_TOTEM_KEY');
  const base = Deno.env.get('FIDRA_TOTEM_URL');
  if (!chiave || !base) return { stato: 503, camera: null };
  const radice = base.endsWith('/') ? base.slice(0, -1) : base;
  try {
    const r = await fetch(radice + '/api/bill-scanner/' + encodeURIComponent(codice), {
      headers: { authorization: 'Bearer ' + chiave, accept: 'application/json' },
    });
    if (!r.ok) return { stato: r.status, camera: null };
    const dati = await r.json().catch(() => null) as Riga | null;
    const camera = dati && dati.room !== undefined && dati.room !== null ? String(dati.room).trim() : '';
    return { stato: camera ? 200 : 404, camera: camera || null };
  } catch (e) {
    console.error('tessera: Fidra non risponde', e);
    return { stato: 502, camera: null };
  }
}

const COLONNE_ELENCO = 'id, creato_il, firmato_il, stato, camera, cognome, nome, email, lingua, arrivo, partenza, conservazione, messaggi, marketing, testi_versione, fonte, email_inviata, destinazione';
/* quanto resta in vista, nell'elenco dell'iPad, un consenso non firmato */
const MINUTI_ATTESA = 3;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  const url = new URL(req.url);
  const azione = url.searchParams.get('a') || '';
  const corpo = async () => (req.method === 'POST' ? await req.json().catch(() => ({})) : {}) as Riga;

  /* ---------- pubblica: i testi del modulo ---------- */
  if (azione === 'testi') {
    const lingua = url.searchParams.get('lingua') || 'it';
    return risposta({ versione: VERSIONE_TESTI, scelte: SCELTE, testi: testiConsenso(lingua) });
  }

  /* ---------- dall'estensione: in attesa ---------- */
  if (azione === 'attesa') {
    if (req.method !== 'POST') return risposta({ errore: 'metodo non ammesso' }, 405);
    if (!chiaveHotel(req)) return risposta({ errore: 'non autorizzato' }, 401);
    const letta = leggiAttesa(await corpo());
    if (!letta.ok) return risposta({ errore: letta.errore }, 400);
    const a = letta.valore;
    /* In una camera dormono spesso piu' persone, e ognuna firma il suo
       consenso: si annulla solo l'attesa della STESSA persona, cosi'
       ripremere il pulsante non sdoppia, ma il compagno di camera resta
       (la proprieta', 4 settembre 2026). */
    await db.from('consenso').update({ stato: 'annullato' })
      .eq('camera', a.camera).eq('cognome', a.cognome).eq('nome', a.nome).eq('stato', 'in_attesa');
    const { data, error } = await db.from('consenso').insert({ ...a, stato: 'in_attesa' }).select('id').single();
    if (error || !data) { console.error('attesa non salvata', error); return risposta({ errore: 'non riesco a salvare' }, 500); }
    return risposta({ esito: 'ok', id: data.id });
  }

  /* Chi ha gia' firmato per questa prenotazione di Fidra: lo chiede
     l'estensione dalla pagina della prenotazione, con la chiave hotel, e
     lo mostra nella barra («le email della privacy non riusciamo a
     importarle in Fidra?», la proprieta', 5 settembre 2026). Senza le firme:
     bastano stato, ora, fonte e le scelte. */
  /** La mezzanotte di Roma di quel giorno: a 00:00Z Roma segna l'una o le due. */
  const inizioGiornoRoma = (giorno: string): Date => {
    const mezzanotteUtc = new Date(giorno + 'T00:00:00Z');
    const ore = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Rome', hour: '2-digit', hourCycle: 'h23' }).format(mezzanotteUtc)) || 0;
    return new Date(mezzanotteUtc.getTime() - ore * 3600 * 1000);
  };
  /* la firma di UN consenso, per disegnarla nel modulo privacy/create di
     Fidra (l'estensione, chiave hotel): una alla volta, mai nell'elenco */
  if (azione === 'firma-di') {
    if (!chiaveHotel(req)) return risposta({ errore: 'non autorizzato' }, 401);
    const id = url.searchParams.get('id') || '';
    const { data } = await db.from('consenso').select('firma, stato').eq('id', id).maybeSingle();
    if (!data || data.stato !== 'firmato' || !data.firma) return risposta({ errore: 'consenso non trovato o non firmato' }, 404);
    return risposta({ firma: data.firma });
  }

  if (azione === 'stato') {
    if (!chiaveHotel(req)) return risposta({ errore: 'non autorizzato' }, 401);
    const fidra = (url.searchParams.get('fidra') || '').trim();
    const giorno = (url.searchParams.get('giorno') || '').trim();
    const id = (url.searchParams.get('id') || '').trim();
    /* le camere della prenotazione e l'arrivo: chi firma sull'iPad senza
       passare dall'attesa mandata da Fidra non porta il numero della
       prenotazione, ma camera e giorno si' (le tre firme della 523 del 5
       settembre 2026 non comparivano nella barra) */
    const camere = (url.searchParams.get('camere') || '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 10);
    const da = (url.searchParams.get('da') || '').trim();
    const eData = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
    if (!id && !fidra && !eData(giorno)) return risposta({ errore: 'serve un consenso, la prenotazione di Fidra, o un giorno' }, 400);
    const COLONNE = 'id, stato, firmato_il, camera, cognome, nome, email, lingua, conservazione, messaggi, marketing, testi_versione, fonte, fidra_prenotazione';
    const base = () => db.from('consenso').select(COLONNE).neq('stato', 'annullato');
    let righe: Record<string, unknown>[] = [];
    if (id) {
      const { data, error } = await base().eq('id', id);
      if (error) return risposta({ errore: error.message }, 500);
      righe = data ?? [];
    } else if (fidra) {
      const { data, error } = await base().eq('fidra_prenotazione', fidra);
      if (error) return risposta({ errore: error.message }, 500);
      righe = data ?? [];
      if (camere.length && eData(da)) {
        const { data: perCamera } = await base().eq('stato', 'firmato').is('fidra_prenotazione', null).in('camera', camere).gte('firmato_il', inizioGiornoRoma(da).toISOString());
        for (const r of perCamera ?? []) if (!righe.some((x) => x.id === r.id)) righe.push(r);
      }
    } else {
      /* le firme di un giorno, nell'ora dell'hotel: il modulo di Fidra
         (privacy/create) si riempie da qui (la proprieta', 5 settembre 2026) */
      const inizio = inizioGiornoRoma(giorno);
      const { data, error } = await base().eq('stato', 'firmato').gte('firmato_il', inizio.toISOString()).lt('firmato_il', new Date(inizio.getTime() + 24 * 3600 * 1000).toISOString());
      if (error) return risposta({ errore: error.message }, 500);
      righe = data ?? [];
    }
    righe.sort((a, b) => String(b.firmato_il ?? '').localeCompare(String(a.firmato_il ?? '')));
    return risposta({ consensi: righe });
  }

  /* ---------- dal totem e dall'iPad ---------- */
  /* Un consenso in attesa vive TRE MINUTI nell'elenco dell'iPad: dopo,
     nome e camera non si vedono piu' («togli in automatico dopo 3
     minuti», la proprieta', 4 settembre 2026). Non si cancella niente: se
     l'ospite arriva dopo, la reception ripreme il pulsante, oppure lui
     passa la tessera al totem, che non ha scadenza perche' li' e' lui a
     presentarsi con la sua carta. */
  const daQuando = () => new Date(Date.now() - MINUTI_ATTESA * 60 * 1000).toISOString();

  if (azione === 'attese') {
    if (!eTotem(req)) return risposta({ errore: 'non autorizzato' }, 401);
    const { data } = await db.from('consenso').select('id, camera, cognome, nome, lingua, creato_il, email')
      .eq('stato', 'in_attesa').eq('destinazione', 'ipad').gte('creato_il', daQuando())
      .order('creato_il', { ascending: false }).limit(100);
    const attese = (data ?? []).map(({ email, ...a }) => ({ ...a, ha_email: !!email }));
    return risposta({ attese, minuti: MINUTI_ATTESA });
  }

  /* solo QUANTI sono, senza nomi ne' camere: lo chiede l'iPad quando e'
     chiuso, per accendere un pallino senza mostrare niente a nessuno */
  if (azione === 'quante') {
    if (!eTotem(req)) return risposta({ errore: 'non autorizzato' }, 401);
    const { count } = await db.from('consenso').select('id', { count: 'exact', head: true })
      .eq('stato', 'in_attesa').eq('destinazione', 'ipad').gte('creato_il', daQuando());
    return risposta({ attese: count ?? 0 });
  }

  if (azione === 'tessera') {
    if (!eTotem(req)) return risposta({ errore: 'non autorizzato' }, 401);
    const codice = (url.searchParams.get('codice') || '').trim();
    if (!/^[0-9]{4,20}$/.test(codice)) return risposta({ errore: 'codice della tessera non valido' }, 400);
    const f = await contoFidra(codice);
    if (f.stato === 503) return risposta({ errore: 'lettura della tessera non configurata' }, 503);
    if (f.stato === 404) return risposta({ errore: 'tessera non trovata' }, 404);
    if (f.stato !== 200 || !f.camera) return risposta({ errore: 'Fidra non risponde' }, 502);
    /* tutte le persone in attesa di quella camera: al totem sara' l'ospite
       a dire quale delle due e' lui */
    const { data } = await db.from('consenso').select('id, camera, cognome, nome, lingua, email')
      .eq('stato', 'in_attesa').eq('camera', f.camera).order('creato_il', { ascending: true }).limit(8);
    /* l'indirizzo non torna al totem: torna solo se ce l'abbiamo */
    const attese = (data ?? []).map(({ email, ...a }) => ({ ...a, ha_email: !!email }));
    return risposta({ camera: f.camera, attese, attesa: attese[0] ?? null });
  }

  if (azione === 'firma') {
    if (req.method !== 'POST') return risposta({ errore: 'metodo non ammesso' }, 405);
    if (!eTotem(req)) return risposta({ errore: 'non autorizzato' }, 401);
    const letta = leggiFirma(await corpo());
    if (!letta.ok) return risposta({ errore: letta.errore }, 400);
    const f = letta.valore;
    let riga: Riga;
    if (f.id) {
      const { data } = await db.from('consenso').select('*').eq('id', f.id).maybeSingle();
      if (!data) return risposta({ errore: 'consenso non trovato' }, 404);
      if (data.stato === 'firmato') return risposta({ errore: 'gia firmato' }, 409);
      riga = data;
    } else {
      /* nessun check-in registrato: nome scritto a mano sul totem */
      const { data, error } = await db.from('consenso')
        .insert({ camera: f.camera, cognome: f.cognome, nome: f.nome, lingua: f.lingua, stato: 'in_attesa' }).select('*').single();
      if (error || !data) { console.error('consenso non creato', error); return risposta({ errore: 'non riesco a salvare' }, 500); }
      riga = data;
    }
    const ora = adesso();
    const agg = {
      stato: 'firmato', firmato_il: ora, lingua: f.lingua,
      conservazione: f.scelte.conservazione, messaggi: null, marketing: f.scelte.marketing,
      firma: f.firma, testi_versione: f.versione, fonte: f.fonte, ip: indirizzo(req),
    } as Riga;
    /* Gli ospiti che arrivano dai portali spesso non ci lasciano l'email:
       se la scrivono sul modulo la teniamo, altrimenti il consenso alle
       offerte non servirebbe a niente. Quella che ci ha gia' dato la
       reception non si tocca. */
    if (f.email && !riga.email) agg.email = f.email;
    const { error } = await db.from('consenso').update(agg).eq('id', riga.id as string);
    if (error) { console.error('firma non salvata', error); return risposta({ errore: 'non riesco a salvare' }, 500); }
    const perEmail = {
      camera: String(riga.camera), cognome: String(riga.cognome), nome: String(riga.nome ?? ''), email: ((riga.email as string | null) ?? null) || f.email,
      lingua: f.lingua as Lingua, scelte: f.scelte, firmatoIl: ora, fonte: f.fonte, versione: f.versione,
    };
    const r = emailConsensoReception(perEmail);
    let inviate = 0;
    if (await inviaEmail(EMAIL_HOTEL, r.oggetto, r.html, r.testo, [{ filename: 'firma.png', content: firmaBase64(f.firma) }])) inviate++;
    if (perEmail.email) { const o = emailConsensoOspite(perEmail); if (await inviaEmail(perEmail.email, o.oggetto, o.html, o.testo)) inviate++; }
    if (inviate) await db.from('consenso').update({ email_inviata: true }).eq('id', riga.id as string);
    return risposta({ esito: 'ok', id: riga.id });
  }

  /* ---------- riservati al back office ---------- */
  const accesso = await autorizzato(req);
  if (!accesso.ok) return risposta({ errore: 'non autorizzato' }, 401);
  if (!accesso.chiave && !['reception', 'amministrazione'].includes(accesso.ruolo ?? '')) return risposta({ errore: 'solo reception e amministrazione' }, 403);

  if (azione === 'elenco') {
    const cerca = (url.searchParams.get('cerca') || '').trim();
    /* la seconda data si chiama «fino», non «a»: «a» e' gia' il nome
       dell'azione, e il filtro si ritrovava «elenco» come data (difetto
       visto in reception il 4 settembre 2026) */
    const da = url.searchParams.get('da') || '', a = url.searchParams.get('fino') || '';
    let q = db.from('consenso').select(COLONNE_ELENCO).neq('stato', 'annullato')
      .order('firmato_il', { ascending: false, nullsFirst: true }).order('creato_il', { ascending: false }).limit(300);
    if (cerca) q = /^\d+$/.test(cerca) ? q.eq('camera', cerca) : q.ilike('cognome', `%${cerca}%`);
    if (da) q = q.gte('firmato_il', da + 'T00:00:00Z');
    if (a) q = q.lte('firmato_il', a + 'T23:59:59Z');
    const { data, error } = await q;
    if (error) return risposta({ errore: error.message }, 500);
    return risposta({ consensi: data ?? [] });
  }

  if (azione === 'uno') {
    const id = url.searchParams.get('id') || '';
    const { data } = await db.from('consenso').select('*').eq('id', id).maybeSingle();
    if (!data) return risposta({ errore: 'consenso non trovato' }, 404);
    return risposta({ consenso: data, testi: testiConsenso(data.lingua), versione: VERSIONE_TESTI });
  }

  if (azione === 'annulla') {
    if (req.method !== 'POST') return risposta({ errore: 'metodo non ammesso' }, 405);
    const b = await corpo();
    const { data } = await db.from('consenso').update({ stato: 'annullato' }).eq('id', String(b.id ?? '')).eq('stato', 'in_attesa').select('id');
    return risposta({ esito: 'ok', annullati: (data ?? []).length });
  }

  return risposta({ errore: 'azione sconosciuta' }, 404);
});
