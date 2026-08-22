/* ============================================================
   carrello.test.ts — più camere, UN modulo, UN totale, UN invio.

   IL DIFETTO, segnalato dalla proprietà provando la pagina vera: «con
   più camere attualmente mi dice scegli una camera per volta, ma non li
   mette nello stesso carrello totale, è come se fossero tante
   prenotazioni singole: ogni volta devo compilare i dati e pagare la
   singola camera».

   Era vero. Chi ne voleva tre compilava i contatti tre volte, riceveva
   tre ricevute con tre totali, e alla quarta camera sbatteva contro il
   freno del server (tre richieste per mezz'ora): la sua quota se l'era
   bruciata da solo.

   COME CI SI ROMPE ADESSO, e nessuno di questi modi si vede provando con
   una camera sola:

   · il totale conta solo le camere messe da parte e dimentica quella che
     si sta scegliendo — o viceversa: il numero è sbagliato proprio
     mentre l'ospite decide;
   · l'invio riparte da RICERCA e SCELTA, cioè dall'ULTIMA camera, e le
     altre spariscono senza che nessuno se ne accorga;
   · le camere in più si compongono a mano invece che con la stessa
     funzione della prima, e al primo campo aggiunto divergono;
   · la pagina lascia aggiungere più camere di quante il server ne
     accetta: si compila tutto per essere rifiutati alla fine;
   · il carrello resta pieno dopo l'invio, e la richiesta dopo si porta
     dentro le camere di quella prima.
   ============================================================ */
import { assert, assertEquals, assertStringIncludes } from 'jsr:@std/assert';
import { componiCorpo, corpoCamera, euroDaCentesimi } from './logica.js';
import { nomeTariffa } from './nomi.js';
import { altreCamere, CAMERE_MAX } from '../../supabase/functions/richieste/piu-camere.ts';

const PAGINA = Deno.readTextFileSync(new URL('index.html', import.meta.url))
  .split('\r\n').join('\n');

/* ------------------------------------------------------------
   si esegue il codice VERO della pagina, non una copia: se qualcuno
   riscrive il conto del carrello in modo sbagliato, qui si vede.
   ------------------------------------------------------------ */
function prendi(nome: string): string {
  const re = new RegExp('function ' + nome + '\\([^)]*\\) \\{[\\s\\S]*?\\n\\}');
  const m = PAGINA.match(re);
  if (!m) {
    throw new Error(
      `funzione \`${nome}\` non trovata in pagine/prenota/index.html: ` +
        'se e stata rinominata o spostata questa prova va aggiornata, non cancellata',
    );
  }
  return m[0];
}

type Camera = {
  ricerca: { arrivo: string; partenza: string; adulti: number; bambini: number };
  scelta: Record<string, unknown>;
  caparraCent: number;
  culla?: boolean;
};
type Banco = {
  tutteLeCamere: () => Camera[];
  totaleCent: (c: Camera[]) => number;
  carrelloHTML: (t: Record<string, unknown>) => string;
  riepilogoCamereHTML: (t: Record<string, unknown>, c: Camera[]) => string;
  quantaCameraHTML: (t: Record<string, unknown>) => string;
  caparraTotaleCent: () => number;
  quante: (n: number) => void;
  metti: (carrello: Camera[], scelta: unknown, ricerca: unknown, caparra: number) => void;
};

const fabbrica = new Function(
  'aiuti',
  `
  const { esc, nomeTariffa, euroDaCentesimi } = aiuti;
  const LNG = 'it';
  let CARRELLO = [], SCELTA = null, RICERCA = {}, CAPARRA_CENT = 0, CAMERE_TOTALI = 0;
  /* la culla della camera in mano: qui non si prova, ha il suo file —
     ma tutteLeCamere() la nomina, e senza il banco non partirebbe */
  let CULLA = false;
  ${prendi('tutteLeCamere')}
  ${prendi('totaleCent')}
  ${prendi('carrelloHTML')}
  ${prendi('riepilogoCamereHTML')}
  ${prendi('quantaCameraHTML')}
  ${prendi('caparraTotaleCent')}
  return {
    tutteLeCamere, totaleCent, carrelloHTML, riepilogoCamereHTML, quantaCameraHTML,
    caparraTotaleCent,
    quante: (n) => { CAMERE_TOTALI = n; },
    metti: (c, s, r, cap) => { CARRELLO = c; SCELTA = s; RICERCA = r; CAPARRA_CENT = cap; },
  };
`,
);

