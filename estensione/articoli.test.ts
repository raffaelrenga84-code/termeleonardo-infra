/* ============================================================
   articoli.test.ts — gli articoli di Fidra al POS (v2.27.0).

   Il modulo gira SOLO sulla pagina degli articoli di Fidra
   (admin/resources/items), legge la tabella pagina per pagina e la manda
   alla funzione pos, che decide stampante e portata. Su Fidra non scrive
   niente: l'unico clic e' «Prossimo».
   ============================================================ */
import { assert } from 'jsr:@std/assert';

const S = Deno.readTextFileSync(new URL('./fidra-articoli.js', import.meta.url));
const M = JSON.parse(Deno.readTextFileSync(new URL('./manifest.json', import.meta.url))) as {
  version: string; content_scripts: { matches: string[]; js: string[] }[];
};

Deno.test('gira solo sugli articoli di Fidra e manda a pos?a=importa-menu con la chiave hotel', () => {
  const cs = M.content_scripts.find((c) => c.js.includes('fidra-articoli.js'));
  assert(cs, 'il manifest carica fidra-articoli.js');
  assert(cs.matches.every((m) => m.startsWith('https://leonardo.fidra.cloud/admin/resources/items')), cs.matches.join());
  assert(S.includes('functions/v1/pos?a=importa-menu') && S.includes("'x-hotel-key'"));
  assert(S.includes('thead') && S.includes('Prossimo'), 'legge le intestazioni e scorre le pagine');
});

Deno.test('su Fidra e sola lettura: l unico clic e su Prossimo, nessun submit, nessun fetch verso Fidra', () => {
  const clic = S.match(/\.click\(\)/g) ?? [];
  assert(clic.length === 1, `un solo .click(): ${clic.length}`);
  assert(!/\.submit\(\)|fidra\.cloud\/api|method:\s*'(PUT|DELETE|PATCH)'/.test(S));
  const post = S.match(/fetch\(([^,]+),/g) ?? [];
  assert(post.every((p) => p.includes('FUNZIONE')), 'l unica fetch e verso la funzione pos');
});

Deno.test('la chiave hotel e quella gia salvata dal popup (hotelKey), e con 401 la si richiede', () => {
  assert(S.includes("'hotelKey'") && S.includes('chrome.storage.local'));
  assert(S.includes('401'), 'chiave sbagliata: lo dice');
});

Deno.test('il manifest e almeno alla 2.27.0, quella che ha portato gli articoli', () => {
  /* la versione sale con le altre novita: qui basta che non sia tornata indietro */
  const n = (v: string) => v.split('.').map(Number);
  const [a, b, c] = n(M.version);
  assert(a > 2 || (a === 2 && (b > 27 || (b === 27 && c >= 0))), M.version);
});
