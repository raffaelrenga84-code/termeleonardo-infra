/* ============================================================
   lettura.test.ts — cosa ha letto il lettore del totem, e che cos'e'.

   Il lettore scrive nel campo quello che c'e' nel QR: per il Day Spa e
   per i buoni e' il codice nudo, ma un ospite puo' anche avvicinare un
   QR con un indirizzo (il link del buono stampato) o un codice battuto
   a mano con spazi e minuscole. Il formato distingue le due cose:
   - Day Spa: 10 caratteri dell'alfabeto senza 0/O/1/I (posti.ts);
   - buono regalo: LEO-XXXX-XXXX (nuovoCodice in buoni/index.ts).
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';
import { codiceLetto, etichetteConto, messaggioBuono, tipoCodice } from './lettura.js';

Deno.test('codiceLetto: pulisce quello che scrive il lettore', () => {
  assertEquals(codiceLetto('  abcdefghjk '), 'ABCDEFGHJK');
  assertEquals(codiceLetto('leo-acde-fghj'), 'LEO-ACDE-FGHJ');
  assertEquals(codiceLetto('LEO ACDE FGHJ'), 'LEO-ACDE-FGHJ', 'gli spazi battuti a mano diventano trattini');
  assertEquals(codiceLetto('https://www.hoteltermeleonardo.com/buoni/stampa/?codice=LEO-ACDE-FGHJ&l=it'), 'LEO-ACDE-FGHJ',
    'da un indirizzo prende il parametro codice');
  assertEquals(codiceLetto('https://esempio.it/x/ABCDEFGHJK'), 'ABCDEFGHJK', 'o l ultimo pezzo del percorso');
  assertEquals(codiceLetto(''), '');
});

Deno.test('tipoCodice: Day Spa, buono o ignoto, dal formato', () => {
  assertEquals(tipoCodice('ABCDEFGHJK'), 'dayspa');
  assertEquals(tipoCodice('23456789ZY'), 'dayspa');
  assertEquals(tipoCodice('LEO-ACDE-FGHJ'), 'buono');
  assertEquals(tipoCodice('ABCDEFGHJ'), 'ignoto', 'nove caratteri non sono un codice Day Spa');
  assertEquals(tipoCodice('ABCDEFGH0I'), 'ignoto', 'lo zero e la I non stanno nell alfabeto');
  assertEquals(tipoCodice('DS-2026-0001'), 'ignoto', 'il numero della prenotazione non e un codice: al totem vale solo il QR');
  assertEquals(tipoCodice('LEO-ACDE-FGHJ-X'), 'ignoto');
  assertEquals(tipoCodice(''), 'ignoto');
});

Deno.test('messaggioBuono: vale, gia usato, scaduto, non valido — e sempre «alla reception»', () => {
  const ok = messaggioBuono({ valido: true, stato: 'pagato', descrizione: 'Buono valore di 100,00 €, spendibile in hotel', valore: 100, scade_il: '2027-08-12' });
  assertEquals(ok.classe, 'ok');
  assert(ok.titolo.includes('vale'), ok.titolo);
  assert(ok.testo.includes('100,00 €') && ok.testo.includes('12 agosto 2027'), ok.testo);
  assert(ok.sotto.includes('reception'), 'per usarlo si va alla reception: il totem non riscuote');

  const usato = messaggioBuono({ valido: false, stato: 'riscosso', descrizione: 'Cena', valore: 60, scade_il: '2027-08-12', riscosso_il: '2026-09-01T10:00:00Z' });
  assertEquals(usato.classe, 'no');
  assert(usato.titolo.includes('già') && usato.testo.includes('1 settembre 2026'), usato.titolo + ' ' + usato.testo);

  const scaduto = messaggioBuono({ valido: false, stato: 'scaduto', descrizione: 'Cena', valore: 60, scade_il: '2026-08-12' });
  assertEquals(scaduto.classe, 'no');
  assert(scaduto.titolo.includes('scaduto') && scaduto.testo.includes('12 agosto 2026'));

  const altro = messaggioBuono({ valido: false, stato: 'annullato', descrizione: 'Cena', valore: 60, scade_il: '2027-08-12' });
  assertEquals(altro.classe, 'no');
  assert(altro.titolo.includes('non') && altro.sotto.includes('reception'));
});

Deno.test('tipoCodice: la tessera della camera sono solo cifre, come nel codice a barre', () => {
  /* la tessera 1796 porta il codice a barre 000000017960: il lettore
     scrive le cifre, e quelle vanno a Fidra come le manda il totem di hldv */
  assertEquals(tipoCodice('000000017960'), 'tessera');
  assertEquals(tipoCodice('1796'), 'tessera');
  assertEquals(tipoCodice('123'), 'ignoto', 'tre cifre sono troppo poche');
  assertEquals(tipoCodice('2345678923'), 'dayspa', 'dieci caratteri dell alfabeto Day Spa restano Day Spa anche se sono cifre');
});

Deno.test('etichetteConto: le parole del conto nella lingua dell ospite, italiano se manca', () => {
  assertEquals(etichetteConto('de').camera, 'Zimmer');
  assertEquals(etichetteConto('en').acconto, 'Deposit');
  assertEquals(etichetteConto('fr').appuntamenti, 'Rendez-vous');
  assertEquals(etichetteConto('xx').camera, 'Camera');
  for (const l of ['it', 'en', 'de', 'fr']) {
    const e = etichetteConto(l);
    for (const k of ['camera', 'descrizione', 'totale', 'lordo', 'acconto', 'daPagare', 'appuntamenti', 'chiude', 'chiudi']) assert(e[k], l + ' senza ' + k);
  }
});

Deno.test('etichetteConto: «tocchi lo schermo per chiudere» in quattro lingue', () => {
  for (const l of ['it', 'en', 'de', 'fr']) assert(etichetteConto(l).tocca, l);
  assertEquals(etichetteConto('de').tocca, 'Zum Schließen den Bildschirm berühren');
});

Deno.test('messaggioBuono: riscosso adesso al totem, si entra', () => {
  const m = messaggioBuono({ valido: true, stato: 'pagato', descrizione: 'n. 2 · ingressi Day Spa serale', valore: 58, scade_il: '2027-09-05', riscossoAdesso: true });
  assertEquals(m.classe, 'ok');
  assert(/benvenut/i.test(m.titolo), m.titolo);
  assert(m.testo.includes('n. 2 · ingressi Day Spa serale') && /utilizzato|registrato/i.test(m.testo), m.testo);
  assert(/cuffia/i.test(m.sotto), 'la cuffia, come sul biglietto');
  assert(m.tradotto.length >= 2 && /welcome/i.test(m.tradotto[0]) && /willkommen/i.test(m.tradotto[1]), m.tradotto.join(' | '));
});