const esc = (s: unknown) =>
  String(s ?? '').replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string),
  );

const banco = fabbrica({ esc, nomeTariffa, euroDaCentesimi }) as Banco;

const T = {
  carrelloTit: (n: number) => (n === 1 ? 'Camera già scelta' : `Camere già scelte (${n})`),
  carrelloTot: 'Totale',
  togliCamera: 'Togli questa camera',
  cullaBreve: 'con culla',
  cameraNdi: (n: number, tot: number) => `Sta scegliendo la camera ${n} di ${tot}.`,
  riepilogo: (a: string, p: string, ad: number, b: number) => `Dal ${a} al ${p} · ${ad}+${b}`,
  riepilogoCamera: (n: string, tf: string, pr: string) => `${n} — ${tf} — ${pr} €`,
};

/* la prenotazione #18968, quella vera: due camere, periodi diversi */
const DICIOTTO_NOTTI: Camera = {
  ricerca: { arrivo: '2026-09-02', partenza: '2026-09-20', adulti: 1, bambini: 0 },
  scelta: {
    nome: 'Matrimoniale Queen', tariffa: 'Dolce Vita 10 cure', trattamento: 'Mezza Pensione',
    camera_id: 6, variante_id: 61, prezzo_cent: 319100,
  },
  caparraCent: 30000,
};
const DUE_NOTTI: Camera = {
  ricerca: { arrivo: '2026-09-02', partenza: '2026-09-04', adulti: 2, bambini: 0 },
  scelta: {
    nome: 'Doppia', tariffa: 'Soggiorno breve', trattamento: 'Mezza Pensione',
    camera_id: 5, variante_id: 52, prezzo_cent: 29000,
  },
  caparraCent: 0,
};

/* ============ il conto ============ */

Deno.test('il totale conta le camere messe da parte E quella in mano', () => {
  /* il modo piu' facile di sbagliare: sommare solo il carrello mentre
     l'ospite guarda la terza camera, e mostrargli un totale che non e'
     il suo */
  banco.metti([DICIOTTO_NOTTI], DUE_NOTTI.scelta, DUE_NOTTI.ricerca, 0);
  const tutte = banco.tutteLeCamere();
  assertEquals(tutte.length, 2);
  assertEquals(banco.totaleCent(tutte), 319100 + 29000);
});

Deno.test('senza una camera in mano il conto e solo del carrello', () => {
  banco.metti([DICIOTTO_NOTTI, DUE_NOTTI], null, {}, 0);
  assertEquals(banco.totaleCent(banco.tutteLeCamere()), 348100);
});

Deno.test('ogni camera si porta dietro le SUE date, non le ultime', () => {
  /* e' tutto il punto: 18 notti una e 2 notti l'altra. Se la ricerca si
     condividesse, la seconda camera cambierebbe le date della prima. */
  banco.metti([DICIOTTO_NOTTI], DUE_NOTTI.scelta, DUE_NOTTI.ricerca, 0);
  const [a, b] = banco.tutteLeCamere();
  assertEquals(a.ricerca.partenza, '2026-09-20');
  assertEquals(b.ricerca.partenza, '2026-09-04');
});

Deno.test('la camera in mano e una COPIA della ricerca, non un riferimento', () => {
  /* senza copia, cambiare le date per la camera successiva riscriverebbe
     anche quelle della camera gia' scelta */
  const ricerca = { ...DUE_NOTTI.ricerca };
  banco.metti([], DUE_NOTTI.scelta, ricerca, 0);
  const prima = banco.tutteLeCamere()[0];
  ricerca.partenza = '2026-12-31';
  assertEquals(prima.ricerca.partenza, '2026-09-04');
});

/* ============ quello che si vede ============ */

Deno.test('il carrello vuoto non disegna niente', () => {
  banco.metti([], null, {}, 0);
  assertEquals(banco.carrelloHTML(T), '');
});

Deno.test('il carrello mostra nome, date, tariffa, prezzo e il totale', () => {
  banco.metti([DICIOTTO_NOTTI, DUE_NOTTI], null, {}, 0);
  const html = banco.carrelloHTML(T);
  assertStringIncludes(html, 'Matrimoniale Queen');
  assertStringIncludes(html, '2026-09-20');
  assertStringIncludes(html, 'Doppia');
  assertStringIncludes(html, '2026-09-04');
  assertStringIncludes(html, euroDaCentesimi(319100));
  assertStringIncludes(html, 'Totale');
  assertStringIncludes(html, euroDaCentesimi(348100));
});

