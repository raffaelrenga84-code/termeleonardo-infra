/* ============================================================
   ordine.test.ts — con quale ordine escono le categorie di camera.

   IL DIFETTO CHE PRESIDIA. L'ordine con cui il motore restituisce le
   proposte non è quello con cui la reception le venderebbe, e non è un
   dettaglio estetico: è la prima cosa che vede chi sta per prenotare. Chi
   cercava per due persone trovava davanti le suite, e la Doppia e la Queen
   dopo mezza pagina di scorrimento.

   E LE ACCESSIBILI USCIVANO IN MEZZO ALLE ALTRE, mentre il resto della
   casa ha la regola opposta: il chatbot non deve proporne a chi non ha
   dichiarato un'esigenza di accessibilità, e il listino interno le dà
   «solo su richiesta espressa». Qui vanno in fondo — la disponibilità non
   si nasconde, ma non si mette davanti a chi non l'ha chiesta.

   TRE MODI DI ROMPERSI, e nessuno si vede aprendo la pagina in un giorno
   in cui il motore restituisce già le camere nell'ordine giusto:

   · una categoria sparisce nel riordino, o esce due volte — chi cercava
     quella camera non la trova più e prenota altrove;
   · l'elenco nomina un identificativo che il catalogo non ha (rinumerato,
     tolto): la regola non si applica e nessuno se ne accorge;
   · nasce una terza categoria accessibile e finisce in mezzo alle altre
     perché l'elenco IN_FONDO non la conosce.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';
import { CAMERE } from '../../supabase/functions/richieste/camere.ts';
import { adatte, daMostrare, IN_FONDO, ordinaGruppi, perPrezzo, PRIMA_PER_PERSONE } from './ordine.js';

type Gruppo = { camera_id: number };
const gruppi = (...id: number[]): Gruppo[] => id.map((camera_id) => ({ camera_id }));
const id = (g: Gruppo[]) => g.map((x) => x.camera_id);

/* l'ordine in cui il motore le ha restituite davvero il 21 agosto 2026:
   suite e junior suite davanti, le due che si vendono in mezzo */
const DAL_MOTORE = gruppi(9, 4, 12, 5, 8, 6, 3);

Deno.test('per due persone escono prima la Queen e la Doppia', () => {
  assertEquals(id(ordinaGruppi(DAL_MOTORE, 2)).slice(0, 2), [6, 5]);
});

Deno.test('per una persona escono prima la Singola Parco e la Queen', () => {
  assertEquals(id(ordinaGruppi(DAL_MOTORE, 1)).slice(0, 2), [3, 6]);
});

Deno.test('le accessibili vanno in fondo, comunque sia la ricerca', () => {
  /* anche per un numero di adulti che nessun elenco copre, e anche quando
     il numero non arriva proprio: è la regola che non ha eccezioni */
  for (const adulti of [1, 2, 3, 4, undefined, null, 'due']) {
    const fuori = id(ordinaGruppi(DAL_MOTORE, adulti as number));
    const ultime = fuori.slice(-IN_FONDO.length).sort();
    assertEquals(
      ultime,
      [...IN_FONDO].sort(),
      `con adulti=${adulti} le accessibili non sono in fondo: ${fuori.join(' ')}`,
    );
  }
});

Deno.test('nel riordino non si perde e non si duplica niente', () => {
  /* il danno peggiore: una categoria che sparisce. Chi cercava quella
     camera non la trova e prenota da un'altra parte. */
  for (const adulti of [1, 2, 5]) {
    const fuori = ordinaGruppi(DAL_MOTORE, adulti);
    assertEquals(fuori.length, DAL_MOTORE.length, `con adulti=${adulti} cambia il numero`);
    assertEquals(id(fuori).sort(), id(DAL_MOTORE).sort(), `con adulti=${adulti} cambia l'insieme`);
  }
});

Deno.test('e chi non è in nessun elenco tiene l ordine del motore', () => {
  /* 9, 12 e 3 non sono nominate per due adulti: devono uscire fra loro
     nell'ordine in cui sono arrivate, non riordinate a caso */
  const fuori = id(ordinaGruppi(DAL_MOTORE, 2)).filter((n) => [9, 12, 3].includes(n));
  assertEquals(fuori, [9, 12, 3]);
});

Deno.test('non tocca l array che riceve', () => {
  const prima = id(DAL_MOTORE).join(' ');
  ordinaGruppi(DAL_MOTORE, 2);
  assertEquals(id(DAL_MOTORE).join(' '), prima, 'ordinaGruppi ha riordinato l array del chiamante');
});

