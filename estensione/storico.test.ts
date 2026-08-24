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
  assert(
    /Non riesco a trovare la scheda/.test(STORICO),
    'se non trova il cliente non lo dice: il riquadro resterebbe vuoto senza motivo',
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

Deno.test('lo storico aspetta che il cliente sia scelto, non digitato', () => {
  /* si apriva mentre si stava ancora scrivendo «Muller». Il segnale non e'
     il tempo: e' che Fidra ripete il nome in grande sotto il campo.

     MA L'ECO DA SOLA NON PUO' ESSERE L'UNICA CONDIZIONE, e l'abbiamo
     imparato subito dopo: con «Konold Otto» selezionato il riquadro non
     compariva affatto. Se il nome finisce dentro un elemento con figli
     l'eco non si trova, e il riquadro sparisce invece di sbagliare — che
     e' il modo peggiore di fallire, perche' non lo segnala nessuno.

     Percio' vale anche un valore fermo da un giro all'altro: chi digita
     cambia il campo di continuo, chi ha scelto no. */
  assert(/const eco = /.test(STORICO), 'sparita l eco del nome');
  assert(
    /return \(eco \|\| v === prima\) \? v : ''/.test(STORICO),
    'e rimasta solo l eco: se il tema di Fidra cambia, il riquadro sparisce del tutto',
  );
});

Deno.test('il riquadro sta in basso, lontano dall elenco dei clienti', () => {
  /* a 210px dall alto finiva sopra l elenco che si apre sotto il campo di
     ricerca — proprio sopra la cosa che si usa per farlo comparire */
  assert(
    /position:fixed;bottom:96px;right:24px/.test(STORICO),
    'il riquadro e tornato in alto, sopra l elenco dei clienti',
  );
  assert(
    /box\.style\.bottom = 'auto'/.test(STORICO),
    'trascinandolo i due ancoraggi si litigano: bottom va spento',
  );
});