Deno.test('e da un modo di togliere OGNI camera, non solo l ultima', () => {
  banco.metti([DICIOTTO_NOTTI, DUE_NOTTI], null, {}, 0);
  const html = banco.carrelloHTML(T);
  assertStringIncludes(html, 'data-togli="0"');
  assertStringIncludes(html, 'data-togli="1"');
});

Deno.test('quello che scrive l ospite non diventa HTML', () => {
  /* il nome della camera arriva dal motore del sito vecchio: non e'
     scritto dall'ospite, ma passa comunque da esc() come tutto il resto */
  banco.metti(
    [{ ...DUE_NOTTI, scelta: { ...DUE_NOTTI.scelta, nome: '<img src=x onerror=1>' } }],
    null, {}, 0,
  );
  const html = banco.carrelloHTML(T);
  assert(!html.includes('<img'), 'il nome della camera e finito nel markup non filtrato');
  assertStringIncludes(html, '&lt;img');
});

Deno.test('con una camera sola il riepilogo dei dati resta la riga di sempre', () => {
  /* chi ne prenota una non deve trovarsi davanti una tabella: la pagina
     con una camera deve restare quella che era */
  const html = banco.riepilogoCamereHTML(T, [DUE_NOTTI]);
  assertStringIncludes(html, 'Doppia');
  assert(!html.includes('carrelloTot'), 'con una camera sola compare il totale del carrello');
});

Deno.test('con piu camere diventa un conto, col totale in fondo', () => {
  const html = banco.riepilogoCamereHTML(T, [DICIOTTO_NOTTI, DUE_NOTTI]);
  assertStringIncludes(html, 'Matrimoniale Queen');
  assertStringIncludes(html, 'Doppia');
  assertStringIncludes(html, 'carrelloTot');
  assertStringIncludes(html, euroDaCentesimi(348100));
});

Deno.test('e nel riepilogo dei dati non si tolgono camere', () => {
  /* li' si sta compilando: un pulsantino «×» in mezzo ai contatti
     toglierebbe una camera per sbaglio a chi tocca lo schermo */
  const html = banco.riepilogoCamereHTML(T, [DICIOTTO_NOTTI, DUE_NOTTI]);
  assert(!html.includes('data-togli'), 'si possono togliere camere dal passo dei dati');
});

Deno.test('la culla chiesta su una camera si rilegge dove si paga', () => {
  /* spuntata sul passo delle camere e mai piu' vista: chi arriva al
     modulo non ha modo di accorgersi di averla chiesta, ne' di non
     averla chiesta. Va riletta in tutti e due i posti dove le camere si
     ricontano — il carrello e il riepilogo del modulo. */
  const conCulla = { ...DICIOTTO_NOTTI, culla: true } as Camera;
  banco.metti([conCulla, DUE_NOTTI], null, {}, 0);

  const carrello = banco.carrelloHTML(T);
  assertStringIncludes(carrello, 'con culla');
  assertEquals(carrello.split('con culla').length - 1, 1,
    'la culla si legge anche sulla camera che non la ha');

  const riepilogo = banco.riepilogoCamereHTML(T, [conCulla, DUE_NOTTI]);
  assertStringIncludes(riepilogo, 'con culla');
  assertEquals(riepilogo.split('con culla').length - 1, 1);
});

Deno.test('e con una camera sola si rilegge lo stesso', () => {
  /* il riepilogo del modulo cambia forma con una camera sola: e' la
     riga di sempre, e la culla deve entrarci comunque */
  const sola = { ...DUE_NOTTI, culla: true } as Camera;
  assertStringIncludes(banco.riepilogoCamereHTML(T, [sola]), 'con culla');
  assertEquals(
    banco.riepilogoCamereHTML(T, [DUE_NOTTI]).includes('con culla'),
    false,
    'la culla si legge anche su chi non l ha chiesta',
  );
});

/* ============ il patto con il server ============ */

Deno.test('il tetto della pagina e quello del server sono lo stesso numero', () => {
  /* la pagina non puo' importare dalla funzione (si pubblicano separate):
     la copia e' voluta, e questa prova e' il presidio. Se divergono,
     l'ospite compila tutto per sentirsi rifiutare alla fine. */
  const m = PAGINA.match(/const CAMERE_MAX_PAGINA = (\d+);/);
  assert(m, 'CAMERE_MAX_PAGINA sparita dalla pagina');
  assertEquals(Number(m![1]), CAMERE_MAX);
});

