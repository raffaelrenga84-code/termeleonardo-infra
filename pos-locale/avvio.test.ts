/* ============================================================
   avvio.test.ts — il supervisore del PC del Bistrot: le regole, e il
   ripristino su una cartella vera (temporanea).
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';
import { AGGIORNATO, ATTESA_MS, CADUTE_MASSIME, decisione, POCO_MS, ripristina } from './avvio.ts';

Deno.test('dopo un aggiornamento si riparte subito; dopo una caduta si aspetta; alla terza di fila si ripristina', () => {
  assertEquals(decisione({ codice: AGGIORNATO, durataMs: 100, cadute: 2 }), { cosa: 'riparti', cadute: 0, attesaMs: 0 });
  assertEquals(decisione({ codice: 1, durataMs: POCO_MS * 10, cadute: 2 }), { cosa: 'riparti', cadute: 0, attesaMs: ATTESA_MS }, 'una caduta dopo tanto tempo non conta');
  assertEquals(decisione({ codice: 1, durataMs: 500, cadute: 0 }), { cosa: 'riparti', cadute: 1, attesaMs: ATTESA_MS });
  assertEquals(decisione({ codice: 1, durataMs: 500, cadute: 1 }), { cosa: 'riparti', cadute: 2, attesaMs: ATTESA_MS });
  assertEquals(decisione({ codice: 1, durataMs: 500, cadute: 2 }), { cosa: 'ripristina', cadute: 0, attesaMs: ATTESA_MS });
  assertEquals(CADUTE_MASSIME, 3);
});

Deno.test('ripristina: rimette src.vecchio e pagina.vecchio, torna alla versione di prima, lascia traccia; senza vecchio non fa niente', () => {
  const dir = Deno.makeTempDirSync({ prefix: 'avvio-' });
  const scrivi = (p: string, t: string) => { Deno.mkdirSync(`${dir}/${p}`.replace(/\/[^/]*$/, ''), { recursive: true }); Deno.writeTextFileSync(`${dir}/${p}`, t); };
  const leggi = (p: string): string | null => { try { return Deno.readTextFileSync(`${dir}/${p}`); } catch { return null; } };
  assertEquals(ripristina(dir), false, 'niente da rimettere');
  scrivi('src/pos-locale/main.ts', 'rotto'); scrivi('pagina/index.html', 'rotta');
  scrivi('src.vecchio/pos-locale/main.ts', 'buono'); scrivi('pagina.vecchio/index.html', 'buona');
  scrivi('VERSIONE.txt', '2026-09-06T18:00:00.000Z\n'); scrivi('VERSIONE.vecchio.txt', '2026-09-06T17:00:00.000Z\n');
  assertEquals(ripristina(dir), true);
  assertEquals(leggi('src/pos-locale/main.ts'), 'buono');
  assertEquals(leggi('pagina/index.html'), 'buona');
  assertEquals(leggi('VERSIONE.txt'), '2026-09-06T17:00:00.000Z\n');
  assertEquals(leggi('src.rotto/pos-locale/main.ts'), 'rotto', 'il rotto resta accanto, da guardare');
  const traccia = leggi('RIPRISTINO.txt') ?? '';
  assert(traccia.includes('2026-09-06T18:00:00.000Z') && traccia.includes('rimessa la 2026-09-06T17:00:00.000Z'), traccia);
  assertEquals(leggi('src.vecchio/pos-locale/main.ts'), null);
  assertEquals(ripristina(dir), false, 'una volta sola: il vecchio non c e piu');
  Deno.removeSync(dir, { recursive: true });
});
