/* ============================================================
   dayspa — il Day Spa venduto da noi: posti, prenotazioni, pagamento, QR.

   Specifica: docs/superpowers/specs/2026-09-03-day-spa-online-design.md
   Piano:     docs/superpowers/plans/2026-09-03-day-spa-ingressi.md

   Pubbliche (senza JWT, col freno per IP):
     GET  ?a=listino            → fasce, orari, prezzi, massimo persone
     GET  ?a=giorni&da=&a=      → per ogni giorno e fascia UNA PAROLA (mai il numero dei posti)
     POST ?a=prenota            → prende i posti, crea la prenotazione in pagamento, torna il link Stripe
     POST ?a=webhook            → Stripe conferma l'incasso: pagata, email col QR, ricevuta in coda
     GET  ?a=qr&codice=         → il PNG del QR
     GET  ?a=stato&numero=      → lo stato, per la pagina di grazie che aspetta il webhook
     POST ?a=scadute            → dal cron: i pagamenti abbandonati restituiscono i posti
   Riservate (reception, spa, amministrazione):
     GET  ?a=oggi&giorno=       → gli arrivi del giorno con i posti per fascia
     POST ?a=presenti           → segna quante persone sono entrate
     GET  ?a=elenco&cerca=      → le prenotazioni
     GET/POST ?a=disponibilita  → i posti settimanali, letti e caricati
     GET  ?a=fidra&da=&fino=    → i posti come li ha caricati la reception in Fidra, pronti da salvare
     POST ?a=rimborsa           → solo reception e amministrazione: rimborso e posti liberati

   Le regole stanno nei moduli puri accanto (listino, posti, validazione,
   stripe, email-dayspa, ruoli): qui solo il database, la rete e il vetro.
   ============================================================ */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { fasceDelGiorno, listinoPubblico, prezzoCent, tipoDelGiorno, FASCE, TIPI, type Fascia, type Tipo } from './listino.ts';
import { codicePrenotazione, numeroPrenotazione, scadenza, statoPosti } from './posti.ts';
import { dataValida, validaPrenotazione } from './validazione.ts';
import { chiaveStripe, dividi, firmaValida, parametriLink, segretoWebhook, STRIPE } from './stripe.ts';
import { dataEstesa, emailConferma, TESTI_EMAIL } from './email-dayspa.ts';
import { creaFrenoIp } from './limite-ip.ts';
import { generaPngQR } from './qr.js';
import { puoRimborsare, ruoloDi, vedeDayspa, type Ruolo } from './ruoli.ts';
import { righeDaFidra, URL_FIDRA } from './fidra.ts';

/* MODALITA' DI PROVA: chiavi Stripe di prova, prenotazioni col segno
   `prova`, da cancellare prima di andare in linea. */
const PROVA = Deno.env.get('DAYSPA_PROVA') === '1';
const PAGINA = Deno.env.get('PAGINA_DAYSPA') || 'https://www.hoteltermeleonardo.com/dayspa/';
const EMAIL_HOTEL = Deno.env.get('EMAIL_HOTEL') || 'info@termeleonardo.com';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, authorization, x-hotel-key, x-cron-key',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

const risposta = (corpo: unknown, stato = 200) =>
  new Response(JSON.stringify(corpo), { status: stato, headers: { ...CORS, 'content-type': 'application/json' } });

function indirizzo(req: Request): string {
  const f = req.headers.get('x-forwarded-for') || '';
  return f.split(',')[0].trim() || 'sconosciuto';
}

/* I freni: 60 letture ogni cinque minuti per indirizzo, 10 prenotazioni
   ogni dieci minuti. Approssimativi per istanza, come spiega limite-ip.ts. */
const permessoLettura = creaFrenoIp(60, 5 * 60 * 1000);
const permessoPrenota = creaFrenoIp(10, 10 * 60 * 1000);

/* «oggi» a Roma, non in UTC: alle 00:30 di Roma un ospite puo' ancora
   prenotare per oggi, e alle 23:30 non deve poter prenotare per ieri. */
