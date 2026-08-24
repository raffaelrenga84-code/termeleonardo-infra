/* ============================================================
   storico.test.ts — lo storico del cliente, e la bozza che diventa
   offerta.

   DUE COSE CHE SI FACEVANO A MANO OGNI VOLTA.

   1. Su /booking si sceglie il cliente e poi non si sa piu' niente di
      lui: per vedere se ha una mail, dove ha dormito e con che
      trattamento bisognava uscire dalla schermata, cercarlo col
      «Cerca» in alto, riscrivere il nome, aprire la scheda — e
      rifare tutto da capo.

   2. Ogni prenotazione nuova nasce «Bozza», e ogni volta: Modifica →
      Stato → Offerta → Salva.

   QUESTE PROVE GUARDANO IL TESTO, non il comportamento: sono due
   script che vivono dentro il DOM di Fidra e non si eseguono fuori
   dal browser. Tengono ferme le regole che, cambiando, farebbero
   danno — soprattutto la seconda, che e' l'unica cosa in tutta
   l'estensione che SCRIVE dentro Fidra.
   ============================================================ */
import { assert } from 'jsr:@std/assert';

const STORICO = Deno.readTextFileSync(new URL('fidra-storico.js', import.meta.url));
const BOZZA = Deno.readTextFileSync(new URL('fidra-bozza-offerta.js', import.meta.url));

