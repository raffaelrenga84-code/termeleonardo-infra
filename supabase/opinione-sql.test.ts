/* ============================================================
   opinione-sql.test.ts — la tabella delle opinioni degli ospiti (totem).

   Poche colonne, nessun dato personale oltre al numero di camera scelto
   dall'ospite. Ripetibile: solo `create ... if not exists`.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';

const S = Deno.readTextFileSync(new URL('./2026-09-04-opinione.sql', import.meta.url));

Deno.test('la tabella opinione: stelle 1-5, fonte, lingua, temi, camera, email_inviata', () => {
  assert(/create table if not exists opinione \(/.test(S));
  assert(/stelle\s+int\s+not null check \(stelle between 1 and 5\)/.test(S));
  assert(/fonte\s+text not null default 'totem' check \(fonte in \('totem', 'qr'\)\)/.test(S));
  assert(/lingua\s+text not null default 'it' check \(lingua in \('it', 'en', 'de', 'fr'\)\)/.test(S));
  assert(/temi\s+text\[\] not null default '\{\}'/.test(S));
  assert(/camera\s+text,/.test(S) && /commento\s+text,/.test(S));
  assert(/email_inviata boolean not null default false/.test(S));
  assert(/prova\s+boolean not null default false/.test(S));
});

Deno.test('ripetibile e senza dati che non servono', () => {
  const create = S.match(/create (table|index)/g) ?? [];
  const seNonEsiste = S.match(/create (table|index) if not exists/g) ?? [];
  assertEquals(create.length, seNonEsiste.length, 'ogni create ha if not exists');
  /* si guardano le colonne, non i commenti (che spiegano proprio perche' la tessera non c'e') */
  const colonne = S.split('\n').filter((r) => !r.trim().startsWith('--')).join('\n');
  assert(!/tessera|email\s+text|nome\s+text|telefono/.test(colonne), 'ne tessera, ne email, ne nome, ne telefono: solo la camera, se l ospite vuole');
});
