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
import { assert, assertEquals } from 'jsr:@std/assert';

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

/* ============================================================
   «AGGIORNA IL TELEFONO» SU UN PROFILO CHE ESISTE GIA' (v1.1).

   Il cellulare che l'ospite scrive nel modulo transfer arrivava alla
   reception e ai tassisti, ma su Fidra restava da ricopiare a mano: la
   proprieta', il 2 settembre 2026, ha chiesto che l'estensione lo proponga
   sul profilo. Stesso meccanismo del profilo nuovo — la riga sopra il
   modulo, il pulsante, il setter nativo, Salva all'operatore — con due
   regole in piu', che sono quelle che farebbero danno se cadessero:

   - si propone SOLO se e' lo stesso ospite: l'email del profilo uguale a
     quella della richiesta, o — quando una delle due manca — il cognome.
     Due email diverse sono due persone, anche con lo stesso cognome;
   - si scrive SOLO il telefono, e solo se e' davvero diverso: «0049 162…»
     e «+49 162…» sono lo stesso numero, e proporlo sarebbe rumore.

   Le due regole sono funzioni pure: qui si ESEGUONO, estratte dallo
   script, non si legge soltanto che esistono.
   ============================================================ */
function funzioneDelloScript(nome: string): string {
  const m = NUOVO.match(new RegExp(String.raw`\r?\n  function ${nome}\([^)]*\) \{[\s\S]*?\r?\n  \}`));
  assert(m, nome + '() non si trova per intero nello script');
  return m[0];
}
const telefoniUguali = new Function(funzioneDelloScript('telefoniUguali') + '\nreturn telefoniUguali;')() as
  (a: string, b: string) => boolean;
const stessoOspite = new Function(funzioneDelloScript('stessoOspite') + '\nreturn stessoOspite;')() as
  (dati: Record<string, string>, profilo: Record<string, string>) => boolean;

Deno.test('lo stesso numero scritto in due modi non e un aggiornamento', () => {
  assert(telefoniUguali('0049 162 9821106', '+49 1629821106'), '00 e + sono lo stesso prefisso');
  assert(telefoniUguali('3331234567', '+39 333 1234567'), 'con o senza prefisso internazionale e lo stesso numero');
  assert(telefoniUguali('+39 049 9939200', '049-99.39.200'), 'spazi, punti e trattini non contano');
});

Deno.test('un numero diverso e un aggiornamento', () => {
  assert(!telefoniUguali('+39 049 9939200', '+39 049 8669299'));
  assert(!telefoniUguali('+49 1629821106', '+39 1629821106'), 'stesso numero con prefissi diversi: sono due numeri');
  assert(!telefoniUguali('', '049 9939200'), 'un profilo senza telefono va aggiornato');
  assert(!telefoniUguali('', ''), 'senza numeri non c e niente di uguale');
});

Deno.test('e lo stesso ospite se l email coincide, maiuscole e spazi a parte', () => {
  assert(stessoOspite({ email: 'Ulrike.Somm@web.de', cognome: 'Sommer' },
                      { email: ' ulrike.somm@web.de', cognome: 'Sommer' }));
});

Deno.test('due email diverse sono due persone, anche con lo stesso cognome', () => {
  assert(!stessoOspite({ email: 'a@esempio.it', cognome: 'Rossi' },
                       { email: 'b@esempio.it', cognome: 'Rossi' }),
    'scriverebbe il telefono di un Rossi sul profilo di un altro Rossi');
});

Deno.test('se un email manca decide il cognome', () => {
  assert(stessoOspite({ email: 'a@esempio.it', cognome: 'Sommer' }, { email: '', cognome: 'SOMMER' }));
  assert(!stessoOspite({ email: 'a@esempio.it', cognome: 'Sommer' }, { email: '', cognome: 'Rossi' }));
  assert(stessoOspite({ email: '', cognome: 'Sommer' }, { email: 'x@esempio.de', cognome: 'Sommer' }),
    'la richiesta dal centralino non ha email: vale il cognome');
});

