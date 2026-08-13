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
import { validaRichiesta } from './valida.ts';
import { avvisaHotel } from './email-richiesta.ts';

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

    const { errore, dati } = validaRichiesta(corpo);
    if (errore || !dati) return risposta({ errore }, 400);

    const ip = indirizzo(req);
    if (await troppeRichieste(dati.email, ip)) {
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
      ...dati,
      origine: String(corpo.origine || '').slice(0, 200) || null,
      ip,
    });
    if (eIns) {
      console.error('inserimento fallito:', eIns);
      return risposta({ errore: 'salvataggio non riuscito' }, 500);
    }

    /* l'avviso e' un di piu': se non parte, la richiesta e' comunque
       salvata e si ritrova nell'elenco del back office */
    const avvisato = await avvisaHotel({ ...dati, numero: n.numero });
    return risposta({ ok: true, numero: n.numero, avviso: avvisato });
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
