/* ============================================================
   privacy.test.ts — «Privacy al totem» sulla prenotazione Fidra (v2.28.0).

   Al check-in la reception preme un pulsante: i dati della prenotazione
   (letti con extractor.js, sola lettura) vanno alla funzione privacy, in
   attesa della firma al totem o sull'iPad. Su Fidra non si clicca niente.
   ============================================================ */
import { assert } from 'jsr:@std/assert';

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
  assert(post.length >= 1 && post.every((p) => /fetch\((MANDA|ANNULLA),/.test(p)), post.join(' '));
  assert(S.includes('const FUNZIONE = \'https://mvuiuwakuseockotlcnp.supabase.co/functions/v1/privacy\''));
});

Deno.test('due strade, e un modo per tornare indietro: iPad, totem, Annulla', () => {
  assert(S.includes("'ipad'") && S.includes("'totem'"), 'le due destinazioni');
  assert(S.includes('destinazione') && S.includes('a=annulla'), 'la destinazione parte col consenso, e si puo togliere');
  assert(S.includes('annulla.hidden = false'), 'Annulla compare dopo aver mandato');
  assert(S.includes('tre minuti'), 'si dice quanto resta in vista');
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