Deno.test('senza niente su cui confrontare non e lo stesso ospite', () => {
  assert(!stessoOspite({ email: '', cognome: '' }, { email: '', cognome: 'Rossi' }));
  assert(!stessoOspite({ email: '', cognome: 'Sommer' }, { email: '', cognome: '' }));
  assert(!stessoOspite({ email: '', cognome: '' }, { email: '', cognome: '' }));
});

Deno.test('l aggiornamento scrive il telefono e basta, e solo dopo il clic', () => {
  const m = NUOVO.match(/function aggiornaTelefono\(modale\) \{([\s\S]*?)\r?\n  \}/);
  assert(m, 'aggiornaTelefono() non si trova per intero');
  assert(/scriviNativo\(c\.telefono, dati\.telefono\)/.test(m[1]), 'non scrive il telefono col setter nativo');
  assertEquals((m[1].match(/scriviNativo\(/g) || []).length, 1,
    'aggiornaTelefono scrive anche altro: su un profilo esistente si tocca solo il telefono');
  assert(
    /addEventListener\('click', \(\) => \{[\s\S]{0,80}aggiornaTelefono\(modale\)/.test(NUOVO),
    'il telefono si aggiorna senza che nessuno lo chieda',
  );
});

Deno.test('si propone solo se e lo stesso ospite e il numero e davvero diverso', () => {
  const m = NUOVO.match(/function telefonoDaAggiornare\(modale\) \{([\s\S]*?)\r?\n  \}/);
  assert(m, 'telefonoDaAggiornare() non si trova per intero');
  assert(/stessoOspite\(dati, /.test(m[1]), 'non controlla che sia lo stesso ospite prima di proporre');
  assert(/telefoniUguali\(/.test(m[1]), 'proporrebbe lo stesso numero scritto in un altro modo');
});

Deno.test('il telefono arriva anche dalla richiesta letta in Outlook', () => {
  assert(/telefono: q\.telefono \|\| ''/.test(NUOVO),
    'raccogli() non legge il telefono da leonardo_richiesta: dal transfer non arriverebbe mai');
  const inject = Deno.readTextFileSync(new URL('outlook-inject.js', import.meta.url));
  assert(/leonardo_richiesta: \{[\s\S]*?telefono: dati\.telefono \|\| ''/.test(inject),
    'outlook-inject non salva il telefono in leonardo_richiesta');
});

Deno.test('lo script gira anche sulla scheda del cliente', () => {
  const manifest = JSON.parse(
    Deno.readTextFileSync(new URL('manifest.json', import.meta.url)),
  ) as { content_scripts: Array<{ matches: string[]; js: string[] }> };
  const scheda = manifest.content_scripts.find((c) =>
    c.matches.some((m) => /\/customers\*?$/.test(m))
  );
  assert(scheda && scheda.js.includes('fidra-nuovo-cliente.js'),
    'su /customers il profilo si apre e il telefono non viene proposto');
  assert(scheda && scheda.js.length === 1,
    'sulla scheda del cliente girano anche script pensati per /booking');
});

/* il nome dell'ospite, nell'email alla reception, sta sotto l'intestazione
   — e l'intestazione cambia col tipo («RICHIESTA TRANSFER», «RICHIESTA
   GREEN FEE», …). Letta solo quella del soggiorno, da un transfer il
   cognome non usciva mai, e senza cognome il telefono si propone soltanto
   se l'email combacia. */
Deno.test('il nome si legge anche sotto «RICHIESTA TRANSFER»', () => {
  const inject = Deno.readTextFileSync(new URL('outlook-inject.js', import.meta.url));
  const m = inject.match(/const mn = t\.match\((\/.*\/i)\);/);
  assert(m, 'la lettura del nome sotto l intestazione non si trova');
  const re = new Function('return ' + m[1])() as RegExp;
  for (const testa of ['RICHIESTA DAL SITO', 'RICHIESTA TRANSFER', 'RICHIESTA GREEN FEE', 'INGRESSO DAY SPA']) {
    const x = ('\n' + testa + '\n\nUlrike Sommer\nRS-2026-0012\n').match(re);
    assert(x && x[1] === 'Ulrike Sommer', 'sotto «' + testa + '» il nome non si legge');
  }
});
