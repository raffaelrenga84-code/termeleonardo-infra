/* ============================================================
   prompt.test.ts — il prompt dell'agente vocale contro le fonti vere.

   PERCHE' ESISTE. Il prompt e' un documento lungo che ripete a parole
   numeri che nel sistema stanno scritti da un'altra parte: gli orari della
   navetta, i prezzi dei transfer, i nomi delle categorie di camera,
   l'indirizzo. Quando uno dei due cambia, l'altro non se ne accorge — e
   l'agente vocale continua a dire al telefono una cosa che il sito non fa
   piu'. Nessuno se ne accorge finche' non lo dice a un ospite.

   Il 20 agosto 2026, leggendo la v4.10, sono saltate fuori tre divergenze
   di questo tipo (fascia oraria della navetta, dominio dei buoni regalo,
   orario del bar) e cinque contraddizioni interne fra il changelog e il
   corpo. Nessuna era visibile senza mettere i due testi uno accanto
   all'altro. Questo file lo fa a ogni giro di prove.

   IL FILE DEL PROMPT NON LO SCRIVE QUESTO REPOSITORY. L'originale e' quello
   che la proprieta' carica sulla piattaforma vocale: qui dentro ci va una
   COPIA di quel file, e se manca queste prove falliscono dicendolo. Una
   copia riscritta a mano sarebbe una seconda verita' che diverge dalla
   prima — cioe' esattamente il difetto che queste prove esistono per
   trovare.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';
import { CAMERE } from '../../supabase/functions/richieste/camere.ts';

const PERCORSO = 'prompt.txt';

function prompt(): string {
  try {
    return Deno.readTextFileSync(new URL(PERCORSO, import.meta.url));
  } catch {
    return '';
  }
}

Deno.test('il prompt e nel repository', () => {
  assert(
    prompt().length > 5000,
    'Manca docs/agente-vocale/prompt.txt.\n' +
      '  Salvare li la copia del prompt in uso sulla piattaforma vocale,\n' +
      '  senza riscriverlo: e la copia di un file che esiste gia.',
  );
});

/* ---------- le fonti vere ---------- */

function testo(percorso: string): string {
  return Deno.readTextFileSync(new URL(percorso, import.meta.url));
}

/** Un valore esportato da un modulo delle pagine, letto come testo. */
function costante(percorso: string, nome: string): string {
  const s = testo(percorso);
  const m = s.match(new RegExp(`export const ${nome} = '([^']*)'`));
  assert(m, `${nome} non si trova in ${percorso}`);
  return m![1];
}

/* ---------- la navetta ---------- */

/* Il prompt dichiara una fascia oraria a parole; navetta.js e' quello che
   decide davvero se il modulo del sito la offre. Se divergono, l'agente
   nega al telefono una corsa che il sito accetta. */
Deno.test('le due fasce della navetta sono quelle vere', () => {
  const testoPrompt = prompt();
  if (!testoPrompt) return; // lo dice gia la prova sopra

  /* le fasce vere, lette dal modulo che governa i moduli del sito */
  const modulo = testo('../../pagine/comune/navetta.js');
  const m = modulo.match(/partenza: \{ dalle: '([^']+)', alle: '([^']+)' \},\s*arrivo: \{ dalle: '([^']+)', alle: '([^']+)' \}/);
  assert(m, 'FASCE non si trova in navetta.js: la regola e cambiata forma');
  const [, pDalle, pAlle, aDalle, aAlle] = m!;

  /* nel prompt gli orari sono scritti in lettere */
  const inLettere: Record<string, string> = {
    '08:00': 'otto', '09:00': 'nove', '17:00': 'diciassette', '18:00': 'diciotto',
  };
  for (const ora of [pDalle, pAlle, aDalle, aAlle]) {
    assert(inLettere[ora],
      `la fascia ${ora} non ha una forma in lettere: aggiornare questa prova`);
  }

  const riga = testoPrompt.match(
    /partenze fra le ([a-z ]+?) e le ([a-z ]+?) e arrivi fra le ([a-z ]+?) e le ([a-z ]+?)\*\*/i,
  );
  assert(riga, 'la fascia oraria della navetta non si trova nel prompt');
  const dette = [riga![1], riga![2], riga![3], riga![4]].map((x) => x.trim());
  const attese = [pDalle, pAlle, aDalle, aAlle].map((x) => inLettere[x]);

  assertEquals(dette, attese,
    'il prompt e navetta.js dicono due fasce diverse: al telefono si sente ' +
      'una cosa e sul sito se ne vede un altra');
});

