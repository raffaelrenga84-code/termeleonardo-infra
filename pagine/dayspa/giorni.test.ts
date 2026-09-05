/* ============================================================
   giorni.test.ts — i sette giorni del Day Spa.

   «Metti il calendario solo con la visualizzazione di al massimo 7
   giorni: la disponibilita' dipende dal meteo e dall'occupazione
   dell'hotel, difficile fare previsioni piu' in la'» (la proprieta', 3
   settembre 2026). Quindi niente calendario a mesi: una fila di sette
   giorni da oggi, ognuno con la sua parola.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';
import { haSerale, ORIZZONTE_GIORNI, pezziGiorno, giorniInFila, statoDelGiorno } from './giorni.js';
/* i nomi dei giorni e dei mesi sono quelli del calendario comune: il modulo
   li riceve come parametro, cosi' non importa un percorso web che Deno non
   saprebbe aprire */
import { TESTI } from '../comune/calendario.js';

Deno.test('quattordici giorni da oggi compreso, in fila (la proprieta, 5 settembre 2026)', () => {
  assertEquals(ORIZZONTE_GIORNI, 14);
  assertEquals(giorniInFila('2026-09-03'), ['2026-09-03', '2026-09-04', '2026-09-05', '2026-09-06', '2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11', '2026-09-12', '2026-09-13', '2026-09-14', '2026-09-15', '2026-09-16']);
  assertEquals(giorniInFila('2026-12-29')[3], '2027-01-01', 'attraversa l anno');
});

Deno.test('il giorno si legge nella lingua dell ospite: giorno della settimana, numero, mese', () => {
  assertEquals(pezziGiorno('2026-09-05', 'it', TESTI), { settimana: 'sab', giorno: 5, mese: 'set' });
  assertEquals(pezziGiorno('2026-09-05', 'de', TESTI), { settimana: 'Sa', giorno: 5, mese: 'Sept' });
  assertEquals(pezziGiorno('2026-09-05', 'en', TESTI), { settimana: 'Sat', giorno: 5, mese: 'Sep' });
  assertEquals(pezziGiorno('2026-09-05', 'fr', TESTI), { settimana: 'sam', giorno: 5, mese: 'sept' });
  assertEquals(pezziGiorno('2026-09-05', 'xx', TESTI).settimana, 'sab', 'lingua sconosciuta: italiano');
});

Deno.test('lo stato del giorno riassume le sue fasce: la parola migliore vince, chiuso vince su tutto', () => {
  const g = (stati: string[]) => ({ fasce: stati.map((stato, i) => ({ fascia: i ? 'serale' : 'giornaliero', stato })) });
  assertEquals(statoDelGiorno(g(['disponibile', 'esaurito'])), 'disponibile');
  assertEquals(statoDelGiorno(g(['ultimi', 'esaurito'])), 'ultimi');
  assertEquals(statoDelGiorno(g(['esaurito', 'esaurito'])), 'esaurito');
  assertEquals(statoDelGiorno(g(['non-in-vendita'])), 'non-in-vendita');
  assertEquals(statoDelGiorno(g(['esaurito', 'non-in-vendita'])), 'esaurito');
  assertEquals(statoDelGiorno(g(['chiuso', 'chiuso'])), 'chiuso');
  assertEquals(statoDelGiorno(null), 'non-in-vendita', 'un giorno che il server non ha mandato non e in vendita');
  assert(['disponibile', 'ultimi'].includes(statoDelGiorno(g(['ultimi', 'disponibile']))));
});

Deno.test('il serale si segnala sul giorno solo se c e e si puo comprare: venerdi e sabato', () => {
  /* «ricordati che il venerdi e il sabato c e anche il serale: come
     venderlo al meglio?» (la proprieta', 3 settembre 2026) */
  const g = (fasce: [string, string][]) => ({ fasce: fasce.map(([fascia, stato]) => ({ fascia, stato })) });
  assert(haSerale(g([['giornaliero', 'disponibile'], ['serale', 'disponibile']])));
  assert(haSerale(g([['giornaliero', 'esaurito'], ['serale', 'ultimi']])));
  assert(!haSerale(g([['giornaliero', 'disponibile'], ['serale', 'esaurito']])), 'un serale esaurito non si vende');
  assert(!haSerale(g([['giornaliero', 'disponibile']])), 'un mercoledi non ha il serale');
  assert(!haSerale(null));
});
