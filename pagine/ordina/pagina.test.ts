/* ============================================================
   pagina.test.ts — l'ordine dal tavolo col QR, letto dal sorgente.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';

const P = Deno.readTextFileSync(new URL('./index.html', import.meta.url));
const m = (P.match(/<script type="module">([\s\S]*?)<\/script>/) ?? ['', ''])[1];

Deno.test('l ospite ordina in quattro lingue, coi quadratoni, e paga con carta o in camera', () => {
  assert(P.includes('name="robots" content="noindex, nofollow"'), 'ci si arriva solo dal QR');
  for (const l of ['it', 'en', 'de', 'fr']) assert(m.includes(`  ${l}: { dove:`) && m.includes(`benvenuto:`), `lingua ${l}`);
  assert(m.includes("const T_ID = P.get('t') || '', K = P.get('k') || '';") && m.includes("chiama('ospite-menu')"), 'tavolo e firma dal QR');
  assert(m.includes('class="quadro"') && m.includes('const icona = (nome) =>'), 'i quadratoni con l icona');
  assert(m.includes("modo: 'carta'") && m.includes('location.href = j.url;'), 'la carta va da Stripe');
  assert(m.includes("modo: 'camera', consegna: CAMERA || null, tessera:") && m.includes("camera: $('camera').value"), 'in camera con tessera e numero di camera');
  assert(m.includes("chiama('ospite-stato'") && m.includes('setInterval'), 'dopo Stripe la pagina aspetta la conferma');
  assert(m.includes("'BarcodeDetector' in window") && m.includes('window.isSecureContext'), 'la tessera si inquadra dove si puo');
  assert(!/x-hotel-key|HOTEL_KEY|8989|8990/.test(P), 'niente chiavi nella pagina');
});

Deno.test('senza QR il tavolo si sceglie a mano, da una griglia di numeri', () => {
  /* «puoi anche mettere il numero del tavolo a mano» (la proprieta', 5 settembre 2026) */
  assert(m.includes("const d = await chiama('ospite-tavoli');") && m.includes("VISTA = { nome: 'tavolo', dati: d, locale: null }"), 'senza t e k si chiede il tavolo');
  assert(m.includes('const schermataScegliTavolo = (d) =>') && m.includes('class="quadro numero"'), 'la griglia dei numeri');
  assert(m.includes("const vai = (x, extra = '') => location.replace(`${location.pathname}?t=${encodeURIComponent(x.id)}&k=${encodeURIComponent(x.k)}&l=${LINGUA}${extra}`);"), 'scelto il posto si riparte con l indirizzo firmato');
  for (const l of ['it', 'en', 'de', 'fr']) assert(m.includes(`qualeTavolo:`) && m.includes(`  ${l}: { dove:`), `la domanda in ${l}`);
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

Deno.test('«Dove e seduto?»: interno, esterno (con la terrazza), la Hall come posto unico, in camera col numero', () => {
  /* la proprieta', 5 settembre 2026: «prima dove sei seduto... nella hall i
     tavoli non hanno numerazione... un campo per il numero di camera» */
  for (const l of ['it', 'en', 'de', 'fr']) assert(m.includes(`  ${l}: { dove:`), `la domanda in ${l}`);
  assert(m.includes("tavoliDi(['esterno', 'terrazza'])"), 'esterno e terrazza insieme');
  assert(m.includes("if (b.dataset.posto === 'hall') return vai(hall);"), 'la Hall e un posto solo');
  assert(m.includes("vai(camera, `&camera=${encodeURIComponent(c)}`)"), 'in camera col numero');
  assert(m.includes("const CAMERA = (P.get('camera') || '')") && m.includes("consegna: CAMERA || null"), 'e la camera viaggia con l ordine');
  assert(m.includes("${esc(T().tesseraSpiega)}") && m.includes('placeholder="1466"'), 'la tessera: le cifre stampate');
});

Deno.test('i nomi per l ospite: nella sua lingua, con gli ingredienti e le sigle degli allergeni del menu stampato', () => {
  /* spec docs/superpowers/specs/2026-09-05-menu-ospiti-design.md */
  assert(m.includes('const nomeDi = (x) => (x.nomi && (x.nomi[LINGUA] || x.nomi.it)) || x.nome;'), 'la sua lingua, poi l italiano, poi il nome del POS');
  assert(m.includes('<b>${esc(nomeDi(a))}</b>') && m.includes('<b>${esc(nomeDi(c))}</b>') && m.includes('${esc(nomeDi(cat))}</h1>'), 'righe, quadratoni e titolo');
  assert(m.includes('class="desc"') && m.includes('class="allergeni"'), 'ingredienti sotto il nome, allergeni come sigle');
  for (const l of ['it', 'en', 'de', 'fr']) assert(m.includes(`  ${l}: 'Allerg`), `legenda ${l}`);
  assert(m.includes('const LEGENDA_ALLERGENI = {') && m.includes('LEGENDA_ALLERGENI[LINGUA]'), 'la legenda in fondo alla lista');
});

