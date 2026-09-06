/* ============================================================
   tv.test.ts — pagine/cucina/tv.html e' la pagina dello schermo tradotta
   per i browser vecchi delle TV (strumenti/cucina-tv.js). Non si scrive
   a mano: si rigenera. Qui si controlla che sia al passo con index.html,
   schermo.js e server.js, e che non contenga cio' che una TV vecchia non
   capisce (moduli, import, «?.», «??»).
   ============================================================ */
import { assert } from 'jsr:@std/assert';
import { crypto } from 'jsr:@std/crypto';

const leggi = (p: string) => Deno.readTextFileSync(new URL(p, import.meta.url)).replace(/\r\n/g, '\n');
const TV = leggi('./tv.html');

async function impronta(): Promise<string> {
  const testo = ['./index.html', './schermo.js', '../pos/server.js'].map(leggi).join('');
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(testo));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('').slice(0, 16);
}

Deno.test('tv.html e rigenerata dall ultimo index.html (impronta uguale): se e rossa, node strumenti/cucina-tv.js', async () => {
  const m = TV.match(/impronta:([0-9a-f]{16})/);
  assert(m, 'manca l impronta: tv.html non viene da strumenti/cucina-tv.js');
  assert(m![1] === await impronta(), 'tv.html e vecchia: rigenerarla con node strumenti/cucina-tv.js');
});

Deno.test('tv.html non ha niente che una TV vecchia non capisca', () => {
  const copione = (TV.match(/<script>\n([\s\S]*?)<\/script>/) ?? ['', ''])[1];
  assert(copione.length > 10000, 'il copione tradotto c e');
  assert(!TV.includes('type="module"') && !/^\s*import /m.test(copione), 'niente moduli');
  assert(!copione.includes('?.') && !copione.includes('??'), 'niente «?.» ne «??»');
  assert(!/\basync\b/.test(copione), 'niente async/await: riscritti per un motore vecchio');
  assert(copione.includes('Tocca per iniziare') && copione.includes('x-schermo-chiave'), 'ed e la stessa pagina');
});
