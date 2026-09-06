/* ============================================================
   orari.test.ts — gli orari del menù per chi ordina dal QR.

   Il menù stampato: «Piatti disponibili dalle ore 12:15 alle 14:30.
   "X" disponibile fino alle ore 17:30, venerdì e sabato fino alle ore
   20:30». Si scrivono in una riga di testo, per categoria o per
   articolo: «12:15-14:30; ven,sab 12:15-20:30».
   ============================================================ */
import { assertEquals } from 'jsr:@std/assert';
import { apertoOra, leggiOrari, restringi, stampanteAdesso } from './orari.ts';

const ore = (giorno: number, hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return { giorno, minuti: h * 60 + m }; };
const LUN = 1, VEN = 5, SAB = 6, DOM = 0;

Deno.test('una riga di testo diventa finestre: ore, e giorni se scritti', () => {
  assertEquals(leggiOrari('12:15-14:30'), [{ dalle: '12:15', alle: '14:30', giorni: null }]);
  assertEquals(leggiOrari(' 12:15-17:30 ; ven,sab 12:15-20:30 '), [
    { dalle: '12:15', alle: '17:30', giorni: null },
    { dalle: '12:15', alle: '20:30', giorni: [5, 6] },
  ]);
  assertEquals(leggiOrari('lun-ven 7:00-10:30'), [{ dalle: '07:00', alle: '10:30', giorni: [1, 2, 3, 4, 5] }], 'da lunedi a venerdi, ore con una cifra');
  assertEquals(leggiOrari('Sabato, Domenica 08:00-11:00'), [{ dalle: '08:00', alle: '11:00', giorni: [6, 0] }], 'i nomi interi e le maiuscole vanno bene');
});

Deno.test('vuoto = come la categoria (null); «sempre» = nessun vincolo, anche se la categoria ne ha ([]); una parte scritta male si salta', () => {
  /* La focaccia del banco Bistrot spostata fra le «specialita' da
     condividere» (12:15-14:30) deve restare ordinabile tutto il giorno:
     «sempre» sull'articolo vince sugli orari della categoria (la
     proprieta', 6 settembre 2026). Vuoto invece eredita, come prima. */
  assertEquals(leggiOrari(''), null);
  assertEquals(leggiOrari(null), null);
  assertEquals(leggiOrari('sempre'), []);
  assertEquals(leggiOrari(' Sempre '), []);
  assertEquals(apertoOra([], { giorno: 2, minuti: 10 * 60 }), true, 'senza finestre si ordina sempre');
  assertEquals(restringi([], 10), [], 'niente da restringere');
  assertEquals(leggiOrari('sempre') ?? leggiOrari('12:15-14:30'), [], 'l articolo con «sempre» vince sulla categoria');
  assertEquals(leggiOrari('12:15-14:30; boh'), [{ dalle: '12:15', alle: '14:30', giorni: null }]);
  assertEquals(leggiOrari('boh'), null, 'solo parti sbagliate: come se non ci fosse');
});

Deno.test('aperto adesso? la cucina 12:15-14:30, le «X» fino alle 17:30 e il venerdi e sabato fino alle 20:30', () => {
  const cucina = leggiOrari('12:15-14:30');
  assertEquals(apertoOra(cucina, ore(LUN, '12:15')), true, 'l inizio e dentro');
  assertEquals(apertoOra(cucina, ore(LUN, '14:30')), false, 'la fine e fuori');
  assertEquals(apertoOra(cucina, ore(LUN, '16:00')), false);
  const x = leggiOrari('12:15-17:30; ven,sab 12:15-20:30');
  assertEquals(apertoOra(x, ore(LUN, '16:00')), true);
  assertEquals(apertoOra(x, ore(LUN, '19:00')), false, 'di lunedi la sera no');
  assertEquals(apertoOra(x, ore(VEN, '19:00')), true, 'di venerdi si');
  assertEquals(apertoOra(x, ore(SAB, '20:29')), true);
  assertEquals(apertoOra(x, ore(SAB, '20:30')), false);
  assertEquals(apertoOra(x, ore(DOM, '19:00')), false);
  assertEquals(apertoOra(null, ore(DOM, '03:00')), true, 'senza orari e sempre aperto');
  assertEquals(apertoOra(leggiOrari('22:00-02:00'), ore(LUN, '01:00')), true, 'a cavallo della mezzanotte, come le fasce');
});

Deno.test('per chi ordina dal QR la fine si anticipa di dieci minuti: alle 14:30 in punto la cucina non deve trovare un ordine nuovo', () => {
  /* la proprieta', 5 settembre 2026 */
  const strette = restringi(leggiOrari('12:15-14:30; ven,sab 12:15-20:30'), 10);
  assertEquals(strette, [{ dalle: '12:15', alle: '14:20', giorni: null }, { dalle: '12:15', alle: '20:20', giorni: [5, 6] }]);
  assertEquals(apertoOra(strette, ore(LUN, '14:25')), false);
  assertEquals(apertoOra(strette, ore(LUN, '14:19')), true);
  assertEquals(restringi(null, 10), null, 'senza orari resta sempre');
  assertEquals(restringi(leggiOrari('00:00-00:00'), 10), [{ dalle: '00:00', alle: '00:00', giorni: null }], 'tutto il giorno resta tutto il giorno');
  assertEquals(restringi(leggiOrari('22:00-00:05'), 10), [{ dalle: '22:00', alle: '23:55', giorni: null }], 'anche oltre la mezzanotte');
  assertEquals(restringi(leggiOrari('12:00-12:05'), 10), [], 'una finestra piu corta del margine sparisce');
});

Deno.test('a cucina chiusa il biglietto della cucina esce al bancone: i cuochi non ci sono piu', () => {
  /* la proprieta', 5 settembre 2026 */
  assertEquals(stampanteAdesso('cucina', '12:15-14:30', ore(LUN, '13:00')), 'cucina');
  assertEquals(stampanteAdesso('cucina', '12:15-14:30', ore(LUN, '15:00')), 'bar');
  assertEquals(stampanteAdesso('bar', '12:15-14:30', ore(LUN, '13:00')), 'bar');
  assertEquals(stampanteAdesso('cucina', null, ore(LUN, '15:00')), 'cucina', 'senza orari la cucina e sempre aperta');
  assertEquals(stampanteAdesso('cucina', '', ore(LUN, '03:00')), 'cucina');
});