Deno.test('un elenco vuoto o assente non fa esplodere la pagina', () => {
  assertEquals(ordinaGruppi([], 2), []);
  assertEquals(ordinaGruppi(undefined as unknown as Gruppo[], 2), []);
});

Deno.test('ogni identificativo nominato esiste nel catalogo', () => {
  /* una categoria rinumerata o tolta lascerebbe qui un numero che non
     corrisponde a niente: la regola smetterebbe di applicarsi in silenzio */
  const nominati = [...IN_FONDO, ...[...PRIMA_PER_PERSONE.values()].flat()];
  const fantasmi = nominati.filter((n) => !Object.hasOwn(CAMERE, n));
  assertEquals(fantasmi, [], 'identificativi che il catalogo non ha');
});

Deno.test('e ogni categoria accessibile del catalogo è fra quelle in fondo', () => {
  /* se un domani nasce una terza camera attrezzata, finirebbe in mezzo
     alle altre e nessuno se ne accorgerebbe */
  const accessibili = Object.values(CAMERE)
    .filter((c) => /accessibil/i.test(c.nome))
    .map((c) => c.id);
  assert(accessibili.length > 0, 'nessuna categoria accessibile: la prova non guarda niente');
  const scoperte = accessibili.filter((n) => !IN_FONDO.includes(n));
  assertEquals(
    scoperte,
    [],
    'categorie accessibili che il riordino non manda in fondo: ' +
      'uscirebbero in mezzo alle altre a chi non le ha chieste',
  );
});

Deno.test('la pagina riordina davvero, e il pulsante sta nella barra', () => {
  /* le prove qui sopra valgono solo se la pagina chiama la funzione: una
     regola giusta in un modulo che nessuno usa non arriva a nessuno */
  const pagina = Deno.readTextFileSync(new URL('index.html', import.meta.url));
  assert(
    pagina.includes('ordinaGruppi(capienti, persone)'),
    'la schermata non chiama piu ordinaGruppi: torna l ordine del motore',
  );
  assert(
    pagina.includes('inOrdine, TUTTE_LE_CAMERE'),
    'l elenco riordinato non arriva piu a daMostrare: le due mostrate ' +
      'tornerebbero a essere le prime due dell ordine del motore',
  );
  assert(
    /\.barraScelta\{[^}]*position:sticky/.test(pagina),
    'la barra non e piu appiccicata al fondo: il pulsante torna in fondo all elenco',
  );
  assert(
    pagina.includes('<div class="barraScelta">'),
    'la barra non c e piu nel markup',
  );
});

/* ============================================================
   QUANTE SE NE MOSTRANO. Aggiunto il 21 agosto 2026.

   Undici categorie una sotto l'altra, ognuna con la sua fotografia e le
   sue tariffe, sono una pagina lunghissima da scorrere prima di capire
   che cosa si sta scegliendo. Se ne mostrano due — quelle giuste per il
   numero di persone, decise dal riordino qui sopra — e le altre stanno
   dietro un pulsante.

   IL CASO CRUDELE che daMostrare deve evitare: l'ospite apre l'elenco,
   sceglie una suite, la schermata si ridisegna e la sua scelta sparisce
   sotto il pulsante. Se la scelta sta fuori dalle prime, si apre.
   ============================================================ */
const conVoci = (...id: number[]) =>
  id.map((camera_id) => ({ camera_id, voci: [{ indice: camera_id * 10 }] }));

Deno.test('chiuso se ne vedono due, e il pulsante dice quante restano', () => {
  const r = daMostrare(conVoci(6, 5, 9, 12, 3, 4, 8), false, null);
  assertEquals(r.visibili.map((g: Gruppo) => g.camera_id), [6, 5]);
  assertEquals(r.restano, 5);
});

Deno.test('aperto si vedono tutte e il pulsante sparisce', () => {
  const tutte = conVoci(6, 5, 9, 12, 3, 4, 8);
  const r = daMostrare(tutte, true, null);
  assertEquals(r.visibili.length, tutte.length);
  assertEquals(r.restano, 0);
});

Deno.test('una scelta fuori dalle prime apre l elenco da sola', () => {
  /* senza questo, chi ha aperto e scelto una suite se la vede sparire al
     ridisegno che segue il clic */
  const r = daMostrare(conVoci(6, 5, 9, 12), false, 90 /* la 9 */);
  assertEquals(r.visibili.map((g: Gruppo) => g.camera_id), [6, 5, 9, 12]);
  assertEquals(r.restano, 0);
});

