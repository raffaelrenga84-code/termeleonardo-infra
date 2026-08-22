/* ============================================================
   famiglie.test.ts — tre righe diventano due schede, e la cena si vende.

   IL DIFETTO. Sulla Matrimoniale Queen uscivano tre righe: «Miglior
   Prezzo · B&B 380», «Soggiorno breve · Mezza Pensione 520», «Thermal
   Escape · Mezza Pensione 594». Le prime due sono LA STESSA OFFERTA con e
   senza cena — «Soggiorno breve» è il nome che prende il prezzo in mezza
   pensione quando il soggiorno è di una o due notti — e portano due nomi
   diversi per una differenza sola. Chi guarda non ha modo di capirlo.

   IL DIFETTO CHE L'ACCORPAMENTO POTREBBE INTRODURRE, ed è più grave:
   perdere una tariffa per strada. Una riga che sparisce è una camera che
   non si vende e nessuno sa perché. Le prove qui sotto pretendono che
   tutto quello che entra esca, tranne l'unico caso in cui sparire è
   giusto — due tariffe identiche nel trattamento, dove resta la più
   economica.

   E IL MARKUP SI ESEGUE, non si legge: si prende dalla pagina vera il
   modello delle opzioni e lo si fa girare. Se qualcuno lo riscrive,
   questa prova gira sul nuovo.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';
import { accorpa, famiglia } from './famiglie.js';
import { massaggioDelPiano } from './piani.js';
import { formulaDi } from './formule.js';

type Voce = { tariffa: string; trattamento: string; prezzo_cent: number; indice?: number };
const v = (tariffa: string, trattamento: string, cent: number, indice = 0): Voce => ({
  tariffa,
  trattamento,
  prezzo_cent: cent,
  indice,
});

/* le tre righe vere della Matrimoniale Queen, 21 agosto 2026 */
const QUEEN = [
  v('Miglior Prezzo', 'Bed & Breakfast', 38000, 0),
  v('Soggiorno breve', 'Mezza Pensione', 52000, 1),
  v('Thermal Escape', 'Mezza Pensione', 59400, 2),
];

Deno.test('le tre righe della Queen diventano due schede', () => {
  const f = accorpa(QUEEN);
  assertEquals(f.length, 2);
  assertEquals(f[0].chiave, 'miglior prezzo');
  assertEquals(f[0].opzioni.map((o: Voce) => o.tariffa), ['Miglior Prezzo', 'Soggiorno breve']);
  assertEquals(f[1].chiave, 'thermal escape');
  assertEquals(f[1].opzioni.length, 1);
});

Deno.test('un piano diverso resta per conto suo, non diventa un trattamento', () => {
  /* il Thermal Escape ha la stessa mezza pensione del Soggiorno breve: se
     si accorpasse per trattamento, un massaggio da 25 minuti sparirebbe
     dentro un pulsante «aggiunga la cena» */
  const f = accorpa(QUEEN);
  const standard = f.find((x: { chiave: string }) => x.chiave === 'miglior prezzo');
  assertEquals(
    standard?.opzioni.some((o: Voce) => o.tariffa === 'Thermal Escape'),
    false,
    'il pacchetto e finito dentro la famiglia standard',
  );
});

Deno.test('niente si perde per strada', () => {
  /* il danno peggiore: una tariffa che sparisce e' una camera che non si
     vende, e nessuno sa perche' */
  const f = accorpa(QUEEN);
  const fuori = f.flatMap((x: { opzioni: Voce[] }) => x.opzioni).map((o: Voce) => o.tariffa).sort();
  assertEquals(fuori, ['Miglior Prezzo', 'Soggiorno breve', 'Thermal Escape']);
});

Deno.test('le famiglie escono dalla piu economica, e cosi le opzioni dentro', () => {
  const f = accorpa([...QUEEN].reverse());
  assertEquals(f[0].opzioni[0].prezzo_cent, 38000);
  assertEquals(f[0].opzioni[1].prezzo_cent, 52000);
  assert(f[0].opzioni[0].prezzo_cent < f[1].opzioni[0].prezzo_cent);
});

Deno.test('dentro lo STESSO piano, a parita di trattamento resta la piu economica', () => {
  /* stesso piano, stesso trattamento, due prezzi: sono la stessa cosa, e
     nessuno vuole pagare di piu' */
  const f = accorpa([
    v('Miglior Prezzo', 'Bed & Breakfast', 38000, 0),
    v('Miglior Prezzo', 'Bed & Breakfast', 41000, 1),
  ]);
  assertEquals(f.length, 1);
  assertEquals(f[0].opzioni.length, 1);
  assertEquals(f[0].opzioni[0].prezzo_cent, 38000);
});

