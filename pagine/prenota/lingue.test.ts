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

/* ============================================================
   LA TASSA DI SOGGIORNO SI DICE PER INTERO.

   È una regola della casa, non una scelta di questa pagina. Il prompt
   dell'agente vocale (v4.10, confermato dalla proprietà) la impone al
   punto 9 delle regole di prenotazione — «ricorda la tassa di soggiorno
   quando comunichi un totale, PER INTERO» — e vieta esplicitamente la
   versione mozzata.

   Fino al 21 agosto 2026 questa pagina era l'unico canale che comunicava
   prezzi senza nominarla: l'ospite vedeva 190 €, prenotava, e in hotel gli
   veniva chiesto altro. Il telefono era obbligato a dirla, il sito no.

   La prova pretende i tre fatti in tutte e quattro le lingue: quanto, per
   quante notti, chi è esente. Toglierne uno rifà la versione mozzata.
   ============================================================ */
Deno.test('la tassa di soggiorno porta i suoi fatti, in ogni lingua', () => {
  const T = dizionari();
  for (const l of LINGUE) {
    const testo = String(T[l].tassaSoggiorno ?? '');
    assert(testo.length > 40, `la lingua «${l}» non dice la tassa di soggiorno`);
    /* l'importo: 1,50 con la virgola in italiano e francese, 1.50 col punto
       in inglese, 1,50 in tedesco */
    assert(
      /1[.,]50/.test(testo),
      `«${l}» non dice quanto costa: ${testo}`,
    );
    assert(
      /sette|sieben|seven|sept/i.test(testo),
      `«${l}» non dice il tetto delle sette notti: ${testo}`,
    );
    assert(
      /14|quattordici|vierzehn|fourteen|quatorze/i.test(testo),
      `«${l}» non dice chi e esente: ${testo}`,
    );
  }
});

Deno.test('e le formule dicono che cosa si mangia, in ogni lingua', () => {
  const T = dizionari();
  for (const l of LINGUE) {
    for (const k of ['formulaCena', 'formulaColazione']) {
      const testo = String(T[l][k] ?? '');
      assert(testo.trim().length > 5, `«${l}.${k}» non dice niente: «${testo}»`);
    }
    assert(
      String(T[l].formulaCena) !== String(T[l].formulaColazione),
      `in «${l}» la mezza pensione e la sola colazione dicono la stessa cosa`,
    );
  }
});
