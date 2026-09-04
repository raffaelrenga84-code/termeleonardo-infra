/* ============================================================
   pagina.test.ts — la pagina del cameriere, letta dal sorgente.

   Tre schermate (sala, tavolo, ordine), un accesso col PIN, le azioni
   del contratto, la scelta del server e la coda offline dai moduli puri.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';

const P = Deno.readTextFileSync(new URL('./index.html', import.meta.url));
const m = (P.match(/<script type="module">([\s\S]*?)<\/script>/) ?? ['', ''])[1];

Deno.test('riservata, installabile, moduli con percorso assoluto', () => {
  assert(/<meta name="robots" content="noindex, nofollow"/.test(P));
  assert(P.includes('href="/pos/manifest.webmanifest"') && m.includes("serviceWorker.register('/pos/sw.js'"));
  assert(m.includes("from '/pos/stato.js'") && m.includes("from '/pos/server.js'"));
  const man = JSON.parse(Deno.readTextFileSync(new URL('./manifest.webmanifest', import.meta.url))) as Record<string, unknown>;
  /* sul sito l indirizzo e /pos senza barra (Vercel la toglie): l app
     installata deve coprire anche quello, quindi scope alla radice */
  assertEquals(man.start_url, '/pos');
  assertEquals(man.scope, '/');
  assertEquals(man.display, 'fullscreen');
  const sw = Deno.readTextFileSync(new URL('./sw.js', import.meta.url));
  assert(sw.includes("'/pos'") && !sw.includes("'/pos/'"), 'in cache va /pos: /pos/ sul sito e un rimando, e un rimando dalla cache non apre la pagina');
  assert(m.includes("scope: '/pos'"), 'il service worker copre /pos, non solo /pos/');
});

Deno.test('le tre schermate e i gesti della spec', () => {
  for (const f of ['function schermataSala(', 'function schermataTavolo(', 'function schermataOrdine(', 'function accesso(']) assert(m.includes(f), f);
  assert(m.includes("'x-pos-sessione'") && m.includes("'x-pos-dispositivo'"));
  for (const a of ['accesso', 'menu', 'sala', 'conto', 'righe', 'invia', 'vai', 'storna', 'chiudi']) assert(m.includes(`'${a}'`), `azione ${a}`);
  assert(m.includes('Vai coi') || m.includes('Vai con'), 'il pulsante dice cosa parte');
  assert(m.includes('preferiti') && m.includes('ultimi') && m.includes('cerca'), 'preferiti, ultimi del tavolo, ricerca');
  assert(m.includes('toccoLungo('), 'tocco lungo sulla riga');
  assert(m.includes('USCITA_DOPO_MS'), 'uscita automatica dopo inattivita');
  assert(m.includes("get('d')"), 'il token del palmare si puo dare una volta dall indirizzo (?d=)');
  assert(m.includes('id="dispositivoCodice"') && m.includes("localStorage.setItem('posDispositivo'"), 'o si scrive sul palmare stesso, nella schermata «non registrato»');
  /* col codice sbagliato si resterebbe chiusi fuori: dalla schermata
     dell accesso si deve poter rimettere (4 settembre 2026) */
  assert(m.includes("localStorage.removeItem('posDispositivo')"), 'e si puo cambiare se non va piu bene');
});

Deno.test('si entra col solo codice: il PIN lo chiede il server, e solo a chi ce l ha', () => {
  assert(m.includes('const entra = async'), 'un solo gesto: codice e invio');
  assert(m.includes("/serve il PIN/i.test(e.message)"), 'il PIN si chiede solo se il server lo dice');
  assert(!m.includes("if (campo === 'codice') { if (codice) campo = 'pin'; return disegna(); }"), 'il passaggio al PIN non e piu automatico');
});

Deno.test('il palmare non decide prezzi: manda articolo, quantita, variante, nota, portata e al massimo un prezzo manuale', () => {
  const inizio = m.indexOf('const invia = async');
  assert(inizio > 0, 'la funzione invia');
  const righe = m.slice(inizio, inizio + 900);
  assert(righe.includes('prezzo_manuale_cent') && !righe.includes('prezzo_listino_cent'), 'il listino lo sa il server');
});

Deno.test('niente stampanti fiscali, niente chiave hotel nella pagina', () => {
  assert(!/8989|8990|x-hotel-key|HOTEL_KEY|192\.168\.0\.5[12]/.test(P));
});