Deno.test('il corpo che costruisce la pagina lo accetta il server', () => {
  /* le due meta' del carrello parlano davvero fra loro: si compone come
     fa la pagina e si passa alla funzione vera */
  const camere = [DICIOTTO_NOTTI, DUE_NOTTI];
  const prima = camere[0];
  const corpo: Record<string, unknown> = componiCorpo({
    scelta: prima.scelta, nome: 'Mario Rossi', email: 'mario@example.com',
    telefono: '3331234567',
    checkIn: prima.ricerca.arrivo, checkOut: prima.ricerca.partenza,
    adulti: prima.ricerca.adulti, bambini: prima.ricerca.bambini,
    caparraCent: prima.caparraCent, note: '', lingua: 'it',
  });
  corpo.altre = camere.slice(1).map((c) =>
    corpoCamera({
      scelta: c.scelta, checkIn: c.ricerca.arrivo, checkOut: c.ricerca.partenza,
      adulti: c.ricerca.adulti, bambini: c.ricerca.bambini, caparraCent: c.caparraCent,
    })
  );

  const esito = altreCamere(corpo);
  assertEquals(esito.errore, undefined);
  assertEquals(esito.camere?.length, 1);
  const seconda = esito.camere![0].colonne as Record<string, unknown>;
  assertEquals(seconda.check_in, '2026-09-02');
  assertEquals(seconda.check_out, '2026-09-04');
  assertEquals(seconda.tipo_camera, 'Doppia');
  /* i contatti restano quelli della PERSONA, una volta sola */
  assertEquals(seconda.email, 'mario@example.com');
});

Deno.test('e cinque camere passano, sei no', () => {
  const una = corpoCamera({
    scelta: DUE_NOTTI.scelta, checkIn: '2026-09-02', checkOut: '2026-09-04',
    adulti: 2, bambini: 0, caparraCent: 0,
  });
  const conQuante = (n: number) => {
    const corpo: Record<string, unknown> = componiCorpo({
      scelta: DUE_NOTTI.scelta, nome: 'Mario Rossi', email: 'mario@example.com',
      telefono: '3331234567', checkIn: '2026-09-02', checkOut: '2026-09-04',
      adulti: 2, bambini: 0, caparraCent: 0, note: '', lingua: 'it',
    });
    corpo.altre = Array.from({ length: n - 1 }, () => ({ ...una }));
    return altreCamere(corpo);
  };
  assertEquals(conQuante(CAMERE_MAX).errore, undefined);
  assert(conQuante(CAMERE_MAX + 1).errore, 'sei camere sono passate');
});

/* ============ la pagina, com'e' scritta ============ */

Deno.test('l invio parte dal carrello, non dall ultima camera scelta', () => {
  /* il difetto sarebbe invisibile: si manda una richiesta buona, e le
     altre camere restano nel browser */
  assertStringIncludes(PAGINA, 'const camere = tutteLeCamere();');
  assertStringIncludes(PAGINA, 'const prima = camere[0];');
  assertStringIncludes(PAGINA, 'scelta: prima.scelta, nome, email, telefono,');
  assertStringIncludes(PAGINA, 'checkIn: prima.ricerca.arrivo, checkOut: prima.ricerca.partenza,');
});

Deno.test('e le camere in piu passano dalla STESSA funzione della prima', () => {
  /* due modi di comporre una camera divergono al primo campo aggiunto:
     e' gia' successo in questo progetto con l'anteprima del buono */
  const dove = PAGINA.indexOf('corpo.altre = camere.slice(1).map(');
  assert(dove > 0, 'le camere in piu non si compongono piu con corpoCamera');
  assertStringIncludes(PAGINA.slice(dove, dove + 200), 'corpoCamera({');
});

