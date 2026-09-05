/* ============================================================
   pos-schede.test.ts - le tre schede del POS nel back office.

   Menu (stampante, portata, prezzo, esaurito, preferiti, varianti),
   tavoli (locali, zone, tavoli con posizione) e personale (camerieri col
   PIN che si scrive e non si rilegge mai, dispositivi col token mostrato
   una volta). Parlano con la funzione pos, ruolo amministrazione.
   ============================================================ */
import { assert } from 'jsr:@std/assert';

const P = Deno.readTextFileSync(new URL('./index.html', import.meta.url));

Deno.test('le tre schede del POS esistono e parlano con la funzione pos', () => {
  for (const v of ['vistaPosMenu', 'vistaPosTavoli', 'vistaPosPersonale']) assert(P.includes(`function ${v}(`), v);
  assert(P.includes("const FUNZIONE_POS = 'https://mvuiuwakuseockotlcnp.supabase.co/functions/v1/pos'"));
  assert(P.includes('a=menu-salva') && P.includes('a=tavoli-salva') && P.includes('a=personale-salva'));
  assert(P.includes("['posMenu'") && P.includes("['posTavoli'") && P.includes("['posPersonale'"), 'registrate in SCHEDE');
  assert(P.includes('a=allinea-giu'), 'legge tutto con allinea-giu');
});

Deno.test('nel menu si cambiano stampante, portata, prezzo, esaurito, preferiti, varianti; il PIN non si rilegge mai', () => {
  const menu = P.slice(P.indexOf('function vistaPosMenu('), P.indexOf('function vistaPosTavoli('));
  for (const c of ['stampante', 'portata', 'prezzo', 'esaurito', 'preferit', 'variant', 'note_rapide']) assert(menu.includes(c), c);
  const pers = P.slice(P.indexOf('function vistaPosPersonale('), P.indexOf('function vistaPosPersonale(') + 8000);
  assert(pers.includes('type="password"') && !pers.includes('pin_hash'));
  assert(pers.includes('token'), 'il token del dispositivo nuovo si mostra una volta');
});

Deno.test('la scheda degli addebiti in camera: la coda che la reception riporta in Fidra', () => {
  assert(P.includes("['posAddebiti', 'POS · Addebiti in camera']"), 'la scheda c e');
  assert(P.includes('function vistaPosAddebiti()'), 'e la disegna una funzione sua');
  assert(P.includes("chiama(`?a=addebiti&stato=${encodeURIComponent(stato)}`"), 'legge la coda');
  assert(P.includes("chiama('?a=addebito-segna'"), 'e la segna');
  assert(P.includes('data-segna="riportato"') && P.includes('data-segna="annullato"') && P.includes('data-segna="da_riportare"'), 'riportato, annullato, rimetti in coda');
  assert(P.includes('tessera letta') && P.includes('camera scritta a mano'), 'si vede se la camera l ha detta la tessera o una persona');
});

Deno.test('nella coda si vede la firma dell ospite, o che manca', () => {
  assert(P.includes('firmato dall’ospite') && P.includes('Senza firma: l’ospite non era al tavolo'), 'lo dice in cima');
  assert(P.includes('alt="firma dell’ospite"'), 'e la firma si guarda: al check-out chiude la discussione');
});

Deno.test('nel menu i nomi per gli ospiti dal QR: un pulsante per articolo apre nomi, ingredienti e allergeni; la categoria ha i nomi tradotti', () => {
  /* spec docs/superpowers/specs/2026-09-05-menu-ospiti-design.md */
  const menu = P.slice(P.indexOf('function vistaPosMenu('), P.indexOf('function vistaPosTavoli('));
  assert(menu.includes('data-tradu="${esc(a.id)}"') && menu.includes('data-tradu-di="${esc(a.id)}" hidden'), 'il pulsante e la riga che si apre');
  for (const k of ['data-an="${l}"', 'data-ad="${l}"', 'data-allergeni']) assert(menu.includes(k), k);
  assert(menu.includes('data-cn="${l}"'), 'i nomi della categoria nelle quattro lingue');
  assert(menu.includes('a.nomi = Object.keys(n).length ? n : null;') && menu.includes('c.nomi = Object.keys(cn).length ? cn : null;'), 'campi vuoti = null, non {}');
  assert(menu.includes("a.allergeni = al && al.value.trim() ? al.value.trim().toUpperCase() : null;"), 'le sigle in maiuscolo');
});

Deno.test('nel menu gli orari per gli ospiti dal QR: una riga sulla categoria, una sull articolo', () => {
  /* fase 2 della spec 2026-09-05-menu-ospiti-design.md */
  const menu = P.slice(P.indexOf('function vistaPosMenu('), P.indexOf('function vistaPosTavoli('));
  assert(menu.includes('data-c="orari"') && menu.includes('12:15-14:30; ven,sab 12:15-20:30'), 'la categoria, con l esempio');
  assert(menu.includes('data-orari') && menu.includes("a.orari = or && or.value.trim() ? or.value.trim() : null;"), 'l articolo, nella riga dei nomi');
  assert(menu.includes("(k === 'sotto' || k === 'locale_stampa' || k === 'orari') ? (v || null) : v"), 'vuoto = null');
});

Deno.test('nei locali si scrivono gli orari della cucina: fuori da quelli il biglietto della cucina esce al bancone', () => {
  const tav = P.slice(P.indexOf('function vistaPosTavoli('), P.indexOf('function vistaPosPersonale('));
  assert(tav.includes('data-l="orari_cucina"') && tav.includes('placeholder="12:15-14:30"'), 'il campo, con l esempio');
});

Deno.test('nel menu ogni articolo ha la spunta «QR»: senza, l ospite non lo vede', () => {
  const menu = P.slice(P.indexOf('function vistaPosMenu('), P.indexOf('function vistaPosTavoli('));
  assert(menu.includes('data-a="per_ospiti" ${a.per_ospiti !== false ? \'checked\' : \'\'}'), 'la spunta, accesa se non e mai stata spenta');
  assert(menu.includes('<th title="Lo vedono gli ospiti che ordinano dal QR">QR</th>'), 'la colonna');
});
