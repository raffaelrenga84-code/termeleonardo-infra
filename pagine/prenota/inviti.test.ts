/* ============================================================
   inviti.test.ts — transfer e trattamenti dopo la richiesta di camera.

   LA SCELTA CHE PRESIDIA. Transfer e trattamenti restano richieste loro,
   coi moduli che esistono già: non entrano nel percorso della camera e
   non entrano nella ricevuta. Nel percorso no perché la camera non è
   ancora confermata e ogni passo in più costa richieste; nella ricevuta
   no perché quell'email è già densa — prezzo, caparra, tassa di
   soggiorno, cane — e due inviti commerciali dentro una ricevuta si
   leggono male.

   Stanno sulla schermata finale, dove l'ospite è ancora davanti allo
   schermo e ha appena finito.

   IL DIFETTO CHE PRESIDIA. I contatti si leggono dai campi del modulo, e
   quando la schermata finale si disegna quei campi NON ESISTONO PIÙ: il
   DOM è stato sostituito. Se non si conservano prima, i collegamenti
   escono nudi e l'ospite ridigita tutto — che è esattamente la cosa che
   questi inviti servono a evitare.
   ============================================================ */
import { assert } from 'jsr:@std/assert';

const PAGINA = Deno.readTextFileSync(new URL('index.html', import.meta.url));

Deno.test('la schermata finale offre tutti e due i moduli', () => {
  assert(
    PAGINA.includes("indirizzoModulo('trattamenti', LNG, OSPITE)"),
    'sparito l invito ai trattamenti',
  );
  assert(
    PAGINA.includes("indirizzoModulo('transfer', LNG, OSPITE)"),
    'sparito l invito al transfer',
  );
});

Deno.test('e i contatti si conservano PRIMA che il modulo sparisca', () => {
  /* l ordine e' il presidio: se OSPITE si riempisse dopo STATO='fatta', i
     campi sarebbero gia' spariti dal DOM e i collegamenti uscirebbero nudi */
  const dove = PAGINA.indexOf('OSPITE = {');
  const poi = PAGINA.indexOf("STATO = 'fatta'", dove);
  assert(dove > 0, 'i contatti non si conservano piu');
  assert(poi > dove, 'i contatti si conservano DOPO il cambio di schermata: usciranno vuoti');
});

Deno.test('e senza contatti gli inviti non escono affatto', () => {
  /* un pulsante «i suoi dati sono gia compilati» che apre un modulo vuoto
     e' peggio di nessun pulsante */
  assert(
    PAGINA.includes('${OSPITE ? `'),
    'gli inviti escono anche senza contatti: prometterebbero un modulo gia pieno e ne aprirebbero uno vuoto',
  );
});

Deno.test('e in ogni lingua dicono che i dati sono gia dentro', () => {
  const note = [...PAGINA.matchAll(/invitoNota:'([^']*)'/g)].map((m) => m[1]);
  assert(note.length === 4, `le note degli inviti sono ${note.length}, non 4`);
  for (const [i, n] of note.entries()) {
    assert(n.trim().length > 20, `nota ${i + 1} troppo corta: «${n}»`);
  }
});

/* ============================================================
   LA SECONDA CAMERA.

   «Cerchi una camera per volta» non bastava, e la proprietà l'ha detto
   subito: rifare tutto da capo tre volte non lo fa nessuno. Una pagina
   di prenotazione non è un carrello — due camere restano due richieste —
   ma la seconda può costare tre clic invece di un modulo intero, perché
   contatti e date viaggiano già nell'indirizzo.

   E PORTA CON SÉ IL NUMERO DELLA PRIMA. Senza, la reception riceve due
   fogli slegati e assegna due camere lontane a persone che viaggiano
   insieme: il difetto che rende inutile tutta la comodità.
   ============================================================ */
Deno.test('la schermata finale offre anche un altra camera', () => {
  assert(
    PAGINA.includes("indirizzoModulo('prenota', LNG, { ...OSPITE, insieme:"),
    'sparito l invito ad aggiungere una seconda camera',
  );
  /* LA CATENA RESTA ATTACCATA ALLA PRIMA RICHIESTA, non alla precedente:
     altrimenti la terza camera punterebbe alla seconda e la reception
     dovrebbe risalire una catena invece di leggere un numero. */
  assert(
    PAGINA.includes('insieme: DA_URL.insieme || NUMERO_FATTA'),
    'la catena si attacca alla camera precedente invece che alla prima richiesta',
  );
  /* e ogni camera porta il suo numero, per il cartello in cima */
  assert(
    PAGINA.includes('camera: (DA_URL.camera || 1) + 1'),
    'la camera dopo non porta piu il suo numero: il cartello non saprebbe che dire',
  );
});

