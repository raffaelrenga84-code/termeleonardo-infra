/* ============================================================
   schermo.js — i conti dello schermo di cucina: colore dell'attesa,
   ordine delle schede, biglietto letto, comande nuove, tastiera.

   «Come riusciamo a fare un monitor per ordini al posto dei biglietti
   stampati?» (la proprieta', 6 settembre 2026). Il cuoco guarda uno
   schermo appeso e non ha le mani libere: deve capire in un colpo quale
   comanda aspetta da troppo (verde fino a 5 minuti, giallo fino a 12, poi
   rosso), leggere le righe da lontano e chiudere una comanda con un
   tocco o con un tasto della tastiera attaccata alla TV.

   Puro: niente DOM, niente rete. Lo importa pagine/cucina/index.html e lo
   provano le prove in Deno (schermo.test.ts), che l'orologio lo iniettano.
   ============================================================ */
'use strict';

/** Le due soglie dell'attesa, in minuti: sotto la prima e' verde, sotto la
    seconda gialla, da li' in su rossa. */
export const SOGLIE_MIN = { verde: 5, giallo: 12 };

/** Il colore di una scheda in base ai minuti che ha addosso. */
export function colorePerAttesa(minuti) {
  const m = Number(minuti);
  if (!Number.isFinite(m) || m < SOGLIE_MIN.verde) return 'verde';
  return m < SOGLIE_MIN.giallo ? 'giallo' : 'rosso';
}

/** I minuti compiuti da `iso` a `adesso` (numero di millisecondi o Date).
    Interi e mai negativi: l'orologio di una TV puo' essere indietro, e una
    comanda «-2 minuti» sullo schermo non vuol dire niente. Si arrotonda per
    difetto, cosi' «3′» sono tre minuti passati davvero. */
export function minutiDa(iso, adesso) {
  const nato = new Date(iso ?? '').getTime();
  const dato = adesso === undefined ? Date.now() : adesso;
  const ora = dato instanceof Date ? dato.getTime() : Number(dato);
  if (!Number.isFinite(nato) || !Number.isFinite(ora)) return 0;
  return Math.max(0, Math.floor((ora - nato) / 60000));
}

/** Le schede dalla piu' vecchia alla piu' nuova; a parita' di istante conta
    l'id, cosi' due comande dello stesso secondo non si scambiano di posto a
    ogni giro (i numeri della tastiera devono restare fermi). Torna un
    elenco nuovo: quello di partenza non si tocca. */
export function ordina(biglietti) {
  const q = (s) => new Date((s && s.creato_il) ?? '').getTime();
  return (Array.isArray(biglietti) ? biglietti.slice() : []).sort((a, b) => {
    const da = q(a), db = q(b);
    const na = Number.isFinite(da) ? da : 0, nb = Number.isFinite(db) ? db : 0;
    if (na !== nb) return na - nb;
    return String((a && a.id) ?? '').localeCompare(String((b && b.id) ?? ''));
  });
}

const soloTesto = (x) => (typeof x === 'string' ? x : '');

/** Il biglietto pronto da disegnare. Dalle righe vecchie (prima del monitor)
    arriva solo `testo`, il foglio gia' impaginato per la stampante: allora
    le righe sono vuote e la scheda mostra quel testo cosi' com'e'.
    Dal database locale il biglietto puo' arrivare come stringa JSON. */
export function resa(s) {
  const riga = s || {};
  let b = riga.biglietto;
  if (typeof b === 'string') {
    try { b = JSON.parse(b); } catch { b = null; }
  }
  if (!b || typeof b !== 'object') {
    return { tipo: '', tavolo: '', portata: '', ora: '', cameriere: '', righe: [], avviso: null, portareA: null, noteVitto: null, testo: soloTesto(riga.testo) };
  }
  const righe = (Array.isArray(b.righe) ? b.righe : []).map((r) => {
    const q = Number((r || {}).quantita);
    return {
      quantita: Number.isFinite(q) ? q : 1,
      nome: String((r || {}).nome ?? ''),
      variante: (r || {}).variante || null,
      nota: (r || {}).nota || null,
    };
  });
  return {
    tipo: String(b.tipo ?? ''),
    tavolo: String(b.tavolo ?? ''),
    portata: String(b.portata ?? ''),
    ora: String(b.ora ?? ''),
    cameriere: String(b.cameriere ?? ''),
    righe,
    avviso: b.avviso || null,
    portareA: b.portareA || null,
    noteVitto: b.noteVitto || null,
    testo: soloTesto(riga.testo),
  };
}

const idDi = (x) => (x && typeof x === 'object' ? String(x.id ?? '') : String(x ?? ''));

/** Gli id comparsi da un giro all'altro: per quelli lo schermo suona. Una
    comanda sparita (pronta) non e' una novita' e non fa rumore. */
export function nuovi(prima, dopo) {
  const c_era = new Set((Array.isArray(prima) ? prima : []).map(idDi));
  return (Array.isArray(dopo) ? dopo : []).map(idDi).filter((id) => id && !c_era.has(id));
}

/** Il tasto premuto, tradotto in un'azione. La tastiera attaccata alla TV
    costa niente e in cucina si usa con le mani unte meglio del vetro: i
    numeri scelgono la scheda (1 = la prima), «p» la prende in carico,
    Invio la manda in tavola, Backspace riapre l'ultima pronta. */
export function tastoPer(key, quante) {
  const k = String(key ?? '');
  if (/^[1-9]$/.test(k)) {
    const indice = Number(k) - 1;
    return indice < Number(quante || 0) ? { azione: 'scegli', indice } : null;
  }
  if (k === 'p' || k === 'P') return { azione: 'presa' };
  if (k === 'Enter') return { azione: 'pronta' };
  if (k === 'Backspace') return { azione: 'riapri' };
  return null;
}

/** Le scritte fisse dello schermo, tutte qui e tutte in italiano. */
/** Le due colonne, come i monitor dei fast food: a sinistra quello che
    arriva, a destra quello che si sta facendo («buoni nuovi tutti a
    sinistra, in preparazione tutti a destra», la proprieta', 6 settembre
    2026). L'ordine dato (per anzianita') resta dentro ogni colonna. */
export function perColonne(biglietti) {
  const lista = Array.isArray(biglietti) ? biglietti : [];
  return { nuove: lista.filter((s) => !s.presa_il), inPrep: lista.filter((s) => !!s.presa_il) };
}

export const TESTI = {
  daFare: 'Da fare', inLavoro: 'In preparazione',
  inizia: 'Tocca per iniziare',
  vuoto: 'Nessuna comanda in attesa',
  presa: 'In preparazione',
  pronta: 'Pronto',
  riapri: 'Riapri',
  pc: 'PC del Bistrot',
  cloud: 'cloud',
  senzaRete: 'senza rete',
  ultime: 'Ultime pronte',
};