Deno.test('ma una scelta fra le prime lo lascia chiuso', () => {
  const r = daMostrare(conVoci(6, 5, 9, 12), false, 50 /* la 5 */);
  assertEquals(r.visibili.map((g: Gruppo) => g.camera_id), [6, 5]);
  assertEquals(r.restano, 2);
});

Deno.test('con due o meno categorie non si nasconde niente', () => {
  /* un pulsante che apre su niente e' peggio di nessun pulsante */
  for (const quante of [0, 1, 2]) {
    const r = daMostrare(conVoci(6, 5).slice(0, quante), false, null);
    assertEquals(r.restano, 0, `con ${quante} categorie il pulsante non deve uscire`);
    assertEquals(r.visibili.length, quante);
  }
});

Deno.test('e aperto non si perde nessuna categoria', () => {
  const tutte = conVoci(6, 5, 9, 12, 3, 4, 8);
  const r = daMostrare(tutte, true, null);
  assertEquals(
    r.visibili.map((g: Gruppo) => g.camera_id),
    tutte.map((g) => g.camera_id),
    'aprire l elenco cambia le categorie o il loro ordine',
  );
});

Deno.test('un elenco assente non fa esplodere la pagina', () => {
  const r = daMostrare(undefined as unknown as { camera_id: number }[], false, null);
  assertEquals(r.visibili, []);
  assertEquals(r.restano, 0);
});

Deno.test('la pagina mostra davvero solo le visibili, e sa riaprirle', () => {
  const pagina = Deno.readTextFileSync(new URL('index.html', import.meta.url));
  assert(
    pagina.includes('daMostrare(') && pagina.includes('${visibili.map(g =>'),
    'la schermata non passa piu da daMostrare: tornano fuori tutte e undici',
  );
  assert(
    pagina.includes("$('bAltre').onclick") && pagina.includes('TUTTE_LE_CAMERE = true'),
    'il pulsante non apre piu l elenco: le altre categorie diventano irraggiungibili',
  );
  /* DUE volte, non una: la riga che DICHIARA la variabile la mette gia
     a false, quindi cercare la stringa e basta resta verde anche quando
     l'azzeramento dopo la ricerca sparisce. E' successo: la mutazione e
     sopravvissuta, e la prova era sbagliata, non il codice. */
  const azzeramenti = pagina.split('TUTTE_LE_CAMERE = false').length - 1;
  assert(
    azzeramenti >= 2,
    'c e solo la dichiarazione: una ricerca nuova resterebbe aperta da quella prima',
  );
});

/* ============================================================
   LE TARIFFE DENTRO UNA CAMERA, DALLA PIÙ ECONOMICA.

   Il difetto vero, visto il 21 agosto 2026 sulla Matrimoniale Queen: le
   tre tariffe uscivano 260, 190, 390. Chi guarda tre prezzi in disordine
   deve leggerli tutti e confrontarli a mente, e il «da 190 €» che si
   aspetta non è il primo che vede.
   ============================================================ */
const voci = (...cent: number[]) =>
  cent.map((prezzo_cent, i) => ({ prezzo_cent, indice: i }));

Deno.test('le tariffe escono dalla piu economica', () => {
  const fuori = perPrezzo(voci(26000, 19000, 39000));
  assertEquals(fuori.map((v: { prezzo_cent: number }) => v.prezzo_cent), [19000, 26000, 39000]);
});

Deno.test('e non si perde nessuna tariffa per strada', () => {
  const dentro = voci(26000, 19000, 39000, 19000);
  const fuori = perPrezzo(dentro);
  assertEquals(fuori.length, dentro.length);
  assertEquals(
    fuori.map((v: { indice: number }) => v.indice).sort(),
    [0, 1, 2, 3],
    'una tariffa e sparita o e stata duplicata',
  );
});

Deno.test('a parita di prezzo resta l ordine del motore', () => {
  const fuori = perPrezzo(voci(19000, 19000, 12000));
  assertEquals(fuori.map((v: { indice: number }) => v.indice), [2, 0, 1]);
});

Deno.test('un prezzo assente non manda la tariffa in cima per sbaglio', () => {
  /* un prezzo mancante vale zero e finirebbe prima di tutte, cioe' proprio
     dove l'occhio si posa: meglio che ci finisca in modo prevedibile e non
     che faccia esplodere l'ordinamento */
  const fuori = perPrezzo([
    { prezzo_cent: 19000, indice: 0 },
    { indice: 1 },
    { prezzo_cent: 26000, indice: 2 },
  ]);
  assertEquals(fuori.map((v: { indice: number }) => v.indice), [1, 0, 2]);
});