function oggiRoma(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date());
}

type Stagione = { chiusura: string; riapertura: string };
async function leggiStagioni(): Promise<Stagione[]> {
  try {
    const { data } = await db.from('stagione_chiusura').select('chiusura, riapertura').order('chiusura');
    return (data ?? []) as Stagione[];
  } catch (e) {
    console.error('stagioni non lette, il Day Spa prosegue:', e);
    return [];
  }
}
const chiusoIl = (giorno: string, stagioni: Stagione[]) =>
  stagioni.some((s) => giorno >= s.chiusura && giorno < s.riapertura);

const giornoDopo = (iso: string) => {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

/* ---------- Stripe ---------- */
async function stripe(percorso: string, corpo?: Record<string, string>) {
  const chiave = chiaveStripe(PROVA);
  if (!chiave) throw new Error('Stripe non configurato');
  const r = await fetch(STRIPE + percorso, {
    method: corpo ? 'POST' : 'GET',
    headers: { authorization: `Bearer ${chiave}`, 'content-type': 'application/x-www-form-urlencoded' },
    body: corpo ? new URLSearchParams(corpo).toString() : undefined,
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error?.message || 'Stripe ha risposto ' + r.status);
  return j;
}

/* ---------- email, con Resend come i buoni ---------- */
async function inviaEmail(a: string, oggetto: string, html: string, testo: string): Promise<boolean> {
  const chiave = Deno.env.get('RESEND_API_KEY');
  if (!chiave) { console.error('email non inviata: RESEND_API_KEY mancante ->', a, oggetto); return false; }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${chiave}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: Deno.env.get('MITTENTE_EMAIL') || 'Hotel Terme Leonardo <noreply@hoteltermeleonardo.com>',
      to: [a], subject: (PROVA ? '[PROVA] ' : '') + oggetto, html, text: testo,
    }),
  });
  if (!r.ok) console.error('Resend', r.status, await r.text());
  return r.ok;
}

/* ---------- chi entra nella parte riservata ---------- */
type Accesso = { ok: true; ruolo: Ruolo | null; chiave: boolean } | { ok: false };
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

const linkQr = (codice: string) =>
  `${Deno.env.get('SUPABASE_URL')}/functions/v1/dayspa?a=qr&codice=${encodeURIComponent(codice)}`;

/* la conferma all'ospite: pagata, ricevuta in coda, email col QR. Usata dal
   webhook, e da nessun altro: e' l'unico punto in cui una prenotazione
   diventa un biglietto. */
