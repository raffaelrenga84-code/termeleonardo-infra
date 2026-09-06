/* ============================================================
   schermo.test.ts — i conti che lo schermo di cucina fa prima di disegnare.

   «Come riusciamo a fare un monitor per ordini al posto dei biglietti
   stampati?» (la proprieta', 6 settembre 2026). Qui dentro non c'e' DOM e
   non c'e' rete: solo il colore dell'attesa, l'ordine delle schede, il
   biglietto letto, le comande arrivate adesso (quelle che fanno suonare) e
   i tasti della tastiera, per chi lo schermo lo tocca poco.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';
import { colorePerAttesa, etichettaPortata, minutiDa, nuovi, ordina, resa, SOGLIE_MIN, tastoPer, TESTI, perColonne } from './schermo.js';

const T = (s: string) => new Date(s).getTime();

Deno.test('il colore dell attesa: fino a 4 minuti verde, da 5 giallo, da 12 rosso', () => {
  assertEquals(SOGLIE_MIN, { verde: 5, giallo: 12 }, 'le soglie sono quelle del piano: 5 e 12 minuti');
  assertEquals(colorePerAttesa(0), 'verde');
  assertEquals(colorePerAttesa(4), 'verde');
  assertEquals(colorePerAttesa(5), 'giallo', 'alla soglia il colore e gia cambiato');
  assertEquals(colorePerAttesa(11), 'giallo');
  assertEquals(colorePerAttesa(12), 'rosso');
  assertEquals(colorePerAttesa(120), 'rosso');
  assertEquals(colorePerAttesa(-3), 'verde', 'un orologio avanti non deve accendere il rosso');
});

Deno.test('i minuti di attesa: interi, mai negativi, con l adesso iniettato', () => {
  const nato = '2026-09-06T12:00:00.000Z';
  assertEquals(minutiDa(nato, T('2026-09-06T12:00:00Z')), 0);
  assertEquals(minutiDa(nato, T('2026-09-06T12:00:59Z')), 0, 'meno di un minuto e ancora zero');
  assertEquals(minutiDa(nato, T('2026-09-06T12:07:30Z')), 7, 'minuti compiuti, non arrotondati per eccesso');
  assertEquals(minutiDa(nato, T('2026-09-06T13:00:00Z')), 60);
  assertEquals(minutiDa(nato, T('2026-09-06T11:58:00Z')), 0, 'orologio della TV indietro: mai un numero negativo');
  assertEquals(minutiDa(nato, new Date('2026-09-06T12:03:00Z')), 3, 'anche una Date va bene');
  assertEquals(minutiDa(null, T('2026-09-06T12:00:00Z')), 0, 'senza data non si inventa un attesa');
  assertEquals(minutiDa('non una data', T('2026-09-06T12:00:00Z')), 0);
});

Deno.test('le schede in ordine di nascita, e a parita di istante per id', () => {
  const a = { id: 'b', creato_il: '2026-09-06T12:00:00Z' };
  const b = { id: 'a', creato_il: '2026-09-06T12:00:00Z' };
  const c = { id: 'c', creato_il: '2026-09-06T11:50:00Z' };
  assertEquals(ordina([a, b, c]).map((s: { id: string }) => s.id), ['c', 'a', 'b'], 'la piu vecchia in cima: si prepara prima');
  assertEquals([a, b, c].map((s) => s.id), ['b', 'a', 'c'], 'l elenco di partenza non si tocca');
  assertEquals(ordina([]), []);
  assertEquals(ordina(null), [], 'un giro senza biglietti non deve rompere la pagina');
});

const biglietto = {
  tipo: 'COMANDA',
  locale: 'Bistrot',
  tavolo: 'Tavolo 3',
  conto: 'Esterno',
  coperti: 2,
  portata: 'secondi',
  ora: '13:10',
  cameriere: 'Anna',
  righe: [{ quantita: 2, nome: 'Focaccia margherita', variante: 'senza origano', nota: 'ben cotta' }],
  noteVitto: 'Allergia noci',
  portareA: 'Ristorante',
  avviso: 'cucina chiusa: al bancone',
};

Deno.test('il biglietto letto: tavolo, portata, ora, righe con variante e nota, avvisi in cima', () => {
  const r = resa({ id: 'P1', stato: 'a_schermo', biglietto, testo: 'COMANDA  SECONDI\n' });
  assertEquals(r.tipo, 'COMANDA');
  assertEquals(r.tavolo, 'Tavolo 3');
  assertEquals(r.portata, 'secondi');
  assertEquals(r.ora, '13:10');
  assertEquals(r.cameriere, 'Anna');
  assertEquals(r.righe, [{ quantita: 2, nome: 'Focaccia margherita', variante: 'senza origano', nota: 'ben cotta' }]);
  assertEquals(r.avviso, 'cucina chiusa: al bancone');
  assertEquals(r.portareA, 'Ristorante');
  assertEquals(r.noteVitto, 'Allergia noci');
});

Deno.test('una riga senza variante ne nota le porta a null, e un tipo che non e COMANDA resta scritto', () => {
  const r = resa({ id: 'P2', biglietto: { ...biglietto, tipo: 'STORNO', righe: [{ quantita: 1, nome: 'Caffe' }] } });
  assertEquals(r.tipo, 'STORNO');
  assertEquals(r.righe, [{ quantita: 1, nome: 'Caffe', variante: null, nota: null }]);
  assertEquals(resa({ id: 'P2b', biglietto: { ...biglietto, righe: null } }).righe, [], 'un biglietto senza righe non e un errore');
});

Deno.test('un biglietto vecchio, senza oggetto: righe vuote e resta il testo stampato', () => {
  const v = resa({ id: 'P3', biglietto: null, testo: 'COMANDA  PRIMI\nTavolo 5\n' });
  assertEquals(v.righe, []);
  assertEquals(v.testo, 'COMANDA  PRIMI\nTavolo 5\n');
  assertEquals(v.tavolo, '', 'niente da inventare: la scheda mostrera il testo');
  assertEquals(v.tipo, '');
  assertEquals(resa({ id: 'P4' }).testo, '');
  assertEquals(resa(null).righe, []);
});

Deno.test('un biglietto arrivato come stringa JSON si legge lo stesso; se e rotto resta il testo', () => {
  const r = resa({ id: 'P5', biglietto: JSON.stringify(biglietto), testo: 'x' });
  assertEquals(r.tavolo, 'Tavolo 3', 'da SQLite il biglietto puo arrivare come stringa');
  assertEquals(r.righe.length, 1);
  const rotto = resa({ id: 'P6', biglietto: '{non json', testo: 'COMANDA  PRIMI' });
  assertEquals(rotto.righe, []);
  assertEquals(rotto.testo, 'COMANDA  PRIMI');
});

Deno.test('le comande nuove sono quelle che prima non c erano: solo per loro si suona', () => {
  assertEquals(nuovi(['a', 'b'], ['a', 'b']), [], 'stesso giro, nessun suono');
  assertEquals(nuovi(['a'], ['a', 'b']), ['b']);
  assertEquals(nuovi(['a', 'b'], ['b']), [], 'una tolta perche pronta non e una nuova');
  assertEquals(nuovi([], ['a', 'b']), ['a', 'b']);
  assertEquals(nuovi([{ id: 'a' }], [{ id: 'a' }, { id: 'c' }]), ['c'], 'anche con i biglietti interi');
  assertEquals(nuovi(null, null), []);
});

Deno.test('la tastiera: i numeri scelgono, p prende, Invio manda in tavola, Backspace riapre', () => {
  assertEquals(tastoPer('1', 3), { azione: 'scegli', indice: 0 });
  assertEquals(tastoPer('3', 3), { azione: 'scegli', indice: 2 });
  assertEquals(tastoPer('9', 9), { azione: 'scegli', indice: 8 });
  assertEquals(tastoPer('4', 3), null, 'oltre le schede che ci sono non si sceglie niente');
  assertEquals(tastoPer('1', 0), null, 'schermo vuoto: non c e nemmeno la prima');
  assertEquals(tastoPer('0', 9), null, 'lo zero non e una scheda');
  assertEquals(tastoPer('p', 3), { azione: 'presa' });
  assertEquals(tastoPer('P', 3), { azione: 'presa' });
  assertEquals(tastoPer('Enter', 3), { azione: 'pronta' });
  assertEquals(tastoPer('Backspace', 3), { azione: 'riapri' });
  assertEquals(tastoPer('Backspace', 0), { azione: 'riapri' }, 'l ultima pronta si riapre anche a schermo vuoto');
  assertEquals(tastoPer('x', 3), null);
  assertEquals(tastoPer('', 3), null);
  assertEquals(tastoPer(null, 3), null);
});

Deno.test('i testi della pagina ci sono tutti, e sono in italiano', () => {
  assertEquals(
    Object.keys(TESTI).sort(),
    ['cloud', 'daFare', 'inLavoro', 'inizia', 'pc', 'presa', 'pronta', 'riapri', 'senzaRete', 'ultime', 'vuoto'],
  );
  assertEquals(TESTI.inizia, 'Tocca per iniziare');
  assertEquals(TESTI.vuoto, 'Nessuna comanda in attesa');
  assertEquals(TESTI.presa, 'In preparazione');
  assertEquals(TESTI.pronta, 'Pronto');
  assertEquals(TESTI.riapri, 'Riapri');
  assertEquals(TESTI.pc, 'PC del Bistrot');
  assertEquals(TESTI.cloud, 'cloud');
  assertEquals(TESTI.senzaRete, 'senza rete');
  assertEquals(TESTI.ultime, 'Ultime pronte');
  for (const t of Object.values(TESTI)) assert(typeof t === 'string' && t.length > 0);
});

Deno.test('due colonne: a sinistra le comande da fare, a destra quelle in preparazione, ciascuna nel suo ordine', () => {
  /* «buoni nuovi tutti a sinistra, in preparazione tutti a destra» (la proprieta', 6 settembre 2026) */
  const a = { id: 'a', presa_il: null }, b = { id: 'b', presa_il: '2026-09-06T10:00:00Z' }, c = { id: 'c' }, d = { id: 'd', presa_il: '2026-09-06T10:01:00Z' };
  const col = perColonne([a, b, c, d]);
  assertEquals(col.nuove.map((s) => s.id), ['a', 'c']);
  assertEquals(col.inPrep.map((s) => s.id), ['b', 'd']);
  assertEquals(perColonne(null), { nuove: [], inPrep: [] });
  assertEquals([TESTI.daFare, TESTI.inLavoro], ['Da fare', 'In preparazione']);
});

Deno.test('portate semplici sulla scheda: «tutto» non si scrive, «segue» diventa Segue', () => {
  assertEquals(etichettaPortata('tutto'), '');
  assertEquals(etichettaPortata('segue'), 'Segue');
  assertEquals(etichettaPortata('primi'), 'primi');
  assertEquals(etichettaPortata(null), '');
  assertEquals(resa({ biglietto: { tipo: 'COMANDA', tavolo: 'Tavolo 4', portata: 'tutto', righe: [] } }).portata, '');
  assertEquals(resa({ biglietto: { tipo: 'VAI', tavolo: 'Tavolo 4', portata: 'segue', righe: [] } }).portata, 'Segue');
});
