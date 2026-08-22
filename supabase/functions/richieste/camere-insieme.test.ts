/* ============================================================
   camere-insieme.test.ts — il filo fra le camere di una richiesta,
   visto da tutte e due i versi.

   IL DIFETTO, deciso dalla proprietà dopo averlo letto: «rendilo
   visibile da tutte e due». Il carrello salva una riga per camera: la
   prima è la capofila, quelle in più portano il suo numero in
   `dati.insieme`. Aprendo la camera 2 si risaliva alla 1; aprendo la 1
   non c'era scritto niente. Chi lavora dalla lista del back office
   invece che dall'email non poteva sapere che quell'ospite ne aveva
   prenotate tre — e tre camere dello stesso ospite vanno assegnate
   vicine.

   SI DERIVA, NON SI COPIA. Scrivere sulla capofila l'elenco delle figlie
   sarebbe un secondo dato che dice la stessa cosa, e due dati che dicono
   la stessa cosa prima o poi si contraddicono — per esempio quando una
   camera viene cancellata a mano.

   TRE MODI DI ROMPERSI, e nessuno si vede su una richiesta di una camera
   sola:

   · il gruppo si conta sulle righe già caricate, e con un filtro per
     stato una camera già vista resta fuori: la capofila dice «2 camere»
     quando sono tre, che è peggio di non dire niente;
   · la capofila non entra nel suo stesso gruppo, e il filo torna a
     vedersi da una parte sola;
   · «1 camera» compare su ogni richiesta normale, cioè su tutta la
     lista.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';
import { arricchisciElenco, chiaveGruppo, collegaCamere } from './elenco.ts';

const CAPOFILA = {
  numero: 'C26/19130', tipo: 'soggiorno', stato: 'nuova',
  nome: 'Mario Rossi', check_in: '2026-09-02', check_out: '2026-09-20',
  dati: { tariffa: 'Dolce Vita 10 cure', prezzo_cent: 319100 },
};
const SECONDA = {
  numero: 'C26/19131', tipo: 'soggiorno', stato: 'vista',
  nome: 'Mario Rossi', check_in: '2026-09-02', check_out: '2026-09-04',
  dati: { tariffa: 'Soggiorno breve', prezzo_cent: 29000, insieme: 'C26/19130' },
};
const TERZA = {
  numero: 'C26/19132', tipo: 'soggiorno', stato: 'nuova',
  nome: 'Mario Rossi', check_in: '2026-09-10', check_out: '2026-09-12',
  dati: { tariffa: 'Miglior Prezzo', prezzo_cent: 45000, insieme: 'C26/19130' },
};
const ESTRANEA = {
  numero: 'C26/19140', tipo: 'soggiorno', stato: 'nuova',
  nome: 'Anna Bianchi', dati: { tariffa: 'Miglior Prezzo' },
};

const figlie = (...r: { numero: string; dati: Record<string, unknown> }[]) =>
  r.map(({ numero, dati }) => ({ numero, dati }));

/* ============ la chiave del gruppo ============ */

Deno.test('la capofila e la chiave di se stessa', () => {
  assertEquals(chiaveGruppo(CAPOFILA), 'C26/19130');
});

Deno.test('e una camera in piu porta la chiave della capofila', () => {
  assertEquals(chiaveGruppo(SECONDA), 'C26/19130');
  assertEquals(chiaveGruppo(TERZA), 'C26/19130');
});

Deno.test('e una riga senza niente non inventa un gruppo', () => {
  assertEquals(chiaveGruppo({ dati: null } as never), '');
  assertEquals(chiaveGruppo({ numero: '  ', dati: { insieme: '  ' } } as never), '');
});

/* ============ il collegamento ============ */

Deno.test('la capofila legge tutte le sue camere, se stessa compresa', () => {
  /* e' il difetto corretto: prima da qui non si vedeva niente */
  const [r] = collegaCamere(arricchisciElenco([CAPOFILA]), figlie(SECONDA, TERZA));
  assertEquals(r.camere_insieme, ['C26/19130', 'C26/19131', 'C26/19132']);
});

Deno.test('e ogni camera in piu legge lo stesso gruppo', () => {
  /* lo stesso elenco da qualunque riga si parta: due elenchi diversi per
     lo stesso gruppo sarebbero due verita' */
  const righe = collegaCamere(arricchisciElenco([SECONDA, TERZA]), figlie(SECONDA, TERZA));
  for (const r of righe) {
    assertEquals(r.camere_insieme, ['C26/19130', 'C26/19131', 'C26/19132']);
  }
});

