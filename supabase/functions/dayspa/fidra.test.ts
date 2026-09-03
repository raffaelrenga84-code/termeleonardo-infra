/* ============================================================
   fidra.test.ts — i posti letti dall'API del sito precedente.

   «Da disponibilita' puoi aggiornarla con questa:
   termeleonardo.com/it/api/1/availability» (la proprieta', 3 settembre
   2026). Finche' la reception carica i posti in Fidra, il nostro back
   office li puo' leggere da li' invece di ribatterli. L'API risponde con
   una riga per giorno e variante: Feriale, Pre-Festivo e Festivo sono la
   fascia giornaliera coi tre tipi; Serale e' la fascia serale. `amount`
   sono i posti ancora liberi in Fidra, `sale_price` il prezzo in
   centesimi.

   I posti da caricare da noi sono i liberi di Fidra PIU' quelli gia'
   venduti da noi: Fidra non sa delle nostre vendite, e senza questa
   somma ogni lettura cancellerebbe i nostri.
   ============================================================ */
import { assertEquals } from 'jsr:@std/assert';
import { righeDaFidra, URL_FIDRA } from './fidra.ts';

/* risposta vera del 3 settembre 2026, ridotta ai campi che contano */
const RISPOSTA = [
  { date: '2026-09-04', amount: 30, sale_price: 2900, title: 'Serale h.18-22:30', product_variation: { name: 'Serale' } },
  { date: '2026-09-04', amount: 11, sale_price: 3500, title: 'Giornaliero h.9-18:30', product_variation: { name: 'Feriale' } },
  { date: '2026-09-05', amount: 32, sale_price: 4500, title: 'Giornaliero h.9-18:30', product_variation: { name: 'Pre-Festivo' } },
  { date: '2026-09-06', amount: 44, sale_price: 4500, title: 'Giornaliero h.9-18:30', product_variation: { name: 'Festivo' } },
  { date: '2026-09-07', amount: 30, sale_price: 3500, title: 'Giornaliero h.9-18:30', product_variation: { name: 'Feriale' } },
];

Deno.test('ogni riga di Fidra diventa una riga nostra: fascia, tipo, posti, prezzo', () => {
  const righe = righeDaFidra(RISPOSTA, () => 0);
  assertEquals(righe.length, 5);
  assertEquals(righe[0], { giorno: '2026-09-04', fascia: 'serale', tipo: 'feriale', posti: 30, prezzo_cent: 2900, liberiFidra: 30 });
  assertEquals(righe[1], { giorno: '2026-09-04', fascia: 'giornaliero', tipo: 'feriale', posti: 11, prezzo_cent: 3500, liberiFidra: 11 });
  assertEquals(righe[2].tipo, 'prefestivo');
  assertEquals(righe[3].tipo, 'festivo');
});

Deno.test('il serale di sabato e prefestivo: il tipo del giorno lo dice il calendario, non la variante', () => {
  const r = righeDaFidra([{ date: '2026-09-05', amount: 25, sale_price: 2900, product_variation: { name: 'Serale' } }], () => 0);
  assertEquals(r[0].fascia, 'serale');
  assertEquals(r[0].tipo, 'prefestivo');
});

Deno.test('i posti da caricare sono i liberi di Fidra piu quelli gia venduti da noi', () => {
  const venduti = (giorno: string, fascia: string) => giorno === '2026-09-04' && fascia === 'giornaliero' ? 3 : 0;
  const r = righeDaFidra(RISPOSTA, venduti);
  assertEquals(r[1].posti, 14);
  assertEquals(r[1].liberiFidra, 11);
  assertEquals(r[0].posti, 30);
});

Deno.test('righe strane si ignorano: variante sconosciuta, data non valida, amount non numero, risposta non elenco', () => {
  const r = righeDaFidra([
    { date: '2026-09-04', amount: 5, sale_price: 100, product_variation: { name: 'Abbonamento' } },
    { date: 'ieri', amount: 5, sale_price: 100, product_variation: { name: 'Feriale' } },
    { date: '2026-09-04', amount: 'tanti', sale_price: 100, product_variation: { name: 'Feriale' } },
    { date: '2026-09-04', amount: 0, sale_price: 3500, product_variation: { name: 'Feriale' } },
  ], () => 0);
  assertEquals(r.length, 1, 'solo la riga con zero posti, che e valida: esaurito in Fidra');
  assertEquals(r[0].posti, 0);
  assertEquals(righeDaFidra(null, () => 0), []);
  assertEquals(righeDaFidra({ errore: 'x' }, () => 0), []);
});

Deno.test('l indirizzo dell API e quello del sito precedente, per un intervallo e una persona', () => {
  assertEquals(URL_FIDRA('2026-09-04', '2026-09-10'),
    'https://www.termeleonardo.com/it/api/1/availability?from_date=2026-09-04&to_date=2026-09-10&people=1');
});
