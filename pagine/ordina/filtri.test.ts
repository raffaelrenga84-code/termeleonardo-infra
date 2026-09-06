/* ============================================================
   filtri.test.ts — la scelta rapida del menu dal QR.

   Quattro spunte della reception (senza glutine, vegetariano, vegano, senza
   lattosio), una lista gia' aperta sopra le categorie del cibo con i piatti
   marcati e le loro etichette (la proprieta', 6 settembre 2026). Dagli
   allergeni non si deduce niente; una sigla scritta pero' frena una spunta
   sbagliata.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';
import { etichetteDi, FILTRI, passaFiltro, sceltaRapida, TESTI_FILTRI } from './filtri.js';

const penne = { id: 'p', nome: 'Penne Glutenfree', allergeni: '', senza_glutine: true };
const pinsa = { id: 'i', nome: 'Pinsa vegetariana', allergeni: 'GL-LA', vegetariano: true };
const burger = { id: 'b', nome: 'Veggie', allergeni: 'GL', vegano: true };
const bistecca = { id: 's', nome: 'Bistecca', allergeni: '' };
const vino = { id: 'v', nome: 'Vino', allergeni: null };

Deno.test('senza glutine e senza lattosio sono spunte, non deduzioni: una bistecca senza allergeni non e un prodotto senza glutine', () => {
  assert(passaFiltro(penne, 'glutine'));
  assert(!passaFiltro(bistecca, 'glutine'), 'niente GL scritto ma nessuna spunta: non compare');
  assert(!passaFiltro(vino, 'glutine'));
  assert(!passaFiltro({ ...penne, senza_glutine: 'si' }, 'glutine'), 'solo il vero booleano');
  assert(passaFiltro({ ...bistecca, senza_lattosio: true }, 'lattosio'));
  assert(!passaFiltro(bistecca, 'lattosio'));
});

Deno.test('una sigla scritta frena una spunta sbagliata: GL scritto e spunta senza glutine non passa', () => {
  assert(!passaFiltro({ ...pinsa, senza_glutine: true }, 'glutine'), 'GL e scritto: la spunta non vince');
  assert(!passaFiltro({ ...pinsa, senza_lattosio: true }, 'lattosio'), 'LA e scritto');
  assert(passaFiltro({ ...burger, senza_lattosio: true }, 'lattosio'), 'GL scritto ma non LA: senza lattosio passa');
  assert(passaFiltro({ ...bistecca, allergeni: null, senza_glutine: true }, 'glutine'), 'senza allergeni scritti la spunta vale');
});

Deno.test('vegetariano e vegano: solo le spunte; un vegano e anche vegetariano', () => {
  assert(passaFiltro(pinsa, 'vegetariano'));
  assert(passaFiltro(burger, 'vegetariano'), 'vegano, quindi anche vegetariano');
  assert(passaFiltro(burger, 'vegano'));
  assert(!passaFiltro(pinsa, 'vegano'), 'vegetariano non vuol dire vegano');
  assert(!passaFiltro(bistecca, 'vegetariano'));
  assert(!passaFiltro({ ...burger, vegano: 'si' }, 'vegano'), 'solo il vero booleano');
});

Deno.test('un filtro sconosciuto non passa niente, e l ordine delle etichette e fisso', () => {
  assert(!passaFiltro(penne, 'altro'));
  assert(!passaFiltro(null, 'glutine'));
  assertEquals(FILTRI, ['glutine', 'vegetariano', 'vegano', 'lattosio']);
});

Deno.test('le etichette di un piatto, nell ordine fisso', () => {
  assertEquals(etichetteDi(penne), ['glutine']);
  assertEquals(etichetteDi(burger), ['vegetariano', 'vegano']);
  assertEquals(etichetteDi({ ...burger, senza_lattosio: true }), ['vegetariano', 'vegano', 'lattosio']);
  assertEquals(etichetteDi(bistecca), []);
  assertEquals(etichetteDi(vino), []);
});

Deno.test('la scelta rapida sono i piatti con almeno un etichetta, nell ordine del menu', () => {
  assertEquals(sceltaRapida([bistecca, penne, vino, burger, pinsa]).map((a) => a.id), ['p', 'b', 'i']);
  assertEquals(sceltaRapida([bistecca, vino]), []);
  assertEquals(sceltaRapida([]), []);
  assertEquals(sceltaRapida(null), []);
});

Deno.test('i testi ci sono nelle quattro lingue, per le quattro etichette e il titolo', () => {
  for (const l of ['it', 'en', 'de', 'fr']) {
    const t = (TESTI_FILTRI as Record<string, Record<string, string>>)[l];
    assert(t, l);
    for (const k of [...FILTRI, 'titolo']) assert(typeof t[k] === 'string' && t[k].length > 2, l + ' ' + k);
  }
  assertEquals(TESTI_FILTRI.it.glutine, 'Senza glutine');
  assertEquals(TESTI_FILTRI.it.vegetariano, 'Vegetariano');
  assertEquals(TESTI_FILTRI.it.vegano, 'Vegano');
  assertEquals(TESTI_FILTRI.it.lattosio, 'Senza lattosio');
});
