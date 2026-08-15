/* Test di frasechiusura: la costruzione della riga di chiusura stagionale
   che entra nel prompt (vedi chiusura.ts per il perché). Si prova solo la
   COSTRUZIONE, non le parole del modello — quelle non sono provabili, la
   riga che il modello riceve sì. */
import { assert, assertEquals, assertStringIncludes } from 'jsr:@std/assert';
import { frasechiusura, type Stagione } from './chiusura.ts';

/* Le date vere della stagione 2026/2027, dalla proprietà (le stesse di
   buoni/scadenza.test.ts: e' la stessa stagione, la stessa tabella). */
const STAGIONE_VERA: Stagione[] = [{ chiusura: '2026-11-29', riapertura: '2027-02-13' }];

const oggi = (s: string) => new Date(s + 'T12:00:00Z');

Deno.test('con la stagione vera: la riga nomina entrambe le date e dice che l\'hotel è chiuso', () => {
  const riga = frasechiusura(STAGIONE_VERA, oggi('2026-08-15'));
  assertStringIncludes(riga, '29 novembre 2026');
  assertStringIncludes(riga, '13 febbraio 2027');
  assertStringIncludes(riga, 'chiuso');
  /* fallisce se qualcuno scambia chiusura e riapertura nella formattazione */
  assert(riga.indexOf('29 novembre 2026') < riga.indexOf('13 febbraio 2027'),
    'la chiusura va nominata prima della riapertura');
});

/* Il giorno della riapertura e' un giorno APERTO. La riga diceva «chiuso
   ... al 13 febbraio compreso, e riapre il 13 febbraio»: due meta' che si
   contraddicono, e un ospite che chiede proprio del 13 puo' sentirsi dire
   che siamo chiusi il giorno in cui invece apriamo — cioe' perdere una
   prenotazione nel primo giorno di stagione, quello che si riempie meno.
   L'ultimo giorno chiuso e' il giorno PRIMA della riapertura. */
Deno.test('l\'ultimo giorno chiuso è il giorno prima della riapertura, non la riapertura stessa', () => {
  const riga = frasechiusura(STAGIONE_VERA, oggi('2026-08-15'));
  assertStringIncludes(riga, '12 febbraio 2027');
  assertEquals(/al \*\*13 febbraio 2027\*\* compreso/.test(riga), false,
    'la riga dice ancora che il giorno della riapertura è chiuso');
});

Deno.test('la riapertura al primo del mese: l\'ultimo giorno chiuso è l\'ultimo del mese prima', () => {
  /* il giorno prima non si calcola togliendo 1 al numero: il 1 marzo meno
     un giorno e' il 28 (o 29) febbraio, non il 0 marzo */
  const riga = frasechiusura([{ chiusura: '2026-11-29', riapertura: '2027-03-01' }], oggi('2026-08-15'));
  assertStringIncludes(riga, '28 febbraio 2027');
});

/* «L'hotel è chiuso» non basta: qualcuno può pensare che il campo pratica
   o la spa restino aperti anche a hotel chiuso — sono servizi che si usano
   anche senza dormirci. La riga deve nominarli tutti e quattro. */
Deno.test('la riga dice esplicitamente cosa è chiuso: hotel, spa, campo pratica golf e Day Spa', () => {
  const riga = frasechiusura(STAGIONE_VERA, oggi('2026-08-15'));
  for (const servizio of [/hotel/i, /spa/i, /campo pratica/i, /day spa/i]) {
    assert(servizio.test(riga), `la riga non nomina ${servizio}`);
  }
});

Deno.test('tabella vuota: nessuna riga, stringa vuota', () => {
  assertEquals(frasechiusura([], oggi('2026-08-15')), '');
});

