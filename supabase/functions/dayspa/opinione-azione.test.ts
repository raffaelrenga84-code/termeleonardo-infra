/* ============================================================
   opinione-azione.test.ts — l'azione ?a=opinione e il QR del link Google,
   lette dal sorgente di index.ts (come azioni.test.ts).
   ============================================================ */
import { assert } from 'jsr:@std/assert';

const S = Deno.readTextFileSync(new URL('./index.ts', import.meta.url));
const da = (marca: string) => { const i = S.indexOf(marca); assert(i >= 0, `manca «${marca}»`); return i; };

Deno.test('l opinione: solo dal totem, corpo letto dal modulo puro, una al minuto, salvata e mandata alla direzione', () => {
  const b = S.slice(da("azione === 'opinione'"), da('riservati al back office'));
  for (const s of ['if (!eTotem(req))', 'leggiOpinione(', 'inviaEmail(', 'EMAIL_DIREZIONE', 'destinatariOpinione(', 'emailOpinione(', '429', "from('opinione')", 'contoFidra(', 'email_inviata']) assert(b.includes(s), s);
  const insert = b.slice(b.indexOf("from('opinione').insert("), b.indexOf('.select', b.indexOf("from('opinione').insert(")));
  assert(!insert.includes('tessera'), 'il codice della tessera non si salva: solo la camera');
  assert(S.includes("Deno.env.get('EMAIL_DIREZIONE') || 'direzione@termeleonardo.com'"), 'la direzione e il destinatario di sempre');
});

Deno.test('la chiamata a Fidra per la tessera e una sola, condivisa fra conto e opinione, dentro la parte del totem', () => {
  const totem = S.slice(da('/* ---------- i presenti'), da('riservati al back office'));
  assert(totem.includes('const contoFidra = async') || totem.includes('async function contoFidra'), 'contoFidra vive nella parte del totem');
  assert((totem.match(/\/api\/bill-scanner\//g) ?? []).length === 1, 'una sola chiamata a bill-scanner');
  const conto = S.slice(da("azione === 'conto'"), da("azione === 'opinione'"));
  assert(conto.includes('contoFidra(') && conto.includes('riassuntoConto('));
});

Deno.test('il QR del link Google e pubblico, prima della parte riservata, e senza link risponde 404', () => {
  const i = da("azione === 'qr-google'");
  assert(i < da('riservati al back office'));
  const b = S.slice(i, i + 700);
  assert(b.includes("Deno.env.get('GOOGLE_RECENSIONE_URL')") && b.includes('generaPngQR(') && b.includes('404'));
});
