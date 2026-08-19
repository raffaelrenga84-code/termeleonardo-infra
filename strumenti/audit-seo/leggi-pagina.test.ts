import { assert, assertEquals } from 'jsr:@std/assert';
import { attributi, decodifica, leggiPagina } from './leggi-pagina.ts';

/* Una pagina finta che porta dentro i difetti veri del sito: gli attributi
   in ordine rovesciato, l'entita' numerica nella description, la barra
   verticale nel titolo, piu' h1, un'immagine senza alt e una con alt
   vuoto — che e' una scelta legittima e non va contata come difetto. */
const PAGINA = `<!doctype html>
<html lang="fr">
<head>
  <title>A 4 Star Spa Hotel in Abano Terme | Hotel Terme Leonardo</title>
  <meta content="Book now your vacation in a 4 star hotel: it offers you many spa services." name="description">
  <meta name="robots" content="index, follow">
  <link href="https://www.termeleonardo.com/fr" rel="canonical">
  <link rel="alternate" hreflang="it" href="/it">
  <link rel="alternate" hreflang="de" href="/de">
  <style>.a{color:rosso}</style>
  <script>var nascosto = "parolaDiScript";</script>
</head>
<body>
  <h1>Hotel Terme Leonardo &amp; Golf</h1>
  <h1>Un secondo titolo che non dovrebbe esserci</h1>
  <p>Le piscine sono l&#039;attrazione principale.</p>
  <img src="a.jpg" alt="le piscine">
  <img src="b.jpg">
  <img src="c.jpg" alt="">
</body></html>`;

Deno.test('legge titolo, description, lingua e robots', () => {
  const c = leggiPagina(PAGINA);
  assertEquals(c.titolo, 'A 4 Star Spa Hotel in Abano Terme | Hotel Terme Leonardo');
  assertEquals(c.lang, 'fr');
  assertEquals(c.robots, 'index, follow');
  assert(c.descrizione.startsWith('Book now your vacation'));
});

/* La description di quella pagina scrive `content` PRIMA di `name`. Una
   regex sola che cerchi name="description" seguito da content non la
   trova, e il rapporto direbbe «senza description» a una pagina che ce
   l'ha. E' il motivo per cui esiste attributi(). */
Deno.test('trova la description anche con gli attributi in ordine rovesciato', () => {
  const a = attributi('<meta content="ciao" name="description">');
  assertEquals(a.name, 'description');
  assertEquals(a.content, 'ciao');
});

Deno.test('canonical e hreflang', () => {
  const c = leggiPagina(PAGINA);
  assertEquals(c.canonical, 'https://www.termeleonardo.com/fr');
  assertEquals(c.hreflang, ['it', 'de']);
});

/* Cinque h1 sono il difetto vero di /it/cure-termali e /it/golf: qui ne
   bastano due per provare che si contano tutti, non solo il primo. */
Deno.test('conta tutti gli h1, non solo il primo', () => {
  const c = leggiPagina(PAGINA);
  assertEquals(c.h1.length, 2);
  assertEquals(c.h1[0], 'Hotel Terme Leonardo & Golf');
});

/* alt="" e' la dichiarazione che l'immagine e' decorativa: e' una scelta,
   non una dimenticanza. Manca l'attributo del tutto: quello e' il difetto. */
Deno.test('conta senza alt solo chi l attributo non ce l ha proprio', () => {
  const c = leggiPagina(PAGINA);
  assertEquals(c.immagini, 3);
  assertEquals(c.senzaAlt, 1);
});

Deno.test('le parole degli script e degli stili non sono contenuto', () => {
  const c = leggiPagina(PAGINA);
  assert(c.parole > 0, 'non ha contato niente');
  assert(!/parolaDiScript/.test(JSON.stringify(c)), 'ha letto dentro lo script');
});

Deno.test('le entita si sciolgono', () => {
  assertEquals(decodifica('l&#039;opportunit&agrave;'), "l'opportunit&agrave;");
  assertEquals(decodifica('Spa &amp; Golf'), 'Spa & Golf');
  assertEquals(decodifica('&#x41;'), 'A');
});

Deno.test('una pagina vuota non fa esplodere niente', () => {
  const c = leggiPagina('');
  assertEquals(c.titolo, '');
  assertEquals(c.h1, []);
  assertEquals(c.hreflang, []);
  assertEquals(c.parole, 0);
});
