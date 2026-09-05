/* ============================================================
   main.ts - il server del POS sul PC del Bistrot.

   Avvio:  deno run --allow-net --allow-read --allow-write --allow-env main.ts [config.json]
   (o l'eseguibile fatto da installa.cmd, come attivita' pianificata).

   Serve ai palmari lo stesso contratto del cloud (azioni.ts), sulla LAN,
   e serve anche LA PAGINA del POS (config.pagina): i palmari la aprono
   da http://IP:8080/pos, cosi' parlano con questo PC senza certificati
   da installare (5 settembre 2026; l'HTTPS con la CA di certificati.md
   resta possibile mettendo cert e chiave nel config). Ogni 2 s
   stampa cio' che aspetta, ogni 5 s manda al cloud cio' che e' nato qui e
   dice «sono vivo», ogni 60 s prende dal cloud menu', tavoli e personale.
   Se internet manca, il servizio in sala continua uguale: il cloud si
   aggiorna quando torna la linea.
   ============================================================ */
import { apri, creaSchema } from './db.ts';
import { esegui } from './azioni.ts';
import { giroStampe, type Stampanti, stampantiDi } from './stampa.ts';
import { battito, giu, su } from './allinea.ts';
import { fileDellaPagina } from './pagina.ts';

type Config = {
  locale: string; porta?: number; cert?: string; chiave?: string; db?: string; pagina?: string;
  cloud: string; hotelKey: string; stampanti: Stampanti;
};

const percorsoCfg = Deno.args[0] || 'config.json';
const cfg = JSON.parse(await Deno.readTextFile(percorsoCfg)) as Config;
if (!cfg.locale || !cfg.cloud || !cfg.hotelKey) throw new Error('config.json: servono locale, cloud e hotelKey');

const db = apri(cfg.db || 'pos.sqlite');
creaSchema(db);
const cloud = { base: cfg.cloud, hotelKey: cfg.hotelKey, locale: cfg.locale };
const log = (m: string) => console.log(new Date().toISOString().slice(11, 19), m);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-pos-dispositivo, x-pos-sessione',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

async function gestisci(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  const url = new URL(req.url);
  /* la pagina del POS, da qui: solo i suoi file (pagina.ts), mai il resto
     del disco; senza cache, cosi' un aggiornamento arriva al primo giro */
  if (req.method === 'GET' && !url.searchParams.has('a') && cfg.pagina) {
    const f = fileDellaPagina(url.pathname);
    if (!f) return new Response('non trovato', { status: 404 });
    try {
      const dati = await Deno.readFile(`${cfg.pagina}/${f.file}`);
      return new Response(dati, { headers: { 'content-type': f.tipo, 'cache-control': 'no-cache' } });
    } catch { return new Response('non trovato', { status: 404 }); }
  }
  const query: Record<string, string> = {};
  url.searchParams.forEach((v, k) => { query[k] = v; });
  const intestazioni: Record<string, string> = {};
  req.headers.forEach((v, k) => { intestazioni[k.toLowerCase()] = v; });
  const corpo = req.method === 'POST' ? await req.json().catch(() => ({})) : null;
  try {
    const r = await esegui(db, query.a || '', { metodo: req.method, query, corpo, intestazioni }, { locale: cfg.locale });
    return new Response(JSON.stringify(r.corpo), { status: r.stato, headers: { ...CORS, 'content-type': 'application/json' } });
  } catch (e) {
    log(`errore in ${query.a}: ${(e as Error).message}`);
    return new Response(JSON.stringify({ errore: 'errore del server locale' }), { status: 500, headers: { ...CORS, 'content-type': 'application/json' } });
  }
}

/* un giro alla volta: se il precedente e' ancora in corso, si salta */
function ogni(ms: number, nome: string, fn: () => Promise<unknown>) {
  let inCorso = false;
  const giro = async () => {
    if (inCorso) return;
    inCorso = true;
    try { await fn(); } catch (e) { log(`${nome}: ${(e as Error).message}`); } finally { inCorso = false; }
  };
  setInterval(giro, ms);
  return giro;
}

const porta = cfg.porta || 8443;
const opzioni = { port: porta, hostname: '0.0.0.0', onListen: () => log(`POS locale «${cfg.locale}» in ascolto sulla porta ${porta}${cfg.cert ? ' (https)' : ' (http, senza certificato)'}`) };
if (cfg.cert && cfg.chiave) {
  Deno.serve({ ...opzioni, cert: await Deno.readTextFile(cfg.cert), key: await Deno.readTextFile(cfg.chiave) }, gestisci);
} else {
  Deno.serve(opzioni, gestisci);
}

/* gli indirizzi delle stampanti li comanda il back office; il config.json
   resta il ripiego per il primo avvio, prima che scenda qualcosa */
ogni(2000, 'stampe', () => giroStampe(db, stampantiDi(db, cfg.locale, cfg.stampanti || {})));
ogni(5000, 'su', async () => { const n = await su(db, cloud); if (n) log(`salite ${n} righe`); await battito(cloud); });
const scendi = ogni(60000, 'giu', () => giu(db, cloud));
await scendi();
