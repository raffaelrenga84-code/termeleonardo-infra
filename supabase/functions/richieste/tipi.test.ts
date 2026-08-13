/* Test della validazione per tipo di richiesta.
   La data di riferimento arriva da fuori: legata a new Date() questi test
   comincerebbero a fallire da soli col passare del tempo. */
import { assertEquals } from 'jsr:@std/assert';
import { validaDati } from './tipi.ts';

const OGGI = new Date('2026-08-13T10:00:00Z');

const transfer = {
  quando: '2026-09-10',
  ora: '14:30',
  pax: 2,
  verso: 'arrivo',
  luogo: 'Venezia  aeroporto',
  volo: 'FR1234',
  ritorno: true,
  note: 'Due valigie grandi.',
};

Deno.test('un tipo sconosciuto viene rifiutato, non salvato per sicurezza', () => {
  assertEquals(validaDati('scommesse', {}, OGGI).errore, 'tipo di richiesta sconosciuto');
  assertEquals(validaDati('', {}, OGGI).errore, 'tipo di richiesta sconosciuto');
});

Deno.test('un transfer completo passa e arriva ripulito', () => {
  const { errore, dati } = validaDati('transfer', transfer, OGGI);
  assertEquals(errore, undefined);
  assertEquals(dati!.pax, 2);
  assertEquals(dati!.verso, 'arrivo');
  assertEquals(dati!.luogo, 'Venezia  aeroporto');
  assertEquals(dati!.ritorno, true);
});

/* Il valore finisce ricopiato nel modulo ATAM: se non combacia con il loro
   elenco, la reception deve cercarlo a mano fra 189 voci. */
Deno.test('il luogo deve esistere nell elenco ATAM, testualmente', () => {
  assertEquals(validaDati('transfer', { ...transfer, luogo: 'Venezia aeroporto' }, OGGI).errore,
    'luogo non in elenco');
  assertEquals(validaDati('transfer', { ...transfer, luogo: 'Marte' }, OGGI).errore,
    'luogo non in elenco');
  assertEquals(validaDati('transfer', { ...transfer, luogo: '' }, OGGI).errore,
    'luogo non in elenco');
  /* i tre circoli sono destinazioni valide: green fee e taxi sono la
     stessa richiesta */
  assertEquals(validaDati('transfer', { ...transfer, luogo: 'Golf Montecchia🏌' }, OGGI).errore,
    undefined);
});

Deno.test('la data del transfer deve avere senso', () => {
  assertEquals(validaDati('transfer', { ...transfer, quando: '' }, OGGI).errore, 'data mancante');
  assertEquals(validaDati('transfer', { ...transfer, quando: '2026-02-31' }, OGGI).errore,
    'data non valida');
  assertEquals(validaDati('transfer', { ...transfer, quando: '2026-08-12' }, OGGI).errore,
    'data nel passato');
  /* oggi stesso e' legittimo: chi atterra fra tre ore ha diritto di chiedere */
  assertEquals(validaDati('transfer', { ...transfer, quando: '2026-08-13' }, OGGI).errore,
    undefined);
  assertEquals(validaDati('transfer', { ...transfer, quando: '2029-08-13' }, OGGI).errore,
    'data troppo lontana');
});

Deno.test('l ora serve e deve essere un orario', () => {
  assertEquals(validaDati('transfer', { ...transfer, ora: '' }, OGGI).errore, 'ora mancante');
  assertEquals(validaDati('transfer', { ...transfer, ora: 'mattina' }, OGGI).errore, 'ora non valida');
  assertEquals(validaDati('transfer', { ...transfer, ora: '25:00' }, OGGI).errore, 'ora non valida');
  assertEquals(validaDati('transfer', { ...transfer, ora: '9:5' }, OGGI).errore, 'ora non valida');
  assertEquals(validaDati('transfer', { ...transfer, ora: '09:05' }, OGGI).errore, undefined);
});

Deno.test('i passeggeri stanno fra uno e otto', () => {
  assertEquals(validaDati('transfer', { ...transfer, pax: 0 }, OGGI).errore, 'passeggeri non validi');
  assertEquals(validaDati('transfer', { ...transfer, pax: 9 }, OGGI).errore, 'passeggeri non validi');
  assertEquals(validaDati('transfer', { ...transfer, pax: '3' }, OGGI).dati!.pax, 3);
});

Deno.test('arrivo o partenza, non altro', () => {
  assertEquals(validaDati('transfer', { ...transfer, verso: 'partenza' }, OGGI).errore, undefined);
  assertEquals(validaDati('transfer', { ...transfer, verso: 'forse' }, OGGI).errore,
    'indicare arrivo o partenza');
});

Deno.test('volo e note sono facoltativi ma non sconfinati', () => {
  const senza = validaDati('transfer', { ...transfer, volo: '', note: '' }, OGGI);
  assertEquals(senza.errore, undefined);
  assertEquals(senza.dati!.volo, '');
  assertEquals(validaDati('transfer', { ...transfer, note: 'a'.repeat(3000) }, OGGI).errore,
    'note troppo lunghe');
});
