/* ============================================================
   privacy.test.ts — «Privacy al totem» sulla prenotazione Fidra (v2.28.0).

   Al check-in la reception preme un pulsante: i dati della prenotazione
   (letti con extractor.js, sola lettura) vanno alla funzione privacy, in
   attesa della firma al totem o sull'iPad. Su Fidra non si clicca niente.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';

const S = Deno.readTextFileSync(new URL('./fidra-privacy.js', import.meta.url));
const M = JSON.parse(Deno.readTextFileSync(new URL('./manifest.json', import.meta.url))) as {
  version: string; content_scripts: { matches: string[]; js: string[] }[];
};

Deno.test('gira sulla prenotazione di Fidra, dopo l estrattore, e manda a privacy?a=attesa con la chiave hotel', () => {
  const cs = M.content_scripts.find((c) => c.js.includes('fidra-privacy.js'));
  assert(cs, 'il manifest carica fidra-privacy.js');
  assert(cs.matches.every((m) => m.includes('/reservations/')), cs.matches.join());
  assert(cs.js.indexOf('extractor.js') >= 0 && cs.js.indexOf('extractor.js') < cs.js.indexOf('fidra-privacy.js'), 'extractor.js prima: estrai() deve esistere');
  assert(S.includes('functions/v1/privacy') && S.includes("a=attesa") && S.includes("'x-hotel-key'") && S.includes("'hotelKey'"));
  assert(S.includes('estrai()'), 'i dati vengono dall estrattore');
});

Deno.test('sola lettura su Fidra: nessun clic, nessun submit, e si parla solo con la nostra funzione', () => {
  assert(!/\.click\(\)|\.submit\(\)|fidra\.cloud\/api/.test(S));
  const post = S.match(/fetch\((\w+),/g) ?? [];
  assert(post.length >= 1 && post.every((p) => /fetch\((MANDA|ANNULLA|STATO),/.test(p)), post.join(' '));
  assert(S.includes('const FUNZIONE = \'https://mvuiuwakuseockotlcnp.supabase.co/functions/v1/privacy\''));
});

Deno.test('due strade, e un modo per tornare indietro: iPad, totem, Annulla', () => {
  assert(S.includes("'ipad'") && S.includes("'totem'"), 'le due destinazioni');
  assert(S.includes('destinazione') && S.includes('a=annulla'), 'la destinazione parte col consenso, e si puo togliere');
  assert(S.includes('annulla.hidden = false'), 'Annulla compare dopo aver mandato');
  assert(S.includes('tre minuti'), 'si dice quanto resta in vista');
});

Deno.test('la lingua si sceglie prima di mandare: quella indovinata e solo il punto di partenza', () => {
  assert(S.includes('leoPrivacyLingua') && S.includes('createElement(\'select\')'), 'un menu nella barra');
  assert(S.includes('NOMI_LINGUA') && S.includes("de: 'Deutsch'"), 'le quattro lingue per nome');
  assert(S.includes('campoLingua.value || a.lingua'), 'quello che sceglie la reception vince');
});

Deno.test('manda camera, cognome, nome, email, lingua e prenotazione; la lingua si deduce dal paese', () => {
  for (const k of ['camera', 'cognome', 'nome', 'email', 'lingua', 'fidra_prenotazione']) assert(S.includes(k), k);
  assert(S.includes('paese') && S.includes('LINGUA_DEL_PREFISSO'), 'la lingua parte dal paese e, se non basta, dal prefisso del telefono');
  assert(!/\|\|\s*'en'/.test(S), 'chi non si capisce non e inglese per forza: si parte dall italiano e si cambia con un tocco');
});

Deno.test('il manifest e almeno alla 2.28.0, quella che ha portato la privacy', () => {
  const [a, b] = M.version.split('.').map(Number);
  assert(a > 2 || (a === 2 && b >= 28), M.version);
});

Deno.test('la lingua dal telefono solo se internazionale: «3316252791» e un cellulare italiano, non un francese (la proprieta, 5 settembre 2026)', () => {
  const blocco = S.match(/const LINGUA_DEL_PAESE[\s\S]*?function linguaDi\(d\) \{[\s\S]*?\n  \}/);
  assert(blocco, 'il blocco di linguaDi si ritaglia dal sorgente');
  const linguaDi = new Function('MESI', blocco[0] + '; return linguaDi;')({}) as (d: Record<string, unknown>) => string;
  assertEquals(linguaDi({ paese: '', telefono: '3316252791' }), 'it', 'un cellulare italiano senza prefisso');
  assertEquals(linguaDi({ paese: 'IT', telefono: '3316252791' }), 'it');
  assertEquals(linguaDi({ paese: '', telefono: '+33 6 12 34 56 78' }), 'fr', 'col + e francese');
  assertEquals(linguaDi({ paese: '', telefono: '0049 171 1234567' }), 'de', 'anche con 00');
  assertEquals(linguaDi({ paese: 'IT', telefono: '+49 171 1234567' }), 'de', 'il numero tedesco batte la residenza italiana');
  assertEquals(linguaDi({ paese: 'DE', telefono: '' }), 'de');
  assertEquals(linguaDi({ paese: '', telefono: '' }), 'it');
  /* la lunghezza: senza «+», un prefisso estero vale solo con almeno nove cifre dopo */
  assertEquals(linguaDi({ paese: '', telefono: '33612345678' }), 'fr', '33 + nove cifre: francese anche senza il +');
  assertEquals(linguaDi({ paese: '', telefono: '491711234567' }), 'de', '49 + dieci cifre');
  assertEquals(linguaDi({ paese: '', telefono: '393331234567' }), 'it', '39 + dieci cifre');
  assertEquals(linguaDi({ paese: '', telefono: '0498669270' }), 'it', 'un fisso italiano con lo 0');
  assertEquals(linguaDi({ paese: '', telefono: '3481234567' }), 'it', 'un cellulare 348');
  assertEquals(linguaDi({ paese: 'DE', telefono: '3316252791' }), 'de', 'il cellulare italiano non batte la residenza tedesca: e la stessa lingua di prima');
});

Deno.test('nella barra si vede chi ha gia firmato, e «Copia per la nota» mette negli appunti la riga da incollare in Fidra', () => {
  assert(S.includes("const STATO = FUNZIONE + '?a=stato';") && S.includes('async function mostraStato(barra, esito)'), 'lo stato dalla nostra funzione');
  assert(S.includes("copia.textContent = 'Copia per la nota';") && S.includes('navigator.clipboard.writeText(firmati.map(rigaNota)'), 'la riga negli appunti');
  assert(S.includes('Privacy firmata il ${QUANDO(c.firmato_il)}'), 'la riga dice quando, dove, chi e le scelte');
});

Deno.test('accanto a ogni firma c e «Registra in Fidra»: apre privacy/create gia compilato, in una scheda nuova', () => {
  assert(S.includes("window.open('https://leonardo.fidra.cloud/privacy/create?leo=' + encodeURIComponent(c.id), '_blank')"), 'con il consenso nell indirizzo');
  assert(S.includes('reg.textContent = `Registra ${c.cognome} in Fidra`;'), 'un pulsante per firma');
});