Deno.test('stagione malformata: date mancanti, null, riapertura prima della chiusura — nessuna riga, nessuna eccezione', () => {
  const senzaChiusura = [{ riapertura: '2027-02-13' }] as unknown as Stagione[];
  const conNull = [{ chiusura: '2026-11-29', riapertura: null }] as unknown as Stagione[];
  const invertita: Stagione[] = [{ chiusura: '2027-02-13', riapertura: '2026-11-29' }];
  const dataInesistente: Stagione[] = [{ chiusura: '2026-11-31', riapertura: '2027-02-13' }];
  const elementoNull = [null, ...STAGIONE_VERA.map(() => null)] as unknown as Stagione[];

  assertEquals(frasechiusura(senzaChiusura, oggi('2026-08-15')), '');
  assertEquals(frasechiusura(conNull, oggi('2026-08-15')), '');
  assertEquals(frasechiusura(invertita, oggi('2026-08-15')), '');
  assertEquals(frasechiusura(dataInesistente, oggi('2026-08-15')), '');
  /* un elemento null in mezzo all'elenco non deve far esplodere la mappa:
     l'accesso a `s?.chiusura` con optional chaining è quello che lo evita */
  assertEquals(frasechiusura(elementoNull, oggi('2026-08-15')), '');
});

Deno.test('una chiusura già del tutto passata rispetto a "oggi" non compare: non serve al modello e lo confonderebbe', () => {
  /* riapertura 2025-02-14, molto prima di "oggi" 2026-08-15: la stagione è
     finita da un pezzo e non deve restare nel prompt per sempre solo
     perché la riga non è mai stata cancellata dalla tabella */
  const vecchia: Stagione[] = [{ chiusura: '2024-11-29', riapertura: '2025-02-14' }];
  assertEquals(frasechiusura(vecchia, oggi('2026-08-15')), '');
});

Deno.test('una chiusura che finisce esattamente "oggi" conta ancora come rilevante', () => {
  /* confine: l'hotel riapre proprio oggi, e' ancora informazione utile
     (un ospite potrebbe chiedere "e domani?") — si include */
  const chiudeOggi: Stagione[] = [{ chiusura: '2026-05-01', riapertura: '2026-08-15' }];
  assertStringIncludes(frasechiusura(chiudeOggi, oggi('2026-08-15')), '15 agosto 2026');
});

Deno.test('più stagioni valide: compaiono tutte, in ordine di chiusura crescente', () => {
  /* decisione presa in chiusura.ts: si mostrano TUTTE le stagioni ancora
     rilevanti, non solo la più vicina — un ospite può chiedere una data
     che cade nella seconda, e nasconderla sarebbe lo stesso difetto che
     questo modulo esiste per correggere. Qui si prova che nessuna delle
     due sparisce e che l'ordine è quello delle chiusure, non quello con
     cui sono arrivate dal database. */
  const dueStagioni: Stagione[] = [
    { chiusura: '2027-11-28', riapertura: '2028-02-12' },   // la piu' lontana, messa per prima
    { chiusura: '2026-11-29', riapertura: '2027-02-13' },   // quella in corso
  ];
  const riga = frasechiusura(dueStagioni, oggi('2026-08-15'));
  assertStringIncludes(riga, '29 novembre 2026');
  assertStringIncludes(riga, '13 febbraio 2027');
  assertStringIncludes(riga, '28 novembre 2027');
  assertStringIncludes(riga, '12 febbraio 2028');
  assert(riga.indexOf('29 novembre 2026') < riga.indexOf('28 novembre 2027'),
    'la stagione con la chiusura piu vicina va nominata per prima, anche se in ingresso era la seconda');
});

Deno.test('la riga non nomina mai "non ancora aperte": è la frase del difetto originale', () => {
  /* questo e' il test che fallisce se qualcuno riporta dentro
     frasechiusura la formula sbagliata osservata in produzione. La riga
     PUO' contenere la parola "esaurito" — ce la mette apposta, per
     VIETARLA al modello ("non dire esaurito") — quindi qui si prova solo
     la frase incriminata, non una parola che compare legittimamente
     dentro un divieto. */
  const riga = frasechiusura(STAGIONE_VERA, oggi('2026-08-15'));
  assert(!riga.toLowerCase().includes('non ancora aperte'), 'non deve mai comparire "non ancora aperte"');
});
