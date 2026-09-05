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
  assert(!/\.submit\(\)|fidra\.cloud\/api/.test(S), 'niente submit');
  /* l'unico clic e' la scelta della lingua (ITA · DEU · ENG · FRA), che apre la
     pagina dei campi: Salva resta dell'operatore */
  const clic = S.match(/\.click\(\)/g) ?? [];
  assert(clic.length === 1 && /function scegliLingua\(lingua\) \{[\s\S]*?b\.click\(\);/.test(S), 'un clic solo, sulla lingua');
  assert(!/salva|conferma|submit/i.test((S.match(/function scegliLingua[\s\S]*?\n  \}/) ?? [''])[0]), 'la lingua, non il salvataggio');
  assert(S.includes("if ((campo.value || '').trim()) { saltati.push(nome + ' (gia scritto)'); return; }"), 'un campo gia scritto non si tocca');
  assert(S.includes('function scriviNativo(el, valore)') && S.includes("el.dispatchEvent(new Event('input', { bubbles: true }));"), 'col setter nativo, come il cliente nuovo');
  assert(S.includes('function disegnaFirma(radice, dataUrl)') && S.includes("radice.querySelector('canvas')"), 'la firma nel riquadro');
});

Deno.test('parla solo con la nostra funzione, con la chiave hotel: le firme del giorno e la firma di uno', () => {
  const post = S.match(/fetch\((\w+) \+/g) ?? [];
  assert(post.length === 3 && post.every((p) => /fetch\((STATO|FIRMA) \+/.test(p)), post.join(' '));
  assert(S.includes("const STATO = FUNZIONE + '?a=stato';") && S.includes("const FIRMA = FUNZIONE + '?a=firma-di';"));
  assert(S.includes("chrome.storage.local.get(['hotelKey'])") && S.includes("'x-hotel-key': hotelKey"));
});

Deno.test('i tre consensi di Fidra sono radio «Autorizzo / Non autorizzo» sotto tre domande: si riconoscono dalle parole e si scelgono coi nostri valori', () => {
  assert(S.includes("['messaggi', /messaggi e telefonate|") && S.includes("['conservazione', /conservazione delle mie generalit|") && S.includes("['marketing', /tariffe e sulle offerte|"), 'le tre domande');
  assert(S.includes('function radioDomanda(radice, parole)') && S.includes('domanda.compareDocumentPosition(r) & Node.DOCUMENT_POSITION_FOLLOWING'), 'il primo gruppo di radio dopo la domanda');
  assert(S.includes('function scegliRadio(r)') && S.includes("r.dispatchEvent(new Event('change', { bubbles: true }));"), 'si sceglie col change, senza clic');
  /* la domanda 1 nel nostro modulo non c'e' piu': «Autorizzo» da soli (la proprieta', 5 settembre 2026) */
  assert(S.includes('messaggi: c.messaggi === null || c.messaggi === undefined ? true : !!c.messaggi,'), 'messaggi: autorizzo se il nostro modulo non lo chiede');
});

Deno.test('aperto con ?leo=<consenso> dalla prenotazione, il modulo si compila da solo: meno lavoro alla reception', () => {
  assert(S.includes("const leo = leoScelto();") && S.includes('const c = await consensoDi(leo, hotelKey);'), 'il consenso dall indirizzo');
  assert(S.includes('Controlli l’abbinamento all’ospite e prema Salva.'), 'e dice cosa resta da fare');
  assert(S.includes("abbinamento:   campoConEtichetta(radice, /abbinamento/i)"), 'prova anche la ricerca dell ospite');
});

Deno.test('il consenso da compilare sopravvive al cambio di indirizzo della scelta della lingua', () => {
  assert(S.includes("sessionStorage.setItem('leoPrivacy', dalUrl)") && S.includes("sessionStorage.getItem('leoPrivacy')"), 'messo da parte nella scheda');
  assert(S.includes('const leo = leoScelto();'), 'e riletto quando compaiono i campi');
});

Deno.test('la firma si ridisegna come farebbe un dito: il blocco firma di Fidra la riconosce senza il punto a mano', () => {
  /* «la trovo gia' precompilata pero' non la riconosce: deve fare solo un
     punto dentro il campo firma e poi salvare» (la proprieta', 5 settembre 2026) */
  assert(S.includes('function ridisegnaConIlDito(canvas, img, offX, offY, scala)'), 'i tratti dall immagine');
  assert(S.includes("new PointerEvent('pointer' + tipo") && S.includes("new MouseEvent('mouse' + tipo"), 'pointer e mouse: il pad ascolta gli uni o gli altri');
  assert(S.includes("buttons: tipo.endsWith('up') ? 0 : 1") && S.includes('isPrimary: true'), 'come un dito vero: tasto premuto e puntatore primario');
  assert(S.includes('corse.length * 3 <= 4000'), 'un tetto agli eventi');
  assert(S.includes('ridisegnaConIlDito(canvas, img, offX, offY, w / img.width);'), 'dopo aver disegnato l immagine, con la stessa scala');
});
