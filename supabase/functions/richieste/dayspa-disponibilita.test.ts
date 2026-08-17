import { assertEquals } from 'jsr:@std/assert';
import { aHotelChiuso, distanzaGiorni, esitoDisponibilita } from './dayspa-disponibilita.ts';

const RISPOSTA_VERA = [{
  id: 2100, date: '2026-08-18', amount: 42, title: 'Giornaliero h.9-18:30',
  sale_price: 3500, available: true,
}];

Deno.test('entro sette giorni con posti: disponibile', () => {
  assertEquals(esitoDisponibilita(RISPOSTA_VERA, 3, false).stato, 'disponibile');
});

Deno.test('entro sette giorni, elenco vuoto: esaurito', () => {
  assertEquals(esitoDisponibilita([], 3, false).stato, 'esaurito');
});

/* la regola che vale piu' di tutte: oltre la settimana la disponibilita'
   non e' ancora stata aperta. Dire «esaurito» manderebbe via un ospite che
   potrebbe venire benissimo. */
Deno.test('oltre sette giorni: non-aperte, mai esaurito', () => {
  assertEquals(esitoDisponibilita([], 8, false).stato, 'non-aperte');
  assertEquals(esitoDisponibilita(RISPOSTA_VERA, 30, false).stato, 'non-aperte');
});

Deno.test('il settimo giorno e ancora dentro, l ottavo no', () => {
  assertEquals(esitoDisponibilita([], 7, false).stato, 'esaurito');
  assertEquals(esitoDisponibilita([], 8, false).stato, 'non-aperte');
});

Deno.test('hotel chiuso: vince su tutto', () => {
  assertEquals(esitoDisponibilita(RISPOSTA_VERA, 3, true).stato, 'chiuso');
});

Deno.test('risposta illeggibile: ignoto, non esaurito', () => {
  for (const v of [null, undefined, 'errore', { errore: 1 }]) {
    assertEquals(esitoDisponibilita(v, 3, false).stato, 'ignoto', String(v));
  }
});

/* IL TEST PIU' IMPORTANTE DI QUESTO FILE.
   `amount` sono i posti residui. Il prompt dell'agente vocale ha una regola
   esplicita: non dirlo mai, in nessuna forma. Se qualcuno «semplificasse»
   rigirando la risposta intera, quel numero finirebbe negli strumenti del
   browser di chiunque — e nessuno se ne accorgerebbe finche' un cliente non
   commenta «ma allora c'erano ancora quaranta posti». */
Deno.test('l esito non contiene MAI i posti residui', () => {
  const e = esitoDisponibilita(RISPOSTA_VERA, 3, false);
  const serializzato = JSON.stringify(e);
  assertEquals(serializzato.includes('42'), false, 'i posti residui sono usciti');
  assertEquals(serializzato.includes('amount'), false, 'il campo amount e uscito');
  assertEquals(Object.keys(e), ['stato'], 'l esito deve avere SOLO stato');
});

/* ================= giro di correzione 1: aHotelChiuso e distanzaGiorni =====
   Erano in index.ts, che per convenzione non e' importabile dai test
   (chiama Deno.serve in cima): le uniche righe nuove senza collaudo, e
   proprio le due decisioni che scelgono la parola detta all'ospite. Spostate
   qui, pure ed esportate. */

const STAGIONI = [
  { chiusura: '2026-11-05', riapertura: '2026-12-20' },
  { chiusura: '2027-01-10', riapertura: '2027-02-01' },
];

Deno.test('aHotelChiuso: un giorno dentro una chiusura e chiuso', () => {
  assertEquals(aHotelChiuso('2026-11-20', STAGIONI), true);
});

Deno.test('aHotelChiuso: il giorno della riapertura e gia aperto', () => {
  assertEquals(aHotelChiuso('2026-12-20', STAGIONI), false);
});

Deno.test('aHotelChiuso: un giorno fra due stagioni e aperto', () => {
  assertEquals(aHotelChiuso('2026-12-25', STAGIONI), false);
});

Deno.test('aHotelChiuso: senza stagioni non e mai chiuso', () => {
  assertEquals(aHotelChiuso('2026-11-20', []), false);
});

/* `oggi` e' un parametro e non l'orologio letto dentro la funzione: senza,
   la funzione non si potrebbe collaudare senza aspettare che il tempo
   passi davvero — lo stesso motivo per cui creaFrenoIp accetta un `adesso`
   opzionale. */
const OGGI = new Date('2026-08-17T12:00:00Z');

Deno.test('distanzaGiorni: oggi vale zero', () => {
  assertEquals(distanzaGiorni('2026-08-17', OGGI), 0);
});

Deno.test('distanzaGiorni: domani vale uno', () => {
  assertEquals(distanzaGiorni('2026-08-18', OGGI), 1);
});

Deno.test('distanzaGiorni: il settimo giorno vale sette', () => {
  assertEquals(distanzaGiorni('2026-08-24', OGGI), 7);
});

Deno.test('distanzaGiorni: l ottavo giorno vale otto', () => {
  assertEquals(distanzaGiorni('2026-08-25', OGGI), 8);
});
