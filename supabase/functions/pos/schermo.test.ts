/* ============================================================
   schermo.test.ts — il monitor cucina: cosa nasce da stampare, cosa va
   sullo schermo, quando la carta fa da ripiego, e i passi di una comanda.
   «Un monitor per ordini al posto dei biglietti stampati» (la proprieta',
   6 settembre 2026). Puro: nessuna rete, nessun database.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';
import { chiaveCasuale, daMostrare, daRipiegare, impronta, inizioGiornata, passo, prontoInCucina, statoIniziale } from './schermo.ts';

const T = (s: string) => new Date(s);

Deno.test('senza schermo si stampa come oggi; con schermo e carta si stampa e si mostra; solo schermo = a_schermo', () => {
  assertEquals(statoIniziale(null), 'da_stampare', 'nessuna postazione: come oggi');
  assertEquals(statoIniziale({ schermo: false, stampa_sempre: true }), 'da_stampare');
  assertEquals(statoIniziale({ schermo: false, stampa_sempre: false }), 'da_stampare', 'senza schermo la carta esce comunque');
  assertEquals(statoIniziale({ schermo: true, stampa_sempre: true }), 'da_stampare');
  assertEquals(statoIniziale({ schermo: true, stampa_sempre: false }), 'a_schermo');
  assertEquals(statoIniziale({ schermo: 1, stampa_sempre: 0 }), 'a_schermo', 'da SQLite arrivano 0 e 1');
});

Deno.test('il ripiego: a_schermo, mai visto, oltre ripiego_s secondi', () => {
  const s = { stato: 'a_schermo', vista_il: null, creato_il: '2026-09-06T10:00:00.000Z' };
  assertEquals(daRipiegare(s, { ripiego_s: 30 }, T('2026-09-06T10:00:29Z')), false, 'non ancora');
  assertEquals(daRipiegare(s, { ripiego_s: 30 }, T('2026-09-06T10:00:31Z')), true);
  assertEquals(daRipiegare({ ...s, vista_il: '2026-09-06T10:00:05Z' }, { ripiego_s: 30 }, T('2026-09-06T10:05:00Z')), false, 'uno schermo l ha mostrato');
  assertEquals(daRipiegare({ ...s, stato: 'da_stampare' }, { ripiego_s: 30 }, T('2026-09-06T10:05:00Z')), false, 'gia in coda di stampa');
  assertEquals(daRipiegare(s, { ripiego_s: 0 }, T('2026-09-07T10:00:00Z')), false, '0 = mai');
  assertEquals(daRipiegare(s, null, T('2026-09-07T10:00:00Z')), true, 'senza postazione vale il default di 30 s');
});

Deno.test('i passi: presa, pronta, riapri entro due minuti', () => {
  const ora = T('2026-09-06T12:00:00.000Z');
  assertEquals(passo({ presa_il: null, pronta_il: null }, 'presa', ora, 'Banco Bistrot'), { campi: { presa_il: '2026-09-06T12:00:00.000Z' } });
  assertEquals(passo({ presa_il: null, pronta_il: null }, 'pronta', ora, 'Banco Bistrot'), { campi: { presa_il: '2026-09-06T12:00:00.000Z', pronta_il: '2026-09-06T12:00:00.000Z', pronta_da: 'Banco Bistrot' } }, 'pronta senza presa: presa nello stesso istante');
  assertEquals(passo({ presa_il: '2026-09-06T11:58:00.000Z', pronta_il: null }, 'pronta', ora, 'Banco Bistrot'), { campi: { pronta_il: '2026-09-06T12:00:00.000Z', pronta_da: 'Banco Bistrot' } }, 'la presa resta quella vera');
  assertEquals(passo({ presa_il: '2026-09-06T11:58:00.000Z', pronta_il: '2026-09-06T11:59:00.000Z' }, 'riapri', ora, 'x'), { campi: { pronta_il: null, pronta_da: null } });
  assertEquals(passo({ presa_il: null, pronta_il: '2026-09-06T11:57:59.000Z' }, 'riapri', ora, 'x'), { errore: 'troppo tardi per riaprire', stato: 409 });
  assertEquals(passo({ presa_il: null, pronta_il: null }, 'riapri', ora, 'x'), { errore: 'troppo tardi per riaprire', stato: 409 }, 'non era pronta');
  assertEquals(passo({}, 'salta', ora, 'x'), { errore: 'passo sconosciuto', stato: 400 });
});

Deno.test('oggi comincia alle quattro del mattino, ora di Roma', () => {
  /* stessa regola della sala: alle 3 di notte si e' ancora nella giornata di ieri */
  const alle10 = inizioGiornata(T('2026-09-06T08:00:00Z'), 10 * 60);
  assertEquals(alle10.toISOString(), '2026-09-06T02:00:00.000Z', 'le 4 di Roma in estate sono le 2 UTC');
  const alle3 = inizioGiornata(T('2026-09-06T01:00:00Z'), 3 * 60);
  assertEquals(alle3.toISOString(), '2026-09-05T02:00:00.000Z');
  assert(daMostrare({ pronta_il: null, creato_il: '2026-09-06T05:00:00Z' }, alle10));
  assert(!daMostrare({ pronta_il: null, creato_il: '2026-09-06T01:00:00Z' }, alle10), 'di ieri');
  assert(!daMostrare({ pronta_il: '2026-09-06T06:00:00Z', creato_il: '2026-09-06T05:00:00Z' }, alle10), 'gia pronta');
});

Deno.test('pronto in cucina per venti minuti, con l ora dell ultima', () => {
  const ora = T('2026-09-06T12:30:00Z');
  assertEquals(prontoInCucina([], ora), { pronto: false, alle: null });
  assertEquals(prontoInCucina([{ pronta_il: '2026-09-06T12:15:00.000Z' }, { pronta_il: null }], ora), { pronto: true, alle: '2026-09-06T12:15:00.000Z' });
  assertEquals(prontoInCucina([{ pronta_il: '2026-09-06T12:09:00.000Z' }], ora), { pronto: false, alle: null }, 'passati i venti minuti');
  assertEquals(prontoInCucina([{ pronta_il: '2026-09-06T12:11:00.000Z' }, { pronta_il: '2026-09-06T12:20:00.000Z' }], ora).alle, '2026-09-06T12:20:00.000Z', 'l ultima');
});

Deno.test('la chiave dello schermo: casuale, leggibile, e si conserva solo l impronta', async () => {
  const k = chiaveCasuale();
  assert(/^[A-HJ-NP-Z2-9]{16}$/.test(k), k);
  assert(chiaveCasuale() !== k);
  const h = await impronta('ABCDEFGHJKLMNPQR');
  assertEquals(h.length, 64);
  assertEquals(h, await impronta('ABCDEFGHJKLMNPQR'), 'stabile');
  assert(h !== await impronta('ABCDEFGHJKLMNPQ2'));
});
