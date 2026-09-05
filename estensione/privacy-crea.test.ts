/* ============================================================
   privacy-crea.test.ts — le nostre firme nel registro privacy di Fidra.

   Fidra ha un suo registro (leonardo.fidra.cloud/privacy) che la
   reception riempie a mano con privacy/create. L'estensione ci mette
   sopra le firme del giorno raccolte da noi e riempie i campi; «Salva»
   resta dell'operatore. Prove sul testo: lo script vive nel DOM di Fidra.
   ============================================================ */
import { assert } from 'jsr:@std/assert';

const S = Deno.readTextFileSync(new URL('./fidra-privacy-crea.js', import.meta.url));
const M = JSON.parse(Deno.readTextFileSync(new URL('./manifest.json', import.meta.url))) as {
  version: string; content_scripts: { matches: string[]; js: string[] }[];
};

Deno.test('gira solo sul modulo di creazione della privacy di Fidra', () => {
  const cs = M.content_scripts.find((c) => c.js.includes('fidra-privacy-crea.js'));
  assert(cs, 'il manifest carica fidra-privacy-crea.js');
  assert(cs.matches.length === 1 && cs.matches[0] === 'https://leonardo.fidra.cloud/privacy/create*', cs.matches.join());
});

Deno.test('non salva mai e non clicca niente: riempie i campi vuoti, disegna la firma, e Salva e dell operatore', () => {
  assert(!/\.click\(\)|\.submit\(\)|fidra\.cloud\/api/.test(S), 'niente clic ne submit');
  assert(S.includes("if ((campo.value || '').trim()) { saltati.push(nome + ' (gia scritto)'); return; }"), 'un campo gia scritto non si tocca');
  assert(S.includes('function scriviNativo(el, valore)') && S.includes("el.dispatchEvent(new Event('input', { bubbles: true }));"), 'col setter nativo, come il cliente nuovo');
  assert(S.includes('function disegnaFirma(radice, dataUrl)') && S.includes("radice.querySelector('canvas')"), 'la firma nel riquadro');
});

Deno.test('parla solo con la nostra funzione, con la chiave hotel: le firme del giorno e la firma di uno', () => {
  const post = S.match(/fetch\((\w+) \+/g) ?? [];
  assert(post.length === 2 && post.every((p) => /fetch\((STATO|FIRMA) \+/.test(p)), post.join(' '));
  assert(S.includes("const STATO = FUNZIONE + '?a=stato';") && S.includes("const FIRMA = FUNZIONE + '?a=firma-di';"));
  assert(S.includes("chrome.storage.local.get(['hotelKey'])") && S.includes("'x-hotel-key': hotelKey"));
});

Deno.test('i tre consensi di Fidra combaciano coi nostri: telefono e messaggi = messaggi, dati = conservazione, newsletter = marketing', () => {
  assert(S.includes("messaggi:      campoConEtichetta(radice, /telefono e messaggi/i, 'spunta')"));
  assert(S.includes("conservazione: campoConEtichetta(radice, /consenso dati/i, 'spunta')"));
  assert(S.includes("marketing:     campoConEtichetta(radice, /newsletter/i, 'spunta')"));
});
