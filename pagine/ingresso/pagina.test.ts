/* ============================================================
   pagina.test.ts — la pagina dello sportello del Day Spa, letta dal
   sorgente (il DOM in Deno non c'e').

   «Magari conviene fare una pagina dedicata per l'ingresso?» (la
   proprieta', 3 settembre 2026). Si': una pagina sola, per il tablet allo
   sportello, con tre cose e basta — il lettore (a tastiera o fotocamera),
   l'esito grande, gli arrivi del giorno. Stesso accesso del back office,
   stesse azioni del server (?a=oggi, ?a=presenti): niente regole nuove.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';

const P = Deno.readTextFileSync(new URL('./index.html', import.meta.url));
const modulo = () => (P.match(/<script type="module">([\s\S]*?)<\/script>/) ?? ['', ''])[1];

Deno.test('e riservata: noindex, accesso con l utente dell hotel, manifest per installarla come app', () => {
  assert(/<meta name="robots" content="noindex, nofollow"/.test(P));
  assert(/createClient\(/.test(modulo()) && /signInWithPassword\(/.test(modulo()) && /getSession\(/.test(modulo()),
    'l accesso e quello del back office: utente e password dell hotel, sessione che resta');
  /* il manifest lo sceglie uno script nell'intestazione: sportello o totem */
  const testa = P.slice(0, P.indexOf('</head>'));
  assert(testa.includes("'/ingresso/manifest.webmanifest'") && testa.includes("'/ingresso/totem.webmanifest'") && testa.includes('ingresso-totem'),
    'il manifest si sceglie nell intestazione, prima che Chrome lo legga');
  const m = JSON.parse(Deno.readTextFileSync(new URL('./manifest.webmanifest', import.meta.url))) as Record<string, unknown>;
  assertEquals(m.display, 'standalone');
  assertEquals(m.start_url, '/ingresso/');
});

Deno.test('parla solo con la funzione dayspa: oggi e presenti, con il token', () => {
  const m = modulo();
  assert(/functions\/v1\/dayspa/.test(m));
  assert(/a=oggi&giorno=/.test(m) && /a=presenti/.test(m));
  assert(/authorization: 'Bearer ' \+ TOKEN/.test(m), 'ogni chiamata porta il token della sessione');
  assert(!/a=rimborsa|a=disponibilita|a=elenco/.test(m), 'allo sportello non si rimborsa e non si caricano posti');
});