Deno.test('il carrello si svuota dopo l invio riuscito', () => {
  /* altrimenti la richiesta dopo si porta dentro le camere di questa */
  /* si guarda DENTRO la funzione di invio: cercare «CARRELLO = [];»
     nell'intera pagina trova la DICHIARAZIONE (`let CARRELLO = [];`),
     e la prova resta verde anche togliendo la riga che conta — la stessa
     trappola gia' vista quattro volte in questo progetto. */
  const da = PAGINA.indexOf('async function inviaRichiesta()');
  assert(da > 0, 'la funzione di invio e sparita');
  const invio = PAGINA.slice(da, PAGINA.indexOf('function schermaFatta(', da));
  assert(invio.length > 0, 'non riesco a isolare la funzione di invio');
  const svuota = invio.indexOf('CARRELLO = [];');
  const fine = invio.indexOf("STATO = 'fatta';");
  assert(svuota >= 0, 'il carrello non si svuota dopo l invio: la richiesta dopo ' +
    'si porta dentro le camere di questa');
  assert(fine >= 0, 'la schermata finale non arriva piu');
  assert(svuota < fine, 'il carrello si svuota dopo il cambio di schermata');
});

Deno.test('il pulsante «un altra camera» sparisce quando il tetto e pieno', () => {
  assertStringIncludes(PAGINA, 'tutteLeCamere().length < CAMERE_MAX_PAGINA');
});

Deno.test('e non compare senza una camera scelta', () => {
  /* «aggiungi un'altra camera» senza averne scelta una non vuol dire
     niente, e porterebbe a un carrello vuoto con l'aria di essere pieno */
  const dove = PAGINA.indexOf('id="bAltraCamera"');
  assert(dove > 0, 'il pulsante e sparito');
  assertStringIncludes(PAGINA.slice(dove - 200, dove), 'SCELTA &&');
});

Deno.test('la chiusura mostra TUTTI i numeri, non solo il primo', () => {
  /* con un numero solo in mano l'ospite non potrebbe nominare le altre
     camere al telefono */
  assertStringIncludes(PAGINA, 'NUMERI_FATTA.length > 1');
  assertStringIncludes(PAGINA, 'Array.isArray(d.numeri) ? d.numeri');
});

Deno.test('e dice se ne sono state registrate meno di quante ne aveva chieste', () => {
  /* un «grazie» liscio manderebbe via l'ospite convinto di avere tre
     camere quando ne ha due */
  assertStringIncludes(PAGINA, 'CAMERE_CHIESTE > NUMERI_FATTA.length');
  assertStringIncludes(PAGINA, 't.camereMancanti(NUMERI_FATTA.length, CAMERE_CHIESTE)');
});

Deno.test('le parole del carrello ci sono in tutte e quattro le lingue', () => {
  for (const chiave of ['carrelloTit', 'carrelloTot', 'togliCamera', 'aggiungiCamera', 'rifPiu', 'camereMancanti']) {
    const quante = PAGINA.split(chiave + ':').length - 1;
    assertEquals(quante, 4, `«${chiave}» non c'e' in tutte e quattro le lingue: ${quante}`);
  }
});

/* ============ a che punto siamo ============ */

Deno.test('chi ha chiesto tre camere legge a quale sta scegliendo', () => {
  /* richiesto dalla proprieta' parola per parola: «fammi capire da
     qualche parte che sto selezionando la prima camera di 3». Prima si
     vedeva solo arrivando da un indirizzo con `insieme=`, cioe' dalla
     vecchia strada a richieste separate. */
  banco.quante(3);
  banco.metti([], null, {}, 0);
  assertStringIncludes(banco.quantaCameraHTML(T), 'camera 1 di 3');
  banco.metti([DICIOTTO_NOTTI], null, {}, 0);
  assertStringIncludes(banco.quantaCameraHTML(T), 'camera 2 di 3');
});

Deno.test('chi ne ha chiesta una non legge niente', () => {
  /* «camera 1 di 1» sarebbe rumore su ogni prenotazione normale */
  banco.metti([], null, {}, 0);
  for (const n of [0, 1]) {
    banco.quante(n);
    assertEquals(banco.quantaCameraHTML(T), '', `con ${n} camere il cartello compare`);
  }
});

Deno.test('e chi va oltre quante ne aveva dette nemmeno', () => {
  /* il carrello e' il conto vero: «camera 4 di 3» sarebbe solo sbagliato */
  banco.quante(2);
  banco.metti([DICIOTTO_NOTTI, DUE_NOTTI], null, {}, 0);
  assertEquals(banco.quantaCameraHTML(T), '');
});

Deno.test('il testo «camera n di tot» c e in tutte e quattro le lingue', () => {
  assertEquals(PAGINA.split('cameraNdi:').length - 1, 4);
});

