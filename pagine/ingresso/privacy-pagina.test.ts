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
  assert(p.includes('rinfresco = setTimeout(() => elenco(true), 10000)'), 'ogni dieci secondi');
});

Deno.test('il rinfresco da solo non e un tocco: dopo un minuto l iPad torna alla schermata chiusa', () => {
  /* «poi resta con questa aperta» (la proprieta', 4 settembre 2026): il
     rinfresco ogni dieci secondi rimetteva il minuto e i nomi restavano li' */
  assert(p.includes("const vetro = (dentro, classe = '', conta = true)"), 'disegnare puo non contare come tocco');
  assert(p.includes('if (conta) tocco();'), 'il minuto riparte solo se conta');
  assert(p.includes("`, '', !daSolo);"), 'l elenco rinfrescato da solo non conta');
  assert(p.includes('$(\'pvAggiorna\').onclick = () => elenco();') && p.includes('$(\'pvComincia\').onclick = () => elenco();'), 'il dito invece conta');
});

Deno.test('l iPad della privacy non si chiama Day Spa', () => {
  assert(m.includes("SOLO_PRIVACY ? 'Privacy' : 'Day Spa'"), 'la scritta in alto');
  assert(m.includes("document.title = 'Privacy — Hotel Terme Leonardo'"), 'e il nome della scheda');
});

Deno.test('niente ?? e niente ?. : l iPad Air della reception ha iOS 12', () => {
  /* Safari 12 non li sa leggere e si ferma sulla prima riga che li porta:
     schermo bianco, senza dire niente (4 settembre 2026) */
  const senzaCommenti = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
  for (const [dove, testo] of [['la pagina', m], ['lettura.js', Deno.readTextFileSync(new URL('./lettura.js', import.meta.url))]] as const) {
    const pulito = senzaCommenti(testo);
    assert(!pulito.includes('??'), `${dove}: c e un ??`);
    assert(!/\?\.[A-Za-z_(\[]/.test(pulito), `${dove}: c e un ?.`);
  }
  assert(P.includes('@supports not (width: clamp(1px, 1vw, 2px))'), 'le misure in fisso per chi non conosce clamp');
  assert(P.includes('height:calc(100vh - 52px)'), 'e l altezza senza dvh');
});

Deno.test('la libreria dell accesso si carica solo allo sportello, non sul totem', () => {
  /* era un import in cima: se il CDN non rispondeva non partiva niente e
     lo schermo restava bianco («il secondo iPad mi da schermata bianca») */
  assert(!m.includes("import { createClient } from 'https://esm.sh"), 'non piu in cima');
  assert(m.includes('const lib = await import(LIBRERIA_ACCESSO);'), 'si carica quando serve');
  assert(m.indexOf('if (TOTEM) {') < m.indexOf('await import(LIBRERIA_ACCESSO)'), 'il totem non ci passa nemmeno');
});

Deno.test('se il modulo non parte, al posto del bianco c e scritto perche', () => {
  const rete = P.slice(P.indexOf('<main id="app">'), P.indexOf('<script type="module">'));
  assert(rete.includes("window.addEventListener('error'"), 'raccoglie l errore');
  assert(rete.includes('Questo schermo non riesce ad aprire la pagina'), 'e lo scrive in italiano');
  assert(rete.includes('location.reload()'), 'con un pulsante per riprovare');
  assert(!rete.includes('=>') && !rete.includes('const ') && !rete.includes('`'), 'in JavaScript vecchio: deve partire anche su un iPad del 2013');
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
  const i = p.indexOf('const chiusa = ');
  const c = p.slice(i, p.indexOf('const apriPer = '));
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
  const i = p.indexOf('const chiusa = ');
  const c = p.slice(i, p.indexOf('const apriPer = '));
  for (const s of ['Einwilligung', 'Consent to the processing', 'Consentement']) assert(c.includes(s), s);
  assert(c.includes('Start here') && c.includes('Bitte hier beginnen') && c.includes('Commencez ici'), 'anche il pulsante');
  const el = p.slice(p.indexOf('const elenco = '), p.indexOf('const modulo = '));
  assert(el.includes('Tippen Sie auf den Gast'), 'e l elenco della reception');
});

Deno.test('la testa del modulo: norma sotto il titolo, e il pulsante che manda in alto a destra', () => {
  const mo = p.slice(p.indexOf('const modulo = '));
  assert(mo.includes('class="pvTesta"') && mo.includes('T.norma'), 'titolo e norma');
  assert(mo.indexOf('id="pvConferma"') < mo.indexOf('class="pvCorpo"'), 'il pulsante sta in cima, non in fondo');
  assert(/\.pvFirmaScritta::before\{content/.test(P), 'la riga su cui firmare');
});

Deno.test('quante domande fa il modulo lo dice il server, non la pagina', () => {
  assert(m.includes('let SCELTE_PRIVACY'), 'non e una costante inchiodata');
  assert(p.includes('if (Array.isArray(j.scelte) && j.scelte.length) SCELTE_PRIVACY = j.scelte;'), 'arrivano con i testi');
  assert(!m.includes("'messaggi'"), 'la domanda sulle telefonate non c e piu: non arrivava al centralino');
});

Deno.test('in camera dormono in due: la tessera puo trovare piu persone e si sceglie chi firma', () => {
  assert(p.includes('const chiSei = ') && p.includes('const apriPer = '), 'la schermata «Chi è lei?»');
  assert(p.includes('j.attese || (j.attesa ? [j.attesa] : [])'), 'la tessera porta tutte le attese della camera');
  assert(p.includes('lista.length > 1) chiSei(lista)'), 'con due o piu si chiede');
  assert(p.includes('Chi è lei? · Who are you?'), 'nelle quattro lingue: qui non si sa ancora chi e');
});

Deno.test('totem e iPad si rinfrescano da soli, ma solo tornando a riposo', () => {
  assert(m.includes('const CARICATA_IL') && m.includes('AGGIORNA_DOPO_MS = 30 * 60 * 1000'), 'mezz ora');
  const r = m.slice(m.indexOf('const riposo = () => {'), m.indexOf('const riposo = () => {') + 600);
  assert(r.includes('location.reload()'), 'si ricarica al riposo, mai davanti a un ospite');
});

Deno.test('a chi non ha lasciato l email la si chiede sul modulo, senza obbligare', () => {
  assert(p.includes('st.haEmail = !!a.ha_email'), 'il server dice se ce l abbiamo gia, non qual e');
  assert(p.includes('st.haEmail ? \'\' :') && p.includes('id="pvEmail"'), 'il campo compare solo se manca');
  assert(p.includes("email: ($('pvEmail') || {}).value || null"), 'e parte con la firma');
  assert(p.includes('T.emailEtichetta'), 'nella lingua dell ospite');
});