Deno.test('la capofila e sempre la PRIMA dell elenco', () => {
  /* e' quella che porta il riferimento, i contatti e le note: aprire per
     prima una camera in piu' vorrebbe dire leggere meta' richiesta */
  const [r] = collegaCamere(arricchisciElenco([CAPOFILA]), figlie(TERZA, SECONDA));
  assertEquals(r.camere_insieme?.[0], 'C26/19130');
});

Deno.test('una richiesta di una camera sola non porta nessun gruppo', () => {
  /* «1 camera» su ogni richiesta normale sarebbe rumore su tutta la lista */
  const righe = collegaCamere(arricchisciElenco([CAPOFILA, ESTRANEA]), []);
  for (const r of righe) {
    assertEquals('camere_insieme' in r, false, `${r.numero} porta un gruppo che non ha`);
  }
});

Deno.test('e un gruppo non contagia le richieste di altri ospiti', () => {
  const righe = collegaCamere(arricchisciElenco([CAPOFILA, ESTRANEA]), figlie(SECONDA));
  const estranea = righe.find((r) => r.numero === 'C26/19140');
  assertEquals('camere_insieme' in estranea!, false, 'il gruppo e finito su un altra richiesta');
});

Deno.test('una figlia contata due volte non diventa due camere', () => {
  /* la query puo' restituirla ripetuta: «4 camere» quando sono tre e' un
     numero sbagliato scritto in grande */
  const [r] = collegaCamere(arricchisciElenco([CAPOFILA]), figlie(SECONDA, SECONDA, TERZA));
  assertEquals(r.camere_insieme?.length, 3);
});

Deno.test('e righe storte non fanno esplodere l elenco', () => {
  /* `dati` e' un jsonb: arriva da un database e puo' essere qualunque cosa */
  const rotte = [
    { numero: 'C26/1', dati: null },
    { numero: '', dati: { insieme: 'C26/19130' } },
    { dati: { insieme: 'C26/19130' } },
  ] as never[];
  const [r] = collegaCamere(arricchisciElenco([CAPOFILA]), rotte);
  assertEquals('camere_insieme' in r, false);
});

Deno.test('e le righe restano quelle di prima, arricchite e basta', () => {
  /* collegaCamere non deve perdere per strada niente di quello che il back
     office gia' mostrava */
  const prima = arricchisciElenco([CAPOFILA]);
  const [dopo] = collegaCamere(prima, figlie(SECONDA));
  for (const k of Object.keys(prima[0])) {
    assert(k in dopo, `il campo «${k}» e sparito dalla riga`);
  }
  assertEquals(dopo.numero, CAPOFILA.numero);
  assertEquals(dopo.etichetta, prima[0].etichetta);
});

/* ============ e il server lo chiede come si deve ============ */

const INDEX = Deno.readTextFileSync(new URL('index.ts', import.meta.url))
  .split('\r\n').join('\n');

Deno.test('le camere del gruppo si cercano con una query LORO', () => {
  /* contarle fra le 200 righe gia' caricate vorrebbe dire sbagliare il
     numero appena la lista e' filtrata per stato: «mostrami solo le
     nuove» lascerebbe fuori una camera gia' vista */
  const dove = INDEX.indexOf("if (azione === 'elenco')");
  assert(dove > 0, 'sparita l azione elenco');
  const corpo = INDEX.slice(dove, INDEX.indexOf('\n  }\n', dove));
  assert(
    corpo.includes(".select('numero, dati').in('dati->>insieme', chiavi)"),
    'il gruppo non si cerca piu con una query sua: il conto sara sbagliato ' +
      'appena la lista e filtrata',
  );
  assert(
    corpo.includes('collegaCamere(righe, figlie)'),
    'l elenco non porta piu il gruppo di camere',
  );
});

Deno.test('e se quella query fallisce non si perde l elenco', () => {
  /* si perde il collegamento, che e' il male minore: una lista che non si
     apre ferma la reception, un collegamento mancante no */
  /* si guardano le DUE righe dell'errore: una finestra piu' larga
     prenderebbe dentro il `return` della strada buona, che non c'entra */
  const riga = INDEX.split('\n').find((l) => l.includes('collegamento fra camere non letto'));
  assert(riga, 'l errore della query non si registra piu');
  assert(riga!.includes('console.error'), 'l errore non si registra');
  assert(
    !riga!.includes('return') && !riga!.includes('throw'),
    'un errore nel collegamento fa fallire tutto l elenco',
  );
  const righe = INDEX.split('\n');
  const dopo = righe[righe.indexOf(riga!) + 1] ?? '';
  assert(
    dopo.includes('figlie = f ?? []'),
    'la strada buona non si legge piu accanto a quella dell errore',
  );
});
