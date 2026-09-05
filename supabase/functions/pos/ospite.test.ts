/* ============================================================
   ospite.test.ts — l'ordine dal tavolo col QR: firma, righe, camera.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';
import { cameraCombacia, codiceTessera, dallHotel, firmaTavolo, ipDi, numeroOrdine, righeOrdine, tavoloFirmato } from './ospite.ts';

Deno.test('il QR porta una firma: senza quella giusta non si ordina su un tavolo', async () => {
  const f = await firmaTavolo('bistrot-t7', 'chiave-hotel');
  assertEquals(f.length, 16);
  assertEquals(await tavoloFirmato('bistrot-t7', f, 'chiave-hotel'), true);
  assertEquals(await tavoloFirmato('bistrot-t8', f, 'chiave-hotel'), false, 'un altro tavolo ha un altra firma');
  assertEquals(await tavoloFirmato('bistrot-t7', f, 'altra-chiave'), false);
  assertEquals(await tavoloFirmato('bistrot-t7', f.slice(0, 15), 'chiave-hotel'), false);
  assertEquals(await tavoloFirmato('bistrot-t7', f, undefined), false, 'senza chiave hotel niente');
  assertEquals(await tavoloFirmato('', f, 'chiave-hotel'), false);
});

const listino = [
  { id: 'A1', nome: 'Spritz', prezzo_cent: 600, categoria: 'C1', portata: 'bevande' },
  { id: 'A2', nome: 'Toast', prezzo_cent: 700, categoria: 'C2', portata: 'secondi' },
  { id: 'A3', nome: 'Fuori', prezzo_cent: 500, esaurito: true },
  { id: 'A4', nome: 'Libero', prezzo_cent: 0, prezzo_libero: true },
  { id: 'A5', nome: 'Spento', prezzo_cent: 300, attivo: false },
];

Deno.test('le righe si ricostruiscono dal listino: il telefono manda solo articolo, quantita e nota', () => {
  const r = righeOrdine([{ articolo: 'A1', quantita: 2, prezzo_cent: 1, nota: '  senza  ghiaccio ' }, { articolo: 'A2', quantita: '1' }], listino);
  assert(r.ok);
  assertEquals(r.righe, [
    { articolo: 'A1', nome: 'Spritz', quantita: 2, prezzo_cent: 600, nota: 'senza ghiaccio', portata: 'bevande' },
    { articolo: 'A2', nome: 'Toast', quantita: 1, prezzo_cent: 700, nota: null, portata: 'secondi' },
  ]);
  assertEquals(r.totale_cent, 1900);
});

Deno.test('quello che non si puo ordinare da soli si ferma con una frase chiara', () => {
  const errore = (x: unknown) => { const r = righeOrdine(x, listino); return r.ok ? null : r.errore; };
  assertEquals(errore([]), 'l ordine e vuoto');
  assertEquals(errore('x'), 'l ordine e vuoto');
  assertEquals(errore([{ articolo: 'A9', quantita: 1 }]), 'un articolo non e piu in listino');
  assertEquals(errore([{ articolo: 'A5', quantita: 1 }]), 'un articolo non e piu in listino');
  assertEquals(errore([{ articolo: 'A3', quantita: 1 }]), 'Fuori: esaurito');
  assertEquals(errore([{ articolo: 'A4', quantita: 1 }]), 'Libero: si ordina al cameriere');
  assertEquals(errore([{ articolo: 'A1', quantita: 0 }]), 'Spritz: quantita fra 1 e 20');
  assertEquals(errore([{ articolo: 'A1', quantita: 21 }]), 'Spritz: quantita fra 1 e 20');
  assertEquals(errore(Array.from({ length: 41 }, () => ({ articolo: 'A1', quantita: 1 }))), 'al massimo 40 righe');
  /* la nota si accorcia, non si rifiuta */
  const lunga = righeOrdine([{ articolo: 'A1', quantita: 1, nota: 'x'.repeat(500) }], listino);
  assert(lunga.ok && lunga.righe[0].nota!.length === 120);
});

