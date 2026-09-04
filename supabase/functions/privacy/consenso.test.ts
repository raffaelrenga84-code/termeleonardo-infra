/* ============================================================
   consenso.test.ts — il consenso privacy: testi nelle quattro lingue con
   versione, lettura dei corpi, email. Modulo puro.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';
import { emailConsensoOspite, emailConsensoReception, firmaBase64, leggiAttesa, leggiFirma, type PerEmail, SCELTE, testiConsenso, VERSIONE_TESTI } from './consenso.ts';

const PNG = 'data:image/png;base64,' + btoa('\x89PNG\r\n\x1a\n' + 'x'.repeat(40));
const campo = (t: unknown, k: string) => (t as Record<string, unknown>)[k];

Deno.test('le tre scelte, nell ordine del modulo; i testi hanno una versione e le stesse chiavi in quattro lingue', () => {
  assertEquals(SCELTE, ['conservazione', 'messaggi', 'marketing']);
  assert(/^\d{4}-\d{2}-\d{2}$/.test(VERSIONE_TESTI));
  const it = testiConsenso('it');
  for (const k of ['titolo', 'saluto', 'autorizzo', 'nonAutorizzo', 'informativa', 'leggi', 'revoca', 'firmaQui', 'cancella', 'conferma', 'grazie', 'grazieTesto', 'chiediNome', 'cognome', 'nome', 'avanti', 'passiTessera', 'tesseraIgnota', 'mancaFirma', 'mancaScelte', 'errore']) assert(typeof campo(it, k) === 'string' && (campo(it, k) as string).length > 0, `it.${k}`);
  for (const s of SCELTE) assert(it.scelte[s].length > 20, `it.scelte.${s}`);
  for (const l of ['en', 'de', 'fr']) {
    const t = testiConsenso(l);
    assertEquals(Object.keys(t).sort(), Object.keys(it).sort(), l);
    for (const s of SCELTE) assert(t.scelte[s] && t.scelte[s] !== it.scelte[s], `${l}.scelte.${s}`);
    assert(t.informativa.includes('termeleonardo.com/it/privacy') && t.informativa.includes('Teolo'), `${l}: l informativa dice dove si legge e chi e il titolare`);
  }
  assertEquals(testiConsenso('xx').grazie, it.grazie);
});

Deno.test('leggiAttesa: camera e cognome obbligatori, email pulita, lingua nota, date ISO o null', () => {
  const r = leggiAttesa({ camera: ' 320 ', cognome: ' Rossi ', nome: 'Mario', email: ' MARIO@EXAMPLE.COM ', lingua: 'de', fidra_prenotazione: '12345', arrivo: '2026-09-04', partenza: '2026-09-11', destinazione: 'totem' });
  assert(r.ok);
  assertEquals(r.valore, { camera: '320', cognome: 'Rossi', nome: 'Mario', email: 'mario@example.com', lingua: 'de', fidra_prenotazione: '12345', arrivo: '2026-09-04', partenza: '2026-09-11', destinazione: 'totem' });
  assertEquals(leggiAttesa({ cognome: 'Rossi' }).ok, false);
  assertEquals(leggiAttesa({ camera: '320' }).ok, false);
  const s = leggiAttesa({ camera: '320', cognome: 'Rossi', email: 'non-email', lingua: 'xx', arrivo: '4/9/2026', destinazione: 'boh' });
  assert(s.ok);
  assertEquals([s.valore.email, s.valore.lingua, s.valore.arrivo, s.valore.nome, s.valore.destinazione], [null, 'it', null, '', 'ipad']);
});

Deno.test('leggiFirma: tre risposte booleane tutte presenti, firma PNG piccola, versione, fonte; altrimenti errore', () => {
  const buono = { id: 'a1', scelte: { conservazione: true, messaggi: false, marketing: true }, firma: PNG, versione: VERSIONE_TESTI, fonte: 'totem', lingua: 'en' };
  const r = leggiFirma(buono);
  assert(r.ok);
  assertEquals(r.valore.scelte, { conservazione: true, messaggi: false, marketing: true });
  assertEquals(r.valore.fonte, 'totem');
  assertEquals(leggiFirma({ ...buono, scelte: { conservazione: true, messaggi: false } }).ok, false, 'manca una risposta');
  assertEquals(leggiFirma({ ...buono, scelte: { conservazione: 'si', messaggi: false, marketing: true } }).ok, false, 'non booleana');
  assertEquals(leggiFirma({ ...buono, firma: 'data:text/plain;base64,QUJD' }).ok, false, 'non un PNG');
  assertEquals(leggiFirma({ ...buono, firma: 'data:image/png;base64,' + 'A'.repeat(300 * 1024) }).ok, false, 'troppo grande');
  assertEquals(leggiFirma({ ...buono, fonte: 'web' }).ok, false, 'fonte ignota');
  const senzaId = leggiFirma({ ...buono, id: undefined, camera: '320', cognome: 'Rossi', nome: 'Mario' });
  assert(senzaId.ok && senzaId.valore.camera === '320' && senzaId.valore.id === null, 'senza consenso in attesa: camera e nome scritti a mano');
  assertEquals(leggiFirma({ ...buono, id: undefined }).ok, false, 'senza id servono camera e cognome');
});

Deno.test('firmaBase64 toglie il prefisso del data URL', () => {
  assertEquals(firmaBase64(PNG), PNG.slice('data:image/png;base64,'.length));
});

Deno.test('email alla reception in italiano con le tre scelte; all ospite nella sua lingua, con la revoca', () => {
  const c: PerEmail = { camera: '320', cognome: 'Rossi', nome: 'Mario', email: 'mario@example.com', lingua: 'en', scelte: { conservazione: true, messaggi: false, marketing: true }, firmatoIl: '2026-09-04T16:30:00Z', fonte: 'totem', versione: VERSIONE_TESTI };
  const r = emailConsensoReception(c);
  assertEquals(r.oggetto, 'Privacy firmata: camera 320 · Rossi Mario');
  assert(r.testo.includes('Conservazione: sì') && r.testo.includes('Messaggi: no') && r.testo.includes('Offerte: sì'), r.testo);
  assert(r.testo.includes('18:30') && r.testo.includes(VERSIONE_TESTI) && r.testo.includes('totem'));
  const o = emailConsensoOspite(c);
  assert(o.oggetto.toLowerCase().includes('privacy') && !o.testo.includes('Conservazione:'), 'all ospite parlano le frasi, non le etichette interne');
  assert(o.testo.includes(testiConsenso('en').scelte.conservazione) && o.testo.includes(testiConsenso('en').revoca));
  assert(!o.html.includes('<script'));
});
