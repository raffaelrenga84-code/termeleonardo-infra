/* ============================================================
   letti.test.ts — chi ha il letto alla francese, e quanto è largo.

   DUE ERRORI VERI, corretti dalla proprietà il 22 agosto 2026.

   1. IL LETTO ALLA FRANCESE È DELLA SINGOLA PARCO. Era attribuito alla
      «Singola senza balcone» nel catalogo, e da lì era finito nella
      Knowledge Base del chatbot e nel prompt dell'agente vocale: tre
      canali che dicevano la stessa cosa sbagliata alla stessa persona.

   2. LA QUEEN NON HA UN LETTO ALLA FRANCESE. In tedesco era descritta
      come «französisches Doppelbett»: un ospite tedesco leggeva la parola
      sbagliata nell'offerta e nella conferma. La Queen ha un matrimoniale
      da 1,60 m.

   E IL LETTO AVEVA DUE MISURE: 1,45 m nel catalogo, 1,40 m nei modelli
   delle email. Un ospite che riceve l'offerta e poi apre la pagina di
   prenotazione leggeva due numeri diversi per lo stesso letto. Due numeri
   sono certamente sbagliati; uno solo può essere giusto — e se è
   sbagliato si cambia in un posto.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';
import { CAMERE } from './camere.ts';

const LINGUE = ['it', 'de', 'en', 'fr'] as const;

/* i segni del letto alla francese, uno per lingua */
const FRANCESE = /alla francese|französisches Bett|French bed|à la française/i;

Deno.test('il letto alla francese e della Singola Parco, in tutte le lingue', () => {
  const parco = CAMERE[3];
  assertEquals(parco.nome, 'Singola Parco', 'la camera 3 non e piu la Singola Parco');
  for (const l of LINGUE) {
    assert(
      FRANCESE.test(parco.descrizione[l]),
      `«${l}»: la Singola Parco non dice piu di avere il letto alla francese`,
    );
  }
});

Deno.test('e nessun altra camera dichiara di averlo', () => {
  /* era della «Singola senza balcone», e da li era finito anche nella
     Knowledge Base e nel prompt dell agente vocale */
  const altre = Object.values(CAMERE)
    .filter((c) => c.id !== 3)
    .filter((c) => LINGUE.some((l) => FRANCESE.test(c.descrizione[l] ?? '')))
    .map((c) => c.nome);
  assertEquals(altre, [], 'queste camere dicono di avere il letto alla francese, e non lo hanno');
});

Deno.test('e la Queen ha un matrimoniale, non un letto alla francese', () => {
  /* in tedesco era «französisches Doppelbett»: la parola sbagliata
     nell offerta e nella conferma di un ospite tedesco */
  const queen = CAMERE[6];
  assertEquals(queen.nome, 'Matrimoniale Queen');
  for (const l of LINGUE) {
    assertEquals(
      FRANCESE.test(queen.descrizione[l]),
      false,
      `«${l}»: la Queen e descritta come un letto alla francese`,
    );
  }
});

Deno.test('e il letto alla francese ha UNA misura sola in tutto il progetto', () => {
  /* 1,45 nel catalogo e 1,40 nei modelli delle email: chi riceve
     l offerta e poi apre la pagina leggeva due numeri diversi per lo
     stesso letto. Si guardano i file veri, non una copia. */
  const RADICE = new URL('../../../', import.meta.url);
  const CARTELLE = ['pagine', 'estensione', 'supabase/functions', 'docs'];
  const ESTENSIONI = ['.ts', '.js', '.html', '.txt'];
  const misure = new Set<string>();
  const dove: string[] = [];

  const guarda = (dir: URL) => {
    for (const e of Deno.readDirSync(dir)) {
      if (e.name === 'node_modules' || e.name === '.git') continue;
      const p = new URL(e.name + (e.isDirectory ? '/' : ''), dir);
      if (e.isDirectory) { guarda(p); continue; }
      if (!ESTENSIONI.some((x) => e.name.endsWith(x))) continue;
      if (e.name.endsWith('.test.ts')) continue;
      const testo = Deno.readTextFileSync(p);
      for (const m of testo.matchAll(/(?:francese|française|französisches Bett|French bed)[^.\n]{0,30}?(1[.,]\d\d)/gi)) {
        misure.add(m[1].replace(',', '.'));
        dove.push(`${p.pathname.split('/').slice(-2).join('/')}: ${m[1]}`);
      }
    }
  };
  for (const c of CARTELLE) {
    try { guarda(new URL(c + '/', RADICE)); } catch { /* cartella assente */ }
  }

  assert(misure.size > 0, 'nessuna misura trovata: la prova non guarda niente');
  assertEquals(
    [...misure],
    ['1.45'],
    `il letto alla francese ha piu di una misura:\n  ${dove.join('\n  ')}`,
  );
});
