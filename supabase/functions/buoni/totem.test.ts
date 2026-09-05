/* ============================================================
   totem.test.ts — il totem in hall riscuote i buoni del Day Spa.

   Il totem non ha un utente: porta x-totem-key (TOTEM_KEY, o l'IP fisso
   dell'hotel), la stessa chiave con cui segna i presenti nel Day Spa.
   Apre una cosa sola, riscuotere un ingresso Day Spa pagato, e sta PRIMA
   del cancello generale come ?a=presenti in dayspa/index.ts. Prove sul
   sorgente: Deno.serve non si chiama da qui.
   ============================================================ */
import { assert } from 'jsr:@std/assert';

const S = Deno.readTextFileSync(new URL('./index.ts', import.meta.url));

Deno.test('il totem si riconosce come nel Day Spa: x-totem-key con TOTEM_KEY o TOTEM_IP, e la chiave passa il CORS', () => {
  assert(S.includes("'Access-Control-Allow-Headers': 'content-type, authorization, x-hotel-key, x-totem-key'"), 'CORS');
  const e = S.slice(S.indexOf('const eTotem = '), S.indexOf('};', S.indexOf('const eTotem = ')));
  assert(e.includes("Deno.env.get('TOTEM_KEY')") && e.includes("Deno.env.get('TOTEM_IP')") && e.includes("r.headers.get('x-totem-key')"), e);
  assert(e.includes('if (portata === null) return false;'), 'senza intestazione non e mai il totem');
});

Deno.test('dal totem ?a=riscuoti sta prima del cancello, vale solo per gli ingressi Day Spa pagati, e firma «totem»', () => {
  const i = S.indexOf("if (req.method === 'POST' && azione === 'riscuoti' && eTotem(req))");
  assert(i > 0, 'il ramo del totem');
  assert(i < S.indexOf('/* ---------- da qui in poi serve la chiave ---------- */'), 'prima del cancello');
  const r = S.slice(i, S.indexOf('/* ---------- da qui in poi serve la chiave ---------- */'));
  assert(r.includes('riscuotibileDalTotem('), 'la regola di ruoli.ts');
  assert(r.includes("riscosso_da: 'totem'"), 'chi ha riscosso');
  assert(r.includes("stato: 'riscosso'") && r.includes(".eq('codice', codice)") && r.includes(".eq('stato', 'pagato')"), 'si scrive solo su un buono pagato, per codice');
});

Deno.test('la verifica pubblica dice se il buono si riscuote al totem e a chi e intestato', () => {
  const v = S.slice(S.indexOf("if (azione === 'verifica')"), S.indexOf('/* ---------- pubblico: il buono pronto per il foglio A4'));
  assert(v.includes('totem: riscuotibileDalTotem(data)'), 'il totem sa se riscuotere');
  assert(v.includes('destinatario: data.destinatario'), 'il nome per il modulo del sito');
  assert(v.includes("'codice, descrizione, valore, scade_il, stato, riscosso_il, voci, tipo, voce_id, destinatario'"), 'la select');
});
