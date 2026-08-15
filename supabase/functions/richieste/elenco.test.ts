/* elenco.test.ts — presidio di elenco.ts, la riga come la vede il back
   office in `?a=elenco`.

   Il compito e' solo comporre due moduli gia' collaudati (riepilogo.ts,
   differenze.ts) per ogni riga: qui si prova la composizione, non le
   regole gia' provate altrove. In particolare si prova che l'ordine degli
   argomenti passati a differenze() sia quello giusto (originali, poi
   correnti) — uno scambio sarebbe invisibile se il test guardasse solo la
   lunghezza dell'elenco, quindi si controllano anche prima/adesso. */
import { assertEquals } from 'jsr:@std/assert';
import { arricchisciRiga, arricchisciElenco } from './elenco.ts';

Deno.test('aggiunge etichetta e riepilogo alla riga, presi da riepilogo.ts', () => {
  const r = arricchisciRiga({
    tipo: 'transfer',
    dati: { luogo: 'Padova FS', verso: 'arrivo', quando: '2026-09-16', ora: '09:00', pax: 2 },
  });
  assertEquals(r.etichetta, 'Transfer');
  assertEquals(r.riepilogo, 'Padova FS → hotel · 16 set 09:00 · 2 persone');
});

Deno.test('senza dati_originali (chiave assente) non ci sono differenze da segnalare', () => {
  const r = arricchisciRiga({ tipo: 'transfer', dati: { luogo: 'Padova FS' } });
  assertEquals(r.differenze, []);
});

Deno.test('dati_originali null (riga mai corretta) non produce differenze, non un elenco di tutto', () => {
  const r = arricchisciRiga({
    tipo: 'transfer',
    dati: { luogo: 'Padova FS', ora: '09:00', pax: 2 },
    dati_originali: null,
  });
  assertEquals(r.differenze, []);
});

Deno.test('dati_originali diverso da dati produce la differenza vera, con prima e adesso nell ordine giusto', () => {
  const r = arricchisciRiga({
    tipo: 'transfer',
    dati_originali: { luogo: 'Padova FS', ora: '09:00' },
    dati: { luogo: 'Padova FS', ora: '10:30' },
  });
  assertEquals(r.differenze.length, 1);
  assertEquals(r.differenze[0].campo, 'Ora');
  /* uno scambio degli argomenti a differenze() li ribalterebbe: questa
     coppia di controlli e' quella che se ne accorgerebbe */
  assertEquals(r.differenze[0].prima, '09:00');
  assertEquals(r.differenze[0].adesso, '10:30');
});

Deno.test('dati_originali uguale a dati (a parte l ordine delle voci) non produce differenze', () => {
  const r = arricchisciRiga({
    tipo: 'trattamenti',
    dati_originali: { voci: ['Shiatzu', 'Antistress'], giorno: '2026-08-21' },
    dati: { voci: ['Antistress', 'Shiatzu'], giorno: '2026-08-21' },
  });
  assertEquals(r.differenze, []);
});

Deno.test('i campi della riga originale (numero, stato...) restano intatti', () => {
  const r = arricchisciRiga({ numero: 'RS-2026-0001', stato: 'nuova', tipo: 'transfer', dati: {} });
  assertEquals(r.numero, 'RS-2026-0001');
  assertEquals(r.stato, 'nuova');
});

Deno.test('arricchisciElenco arricchisce ogni riga dell elenco, nell ordine ricevuto', () => {
  const righe = arricchisciElenco([
    { tipo: 'greenfee', dati: { circolo_nome: 'Montecchia', data: '2026-09-10', ora: '09:30', giocatori: 2 } },
    { tipo: 'maestro', dati: { data: '2026-09-10', ora: '09:30', persone: 2, livello: 'principiante' } },
  ]);
  assertEquals(righe.length, 2);
  assertEquals(righe[0].etichetta, 'Green fee');
  assertEquals(righe[1].etichetta, 'Maestro');
});