Deno.test('e il numero si ricorda PRIMA di disegnare la schermata', () => {
  const ricorda = PAGINA.indexOf('NUMERO_FATTA = numero;');
  const disegna = PAGINA.indexOf('${OSPITE ? `');
  assert(ricorda > 0, 'il numero della richiesta non si ricorda piu');
  assert(ricorda < disegna, 'si disegna prima di ricordare il numero: l indirizzo uscirebbe senza');
});

Deno.test('le note di partenza tengono i due fatti separati', () => {
  /* il riferimento di un OFFERTA della reception e il numero della camera
     a cui questa si aggiunge sono due cose diverse: se ci sono tutte e
     due si scrivono tutte e due, non una al posto dell altra */
  assert(PAGINA.includes('function noteIniziali(t) {'), 'sparita noteIniziali');
  assert(PAGINA.includes('t.insiemeA(DA_URL.insieme)'), 'il numero della prima non finisce nelle note');
  assert(PAGINA.includes('t.rifOfferta(DA_URL.rif)'), 'il riferimento offerta non finisce piu nelle note');
  const insieme = PAGINA.indexOf('t.insiemeA(DA_URL.insieme)');
  const rif = PAGINA.indexOf('t.rifOfferta(DA_URL.rif)');
  assert(insieme < rif, 'l ordine e cambiato: il collegamento va scritto per primo');
});

Deno.test('il cartello dice dove si e, quando la camera si aggiunge a un altra', () => {
  /* chi aggiunge una camera si ritrova davanti una pagina identica a
     quella di prima: senza una riga che dica dove si trova, non lo
     capisce e crede di aver sbagliato qualcosa */
  assert(PAGINA.includes('<div id="collegata"></div>'), 'sparito il posto del cartello');
  assert(PAGINA.includes('t0.cameraDiSerie(DA_URL.camera, DA_URL.insieme)'), 'il cartello non dice piu il numero');
  assert(PAGINA.includes('t0.siAggiungeA(DA_URL.insieme)'), 'senza numero il cartello non dice niente');
  /* e solo quando c e davvero un collegamento */
  assert(PAGINA.includes('if (DA_URL.insieme) {'), 'il cartello esce anche a chi prenota una camera sola');
});

Deno.test('e l avviso sulle piu camere si da PRIMA di cercare', () => {
  /* arrivare a un elenco corto senza una spiegazione e quello che fa
     chiudere la pagina: si dice sul passo delle date, mentre si scrive */
  assert(PAGINA.includes('function avvisoPersone()'), 'sparito l avviso sulle piu camere');
  assert(
    PAGINA.includes("'fAdulti').addEventListener('input', avvisoPersone)"),
    'l avviso non si aggiorna piu mentre si scrive',
  );
  assert(
    PAGINA.includes("'fBambini').addEventListener('input', avvisoPersone)"),
    'l avviso ignora i bambini: in quattro con due figli direbbe la cosa sbagliata',
  );
  assert(PAGINA.includes('const PERSONE_PER_CAMERA = 4;'), 'sparito il tetto di quattro per camera');
  /* e si disegna anche all APERTURA, non solo quando si tocca un campo:
     chi arriva con quattro persone gia scritte nell indirizzo non
     toccherebbe niente e non leggerebbe niente */
  assert(PAGINA.includes('  avvisoPersone();'), 'l avviso non si disegna all apertura');
});

Deno.test('la domanda «quante camere» esce da tre persone in su, non prima', () => {
  /* sotto le tre non c e niente da decidere: una domanda in piu in cima
     all imbuto costa richieste */
  assert(PAGINA.includes('if (n < 3) {'), 'la domanda esce anche a chi e in due');
  assert(PAGINA.includes('id="fCamere"'), 'sparita la domanda sulle camere');
  assert(PAGINA.includes('t.primaCamera(CAMERE_TOTALI)'), 'non si spiega piu che cosa succede dopo');
});

Deno.test('e il totale viaggia fino al cartello della camera dopo', () => {
  assert(
    PAGINA.includes("di: CAMERE_TOTALI || DA_URL.di || ''"),
    'il totale non arriva alla camera dopo: il cartello tornerebbe a dire solo il numero',
  );
  assert(
    PAGINA.includes('t0.cameraDiQuante(DA_URL.camera, DA_URL.di, DA_URL.insieme)'),
    'il cartello non dice piu «di quante»',
  );
  /* e senza totale si ripiega sul solo numero, invece di tacere */
  assert(
    PAGINA.includes('t0.cameraDiSerie(DA_URL.camera, DA_URL.insieme)'),
    'senza totale il cartello non dice piu niente',
  );
});