Deno.test('gli orari del menu: un articolo chiuso adesso si vede ma non si aggiunge, con il suo orario tradotto', () => {
  /* fase 2 della spec 2026-09-05-menu-ospiti-design.md */
  assert(m.includes('const ORARI_TESTI = {') && m.includes('const orarioTesto = (finestre) =>'), 'i testi e la resa delle finestre');
  for (const l of ['it', 'en', 'de', 'fr']) assert(m.includes(`  ${l}: { giorni: [`), `giorni ${l}`);
  assert(m.includes("a.disponibile === false ? 'chiusa' : ''") && m.includes('class="orario"'), 'la riga chiusa e l orario');
  assert(m.includes("${a.disponibile === false ? 'disabled' : ''} aria-label=\"+\""), 'il + non si preme');
  assert(m.includes('c.disponibile === false ?'), 'il quadratone della categoria chiusa dice quando apre');
  assert(m.includes('/rete Wi-Fi/i.test(s)') && m.includes('/a quest ora|fuori orario/i.test(s)'), 'gli errori tradotti');
});

Deno.test('prima «da mangiare» o «da bere», poi la categoria («per semplificare la scelta al cliente», la proprieta, 5 settembre 2026)', () => {
  assert(m.includes('const GRUPPI_TESTI = {') && m.includes('const gruppoDi = (c) =>'), 'i due gruppi, dalla stampante della categoria');
  assert(m.includes('data-gruppo="cibo"') && m.includes('data-gruppo="bere"'), 'i due quadratoni grandi');
  assert(m.includes("if (el.dataset.gruppo) { VISTA = { nome: 'categorie', gruppo: el.dataset.gruppo }; disegna(); return; }"), 'il tocco apre il gruppo');
  assert(m.includes("VISTA = cat.sotto ? { nome: 'articoli', categoria: cat.sotto } : { nome: 'categorie', gruppo: gruppoDi(cat) }; disegna();"), 'indietro torna al gruppo, non ai due quadratoni');
  for (const l of ['it', 'en', 'de', 'fr']) assert(m.includes(`  ${l}: { cibo: '`), `gruppo ${l}`);
});

Deno.test('senza QR e fuori dalla rete dell hotel la pagina spiega il QR e la Protezione IP, in quattro lingue', () => {
  /* «Si ordina dalla rete Wi-Fi dell hotel (IP 104.28.96.42)» su un iPhone
     che ERA sul Wi-Fi dell'hotel: iCloud Privato nasconde l'indirizzo (la
     proprieta', 6 settembre 2026). Il QR sul tavolo funziona comunque. */
  for (const parola of ['QR', 'Protezione IP']) assert(P.includes(parola), parola);
  const soloHotel = [...P.matchAll(/soloHotel: '([^']*(?:’[^']*)*)'/g)].map((m) => m[1]);
  assertEquals(soloHotel.length, 4, 'quattro lingue');
  for (const s of soloHotel) assert(/QR/.test(s), s);
});

Deno.test('la schermata «serve il QR» e una schermata vera: disegno, due passi, e la nota sulla Protezione IP solo a chi ce l ha', () => {
  assert(m.includes('function schermataQr(messaggio)'), 'una schermata, non un titolo nudo');
  assert(m.includes('DISEGNO_QR') && m.includes('<svg class="disegno"'), 'il disegno del QR, senza immagini da caricare');
  assert(m.includes('<ol><li>${esc(q.passo1)}</li><li>${esc(q.passo2)}</li></ol>'), 'i due passi');
  assert(m.includes("${/Protezione IP/i.test(s) ? `<div class=\"nota\">${esc(q.notaIp)}</div>` : ''}"), 'la nota solo quando il server ha riconosciuto il relay');
  assert(m.includes("if (!/rete Wi-Fi|QR/i.test(s)) { $('app').innerHTML = `<h1>${esc(traduci(s))}</h1>`; return; }"), 'gli altri errori restano come prima');
  const lingue = ['it', 'en', 'de', 'fr'];
  for (const l of lingue) assert(new RegExp('\\n  ' + l + ': \\{ titolo:').test(m), 'i testi in ' + l);
  for (const b of ['schermataQr(e.message)', 'schermataQr(e2.message)']) assert(m.includes(b), b);
});