Deno.test('la camera scritta deve combaciare con quella della tessera', () => {
  assertEquals(cameraCombacia('229', '229'), true);
  assertEquals(cameraCombacia(' 229 ', '229'), true);
  assertEquals(cameraCombacia('0229', '229'), true, 'uno zero davanti non e una camera diversa');
  assertEquals(cameraCombacia('228', '229'), false);
  assertEquals(cameraCombacia('', '229'), false);
  assertEquals(cameraCombacia('229', null), false, 'senza la camera di Fidra non si addebita');
});

Deno.test('il numero dell ordine e corto e senza lettere che si confondono', () => {
  const n = numeroOrdine(() => 0.999999);
  assertEquals(n.length, 7);
  assert(n.startsWith('Q'));
  for (const c of ['0', 'O', '1', 'I']) assert(!numeroOrdine().includes(c), c);
});

Deno.test('la tessera si scrive con le cifre stampate: il codice a barre lo ricostruisce il server', () => {
  /* «chiedi solo le cifre stampate sulla tessera» (la proprieta', 5 settembre
     2026). Il codice a barre e' un EAN-13: «1», zeri, il numero, la cifra
     di controllo. Tessera 1466 → 1000000014662, 1796 → 1000000017960 (viste
     dal vivo il 4 settembre). */
  assertEquals(codiceTessera('1466'), '1000000014662');
  assertEquals(codiceTessera('1796'), '1000000017960');
  assertEquals(codiceTessera(' 14 66 '), '1000000014662', 'spazi e altro si buttano');
  assertEquals(codiceTessera('1000000014662'), '1000000014662', 'il codice intero passa com e');
  assertEquals(codiceTessera('14662'), '1000000014662', 'anche le ultime cinque cifre del codice a barre');
  assertEquals(codiceTessera(''), null);
  assertEquals(codiceTessera('12'), null, 'meno di tre cifre non e una tessera');
});

Deno.test('l indirizzo di chi chiama: il primo della catena, e solo l hotel passa', () => {
  const testa = (v: string | null) => new Headers(v === null ? {} : { 'x-forwarded-for': v });
  assertEquals(ipDi(testa('46.234.202.29, 10.0.0.1')), '46.234.202.29');
  assertEquals(ipDi(testa(' 46.234.202.29 ')), '46.234.202.29');
  assertEquals(ipDi(testa(null)), '');
  assertEquals(dallHotel(testa('46.234.202.29'), '46.234.202.29'), true);
  assertEquals(dallHotel(testa('5.6.7.8'), '46.234.202.29'), false);
  assertEquals(dallHotel(testa('5.6.7.8'), undefined), true, 'senza IP dell hotel configurato non si blocca nessuno');
});

Deno.test('la rete dell hotel puo essere piu di un IP (reception e Wi-Fi ospiti), separati da virgola', () => {
  const testa = (ip: string) => new Headers({ 'x-forwarded-for': `${ip}, 10.0.0.1` });
  assertEquals(dallHotel(testa('46.234.202.29'), '46.234.202.29, 93.1.2.3'), true);
  assertEquals(dallHotel(testa('93.1.2.3'), '46.234.202.29, 93.1.2.3'), true);
  assertEquals(dallHotel(testa('5.6.7.8'), '46.234.202.29, 93.1.2.3'), false);
});

Deno.test('fuori orario non si ordina: l articolo chiuso adesso ferma l ordine con un messaggio chiaro', () => {
  const listino = [{ id: 'A1', nome: 'Cotoletta', prezzo_cent: 1400, fuori_orario: true }, { id: 'A2', nome: 'Acqua', prezzo_cent: 300 }];
  const r = righeOrdine([{ articolo: 'A2', quantita: 1 }, { articolo: 'A1', quantita: 1 }], listino);
  assertEquals(r.ok, false);
  assertEquals((r as { errore: string }).errore, 'Cotoletta: non a quest ora');
  assertEquals(righeOrdine([{ articolo: 'A2', quantita: 1 }], listino).ok, true);
});
