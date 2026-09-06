/* ============================================================
   buono-proattivo.test.ts — il modulo si compila da solo dal buono.

   IL DIFETTO CHE PRESIDIA. «Dovrebbe metterlo in automatico in base al
   buono, precompilando anche i nomi... deve essere tutto piu' proattivo»
   (la proprieta', 5 settembre 2026). Il buono arrivava gia' verificato
   (BUONO) e le sue voci gia' spuntavano i trattamenti, ma il campo Persone
   del Day Spa restava a 1 e il campo Nome restava vuoto: chi apriva il
   modulo dal link del proprio buono doveva comunque ricompilare a mano
   quello che il buono gia' diceva.

   E il calendario del Day Spa non aveva nessun limite proprio: prendeva in
   prestito quello del soggiorno (`limitiSoggiorno()`), che puo' essere
   lunghissimo o assente — mentre la prenotazione vera del Day Spa non va
   oltre quattordici giorni (ORIZZONTE_GIORNI, in /dayspa/giorni.js):
   lasciare scegliere un giorno piu' in la' voleva dire raccogliere una
   richiesta che il server avrebbe comunque rifiutato.

   Come avviso-dayspa.test.ts, si guarda la SORGENTE della pagina: il
   modulo e' un file HTML con dentro uno <script type="module">, non c'e'
   niente da importare in Deno.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';

const SORGENTE = Deno.readTextFileSync(new URL('index.html', import.meta.url));

/* ---------------- il calendario del Day Spa si ferma a 14 giorni ---------------- */

Deno.test('la pagina importa l orizzonte del Day Spa dal modulo puro, non lo riscrive', () => {
  assert(
    /import\s*\{\s*ORIZZONTE_GIORNI,\s*giorniInFila\s*\}\s*from\s*'\/dayspa\/giorni\.js'/.test(SORGENTE),
    'manca l import di ORIZZONTE_GIORNI e giorniInFila da /dayspa/giorni.js',
  );
});

Deno.test('esiste ultimoGiornoDayspa, calcolato dai giorni in fila di oggi', () => {
  assert(
    /const ultimoGiornoDayspa = \(\) => giorniInFila\(oggiISO\(\)\)\[ORIZZONTE_GIORNI - 1\]/.test(SORGENTE),
    'ultimoGiornoDayspa non c e o non calcola l ultimo dei giorni in fila',
  );
});

Deno.test('il campo data del Day Spa usa tettoGiornoDayspa, non i soli limiti del soggiorno', () => {
  const i = SORGENTE.indexOf("if (TIPO === 'dayspa') return");
  assert(i > 0, 'non trovo il ramo Day Spa di campiTipo');
  const corpo = SORGENTE.slice(i, SORGENTE.indexOf('</div>', SORGENTE.indexOf('fPersone', i)));
  assert(
    /id="fGiorno" min="\$\{esc\(DAL\)\}"\$\{tettoGiornoDayspa\(\) \? ` max="\$\{esc\(tettoGiornoDayspa\(\)\)\}"` : ''\}/.test(corpo),
    'il campo fGiorno del Day Spa non prende il max da tettoGiornoDayspa',
  );
});

/* ============================================================
   IL CAMPO DEVE SEMPRE POTERSI COMPILARE.

   Il difetto (revisione finale, 5-6 settembre 2026): `min` resta la data di
   arrivo quando l'arrivo e' nel futuro, ma il tetto era diventato SEMPRE
   l'orizzonte dei quattordici giorni. L'email pre-arrivo della reception
   porta ?arrivo=/?partenza= anche per un soggiorno fra tre settimane: per
   quell'ospite il campo nasceva con min OLTRE max — un calendario in cui
   non si puo' scegliere niente. Prima il tetto era la partenza, e funzionava.

   La funzione si estrae dalla pagina e si esegue davvero (new Function, la
   stessa tecnica di chiusura-arrivo.test.ts nel back office): il difetto
   sta in QUALE data esce, non in come e' scritta la riga, e su una prova di
   sole regex sarebbe passato di nuovo.
   ============================================================ */
function tettoCon(DAL: string, AL: string, orizzonte: string): string {
  const i = SORGENTE.indexOf('function tettoGiornoDayspa()');
  assert(i > 0, 'non trovo tettoGiornoDayspa nella pagina');
  const fonte = SORGENTE.slice(i, SORGENTE.indexOf('\n}', i) + 2);
  const fabbrica = new Function('DAL', 'AL', 'ultimoGiornoDayspa',
    `${fonte}\nreturn tettoGiornoDayspa();`);
  return fabbrica(DAL, AL, () => orizzonte) as string;
}

Deno.test('Day Spa senza date di soggiorno: il tetto e l orizzonte dei 14 giorni', () => {
  assertEquals(tettoCon('2026-09-06', '', '2026-09-19'), '2026-09-19');
});

Deno.test('Day Spa con una partenza dentro l orizzonte: comanda la partenza', () => {
  assertEquals(tettoCon('2026-09-06', '2026-09-10', '2026-09-19'), '2026-09-10',
    'non ha senso proporre un giorno in cui l ospite e gia ripartito');
});

Deno.test('Day Spa con un arrivo OLTRE l orizzonte: il tetto e la partenza, non l orizzonte', () => {
  /* l email pre-arrivo per un soggiorno fra tre settimane: min = 2026-09-28 */
  const tetto = tettoCon('2026-09-28', '2026-10-02', '2026-09-19');
  assertEquals(tetto, '2026-10-02');
  assert(tetto >= '2026-09-28', 'con min oltre max il campo non si potrebbe compilare affatto');
});

