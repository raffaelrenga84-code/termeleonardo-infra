/* Test della validazione delle richieste dal sito.
   La data di riferimento si passa da fuori: legandola a new Date() questi
   test comincerebbero a fallire da soli col passare del tempo. */
import { assertEquals } from 'jsr:@std/assert';
import { validaContatti, validaParametriDisponibilita, validaRichiesta } from './valida.ts';

const OGGI = new Date('2026-08-13T10:00:00Z');

const buona = {
  privacy_presa_atto: true,
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
    privacy_presa_atto: true,
    nome: 'Anna', email: 'anna@email.it',
    check_in: '2026-09-10', check_out: '2026-09-12',
  }, OGGI);
  assertEquals(errore, undefined);
  assertEquals(dati!.telefono, '');
  assertEquals(dati!.tipo_camera, '');
  assertEquals(dati!.ospiti, 2);
});

/* Anche una richiesta raccoglie nome, email e telefono: l'informativa va
   presa d'atto qui come sulla pagina dei buoni. Consenso a se stante e non
   dedotto dal fatto che qualcuno abbia premuto invia. */
Deno.test('senza presa d atto della privacy la richiesta non parte', () => {
  assertEquals(validaContatti({ nome: 'Anna', email: 'a@b.it' }).errore,
    'informativa privacy non accettata');
  assertEquals(validaContatti({ nome: 'Anna', email: 'a@b.it', privacy_presa_atto: false }).errore,
    'informativa privacy non accettata');
  assertEquals(validaContatti({ nome: 'Anna', email: 'a@b.it', privacy_presa_atto: true }).errore,
    undefined);
});

/* Gli argomenti dell'azione a=disponibilita non hanno contatti (e' una
   ricerca, non ancora una richiesta), ma devono rispettare gli stessi
   limiti di un soggiorno vero: senza, un check_in malformato o assurdo
   passerebbe diretto al servizio a monte. */
Deno.test('i parametri di disponibilita rispettano gli stessi limiti di una richiesta', () => {
  assertEquals(
    validaParametriDisponibilita({ check_in: '', check_out: '2026-09-12' }, OGGI).errore,
    'date mancanti',
  );
  assertEquals(
    validaParametriDisponibilita({ check_in: 'boh', check_out: '2026-09-12' }, OGGI).errore,
    'date non valide',
  );
  assertEquals(
    validaParametriDisponibilita({ check_in: '2026-09-14', check_out: '2026-09-10' }, OGGI).errore,
    'la partenza precede l’arrivo',
  );
  assertEquals(
    validaParametriDisponibilita({ check_in: '2026-08-12', check_out: '2026-08-15' }, OGGI).errore,
    'arrivo nel passato',
  );
  assertEquals(
    validaParametriDisponibilita({ check_in: '2029-09-10', check_out: '2029-09-14' }, OGGI).errore,
    'arrivo troppo lontano',
  );
  assertEquals(
    validaParametriDisponibilita({ check_in: '2026-09-10', check_out: '2026-12-10' }, OGGI).errore,
    'soggiorno troppo lungo',
  );
});

Deno.test('il numero di adulti resta dentro un tetto sensato', () => {
  assertEquals(
    validaParametriDisponibilita(
      { check_in: '2026-09-10', check_out: '2026-09-12', adulti: 0 }, OGGI,
    ).errore,
    'numero di adulti non valido',
  );
  assertEquals(
    validaParametriDisponibilita(
      { check_in: '2026-09-10', check_out: '2026-09-12', adulti: 99 }, OGGI,
    ).errore,
    'numero di adulti non valido',
  );
  const conStringa = validaParametriDisponibilita(
    { check_in: '2026-09-10', check_out: '2026-09-12', adulti: '3' }, OGGI,
  );
  assertEquals(conStringa.errore, undefined);
  assertEquals(conStringa.dati!.adulti, 3);
});

Deno.test('senza indicare gli adulti si assume una coppia', () => {
  const r = validaParametriDisponibilita({ check_in: '2026-09-10', check_out: '2026-09-12' }, OGGI);
  assertEquals(r.errore, undefined);
  assertEquals(r.dati!.adulti, 2);
  assertEquals(r.dati!.check_in, '2026-09-10');
  assertEquals(r.dati!.check_out, '2026-09-12');
});

