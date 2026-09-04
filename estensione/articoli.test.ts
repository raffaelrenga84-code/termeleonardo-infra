/* ============================================================
   articoli.test.ts — gli articoli di Fidra al POS (v2.27.0).

   Il modulo gira SOLO sulla pagina degli articoli di Fidra
   (admin/resources/item-variations, il listino coi prezzi), la legge pagina
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
  assert(cs.matches.every((m) => m.startsWith('https://leonardo.fidra.cloud/admin/resources/item')), cs.matches.join());
  assert(S.includes('functions/v1/pos?a=importa-menu') && S.includes("'x-hotel-key'"));
  assert(S.includes('intestazioni') && S.includes('righe'), 'manda intestazioni e righe, come le vuole la funzione');
});

Deno.test('su Fidra si chiede e basta: nessuna scrittura, l unico clic resta Prossimo', () => {
  const clic = S.match(/\.click\(\)/g) ?? [];
  assert(clic.length === 1, `un solo .click(): ${clic.length}`);
  assert(!/\.submit\(\)|method:\s*'(PUT|DELETE|PATCH)'/.test(S), 'niente scritture');
  /* la tabella di Fidra la disegna il browser: l elenco si chiede allo
     stesso indirizzo che usa Fidra (Laravel Nova), con la sessione della
     reception; se non risponde, si torna a leggere lo schermo */
  assert(S.includes('/nova-api') && S.includes("credentials: 'same-origin'"), 'l elenco si chiede a Nova');
  assert(S.includes('daSchermo'), 'e il ripiego resta');
  assert(S.includes('perPage=100'), 'cento per volta, non una pagina alla volta a mano');
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

Deno.test('il listino con i prezzi, non il magazzino dei fornitori', () => {
  /* «items» sono i prodotti dei fornitori e NON hanno prezzo: il listino
     vero e «item-variations», 592 righe (la proprieta', 4 settembre 2026) */
  assert(S.includes("const RISORSA = 'item-variations'"), 'la risorsa giusta');
  assert(S.includes('${base}/${RISORSA}?perPage=100'), 'e la si chiede a Nova cento per volta');
  assert(!S.includes('/items?perPage'), 'il magazzino non si chiede piu');
});
