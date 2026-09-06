/* ============================================================
   bacheca.test.ts — le regole della bacheca all'ingresso (6 settembre 2026).
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';
import { candidatiCalice, giornoRoma, GIORNI, nomeCalice, scegliCalice, testoBacheca, TESTO_MASSIMO } from './bacheca.ts';

Deno.test('il giorno e quello di Roma: alle 22:30 UTC del 6 settembre a Roma e gia lunedi 7', () => {
  assertEquals(giornoRoma(new Date('2026-09-06T17:00:00Z')), { giorno: 7, nome: 'domenica', data: '2026-09-06' });
  assertEquals(giornoRoma(new Date('2026-09-06T22:30:00Z')), { giorno: 1, nome: 'lunedì', data: '2026-09-07' });
  assertEquals(giornoRoma(new Date('2026-01-15T12:00:00Z')), { giorno: 4, nome: 'giovedì', data: '2026-01-15' });
  assertEquals(GIORNI.length, 7);
});

Deno.test('il testo scritto a mano: righe pulite, vuoto = null, mai oltre il massimo', () => {
  assertEquals(testoBacheca('  Tagliatelle al ragù \r\n\r\n  con funghi porcini  '), 'Tagliatelle al ragù\ncon funghi porcini');
  assertEquals(testoBacheca(''), null);
  assertEquals(testoBacheca('   \n  '), null);
  assertEquals(testoBacheca(null), null);
  assertEquals(testoBacheca('x'.repeat(500))?.length, TESTO_MASSIMO);
});

Deno.test('i candidati: solo le categorie col calice, non esauriti, senza mezze bottiglie e senza «del giorno»', () => {
  const categorie = [{ id: 'cal', nome: 'Vini al calice' }, { id: 'bianchi', nome: 'Vino Bianco' }, { id: 'birre', nome: 'Birre' }];
  const articoli = [
    { id: 1, nome: 'CALICE Soave DOC La Campagnola', categoria: 'cal', esaurito: false },
    { id: 2, nome: 'Vino Cl. 0,375 Soave Classico', categoria: 'cal', esaurito: false },
    { id: 3, nome: 'Vino Del Giorno - Bianco', categoria: 'cal', esaurito: false },
    { id: 4, nome: 'CALICE Kerner Palladium', categoria: 'cal', esaurito: true },
    { id: 5, nome: 'Bicch. Prosecco', categoria: 'cal', esaurito: 0 },
    { id: 6, nome: 'Lugana', categoria: 'bianchi', esaurito: false },
    { id: 7, nome: 'CALICE Sauvignon', categoria: 'cal', esaurito: 1 },
  ];
  assertEquals(candidatiCalice(articoli, categorie).map((a) => a.id), [1, 5]);
  assertEquals(candidatiCalice([{ nome: 'x', categoria: 'cal', attivo: 0 }], categorie), []);
});

Deno.test('il nome sulla TV: senza CALICE, Bicch. e «di»; iniziale maiuscola', () => {
  assertEquals(nomeCalice('CALICE Soave DOC La Campagnola'), 'Soave DOC La Campagnola');
  assertEquals(nomeCalice('Calice di vino dei Colli'), 'Vino dei Colli');
  assertEquals(nomeCalice('Bicch. Prosecco'), 'Prosecco');
  assertEquals(nomeCalice('CALICE  VINUCI - DECISO RIESLING'), 'VINUCI - DECISO RIESLING');
  assertEquals(nomeCalice('   '), '');
});

Deno.test('la scelta e a caso ma ferma: stesso seme stesso calice, seme diverso puo cambiare, senza candidati niente', () => {
  const c = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
  const oggi = scegliCalice(c, '2026-09-06|bistrot');
  assert(oggi !== null && c.includes(oggi));
  assertEquals(scegliCalice(c, '2026-09-06|bistrot'), oggi);
  const settimana = new Set(['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05', '2026-09-06', '2026-09-07', '2026-09-08'].map((d) => scegliCalice(c, `${d}|bistrot`)));
  assert(settimana.size > 1, 'in una settimana cambia');
  assertEquals(scegliCalice([], 'x'), null);
});