Deno.test('Day Spa con un arrivo oltre l orizzonte e nessuna partenza: nessun tetto, mai un campo chiuso', () => {
  assertEquals(tettoCon('2026-09-28', '', '2026-09-19'), '',
    'senza un tetto possibile il max non si scrive proprio');
});

Deno.test('Day Spa con una partenza gia passata (link vecchio): nessun tetto invece di uno impossibile', () => {
  assertEquals(tettoCon('2026-09-06', '2026-08-30', '2026-09-19'), '');
});

Deno.test('la pagina sceglie fra AL e ultimoGiornoDayspa perche oltre non si prenota comunque', () => {
  assert(
    /oltre non si prenota comunque/.test(SORGENTE),
    'manca il perche del limite: la richiesta della proprieta del 5 settembre 2026',
  );
});

/* ---------------- il modulo si precompila dal buono ---------------- */

Deno.test('la pagina importa personeDalBuono e nomeDalBuono dal modulo del buono', () => {
  const m = SORGENTE.match(/import\s*\{([^}]*)\}\s*from\s*'\/comune\/buono-url\.js'/);
  assert(m, 'non trovo l import da /comune/buono-url.js');
  for (const nome of ['personeDalBuono', 'nomeDalBuono']) {
    assert(new RegExp(`\\b${nome}\\b`).test(m![1]), `${nome} non e importato da /comune/buono-url.js`);
  }
});

Deno.test('esiste proattivoDalBuono, chiamata dopo modulo() all avvio', () => {
  assert(/function proattivoDalBuono\(\)/.test(SORGENTE), 'proattivoDalBuono non esiste');
  /* le ultime righe dello script sono l avvio in ordine: modulo() disegna
     la pagina, e solo dopo si puo' scrivere nei campi che ha appena creato.
     Fra le due chiamate puo' starci solo un commento, non un altro passo
     dell avvio infilato in mezzo per sbaglio. */
  const coda = SORGENTE.slice(SORGENTE.lastIndexOf('await precompila();'));
  const iModulo = coda.lastIndexOf('modulo();');
  const iProattivo = coda.lastIndexOf('proattivoDalBuono();');
  assert(iModulo > 0 && iProattivo > iModulo,
    'proattivoDalBuono() non viene dopo modulo() in fondo allo script');
  const fra = coda.slice(iModulo + 'modulo();'.length, iProattivo)
    .replace(/\/\*[\s\S]*?\*\//g, '').trim();
  assertEquals(fra, '', 'fra modulo() e proattivoDalBuono() c e altro oltre a un commento');
});

Deno.test('proattivoDalBuono esce subito se non c e un buono', () => {
  const i = SORGENTE.indexOf('function proattivoDalBuono()');
  assert(i > 0);
  const corpo = SORGENTE.slice(i, SORGENTE.indexOf('\n}', i));
  assert(/if \(!BUONO\) return;/.test(corpo), 'proattivoDalBuono non controlla BUONO subito');
});

Deno.test('proattivoDalBuono scrive fPersone con personeDalBuono(BUONO) e lancia un cambiamento', () => {
  const i = SORGENTE.indexOf('function proattivoDalBuono()');
  const corpo = SORGENTE.slice(i, SORGENTE.indexOf('\n}', i));
  assert(corpo.includes("$('fPersone')"), 'proattivoDalBuono non guarda fPersone');
  assert(corpo.includes('personeDalBuono(BUONO)'), 'proattivoDalBuono non usa personeDalBuono(BUONO)');
  /* senza dispatchEvent la disponibilita' del Day Spa non riparte: il
     campo cambia valore ma nessun ascoltatore se ne accorge */
  assert(
    /dispatchEvent\(new Event\('change', ?\{ ?bubbles: ?true ?\}\)\)/.test(corpo),
    'proattivoDalBuono non lancia un evento change su fPersone',
  );
});

Deno.test('proattivoDalBuono scrive fNome solo se e vuoto', () => {
  const i = SORGENTE.indexOf('function proattivoDalBuono()');
  const corpo = SORGENTE.slice(i, SORGENTE.indexOf('\n}', i));
  assert(corpo.includes("$('fNome')"), 'proattivoDalBuono non guarda fNome');
  assert(corpo.includes('nomeDalBuono(BUONO)'), 'proattivoDalBuono non usa nomeDalBuono(BUONO)');
  assert(
    /\$\('fNome'\)\.value/.test(corpo),
    'proattivoDalBuono non guarda se fNome e gia compilato prima di scriverci',
  );
});

/* ---------------- la nota per la reception, sempre col buono ---------------- */

Deno.test('CONTENUTO_DA_DIRE non e piu condizionato a mancante', () => {
  assert(
    !/if \(mancante\)/.test(SORGENTE),
    'if (mancante) c e ancora: la nota dovrebbe scriversi sempre quando c e un buono',
  );
  assert(SORGENTE.includes('CONTENUTO_DA_DIRE ='), 'CONTENUTO_DA_DIRE non viene piu scritta da nessuna parte');
});

Deno.test('la nota si scrive comunque dentro preselezionaDalBuono, quando c e un buono', () => {
  const i = SORGENTE.indexOf('function preselezionaDalBuono()');
  assert(i > 0, 'non trovo preselezionaDalBuono');
  const corpo = SORGENTE.slice(i, SORGENTE.indexOf('\nfunction ', i + 10));
  assert(corpo.includes('CONTENUTO_DA_DIRE ='), 'preselezionaDalBuono non scrive piu CONTENUTO_DA_DIRE');
});
