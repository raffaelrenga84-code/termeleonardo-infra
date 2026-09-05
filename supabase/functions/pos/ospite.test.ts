/* ============================================================
   ospite.test.ts — l'ordine dal tavolo col QR: firma, righe, camera.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';
import { cameraCombacia, firmaTavolo, numeroOrdine, righeOrdine, tavoloFirmato } from './ospite.ts';

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