async function confermaPagata(numero: string, pagamento: string | null) {
  const { data: p } = await db.from('dayspa_prenotazione').select('*').eq('numero', numero).maybeSingle();
  if (!p) return null;
  await db.from('dayspa_prenotazione')
    .update({ stato: 'pagata', pagato_il: new Date().toISOString(), stripe_pagamento: pagamento ?? p.stripe_pagamento, ricevuta_stato: 'da_battere' })
    .eq('numero', numero);
  const e = emailConferma(p, linkQr(p.codice));
  await inviaEmail(p.email, e.oggetto, e.html, e.testo);
  return p;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const url = new URL(req.url);
  const azione = url.searchParams.get('a') || '';

  /* ---------- pubblico: il listino ---------- */
  if (azione === 'listino') {
    return risposta({ esito: 'ok', ...listinoPubblico(), prova: PROVA });
  }

  /* ---------- pubblico: lo stato dei giorni, una parola per fascia ---------- */
  if (azione === 'giorni') {
    if (!permessoLettura(indirizzo(req))) return risposta({ errore: 'troppe richieste, riprovi tra qualche minuto' }, 429);
    const oggi = oggiRoma();
    let da = url.searchParams.get('da') || oggi;
    const a = url.searchParams.get('a_fine') || url.searchParams.get('fino') || '';
    if (!dataValida(da) || !dataValida(a)) return risposta({ errore: 'date non valide' }, 400);
    if (da < oggi) da = oggi;
    if (a < da) return risposta({ errore: 'intervallo vuoto' }, 400);
    /* al massimo due mesi per chiamata: e' quanto il calendario mostra */
    const giorniTot = Math.round((new Date(a + 'T12:00:00Z').getTime() - new Date(da + 'T12:00:00Z').getTime()) / 86400000) + 1;
    if (giorniTot > 62) return risposta({ errore: 'al massimo 62 giorni' }, 400);
    const stagioni = await leggiStagioni();
    const { data: righe, error } = await db.from('dayspa_giorno')
      .select('giorno, fascia, tipo, posti, venduti, prezzo_cent').gte('giorno', da).lte('giorno', a);
    if (error) return risposta({ errore: error.message }, 500);
    const perChiave = new Map<string, { tipo: Tipo; posti: number; venduti: number; prezzo_cent: number }>();
    for (const r of righe ?? []) perChiave.set(`${r.giorno}|${r.fascia}`, r);
    const giorni = [];
    for (let iso = da; iso <= a; iso = giornoDopo(iso)) {
      const chiuso = chiusoIl(iso, stagioni);
      const fasce = fasceDelGiorno(iso).map((fascia) => {
        const riga = perChiave.get(`${iso}|${fascia}`) ?? null;
        const tipo = riga?.tipo ?? tipoDelGiorno(iso);
        return { fascia, stato: statoPosti(riga, chiuso), prezzoCent: riga?.prezzo_cent ?? prezzoCent(tipo, fascia), tipo };
      });
      giorni.push({ giorno: iso, tipo: fasce[0].tipo, fasce });
    }
    return risposta({ esito: 'ok', oggi, giorni });
  }

  /* ---------- pubblico: la prenotazione, fino al link di pagamento ---------- */
  if (azione === 'prenota') {
    if (req.method !== 'POST') return risposta({ errore: 'metodo non ammesso' }, 405);
    if (!permessoPrenota(indirizzo(req))) return risposta({ errore: 'troppe richieste, riprovi tra qualche minuto' }, 429);
    const corpo = await req.json().catch(() => null);
    const v = validaPrenotazione(corpo, oggiRoma());
    if (v.errore || !v.dati) return risposta({ errore: v.errore ?? 'dati non validi' }, 400);
    const d = v.dati;
    /* il buono regalo Day Spa: fase successiva (vedi il piano). Meglio dirlo
       che accettarlo e non scalarlo. */
    if (d.buono) return risposta({ errore: 'il buono regalo si presenta alla reception: qui non si usa ancora' }, 400);

    if (chiusoIl(d.giorno, await leggiStagioni())) return risposta({ errore: 'in quel giorno siamo chiusi', stato: 'chiuso' }, 409);
    const { data: riga } = await db.from('dayspa_giorno').select('tipo, prezzo_cent').eq('giorno', d.giorno).eq('fascia', d.fascia).maybeSingle();
    if (!riga) return risposta({ errore: 'quel giorno non e ancora in vendita', stato: 'non-in-vendita' }, 409);

    /* i posti si prendono ORA, in una istruzione sola nel database: se non
       bastano, nessuna prenotazione nasce */
    const { data: presi, error: ePresa } = await db.rpc('dayspa_prendi_posti', { p_giorno: d.giorno, p_fascia: d.fascia, p_n: d.persone });
    if (ePresa) return risposta({ errore: ePresa.message }, 500);
    if (!presi) return risposta({ errore: 'esaurito nel frattempo: scelga un altro giorno o un altra fascia', stato: 'esaurito' }, 409);

    const importoCent = Number(riga.prezzo_cent) * d.persone;
    const { data: prog, error: eNum } = await db.rpc('dayspa_prossimo_numero');
    if (eNum) {
      await db.rpc('dayspa_libera_posti', { p_giorno: d.giorno, p_fascia: d.fascia, p_n: d.persone });
      return risposta({ errore: eNum.message }, 500);
    }
    const numero = numeroPrenotazione(Number(oggiRoma().slice(0, 4)), Number(prog));

    /* il codice e' unico per vincolo: se per caso collide, si riprova */
    let inserita = false;
    let codice = '';
    for (let i = 0; i < 5 && !inserita; i++) {
      codice = codicePrenotazione();
      const { error } = await db.from('dayspa_prenotazione').insert({
        numero, giorno: d.giorno, fascia: d.fascia, persone: d.persone, adulti: d.adulti, bambini: d.bambini,
        importo_cent: importoCent, stato: 'in_pagamento', nome: d.nome, email: d.email, telefono: d.telefono || null,
        lingua: d.lingua, codice, prova: PROVA, scade_il: scadenza(new Date()),
      });
      if (!error) inserita = true;
      else if (!/codice/.test(error.message)) {
        await db.rpc('dayspa_libera_posti', { p_giorno: d.giorno, p_fascia: d.fascia, p_n: d.persone });
        return risposta({ errore: error.message }, 500);
      }
    }
    if (!inserita) {
      await db.rpc('dayspa_libera_posti', { p_giorno: d.giorno, p_fascia: d.fascia, p_n: d.persone });
      return risposta({ errore: 'non sono riuscito a generare un codice' }, 500);
    }

    try {
      const t = TESTI_EMAIL[d.lingua] || TESTI_EMAIL.it;
      const descrizione = `${t.fascia[d.fascia]} Day Spa · ${dataEstesa(d.giorno, d.lingua)} · ${t.persone(d.persone)}`;
      const { prezzo, link } = dividi(parametriLink({
        numero, descrizione, importoCent, redirect: `${PAGINA}?grazie=${encodeURIComponent(numero)}&l=${d.lingua}`,
      }));
      const p = await stripe('/prices', prezzo);
      const l = await stripe('/payment_links', { 'line_items[0][price]': p.id, ...link });
      await db.from('dayspa_prenotazione').update({ stripe_link: l.id }).eq('numero', numero);
      return risposta({ esito: 'ok', numero, url: l.url });
    } catch (e) {
      /* Stripe non ha risposto: i posti tornano subito, la prenotazione
         resta come traccia con lo stato scaduta e il motivo */
      console.error('link di pagamento non creato', numero, e);
      await db.rpc('dayspa_libera_posti', { p_giorno: d.giorno, p_fascia: d.fascia, p_n: d.persone });
      await db.from('dayspa_prenotazione').update({ stato: 'scaduta', note: 'pagamento non avviato: ' + String(e).slice(0, 200) }).eq('numero', numero);
      return risposta({ errore: 'il pagamento non e disponibile in questo momento: riprovi tra qualche minuto' }, 502);
    }
  }

  /* ---------- pubblico: Stripe conferma l'incasso ---------- */
  if (azione === 'webhook') {
    if (req.method !== 'POST') return risposta({ errore: 'metodo non ammesso' }, 405);
    const grezzo = await req.text();
    if (!(await firmaValida(grezzo, req.headers.get('stripe-signature'), segretoWebhook(PROVA)))) {
      console.warn('webhook con firma non valida: ignorato');
      return risposta({ errore: 'firma non valida' }, 400);
    }
    let evento: { type?: string; data?: { object?: Record<string, unknown> } };
    try { evento = JSON.parse(grezzo); } catch { return risposta({ errore: 'corpo non valido' }, 400); }
    if (evento.type !== 'checkout.session.completed') return risposta({ esito: 'ok', ignorato: evento.type });
    const sessione = evento.data?.object ?? {};
    const meta = (sessione.metadata ?? {}) as Record<string, string>;
    const numero = meta.numero || '';
    const pagamento = typeof sessione.payment_intent === 'string' ? sessione.payment_intent : null;
    const linkId = typeof sessione.payment_link === 'string' ? sessione.payment_link : '';
    let q = db.from('dayspa_prenotazione').select('numero, stato, giorno, fascia, persone');
    q = numero ? q.eq('numero', numero) : q.eq('stripe_link', linkId);
    const { data: p } = await q.maybeSingle();
    if (!p) { console.error('webhook per una prenotazione sconosciuta', numero || linkId); return risposta({ esito: 'ok', sconosciuta: true }); }
    /* Stripe rimanda gli eventi: la seconda volta non si rimanda l'email */
    if (p.stato === 'pagata') return risposta({ esito: 'ok', ripetuto: true });
    if (p.stato === 'scaduta') {
      /* pagata dopo i venti minuti: i posti erano tornati liberi. Si
         riprovano; se non ci sono piu', la prenotazione vale lo stesso (un
         pagamento riuscito non si butta) e l'hotel lo sa subito. */
      const { data: presi } = await db.rpc('dayspa_prendi_posti', { p_giorno: p.giorno, p_fascia: p.fascia, p_n: p.persone });
      if (!presi) {
        await db.from('dayspa_prenotazione').update({ note: 'pagata dopo la scadenza, posti non garantiti' }).eq('numero', p.numero);
        await inviaEmail(EMAIL_HOTEL, `Day Spa ${p.numero}: pagata dopo la scadenza, posti da verificare`,
          `<p>La prenotazione ${p.numero} (${p.giorno}, ${p.fascia}, ${p.persone} persone) e' stata pagata dopo i venti minuti e i posti non c'erano piu'. Va guardata.</p>`,
          `La prenotazione ${p.numero} e' stata pagata dopo i venti minuti e i posti non c'erano piu'.`);
      }
    }
    await confermaPagata(p.numero, pagamento);
    return risposta({ esito: 'ok', numero: p.numero });
  }

  /* ---------- pubblico: il QR ---------- */
  if (azione === 'qr') {
    const testo = url.searchParams.get('codice') || '';
    if (!testo || testo.length > 32 || !/^[A-Z0-9-]+$/.test(testo)) return risposta({ errore: 'codice non valido' }, 400);
    const png = generaPngQR(testo, {}) as Uint8Array;
    const buf = new ArrayBuffer(png.byteLength);
    new Uint8Array(buf).set(png);
    return new Response(buf, { headers: { ...CORS, 'content-type': 'image/png', 'cache-control': 'public, max-age=86400' } });
  }

  /* ---------- pubblico: lo stato, per la pagina di grazie ---------- */
  if (azione === 'stato') {
    if (!permessoLettura(indirizzo(req))) return risposta({ errore: 'troppe richieste' }, 429);
    const numero = (url.searchParams.get('numero') || '').slice(0, 20);
    if (!/^DS-\d{4}-\d{4,}$/.test(numero)) return risposta({ errore: 'numero non valido' }, 400);
    const { data: p } = await db.from('dayspa_prenotazione').select('stato, giorno, fascia, persone').eq('numero', numero).maybeSingle();
    if (!p) return risposta({ errore: 'prenotazione non trovata' }, 404);
    return risposta({ esito: 'ok', stato: p.stato, giorno: p.giorno, fascia: p.fascia, persone: p.persone });
  }

  /* ---------- dal cron: i pagamenti abbandonati restituiscono i posti ---------- */
  if (azione === 'scadute') {
    const attesaCron = Deno.env.get('CRON_KEY');
    if (!attesaCron || req.headers.get('x-cron-key') !== attesaCron) return risposta({ errore: 'non autorizzato' }, 401);
    const { data: scadute, error } = await db.from('dayspa_prenotazione')
      .select('numero, giorno, fascia, persone').eq('stato', 'in_pagamento').lt('scade_il', new Date().toISOString()).limit(200);
    if (error) return risposta({ errore: error.message }, 500);
    let n = 0;
    for (const p of scadute ?? []) {
      const { error: e } = await db.from('dayspa_prenotazione').update({ stato: 'scaduta' }).eq('numero', p.numero).eq('stato', 'in_pagamento');
      if (e) continue;
      await db.rpc('dayspa_libera_posti', { p_giorno: p.giorno, p_fascia: p.fascia, p_n: p.persone });
      n++;
    }
    return risposta({ esito: 'ok', scadute: n });
  }

  /* ---------- riservati al back office ---------- */
  const accesso = await autorizzato(req);
  if (!accesso.ok) return risposta({ errore: 'non autorizzato' }, 401);
  if (!accesso.chiave && !vedeDayspa(accesso.ruolo)) return risposta({ errore: 'non autorizzato' }, 403);

  if (azione === 'oggi') {
    const giorno = url.searchParams.get('giorno') || oggiRoma();
    if (!dataValida(giorno)) return risposta({ errore: 'data non valida' }, 400);
    const { data: fasce } = await db.from('dayspa_giorno').select('fascia, tipo, posti, venduti, prezzo_cent').eq('giorno', giorno);
    const { data: prenotazioni, error } = await db.from('dayspa_prenotazione')
      .select('numero, fascia, persone, adulti, bambini, presenti, nome, email, telefono, lingua, codice, stato, importo_cent, arrivato_il, note, prova')
      .eq('giorno', giorno).in('stato', ['pagata', 'rimborsata']).order('fascia').order('nome');
    if (error) return risposta({ errore: error.message }, 500);
    return risposta({ esito: 'ok', giorno, fasce: fasce ?? [], prenotazioni: prenotazioni ?? [] });
  }

  if (azione === 'presenti') {
    if (req.method !== 'POST') return risposta({ errore: 'metodo non ammesso' }, 405);
    const b = await req.json().catch(() => ({})) as Record<string, unknown>;
    const numero = String(b.numero ?? '').trim();
    const codice = String(b.codice ?? '').trim().toUpperCase();
    if (!numero && !codice) return risposta({ errore: 'serve il numero o il codice' }, 400);
    let q = db.from('dayspa_prenotazione').select('numero, persone, stato, giorno');
    q = numero ? q.eq('numero', numero) : q.eq('codice', codice);
    const { data: p } = await q.maybeSingle();
    if (!p) return risposta({ errore: 'prenotazione non trovata' }, 404);
    if (p.stato !== 'pagata') return risposta({ errore: `la prenotazione e ${p.stato}, non pagata` }, 409);
    const presenti = b.presenti === undefined ? p.persone : Number(b.presenti);
    if (!Number.isInteger(presenti) || presenti < 0 || presenti > p.persone) return risposta({ errore: `presenti fra 0 e ${p.persone}` }, 400);
    const { data: agg, error } = await db.from('dayspa_prenotazione')
      .update({ presenti, arrivato_il: presenti > 0 ? new Date().toISOString() : null }).eq('numero', p.numero)
      .select('numero, giorno, fascia, persone, presenti, nome, arrivato_il').single();
    if (error) return risposta({ errore: error.message }, 500);
    return risposta({ esito: 'ok', prenotazione: agg, oggi: agg.giorno === oggiRoma() });
  }

  if (azione === 'elenco') {
    const cerca = (url.searchParams.get('cerca') || '').trim().slice(0, 80);
    const da = url.searchParams.get('da') || '';
    const a = url.searchParams.get('fino') || '';
    let q = db.from('dayspa_prenotazione')
      .select('numero, giorno, fascia, persone, presenti, nome, email, telefono, lingua, codice, stato, importo_cent, ricevuta_stato, ricevuta_numero, creato_il, pagato_il, arrivato_il, note, prova')
      .order('giorno', { ascending: false }).order('creato_il', { ascending: false }).limit(200);
    if (dataValida(da)) q = q.gte('giorno', da);
    if (dataValida(a)) q = q.lte('giorno', a);
    if (cerca) {
      /* il testo digitato e' testo: si passa come valore, mai come sintassi */
      const t = cerca.replace(/[%_,()]/g, ' ');
      q = q.or(`nome.ilike.%${t}%,email.ilike.%${t}%,numero.ilike.%${t}%,codice.ilike.%${t}%`);
    }
    const { data, error } = await q;
    if (error) return risposta({ errore: error.message }, 500);
    return risposta({ esito: 'ok', prenotazioni: data ?? [] });
  }

  if (azione === 'disponibilita') {
    if (req.method === 'GET') {
      const oggi = oggiRoma();
      const da = url.searchParams.get('da') || oggi;
      let a = url.searchParams.get('fino') || '';
      if (!dataValida(da)) return risposta({ errore: 'data non valida' }, 400);
      if (!dataValida(a)) { a = da; for (let i = 0; i < 13; i++) a = giornoDopo(a); }
      const { data: righe, error } = await db.from('dayspa_giorno')
        .select('giorno, fascia, tipo, posti, venduti, prezzo_cent, note').gte('giorno', da).lte('giorno', a).order('giorno');
      if (error) return risposta({ errore: error.message }, 500);
      const esistenti = new Map((righe ?? []).map((r) => [`${r.giorno}|${r.fascia}`, r]));
      const stagioni = await leggiStagioni();
      const giorni = [];
      for (let iso = da; iso <= a; iso = giornoDopo(iso)) {
        const tipo = tipoDelGiorno(iso);
        giorni.push({
          giorno: iso, chiuso: chiusoIl(iso, stagioni), tipoProposto: tipo,
          fasce: fasceDelGiorno(iso).map((fascia) => {
            const r = esistenti.get(`${iso}|${fascia}`);
            return r
              ? { fascia, caricata: true, tipo: r.tipo, posti: r.posti, venduti: r.venduti, prezzo_cent: r.prezzo_cent, note: r.note }
              : { fascia, caricata: false, tipo, posti: null, venduti: 0, prezzo_cent: prezzoCent(tipo, fascia), note: null };
          }),
        });
      }
      return risposta({ esito: 'ok', da, fino: a, giorni });
    }
    if (req.method !== 'POST') return risposta({ errore: 'metodo non ammesso' }, 405);
    const b = await req.json().catch(() => ({})) as { righe?: unknown };
    const righe = Array.isArray(b.righe) ? b.righe as Record<string, unknown>[] : [];
    if (!righe.length || righe.length > 62) return risposta({ errore: 'servono da 1 a 62 righe' }, 400);
    const pulite = [];
    for (const r of righe) {
      const giorno = String(r.giorno ?? ''), fascia = String(r.fascia ?? '') as Fascia, tipo = String(r.tipo ?? '') as Tipo;
      const posti = Number(r.posti), prezzo = Number(r.prezzo_cent);
      if (!dataValida(giorno)) return risposta({ errore: `data non valida: ${giorno}` }, 400);
      if (!FASCE.includes(fascia) || !fasceDelGiorno(giorno).includes(fascia)) return risposta({ errore: `fascia non valida per ${giorno}: ${fascia}` }, 400);
      if (!TIPI.includes(tipo)) return risposta({ errore: `tipo non valido: ${tipo}` }, 400);
      if (!Number.isInteger(posti) || posti < 0 || posti > 500) return risposta({ errore: `posti non validi per ${giorno}` }, 400);
      if (!Number.isInteger(prezzo) || prezzo <= 0) return risposta({ errore: `prezzo non valido per ${giorno}` }, 400);
      pulite.push({ giorno, fascia, tipo, posti, prezzo_cent: prezzo, note: r.note ? String(r.note).slice(0, 200) : null });
    }
    /* mai sotto i posti gia' venduti: la reception vedrebbe un negativo e
       l'ospite che ha pagato non avrebbe piu' il suo posto */
    const { data: esistenti } = await db.from('dayspa_giorno').select('giorno, fascia, venduti')
      .in('giorno', [...new Set(pulite.map((p) => p.giorno))]);
    for (const p of pulite) {
      const e = (esistenti ?? []).find((x) => x.giorno === p.giorno && x.fascia === p.fascia);
      if (e && p.posti < e.venduti) return risposta({ errore: `${p.giorno} ${p.fascia}: ${e.venduti} posti gia venduti, non si puo scendere a ${p.posti}` }, 400);
    }
    const { error } = await db.from('dayspa_giorno').upsert(pulite.map((p) => ({ ...p, aggiornato_il: new Date().toISOString() })), { onConflict: 'giorno,fascia' });
    if (error) return risposta({ errore: error.message }, 500);
    return risposta({ esito: 'ok', salvate: pulite.length });
  }

  /* I POSTI LETTI DA FIDRA. Finche' la reception carica i posti in Fidra,
     qui si leggono dall'API del sito precedente invece di ribatterli: la
     scheda li mostra, la reception li guarda e li salva. Non si salva
     niente da qui: e' una lettura. */
  if (azione === 'fidra') {
    const oggi = oggiRoma();
    const da = url.searchParams.get('da') || oggi;
    let a = url.searchParams.get('fino') || '';
    if (!dataValida(da)) return risposta({ errore: 'data non valida' }, 400);
    if (!dataValida(a)) { a = da; for (let i = 0; i < 13; i++) a = giornoDopo(a); }
    let grezzo: unknown = null;
    try {
      const r = await fetch(URL_FIDRA(da, a), { headers: { 'user-agent': 'Mozilla/5.0 (compatible; HotelTermeLeonardo back office)' } });
      grezzo = r.ok ? await r.json() : null;
      if (!r.ok) console.error('Fidra availability ha risposto', r.status);
    } catch (e) {
      console.error('Fidra availability non raggiungibile', e);
    }
    if (grezzo === null) return risposta({ errore: 'il sito precedente non risponde' }, 502);
    const { data: nostre } = await db.from('dayspa_giorno').select('giorno, fascia, venduti').gte('giorno', da).lte('giorno', a);
    const venduti = (giorno: string, fascia: string) =>
      (nostre ?? []).find((r) => r.giorno === giorno && r.fascia === fascia)?.venduti ?? 0;
    return risposta({ esito: 'ok', da, fino: a, righe: righeDaFidra(grezzo, venduti) });
  }

  if (azione === 'rimborsa') {
    if (req.method !== 'POST') return risposta({ errore: 'metodo non ammesso' }, 405);
    if (!accesso.chiave && !puoRimborsare(accesso.ruolo)) return risposta({ errore: 'il rimborso e della reception' }, 403);
    const b = await req.json().catch(() => ({})) as Record<string, unknown>;
    const numero = String(b.numero ?? '').trim();
    const { data: p } = await db.from('dayspa_prenotazione').select('numero, stato, giorno, fascia, persone, stripe_pagamento, importo_cent, prova').eq('numero', numero).maybeSingle();
    if (!p) return risposta({ errore: 'prenotazione non trovata' }, 404);
    if (p.stato !== 'pagata') return risposta({ errore: `la prenotazione e ${p.stato}: si rimborsa solo una pagata` }, 409);
    if (!p.stripe_pagamento) return risposta({ errore: 'nessun pagamento Stripe collegato' }, 409);
    try {
      await stripe('/refunds', { payment_intent: p.stripe_pagamento });
    } catch (e) {
      return risposta({ errore: 'Stripe non ha rimborsato: ' + String(e).slice(0, 200) }, 502);
    }
    await db.from('dayspa_prenotazione').update({ stato: 'rimborsata', annullato_il: new Date().toISOString(), note: String(b.motivo ?? '').slice(0, 200) || null }).eq('numero', numero);
    await db.rpc('dayspa_libera_posti', { p_giorno: p.giorno, p_fascia: p.fascia, p_n: p.persone });
    return risposta({ esito: 'ok', numero, rimborsato_cent: p.importo_cent });
  }

  return risposta({ errore: 'azione sconosciuta' }, 404);
});
