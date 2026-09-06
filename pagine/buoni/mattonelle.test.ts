/* ============================================================
   mattonelle.test.ts — il back office a mattonelle (la proprieta', 7 settembre
   2026): la home, la barra con «Home», l'hash, e sul telefono le tabelle a
   schede con i tasti appiccicati.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';

const P = Deno.readTextFileSync(new URL('./index.html', import.meta.url));
const schede = [...(P.match(/const SCHEDE = \[[\s\S]*?\];/) ?? [''])[0].matchAll(/\['([a-zA-Z]+)',/g)].map((m) => m[1]);
const icone = (P.match(/const ICONE = \{([\s\S]*?)\};/) ?? ['', ''])[1];

Deno.test('ogni scheda ha la sua icona, e home non e una scheda', () => {
  assert(schede.length >= 17, `schede: ${schede.length}`);
  for (const s of schede) assert(new RegExp(`\\b${s}: '`).test(icone), `manca l icona di ${s}`);
  assert(!schede.includes('home'), 'home non sta in SCHEDE: e la schermata iniziale, non una funzione');
});

Deno.test('si entra sulla home; la pagina aperta sta nell hash e il tasto indietro torna', () => {
  assert(P.includes("VISTA = schedaDaUrl() || 'home';") && P.includes("VISTA = schedaDaUrl() || vistaDallHash() || 'home';"), 'all accesso e all avvio');
  assert(P.includes('function apri(vista, spingi = true)') && P.includes("history.pushState({ vista }, '', vista === 'home'"), 'apri scrive l hash');
  assert(P.includes("window.addEventListener('popstate'") && P.includes("VISTA = vistaDallHash() || 'home'; disegna();"), 'il tasto indietro rilegge l hash');
  assert(P.includes("if (spingi && !sportello())") && P.includes("if (!TOKEN || sportello()) return;"), 'lo sportello fa per conto suo');
});

Deno.test('la home: mattonelle per famiglia con data-scheda, la principale piu grande, il numero delle richieste', () => {
  assert(P.includes('function mattonelle(visibili)') && P.includes('class="mattonella ${v === principale ? \'principale\' : \'\'}" data-scheda="${v}"'), 'le mattonelle');
  assert(P.includes('const principale = schedaIniziale(EMAIL);'), 'la prima del ruolo e la principale');
  assert(P.includes("if (VISTA === 'home') {") && P.includes("document.querySelectorAll('.mattonella').forEach((b) => b.onclick = () => apri(b.dataset.scheda));"), 'si apre toccando');
  assert(P.includes("document.querySelectorAll('[data-scheda=\"richieste\"]')"), 'il numero va sulla mattonella e sulla pillola');
  assert(!P.includes('class="famiglie"') && !P.includes('class="schede"'), 'le due file di pulsanti non ci sono piu');
});

Deno.test('ogni pagina ha la barra con «Home», il titolo e le sorelle', () => {
  assert(P.includes('id="tornaHome"') && P.includes("$('tornaHome').onclick = () => apri('home');"), 'Home');
  assert(P.includes('<nav class="sorelle">') && P.includes('const sorelle = visibili.filter(([v]) => famigliaDi(v) === fam && v !== VISTA);'), 'le sorelle della stessa famiglia');
  assert(P.includes('.barra .sorelle{display:none;}'), 'sul telefono le sorelle spariscono');
});

Deno.test('sul telefono: tabelle a schede per tutte le viste, tasti appiccicati, campi a 16 px', () => {
  assert(P.includes('function tabelleInSchede(radice)') && P.includes("new MutationObserver(() => tabelleInSchede($('app'))).observe($('app'), { childList: true, subtree: true });"), 'l osservatore');
  assert(P.includes("c.setAttribute('data-eti', eti[i])") && P.includes("t.classList.add('aSchede')"), 'le etichette dalle intestazioni');
  assert(P.includes('@media (max-width:700px){'), 'la soglia');
  for (const regola of ['table.aSchede td[data-eti]::before{content:attr(data-eti)', 'table.aSchede tr[hidden]{display:none;}', 'button.azione:not(.sec):not(.mini):not(.mini-azione){position:sticky;bottom:10px', 'input,select,textarea{font-size:16px;}', '.barra{position:sticky;top:0;']) assert(P.includes(regola), regola);
  assertEquals((P.match(/table\.aSchede tr:first-child\{display:none;\}/g) ?? []).length, 1, 'l intestazione sparisce: le etichette sono accanto ai valori');
});
