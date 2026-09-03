/* ============================================================
   email-dayspa.test.ts — la conferma con il QR, in quattro lingue.

   Porta il QR, il giorno per esteso nella lingua dell'ospite, l'orario
   della fascia, le persone, l'importo, il numero; dice che i neonati non
   pagano e che l'ingresso non si rimborsa (proprieta', 3 settembre 2026).
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';
import { dataEstesa, emailConferma, euro, TESTI_EMAIL } from './email-dayspa.ts';

const P = {
  numero: 'DS-2026-0007', giorno: '2026-09-12', fascia: 'giornaliero', persone: 3, adulti: 2, bambini: 1,
  importo_cent: 13500, nome: 'Maria Rossi', email: 'm@e.it', lingua: 'it', codice: 'ABCDEFGHJK',
};
const QR = 'https://x/functions/v1/dayspa?a=qr&codice=ABCDEFGHJK';

Deno.test('ogni lingua ha tutti i testi', () => {
  const chiavi = Object.keys(TESTI_EMAIL.it).sort();
  assert(chiavi.length >= 12);
  for (const l of ['de', 'en', 'fr']) assertEquals(Object.keys(TESTI_EMAIL[l]).sort(), chiavi, `mancano testi in ${l}`);
});

Deno.test('la conferma porta QR, giorno, orario, persone, importo, numero e la riga non rimborsabile', () => {
  const e = emailConferma(P, QR);
  /* nell'HTML la & dell'indirizzo e' &amp;, come vuole un attributo src */
  assert(e.html.includes(QR.replace('&', '&amp;')), 'manca l immagine del QR');
  assert(e.testo.includes(QR), 'nel testo semplice l indirizzo del QR e nudo');
  assert(/12 settembre 2026/.test(e.html));
  assert(/9:00–18:30/.test(e.html));
  assert(/3 persone/.test(e.html));
  assert(/135,00/.test(e.html));
  assert(e.oggetto.includes('DS-2026-0007'));
  assert(/non rimborsabile/i.test(e.html), 'la proprieta ha deciso: l ingresso pagato non si rimborsa, e l email lo dice');
  assert(/neonat/i.test(e.html), 'i neonati non pagano: va detto');
  assert(/ABCDEFGHJK/.test(e.html), 'il codice scritto accanto al QR, per chi lo legge a voce');
  assert(e.testo.includes('DS-2026-0007') && !/<[a-z]/.test(e.testo), 'la versione solo testo esiste e non ha tag');
});

Deno.test('una persona sola e al singolare', () => {
  assert(/1 persona\b/.test(emailConferma({ ...P, persone: 1 }, QR).html));
});

Deno.test('in tedesco la data e in tedesco, e la riga non rimborsabile pure', () => {
  const e = emailConferma({ ...P, lingua: 'de' }, QR);
  assert(/12\. September 2026/.test(e.html));
  assert(/nicht erstattungsf/i.test(e.html));
  assert(/Abendeintritt|Tageseintritt/.test(e.html));
});

Deno.test('data e importo nelle quattro lingue', () => {
  assertEquals(dataEstesa('2026-09-12', 'it'), 'sabato 12 settembre 2026');
  assertEquals(dataEstesa('2026-09-12', 'en'), 'Saturday 12 September 2026');
  assertEquals(dataEstesa('2026-09-12', 'fr'), 'samedi 12 septembre 2026');
  assertEquals(euro(13500, 'it'), '135,00 €');
  assertEquals(euro(13500, 'en'), '€135.00');
});
