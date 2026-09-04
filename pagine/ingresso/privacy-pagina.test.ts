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

Deno.test('nome e camera non restano sullo schermo: un minuto senza tocchi e si chiude', () => {
  assert(m.includes('PRIVACY_RIPOSO_MS') && m.includes('60 * 1000'), 'sessanta secondi');
  assert(p.includes('const chiusa = ') && p.includes('SOLO_PRIVACY ? chiusa() : ') === false, 'la schermata chiusa esiste');
  assert(p.includes('if (SOLO_PRIVACY) chiusa(); else riposo();'), 'scaduto il tempo: iPad chiuso, totem al benvenuto');
  assert(p.includes('if (daElenco) chiusa();'), 'l iPad parte chiuso, non con l elenco dei nomi');
  const chiusa = p.slice(p.indexOf('const chiusa = '), p.indexOf('const chiusa = ') + 900);
  assert(!chiusa.includes('cognome') && !chiusa.includes('camera'), 'nella schermata chiusa non c e nessun nome');
});

Deno.test('l elenco dell iPad si rinfresca da solo, senza premere aggiorna', () => {
  assert(p.includes('rinfresco = setTimeout(elenco, 10000)'), 'ogni dieci secondi');
});

Deno.test('le scelte si vedono a colori, come nei moduli che gli ospiti conoscono', () => {
  assert(p.includes('sceltaSi') && p.includes('sceltaNo'), 'il riquadro cambia colore con la risposta');
  assert(p.includes('pvSegno') && p.includes('✓') && p.includes('✕'), 'un segno su ogni pulsante');
  assert(p.includes('pvNum'), 'le frasi sono numerate');
  assert(/\.pvScelta button\.si\{background:#2E7D5B/.test(P) && /\.pvScelta button\.no\{background:#8C2F28/.test(P), 'verde e rosso');
});

Deno.test('i quattro nomi delle lingue, non due lettere', () => {
  assert(p.includes("'Italiano'") && p.includes("'Deutsch'") && p.includes("'English'") && p.includes("'Français'"));
});

Deno.test('il modulo sta in una schermata sola: niente scorrimento per l ospite', () => {
  /* «non riusciamo a farci stare tutto senza che il cliente debba
     scrollare» (la proprieta', 4 settembre 2026) */
  /* l altezza la da il contenitore bloccato, non il riquadro */
  assert(/body\.privacyAperta main\{[^}]*height:calc\(100dvh/.test(P), 'l altezza e quella dello schermo');
  assert(/\.totemRiposo\.privacy\{[^}]*overflow:hidden/.test(P), 'la pagina non scorre');
  assert(/@media \(min-width:800px\)\{\.pvCorpo\{grid-template-columns/.test(P), 'su iPad orizzontale due colonne');
  assert(/\.pvFrasi\{[^}]*overflow:auto/.test(P), 'se proprio non entra, scorre solo la colonna delle frasi');
  assert(p.includes('class="pvCorpo"') && p.includes('class="pvFrasi"') && p.includes('class="pvLato"'), 'le due colonne nel markup');
  assert(/clamp\(/.test(P), 'le misure crescono e calano con lo schermo');
});

Deno.test('l iPad chiuso dice quanti aspettano, non chi: nessun nome finche non si tocca', () => {
  const c = p.slice(p.indexOf('const chiusa = '), p.indexOf('const tessera = '));
  assert(c.includes("chiamaPrivacy('?a=quante')"), 'chiede solo il numero');
  assert(!c.includes('cognome') && !c.includes('.camera'), 'nessun nome, nessuna camera');
  assert(c.includes('pvPallino') && c.includes('15000'), 'un pallino, ogni quindici secondi');
});

Deno.test('la firma resta sotto gli occhi: la pagina e alta quanto lo schermo e non scorre', () => {
  assert(p.includes("document.body.classList.add('privacyAperta')"), 'la pagina si blocca quando il modulo si apre');
  assert(t.includes("classList.remove('privacyAperta')"), 'e si sblocca tornando al riposo');
  assert(/body\.privacyAperta\{overflow:hidden/.test(P) && /body\.privacyAperta main\{[^}]*height:calc\(100dvh/.test(P));
  assert(/\.pvCorpo\{[^}]*grid-template-rows:minmax\(0,1fr\) auto/.test(P), 'in verticale a stringersi sono le frasi, non la firma');
  assert(p.includes('pvFirmaScritta'), 'la scritta «firmi qui» sta dentro il riquadro, non sopra');
});

Deno.test('le schermate d attesa parlano quattro lingue: li non si sa ancora chi arrivera', () => {
  const c = p.slice(p.indexOf('const chiusa = '), p.indexOf('const tessera = '));
  for (const s of ['Einwilligung', 'Consent to the processing', 'Consentement']) assert(c.includes(s), s);
  assert(c.includes('Start here') && c.includes('Bitte hier beginnen') && c.includes('Commencez ici'), 'anche il pulsante');
  const el = p.slice(p.indexOf('const elenco = '), p.indexOf('const modulo = '));
  assert(el.includes('Tippen Sie auf den Gast'), 'e l elenco della reception');
});
