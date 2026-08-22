/* ============================================================
   camere-insieme.test.ts — il gruppo di camere nel back office.

   Il server manda `camere_insieme` su ogni riga che fa parte di un
   gruppo, capofila compresa (vedi collegaCamere in elenco.ts). Qui si
   prova che il back office lo mostri: un dato calcolato bene e non
   disegnato è un dato che non esiste.

   PERCHÉ CONTA. Tre camere dello stesso ospite sono tre pratiche
   distinte — ognuna col suo periodo, la sua tariffa, il suo stato, ed è
   giusto così — ma vanno assegnate vicine. Chi apre la pratica e non sa
   che ce ne sono altre due assegna la prima dove capita.

   TRE MODI DI ROMPERSI:

   · il segno compare su ogni richiesta, anche su quelle di una camera
     sola: rumore su tutta la lista;
   · dice «2 di 3» sulla riga sbagliata, e l'operatore cerca una camera
     che non è quella;
   · i numeri si vedono ma non si aprono, e cercarli a mano nella lista è
     esattamente il gesto che questo collegamento esiste per togliere.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';

const PAGINA = Deno.readTextFileSync(new URL('index.html', import.meta.url))
  .split('\r\n').join('\n');

function prendi(nome: string): string {
  const re = new RegExp('function ' + nome + '\\([^)]*\\) \\{[\\s\\S]*?\\n\\}');
  const m = PAGINA.match(re);
  if (!m) {
    throw new Error(
      `funzione \`${nome}\` non trovata in pagine/buoni/index.html: ` +
        'se e stata rinominata questa prova va aggiornata, non cancellata',
    );
  }
  return m[0];
}

type Riga = { numero: string; camere_insieme?: string[] };
const banco = new Function(
  'esc',
  `
  ${prendi('camereInsieme')}
  ${prendi('segnoInsieme')}
  return { camereInsieme, segnoInsieme };
`,
)((s: unknown) => String(s ?? '')) as {
  camereInsieme: (r: Riga) => { numeri: string[]; quale: number } | null;
  segnoInsieme: (r: Riga) => string;
};

const GRUPPO = ['C26/19130', 'C26/19131', 'C26/19132'];

Deno.test('la capofila sa di essere la prima di tre', () => {
  const g = banco.camereInsieme({ numero: 'C26/19130', camere_insieme: GRUPPO });
  assertEquals(g?.numeri.length, 3);
  assertEquals(g?.quale, 1);
});

Deno.test('e la terza sa di essere la terza', () => {
  /* dire «2 di 3» sulla riga sbagliata manda l operatore a cercare una
     camera che non e quella */
  assertEquals(banco.camereInsieme({ numero: 'C26/19132', camere_insieme: GRUPPO })?.quale, 3);
});

Deno.test('una richiesta di una camera sola non porta nessun gruppo', () => {
  /* «1 camera» su ogni richiesta normale sarebbe rumore su tutta la lista */
  assertEquals(banco.camereInsieme({ numero: 'C26/19140' }), null);
  assertEquals(banco.camereInsieme({ numero: 'C26/19140', camere_insieme: [] }), null);
  assertEquals(banco.camereInsieme({ numero: 'C26/19140', camere_insieme: ['C26/19140'] }), null);
  assertEquals(banco.segnoInsieme({ numero: 'C26/19140' }), '');
});

Deno.test('il segno in lista dice a quale camera si sta guardando', () => {
  const segno = banco.segnoInsieme({ numero: 'C26/19131', camere_insieme: GRUPPO });
  assert(segno.includes('2 di 3'), `il segno non dice dove si e: ${segno}`);
  assert(segno.includes('camere insieme'), 'il segno non dice di che cosa parla');
});

Deno.test('e una riga che non e nel suo stesso gruppo non inventa un numero', () => {
  /* puo' succedere con dati storti: meglio «3 camere insieme» che «0 di 3» */
  const segno = banco.segnoInsieme({ numero: 'C26/99999', camere_insieme: GRUPPO });
  assert(!segno.includes('0 di'), `il segno dice «0 di 3»: ${segno}`);
  assert(segno.includes('3'), 'il segno non dice quante sono');
});

/* ============ e si vede, e si apre ============ */

Deno.test('il gruppo si disegna in lista e in dettaglio', () => {
  /* un dato calcolato bene e non disegnato e un dato che non esiste */
  assert(PAGINA.includes('${segnoInsieme(r)}'), 'il segno non si disegna in lista');
  assert(PAGINA.includes('const g = camereInsieme(r);'), 'il gruppo non si disegna in dettaglio');
  assert(PAGINA.includes('class="insiemeCamere"'), 'sparito il riquadro del gruppo');
});

Deno.test('e dice che vanno assegnate vicine', () => {
  /* e' la ragione per cui la reception deve saperlo: senza quella riga il
     riquadro e' solo un elenco di numeri */
  const dove = PAGINA.indexOf('class="insiemeCamere"');
  assert(dove > 0, 'sparito il riquadro del gruppo');
  const blocco = PAGINA.slice(dove, dove + 600);
  assert(blocco.includes('assegnare vicine'), 'il riquadro non dice perche conta');
  assert(blocco.includes('stesso ospite'), 'il riquadro non dice di chi sono le camere');
});

Deno.test('le altre camere si aprono con un clic', () => {
  /* cercarle a mano nella lista e' il gesto che questo collegamento esiste
     per togliere */
  assert(PAGINA.includes('class="apriInsieme cod"'), 'i numeri non sono piu apribili');
  const dove = PAGINA.indexOf("querySelectorAll('button.apriInsieme')");
  assert(dove > 0, 'il clic sulle altre camere non fa piu niente');
  const corpo = PAGINA.slice(dove, dove + 500);
  assert(
    corpo.includes('dettaglioRichiesta(altra)'),
    'il clic non apre piu la camera scelta',
  );
  assert(
    corpo.includes('if (!altra)'),
    'una camera fuori dall elenco caricato farebbe esplodere la pagina',
  );
});

Deno.test('e la camera aperta non e un pulsante che riapre se stessa', () => {
  /* il numero della riga che si sta guardando resta scritto, non cliccabile */
  const dove = PAGINA.indexOf('num === r.numero');
  assert(dove > 0, 'la camera aperta e diventata un pulsante come le altre');
  assertStringInside(
    PAGINA.slice(dove, dove + 200),
    '<span class="cod">',
    'la camera aperta non si distingue piu dalle altre',
  );
});

function assertStringInside(dove: string, cosa: string, perche: string) {
  assert(dove.includes(cosa), perche);
}
