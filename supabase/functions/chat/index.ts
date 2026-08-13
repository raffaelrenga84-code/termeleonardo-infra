/* ============================================================
   chat — l'assistente scritto del sito.

   Il prompt vive nel codice (prompt.ts + kb.ts): per cambiarlo si modifica
   il file e si ripubblica, non si apre nessuna console. Quello che si prova
   nella schermata Chat di xAI non si salva da nessuna parte.

   Pubblico: POST senza azione, chiamato dal widget del sito.
   Back office (x-hotel-key): a=elenco, per leggere le conversazioni.
   ============================================================ */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { REGOLE_CANALE } from './prompt.ts';
import { KNOWLEDGE_BASE } from './kb.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, authorization, x-hotel-key',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const db = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const XAI = 'https://api.x.ai/v1/chat/completions';
const BASE_FUNZIONI = 'https://mvuiuwakuseockotlcnp.supabase.co/functions/v1';

const testo = (v: unknown) => String(v ?? '').trim();
const risposta = (corpo: unknown, stato = 200) =>
  new Response(JSON.stringify(corpo), {
    status: stato,
    headers: { ...CORS, 'content-type': 'application/json' },
  });

function indirizzo(req: Request): string {
  const f = req.headers.get('x-forwarded-for') || '';
  return f.split(',')[0].trim() || 'sconosciuto';
}

/* ---------------- limiti ----------------
   Un endpoint pubblico che chiama un modello a pagamento va protetto: senza
   tetto, una pagina lasciata aperta con uno script addosso costa soldi veri.
   Il conteggio sta a database e non in memoria, perche' la funzione gira su
   istanze diverse e un contatore in memoria non vedrebbe mai niente. */
const MSG_MAX = 1200;          /* un messaggio piu' lungo non e' una domanda */
const STORIA_MAX = 24;         /* turni tenuti: oltre, si taglia il piu' vecchio */
const TETTO_IP_ORA = 40;
const TETTO_TOTALE_ORA = 400;

async function troppoUso(ip: string): Promise<boolean> {
  const da = new Date(Date.now() - 3600_000).toISOString();
  try {
    const { count: totale } = await db.from('chat_messaggio')
      .select('id', { count: 'exact', head: true }).gte('creato_il', da);
    if ((totale ?? 0) >= TETTO_TOTALE_ORA) return true;
    const { count: suo } = await db.from('chat_messaggio')
      .select('id', { count: 'exact', head: true }).gte('creato_il', da).eq('ip', ip);
    return (suo ?? 0) >= TETTO_IP_ORA;
  } catch (e) {
    /* meglio una conversazione di troppo che una conversazione persa */
    console.error('conteggio uso fallito, lascio passare:', e);
    return false;
  }
}

/* ---------------- strumenti ----------------
   Sono SOLO questi due. Le regole di canale ne nominano un terzo per il Day
   Spa, ma in questo progetto non esiste una funzione che interroghi la
   disponibilita' Day Spa: dichiararlo e non averlo farebbe promettere al
   modello una verifica che non puo' fare. Sul Day Spa risponde dalla
   Knowledge Base e manda a prenotare online, che e' comunque la regola. */
