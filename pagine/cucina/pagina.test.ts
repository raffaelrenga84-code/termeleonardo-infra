/* ============================================================
   pagina.test.ts — lo schermo di cucina, letto dal sorgente.

   La pagina appesa in cucina non si prova con un browser dentro le prove:
   si controlla che ci sia tutto quello che la fa funzionare da sola per
   ore — le azioni del contratto con la chiave dello schermo, il giro ogni
   tre secondi, lo schermo che non si spegne, il suono della comanda nuova,
   i conti presi dal modulo puro e non riscritti a mano — e che niente di
   quello che arriva dalla rete finisca dentro l'HTML senza passare da esc.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';

const P = Deno.readTextFileSync(new URL('./index.html', import.meta.url));
const m = (P.match(/<script type="module">([\s\S]*?)<\/script>/) ?? ['', ''])[1];

Deno.test('riservata, in italiano, e i moduli con percorso assoluto', () => {
  assert(/<meta name="robots" content="noindex, nofollow"/.test(P), 'uno schermo di servizio non va nei motori');
  assert(/<html lang="it">/.test(P));
  /* la pagina e' servita anche come /cucina SENZA barra (PC del Bistrot e
     riscrittura del sito): un «./schermo.js» li' diventerebbe /schermo.js */
  assert(m.includes("from '/cucina/schermo.js'"), 'il modulo puro con percorso assoluto');
  assert(m.includes("from '/pos/server.js'"), 'la scelta del server e quella del palmare');
  assert(m.includes('creaServer({'), 'il server non si sceglie a mano');
  assertEquals(P.match(/<script/g)?.length, 1, 'un solo copione, tutto dentro la pagina');
  assert(!/src=["']http/.test(P) && !/<link rel="stylesheet"/.test(P), 'nessuna libreria e nessun foglio di stile di fuori');
});

Deno.test('le due azioni del contratto, con la chiave dello schermo e la postazione', () => {
  assert(m.includes("'x-schermo-chiave': P.k"), 'la chiave viaggia nell intestazione, non nell indirizzo');
  assert(m.includes("chiama('schermo')"), 'il giro chiede ?a=schermo');
  assert(m.includes("chiama('schermo-stato'"), 'i passi vanno su ?a=schermo-stato');
  assert(/\?a=\$\{azione\}\$\{qs\}/.test(m), 'azione e postazione nell indirizzo');
  assert(m.includes('&locale=${encodeURIComponent(P.l)}&stampante=${encodeURIComponent(P.s)}'));
  assert(m.includes('JSON.stringify({ id, passo: quale })'), 'il corpo del passo e { id, passo }');
  assert(m.includes('data-p="presa"') && m.includes('data-p="pronta"'), 'i due tasti della scheda mandano i passi presa e pronta');
  assert(m.includes("passo(r.dataset.r, 'riapri')"), 'il tasto della striscia manda riapri');
});

Deno.test('il giro ogni tre secondi, uno alla volta', () => {
  assert(m.includes('const GIRO_MS = 3000;'), 'tre secondi, come dice il piano');
  assert(m.includes('setInterval(giro, GIRO_MS)'));
  assert(m.includes('if (INGIRO || !P) return;'), 'un server lento non deve accavallare le richieste');
});

Deno.test('la chiave dall indirizzo si salva e l indirizzo si pulisce', () => {
  assert(m.includes("localStorage.setItem('cucinaPostazione'"), 'la postazione resta sullo schermo');
  assert(m.includes("history.replaceState(null, '', location.pathname)"), 'la chiave non resta scritta sulla barra');
  assert(m.includes('Manca la chiave: aprire il link dato dal back office'));
});

Deno.test('lo schermo resta acceso, e il suono nasce dal primo tocco', () => {
  assert(m.includes("navigator.wakeLock?.request('screen')"), 'una TV che si spegne a meta servizio perde biglietti');
  assert(m.includes("document.addEventListener('visibilitychange'"), 'il permesso decade: si richiede al ritorno');
  assert(m.includes('window.AudioContext || window.webkitAudioContext'), 'senza un gesto il browser non lascia suonare');
  assert(m.includes('o.frequency.value = 880;') && m.includes('AUDIO.currentTime + 0.15'), 'un fischio corto: 880 Hz per 150 ms');
  assert(m.includes('TESTI.inizia'), 'la schermata iniziale prende il testo dal modulo');
  assert(m.includes('nuovi(VISTI, ids).length) suona()'), 'suona solo per le comande arrivate adesso');
  assert(m.includes('if (!PRIMO &&'), 'al primo giro non si suona: sarebbero tutte nuove');
});

Deno.test('i conti li fa il modulo puro: la pagina non li riscrive', () => {
  for (const f of ['colorePerAttesa(', 'minutiDa(', 'nuovi(', 'ordina(', 'resa(', 'tastoPer(']) {
    assert(m.includes(f), `la pagina non usa ${f}`);
  }
  assert(m.includes('SCARTO = d.adesso'), 'i minuti si contano sull orologio del server');
  assert(!/\/ 60000/.test(m), 'i minuti non si ricalcolano a mano nella pagina');
});

