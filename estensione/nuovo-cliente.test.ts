/* ============================================================
   nuovo-cliente.test.ts — il modulo del cliente nuovo si compila da sé.

   «Quando il cliente non c'è bisogna crearlo, ma Fidra non ti ripropone
   il nome: anche se ho usato il pulsante di Outlook per caricare in
   Fidra, il modulo si apre vuoto.» I dati dell'ospite l'estensione li ha
   già letti dall'email — cognome, nome, email, telefono — e poi si
   ricopiano a mano da un'altra finestra.

   QUESTE PROVE GUARDANO IL TESTO, non il comportamento: lo script vive
   dentro il DOM di Fidra e fuori dal browser non si esegue. Tengono
   ferme le tre regole che, cambiando, farebbero danno davvero — perché
   questa è la seconda cosa in tutta l'estensione che SCRIVE dentro
   Fidra, e l'unica che scrive dentro un'anagrafica.

   Un'anagrafica sbagliata è peggio di un'anagrafica mancante: resta lì,
   e la ritrova qualcun altro fra sei mesi senza sapere da dove viene.
   ============================================================ */
import { assert } from 'jsr:@std/assert';

const NUOVO = Deno.readTextFileSync(new URL('fidra-nuovo-cliente.js', import.meta.url));

Deno.test('non si compila da solo, e non si salva mai', () => {
  /* LA REGOLA DI CASA: l'ultimo clic è dell'operatore. Vale per la bozza
     che diventa offerta, vale qui — e qui di più, perché un profilo
     salvato storto resta in anagrafica. */
  assert(
    /addEventListener\('click', \(\) => \{[\s\S]{0,80}riempi\(modale\)/.test(NUOVO),
    'il modulo si riempie senza che nessuno lo chieda',
  );
  assert(
    !/\.click\(\)/.test(NUOVO),
    'lo script clicca qualcosa: Salva deve restare all operatore',
  );
  assert(
    !/[Ss]alva[^<]{0,20}\.click|submit\(\)/.test(NUOVO),
    'si arriva a salvare da soli: un profilo sbagliato resterebbe in anagrafica',
  );
});

Deno.test('si scrive solo nei campi vuoti', () => {
  /* se l'operatore ha già scritto qualcosa ha davanti l'email e ne sa
     più di noi: sovrascriverlo sarebbe silenzioso e sbagliato */
  assert(
    /if \(\(campo\.value \|\| ''\)\.trim\(\)\) \{ saltati\.push/.test(NUOVO),
    'si sovrascrive quello che l operatore ha gia scritto',
  );
  assert(
    /!\(c\.cognome\.value \|\| ''\)\.trim\(\) && !\(c\.nome\.value \|\| ''\)\.trim\(\)/.test(NUOVO),
    'la riga compare anche su un profilo esistente, dove non c entra niente',
  );
});

Deno.test('si vede prima cosa verra scritto', () => {
  /* il cognome è indovinato dall'ultima parola della firma — «Una Pipic
     Leonard» diventa cognome Leonard — e a volte va invertito. Va letto
     PRIMA di cliccare: per questo la riga mostra i valori, non solo il
     pulsante. */
  assert(
    /riga\('Cognome', dati\.cognome\)/.test(NUOVO) && /riga\('Email', dati\.email\)/.test(NUOVO),
    'i valori non si vedono piu prima del clic: si scoprirebbe l errore dopo',
  );
  assert(
    /ultima parola del nome in firma/.test(NUOVO),
    'sparito l avviso sul cognome indovinato: e la cosa che sbaglia piu spesso',
  );
});

Deno.test('si scrive col setter nativo, non con .value', () => {
  assert(
    /Object\.getOwnPropertyDescriptor\(proto, 'value'\)\?\.set/.test(NUOVO),
    'si torna ad assegnare .value: Fidra non se ne accorgerebbe',
  );
  assert(
    /new Event\('change', \{ bubbles: true \}\)/.test(NUOVO),
    'senza l evento change il componente non rilegge il campo',
  );
});

Deno.test('i dati vecchi non si riusano', () => {
  /* la richiesta di stamattina non c'entra col cliente che si sta
     creando adesso: mettere l'email di un altro ospite in un'anagrafica
     nuova e' il modo piu' rapido di sporcare l'archivio */
  assert(
    /VALIDITA_MS = 60 \* 60 \* 1000/.test(NUOVO),
    'sparita la scadenza: si riproporrebbero i dati di una richiesta vecchia',
  );
  assert(
    /Date\.now\(\) - \(b\.creato \|\| 0\) < VALIDITA_MS/.test(NUOVO),
    'la scadenza non si controlla piu sulla richiesta caricata da Outlook',
  );
});

Deno.test('lo script gira dove serve', () => {
  const manifest = JSON.parse(
    Deno.readTextFileSync(new URL('manifest.json', import.meta.url)),
  ) as { content_scripts: Array<{ matches: string[]; js: string[] }> };
  const booking = manifest.content_scripts.find((c) =>
    c.matches.some((m) => m.includes('/booking'))
  );
  assert(
    booking && booking.js.includes('fidra-nuovo-cliente.js'),
    'il modulo del cliente nuovo non gira su /booking',
  );
});

Deno.test('dice cosa ha visto, se non ce la fa', () => {
  assert(/leoNuovoCliente/.test(NUOVO), 'sparita la diagnostica');
  assert(
    /campo non trovato/.test(NUOVO),
    'se un campo non si trova non lo dice: sembrerebbe scritto e non lo e',
  );
});
