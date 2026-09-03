/* ============================================================
   calendario.test.ts — il calendario a due tocchi di Prenota.

   PERCHE'. Le date erano due campi nativi del telefono, arrivo e partenza
   separati: due pannelli, il secondo che si apre su oggi, nessun conto delle
   notti, nessun segno dei giorni chiusi. «Poco intuitivo» (la proprieta', 3
   settembre 2026). Qui si provano le regole pure del calendario: la griglia
   dei mesi, lo stato di ogni giorno, la macchina dei due tocchi, il
   riassunto nelle quattro lingue. «Oggi» arriva sempre dall'esterno.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';
import * as cal from './calendario.js';

/* il modulo e' JavaScript: i tipi che TypeScript deduce dai valori di default
   (`chiusure = []` diventa `never[]`) rifiuterebbero i dati veri. Qui si
   dichiarano le firme come le vuole chi chiama, una volta. */
type Opz = Record<string, unknown>;
type Mese = { anno: number; mese: number; giorni: { iso: string; giorno: number; colonna: number }[] };
const griglia = cal.griglia as (oggi: string, quanti?: number) => Mese[];
const notti = cal.notti as (a: string, p: string) => number;
const riassunto = cal.riassunto as (s: Opz, l: string) => string;
const suggerimento = cal.suggerimento as (s: Opz, l: string) => string;
const statoGiorno = cal.statoGiorno as unknown as (iso: string, o: Opz) => string;
const tocca = cal.tocca as unknown as (s: Opz, iso: string, o: Opz) => { arrivo: string; partenza: string };
const TESTI = cal.TESTI as Record<string, { giorni: string[]; mesiBrevi: string[]; mesiLunghi: string[]; campo: string; conferma: string; cancella: string; chiusi: string }>;

const OGGI = '2026-09-03';                                   // un giovedì
const CHIUSURE = [{ chiusura: '2026-11-29', riapertura: '2027-02-13' }];
const C = { oggi: OGGI, chiusure: CHIUSURE };

Deno.test('la griglia parte dal mese di oggi, quattordici mesi, settimana da lunedì', () => {
  const g = griglia(OGGI);
  assertEquals(g.length, 14);
  assertEquals([g[0].anno, g[0].mese], [2026, 9]);
  assertEquals([g[13].anno, g[13].mese], [2027, 10]);
  assertEquals(g[0].giorni.length, 30);
  assertEquals(g[0].giorni[0], { iso: '2026-09-01', giorno: 1, colonna: 1 }, 'il 1 settembre 2026 e un martedì: colonna 1');
  assertEquals(g[1].giorni[0].colonna, 3, 'il 1 ottobre 2026 e un giovedì');
  assertEquals(griglia(OGGI, 3).length, 3);
});

Deno.test('lo stato di ogni giorno', () => {
  const s = (iso: string, scelta: Record<string, string> = {}) => statoGiorno(iso, { ...C, ...scelta });
  assertEquals(s('2026-09-02'), 'passato');
  assertEquals(s('2026-09-03'), 'libero', 'oggi e libero: decide dopo chiusoPerOggi');
  assertEquals(s('2026-12-15'), 'chiuso');
  assertEquals(s('2026-11-29'), 'chiuso', 'il primo giorno di chiusura');
  assertEquals(s('2027-02-13'), 'libero', 'il giorno di riapertura e libero');
  assertEquals(s('2026-10-10', { arrivo: '2026-10-10', partenza: '2026-10-14' }), 'arrivo');
  assertEquals(s('2026-10-14', { arrivo: '2026-10-10', partenza: '2026-10-14' }), 'partenza');
  assertEquals(s('2026-10-12', { arrivo: '2026-10-10', partenza: '2026-10-14' }), 'dentro');
  assertEquals(s('2026-10-20', { arrivo: '2026-10-10', partenza: '2026-10-14' }), 'libero');
});

Deno.test('due tocchi: arrivo, poi partenza; un terzo ricomincia', () => {
  let sc = tocca({ arrivo: '', partenza: '' }, '2026-10-10', C);
  assertEquals(sc, { arrivo: '2026-10-10', partenza: '' });
  sc = tocca(sc, '2026-10-14', C);
  assertEquals(sc, { arrivo: '2026-10-10', partenza: '2026-10-14' });
  sc = tocca(sc, '2026-10-20', C);
  assertEquals(sc, { arrivo: '2026-10-20', partenza: '' }, 'con tutte e due scelte si ricomincia');
});

Deno.test('un tocco prima dell arrivo, o sull arrivo, diventa il nuovo arrivo', () => {
  assertEquals(tocca({ arrivo: '2026-10-10', partenza: '' }, '2026-10-05', C), { arrivo: '2026-10-05', partenza: '' });
  assertEquals(tocca({ arrivo: '2026-10-10', partenza: '' }, '2026-10-10', C), { arrivo: '2026-10-10', partenza: '' });
});

Deno.test('passato e chiuso non si toccano; un intervallo sopra la chiusura non si accetta', () => {
  const sc = { arrivo: '2026-10-10', partenza: '' };
  assertEquals(tocca(sc, '2026-09-01', C), sc, 'passato');
  assertEquals(tocca(sc, '2026-12-15', C), sc, 'chiuso');
  assertEquals(tocca({ arrivo: '2026-11-25', partenza: '' }, '2027-02-15', C), { arrivo: '2027-02-15', partenza: '' },
    'la partenza dopo la riapertura con l arrivo prima della chiusura: si riparte da quel giorno');
});

Deno.test('le notti e il riassunto nelle quattro lingue', () => {
  assertEquals(notti('2027-02-13', '2027-02-17'), 4);
  const sc = { arrivo: '2027-02-13', partenza: '2027-02-17' };
  assertEquals(riassunto(sc, 'it'), 'sab 13 feb → mer 17 feb · 4 notti');
  assertEquals(riassunto(sc, 'de'), 'Sa 13. Feb → Mi 17. Feb · 4 Nächte');
  assertEquals(riassunto(sc, 'en'), 'Sat 13 Feb → Wed 17 Feb · 4 nights');
  assertEquals(riassunto(sc, 'fr'), 'sam 13 févr → mer 17 févr · 4 nuits');
  assertEquals(riassunto({ arrivo: '2026-10-05', partenza: '2026-10-06' }, 'it'), 'lun 5 ott → mar 6 ott · 1 notte');
  assertEquals(riassunto({ arrivo: '2027-02-13', partenza: '' }, 'it'), 'sab 13 feb → …');
  assertEquals(riassunto({ arrivo: '', partenza: '' }, 'it'), '');
  assertEquals(suggerimento({ arrivo: '', partenza: '' }, 'it'), 'Scelga il giorno di arrivo');
  assertEquals(suggerimento({ arrivo: '2027-02-13', partenza: '' }, 'it'), 'Ora il giorno di partenza');
  assertEquals(suggerimento(sc, 'it'), '');
  for (const l of ['it', 'de', 'en', 'fr'] as const) {
    assertEquals(TESTI[l].giorni.length, 7);
    assertEquals(TESTI[l].mesiBrevi.length, 12);
    assertEquals(TESTI[l].mesiLunghi.length, 12);
    assert(TESTI[l].campo && TESTI[l].conferma && TESTI[l].cancella && TESTI[l].chiusi, l);
  }
});
