/* Test della validazione delle richieste dal sito.
   La data di riferimento si passa da fuori: legandola a new Date() questi
   test comincerebbero a fallire da soli col passare del tempo. */
import { assertEquals } from 'jsr:@std/assert';
import { validaRichiesta } from './valida.ts';

const OGGI = new Date('2026-08-13T10:00:00Z');

const buona = {
  nome: '  Mario Rossi  ',
  email: 'mario@email.it',
  telefono: '+39 049 1234567',
  check_in: '2026-09-10',
  check_out: '2026-09-14',
  ospiti: 2,
  tipo_camera: 'Doppia',
  pacchetto: 'Soggiorno Smart',
  messaggio: 'Vorremmo una camera silenziosa.',
  lingua: 'de',
};

Deno.test('una richiesta completa passa e arriva ripulita', () => {
  const { errore, dati } = validaRichiesta(buona, OGGI);
  assertEquals(errore, undefined);
  assertEquals(dati!.nome, 'Mario Rossi');
  assertEquals(dati!.email, 'mario@email.it');
  assertEquals(dati!.ospiti, 2);
  assertEquals(dati!.lingua, 'de');
  assertEquals(dati!.notti, 4);
});

Deno.test('senza nome o senza email non si procede', () => {
  assertEquals(validaRichiesta({ ...buona, nome: '   ' }, OGGI).errore, 'nome mancante');
  assertEquals(validaRichiesta({ ...buona, email: 'mario@' }, OGGI).errore, 'email non valida');
  assertEquals(validaRichiesta({ ...buona, email: '' }, OGGI).errore, 'email non valida');
});

Deno.test('le date devono avere senso', () => {
  assertEquals(validaRichiesta({ ...buona, check_in: '' }, OGGI).errore, 'date mancanti');
  assertEquals(validaRichiesta({ ...buona, check_in: 'domani' }, OGGI).errore, 'date non valide');
  assertEquals(
    validaRichiesta({ ...buona, check_in: '2026-09-14', check_out: '2026-09-10' }, OGGI).errore,
    'la partenza precede l’arrivo',
  );
  assertEquals(
    validaRichiesta({ ...buona, check_in: '2026-09-10', check_out: '2026-09-10' }, OGGI).errore,
    'la partenza precede l’arrivo',
  );
});

Deno.test('un arrivo gia passato e un errore, ma oggi va bene', () => {
  assertEquals(
    validaRichiesta({ ...buona, check_in: '2026-08-12', check_out: '2026-08-15' }, OGGI).errore,
    'arrivo nel passato',
  );
  /* chi scrive la mattina per la sera stessa deve poterlo fare */
  const oggiStesso = validaRichiesta({ ...buona, check_in: '2026-08-13', check_out: '2026-08-14' }, OGGI);
  assertEquals(oggiStesso.errore, undefined);
});

Deno.test('un soggiorno troppo lontano o troppo lungo non e una richiesta vera', () => {
  assertEquals(
    validaRichiesta({ ...buona, check_in: '2029-09-10', check_out: '2029-09-14' }, OGGI).errore,
    'arrivo troppo lontano',
  );
  assertEquals(
    validaRichiesta({ ...buona, check_in: '2026-09-10', check_out: '2026-12-10' }, OGGI).errore,
    'soggiorno troppo lungo',
  );
});

Deno.test('gli ospiti restano dentro limiti sensati', () => {
  assertEquals(validaRichiesta({ ...buona, ospiti: 0 }, OGGI).errore, 'numero di ospiti non valido');
  assertEquals(validaRichiesta({ ...buona, ospiti: 99 }, OGGI).errore, 'numero di ospiti non valido');
  assertEquals(validaRichiesta({ ...buona, ospiti: '3' }, OGGI).dati!.ospiti, 3);
});

Deno.test('i campi lunghi vengono rifiutati, non troncati in silenzio', () => {
  assertEquals(validaRichiesta({ ...buona, nome: 'a'.repeat(200) }, OGGI).errore, 'nome troppo lungo');
  assertEquals(
    validaRichiesta({ ...buona, messaggio: 'a'.repeat(3000) }, OGGI).errore,
    'messaggio troppo lungo',
  );
});

Deno.test('una lingua sconosciuta diventa italiano', () => {
  assertEquals(validaRichiesta({ ...buona, lingua: 'zz' }, OGGI).dati!.lingua, 'it');
  assertEquals(validaRichiesta({ ...buona, lingua: undefined }, OGGI).dati!.lingua, 'it');
});

Deno.test('i campi facoltativi possono mancare', () => {
  const { errore, dati } = validaRichiesta({
    nome: 'Anna', email: 'anna@email.it',
    check_in: '2026-09-10', check_out: '2026-09-12',
  }, OGGI);
  assertEquals(errore, undefined);
  assertEquals(dati!.telefono, '');
  assertEquals(dati!.tipo_camera, '');
  assertEquals(dati!.ospiti, 2);
});
