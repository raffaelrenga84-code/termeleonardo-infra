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
    PAGINA.includes("indirizzoModulo('prenota', LNG, { ...OSPITE, insieme: NUMERO_FATTA })"),
    'sparito l invito ad aggiungere una seconda camera, o non porta piu il numero della prima',
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
