/* ============================================================
   richieste — le richieste di preventivo dal sito nuovo.

   Nasce per un motivo preciso: il form del sito apriva un `mailto:` e
   dichiarava "inviato" comunque, senza guardare se fosse successo qualcosa.
   Su un telefono senza posta configurata non partiva niente e l'ospite se
   ne andava convinto di aver scritto. Ora la richiesta finisce a database
   PRIMA di dire qualsiasi cosa, e solo dopo parte l'avviso all'hotel.

   Pubblico (POST senza azione):  nuova richiesta
   Back office (x-hotel-key):     a=elenco · a=stato
   ============================================================ */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { validaContatti, validaRichiesta } from './valida.ts';
import { validaDati } from './tipi.ts';
import { avvisaHotel } from './email-richiesta.ts';
import { inviaConferma } from './conferma.ts';
import { componiRisposta } from './disponibilita.ts';

const testo = (v: unknown) => String(v ?? '').trim();

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, authorization, x-hotel-key',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const db = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const risposta = (corpo: unknown, stato = 200) =>
  new Response(JSON.stringify(corpo), {
    status: stato,
    headers: { ...CORS, 'content-type': 'application/json' },
  });

function indirizzo(req: Request): string {
  const f = req.headers.get('x-forwarded-for') || '';
  return f.split(',')[0].trim() || 'sconosciuto';
}

async function autorizzato(req: Request): Promise<boolean> {
  const attesa = Deno.env.get('HOTEL_KEY');
  if (attesa && req.headers.get('x-hotel-key') === attesa) return true;
  const auth = req.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return false;
  const { data } = await db.auth.getUser(token);
  return !!data?.user;
}

/* Un tetto sulle mezz'ore, non sui secondi: un limite in memoria non
   funziona, perche' ogni richiesta puo' toccare un'istanza diversa della
   funzione e il contatore riparte da zero. Questo invece conta a database,
   dove il numero e' uno solo. In caso di errore si lascia passare: meglio
   una richiesta di troppo che una richiesta persa. */
const TETTO_PERSONA = 3;
const TETTO_TOTALE = 20;

