/* ============================================================
   in-casa.test.ts — gli arrangiamenti veri del listino Leonardo.

   I nomi sono quelli letti sulla pagina «In Casa» di Fidra il 4 settembre
   2026: se domani ne aggiungono uno, questa prova dice come viene letto.
   ============================================================ */
import { assertEquals } from 'jsr:@std/assert';
import { leggiInCasa, pastiDi } from './in-casa.ts';

Deno.test('mezza pensione, colazione, cure: quanti pasti comprende l arrangiamento', () => {
  assertEquals(pastiDi('Mi.Pr. Mezza Pensione'), 'mezza');
  assertEquals(pastiDi('So.br. Mezza Pensione'), 'mezza');
  assertEquals(pastiDi('Soggiorno Deluxe Mezza Pensione'), 'mezza');
  assertEquals(pastiDi('Mi.Pr. Bed & Breakfast'), 'colazione');
  assertEquals(pastiDi('Metaforum Bed & Breakfast'), 'colazione');
  /* i pacchetti cure si vendono con la pensione */
  assertEquals(pastiDi('Do.Vi. 5 cure'), 'mezza');
  assertEquals(pastiDi('Dolce Vita 10 cure'), 'mezza');
  assertEquals(pastiDi('Spezial 5 cure'), 'mezza');
  assertEquals(pastiDi('Pensione Completa'), 'completa');
  /* quello che non si riconosce vale colazione: il meno possibile
     regalato, e la reception se ne accorge */
  assertEquals(pastiDi('Qualcosa di nuovo'), 'colazione');
  assertEquals(pastiDi(null), 'colazione');
});

Deno.test('senza camera o senza cognome la riga non serve a niente', () => {
  const dentro = [
    { camera: '412', cognome: 'Schneider', nome: 'Felix Alexander' },
    { camera: '', cognome: 'Rossi' },
    { camera: '413', cognome: '   ' },
    'non un oggetto',
  ];
  assertEquals(leggiInCasa(dentro).length, 1);
  assertEquals(leggiInCasa('niente'), []);
});

Deno.test('la riga letta porta con se lingua, pasti, date e nota', () => {
  const [r] = leggiInCasa([{
    camera: ' 412 ', cognome: 'Marquardt', nome: 'Clara',
    fidra_cliente: '118494', fidra_soggiorno: '40790', fidra_prenotazione: '18757',
    email: 'horst.gutbrecht@t-online.de', lingua: 'de',
    arrangiamento: 'Do.Vi. 5 cure', adulti: 2, bambini: 0,
    arrivo: '2026-08-28', partenza: '2026-09-06',
    note: 'in DZ: lui fa DV e lei solo massaggi',
  }]);
  assertEquals(r.camera, '412');
  assertEquals(r.pasti, 'mezza');
  assertEquals(r.lingua, 'de');
  assertEquals(r.arrivo, '2026-08-28');
  assertEquals(r.note, 'in DZ: lui fa DV e lei solo massaggi');
});

Deno.test('una lingua che non conosciamo non entra, una data storta nemmeno', () => {
  const [r] = leggiInCasa([{ camera: '1', cognome: 'X', lingua: 'ru', arrivo: '28/08/2026' }]);
  assertEquals(r.lingua, null);
  assertEquals(r.arrivo, null);
  assertEquals(r.adulti, 1);
});
