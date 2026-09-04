/* ============================================================
   sala-import.test.ts — «Manda la sala al POS» dalla piantina di Fidra
   (v2.29.0).

   Sulla pagina del POS di Fidra ogni zona (Interno, Hall, Esterno,
   Terrazza) ha i tavoli disegnati al loro posto. Il pulsante legge la
   zona aperta e la manda alla nostra funzione: nome, posti e posizione in
   percentuale. Su Fidra non si tocca niente.
   ============================================================ */
import { assert } from 'jsr:@std/assert';

const S = Deno.readTextFileSync(new URL('./fidra-sala.js', import.meta.url));
const M = JSON.parse(Deno.readTextFileSync(new URL('./manifest.json', import.meta.url))) as {
  version: string; content_scripts: { matches: string[]; js: string[] }[];
};

Deno.test('gira solo sulla pagina POS di Fidra e manda a pos?a=importa-sala con la chiave hotel', () => {
  const cs = M.content_scripts.find((c) => c.js.includes('fidra-sala.js'));
  assert(cs, 'il manifest carica fidra-sala.js');
  assert(cs.matches.every((m) => m.startsWith('https://leonardo.fidra.cloud/pos')), cs.matches.join());
  assert(S.includes('functions/v1/pos?a=importa-sala') && S.includes("'x-hotel-key'") && S.includes("'hotelKey'"));
});

Deno.test('sola lettura su Fidra: nessun clic, nessun salvataggio, una sola fetch verso la nostra funzione', () => {
  assert(!/\.click\(\)|\.submit\(\)|fidra\.cloud\/api/.test(S));
  const chiamate = S.match(/fetch\(([^,]+),/g) ?? [];
  assert(chiamate.length === 1 && chiamate[0].includes('FUNZIONE'), 'una fetch, verso FUNZIONE');
});

Deno.test('la posizione e in percentuale del riquadro della pianta, non in pixel', () => {
  assert(S.includes('getBoundingClientRect()') && S.includes('offsetParent'), 'si misura il cerchio dentro la pianta');
  assert(/\* 100/.test(S), 'e si converte in percentuale');
  assert(S.includes('selectedCategory'), 'la zona aperta si riconosce dall indirizzo');
});

Deno.test('locale e zona si vedono e si possono correggere prima di mandare', () => {
  assert(S.includes('leoSalaLocale') && S.includes('leoSalaZona'), 'due campi nella barra');
  assert(S.includes('chrome.storage.local.set'), 'il locale scelto si ricorda');
});

Deno.test('il manifest e alla 2.29.0', () => {
  assert(M.version === '2.29.0', M.version);
});
