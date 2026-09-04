/* ============================================================
   privacy-pagina.test.ts — il consenso privacy sul totem e sugli iPad,
   letto dal sorgente della pagina dell'ingresso.
   ============================================================ */
import { assert } from 'jsr:@std/assert';

const P = Deno.readTextFileSync(new URL('./index.html', import.meta.url));
const m = (P.match(/<script type="module">([\s\S]*?)<\/script>/) ?? ['', ''])[1];
const t = m.slice(m.indexOf('function totem('), m.indexOf('function sportello('));
const p = t.slice(t.indexOf('const privacy = '));

Deno.test('nel riposo del totem c e il pulsante Privacy nelle lingue, e il percorso parla con la funzione privacy', () => {
  assert(t.includes('id="privacyApri"'), 'il pulsante');
  for (const s of ['Privacy', 'Datenschutz', 'Confidentialit']) assert(t.includes(s), s);
  assert(t.includes('const privacy = '), 'il percorso');
  assert(m.includes("const FUNZIONE_PRIVACY = 'https://mvuiuwakuseockotlcnp.supabase.co/functions/v1/privacy'"));
  for (const a of ['a=testi', 'a=tessera', 'a=firma', 'a=attese']) assert(p.includes(a), a);
  assert(p.includes('document.onclick = null'), 'il tocco ovunque e spento nel percorso');
});

Deno.test('il modulo: nessuna scelta preimpostata, due pulsanti per frase, firma su canvas col dito, conferma solo se completo', () => {
  assert(!/checked/.test(p), 'niente preimpostato: un consenso pre-spuntato non vale (Planet49)');
  assert(p.includes('T.autorizzo') && p.includes('T.nonAutorizzo'), 'due pulsanti per ogni frase');
  assert(p.includes('<canvas') && p.includes("toDataURL('image/png')"), 'la firma e un canvas che diventa PNG');
  assert(p.includes('pointerdown') && p.includes('pointermove'), 'si firma col dito');
  assert(p.includes('T.mancaFirma') && p.includes('T.mancaScelte'), 'conferma solo con tre risposte e la firma');
  assert(p.includes('T.leggi') && p.includes('T.sintesi'), 'l informativa si puo leggere');
});

Deno.test('sugli iPad la stessa pagina con ?privacy=1: elenco delle attese, niente lettore, niente Day Spa', () => {
  assert(m.includes("get('privacy')"), 'il modo privacy dall indirizzo');
  assert(t.includes('SOLO_PRIVACY'), 'il modo si chiama SOLO_PRIVACY');
  assert(p.includes("fonte: SOLO_PRIVACY ? 'ipad' : 'totem'"), 'la fonte dice da dove viene la firma');
});

Deno.test('la pagina manda solo cifre della tessera e non parla con Fidra', () => {
  assert(!t.includes('bill-scanner') && !t.includes('fidra.cloud'));
  assert(p.includes("=== 'tessera'"));
});
