import { assert, assertEquals } from 'jsr:@std/assert';
import { BASE, INDIRIZZI, VIETATI } from './indirizzi.ts';

Deno.test('l elenco ha i cinquanta indirizzi contati il 19 agosto 2026', () => {
  assertEquals(INDIRIZZI.length, 50);
});

Deno.test('le quattro lingue hanno le pagine che hanno', () => {
  const per = (l: string) => INDIRIZZI.filter((p) => p.slice(1, 3) === l).length;
  assertEquals(per('it'), 17);
  assertEquals(per('de'), 15);
  assertEquals(per('en'), 9);
  assertEquals(per('fr'), 9);
});

Deno.test('nessun indirizzo e ripetuto', () => {
  assertEquals(new Set(INDIRIZZI).size, INDIRIZZI.length);
});

Deno.test('ogni indirizzo comincia con la sua lingua', () => {
  assertEquals(INDIRIZZI.length, 50, 'senza questa riga il ciclo gira a vuoto');
  for (const p of INDIRIZZI) {
    assert(/^\/(it|de|en|fr)(\/|$)/.test(p), `${p} non comincia con una lingua`);
  }
});

/* IL CANCELLO. E' la riga che rende vera la frase «legge e basta»: se un
   giorno qualcuno aggiunge /it/shop all'elenco, questo test diventa rosso
   prima che lo strumento chieda quella pagina. */
Deno.test('nessun indirizzo tocca il motore di prenotazione', () => {
  assertEquals(INDIRIZZI.length, 50, 'senza questa riga il ciclo gira a vuoto');
  for (const p of INDIRIZZI) {
    for (const v of VIETATI) assert(!v.test(p), `${p} combacia con ${v}`);
  }
});

/* E il cancello deve riconoscere davvero quello che deve fermare: un elenco
   di regole che non combacia con niente passerebbe la prova qui sopra
   restando inutile. */
Deno.test('il cancello ferma quello che deve fermare', () => {
  const pericolosi = [
    '/it/shop',
    '/de/shop/checkout',
    '/it/login',
    '/en/register',
    '/it/day-spa/prenotazioni',
    '/it/deposit-payment',
  ];
  for (const p of pericolosi) {
    assert(VIETATI.some((v) => v.test(p)), `${p} passerebbe il cancello`);
  }
});

Deno.test('la base e il sito vecchio, non quello nuovo', () => {
  assertEquals(BASE, 'https://www.termeleonardo.com');
});
