/* ============================================================
   giorni.test.ts — i sette giorni del Day Spa.

   «Metti il calendario solo con la visualizzazione di al massimo 7
   giorni: la disponibilita' dipende dal meteo e dall'occupazione
   dell'hotel, difficile fare previsioni piu' in la'» (la proprieta', 3
   settembre 2026). Quindi niente calendario a mesi: una fila di sette
   giorni da oggi, ognuno con la sua parola.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';
import { ORIZZONTE_GIORNI, pezziGiorno, setteGiorni, statoDelGiorno } from './giorni.js';
/* i nomi dei giorni e dei mesi sono quelli del calendario comune: il modulo
   li riceve come parametro, cosi' non importa un percorso web che Deno non
   saprebbe aprire */
import { TESTI } from '../comune/calendario.js';

Deno.test('sette giorni da oggi compreso, in fila', () => {
  assertEquals(ORIZZONTE_GIORNI, 7);
  assertEquals(setteGiorni('2026-09-03'), ['2026-09-03', '2026-09-04', '2026-09-05', '2026-09-06', '2026-09-07', '2026-09-08', '2026-09-09']);
  assertEquals(setteGiorni('2026-12-29')[3], '2027-01-01', 'attraversa l anno');
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
