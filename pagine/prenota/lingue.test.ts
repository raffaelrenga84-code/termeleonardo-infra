/* ============================================================
   lingue.test.ts — le quattro lingue dicono le stesse cose.

   IL DIFETTO CHE PRESIDIA. I testi della pagina vivono in quattro
   dizionari scritti a mano, uno sotto l'altro: it, de, en, fr. Chi
   aggiunge una voce la scrive in italiano — è la lingua in cui si pensa —
   e le altre tre si aggiungono a mano, subito dopo, se non si viene
   interrotti.

   Quando una manca non succede niente di visibile: la pagina non si
   rompe, non c'è nessun errore in console. Al posto del testo l'ospite
   tedesco legge «undefined», oppure il pulsante esce vuoto. E se ne
   accorge lui, non noi, perché noi la pagina la guardiamo in italiano.

   COME. Si prende l'oggetto T dalla pagina vera e lo si ESEGUE, invece di
   cercare le chiavi con un'espressione regolare: se qualcuno riscrive i
   dizionari, questa prova gira sui nuovi.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';

const PAGINA = Deno.readTextFileSync(new URL('index.html', import.meta.url));
type Dizionario = Record<string, unknown>;

function dizionari(): Record<string, Dizionario> {
  const da = PAGINA.indexOf('const T = {');
  assert(da > 0, "l'oggetto delle traduzioni non si trova nella pagina");
  const fine = PAGINA.indexOf('\n};', da);
  assert(fine > da, 'la chiusura di T non si trova: i dizionari hanno cambiato forma');
  const testo = PAGINA.slice(da + 'const T = '.length, fine + 2);
  /* i testi chiamano esc(): qui basta che restituisca qualcosa */
  const esc = (v: unknown) => String(v ?? '');
  return new Function('esc', 'return ' + testo)(esc) as Record<string, Dizionario>;
}

const LINGUE = ['it', 'de', 'en', 'fr'];

Deno.test('le quattro lingue ci sono tutte', () => {
  const T = dizionari();
  assertEquals(Object.keys(T).sort(), [...LINGUE].sort());
});

Deno.test('e hanno esattamente le stesse chiavi', () => {
  const T = dizionari();
  const riferimento = Object.keys(T.it).sort();
  assert(riferimento.length > 20, `solo ${riferimento.length} chiavi: la prova non guarda niente`);
  for (const l of LINGUE) {
    const sue = Object.keys(T[l]).sort();
    const mancanti = riferimento.filter((k) => !sue.includes(k));
    const inPiu = sue.filter((k) => !riferimento.includes(k));
    assertEquals(
      mancanti,
      [],
      `la lingua «${l}» non traduce: ${mancanti.join(', ')} — ` +
        "l'ospite leggerebbe «undefined» al posto del testo",
    );
    assertEquals(inPiu, [], `la lingua «${l}» ha voci che l'italiano non ha: ${inPiu.join(', ')}`);
  }
});

Deno.test('e una voce che in italiano e una funzione lo e in tutte', () => {
  /* il caso peggiore: `altreCamere` funzione in italiano e stringa in
     tedesco. Chiamarla darebbe "t.altreCamere is not a function" e la
     schermata resterebbe bianca — ma solo per gli ospiti tedeschi. */
  const T = dizionari();
  for (const [k, v] of Object.entries(T.it)) {
    const tipo = typeof v;
    for (const l of LINGUE) {
      assertEquals(
        typeof T[l][k],
        tipo,
        `«${k}» è ${tipo} in italiano e ${typeof T[l][k]} in ${l}`,
      );
    }
  }
});

Deno.test('e nessun testo esce vuoto', () => {
  const T = dizionari();
  const vuote: string[] = [];
  for (const l of LINGUE) {
    for (const [k, v] of Object.entries(T[l])) {
      if (typeof v === 'string' && v.trim() === '') vuote.push(`${l}.${k}`);
    }
  }
  assertEquals(vuote, [], 'testi vuoti: al loro posto non compare niente');
});
