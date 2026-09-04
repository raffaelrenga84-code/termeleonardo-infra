/* ============================================================
   consenso-sql.test.ts — la tabella dei consensi privacy (totem, iPad).
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';

const S = Deno.readTextFileSync(new URL('./2026-09-04-consenso.sql', import.meta.url));
const colonne = S.split('\n').filter((r) => !r.trim().startsWith('--')).join('\n');

Deno.test('la tabella consenso: stato, camera e cognome obbligatori, tre scelte, firma, versione dei testi, fonte', () => {
  assert(/create table if not exists consenso \(/.test(S));
  assert(/stato\s+text not null default 'in_attesa' check \(stato in \('in_attesa', 'firmato', 'annullato'\)\)/.test(S));
  assert(/camera\s+text not null,/.test(S) && /cognome\s+text not null,/.test(S));
  for (const c of ['conservazione', 'messaggi', 'marketing']) assert(new RegExp(`${c}\\s+boolean,`).test(S), c);
  assert(/firma\s+text,/.test(S) && /testi_versione\s+text,/.test(S));
  assert(/fonte\s+text check \(fonte in \('totem', 'ipad'\)\)/.test(S));
  assert(/lingua\s+text not null default 'it' check \(lingua in \('it', 'en', 'de', 'fr'\)\)/.test(S));
});

Deno.test('ripetibile, e senza tessera ne data di nascita', () => {
  const create = S.match(/create (table|index)/g) ?? [];
  assertEquals(create.length, (S.match(/create (table|index) if not exists/g) ?? []).length);
  assert(!/tessera|nascita/.test(colonne), 'il codice della tessera e la data di nascita non si salvano');
});