async function troppeRichieste(email: string, ip: string): Promise<boolean> {
  const da = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  try {
    const { count: totale } = await db.from('richiesta_sito')
      .select('id', { count: 'exact', head: true }).gte('creato_il', da);
    if ((totale ?? 0) >= TETTO_TOTALE) return true;

    const { count: sue } = await db.from('richiesta_sito')
      .select('id', { count: 'exact', head: true })
      .gte('creato_il', da).or(`email.eq.${email},ip.eq.${ip}`);
    return (sue ?? 0) >= TETTO_PERSONA;
  } catch (e) {
    console.error('conteggio limite fallito, lascio passare:', e);
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const url = new URL(req.url);
  const azione = url.searchParams.get('a') || '';

  /* ---------- pubblico: una nuova richiesta ---------- */
  if (!azione) {
    if (req.method !== 'POST') return risposta({ errore: 'metodo non ammesso' }, 405);

    let corpo: Record<string, unknown>;
    try { corpo = await req.json(); }
    catch { return risposta({ errore: 'richiesta illeggibile' }, 400); }

    /* Il tipo decide cosa si valida. Il soggiorno tiene i suoi campi nelle
       colonne della tabella, gli altri tipi nel jsonb `dati`: cosi' un tipo
       nuovo non richiede una migrazione. */
    const tipo = testo(corpo.tipo) || 'soggiorno';
    let contatti: { nome: string; email: string; telefono: string; lingua: string };
    let colonne: Record<string, unknown> = {};
    let propri: Record<string, unknown> | null = null;

    if (tipo === 'soggiorno') {
      const { errore, dati } = validaRichiesta(corpo);
      if (errore || !dati) return risposta({ errore }, 400);
      contatti = { nome: dati.nome, email: dati.email, telefono: dati.telefono, lingua: dati.lingua };
      colonne = dati;
    } else {
      const c = validaContatti(corpo);
      if (c.errore || !c.dati) return risposta({ errore: c.errore }, 400);
      const d = validaDati(tipo, (corpo.dati || {}) as Record<string, unknown>);
      if (d.errore || !d.dati) return risposta({ errore: d.errore }, 400);
      contatti = c.dati;
      colonne = { ...c.dati };
      propri = d.dati;
    }

    const ip = indirizzo(req);
    if (await troppeRichieste(contatti.email, ip)) {
      return risposta({ errore: 'troppe richieste ravvicinate' }, 429);
    }

    const { data: num, error: eNum } = await db.rpc('prossimo_numero_richiesta');
    if (eNum || !num?.[0]) {
      console.error('numerazione fallita:', eNum);
      return risposta({ errore: 'salvataggio non riuscito' }, 500);
    }
    const n = num[0];

    /* prima si salva, poi si parla: se l'inserimento fallisce all'ospite
       si dice che non ha funzionato, e non il contrario come prima */
    const { error: eIns } = await db.from('richiesta_sito').insert({
      anno: n.anno, progressivo: n.progressivo, numero: n.numero,
      tipo,
      ...colonne,
      dati: propri,
      arrivo_token: testo(corpo.token).slice(0, 120) || null,
      origine: String(corpo.origine || '').slice(0, 200) || null,
      ip,
    });
    if (eIns) {
      console.error('inserimento fallito:', eIns);
      return risposta({ errore: 'salvataggio non riuscito' }, 500);
    }

    /* l'avviso e' un di piu': se non parte, la richiesta e' comunque
       salvata e si ritrova nell'elenco del back office */
    const avvisato = await avvisaHotel({ ...contatti, ...colonne, ...(propri || {}), tipo, numero: n.numero });
    return risposta({ ok: true, numero: n.numero, avviso: avvisato });
  }

  /* ---------- pubblico: precompilazione da un link della nostra email ----------
     L'ospite che arriva da una nostra email porta un token: nome, contatti e
     periodo di soggiorno li sappiamo gia' e non ha senso richiederglieli.
     Un token inventato o scaduto NON blocca niente: si ricade sul modulo
     vuoto, che e' il caso normale di chi arriva dal sito. */
  if (azione === 'precompila') {
    const t = testo(url.searchParams.get('t'));
    if (!t) return risposta({ ok: true, noto: false });
    const { data, error } = await db.from('arrivo_link')
      .select('intestatario, email, lingua, data_arrivo, data_partenza, adulti, bambini, numero_pratica, scade_il')
      .eq('token', t).maybeSingle();
    if (error) {
      console.error('lettura token fallita:', error);
      return risposta({ ok: true, noto: false });
    }
    if (!data) return risposta({ ok: true, noto: false });
    if (data.scade_il && new Date(data.scade_il).getTime() < Date.now()) {
      return risposta({ ok: true, noto: false, scaduto: true });
    }
    return risposta({
      ok: true, noto: true,
      ospite: {
        nome: data.intestatario, email: data.email, lingua: data.lingua,
        arrivo: data.data_arrivo, partenza: data.data_partenza,
        adulti: data.adulti, bambini: data.bambini, pratica: data.numero_pratica,
      },
    });
  }

  /* ---------- pubblico: disponibilita' camere ----------
     La pagina non deve conoscere la chiave del proxy: e' questa funzione
     che chiama check-availability con PROXY_KEY dal proprio ambiente. */
  if (azione === 'disponibilita') {
    const b = await req.json().catch(() => ({}));
    const lingua = ['it', 'de', 'en', 'fr'].includes(String(b?.lingua)) ? String(b.lingua) : 'it';
    const adulti = Number(b?.adulti) || 2;
    const r = await fetch(
      Deno.env.get('SUPABASE_URL') + '/functions/v1/check-availability',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-proxy-key': Deno.env.get('PROXY_KEY') ?? '',
        },
        body: JSON.stringify({
          from_date: b?.check_in, to_date: b?.check_out,
          adults: adulti,
          ...(b?.bambini ? { children: Number(b.bambini) } : {}),
          ...(Array.isArray(b?.eta_bambini) ? { children_ages: b.eta_bambini } : {}),
        }),
      },
    );
    if (!r.ok) {
      return risposta({ esito: 'errore', errore: 'disponibilita non raggiungibile' }, 502);
    }
    return risposta(componiRisposta(await r.json(), adulti, lingua));
  }

  /* ---------- riservati al back office ---------- */
  if (!await autorizzato(req)) return risposta({ errore: 'non autorizzato' }, 401);

  if (azione === 'elenco') {
    const stato = url.searchParams.get('stato') || '';
    let q = db.from('richiesta_sito').select('*').order('creato_il', { ascending: false }).limit(200);
    if (stato) q = q.eq('stato', stato);
    const { data, error } = await q;
    if (error) return risposta({ errore: error.message }, 500);
    return risposta({ ok: true, richieste: data });
  }

  /* ---------- conferma all'ospite ----------
     La reception puo' correggere prima di confermare — un orario spostato,
     un luogo diverso — e l'ospite riceve i dati DEFINITIVI, non quelli che
     aveva chiesto. Le correzioni passano dalla stessa validazione della
     richiesta: non ha senso essere severi col cliente e permissivi con noi. */
  if (azione === 'conferma') {
    if (req.method !== 'POST') return risposta({ errore: 'metodo non ammesso' }, 405);
    const b = await req.json().catch(() => ({})) as Record<string, unknown>;
    const numero = testo(b.numero);
    if (!numero) return risposta({ errore: 'numero mancante' }, 400);

    const { data: r, error: eSel } = await db.from('richiesta_sito')
      .select('*').eq('numero', numero).maybeSingle();
    if (eSel) return risposta({ errore: eSel.message }, 500);
    if (!r) return risposta({ errore: 'richiesta non trovata' }, 404);

    /* se arrivano correzioni si rivalidano; se non arrivano si conferma
       quello che c'e' gia' */
    let dati = r.dati;
    if (b.dati && typeof b.dati === 'object') {
      const v = validaDati(r.tipo, b.dati as Record<string, unknown>);
      if (v.errore || !v.dati) return risposta({ errore: v.errore }, 400);
      dati = v.dati;
    }

    const messaggio = testo(b.messaggio).slice(0, 2000);
    const esito = await inviaConferma({
      numero: r.numero, tipo: r.tipo, nome: r.nome, email: r.email,
      lingua: r.lingua, dati, messaggio,
    });

    const { error: eUp } = await db.from('richiesta_sito').update({
      dati,
      stato: 'risposta',
      conferma_il: new Date().toISOString(),
      conferma_da: testo(b.utente).slice(0, 120) || null,
      conferma_testo: messaggio || null,
      /* se l'email non e' partita deve restare scritto: altrimenti la
         richiesta risulta "risposta" e l'ospite non sa niente */
      conferma_esito: esito ? 'inviata' : 'fallita',
    }).eq('numero', numero);
    if (eUp) return risposta({ errore: eUp.message }, 500);

    return risposta({ ok: true, inviata: esito, dati });
  }

  if (azione === 'stato') {
    if (req.method !== 'POST') return risposta({ errore: 'metodo non ammesso' }, 405);
    const b = await req.json().catch(() => ({})) as Record<string, unknown>;
    const numero = String(b.numero || '');
    const nuovo = String(b.stato || '');
    if (!numero) return risposta({ errore: 'numero mancante' }, 400);
    if (!['nuova', 'vista', 'risposta', 'chiusa'].includes(nuovo)) {
      return risposta({ errore: 'stato sconosciuto' }, 400);
    }
    const { error } = await db.from('richiesta_sito').update({
      stato: nuovo,
      gestita_il: new Date().toISOString(),
      gestita_da: String(b.utente || '').slice(0, 120) || null,
      note: b.note == null ? undefined : String(b.note).slice(0, 2000),
    }).eq('numero', numero);
    if (error) return risposta({ errore: error.message }, 500);
    return risposta({ ok: true });
  }

  return risposta({ errore: 'azione sconosciuta' }, 404);
});
