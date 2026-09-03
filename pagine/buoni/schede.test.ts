/* ============================================================
   schede.test.ts — le schede del back office e le funzioni che le disegnano.

   COME SI ROMPE. Le schede sono tre cose scritte in tre punti diversi:
   il pulsante (una riga di `SCHEDE`), la voce nella mappa che smista
   (`{ emetti: vistaEmetti, ... }[VISTA]()`) e la funzione vera. Se una
   delle tre non combacia con le altre, la pagina non se ne accorge: si
   apre normalmente, e il guasto arriva quando qualcuno clicca quella
   scheda — «vistaX is not a function», in reception, davanti a un ospite.

   Non e' un difetto immaginario: e' esattamente il modo in cui si sbaglia
   ad aggiungerne una quinta.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';

const SORGENTE = Deno.readTextFileSync(new URL('index.html', import.meta.url));

/** I nomi sui pulsanti delle schede.
 *
 *  Si leggono da `SCHEDE`, non piu' dal markup: da quando una scheda si
 *  puo' nascondere per ruolo — alla spa «Emetti un buono», che il server
 *  le rifiuta — i pulsanti nascono da un modello e nel sorgente non c'e'
 *  piu' nessun `data-v="emetti"` da cercare. L'elenco e' la fonte da cui
 *  quel markup nasce, quindi e' il posto giusto dove guardare. */
function pulsanti(): string[] {
  const elenco = SORGENTE.match(/const SCHEDE = \[[\s\S]*?\];/);
  assert(elenco, 'const SCHEDE non si trova in pagine/buoni/index.html: la pagina e cambiata, aggiornare questa prova');
  return [...elenco![0].matchAll(/\['([a-z]+)',/g)].map((m) => m[1]);
}

/** La mappa che smista: nome della scheda -> nome della funzione. */
function mappa(): Record<string, string> {
  const m = SORGENTE.match(/\(\{([^}]*)\}\)\[VISTA\]\(\)/);
  assert(m, "la mappa ({...})[VISTA]() non si trova in pagine/buoni/index.html: " +
    'la pagina e cambiata, aggiornare questa prova');
  const fuori: Record<string, string> = {};
  for (const voce of m![1].split(',')) {
    const [k, v] = voce.split(':').map((s) => s.trim());
    if (k && v) fuori[k] = v;
  }
  return fuori;
}

/* Se questa prova girasse a vuoto — nessun pulsante trovato — tutte le
   altre passerebbero senza controllare niente. */
Deno.test('le schede si trovano', () => {
  assert(pulsanti().length >= 5, `trovate ${pulsanti().length} schede`);
  assert(Object.keys(mappa()).length >= 5, 'la mappa ha meno di cinque voci');
});

Deno.test('ogni pulsante ha la sua voce nella mappa', () => {
  const m = mappa();
  for (const p of pulsanti()) {
    assert(p in m, `la scheda "${p}" ha un pulsante e nessuna voce nella mappa`);
  }
});

Deno.test('ogni voce della mappa ha il suo pulsante', () => {
  const p = pulsanti();
  for (const nome of Object.keys(mappa())) {
    assert(p.includes(nome), `la voce "${nome}" e nella mappa e non ha un pulsante`);
  }
});

/* La terza delle tre: la funzione deve esistere davvero. */
Deno.test('ogni voce della mappa ha la sua funzione', () => {
  for (const [scheda, funzione] of Object.entries(mappa())) {
    const c = new RegExp('function[ ]+' + funzione + '[ ]*[(]').test(SORGENTE);
    assert(c, `la scheda "${scheda}" chiama ${funzione}(), che non esiste`);
  }
});

/* E la quinta, quella per cui tutto questo e' stato scritto. */
Deno.test('c e la scheda Arrivi', () => {
  assert(pulsanti().includes('arrivi'), 'la scheda Arrivi non c e');
  assertEquals(mappa().arrivi, 'vistaArrivi');
});

/* ============================================================
   E CHE LA PAGINA SI APRA ANCORA.

   Il back office e' millesettecento righe dentro un unico <script type=
   "module">, e le viste sono fatte di stringhe con apici inversi lunghe
   decine di righe. Un apice inverso chiuso male non rompe la vista che si
   sta scrivendo: rompe TUTTO il file, e la pagina si apre bianca — niente
   buoni, niente richieste, niente accesso.

   Qui non si esegue niente: si costruisce una funzione con quel corpo,
   che il motore analizza senza chiamarla. Le variabili del browser non
   servono; un errore di sintassi si', e si vede subito.
   ============================================================ */
Deno.test('il copione della pagina si legge senza errori di sintassi', () => {
  const m = SORGENTE.match(/<script type="module">([\s\S]*)<\/script>/);
  assert(m, 'lo <script type="module"> non si trova');
  /* gli import stanno solo in cima a un modulo: qui il corpo e' una
     funzione, e vanno tolti — sono comunque provati da chi li usa */
  const corpo = m![1].split('\n')
    .filter((r) => !/^\s*import\s/.test(r))
    .join('\n');
  assert(corpo.length > 10000, `corpo di sole ${corpo.length} lettere: la prova gira a vuoto`);
  new Function(corpo);
});

/* ============================================================
   IL NUMERO DELLE RICHIESTE DA GUARDARE, SUL PULSANTE DELLA SCHEDA.

   «Rendilo un back office piu' intuitivo per comunicare con gli ospiti e
   velocizzare la comunicazione» (3 settembre 2026). La cosa che piu'
   rallenta una risposta e' non sapere che c'e' una richiesta: chi entra
   deve leggere «Richieste dal sito 3» prima ancora di cliccare. Il numero
   e' un aiuto, non un dato: se la chiamata fallisce il pulsante resta
   com'e', senza errori a video.
   ============================================================ */
Deno.test('il pulsante delle richieste porta il numero di quelle da guardare', () => {
  const m = SORGENTE.match(/async function aggiornaContatore\(\) \{([\s\S]*?)\n\}/);
  assert(m, 'aggiornaContatore() non si trova per intero');
  assert(/stato=nuova/.test(m[1]), 'non conta le richieste nuove: conterebbe anche quelle gia gestite');
  assert(/data-scheda="richieste"/.test(m[1]), 'non scrive sul pulsante delle richieste');
  assert(/catch \(e\)/.test(m[1]), 'un errore di rete finirebbe a video invece di lasciare il pulsante com e');
  assert(/class="conta"/.test(m[1]), 'il numero non ha la sua classe: non si vedrebbe come un contatore');
  assert(/\.schede button \.conta\{/.test(SORGENTE), 'manca lo stile del contatore');
});

Deno.test('il numero si aggiorna a ogni cambio di scheda e a ogni ricarica dell elenco', () => {
  const disegna = SORGENTE.match(/function disegna\(\) \{([\s\S]*?)\n\}/);
  assert(disegna && /aggiornaContatore\(\);/.test(disegna[1]), 'disegna() non aggiorna il numero');
  const carica = SORGENTE.match(/const carica = async \(\) => \{[\s\S]*?CARICATE = j\.richieste \|\| \[\];[\s\S]{0,400}?aggiornaContatore\(\);/);
  assert(carica, 'dopo la ricarica dell elenco il numero resta vecchio: dopo «Segna vista» non scenderebbe');
});

/* ---------- l'intestazione dice cos'e' la pagina ---------- */
Deno.test('l intestazione dice back office, non piu solo buoni regalo', () => {
  assert(/<span>back office<\/span>/.test(SORGENTE), 'l intestazione dice ancora «buoni regalo»: per chi entra a rispondere alle richieste e fuorviante');
});
