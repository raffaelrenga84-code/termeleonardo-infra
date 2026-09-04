/* ============================================================
   azioni.test.ts — la funzione privacy letta dal sorgente: chi puo' cosa.

   Il totem e l'iPad (x-totem-key + IP dell'hotel) leggono le attese e
   firmano; l'estensione (chiave hotel) mette in attesa; il back office
   (reception, amministrazione) legge, stampa, annulla; i testi sono
   pubblici. Il codice della tessera non si salva mai.
   ============================================================ */
import { assert } from 'jsr:@std/assert';

const S = Deno.readTextFileSync(new URL('./index.ts', import.meta.url));
const da = (m: string) => { const i = S.indexOf(m); assert(i >= 0, `manca «${m}»`); return i; };
const blocco = (azione: string) => {
  const i = da(`azione === '${azione}'`);
  const fine = S.indexOf("if (azione === '", i + 10);
  return S.slice(i, fine < 0 ? undefined : fine);
};

Deno.test('i testi sono pubblici e stanno prima di ogni cancello', () => {
  const i = da("azione === 'testi'");
  assert(i < da('eTotem(req)') && i < da('autorizzato(req)'));
  assert(blocco('testi').includes('testiConsenso(') && blocco('testi').includes('VERSIONE_TESTI'));
});

Deno.test('l estensione mette in attesa con la chiave hotel; il totem legge le attese e la tessera', () => {
  const a = blocco('attesa');
  assert(a.includes('chiaveHotel(req)') && a.includes('leggiAttesa(') && a.includes("'in_attesa'"));
  assert(blocco('attese').includes('if (!eTotem(req))'));
  /* nome e camera restano in vista tre minuti, poi l elenco li lascia andare */
  assert(S.includes('const MINUTI_ATTESA = 3') && blocco('attese').includes('daQuando()'), 'l attesa scade');
  assert(blocco('attese').includes("eq('destinazione', 'ipad')"), 'nell elenco solo quelli mandati all iPad');
  const q = blocco('quante');
  assert(q.includes('if (!eTotem(req))') && q.includes('head: true') && !q.includes('cognome'), 'il conteggio non porta nomi');
  const t = blocco('tessera');
  assert(t.includes('if (!eTotem(req))') && t.includes('[0-9]{4,20}') && t.includes('contoFidra('));
  assert(S.includes("Deno.env.get('FIDRA_TOTEM_KEY')") && S.includes('/api/bill-scanner/'));
});

Deno.test('la firma: solo totem e iPad, corpo letto dal modulo, email alla reception con la firma in allegato e all ospite', () => {
  const f = blocco('firma');
  for (const s of ['if (!eTotem(req))', 'leggiFirma(', 'emailConsensoReception(', 'emailConsensoOspite(', 'firmaBase64(', "'firma.png'", "'firmato'", 'email_inviata', 'indirizzo(req)']) assert(f.includes(s), s);
  assert(S.includes('attachments'), 'inviaEmail sa allegare');
  assert(!f.includes('tessera:'), 'il codice della tessera non entra nel consenso');
});

Deno.test('il back office: elenco, uno, annulla dopo autorizzato, per reception e amministrazione; l elenco non porta le firme', () => {
  const g = da('autorizzato(req)');
  for (const a of ['elenco', 'uno', 'annulla']) assert(da(`azione === '${a}'`) > g, `${a} dopo il cancello`);
  const dopo = S.slice(g);
  assert(dopo.includes("'reception'") && dopo.includes("'amministrazione'"));
  /* «a» e' il nome dell'azione: nessun filtro puo' chiamarsi cosi', o si
     ritrova «elenco» dove aspettava una data */
  assert(!/searchParams\.get\('a'\)(?!\s*\|\|\s*'')/.test(blocco('elenco')) || blocco('elenco').includes("get('fino')"), 'la seconda data si chiama fino');
  assert(blocco('elenco').includes("get('fino')"), 'la seconda data si chiama fino');
  const colonne = S.slice(da('const COLONNE_ELENCO'), S.indexOf('\n', da('const COLONNE_ELENCO')));
  assert(blocco('elenco').includes('COLONNE_ELENCO') && !/\bfirma\b/.test(colonne), 'l elenco non scarica le firme (firmato_il si, firma no)');
});

Deno.test('CORS con le intestazioni del totem e della chiave hotel; niente stampanti fiscali', () => {
  assert(/x-totem-key/.test(S) && /x-hotel-key/.test(S));
  assert(!/8989|8990|192\.168\.0\.5[12]/.test(S));
});

Deno.test('una firma per persona, non per camera: il compagno di stanza resta in attesa', () => {
  const a = S.slice(S.indexOf("azione === 'attesa'"), S.indexOf("azione === 'attese'"));
  assert(a.includes(".eq('camera', a.camera).eq('cognome', a.cognome).eq('nome', a.nome)"), 'si annulla solo la stessa persona');
  const t = S.slice(S.indexOf("azione === 'tessera'"), S.indexOf("azione === 'firma'"));
  assert(t.includes('attese') && t.includes('limit(8)'), 'la tessera porta tutte le persone in attesa della camera');
});