Deno.test('il lettore: campo col fuoco e Invio, fotocamera con BarcodeDetector o jsQR, schermo acceso', () => {
  const m = modulo();
  assert(P.includes('id="codice"') && /\$\('codice'\)\.focus\(\)/.test(m));
  assert(/\.key (===|!==) 'Enter'/.test(m));
  assert(/getUserMedia\(/.test(m) && /BarcodeDetector/.test(m) && /\/comune\/jsqr\.js/.test(m) && /facingMode/.test(m));
  assert(/wakeLock/.test(m));
});

Deno.test('l esito e grande, verde o rosso, e l elenco del giorno permette di segnare i presenti a mano', () => {
  const m = modulo();
  /* la classe e' composta da mostra(classe, …): verde con 'ok', rosso con 'no' */
  assert(/esitoGrande \$\{classe\}/.test(m) && /mostra\('ok'/.test(m) && /mostra\('no'/.test(m));
  assert(/presenti \$\{p\.presenti\} su \$\{p\.persone\}/.test(m), 'l esito dice presenti su persone');
  assert(/non per oggi/.test(m), 'una prenotazione di un altro giorno si vede in rosso');
  assert(/data-segna=/.test(m), 'dall elenco si segnano i presenti a mano, per chi non ha il QR');
  assert(/setInterval\(/.test(m), 'l elenco si aggiorna da solo: due tablet o il PC vedono la stessa cosa');
});

Deno.test('modalita totem: senza accesso, con la chiave del dispositivo, solo il QR, nessun elenco, torna al riposo da sola', () => {
  /* la convalida fai da te in hall, come il totem di Fidra: un campo col
     fuoco per il lettore, un benvenuto grande per qualche secondo, poi di
     nuovo «Appoggi il QR». Il totem e' pubblico: mai l'elenco del giorno. */
  const m = modulo();
  assert(/\.get\('totem'\)/.test(m), 'la modalita totem si accende dall indirizzo, con la chiave');
  assert(/'x-totem-key': TOTEM/.test(m), 'le chiamate del totem portano la chiave del dispositivo, non un token');
  assert(/if \(TOTEM\) \{[\s\S]*?totem\(\);[\s\S]*?return;/.test(m), 'col totem non si chiede l accesso');
  const t = m.slice(m.indexOf('function totem('), m.indexOf('function sportello('));
  assert(t.length > 200, 'la modalita totem e una funzione sua');
  assert(!/a=oggi/.test(t) && !/data-segna/.test(t), 'il totem non legge e non mostra l elenco del giorno');
  assert(/a=presenti/.test(t) && /\{ codice \}|codice:/.test(t), 'il totem manda solo il codice del QR');
  assert(/setTimeout\([^)]*riposo/.test(t) || /riposo\(\)/.test(t), 'dopo il benvenuto si torna al riposo');
  assert(/Benvenut/.test(t), 'al totem si dice benvenuto, non «presenti su persone»');
});

Deno.test('niente da toccare per sbaglio: nessuna barra di schede, nessun link fuori, esci solo con conferma', () => {
  assert(!/class="schede"/.test(P), 'niente schede');
  assert(!/<a href="http/.test(P), 'niente link verso fuori');
  assert(/confirm\(/.test(modulo()), 'uscire chiede conferma');
});

Deno.test('al totem anche i buoni regalo: letto il QR del buono risponde se vale, senza riscuoterlo', () => {
  /* «aggiungi buoni regalo al totem» (la proprieta', 3 settembre 2026, sera).
     Il totem riconosce il codice dal formato (lettura.js), chiede alla
     funzione dei buoni la verifica pubblica e dice «vale / non vale, per
     usarlo alla reception». Riscuotere resta della reception: qui non c'e'. */
  const m = modulo();
  assert(m.includes("from '/ingresso/lettura.js'"), 'il riconoscimento del codice sta in un modulo puro, provato a parte');
  const t = m.slice(m.indexOf('function totem('), m.indexOf('function sportello('));
  assert(t.includes('tipoCodice(') && t.includes('a=verifica') && t.includes('messaggioBuono('),
    'il totem distingue Day Spa e buono e chiede la verifica pubblica del buono');
  assert(!m.includes('a=riscuoti'), 'il totem non riscuote mai un buono');
  const s = m.slice(m.indexOf('function sportello('));
  assert(!s.includes('a=verifica'), 'lo sportello resta quello del Day Spa: i buoni li riscuote il back office');
});

Deno.test('all indirizzo /ingresso-totem la pagina e il totem senza chiave: ci pensa l IP dell hotel', () => {
  const m = modulo();
  assert(m.includes('ingresso-totem'), 'la modalita totem si accende anche dal percorso /ingresso-totem');
  /* servita da un altro percorso, la pagina deve caricare i suoi moduli con
     un indirizzo assoluto: ./lettura.js cadrebbe fuori dalla riscrittura */
  assert(m.includes("from '/ingresso/lettura.js'"), 'lettura.js va importato con il percorso assoluto');
});

Deno.test('al totem anche la tessera della camera: il conto per 60 secondi, poi il riposo', () => {
  const m = modulo();
  const t = m.slice(m.indexOf('function totem('), m.indexOf('function sportello('));
  assert(t.includes("tipo === 'tessera'") && t.includes('a=conto'), 'la tessera chiede il conto alla nostra funzione');
  assert(t.includes('etichetteConto('), 'le parole del conto nella lingua dell ospite');
  assert(t.includes('60'), 'il conto resta 60 secondi, come sul totem di hldv');
  assert(!t.includes('bill-scanner') && !t.includes('fidra.cloud'), 'la pagina non parla con Fidra: parla con la nostra funzione');
});

Deno.test('la schermata di riposo dice anche della tessera della camera, e il campo del lettore non attira i gestori di password', () => {
  /* «fai capire che possono passare anche la tessera camera per vedere il
     conto» (la proprieta', 3 settembre 2026, notte). E sul PC della
     reception il campo nascosto faceva comparire «Password di iCloud». */
  const m = modulo();
  const t = m.slice(m.indexOf('function totem('), m.indexOf('function sportello('));
  assert(t.includes('tessera della camera') && t.includes('room key card') && t.includes('Zimmerkarte') && t.includes('carte de chambre'),
    'la tessera della camera e detta in quattro lingue');
  assert(m.includes('class="carta"'), 'nel disegno c e anche la tessera con il codice a barre');
  assert(t.includes('data-lpignore="true"') && t.includes('data-1p-ignore') && t.includes('type="search"'),
    'il campo del lettore dice ai gestori di password di lasciarlo stare');
});

Deno.test('totem come app a tutto schermo, e un tocco ovunque chiude esito e conto', () => {
  /* «tanti premono la X della scheda di Chrome per chiudere» (la proprieta',
     5 settembre 2026): installata come app col suo manifest non c e piu
     nessuna X; e sul conto e sugli esiti basta toccare lo schermo. */
  const tm = JSON.parse(Deno.readTextFileSync(new URL('./totem.webmanifest', import.meta.url))) as Record<string, unknown>;
  assertEquals(tm.start_url, '/ingresso-totem');
  assertEquals(tm.display, 'fullscreen');
  const m = modulo();
  assert(!m.includes("'/ingresso/totem.webmanifest'"), 'il manifest non si cambia dal modulo: Chrome lo ha gia letto');
  const t = m.slice(m.indexOf('function totem('), m.indexOf('function sportello('));
  assert(t.includes('timerRiposo = setTimeout(riposo'), 'il tempo di chiusura si puo azzerare');
  assert(t.includes('clearTimeout(timerRiposo)') && t.includes('clearInterval(orologioConto)'), 'riposo azzera i tempi');
  assert(t.includes('class="contoChiudi grande"') && t.includes('e.tocca'), 'pulsante grande e «tocchi lo schermo per chiudere»');
});

Deno.test('le icone dei manifest sono PNG veri, 192 e 512: Android non disegna un SVG come icona', () => {
  /* «la app si vede anche poco» (la proprieta', 5 settembre 2026): l icona
     era il logo in SVG e Android mostrava un quadrato vuoto */
  for (const nome of ['manifest.webmanifest', 'totem.webmanifest']) {
    const m = JSON.parse(Deno.readTextFileSync(new URL('./' + nome, import.meta.url))) as { icons: { src: string; sizes: string; type: string; purpose?: string }[] };
    const png = m.icons.filter((i) => i.type === 'image/png');
    assert(png.some((i) => i.sizes === '192x192') && png.some((i) => i.sizes === '512x512'), nome + ': mancano 192 e 512');
    assert(png.some((i) => (i.purpose || '').includes('maskable')), nome + ': una maskable per i telefoni che ritagliano');
    for (const i of png) {
      const f = new URL('.' + i.src.replace('/ingresso', ''), import.meta.url);
      const byte = Deno.readFileSync(f);
      assertEquals([...byte.slice(1, 4)].map((b) => String.fromCharCode(b)).join(''), 'PNG', i.src + ' non e un PNG');
    }
  }
});

Deno.test('il tempo di chiusura del conto si vede: barra rossa in cima che si consuma, secondi grandi che lampeggiano alla fine', () => {
  /* «puoi mettere il timer piu visibile, magari sopra in rosso» (la
     proprieta', 5 settembre 2026) */
  const m = modulo();
  const t = m.slice(m.indexOf('function totem('), m.indexOf('function sportello('));
  const conto = t.slice(t.indexOf('const mostraConto'), t.indexOf('const ALLA_RECEPTION'));
  assert(conto.indexOf('id="contoBarra"') < conto.indexOf('class="totemTitolo"'), 'la barra sta in cima, prima del titolo');
  assert(conto.includes("b.style.width = '0%'"), 'la barra si consuma');
  assert(conto.includes("classList.add('ultimi')"), 'gli ultimi secondi si segnalano');
  assert(P.includes('.contoBarra{') && /\.contoBarra\{[^}]*transition:width 60s linear/.test(P), 'la barra impiega 60 secondi, quanto il conto');
  assert(/\.contoSecondi\{[^}]*var\(--allarme\)/.test(P) && /\.contoBarra\{[^}]*var\(--allarme\)/.test(P), 'in rosso');
});