Deno.test('la tastiera e i tasti della scheda', () => {
  assert(m.includes("document.addEventListener('keydown'"));
  assert(m.includes("if (a.azione === 'scegli')") && m.includes("if (a.azione === 'riapri')"));
  assert(m.includes('LISTA.find((x) => x.id === SCELTA) || LISTA[0]'), 'senza scelta si agisce sulla prima');
  assert(m.includes('TESTI.presa') && m.includes('TESTI.pronta') && m.includes('TESTI.riapri'));
  assert(m.includes("${presa ? '' : `<button class=\"tasto sec\" data-p=\"presa\">"), 'presa gia fatta: il tasto sparisce');
});

Deno.test('le ultime pronte in fondo, cinque, e il ripensamento', () => {
  assert(m.includes('const QUANTE_PRONTE = 5;'));
  assert(m.includes('.slice(0, QUANTE_PRONTE)'));
  assert(m.includes('TESTI.ultime'));
  assert(m.includes("passo(ULTIME[0].id, 'riapri')"), 'Backspace riapre l ultima pronta');
});

Deno.test('gli errori del server: 401 ferma tutto, gli altri passano e vanno via da soli', () => {
  assert(m.includes('Schermo non riconosciuto: chiedere un link nuovo dal back office'));
  assert((m.match(/e\.stato === 401/g) ?? []).length === 2, 'il 401 si guarda nel giro e nel passo');
  assert(m.includes('clearInterval(TIMER)'), 'schermo non riconosciuto: si smette di chiedere');
  assert(/setTimeout\(\(\) => \{ m\.hidden = true; \}, 3000\)/.test(m), 'un messaggio dura tre secondi');
  assert(m.includes('stampa fallita'), 'un biglietto in errore lo dice, piano');
});

Deno.test('la rete che cade: si passa al cloud e si ritenta una volta, e la spia lo dice', () => {
  assert(m.includes("if (server.stato() === 'locale') { server.localeCaduto(); return chiama(azione, opz); }"));
  assert(m.includes('TESTI.pc') && m.includes('TESTI.cloud') && m.includes('TESTI.senzaRete'));
  assert(m.includes('ULTIMO_GIRO ?'), 'la spia porta anche l ora dell ultimo giro riuscito');
  assert(m.includes("const DAL_PC = location.protocol === 'http:' && /^\\d+\\.\\d+\\.\\d+\\.\\d+$/.test(location.hostname);"), 'stessa regola del palmare');
  assert(m.includes("ping: (u) => fetch(u + '?a=stato-locale'"), 'lo stesso ping del palmare');
});

Deno.test('niente di quello che arriva dalla rete entra come HTML', () => {
  assert(/const esc = \(s\) =>/.test(m));
  /* ogni campo che arriva dal server e finisce in un modello HTML deve
     passare da esc: un nome di piatto con una parentesi angolata non deve
     poter chiudere un tag */
  const CAMPI = ['tavolo', 'testo', 'nome', 'variante', 'nota', 'tipo', 'avviso', 'portareA', 'noteVitto', 'quantita', 'portata', 'cameriere'];
  const dentro = [...m.matchAll(/\$\{([^}]*)\}/g)].map((x) => x[1].trim());
  const sospetti = dentro.filter((x) => CAMPI.some((c) => new RegExp(`\\.${c}\\b`).test(x)) && !x.includes('esc('));
  assertEquals(sospetti, [], 'un valore del server finisce nell HTML senza esc');
  assert(m.includes("data-id=\"${esc(s.id)}\"") && m.includes("data-r=\"${esc(u.id)}\""), 'anche gli id passano da esc');
  assert(m.includes(".map(esc).join(' · ')"), 'anche portata, ora e cameriere passano da esc');
  assert(m.includes("$('nome').textContent = d.postazione.nome"), 'il nome della postazione entra come testo, non come HTML');
});

Deno.test('lo stile: sfondo scuro, caratteri grandi, una colonna sul tablet stretto', () => {
  assert(P.includes('background:#101814'), 'lo sfondo scuro chiesto per una TV sempre accesa');
  assert(P.includes('grid-template-columns:repeat(auto-fill, minmax(300px, 1fr))'));
  assert(/@media \(max-width: 700px\)\{[\s\S]*?main\.griglia\{grid-template-columns:1fr;\}/.test(P), 'sotto i 700px una colonna sola');
  const misura = (regola: string) => Number((P.match(new RegExp(regola))  ?? ['', '0'])[1]);
  assert(misura('\\.tavolo\\{flex:1;font-size:(\\d+)px') >= 34, 'il tavolo si legge da due metri');
  assert(misura('\\.righe li\\{font-size:(\\d+)px') >= 22, 'le righe della comanda si leggono da due metri');
  for (const c of ['.scheda.verde', '.scheda.giallo', '.scheda.rosso']) assert(P.includes(c), `manca il colore ${c}`);
});

Deno.test('niente Fidra: lo schermo parla solo col nostro server', () => {
  assert(!/fidra/i.test(P));
  /* le stampanti fiscali non compaiono mai nel codice (vincolo del piano) */
  assert(!/192\.168\.0\.5[12]/.test(P) && !/898[89]|8990/.test(P));
});