Deno.test('lo storico e in sola lettura', () => {
  /* gira su /booking, dove l'operatore sta compilando: se toccasse il
     modulo mentre lui scrive, il danno sarebbe silenzioso */
  assert(!/\.click\(\)/.test(STORICO), 'lo storico clicca qualcosa: deve solo leggere');
  assert(
    !/scriviNativo|dispatchEvent\(new Event/.test(STORICO),
    'lo storico scrive dentro il modulo: deve solo leggere',
  );
  assert(
    /credentials: 'same-origin'/.test(STORICO),
    'senza la sessione dell operatore le pagine di Fidra non si leggono',
  );
});

Deno.test('lo storico dice quando non ce la fa, invece di restare muto', () => {
  assert(/leoStorico/.test(STORICO), 'sparita la diagnostica');
  /* v1.6: «non trovo la scheda di X» non serve piu' — senza id il riquadro
     non compare affatto, ed e' giusto cosi'. Resta il caso in cui l'id c'e'
     ma la scheda non si legge: quello va detto, altrimenti il riquadro
     resta con «Cerco la sua scheda...» per sempre. */
  assert(
    /per sapere dove si e' fermato/.test(STORICO),
    'se la scheda non si legge il riquadro resta muto, fermo sul «cerco»',
  );
});

Deno.test('lo storico scarta le prenotazioni cancellate', () => {
  /* una cancellata non dice niente sulle abitudini di chi torna */
  assert(
    /cancellat/.test(STORICO),
    'le prenotazioni cancellate finiscono fra gli ultimi soggiorni',
  );
});

Deno.test('la bozza NON diventa offerta da sola', () => {
  /* LA REGOLA DI CASA, scritta in fidra-booking.js dal primo giorno:
     l'ultimo clic e' dell'operatore. Questa e' l'unica cosa in tutta
     l'estensione che scrive dentro Fidra, e deve restare un gesto. */
  assert(
    /addEventListener\('click', \(\) => segnaOfferta\(btn\)\)/.test(BOZZA),
    'il cambio di stato non parte piu da un clic dell operatore',
  );
  assert(
    !/^\s*segnaOfferta\(\)/m.test(BOZZA),
    'segnaOfferta viene chiamata da sola: cambierebbe una pratica mentre la si guarda',
  );
});

Deno.test('dopo aver salvato si rilegge la pagina', () => {
  /* Livewire risponde via rete: dichiarare fatto senza verificare e'
     come non aver fatto niente, ma peggio, perche' ci si crede */
  assert(
    /statoAttuale\(\)/.test(BOZZA) && /for \(let i = 0; i < 20; i\+\+\)/.test(BOZZA),
    'non aspetta piu che Fidra confermi il nuovo stato',
  );
  assert(
    /salvato, ma la pagina dice ancora/.test(BOZZA),
    'se il salvataggio non prende effetto non lo ammette',
  );
});

Deno.test('il pulsante compare solo sulle bozze', () => {
  assert(
    /statoAttuale\(\) !== 'bozza'/.test(BOZZA),
    'il pulsante compare anche su pratiche gia confermate',
  );
});

Deno.test('i due script sono caricati dove servono', () => {
  const manifest = JSON.parse(
    Deno.readTextFileSync(new URL('manifest.json', import.meta.url)),
  ) as { content_scripts: Array<{ matches: string[]; js: string[] }> };
  const su = (frammento: string) =>
    manifest.content_scripts.find((c) => c.matches.some((m) => m.includes(frammento)));

  const booking = su('/booking');
  assert(booking && booking.js.includes('fidra-storico.js'), 'lo storico non gira su /booking');

  const pratica = su('/reservations/');
  assert(
    pratica && pratica.js.includes('fidra-bozza-offerta.js'),
    'il pulsante «→ Offerta» non gira sulla scheda della pratica',
  );
});

Deno.test('lo storico non scambia le date per un nome', () => {
  /* IL DIFETTO DEL PRIMO USO: il riquadro diceva «non trovo la scheda di
     25 Aug. 2026 - 29 Aug. 2026». Prendeva il primo input di testo con
     qualcosa dentro, e il primo e' il campo delle date. */
  assert(/PARE_DATA/.test(STORICO), 'sparito il filtro sulle date: rileggerebbe il calendario');
  assert(
    /function campoCliente\(\)/.test(STORICO),
    'il campo non si cerca piu a partire dall etichetta «Cliente»: torna a indovinare',
  );
});

Deno.test('finche non si sceglie un cliente, il riquadro non c e', () => {
  /* IL DIFETTO, VISTO DAL VIVO. Con «renga» appena digitato e la tendina
     ancora aperta, il riquadro mostrava «+ Schurr Antonie»: un cliente
     che nessuno aveva scelto, senza email e senza soggiorni.

     Due cause, tutt'e due nostre. La prima: valeva come scelta un valore
     «fermo da un giro all'altro» — ma chi digita si ferma, e una pausa di
     un secondo e mezzo davanti alla tendina bastava. La seconda: senza
     id si prendeva il primo link /customers/NNN in pagina, cioe' un
     cliente qualunque, ed e' da li' che veniva quel nome.

     Adesso la regola e' una sola: Fidra scrive l'id in un campo SOLO
     quando il cliente si sceglie dalla tendina. Nessun id, nessun
     riquadro. */
  assert(
    /if \(!id\) return null;/.test(STORICO),
    'senza id si mostra di nuovo qualcosa: tornerebbe la scheda di un altro',
  );
  assert(
    !/v === prima/.test(STORICO),
    'torna a valere il valore fermo da un giro all altro: una pausa mentre si digita passa per una scelta',
  );
  assert(
    !/document\.querySelector\('a\[href\*="\/customers\/"\]'\)/.test(STORICO),
    'torna il ripiego del primo link /customers/: carica la scheda di un cliente qualunque',
  );
});

Deno.test('un nome che non comincia per lettera non e un nome scelto', () => {
  /* «+ Schurr Antonie» — la scheda caricata per sbaglio si annunciava
     cosi'. Un cliente scelto non comincia con un segno di punteggiatura. */
  assert(
    /!\/\^\\p\{L\}\/u\.test\(v\)/.test(STORICO),
    'un valore che non comincia per lettera torna a passare per un nome',
  );
});

Deno.test('il riquadro sta in basso, lontano dall elenco dei clienti', () => {
  /* a 210px dall alto finiva sopra l elenco che si apre sotto il campo di
     ricerca — proprio sopra la cosa che si usa per farlo comparire */
  assert(
    /position:fixed;bottom:150px;right:24px/.test(STORICO),
    'il riquadro e tornato in alto, sopra l elenco dei clienti',
  );
  assert(
    /box\.style\.bottom = 'auto'/.test(STORICO),
    'trascinandolo i due ancoraggi si litigano: bottom va spento',
  );
});

Deno.test('l id non si scambia per il nome', () => {
  /* IL DIFETTO: «non trovo la scheda di 7324» — e 7324 ERA l'id giusto di
     Konold Otto. Fidra mette un campo con l'id subito dopo l'etichetta
     «Cliente», prima di quello del nome: prendendo il primo si prendeva
     l'id. Ottima notizia in realta', perche' vuol dire che l'id sta li'
     pronto: ora i due campi si distinguono per quello che contengono. */
  assert(/function idDalCampo\(\)/.test(STORICO), 'l id non si legge piu dal campo accanto all etichetta');
  assert(
    /\/\^\[0-9\]\+\$\/\.test\(v\)/.test(STORICO),
    'un valore tutto cifre torna a passare per un nome',
  );
});

Deno.test('i soggiorni dell anno in corso non si scartano', () => {
  /* nella scheda di Konold Otto il soggiorno piu' recente e' «03 - 10
     Oct», senza anno: pretendere l anno buttava via proprio le righe
     piu' utili */
  /* confronto letterale: una regex che descrive un'altra regex si sbaglia
     a scappare, e la prova finisce per non provare niente */
  assert(
    STORICO.includes('\\s+\\w{3}|\\d{1,2}'),
    'la data dei soggiorni pretende di nuovo l anno',
  );
});

Deno.test('il riquadro non finisce sotto «Disponibilita e prezzi»', () => {
  assert(
    /bottom:150px/.test(STORICO),
    'e tornato troppo in basso: il pulsante di Fidra gli passa sopra',
  );
});

Deno.test('l email si cerca anche nei campi, non solo nel testo', () => {
  /* IL DIFETTO: «nessuna email in anagrafica» su un profilo che ce l ha.
     Nella scheda l indirizzo vive dentro il campo del modulo «Modifica
     profilo cliente», e textContent legge il testo, non il valore dei
     campi. */
  assert(/a\[href\^="mailto:"\]/.test(STORICO), 'non guarda piu il link mailto');
  assert(
    /getAttribute\('value'\)/.test(STORICO),
    'non guarda piu il valore dei campi: l email del profilo resta invisibile',
  );
  /* E NEMMENO NEI CAMPI, alla fine. Continuava a dire «nessuna email in
     anagrafica» su un profilo che ce l'ha, perche' quel campo sta dentro
     «Modifica profilo cliente» — un modale che Fidra disegna solo quando
     lo apri: nell'HTML della pagina il campo non esiste proprio. Lo stato
     del componente pero' si', gia' serializzato negli attributi. Percio'
     l'ultimo tentativo guarda l'HTML come arriva, attributi compresi. */
  assert(
    /const daGrezzo = /.test(STORICO),
    'non guarda piu l HTML grezzo: l email nascosta nel componente resta invisibile',
  );
  assert(
    /const grezzo = await r\.text\(\)/.test(STORICO),
    'la pagina si riduce subito a testo: gli attributi si perdono prima di poterli guardare',
  );
});

Deno.test('il soggiorno si apre come «stays», non come «reservations»', () => {
  /* IL DIFETTO CHE HA RESO OGNI RIGA MUTA. Sotto ogni soggiorno c'era
     scritto «trattamento non raggiungibile», sempre. Cercavamo il numero
     della pratica come /reservations/NNN, ma aprendo un soggiorno dalla
     scheda del cliente si finisce su:

         /customers/7324/stays/32795/charges

     e' «stays». La parola che cercavamo non compare in quella riga, quindi
     il numero era sempre null e non si tentava nemmeno la lettura.

     Si accettano tutt'e due, e la pagina da leggere dipende da quale
     delle due si e' trovata: sbagliare l'indirizzo darebbe un 404 e
     torneremmo esattamente al punto di partenza. */
  assert(
    /\/\(stays\|reservations\)/.test(STORICO),
    'si torna a cercare solo «reservations»: le righe portano a «stays» e il trattamento sparisce di nuovo',
  );
  assert(
    /\/customers\/\$\{id\}\/stays\/\$\{rid\}\/charges/.test(STORICO),
    'la pagina del soggiorno non si legge piu da /stays/NNN/charges',
  );
});

Deno.test('il trattamento si legge anche se non e da solo nell elemento', () => {
  /* nella pagina del soggiorno la riga e' «< Prenotazione MIGLIOR PREZZO
     MEZZA PENSIONE»: l'elemento NON e' tutto maiuscolo, perche' contiene
     anche «Prenotazione». Cercando elementi interamente maiuscoli non si
     trovava niente. */
  assert(
    /A-ZÀ-Ü0-9 &'\.\\-/.test(STORICO),
    'sparita la ricerca del tratto maiuscolo dentro al testo',
  );
});

Deno.test('«cure» da sola non basta piu a dire che ci sono le cure', () => {
  /* nella pagina del soggiorno c'e' una linguetta che si chiama «Cure»,
     sempre, anche per chi non ne ha fatte: bastava quella per scrivere
     «con cure» sotto ogni riga. Dire a un cliente abituale «lei fa le
     cure» quando non le fa e' peggio che non dire niente. */
  assert(
    !/\\bcure\\b/.test(STORICO),
    'la parola «cure» da sola torna a valere: la linguetta la fa scattare su ogni soggiorno',
  );
  assert(/fangh\[io\]/.test(STORICO), 'sparite le parole che compaiono solo con le cure vere');
});

Deno.test('il trattamento si legge dagli elementi in maiuscolo', () => {
  /* cercandolo nel testo intero con /i, una parola come «pensione» dentro
     una frase qualunque bastava a far partire il taglio */
  assert(
    /x === x\.toUpperCase\(\) && PAROLE\.test\(x\)/.test(STORICO),
    'il trattamento torna a pescare parole dentro le frasi',
  );
  assert(/'HB'/.test(STORICO) && /'BB'/.test(STORICO) && /'FB'/.test(STORICO),
    'sparita la sigla BB/HB/FB, che e quello che si guarda a colpo d occhio');
});

Deno.test('il riquadro dice la sua versione', () => {
  /* il 24 agosto 2026 abbiamo inseguito per due giri un difetto gia'
     corretto: il riquadro sullo schermo era di due versioni prima e non
     c'era modo di accorgersene */
  assert(
    /chrome\.runtime\.getManifest\(\)\.version/.test(STORICO),
    'la versione non si vede piu: «l hai ricaricata?» torna a non avere risposta',
  );
});

Deno.test('la scheda completa si apre dall alto', () => {
  /* in fondo bisognava scorrere tutti i soggiorni per trovare il link, e
     quando serve lo si vuole subito */
  const i = STORICO.indexOf('Apri la scheda completa');
  const j = STORICO.indexOf('Ultimi soggiorni');
  assert(i > 0 && j > 0 && i < j, 'il link alla scheda e tornato in fondo');
});
