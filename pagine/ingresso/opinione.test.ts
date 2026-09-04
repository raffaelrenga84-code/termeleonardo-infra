/* ============================================================
   opinione.test.ts — le parole del percorso «La sua opinione» sul totem,
   nelle quattro lingue. Modulo puro (opinione.js).
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';
import { TEMI_OPINIONE, testiOpinione } from './opinione.js';

const CHIAVI = ['scegliLingua', 'stelleTitolo', 'stelleSotto', 'repartiTitolo', 'repartiSotto', 'temiBene', 'temiMale', 'commentoTitolo', 'commentoSotto', 'salta', 'avanti', 'indietro',
  'chiTitolo', 'chiTessera', 'chiAnonimo', 'invio', 'grazie', 'grazieTesto', 'google', 'errore', 'privacy'];

Deno.test('le quattro lingue hanno le stesse chiavi, tutte piene', () => {
  const it = testiOpinione('it');
  for (const k of CHIAVI) assert(typeof it[k] === 'string' && it[k].length > 0, `it.${k}`);
  for (const l of ['en', 'de', 'fr']) {
    const t = testiOpinione(l);
    assertEquals(Object.keys(t).sort(), Object.keys(it).sort(), l);
    for (const k of CHIAVI) assert(t[k] && t[k] !== it[k], `${l}.${k} non tradotta`);
  }
});

Deno.test('una lingua sconosciuta torna l italiano', () => {
  assertEquals(testiOpinione('xx').grazie, testiOpinione('it').grazie);
});

Deno.test('sette temi, nell ordine della funzione, con un etichetta in ogni lingua', () => {
  assertEquals(TEMI_OPINIONE, ['camera', 'cure', 'piscine', 'ristorante', 'personale', 'pulizia', 'prezzo']);
  for (const l of ['it', 'en', 'de', 'fr']) {
    const t = testiOpinione(l);
    for (const k of TEMI_OPINIONE) assert(t.temi[k], `${l}: manca il tema ${k}`);
  }
});