Deno.test('ma due PIANI diversi con lo stesso trattamento restano tutti e due', () => {
  /* e' il difetto del Golf: fino al 22 agosto 2026 quello piu' caro
     spariva, e con lui un pacchetto intero */
  const f = accorpa([
    v('Miglior Prezzo', 'Mezza Pensione', 370500, 0),
    v('Golf', 'Mezza Pensione', 387800, 1),
  ]);
  assertEquals(f.length, 2, 'due piani diversi si sono fusi: uno dei due e sparito');
  assertEquals(
    f.flatMap((x: { opzioni: Voce[] }) => x.opzioni).map((o: Voce) => o.tariffa).sort(),
    ['Golf', 'Miglior Prezzo'],
  );
});

Deno.test('ma un trattamento che compare una volta sola non sparisce mai', () => {
  const f = accorpa([
    v('Miglior Prezzo', 'Bed & Breakfast', 38000, 0),
    v('Soggiorno breve', 'Mezza Pensione', 52000, 1),
    v('Tariffa X', 'Pensione Completa', 70000, 2),
  ]);
  const tratt = f.flatMap((x: { opzioni: Voce[] }) => x.opzioni).map((o: Voce) => o.trattamento);
  assertEquals(tratt.sort(), ['Bed & Breakfast', 'Mezza Pensione', 'Pensione Completa']);
});

Deno.test('un elenco vuoto o assente non fa esplodere la scheda', () => {
  assertEquals(accorpa([]), []);
  assertEquals(accorpa(undefined as unknown as Voce[]), []);
});

/* ============================================================
   E IL MARKUP SI ESEGUE.

   accorpa() può essere perfetta e la scheda uscire sbagliata: sono due
   difetti diversi. Qui si prende dalla pagina VERA il modello delle
   opzioni — la stessa stringa che gira nel browser, non una copia
   scritta qui — e lo si fa girare.
   ============================================================ */
const PAGINA = Deno.readTextFileSync(new URL('index.html', import.meta.url))
  .split('\r\n').join('\n');

function modelloOpzioni(): string {
  const da = PAGINA.indexOf('${fam.opzioni.map((v, i) => i === 0');
  assert(da > 0, 'il modello delle opzioni non si trova nella pagina');
  const a = PAGINA.indexOf("            ).join('')}", da);
  assert(a > da, 'la fine del modello non si trova: la scheda e cambiata forma');
  return PAGINA.slice(da, a + "            ).join('')}".length);
}

/* IL SEGNO DELL'AGGIUNTA — il piatto fumante per la cena, il «+» per
   tutto il resto — si prende dalla pagina VERA e si esegue: uno stub
   direbbe che la scheda funziona anche se il piatto non uscisse. */
function segnoDallaPagina(): (v: { trattamento: string }) => string {
  const da = PAGINA.indexOf('const PIATTO = ');
  assert(da > 0, 'il piatto non si trova nella pagina');
  const capo = PAGINA.indexOf('function segnoInvito(v) {', da);
  assert(capo > da, 'segnoInvito non si trova nella pagina');
  const fine = PAGINA.indexOf('\n}\n', capo);
  assert(fine > capo, 'la fine di segnoInvito non si trova');
  return new Function('formulaDi', PAGINA.slice(da, fine + 2) + '; return segnoInvito;')(
    formulaDi,
  ) as (v: { trattamento: string }) => string;
}
const segnoInvito = segnoDallaPagina();

