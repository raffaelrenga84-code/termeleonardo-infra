import { assertEquals } from 'jsr:@std/assert';
import { lingua, sospettoLingua } from './lingua.ts';

/* I testi veri di /fr, letti il 19 agosto 2026: la pagina dichiara
   lang="fr", il corpo e' francese, e titolo e description sono in inglese.
   E' il difetto da cui e' nato questo controllo. */
const TITOLO_FR = 'A 4 Star Spa Hotel in Abano Terme | Hotel Terme Leonardo';
const DESCRIZIONE_FR =
  'Book now your vacation in a 4 star hotel in Abano Terme: Hotel Terme Leonardo ' +
  'offers you many spa services such as hot spring, pool and beauty farm.';

/* La description vera di /it/day-spa. */
const ITALIANO =
  'Piscine Termali ad Abano Terme aperte al pubblico con ingresso ' +
  'giornaliero? Entra e scopri tutti i servizi e le tariffe.';

Deno.test('riconosce l inglese dei meta francesi', () => {
  assertEquals(lingua(`${TITOLO_FR} ${DESCRIZIONE_FR}`), 'en');
});

Deno.test('e lo dice, quando la pagina dichiara fr', () => {
  const s = sospettoLingua('fr', `${TITOLO_FR} ${DESCRIZIONE_FR}`);
  assertEquals(s.length > 0, true);
  assertEquals(/fr/.test(s) && /en/.test(s), true, `frase poco chiara: ${s}`);
});

/* Senza questa prova, una funzione che accusa sempre passerebbe le altre. */
Deno.test('su una pagina a posto non dice niente', () => {
  assertEquals(lingua(ITALIANO), 'it');
  assertEquals(sospettoLingua('it', ITALIANO), '');
});

Deno.test('riconosce il tedesco vero', () => {
  const t = 'Thermalhotel Abano Terme mit Fango und Thermalbad: ' +
    'entdecken Sie unsere Angebote für Ihre Kur, und buchen Sie Ihre Zimmer mit uns.';
  assertEquals(lingua(t), 'de');
});

Deno.test('riconosce il francese vero', () => {
  const t = 'Découvrez nos piscines thermales et votre séjour dans les collines : ' +
    'les soins sont pour vous, avec une visite dans une villa.';
  assertEquals(lingua(t), 'fr');
});

/* IL PUNTO DELICATO. Su due parole non si accusa nessuno: il costo di un
   falso allarme e' che qualcuno "corregge" un francese giusto. Meglio
   tacere che sbagliare, e infatti si chiama sospetto. */
Deno.test('su un testo troppo corto tace', () => {
  assertEquals(lingua('Golf'), '');
  assertEquals(lingua(''), '');
  assertEquals(sospettoLingua('fr', 'Golf'), '');
});

Deno.test('senza lingua dichiarata non c e niente da confrontare', () => {
  assertEquals(sospettoLingua('', `${TITOLO_FR} ${DESCRIZIONE_FR}`), '');
});

Deno.test('it-IT vale it', () => {
  assertEquals(sospettoLingua('it-IT', ITALIANO), '');
});
