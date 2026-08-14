/* Le parti pure di date.js. Quelle che toccano il DOM non si provano qui:
   si provano in un browser vero, come e' stato fatto. */
import { assertEquals } from 'jsr:@std/assert';
import { giornoDopo, oggiISO, partenzaCoerente } from './date.js';

/* Il difetto che questo modulo esiste anche per chiudere: con
   toISOString() la data era in UTC, quindi a est di Greenwich fra
   mezzanotte e l'alba il campo proponeva IERI come primo giorno
   scegliibile, e l'ospite sceglieva una data che il server poi rifiutava.

   Il test non si lega al fuso della macchina — sarebbe verde in Italia e
   rosso su un server a Londra: chiede solo che la data sia quella
   dell'orologio di chi guarda lo schermo, che e' vero ovunque. */
Deno.test('oggiISO da la data dell orologio locale, non quella UTC', () => {
  const mezzanotte = new Date(2027, 2, 15, 0, 30, 0);
  assertEquals(oggiISO(mezzanotte), '2027-03-15');

  /* e dove il fuso e' avanti rispetto a UTC, le due letture divergono
     davvero: qui si dimostra che il difetto era reale, senza pretenderlo */
  if (mezzanotte.getTimezoneOffset() < 0) {
    assertEquals(mezzanotte.toISOString().slice(0, 10), '2027-03-14');
  }
});

Deno.test('oggiISO mette lo zero davanti a mesi e giorni', () => {
  assertEquals(oggiISO(new Date(2027, 0, 5, 12)), '2027-01-05');
});

Deno.test('giornoDopo attraversa mese e anno', () => {
  assertEquals(giornoDopo('2027-03-15'), '2027-03-16');
  assertEquals(giornoDopo('2027-02-28'), '2027-03-01');
  assertEquals(giornoDopo('2027-12-31'), '2028-01-01');
  /* anno bisestile: il 2028 il 29 febbraio c'e' */
  assertEquals(giornoDopo('2028-02-28'), '2028-02-29');
});

Deno.test('giornoDopo non si inventa niente da un valore malformato', () => {
  assertEquals(giornoDopo(''), '');
  assertEquals(giornoDopo('domani'), '');
  assertEquals(giornoDopo('2027-13-40'), '');
});

/* Il difetto segnalato dalla proprieta': si poteva scegliere di partire
   prima di essere arrivati, e lo si scopriva solo dopo aver compilato
   tutto il resto. */
Deno.test('una partenza prima dell arrivo viene buttata', () => {
  const r = partenzaCoerente('2027-09-16', '2027-09-10');
  assertEquals(r.minimo, '2027-09-17');
  assertEquals(r.partenza, '');
});

Deno.test('non si parte lo stesso giorno in cui si arriva', () => {
  assertEquals(partenzaCoerente('2027-09-16', '2027-09-16').partenza, '');
});

Deno.test('una partenza valida resta dov e', () => {
  const r = partenzaCoerente('2027-09-16', '2027-09-20');
  assertEquals(r.minimo, '2027-09-17');
  assertEquals(r.partenza, '2027-09-20');
});

Deno.test('senza arrivo non si tocca la partenza gia scelta', () => {
  const r = partenzaCoerente('', '2027-09-20');
  assertEquals(r.minimo, '');
  assertEquals(r.partenza, '2027-09-20');
});
