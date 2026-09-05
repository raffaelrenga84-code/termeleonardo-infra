/* ============================================================
   privacy-abbina.test.ts — la privacy appena salvata si abbina all'ospite.

   Dopo «Salva» su privacy/create la scheda esisteva ma slegata dalla
   persona: elenco, riga, Abbina («troppo macchinoso», la proprieta', 5
   settembre 2026). Prove sul testo: lo script vive nel DOM di Fidra.
   ============================================================ */
import { assert } from 'jsr:@std/assert';

const S = Deno.readTextFileSync(new URL('./fidra-privacy-abbina.js', import.meta.url));
const C = Deno.readTextFileSync(new URL('./fidra-privacy-crea.js', import.meta.url));
const M = JSON.parse(Deno.readTextFileSync(new URL('./manifest.json', import.meta.url))) as {
  content_scripts: { matches: string[]; exclude_matches?: string[]; js: string[] }[];
};

Deno.test('gira sull elenco e sulle schede della privacy di Fidra, non sul modulo di creazione', () => {
  const cs = M.content_scripts.find((c) => c.js.includes('fidra-privacy-abbina.js'));
  assert(cs, 'il manifest carica fidra-privacy-abbina.js');
  assert(cs.matches.includes('https://leonardo.fidra.cloud/privacy/*') && cs.matches.includes('https://leonardo.fidra.cloud/privacy'), cs.matches.join());
  assert((cs.exclude_matches ?? []).includes('https://leonardo.fidra.cloud/privacy/create*'), 'privacy/create resta a fidra-privacy-crea.js');
});

Deno.test('il modulo di creazione lascia chi e l ospite e, quando Fidra dice di aver salvato, porta all elenco', () => {
  assert(C.includes("sessionStorage.setItem('leoAbbina', JSON.stringify({ leo: c.id, cognome: c.cognome || '', nome: c.nome || '', camera: c.camera || '', quando: Date.now() }))"), 'chi e');
  const a = C.slice(C.indexOf('function aspettaSalvato(radice)'), C.indexOf('/* ---------- la riga sopra il modulo ---------- */'));
  assert(a.includes('if (campi(radice).cognome) return;'), 'solo quando il modulo e sparito');
  assert(a.includes("if (!/succes|salvat/i.test(document.body.innerText || '')) return;"), 'e solo quando la pagina dice di aver salvato, con innerText (quello che si vede)');
  assert(a.includes("location.href = 'https://leonardo.fidra.cloud/privacy';"), 'all elenco');
});

Deno.test('nell elenco si apre la riga di quella persona ancora senza nominativo hotel', () => {
  const e = S.slice(S.indexOf('function elenco(ab)'), S.indexOf('/* ---------- la scheda'));
  assert(e.includes('norma(c[1]) === norma(ab.cognome) && norma(c[2]) === norma(ab.nome) && !norma(c[3])'), 'cognome, nome, quarta colonna vuota');
  assert(e.includes('location.href = apri.href;'), 'si apre');
});

Deno.test('nella scheda si preme Abbina da soli SOLO dopo il nostro Salva e SOLO con un suggerimento con lo stesso nome; altrimenti si suggerisce e basta', () => {
  const s = S.slice(S.indexOf('function scheda(ab)'), S.indexOf('/* ---------- avvio'));
  assert(s.includes('if (ab && trovati.length === 1) {') && s.includes('trovati[0].bottone.click();'), 'una persona sola con quel nome, dopo il nostro Salva');
  const clic = S.match(/\.click\(\)/g) ?? [];
  assert(clic.length === 1, 'un clic solo in tutto lo script');
  assert(s.includes("prema <strong>Abbina</strong> su quello giusto"), 'con due omonimi la scelta resta all operatore');
  assert(S.includes('const stessaPersona = (nominativo, cognome, nome)') && S.includes("n === norma(cognome + ' ' + nome) || n === norma(nome + ' ' + cognome)"), 'stesso nome in tutti e due gli ordini');
  assert(S.includes("Date.now() - (j.quando || 0) > 15 * 60 * 1000"), 'la memoria di chi e scade');
});
