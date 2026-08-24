/* ============================================================
   totale-zero.test.ts — un totale di zero non e' un totale.

   IL CASO, trovato leggendo la posta inviata il 24 agosto 2026. Il 12
   agosto era partito a Salvatore Ferrario un sollecito che diceva:

     «3 notti per 4 persone, 0,00 € in totale»

   e undici righe piu' sotto, nella stessa email:

     «Per bloccarla basta l'acconto di 300,00 €»

   Il soggiorno costava 1.440 €: due Matrimoniale Queen, 2 x 360 €, tre
   notti. Il prezzo era nell'offerta citata nel thread.

   LA CAUSA. `totale = somma(totalePP x adulti)`, e `calcolabile` diventa
   falso SOLO se quei valori sono null. Se la pagina restituisce zero, il
   totale e' zero ed e' considerato buono: passa tutti i controlli e
   finisce nell'email. Zero, per il codice, e' un numero come un altro.

   E' il difetto che non si vede provando, perche' nelle prove i prezzi
   ci sono sempre. Si e' visto solo guardando che cosa e' uscito davvero.

   NON SI BLOCCA. Il prezzo giusto sta sulla pagina di Fidra sotto gli
   occhi dell'operatore: l'estensione lo dice e offre un campo.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';

const SORGENTE = Deno.readTextFileSync(new URL('extractor.js', import.meta.url));
const PANNELLO = Deno.readTextFileSync(new URL('popup.js', import.meta.url));

Deno.test('l estrattore segnala un totale a zero', () => {
  assert(
    /tipo: 'totale-zero'/.test(SORGENTE),
    'sparito l avviso: un totale a zero torna a passare in silenzio',
  );
  assert(
    /d\.totale === 0 && \(d\.camere \|\| \[\]\)\.length > 0/.test(SORGENTE),
    'la condizione non e piu «zero con delle camere»: o non scatta mai o scatta sempre',
  );
});

Deno.test('il pannello offre il campo, e non blocca', () => {
  assert(/totaleManuale/.test(PANNELLO), 'sparito il campo dove scrivere il totale');
  assert(
    /applicaTotaleManuale\(\)/.test(PANNELLO),
    'il campo c e ma nessuno lo legge: l email uscirebbe comunque a zero',
  );
  /* deve girare su tutte e due le vie di generazione, come MODELLI */
  const usi = (PANNELLO.match(/applicaTotaleManuale\(\);/g) || []).length;
  assertEquals(usi, 2, `applicaTotaleManuale chiamata ${usi} volte invece di 2`);
});

Deno.test('scrivendo il totale si ricalcola anche il saldo', () => {
  /* correggere un numero e lasciarne un altro sbagliato accanto sarebbe
     peggio di non correggere niente: il saldo all'arrivo e' totale meno
     acconto, e nell'email compaiono tutti e due */
  assert(
    /DATI\.saldo = valore - DATI\.acconto/.test(PANNELLO),
    'il saldo all arrivo resta quello vecchio: due numeri che non tornano fra loro',
  );
});

Deno.test('il totale scritto a mano si legge all italiana', () => {
  /* «1.440,00» deve fare 1440, non 1.44: il punto e' il separatore delle
     migliaia e la virgola quella dei decimali */
  const fn = PANNELLO.match(/function applicaTotaleManuale\(\)[\s\S]*?\n\}/);
  assert(fn, 'applicaTotaleManuale non si trova piu');
  assert(
    /replace\(\/\\\.\/g, ''\)\.replace\(',', '\.'\)/.test(fn![0]),
    'i numeri all italiana non si leggono piu: «1.440,00» diventerebbe 1,44',
  );
});
