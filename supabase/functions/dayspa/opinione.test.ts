/* ============================================================
   opinione.test.ts — l'opinione dell'ospite: lettura del corpo, email,
   destinatari. Modulo puro.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';
import { destinatariOpinione, emailOpinione, leggiOpinione, stelleTesto, TEMI } from './opinione.ts';

Deno.test('legge un corpo buono: stelle intere, temi noti senza doppioni, commento tagliato, tessera solo cifre', () => {
  const r = leggiOpinione({ lingua: 'de', stelle: '4', temi: ['camera', 'boh', 'camera', 'pulizia'], commento: '  Ottimo  ', tessera: '1000000014662' });
  assert(r.ok);
  assertEquals(r.valore, { lingua: 'de', stelle: 4, temi: ['camera', 'pulizia'], voti: {}, commento: 'Ottimo', tessera: '1000000014662' });
});

Deno.test('stelle fuori da 1-5 o non intere: errore; lingua ignota: italiano; commento vuoto: null; tessera con lettere: null', () => {
  assertEquals(leggiOpinione({ stelle: 0 }).ok, false);
  assertEquals(leggiOpinione({ stelle: 6 }).ok, false);
  assertEquals(leggiOpinione({ stelle: 3.5 }).ok, false);
  assertEquals(leggiOpinione({}).ok, false);
  const r = leggiOpinione({ lingua: 'xx', stelle: 5, temi: 'no', commento: '   ', tessera: '1796R' });
  assert(r.ok);
  assertEquals(r.valore, { lingua: 'it', stelle: 5, temi: [], voti: {}, commento: null, tessera: null });
  const lungo = leggiOpinione({ stelle: 2, commento: 'a'.repeat(600) });
  assert(lungo.ok && lungo.valore.commento!.length === 500);
});

Deno.test('i sette temi, nell ordine della schermata', () => {
  assertEquals(TEMI.map((t) => t.chiave), ['camera', 'cure', 'piscine', 'ristorante', 'personale', 'pulizia', 'prezzo']);
});

Deno.test('i voti per reparto: solo reparti noti, solo da 1 a 5, interi', () => {
  const r = leggiOpinione({ stelle: 4, voti: { camera: 5, cure: '3', boh: 4, prezzo: 0, personale: 5.5, pulizia: 9 } });
  assert(r.ok);
  assertEquals(r.valore.voti, { camera: 5, cure: 3 });
  const vuoto = leggiOpinione({ stelle: 4 });
  assert(vuoto.ok);
  assertEquals(vuoto.valore.voti, {});
});

Deno.test('l email: oggetto con le stelle e la camera o «anonima»; corpo con temi in italiano, commento, ora di Roma', () => {
  const e = emailOpinione({ lingua: 'en', stelle: 4, temi: ['cure', 'personale'], voti: { cure: 5, ristorante: 2 }, commento: 'Great staff', camera: '320', tesseraFallita: false, creatoIl: '2026-09-04T16:30:00Z', fonte: 'totem', prova: false });
  assertEquals(e.oggetto, 'Opinione dal totem: ★★★★☆ 4/5 · camera 320');
  assert(e.testo.includes('Cure termali') && e.testo.includes('Personale') && e.testo.includes('Great staff'));
  /* i reparti votati, dal peggiore al migliore: quello che serve leggere per primo */
  assert(e.testo.indexOf('Ristorante: ★★☆☆☆') < e.testo.indexOf('Cure termali: ★★★★★'), e.testo);
  assert(e.testo.includes('18:30') && e.testo.includes('inglese'), e.testo);
  assert(e.html.includes('Great staff') && !e.html.includes('<script'));
  const a = emailOpinione({ lingua: 'it', stelle: 2, temi: [], voti: {}, commento: null, camera: null, tesseraFallita: true, creatoIl: '2026-09-04T16:30:00Z', fonte: 'totem', prova: true });
  /* il prefisso [PROVA] lo mette inviaEmail, non il modulo: qui l'oggetto e nudo */
  assertEquals(a.oggetto, 'Opinione dal totem: ★★☆☆☆ 2/5 · anonima');
  assert(a.testo.includes('tessera non riconosciuta') && a.testo.includes('nessun commento') && a.testo.includes('prova'));
});

Deno.test('destinatari: sempre la direzione; la reception solo con 3 stelle o meno E la camera', () => {
  const d = 'direzione@x', r = 'reception@x';
  assertEquals(destinatariOpinione({ stelle: 5, camera: '320' }, d, r), [d]);
  assertEquals(destinatariOpinione({ stelle: 3, camera: null }, d, r), [d]);
  assertEquals(destinatariOpinione({ stelle: 3, camera: '320' }, d, r), [d, r]);
  assertEquals(destinatariOpinione({ stelle: 1, camera: '12' }, d, d), [d], 'stesso indirizzo: una volta sola');
});

Deno.test('le stelle come testo', () => {
  assertEquals(stelleTesto(1), '★☆☆☆☆');
  assertEquals(stelleTesto(5), '★★★★★');
});