Deno.test('i due cartelli si disegnano su ENTRAMBE le schermate dove si sceglie', () => {
  /* una funzione che nessuno chiama e' codice morto travestito da
     funzionalita': il carrello e il «camera n di tot» servono sia sul
     passo delle date (dove si torna per la camera dopo) sia su quello
     delle camere (dove si sceglie). Le prove che li eseguono restavano
     verdi anche togliendoli dalla pagina. */
  const passi: [string, string][] = [
    ['passo delle date', '' + '{esc(t.sotto)}</div>'],
    ['passo delle camere', 'id="bIndietroDate">'],
  ];
  for (const [come, ancora] of passi) {
    const dove = PAGINA.indexOf(ancora);
    assert(dove > 0, `ancora del ${come} sparita: la prova va aggiornata`);
    const dopo = PAGINA.slice(dove, dove + 220);
    for (const chiamata of ['quantaCameraHTML(t)', 'carrelloHTML(t)']) {
      assertStringIncludes(dopo, chiamata, `« ${chiamata}» non si disegna sul ${come}`);
    }
  }
});

Deno.test('l invito alla cena dice PER QUALE camera vale, quando sono piu di una', () => {
  /* l'invito cambia la tariffa di UNA camera sola: sopra c'e' il totale
     di tre stanze, e un «+140 €» senza nome si legge come riferito a
     tutte — l'ospite scopre il vero conto in reception. */
  const dove = PAGINA.indexOf('id="bAggiungiCena"');
  assert(dove > 0, 'sparito l invito alla cena');
  const blocco = PAGINA.slice(dove, dove + 700);
  assertStringIncludes(blocco, 'tutte.length > 1');
  assertStringIncludes(blocco, 't.perLaCamera(SCELTA.nome)');
  assertEquals(PAGINA.split('perLaCamera:').length - 1, 4);
});

/* ============ la caparra, e i vicoli ciechi ============ */

Deno.test('la caparra e quella di TUTTE le camere', () => {
  /* la caparra si chiede per ogni camera: scriverne una sola sotto un
     totale che ne conta tre e' un numero che l'ospite scopre falso in
     reception */
  banco.metti([{ ...DICIOTTO_NOTTI, caparraCent: 30000 }], DUE_NOTTI.scelta, DUE_NOTTI.ricerca, 12000);
  assertEquals(banco.caparraTotaleCent(), 42000);
});

Deno.test('e una camera senza caparra non ne inventa una', () => {
  banco.metti([{ ...DUE_NOTTI, caparraCent: 0 }], null, {}, 0);
  assertEquals(banco.caparraTotaleCent(), 0);
});

Deno.test('il modulo e il buono guardano la stessa caparra', () => {
  /* due cifre diverse sulla stessa schermata — quella scritta e quella
     che il buono dice di coprire — sono peggio di nessuna cifra */
  assertStringIncludes(PAGINA, 't.caparraRiga(euroDaCentesimi(caparraTotaleCent()))');
  assertStringIncludes(PAGINA, 'const caparra = caparraTotaleCent();');
  assertStringIncludes(PAGINA, 'caparraDopoBuono(caparra, BUONO.valore_cent)');
});

Deno.test('con una camera nel carrello si va avanti anche senza sceglierne un altra', () => {
  /* IL VICOLO CIECO: chi mette una camera da parte e poi cambia idea
     sulla seconda aveva «Continua» spento e nessuna strada avanti — una
     camera in mano e nessun modo di mandarla. */
  assertStringIncludes(PAGINA, "id=\"bContinua\"${tutteLeCamere().length ? '' : ' disabled'}");
  assertStringIncludes(PAGINA, 'if (!tutteLeCamere().length) {');
});

Deno.test('e dal passo delle date c e una strada avanti', () => {
  /* l'altra meta' dello stesso vicolo: si torna alle date per la camera
     dopo, si cambia idea, e da li' non si andava da nessuna parte */
  assertStringIncludes(PAGINA, 'id="bAvantiCarrello"');
  assertStringIncludes(PAGINA, 't.avantiCarrello(CARRELLO.length)');
  const dove = PAGINA.indexOf('id="bAvantiCarrello"');
  assertStringIncludes(PAGINA.slice(dove - 200, dove), 'CARRELLO.length');
  assertStringIncludes(PAGINA, "$('bAvantiCarrello').onclick = () => { STATO = 'dati'; disegna(); };");
  assertEquals(PAGINA.split('avantiCarrello:').length - 1, 4);
});