/* ================= I9 e I11: bambini ed eta passano dal presidio =================
   L'azione a=disponibilita e' pubblica ed e' l'unico argomento che scavalcava
   il presidio costruito apposta: Number('due') da NaN, e eta_bambini poteva
   essere un array di diecimila elementi qualsiasi, inoltrato al sito vero
   dell'hotel. */
const ricerca = { check_in: '2026-09-10', check_out: '2026-09-12', adulti: 2 };

Deno.test('i bambini della ricerca sono un intero dentro limiti sensati', () => {
  assertEquals(validaParametriDisponibilita({ ...ricerca, bambini: 'due' }, OGGI).errore,
    'numero di bambini non valido');
  assertEquals(validaParametriDisponibilita({ ...ricerca, bambini: -1 }, OGGI).errore,
    'numero di bambini non valido');
  assertEquals(validaParametriDisponibilita({ ...ricerca, bambini: 1.5 }, OGGI).errore,
    'numero di bambini non valido');
  assertEquals(validaParametriDisponibilita({ ...ricerca, bambini: 7 }, OGGI).errore,
    'numero di bambini non valido');
});

Deno.test('senza bambini la ricerca vale come prima, con zero bambini', () => {
  const r = validaParametriDisponibilita(ricerca, OGGI);
  assertEquals(r.errore, undefined);
  assertEquals(r.dati!.bambini, 0);
  assertEquals(r.dati!.eta_bambini, []);
});

Deno.test('serve un eta per ogni bambino, e deve essere un eta da bambino', () => {
  assertEquals(validaParametriDisponibilita({ ...ricerca, bambini: 2, eta_bambini: [4] }, OGGI).errore,
    'eta dei bambini non valide');
  assertEquals(validaParametriDisponibilita({ ...ricerca, bambini: 1, eta_bambini: [4, 9] }, OGGI).errore,
    'eta dei bambini non valide');
  assertEquals(validaParametriDisponibilita({ ...ricerca, bambini: 1, eta_bambini: ['quattro'] }, OGGI).errore,
    'eta dei bambini non valide');
  assertEquals(validaParametriDisponibilita({ ...ricerca, bambini: 1, eta_bambini: [-1] }, OGGI).errore,
    'eta dei bambini non valide');
  assertEquals(validaParametriDisponibilita({ ...ricerca, bambini: 1, eta_bambini: [40] }, OGGI).errore,
    'eta dei bambini non valide');
  assertEquals(validaParametriDisponibilita({ ...ricerca, bambini: 1, eta_bambini: 'quattro' }, OGGI).errore,
    'eta dei bambini non valide');
});

/* un array di diecimila elementi non deve nemmeno essere guardato voce per
   voce: il numero di bambini lo limita gia' a sei */
Deno.test('un array di eta sterminato non arriva al sito dell hotel', () => {
  const enorme = Array.from({ length: 10000 }, () => 5);
  assertEquals(validaParametriDisponibilita({ ...ricerca, bambini: 2, eta_bambini: enorme }, OGGI).errore,
    'eta dei bambini non valide');
});

Deno.test('due bambini con la loro eta passano e arrivano puliti', () => {
  const r = validaParametriDisponibilita({ ...ricerca, bambini: 2, eta_bambini: [4, 9] }, OGGI);
  assertEquals(r.errore, undefined);
  assertEquals(r.dati!.bambini, 2);
  assertEquals(r.dati!.eta_bambini, [4, 9]);
});

/* 8 adulti e 3 bambini cercavano, sceglievano, compilavano — e venivano
   respinti all'invio, perche' li' il tetto e' adulti + bambini <= 10 */
Deno.test('la ricerca e l invio ammettono lo stesso numero di persone', () => {
  assertEquals(
    validaParametriDisponibilita({ ...ricerca, adulti: 8, bambini: 3, eta_bambini: [4, 6, 8] }, OGGI).errore,
    'troppe persone in una richiesta',
  );
  /* e la richiesta vera, con gli stessi undici, era gia' respinta */
  assertEquals(validaRichiesta({ ...buona, ospiti: 11 }, OGGI).errore, 'numero di ospiti non valido');

  const dieci = validaParametriDisponibilita(
    { ...ricerca, adulti: 8, bambini: 2, eta_bambini: [4, 6] }, OGGI);
  assertEquals(dieci.errore, undefined);
  assertEquals(dieci.dati!.adulti, 8);
});
