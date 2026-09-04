/* ============================================================
   privacy-schede.test.ts — la scheda «Privacy» del back office: i consensi
   firmati, la ricerca, la stampa, le attese da annullare.
   ============================================================ */
import { assert } from 'jsr:@std/assert';

const P = Deno.readTextFileSync(new URL('./index.html', import.meta.url));

Deno.test('la scheda Privacy esiste e parla con la funzione privacy', () => {
  assert(P.includes('function vistaPrivacy('));
  assert(P.includes("const FUNZIONE_PRIVACY = 'https://mvuiuwakuseockotlcnp.supabase.co/functions/v1/privacy'"));
  assert(P.includes("['privacy'"), 'registrata in SCHEDE');
  for (const a of ['a=elenco', 'a=uno', 'a=annulla']) assert(P.includes(a), a);
});

Deno.test('si cerca per cognome o camera, si stampa con la firma, si annulla un attesa', () => {
  const v = P.slice(P.indexOf('function vistaPrivacy('), P.indexOf('function vistaPrivacy(') + 9000);
  assert(v.includes('cerca') && v.includes('print()'), 'ricerca e stampa');
  assert(v.includes('data:image/png') || v.includes('c.firma'), 'la firma si vede nella stampa');
  assert(v.includes('in_attesa') && v.includes('Annulla'), 'le attese si annullano');
  assert(!v.includes('pin_hash'));
});
