/* ============================================================
   pos-menu.test.ts — il menù raccolto dal POS di Fidra.

   La categoria di un articolo, in Fidra, non sta in nessuna lista che si
   possa chiedere: sta solo nella schermata del POS. Indovinarla dal nome
   metteva «Gin Tonic» fra i Cocktail invece che nei Long Drinks (la
   proprieta', 4 settembre 2026). Questo lettore guarda lo schermo mentre
   la reception apre le categorie, e non tocca niente.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';

const S = Deno.readTextFileSync(new URL('./fidra-pos-menu.js', import.meta.url));

Deno.test('sola lettura: nessun clic, nessun ordine, niente scritto in Fidra', () => {
  assert(!/\.click\(\)/.test(S), 'non preme niente');
  assert(!/wire:click=\\?"addItem|selectTable|addProduct/.test(S), 'non aggiunge righe a un tavolo');
  const fetchAltrove = [...S.matchAll(/fetch\(([^,)]*)/g)].map((m) => m[1]);
  assertEquals(fetchAltrove, ['FUNZIONE'], 'l unica chiamata e al nostro POS');
  assert(S.includes('SOLA LETTURA'), 'ed e scritto in cima');
});

Deno.test('legge i prezzi come li scrive Fidra, e scarta il riquadro «Indietro»', () => {
  const PREZZO = /(\d{1,5})[.,](\d{2})\s*€/;
  const centDi = (t: string) => { const m = String(t).match(PREZZO); return m ? Number(m[1]) * 100 + Number(m[2]) : null; };
  assertEquals(centDi('Cuba Libre 8,50 €'), 850);
  assertEquals(centDi('MOET & CHANDON BRUT RISERVA IMPERIAL 0,75L 90,00 €'), 9000);
  assertEquals(centDi('Room Service 2,00 €'), 200);
  assertEquals(centDi('Indietro'), null, 'senza prezzo non e un articolo');
  assert(S.includes('const PREZZO = /(\\d{1,5})[.,](\\d{2})\\s*€/'), 'la stessa regola nel lettore');
});

Deno.test('le categorie si leggono dal pulsante di Fidra, non dal testo indovinato', () => {
  /* wire:click="selectCategory({"id":36,"name":"Long Drinks Alcolici",…})" */
  assert(S.includes('[wire\\\\:click^="selectCategory"]'), 'i pulsanti delle categorie');
  assert(S.includes('JSON.parse(dentro)'), 'il nome viene dal dato, non dal testo');
  assert(S.includes('if (b.getAttribute(\'wire:click\') && /^selectCategory/.test'), 'un pulsante categoria non e un articolo');
});

Deno.test('quello che si raccoglie resta finche non lo si manda, e si puo ricominciare', () => {
  assert(S.includes("const DEPOSITO = 'posMenuRaccolto'"), 'resta nel browser');
  assert(S.includes('chrome.storage.local.get([DEPOSITO])') && S.includes('chrome.storage.local.set'), 'fra una categoria e l altra');
  assert(S.includes('Ricomincia'), 'e si puo svuotare');
  assert(S.includes('categorie su') && S.includes('Ne mancano'), 'la barra dice quante ne mancano');
});

Deno.test('manda al POS nome, categoria e prezzo, con la chiave hotel', () => {
  assert(S.includes("const intestazioni = ['nome', 'categoria', 'prezzo']"), 'le colonne che la funzione riconosce');
  assert(S.includes('righe.push([a.nome, categoria, (a.prezzo_cent / 100).toFixed(2)])'), 'una riga per articolo');
  assert(S.includes("'x-hotel-key': hotelKey"), 'la chiave hotel');
  assert(S.includes("a=importa-menu"), 'la stessa porta di prima');
});

Deno.test('la barra sta in basso a sinistra e sparisce in stampa', () => {
  /* in alto a destra copriva l utente di Fidra (la proprieta', 4 set 2026) */
  assert(S.includes('left:14px;bottom:14px'), 'in basso a sinistra');
  assert(S.includes('@media print'), 'e non finisce sui fogli');
});