const STRUMENTI = [
  {
    type: 'function',
    function: {
      name: 'verifica_camere',
      description: 'Disponibilita e prezzi delle camere per date precise. Verifica soltanto: non prenota. Usare solo dopo che l ospite ha confermato arrivo e partenza.',
      parameters: {
        type: 'object',
        properties: {
          from_date: { type: 'string', description: 'arrivo, AAAA-MM-GG' },
          to_date: { type: 'string', description: 'partenza, AAAA-MM-GG' },
          adults: { type: 'integer', description: 'numero di adulti' },
          children: { type: 'integer', description: 'numero di bambini, 0 se nessuno' },
          children_ages: { type: 'string', description: 'eta dei bambini separate da virgola, es. "4,9". Vuoto se nessun bambino.' },
        },
        required: ['from_date', 'to_date', 'adults'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'invia_richiesta',
      description: 'Registra la richiesta per il reparto competente. Chiamare solo quando si hanno nome e almeno un recapito. Restituisce un numero di riferimento se riuscita.',
      parameters: {
        type: 'object',
        properties: {
          tipo: { type: 'string', enum: ['soggiorno', 'transfer', 'greenfee', 'maestro', 'trattamenti'] },
          nome: { type: 'string' },
          email: { type: 'string', description: 'email dell ospite, se data' },
          telefono: { type: 'string', description: 'telefono dell ospite, se dato' },
          note: { type: 'string', description: 'nota interna per l operatore: dati secchi, date assolute con giorno mese e anno' },
        },
        required: ['tipo', 'nome', 'note'],
      },
    },
  },
];

async function verificaCamere(a: Record<string, unknown>) {
  const chiave = Deno.env.get('PROXY_KEY');
  if (!chiave) return { errore: 'verifica non disponibile' };
  try {
    const r = await fetch(`${BASE_FUNZIONI}/check-availability`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-proxy-key': chiave },
      body: JSON.stringify({
        from_date: testo(a.from_date), to_date: testo(a.to_date),
        adults: Number(a.adults) || 1,
        children: Number(a.children) || 0,
        children_ages: testo(a.children_ages),
      }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      /* un errore tecnico e "nessuna disponibilita" sono due cose diverse, e
         il modello deve poterle distinguere: dirlo esplicitamente */
      return { esito: 'errore_tecnico', dettaglio: j?.error || r.status };
    }
    /* L'unita' va dichiarata qui e non lasciata al prompt. Il proxy
       restituisce la risposta del sito cosi' com'e', e quella e' in
       CENTESIMI: le regole di canale dicono il contrario ("tornano gia' in
       euro"), e su una tariffa la differenza e' di cento volte. Dirlo nel
       risultato dello strumento vince su qualunque riga del prompt, perche'
       arriva insieme ai numeri. */
    return {
      esito: 'ok',
      valuta: 'centesimi',
      istruzione: 'Tutti gli importi sono in CENTESIMI di euro: dividere per 100 prima di comunicarli. 44000 significa 440 euro.',
      dati: j,
    };
  } catch (e) {
    return { esito: 'errore_tecnico', dettaglio: e instanceof Error ? e.message : String(e) };
  }
}

async function inviaRichiesta(a: Record<string, unknown>, ip: string, privacyVista: boolean) {
  if (!privacyVista) return { stato: 'fallita', motivo: 'informativa non mostrata' };
  const nome = testo(a.nome);
  const email = testo(a.email);
  const telefono = testo(a.telefono);
  /* la funzione richieste pretende un'email valida: senza, si registra con
     un segnaposto e il telefono nelle note, invece di perdere la richiesta */
  const emailValida = /.+@.+\..+/.test(email);
  try {
    const r = await fetch(`${BASE_FUNZIONI}/richieste`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        tipo: 'soggiorno',
        nome,
        email: emailValida ? email : 'chat@termeleonardo.com',
        telefono,
        lingua: testo(a.lingua) || 'it',
        privacy_presa_atto: true,
        origine: 'assistente del sito',
        /* la funzione vuole un periodo per il tipo soggiorno: la chat non
           sempre ce l'ha, quindi il contenuto vero va nel messaggio e la
           reception legge quello */
        check_in: new Date().toISOString().slice(0, 10),
        check_out: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
        messaggio: `[${testo(a.tipo) || 'soggiorno'}] ${testo(a.note)}` +
          (emailValida ? '' : `\n(email non fornita in chat; recapito: ${telefono || 'nessuno'})`),
      }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok) {
      console.error('richiesta dalla chat non registrata:', r.status, j);
      return { stato: 'fallita' };
    }
    return { stato: 'registrata', riferimento: j.numero };
  } catch (e) {
    console.error('richiesta dalla chat non registrata:', e);
    return { stato: 'fallita' };
  }
}

/* ---------------- il prompt di sistema ----------------
   La data viene da qui e non dal modello: un modello non sa che giorno e'.
   L'elenco degli strumenti disponibili viene DOPO le regole, cosi' se le
   regole ne nominano uno che non esiste, l'ultima parola e' la realta'. */
function sistema(lingua: string): string {
  const oggi = new Date();
  const GG = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
  const MM = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio',
    'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
  const data = `${GG[oggi.getUTCDay()]} ${oggi.getUTCDate()} ${MM[oggi.getUTCMonth()]} ${oggi.getUTCFullYear()}`;

  return [
    REGOLE_CANALE,
    '',
    '---',
    '',
    KNOWLEDGE_BASE,
    '',
    '---',
    '',
    '# STRUMENTI DISPONIBILI IN QUESTO CANALE',
    '',
    'Questo elenco ha la precedenza su qualunque altro punto del prompt.',
    '',
    '- `verifica_camere` — disponibile.',
    '- `invia_richiesta` — disponibile. Restituisce `stato: "registrata"` e un',
    '  `riferimento` solo se ha funzionato davvero. Se restituisce `fallita`,',
    '  la richiesta NON esiste: e\' vietato dire che l\'hai registrata.',
    '- `verifica_dayspa` — **NON esiste in questo canale.** Non tentare di',
    '  chiamarlo. Sul Day Spa rispondi con i dati della Knowledge Base (orari,',
    '  prezzi, regola dei sette giorni) e manda a prenotare online: e\' comunque',
    '  l\'unico modo per garantire il posto. Non dire mai che una data e\'',
    '  esaurita, perche\' non puoi saperlo.',
    '',
    '# CONTESTO',
    '',
    `Oggi è ${data}. Questa è l'unica fonte valida per qualunque calcolo di date.`,
    `La lingua dell'interfaccia è: ${lingua}.`,
  ].join('\n');
}

/* ---------------- la chiamata al modello ---------------- */
async function chiediAlModello(messaggi: unknown[], strumenti: unknown[]) {
  const chiave = Deno.env.get('XAI_API_KEY');
  if (!chiave) throw new Error('XAI_API_KEY mancante');
  const modello = Deno.env.get('XAI_MODEL') || 'grok-4.6';
  const r = await fetch(XAI, {
    method: 'POST',
    headers: { authorization: `Bearer ${chiave}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: modello, messages: messaggi, tools: strumenti, temperature: 0.3 }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new Error(`xAI ha risposto ${r.status}: ${JSON.stringify(j).slice(0, 300)}`);
  }
  return j;
}

const GIRI_MAX = 4;   /* un modello che continua a chiamare strumenti va fermato */

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const url = new URL(req.url);
  const azione = url.searchParams.get('a') || '';

  /* ---------- back office: leggere le conversazioni ---------- */
  if (azione === 'elenco') {
    const attesa = Deno.env.get('HOTEL_KEY');
    if (!attesa || req.headers.get('x-hotel-key') !== attesa) {
      return risposta({ errore: 'non autorizzato' }, 401);
    }
    const { data, error } = await db.from('chat_messaggio')
      .select('*').order('creato_il', { ascending: false }).limit(200);
    if (error) return risposta({ errore: error.message }, 500);
    return risposta({ ok: true, messaggi: data });
  }

  if (req.method !== 'POST') return risposta({ errore: 'metodo non ammesso' }, 405);

  let corpo: Record<string, unknown>;
  try { corpo = await req.json(); }
  catch { return risposta({ errore: 'richiesta illeggibile' }, 400); }

  const lingua = ['it', 'de', 'en', 'fr'].includes(testo(corpo.lingua)) ? testo(corpo.lingua) : 'it';
  const sessione = testo(corpo.sessione).slice(0, 80) || null;
  const privacyVista = corpo.privacy_vista === true;
  const ip = indirizzo(req);

  const storia = Array.isArray(corpo.messaggi) ? corpo.messaggi : [];
  const ultimo = storia.length ? storia[storia.length - 1] : null;
  const domanda = testo((ultimo as Record<string, unknown> | null)?.testo);
  if (!domanda) return risposta({ errore: 'nessun messaggio' }, 400);
  if (domanda.length > MSG_MAX) return risposta({ errore: 'messaggio troppo lungo' }, 400);

  if (await troppoUso(ip)) {
    return risposta({
      errore: 'troppe richieste',
      risposta: 'Ho ricevuto troppi messaggi in poco tempo. Ci scriva a info@termeleonardo.com oppure chiami la reception allo +39 049 9939200.',
    }, 429);
  }

  /* la storia si taglia dal fondo: le ultime battute contano piu' delle prime */
  const recenti = storia.slice(-STORIA_MAX).map((m) => {
    const x = m as Record<string, unknown>;
    return {
      role: testo(x.ruolo) === 'assistente' ? 'assistant' : 'user',
      content: testo(x.testo).slice(0, MSG_MAX),
    };
  }).filter((m) => m.content);

  const messaggi: Record<string, unknown>[] = [
    { role: 'system', content: sistema(lingua) },
    ...recenti,
  ];

  const usati: string[] = [];
  let testoRisposta = '';
  let riferimento: string | null = null;
  let errore: string | null = null;

  try {
    for (let giro = 0; giro < GIRI_MAX; giro++) {
      const j = await chiediAlModello(messaggi, STRUMENTI);
      const scelta = j?.choices?.[0]?.message;
      if (!scelta) throw new Error('risposta del modello illeggibile');
      messaggi.push(scelta);

      const chiamate = scelta.tool_calls || [];
      if (!chiamate.length) { testoRisposta = testo(scelta.content); break; }

      for (const c of chiamate) {
        const nome = c?.function?.name;
        let args: Record<string, unknown> = {};
        try { args = JSON.parse(c?.function?.arguments || '{}'); } catch { /* argomenti illeggibili */ }
        usati.push(nome);
        let esito: unknown;
        if (nome === 'verifica_camere') esito = await verificaCamere(args);
        else if (nome === 'invia_richiesta') {
          const e = await inviaRichiesta({ ...args, lingua }, ip, privacyVista);
          if (e.stato === 'registrata') riferimento = e.riferimento ?? null;
          esito = e;
        } else esito = { errore: 'strumento non disponibile in questo canale' };
        messaggi.push({ role: 'tool', tool_call_id: c.id, content: JSON.stringify(esito) });
      }
    }
    if (!testoRisposta) {
      testoRisposta = 'Mi scusi, non riesco a completare la risposta. Ci scriva a info@termeleonardo.com o chiami la reception allo +39 049 9939200.';
    }
  } catch (e) {
    errore = e instanceof Error ? e.message : String(e);
    console.error('chat fallita:', errore);
    testoRisposta = 'Mi scusi, in questo momento ho un problema tecnico. Ci scriva a info@termeleonardo.com oppure chiami la reception allo +39 049 9939200.';
  }

  /* si registra sempre, anche gli errori: senza, un problema ricorrente non
     si vedrebbe finche' non lo racconta un ospite */
  try {
    await db.from('chat_messaggio').insert({
      sessione, ip, lingua, domanda, risposta: testoRisposta,
      strumenti: usati.length ? usati : null,
      modello: Deno.env.get('XAI_MODEL') || 'grok-4.6',
      errore,
    });
  } catch (e) { console.error('registrazione della conversazione fallita:', e); }

  return risposta({ ok: !errore, risposta: testoRisposta, riferimento, strumenti: usati });
});
