/* ============================================================
   pagina.test.ts — l'ordine dal tavolo col QR, letto dal sorgente.
   ============================================================ */
import { assert } from 'jsr:@std/assert';

const P = Deno.readTextFileSync(new URL('./index.html', import.meta.url));
const m = (P.match(/<script type="module">([\s\S]*?)<\/script>/) ?? ['', ''])[1];

Deno.test('l ospite ordina in quattro lingue, coi quadratoni, e paga con carta o in camera', () => {
  assert(P.includes('name="robots" content="noindex, nofollow"'), 'ci si arriva solo dal QR');
  for (const l of ['it', 'en', 'de', 'fr']) assert(m.includes(`  ${l}: { qualeTavolo:`) && m.includes(`benvenuto:`), `lingua ${l}`);
  assert(m.includes("const T_ID = P.get('t') || '', K = P.get('k') || '';") && m.includes("chiama('ospite-menu')"), 'tavolo e firma dal QR');
  assert(m.includes('class="quadro"') && m.includes('const icona = (nome) =>'), 'i quadratoni con l icona');
  assert(m.includes("modo: 'carta'") && m.includes('location.href = j.url;'), 'la carta va da Stripe');
  assert(m.includes("modo: 'camera', tessera:") && m.includes("camera: $('camera').value"), 'in camera con tessera e numero di camera');
  assert(m.includes("chiama('ospite-stato'") && m.includes('setInterval'), 'dopo Stripe la pagina aspetta la conferma');
  assert(m.includes("'BarcodeDetector' in window") && m.includes('window.isSecureContext'), 'la tessera si inquadra dove si puo');
  assert(!/x-hotel-key|HOTEL_KEY|8989|8990/.test(P), 'niente chiavi nella pagina');
});

Deno.test('senza QR il tavolo si sceglie a mano, da una griglia di numeri', () => {
  /* «puoi anche mettere il numero del tavolo a mano» (la proprieta', 5 settembre 2026) */
  assert(m.includes("const d = await chiama('ospite-tavoli');") && m.includes("VISTA = { nome: 'tavolo', dati: d, locale: null }"), 'senza t e k si chiede il tavolo');
  assert(m.includes('const schermataScegliTavolo = (d) =>') && m.includes('class="quadro numero"'), 'la griglia dei numeri');
  assert(m.includes('location.replace(`${location.pathname}?t=${encodeURIComponent(b.dataset.tav)}&k=${encodeURIComponent(b.dataset.k)}'), 'scelto il tavolo si riparte con l indirizzo firmato');
  for (const l of ['it', 'en', 'de', 'fr']) assert(m.includes(`  ${l}: { qualeTavolo:`), `la domanda in ${l}`);
});

Deno.test('le note pronte anche per l ospite: bottoncini tradotti, parole italiane per la cucina', () => {
  /* «anche per i clienti che ordinano dai la possibilita di aggiungere le
     note su ogni articolo» (la proprieta', 5 settembre 2026) */
  assert(m.includes('const NOTE = {') && m.includes("'Con ghiaccio': ['With ice', 'Mit Eis', 'Avec glaçons']"), 'le traduzioni');
  assert(m.includes('const etichettaNota = (n) =>') && m.includes('const noteDi = (a) =>'), 'l etichetta nella lingua dell ospite, le note dalla categoria');
  assert(m.includes('data-chip-art=') && m.includes("if (el.dataset.chip) {"), 'i bottoncini si accendono e si spegnono');
  assert(m.includes("join(', ').slice(0, 120)"), 'e nella nota vanno le parole italiane, con la virgola');
  assert(m.includes('data-apri-nota=') && m.includes('data-nota='), 'la nota libera resta');
});
