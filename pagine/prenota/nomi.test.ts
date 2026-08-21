/* ============================================================
   nomi.test.ts — le tariffe e i trattamenti nella lingua dell'ospite.

   IL DIFETTO CHE PRESIDIA, misurato il 21 agosto 2026 interrogando la
   nostra stessa funzione con `lingua: 'de'`: IL MOTORE RISPONDE SEMPRE IN
   ITALIANO. Tornano «Miglior Prezzo», «Soggiorno breve», «Mezza
   Pensione» anche a chi ha chiesto in tedesco — la lingua che gli
   passiamo serve solo alle descrizioni delle camere, che sono nostre.

   Un ospite tedesco leggeva righe metà e metà: «Mezza Pensione ·
   Frühstück und Abendbuffet», e una tariffa chiamata «Miglior Prezzo».

   IL DIFETTO OPPOSTO, che è peggio: tradurre un nome che non conosciamo.
   Le tariffe stagionali vanno e vengono — «Soggiorno Smart» c'era il 22
   agosto e non c'era il 15 settembre. Un nome mai visto deve uscire com'è
   arrivato, non indovinato.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';
import { nomeTariffa, nomeTrattamento, TARIFFE, TRATTAMENTI } from './nomi.js';

const ALTRE = ['de', 'en', 'fr'] as const;

Deno.test('il trattamento esce nella lingua dell ospite', () => {
  assertEquals(nomeTrattamento('Mezza Pensione', 'de'), 'Halbpension');
  assertEquals(nomeTrattamento('Mezza Pensione', 'en'), 'Half board');
  assertEquals(nomeTrattamento('Mezza Pensione', 'fr'), 'Demi-pension');
  /* la parola tedesca e' quella del dizionario del sito vecchio, non una
     scelta di stile fatta qui */
  assertEquals(nomeTrattamento('Bed & Breakfast', 'de'), 'Zimmer und Frühstück');
});

Deno.test('e cosi il nome della tariffa', () => {
  assertEquals(nomeTariffa('Miglior Prezzo', 'de'), 'Bestpreis');
  assertEquals(nomeTariffa('Soggiorno breve', 'de'), 'Kurzaufenthalt');
  assertEquals(nomeTariffa('Miglior Prezzo', 'fr'), 'Meilleur prix');
});

Deno.test('in italiano torna il nome com e arrivato', () => {
  assertEquals(nomeTariffa('Miglior Prezzo', 'it'), 'Miglior Prezzo');
  assertEquals(nomeTrattamento('Mezza Pensione', 'it'), 'Mezza Pensione');
});

Deno.test('un nome che non conosciamo non si traduce mai', () => {
  /* le tariffe stagionali vanno e vengono: «Soggiorno Smart» c era il 22
     agosto e non c era il 15 settembre. Esce com e' arrivato. */
  for (const l of [...ALTRE, 'it']) {
    assertEquals(nomeTariffa('Soggiorno Smart', l), 'Soggiorno Smart');
    assertEquals(nomeTariffa('Offerta Autunno 2027', l), 'Offerta Autunno 2027');
    assertEquals(nomeTrattamento('Pensione Completa', l), 'Pensione Completa');
  }
});

Deno.test('e una lingua che non conosciamo lascia il nome originale', () => {
  assertEquals(nomeTariffa('Miglior Prezzo', 'es'), 'Miglior Prezzo');
  assertEquals(nomeTariffa('Miglior Prezzo', ''), 'Miglior Prezzo');
  assertEquals(nomeTariffa('Miglior Prezzo', undefined as unknown as string), 'Miglior Prezzo');
});

Deno.test('spazi e maiuscole non fanno perdere la traduzione', () => {
  /* il motore ha gia' scritto «Soggiorno breve» con la b minuscola: se un
     domani scrivesse «Soggiorno Breve» la traduzione non deve sparire */
  assertEquals(nomeTariffa('  soggiorno   BREVE ', 'de'), 'Kurzaufenthalt');
  assertEquals(nomeTrattamento('MEZZA PENSIONE', 'de'), 'Halbpension');
});

Deno.test('un nome assente non fa esplodere la riga', () => {
  for (const n of ['', null, undefined]) {
    assertEquals(nomeTariffa(n as string, 'de'), '');
    assertEquals(nomeTrattamento(n as string, 'de'), '');
  }
});

Deno.test('ogni voce del dizionario ha tutte e tre le lingue', () => {
  /* una voce con il tedesco e senza il francese farebbe uscire l italiano
     ai francesi e nessuno se ne accorgerebbe */
  for (const [che, tavola] of [['trattamenti', TRATTAMENTI], ['tariffe', TARIFFE]] as const) {
    const chiavi = Object.keys(tavola);
    assert(chiavi.length > 0, `${che}: dizionario vuoto`);
    for (const k of chiavi) {
      for (const l of ALTRE) {
        const v = (tavola as Record<string, Record<string, string>>)[k][l];
        assert(
          typeof v === 'string' && v.trim().length > 2,
          `${che}: «${k}» non ha il ${l}`,
        );
      }
    }
  }
});

Deno.test('la pagina traduce davvero, in tutti e tre i posti', () => {
  /* il nome compare sulla riga della tariffa, nella barra della scelta e
     nel riepilogo della schermata dopo: tradurlo in uno solo darebbe una
     pagina che cambia nome alla tariffa mentre l ospite avanza */
  const pagina = Deno.readTextFileSync(new URL('index.html', import.meta.url));
  const quante = pagina.split('nomeTariffa(').length - 1;
  /* TRE: la riga della tariffa, la barra della scelta, il riepilogo della
     schermata dopo. L'import scrive «nomeTariffa,» senza parentesi e non
     entra nella conta. */
  assert(
    quante >= 3,
    `nomeTariffa compare ${quante} volte invece di 3: ` +
      'la tariffa cambia nome fra una schermata e l altra',
  );
  assert(
    pagina.includes('conFormula(nomeTrattamento(v.trattamento, LNG), t)'),
    'il trattamento torna in italiano dentro una riga tradotta',
  );
});