Deno.test('un elenco assente non fa esplodere la scheda', () => {
  assertEquals(perPrezzo(undefined as unknown as { prezzo_cent: number }[]), []);
  assertEquals(perPrezzo([]), []);
});

Deno.test('la pagina ordina davvero le tariffe, e dice la formula', () => {
  const pagina = Deno.readTextFileSync(new URL('index.html', import.meta.url));
  assert(
    pagina.includes('g.voci = perPrezzo(g.voci)'),
    'le tariffe tornano nell ordine del motore: 260, 190, 390',
  );
  assert(
    pagina.includes('<div class="trattamento">${esc(conFormula('),
    'la riga torna a dire solo «Mezza Pensione», senza dire che cosa comprende',
  );
  assert(
    pagina.includes('esc(t.tassaSoggiorno)'),
    'la tassa di soggiorno sparisce dalla schermata dove si guardano i prezzi',
  );
  assert(
    pagina.includes('dettaglioDelPrezzo(v.prezzo_cent, t)'),
    'sotto il prezzo non si dice piu che e il totale: chi legge «190,00 €» accanto a «2 adulti» non sa se sono 190 in tutto o a testa',
  );
});

Deno.test('la tassa si dice due volte, e sempre dalla stessa voce', () => {
  /* una sulla schermata delle camere, dove i prezzi si confrontano, e una
     sul passo dei dati, che e' l ultimo momento prima di premere invia.
     Tutte e due da `t.tassaSoggiorno`: due testi scritti a mano
     divergerebbero al primo che ne cambia uno — e' successo in questo
     progetto con l anteprima del buono. */
  const pagina = Deno.readTextFileSync(new URL('index.html', import.meta.url));
  const quante = pagina.split('esc(t.tassaSoggiorno)').length - 1;
  assertEquals(
    quante,
    2,
    `la tassa compare ${quante} volte invece di 2 (camere e dati)`,
  );
  /* e la CIFRA sta scritta una volta sola. Non si conta «tassa di
     soggiorno», che compare anche nei commenti del codice: si conta il
     pezzo che, ricopiato, divergerebbe. */
  const cifra = pagina.split('1,50 € al giorno a persona').length - 1;
  assertEquals(
    cifra,
    1,
    'la cifra della tassa e scritta a mano piu di una volta: al primo che ne cambia una divergono',
  );
});

/* ============================================================
   LE CAMERE CHE CI STANNO DAVVERO. Aggiunto il 21 agosto 2026.

   IL DIFETTO, segnalato dalla proprietà provando la pagina vera: con 2
   adulti e 1 bambino uscivano davanti la Matrimoniale Queen e la Doppia,
   che tengono due persone. Con 3 adulti invece usciva giusto.

   Le cause erano DUE, e la seconda è la più grave:

   · il mio elenco guardava i soli ADULTI. Con 3 adulti nessuna regola si
     applicava e comandava l'ordine del motore, che mette già davanti le
     junior suite — «sembrava giusto» per caso, non per merito;

   · IL MOTORE NON FILTRA NIENTE. Interrogato per tre persone restituisce
     tutte e undici le categorie, SINGOLE COMPRESE. Misurato, non dedotto.
     Quindi chi apriva «vedi anche le altre» trovava una Singola offerta a
     tre persone.

   Un bambino occupa un posto come chiunque altro: la Knowledge Base dice
   «adulto + bambino nello stesso letto senza letto aggiunto: il bambino
   paga come adulto, a qualsiasi età», e la culla resta una preferenza da
   registrare, non un posto in meno.
   ============================================================ */
Deno.test('una camera che non tiene tutte le persone non si mostra', () => {
  const g = [
    { camera_id: 6, max_adulti: 2 },
    { camera_id: 12, max_adulti: 3 },
    { camera_id: 11, max_adulti: 4 },
    { camera_id: 3, max_adulti: 1 },
  ];
  assertEquals(adatte(g, 3).map((x: { camera_id: number }) => x.camera_id), [12, 11]);
  assertEquals(adatte(g, 1).map((x: { camera_id: number }) => x.camera_id), [6, 12, 11, 3]);
  assertEquals(adatte(g, 4).map((x: { camera_id: number }) => x.camera_id), [11]);
});

