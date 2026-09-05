/* ============================================================
   pagina.test.ts — l'ordine dal tavolo col QR, letto dal sorgente.
   ============================================================ */
import { assert } from 'jsr:@std/assert';

const P = Deno.readTextFileSync(new URL('./index.html', import.meta.url));
const m = (P.match(/<script type="module">([\s\S]*?)<\/script>/) ?? ['', ''])[1];

Deno.test('l ospite ordina in quattro lingue, coi quadratoni, e paga con carta o in camera', () => {
  assert(P.includes('name="robots" content="noindex, nofollow"'), 'ci si arriva solo dal QR');
  for (const l of ['it', 'en', 'de', 'fr']) assert(m.includes(`  ${l}: { benvenuto:`), `lingua ${l}`);
  assert(m.includes("const T_ID = P.get('t') || '', K = P.get('k') || '';") && m.includes("chiama('ospite-menu')"), 'tavolo e firma dal QR');
  assert(m.includes('class="quadro"') && m.includes('const icona = (nome) =>'), 'i quadratoni con l icona');
  assert(m.includes("modo: 'carta'") && m.includes('location.href = j.url;'), 'la carta va da Stripe');
  assert(m.includes("modo: 'camera', tessera:") && m.includes("camera: $('camera').value"), 'in camera con tessera e numero di camera');
  assert(m.includes("chiama('ospite-stato'") && m.includes('setInterval'), 'dopo Stripe la pagina aspetta la conferma');
  assert(m.includes("'BarcodeDetector' in window") && m.includes('window.isSecureContext'), 'la tessera si inquadra dove si puo');
  assert(!/x-hotel-key|HOTEL_KEY|8989|8990/.test(P), 'niente chiavi nella pagina');
});
