/* ============================================================
   sistema.ts — assembla il prompt di sistema mandato al modello.

   Spostato fuori da index.ts apposta: index.ts avvia Deno.serve al solo
   essere importato, quindi niente in questa cartella lo importa mai nei
   test (vedi streaming.test.ts). La costruzione del prompt, però, è
   proprio quello che va provato — è dove si e' inserita la riga di
   chiusura stagionale (chiusura.ts) — quindi vive qui, in un modulo che i
   test possono importare senza far partire un server.

   La data e le stagioni arrivano DA FUORI (parametri), non da `new
   Date()` o da una query qui dentro: è quello che rende `sistema()`
   pura e collaudabile. Chi chiama davvero (index.ts) legge le stagioni
   dal database e passa `new Date()`; i test passano quello che vogliono
   provare.
   ============================================================ */
import { REGOLE_CANALE } from './prompt.ts';
import { KNOWLEDGE_BASE } from './kb.ts';
import { frasechiusura, type Stagione } from './chiusura.ts';

const GG = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
const MM = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio',
  'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

/* L'elenco degli strumenti disponibili viene DOPO le regole di canale e
   dopo la Knowledge Base, cosi' se quelle nominano uno strumento che non
   esiste (era il caso di verifica_dayspa), l'ultima parola e' la realtà.
   La riga di chiusura stagionale (se le date ci sono) va invece nel
   CONTESTO, accanto alla data di oggi: e' un fatto dipendente dalla data,
   esattamente come quello, non una regola di comportamento. */
export function sistema(lingua: string, stagioni: Stagione[], oggi: Date): string {
  const data = `${GG[oggi.getUTCDay()]} ${oggi.getUTCDate()} ${MM[oggi.getUTCMonth()]} ${oggi.getUTCFullYear()}`;
  const rigaChiusura = frasechiusura(stagioni, oggi);

  return [
    REGOLE_CANALE,
    '',
    '---',
    '',
    KNOWLEDGE_BASE,
    '',
    '---',
    '',
    '# STRUMENTI DISPONIBILI IN QUESTO CANALE',
    '',
    'Questo elenco ha la precedenza su qualunque altro punto del prompt.',
    '',
    '- `verifica_camere` — disponibile.',
    '- `invia_richiesta` — disponibile. Restituisce `stato: "registrata"` e un',
    '  `riferimento` solo se ha funzionato davvero. Se restituisce `fallita`,',
    '  la richiesta NON esiste: e\' vietato dire che l\'hai registrata.',
    '- `verifica_dayspa` — **NON esiste in questo canale.** Non tentare di',
    '  chiamarlo. Sul Day Spa rispondi con i dati della Knowledge Base (orari,',
    '  prezzi, regola dei sette giorni) e manda a prenotare online: e\' comunque',
    '  l\'unico modo per garantire il posto. Non dire mai che una data e\'',
    '  esaurita, perche\' non puoi saperlo.',
    '',
    '# CONTESTO',
    '',
    `Oggi è ${data}. Questa è l'unica fonte valida per qualunque calcolo di date.`,
    /* niente riga se le stagioni mancano o sono sporche: vedi chiusura.ts
       per il perche' — meglio il prompt di oggi (senza data di chiusura)
       che una chiusura inventata */
    ...(rigaChiusura ? ['', rigaChiusura] : []),
    `La lingua dell'interfaccia è: ${lingua}.`,
  ].join('\n');
}