/* ---------- le categorie di camera ---------- */

Deno.test('ogni categoria del prompt esiste nel catalogo, e viceversa', () => {
  const p = prompt();
  if (!p) return;
  const nomi = Object.values(CAMERE).map((c) => c.nome);
  assert(nomi.length === 11, `il catalogo ha ${nomi.length} categorie: aggiornare questa prova`);

  const mancanti = nomi.filter((n) => !p.includes(n));
  assertEquals(mancanti, [], `categorie che il prompt non nomina: ${mancanti.join(', ')}`);
});

/* ---------- l'indirizzo ---------- */

Deno.test('il prompt porta l indirizzo vero', () => {
  const p = prompt();
  if (!p) return;
  assert(p.includes('Via Monteortone, 46'), 'il prompt non porta la via giusta');
  assert(p.includes('35037'), 'il prompt non porta il CAP giusto');
  assert(!p.includes('35031'), 'il prompt porta il CAP di Abano centro, che non e il nostro');
});

/* ---------- le contraddizioni interne ---------- */

/* Il changelog della v4.10 dichiara «massaggio californiano tolto dal
   listino» e «Shiatsu si scrive cosi'». Il corpo, alla stessa data,
   conteneva ancora «californiano (50') 60 €» e scriveva «Shiatzu». Un
   changelog che dichiara una modifica non entrata e' peggio di nessun
   changelog: chi lo legge crede che il lavoro sia stato fatto. */
Deno.test('cio che il changelog dichiara tolto non e nel listino', () => {
  const p = prompt();
  if (!p) return;
  const dichiaraTolto = /californiano tolto dal listino/i.test(p);
  if (!dichiaraTolto) return; // il changelog e' cambiato: niente da verificare
  assert(
    !/californiano \(\d+'\)/.test(p),
    'il changelog dichiara il californiano tolto, ma il listino lo contiene ancora',
  );
});

Deno.test('Shiatsu si scrive in un modo solo', () => {
  const p = prompt();
  if (!p) return;
  assert(!/Shiatzu/i.test(p), 'compare «Shiatzu»: la grafia decisa e «Shiatsu»');
});

/* Il changelog dice che i piu' richiesti sono «quelli col ♥ del listino».
   Se nel listino non c'e' nessun ♥, quella regola non puo' funzionare:
   l'agente deve riconoscere un segno che nel suo testo non esiste. */
Deno.test('se il prompt rimanda a un segno, quel segno c e', () => {
  const p = prompt();
  if (!p) return;
  if (!/col ♥ del listino|con il ♥/i.test(p)) return;
  const quanti = (p.match(/♥/g) || []).length;
  assert(quanti > 1, 'il prompt rimanda al ♥ del listino, ma nel listino non ce n e nessuno');
});

/* ---------- i domini ---------- */

/* I buoni regalo NON stanno su termeleonardo.com: quella pagina risponde
   404, verificato il 20 agosto 2026. Stanno su hoteltermeleonardo.com, che
   e' dove puntano anche i pulsanti delle email dell'estensione. */
Deno.test('i buoni regalo sono mandati sul dominio giusto', () => {
  const p = prompt();
  if (!p) return;
  const attorno = p.match(/[Bb]uoni [Rr]egalo[\s\S]{0,200}/g) || [];
  const sbagliati = attorno.filter((b) =>
    /termeleonardo\.com, sezione Buoni Regalo/i.test(b) &&
    !/hoteltermeleonardo\.com/i.test(b)
  );
  assertEquals(
    sbagliati.length,
    0,
    'il prompt manda i buoni regalo su termeleonardo.com, dove quella pagina non esiste',
  );
});
