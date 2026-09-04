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
