// ============================================================
//  Prepara il tuo arrivo — Edge Function
//  Deploy:  supabase functions deploy prepara-arrivo --no-verify-jwt
//
//  Due azioni:
//    POST ?action=crea      (interna, richiede x-hotel-key) → crea il link
//    GET  ?token=...                                       → dati del soggiorno
//
//  IL SALVATAGGIO DELLA RICHIESTA NON E' PIU' QUI: e' passato alla funzione
//  richieste, azione ?a=invia-arrivo (Task 8 del giro "strada unica") — la'
//  nasce una richiesta vera, con numero, ricevuta, prezzo e conferma, non
//  una riga in una tabella che nessuna schermata leggeva. Questa funzione
//  resta responsabile solo del link: crearlo e leggerlo.
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CHIAVE_INTERNA = Deno.env.get('HOTEL_KEY')!;        // segreto condiviso con l'estensione
const BASE_PAGINA    = Deno.env.get('BASE_PAGINA') ?? 'https://www.hoteltermeleonardo.com/arrivo';

const db = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-hotel-key',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

const risposta = (dati: unknown, stato = 200) =>
  new Response(JSON.stringify(dati), {
    status: stato,
    headers: { ...CORS, 'Content-Type': 'application/json' }
  });

/* token opaco, 32 byte casuali in base64url */
function nuovoToken(): string {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...b))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/* --- pulizia dell'input: niente stringhe infinite nel database --- */
const testo = (v: unknown, max = 200) =>
  typeof v === 'string' ? v.trim().slice(0, max) || null : null;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const url    = new URL(req.url);
  const azione = url.searchParams.get('action');
  const token  = url.searchParams.get('token');

  try {
    // ---------- 1. CREAZIONE DEL LINK (solo interna) ----------
    if (req.method === 'POST' && azione === 'crea') {
      if (req.headers.get('x-hotel-key') !== CHIAVE_INTERNA) {
        return risposta({ errore: 'non autorizzato' }, 401);
      }
      const b = await req.json();
      for (const campo of ['reservation_id', 'intestatario', 'data_arrivo', 'data_partenza']) {
        if (!b[campo]) return risposta({ errore: `manca ${campo}` }, 400);
      }

      const t = nuovoToken();
      // il link resta valido fino a mezzanotte del giorno di partenza
      const scade = new Date(b.data_partenza + 'T23:59:59Z');

      const { error } = await db.from('arrivo_link').insert({
        token: t,
        reservation_id: String(b.reservation_id),
        numero_pratica: testo(b.numero_pratica, 40),
        intestatario:   testo(b.intestatario, 120),
        email:          testo(b.email, 160),
        lingua:         ['it','de','en','fr'].includes(b.lingua) ? b.lingua : 'it',
        data_arrivo:    b.data_arrivo,
        data_partenza:  b.data_partenza,
        adulti:         Number(b.adulti)  || 1,
        bambini:        Number(b.bambini) || 0,
        /* Lo sappiamo NOI, non l'ospite: ?action=crea riceve date e ospiti
           ma non il trattamento. Il dato ce l'ha gia' l'estensione
           (deduci(d).cure in popup.js, la stessa regola che decide se
           mettere il blocco «cure termali» nell'email) e da qui in poi lo
           passa. Serve a mostrare la domanda sui fanghi solo a chi le cure
           le fa davvero: a chi viene per due notti di relax sarebbe rumore. */
        cure:           b.cure === true,
        scade_il:       scade.toISOString()
      });
      if (error) return risposta({ errore: error.message }, 500);

      return risposta({ url: `${BASE_PAGINA}/?t=${t}` });
    }

    if (!token) return risposta({ errore: 'token mancante' }, 400);

    const { data: link } = await db
      .from('arrivo_link').select('*').eq('token', token).maybeSingle();

    if (!link) return risposta({ errore: 'link non valido' }, 404);
    if (new Date(link.scade_il) < new Date()) {
      return risposta({ errore: 'scaduto' }, 410);
    }

    // ---------- 2. DATI DEL SOGGIORNO ----------
    // Si restituisce il minimo indispensabile: mai email o id interni.
    if (req.method === 'GET') {
      return risposta({
        intestatario:  link.intestatario,
        numero:        link.numero_pratica,
        lingua:        link.lingua,
        data_arrivo:   link.data_arrivo,
        data_partenza: link.data_partenza,
        adulti:        link.adulti,
        bambini:       link.bambini,
        cure:          link.cure === true
      });
    }

    return risposta({ errore: 'metodo non consentito' }, 405);

  } catch (e) {
    return risposta({ errore: String(e) }, 500);
  }
});