function disegna(fam: { opzioni: Voce[] }, scelto: number | null): string {
  const esc = (x: unknown) =>
    String(x ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const euroDaCentesimi = (c: number) => (c / 100).toFixed(2).replace('.', ',');
  const nomi = (n: string) => n;
  const t = { pianoMassaggio: (m: number) => `massaggio di ${m} minuti` };
  const f = new Function(
    'fam', 'SCELTA', 'LNG', 'esc', 'euroDaCentesimi', 'nomeTariffa', 'nomeTrattamento',
    'conFormula', 't', 'massaggioDelPiano', 'dettaglioDelPrezzo', 'invito', 'quantoInPiu',
    'segnoInvito',
    'return `' + modelloOpzioni() + '`;',
  );
  return f(
    fam,
    scelto === null ? null : { indice: scelto },
    'it',
    esc,
    euroDaCentesimi,
    nomi,
    nomi,
    (n: string) => n,
    t,
    massaggioDelPiano,
    () => 'totale del soggiorno',
    () => 'Aggiunga la cena a buffet',
    () => '35,00 € a persona a notte · +140,00 € in tutto',
    segnoInvito,
  ) as string;
}

Deno.test('la scheda esce con una tariffa grande e la cena come aggiunta', () => {
  const fam = accorpa(QUEEN)[0];
  const out = disegna(fam, null);
  /* si contano i PULSANTI, non le classi: «aggiungiTit» e
     «aggiungiSotto» cominciano anche loro per «aggiungi» */
  const pulsanti = (h: string, c: string) => h.split(`<button type="button" class="${c}`).length - 1;
  assertEquals(pulsanti(out, 'proposta'), 1, 'le tariffe grandi non sono una');
  assertEquals(pulsanti(out, 'aggiungi'), 1, 'le aggiunte non sono una');
  /* i due totali restano tutti e due visibili: si accorpa quello che si
     legge, non si nasconde un prezzo */
  assert(out.includes('380,00 €'), 'manca il prezzo della tariffa base');
  assert(out.includes('520,00 €'), 'manca il prezzo con la cena');
  assert(out.includes('Aggiunga la cena a buffet'), 'manca l invito');
  assert(out.includes('35,00 € a persona a notte'), 'manca il quanto in piu a persona a notte');
});

Deno.test('e ogni opzione resta selezionabile, con il suo indice', () => {
  /* se l aggiunta non portasse il suo indice, chi la clicca comprerebbe la
     tariffa senza cena: il difetto piu' caro possibile su questa pagina */
  const fam = accorpa(QUEEN)[0];
  const out = disegna(fam, null);
  assert(out.includes('data-indice="0"'), 'la tariffa base non e selezionabile');
  assert(out.includes('data-indice="1"'), 'l aggiunta non e selezionabile');
  assertEquals(out.includes('data-testid="proposta-1"'), true);
});

Deno.test('e la scelta si vede su quella scelta, non sull altra', () => {
  const fam = accorpa(QUEEN)[0];
  const conAggiunta = disegna(fam, 1);
  assert(conAggiunta.includes('class="aggiungi selezionata"'), 'l aggiunta scelta non si segna');
  assertEquals(
    conAggiunta.includes('class="proposta selezionata"'),
    false,
    'risultano scelte tutte e due',
  );
  const conBase = disegna(fam, 0);
  assert(conBase.includes('class="proposta selezionata"'));
  assertEquals(conBase.includes('class="aggiungi selezionata"'), false);
});

Deno.test('un pacchetto da solo non produce nessuna aggiunta', () => {
  /* «Aggiunga la cena» sotto il Thermal Escape, che la cena ce l ha gia,
     sarebbe un invito a comprare quello che si sta gia comprando */
  const fam = accorpa(QUEEN)[1];
  const out = disegna(fam, null);
  assertEquals(out.split('<button type="button" class="aggiungi').length - 1, 0);
  assert(out.includes('massaggio di 25 minuti'), 'il pacchetto non dice piu che comprende');
});

/* ============================================================
   E L'OFFERTA SI RIFÀ NEL PASSO DEI DATI.

   Chi al passo prima ha scelto la colazione non stava decidendo se
   cenare: stava decidendo dove dormire. L'ultimo momento prima di
   inviare è il secondo momento buono per chiederglielo.

   IL DIFETTO CHE QUESTA CURA POTEVA INTRODURRE, ed è quello che fa
   perdere la richiesta intera: cambiare tariffa da lì ridisegna la
   schermata, e il ridisegno cancella nome, email e telefono appena
   scritti. Chi se li vede sparire non li riscrive: se ne va. L'ordine
   delle due righe — prima mettere da parte, poi cambiare — è tutto il
   presidio, e per questo c'è una prova che guarda proprio l'ordine.
   ============================================================ */
Deno.test('l offerta della cena si rifa nel passo dei dati', () => {
  assert(
    PAGINA.includes('const conCena = conCenaPerLaScelta();'),
    'sparita l offerta della cena dal passo dei dati',
  );
  assert(
    PAGINA.includes('id="bAggiungiCena"'),
    'sparito il pulsante che aggiunge la cena prima di inviare',
  );
});

Deno.test('e si propone solo quella che costa di piu, mai il contrario', () => {
  /* proporre a chi ha gia la mezza pensione di togliersela non e'
     upselling: e' farsi togliere una cena gia venduta */
  assert(
    PAGINA.includes('Number(o.prezzo_cent) > Number(SCELTA.prezzo_cent)'),
    'l offerta non guarda piu il prezzo: potrebbe proporre di scendere',
  );
});

Deno.test('e cambiare tariffa non cancella quello che l ospite ha scritto', () => {
  /* l ORDINE e il presidio: prima si mette da parte, poi si cambia. Al
     contrario il ridisegno porta via nome, email e telefono. */
  const dove = PAGINA.indexOf("$('bAggiungiCena').onclick");
  assert(dove > 0, 'sparito il gestore del pulsante');
  const salva = PAGINA.indexOf('SCRITTI = datiScritti();', dove);
  const cambia = PAGINA.indexOf('SCELTA = { ...PROPOSTE[i], indice: i };', dove);
  assert(salva > 0 && cambia > 0, 'il gestore non salva o non cambia');
  assert(
    salva < cambia,
    'si cambia tariffa PRIMA di mettere da parte i dati: il ridisegno li porta via',
  );
});

Deno.test('e i campi ripartono da quello che era scritto, non dall indirizzo', () => {
  for (const campo of ['gia.nome', 'gia.email', 'gia.tel']) {
    assert(
      PAGINA.includes('esc(' + campo + ')'),
      `il campo ${campo} torna a leggere l indirizzo: quello che era scritto si perde`,
    );
  }
  /* il cane non sta piu' in `gia`: e' una variabile sola letta da due
     schermate, e il modulo riparte da quella. Restasse anche in `gia`,
     tornare indietro alle camere lo riporterebbe al valore vecchio. */
  assert(PAGINA.includes("id=\"fCane\"${CANE ? ' checked' : ''}"),
    'la spunta del cane non riparte piu dallo stato comune');
  assert(PAGINA.includes('gia.privacy ?'), 'la spunta privacy non si conserva');
});

/* ============================================================
   I PREZZI SU UN TELEFONO. Corretto il 22 agosto 2026.

   La riga della tariffa era a due colonne — testo a sinistra, prezzo a
   destra — e la colonna del prezzo NON SI STRINGEVA, perché dentro
   c'era anche «totale · 2 adulti × 190,00 € a persona». Su un telefono
   quella frase si prendeva metà riga e schiacciava il nome della
   tariffa a tre parole per volta:

       Miglior          380,00 €
       Prezzo      totale · 2 adulti
       Bed &       × 190,00 € a persona
       Breakfast ·

   La frase sta ora FUORI dalla riga, a tutta larghezza. In riga resta
   il solo prezzo, che è corto. È una cosa di struttura, non di stile: un
   foglio di stile la può ammorbidire, ma se il div torna dentro la
   colonna il difetto torna identico. Per questo la prova guarda dove sta
   il div, non come è colorato.
   ============================================================ */
Deno.test('la frase del totale sta FUORI dalla colonna del prezzo', () => {
  const fam = accorpa(QUEEN)[0];
  const out = disegna(fam, null);
  const box = out.indexOf('class="prezzoBox"');
  const dett = out.indexOf('class="dettPrezzo"');
  assert(box > 0, 'sparita la colonna del prezzo');
  assert(dett > box, 'la frase del totale viene prima del prezzo');
  /* fra i due devono chiudersi TRE div: il prezzo, la colonna, la riga.
     Se sono meno, la frase e' tornata dentro la colonna. */
  const chiusure = out.slice(box, dett).split('</div>').length - 1;
  assert(
    chiusure >= 3,
    `fra il prezzo e la frase del totale si chiudono ${chiusure} div invece di 3: ` +
      'la frase e tornata dentro la colonna, e su un telefono schiaccia il nome della tariffa',
  );
});

Deno.test('e il nome della tariffa puo restringersi senza traboccare', () => {
  const pagina = Deno.readTextFileSync(new URL('index.html', import.meta.url));
  assert(
    pagina.includes('.proposta .riga > div:first-child{min-width:0;}'),
    'senza min-width:0 una parola lunga fa traboccare la scheda invece di andare a capo',
  );
  assert(
    pagina.includes('@media(max-width:420px){'),
    'sotto i 420px il prezzo torna accanto al nome, e si spezzano tutti e due',
  );
});

/* ============================================================
   IL GOLF CHE SPARIVA. Trovato il 22 agosto 2026.

   Su un soggiorno lungo — provato su 02-20 settembre, Junior Suite
   Abano — una camera ha cinque proposte:

     Miglior Prezzo · Bed & Breakfast · 3255
     Miglior Prezzo · Mezza Pensione  · 3705
     Dolce Vita     · 5 cure          · 3965
     Dolce Vita     · 10 cure         · 4225
     Golf           · Mezza Pensione  · 3878

   L'accorpamento metteva in una famiglia sola tutto quello che non
   comprendeva un massaggio, e dentro teneva UNA opzione per trattamento:
   il Golf ha la stessa Mezza Pensione del Miglior Prezzo e costa di piu',
   quindi SPARIVA. Un pacchetto intero invendibile dalla pagina — e
   invisibile, perche' sui soggiorni corti il Golf non esce.
   ============================================================ */
const SETTEMBRE = [
  v('Miglior Prezzo', 'Bed & Breakfast', 325500, 0),
  v('Miglior Prezzo', 'Mezza Pensione', 370500, 1),
  v('Dolce Vita', '5 cure', 396500, 2),
  v('Dolce Vita', '10 cure', 422500, 3),
  v('Golf', 'Mezza Pensione', 387800, 4),
];

Deno.test('il pacchetto Golf non sparisce dietro una mezza pensione piu economica', () => {
  const dentro = accorpa(SETTEMBRE)
    .flatMap((f: { opzioni: Voce[] }) => f.opzioni)
    .map((o: Voce) => o.tariffa);
  assert(dentro.includes('Golf'), 'il Golf e sparito: un pacchetto invendibile dalla pagina');
  assertEquals(dentro.length, SETTEMBRE.length, 'qualche proposta e andata persa');
});

Deno.test('e le cure non diventano un modo di mangiare', () => {
  /* «5 cure» e «10 cure» finivano dentro la famiglia standard accanto a
     «Bed & Breakfast», come se fossero due trattamenti da scegliere */
  const fam = accorpa(SETTEMBRE);
  const standard = fam.find((f: { chiave: string }) => f.chiave === 'miglior prezzo');
  assertEquals(
    standard?.opzioni.map((o: Voce) => o.trattamento),
    ['Bed & Breakfast', 'Mezza Pensione'],
    'la famiglia standard ha dentro qualcosa che non e un trattamento',
  );
  const cure = fam.find((f: { chiave: string }) => f.chiave === 'dolce vita');
  assertEquals(cure?.opzioni.length, 2, 'il Dolce Vita non e una famiglia sua');
});

Deno.test('e «Soggiorno breve» resta unito a «Miglior Prezzo»', () => {
  /* e' lo stesso prezzo con un altro nome, che dipende dalla durata: se
     si dividessero, la cena tornerebbe a essere una tariffa a se' */
  assertEquals(famiglia('Soggiorno breve'), 'miglior prezzo');
  assertEquals(famiglia('  SOGGIORNO   BREVE '), 'miglior prezzo');
  assertEquals(famiglia('Golf'), 'golf');
  assertEquals(accorpa(QUEEN)[0].opzioni.length, 2);
});

Deno.test('l aggiunta della cena porta un piatto fumante, non un «+»', () => {
  /* chiesto dalla proprieta': su una striscia stretta in mezzo a due
     prezzi il segno si vede prima di leggere, e un «+» dice solo che c'e'
     dell'altro — il piatto dice CHE COSA. */
  const out = disegna(accorpa(QUEEN)[0], null);
  const dove = out.indexOf('Aggiunga la cena a buffet');
  assert(dove > 0, 'manca l invito alla cena');
  const prima = out.slice(Math.max(0, dove - 500), dove);
  assert(prima.includes('<svg class="segno"'), 'l aggiunta della cena non porta il piatto');
  assert(
    !prima.includes('<span class="piu"'),
    'sulla cena c e ancora il vecchio «+»',
  );
});

Deno.test('e il piatto e disegnato, non una emoji', () => {
  /* le emoji cambiano faccia da un telefono all'altro, e su qualcuna il
     piatto non ha nemmeno il vapore: quello che si e' promesso al
     cliente e' un piatto FUMANTE */
  const segno = segnoInvito({ trattamento: 'Mezza Pensione' });
  assert(segno.includes('<svg'), 'il segno della cena non e piu disegnato');
  assert(segno.includes('stroke="currentColor"'), 'il piatto non prende piu il colore della riga');
  /* tre riccioli di vapore: senza, e un piatto vuoto */
  assertEquals(segno.split('c-1.4 1.3-1.4 2.5 0 3.8').length - 1, 3);
});

Deno.test('ma su un altra formula resta il «+»', () => {
  /* un piatto davanti a «Passi a Pensione Completa» prometterebbe una
     cosa e ne porterebbe un altra */
  const segno = segnoInvito({ trattamento: 'Bed & Breakfast' });
  assert(!segno.includes('<svg'), 'il piatto esce anche dove non c e la cena');
  assert(segno.includes('>+<'), 'sparito il segno delle altre aggiunte');
});
