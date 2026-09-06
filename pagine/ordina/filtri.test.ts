/* ============================================================
   filtri.test.ts — la scelta rapida del menu dal QR.

   «Metterei un filtro: prodotti senza glutine, vegani e senza lattosio,
   cosi' fanno prima a scegliere; sono due o tre prodotti» (la proprieta',
   6 settembre 2026). Senza glutine e senza lattosio si leggono dagli
   allergeni del menu stampato (GL, LA); vegano da una spunta a parte.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';
import { FILTRI, filtriDisponibili, passaFiltro, TESTI_FILTRI } from './filtri.js';

const penne = { id: 'p', nome: 'Penne Glutenfree', allergeni: '' };
const pinsa = { id: 'i', nome: 'Pinsa', allergeni: 'GL-LA' };
const burger = { id: 'b', nome: 'Veggie', allergeni: 'GL', vegano: true };
const frittata = { id: 'f', nome: 'Frittata', allergeni: 'U', vegetariano: true };
const vino = { id: 'v', nome: 'Vino', allergeni: null };

Deno.test('senza glutine: solo chi ha gli allergeni SCRITTI e senza GL — chi non li ha scritti non si promette', () => {
  assert(passaFiltro(penne, 'glutine'), 'allergeni scritti e vuoti: senza glutine');
  assert(!passaFiltro(pinsa, 'glutine'), 'GL dentro');
  assert(!passaFiltro(vino, 'glutine'), 'allergeni mai scritti: non si sa, quindi no — un celiaco non si tradisce');
  assert(!passaFiltro({ id: 'x', nome: 'x' }, 'glutine'));
});

Deno.test('senza lattosio: stessa regola, su LA', () => {
  assert(passaFiltro(penne, 'lattosio'));
  assert(passaFiltro(burger, 'lattosio'), 'GL ma non LA');
  assert(!passaFiltro(pinsa, 'lattosio'));
  assert(!passaFiltro(vino, 'lattosio'));
});

Deno.test('vegano: solo la spunta, mai dedotto dagli allergeni', () => {
  assert(passaFiltro(burger, 'vegano'));
  assert(!passaFiltro(penne, 'vegano'), 'senza allergeni non vuol dire vegano');
  assert(!passaFiltro({ ...burger, vegano: false }, 'vegano'));
  assert(!passaFiltro({ ...burger, vegano: 'si' }, 'vegano'), 'solo il vero booleano');
});

Deno.test('vegetariano: la spunta, e anche chi e vegano (un vegano e anche vegetariano)', () => {
  assert(passaFiltro(frittata, 'vegetariano'));
  assert(passaFiltro(burger, 'vegetariano'), 'vegano, quindi anche vegetariano');
  assert(!passaFiltro(frittata, 'vegano'), 'vegetariano non vuol dire vegano');
  assert(!passaFiltro(penne, 'vegetariano'), 'senza spunta no, anche senza allergeni');
});

Deno.test('un filtro sconosciuto non passa niente', () => {
  assert(!passaFiltro(penne, 'altro'));
  assertEquals(FILTRI, ['glutine', 'vegetariano', 'vegano', 'lattosio']);
});

Deno.test('si offrono solo i filtri che hanno almeno un piatto, nell ordine fisso', () => {
  assertEquals(filtriDisponibili([penne, pinsa, vino]), ['glutine', 'lattosio']);
  assertEquals(filtriDisponibili([burger]), ['vegetariano', 'vegano', 'lattosio']);
  assertEquals(filtriDisponibili([frittata]), ['glutine', 'vegetariano', 'lattosio'], 'la frittata ha le uova scritte e niente GL: e anche senza glutine');
  assertEquals(filtriDisponibili([vino]), []);
  assertEquals(filtriDisponibili([]), []);
});

Deno.test('i testi ci sono nelle quattro lingue, per i tre filtri e il titolo', () => {
  for (const l of ['it', 'en', 'de', 'fr']) {
    const t = (TESTI_FILTRI as Record<string, Record<string, string>>)[l];
    assert(t, l);
    for (const k of [...FILTRI, 'titolo', 'nessuno']) assert(typeof t[k] === 'string' && t[k].length > 2, l + ' ' + k);
  }
  assertEquals(TESTI_FILTRI.it.glutine, 'Senza glutine');
  assertEquals(TESTI_FILTRI.it.vegetariano, 'Vegetariano');
  assertEquals(TESTI_FILTRI.it.vegano, 'Vegano');
  assertEquals(TESTI_FILTRI.it.lattosio, 'Senza lattosio');
});
