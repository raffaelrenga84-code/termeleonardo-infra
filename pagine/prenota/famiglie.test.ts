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
import { accorpa } from './famiglie.js';
import { massaggioDelPiano } from './piani.js';

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
  const f = accorpa(QUEEN, massaggioDelPiano);
  assertEquals(f.length, 2);
  assertEquals(f[0].chiave, 'standard');
  assertEquals(f[0].opzioni.map((o: Voce) => o.tariffa), ['Miglior Prezzo', 'Soggiorno breve']);
  assertEquals(f[1].chiave, 'pacchetto:Thermal Escape');
  assertEquals(f[1].opzioni.length, 1);
});

Deno.test('il pacchetto resta per conto suo, non diventa un trattamento', () => {
  /* il Thermal Escape ha la stessa mezza pensione del Soggiorno breve: se
     si accorpasse per trattamento, un massaggio da 25 minuti sparirebbe
     dentro un pulsante «aggiunga la cena» */
  const f = accorpa(QUEEN, massaggioDelPiano);
  const standard = f.find((x: { chiave: string }) => x.chiave === 'standard');
  assertEquals(
    standard?.opzioni.some((o: Voce) => o.tariffa === 'Thermal Escape'),
    false,
    'il pacchetto e finito dentro la famiglia standard',
  );
});

Deno.test('niente si perde per strada', () => {
  /* il danno peggiore: una tariffa che sparisce e' una camera che non si
     vende, e nessuno sa perche' */
  const f = accorpa(QUEEN, massaggioDelPiano);
  const fuori = f.flatMap((x: { opzioni: Voce[] }) => x.opzioni).map((o: Voce) => o.tariffa).sort();
  assertEquals(fuori, ['Miglior Prezzo', 'Soggiorno breve', 'Thermal Escape']);
});

Deno.test('le famiglie escono dalla piu economica, e cosi le opzioni dentro', () => {
  const f = accorpa([...QUEEN].reverse(), massaggioDelPiano);
  assertEquals(f[0].opzioni[0].prezzo_cent, 38000);
  assertEquals(f[0].opzioni[1].prezzo_cent, 52000);
  assert(f[0].opzioni[0].prezzo_cent < f[1].opzioni[0].prezzo_cent);
});

Deno.test('a parita di trattamento resta la piu economica', () => {
  /* e' l unico caso in cui sparire e' giusto: stessa camera, stesso
     trattamento, prezzo piu' alto. Il limite sta scritto in famiglie.js */
  const f = accorpa([
    v('Miglior Prezzo', 'Bed & Breakfast', 38000, 0),
    v('Tariffa Base', 'Bed & Breakfast', 41000, 1),
  ], massaggioDelPiano);
  assertEquals(f.length, 1);
  assertEquals(f[0].opzioni.length, 1);
  assertEquals(f[0].opzioni[0].prezzo_cent, 38000);
});

Deno.test('ma un trattamento che compare una volta sola non sparisce mai', () => {
  const f = accorpa([
    v('Miglior Prezzo', 'Bed & Breakfast', 38000, 0),
    v('Soggiorno breve', 'Mezza Pensione', 52000, 1),
    v('Tariffa X', 'Pensione Completa', 70000, 2),
  ], massaggioDelPiano);
  const tratt = f.flatMap((x: { opzioni: Voce[] }) => x.opzioni).map((o: Voce) => o.trattamento);
  assertEquals(tratt.sort(), ['Bed & Breakfast', 'Mezza Pensione', 'Pensione Completa']);
});

Deno.test('un elenco vuoto o assente non fa esplodere la scheda', () => {
  assertEquals(accorpa([], massaggioDelPiano), []);
  assertEquals(accorpa(undefined as unknown as Voce[], massaggioDelPiano), []);
  /* senza la funzione che riconosce i pacchetti finisce tutto in una
     famiglia sola: non e' il caso giusto, ma non deve esplodere */
  assertEquals(accorpa(QUEEN, undefined as unknown as (t: string) => number).length, 1);
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
  ) as string;
}

Deno.test('la scheda esce con una tariffa grande e la cena come aggiunta', () => {
  const fam = accorpa(QUEEN, massaggioDelPiano)[0];
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
  const fam = accorpa(QUEEN, massaggioDelPiano)[0];
  const out = disegna(fam, null);
  assert(out.includes('data-indice="0"'), 'la tariffa base non e selezionabile');
  assert(out.includes('data-indice="1"'), 'l aggiunta non e selezionabile');
  assertEquals(out.includes('data-testid="proposta-1"'), true);
});

Deno.test('e la scelta si vede su quella scelta, non sull altra', () => {
  const fam = accorpa(QUEEN, massaggioDelPiano)[0];
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
  const fam = accorpa(QUEEN, massaggioDelPiano)[1];
  const out = disegna(fam, null);
  assertEquals(out.split('<button type="button" class="aggiungi').length - 1, 0);
  assert(out.includes('massaggio di 25 minuti'), 'il pacchetto non dice piu che comprende');
});