Deno.test('e la tripla non si esclude mai', () => {
  /* la Knowledge Base e' esplicita: «Triple — la soluzione e' la Junior
     Suite Abano. Mai escludere la tripla.» */
  const g = [{ camera_id: 12, max_adulti: 3 }];
  assertEquals(adatte(g, 3).length, 1, 'la tripla e stata esclusa');
});

Deno.test('una capienza che non si conosce non esclude nessuno', () => {
  /* nascondere una sistemazione per un dato mancante e' peggio che
     mostrarne una grande a chi e' solo */
  const g = [{ camera_id: 6 }, { camera_id: 5, max_adulti: 0 }, { camera_id: 9, max_adulti: null }];
  assertEquals(adatte(g, 4).length, 3);
});

Deno.test('e un numero di persone assurdo non nasconde tutto', () => {
  const g = [{ camera_id: 6, max_adulti: 2 }];
  for (const n of [0, -1, 1.5, NaN, undefined, null, 'due']) {
    assertEquals(adatte(g, n as number).length, 1, `persone=${n}`);
  }
});

Deno.test('l ordine guarda le PERSONE, non i soli adulti', () => {
  /* il difetto segnalato: due adulti e un bambino sono TRE persone, e per
     tre persone la Queen non va davanti — non va proprio */
  const g = [
    { camera_id: 12, max_adulti: 3 },
    { camera_id: 6, max_adulti: 2 },
    { camera_id: 5, max_adulti: 2 },
  ];
  const perDue = ordinaGruppi(adatte(g, 2), 2).map((x: { camera_id: number }) => x.camera_id);
  assertEquals(perDue.slice(0, 2), [6, 5], 'per due persone davanti Queen e Doppia');
  const perTre = ordinaGruppi(adatte(g, 3), 3).map((x: { camera_id: number }) => x.camera_id);
  assertEquals(perTre, [12], 'per tre persone resta solo la Junior Suite');
});

Deno.test('la pagina conta le persone e filtra, in quest ordine', () => {
  const pagina = Deno.readTextFileSync(new URL('index.html', import.meta.url));
  assert(
    pagina.includes('(Number(RICERCA && RICERCA.bambini) || 0)'),
    'la pagina torna a contare i soli adulti: la Queen riapparirebbe a chi viaggia con un figlio',
  );
  const filtro = pagina.indexOf('adatte(gruppi, persone)');
  const ordine = pagina.indexOf('ordinaGruppi(capienti, persone)');
  assert(filtro > 0 && ordine > filtro, 'si ordina prima di filtrare, o non si filtra affatto');
  assert(
    pagina.includes('t.troppePerUnaCamera(persone)'),
    'senza nessuna camera capiente la pagina non dice niente',
  );
});

/* ============================================================
   E LA VIA DELLE CAMERE SEPARATE, ma solo fra adulti.

   Correzione del 21 agosto 2026, dalla proprietà: tre adulti possono
   benissimo volere tre singole — amici, colleghi — e nascondergliele e
   basta è troppo rigido. Tre persone di cui un bambino no: il bambino
   dorme coi genitori, sul letto aggiunto o sul divano letto della junior
   suite, e mandarlo in una camera sua non è una soluzione, è un
   equivoco.

   Quindi il filtro resta sempre — una camera che non li tiene tutti non
   si mostra — ma la via d'uscita si offre SOLO quando sono tutti adulti.
   ============================================================ */
Deno.test('la via delle camere separate si offre fra adulti, non con un bambino', () => {
  const pagina = Deno.readTextFileSync(new URL('index.html', import.meta.url));
  assert(
    pagina.includes('const separabili = !bambiniCercati && persone >= 2 &&'),
    'la proposta delle camere separate non guarda piu i bambini: la offrirebbe a una famiglia',
  );
  assert(
    pagina.includes('capienti.length < gruppi.length'),
    'la proposta esce anche quando non e stato tolto niente: non avrebbe senso',
  );
  /* la CONDIZIONE, col dollaro-graffa: la sola chiamata resta nel ramo
     morto anche spegnendo tutto. E' la quarta volta che questa forma
     lascia passare una mutazione, in una giornata sola. */
  assert(
    pagina.includes('${separabili'),
    'la proposta delle camere separate non si disegna piu',
  );
  assert(
    pagina.includes('t.separate(persone)'),
    'sparito il testo della proposta',
  );
  /* riparte da UNA persona, con le stesse date */
  assert(
    pagina.includes('&adulti=1&l=$'),
    'la ricerca separata non riparte da una persona sola',
  );
});
