/* calendario.js — il calendario a due tocchi delle pagine rivolte agli ospiti.

   PERCHE'. Su /prenota le date erano due campi nativi del telefono, arrivo
   e partenza separati: due pannelli diversi, il secondo che si apre su oggi,
   nessun conto delle notti, nessun segno dei giorni chiusi. «Poco intuitivo»
   (la proprieta', 3 settembre 2026). Qui: un calendario solo, primo tocco
   arrivo, secondo partenza, notti contate in cima, giorni chiusi in grigio.
   Sul telefono e' un foglio a tutto schermo, su computer un riquadro sotto
   il campo: stessa funzione, il vestito lo decide il CSS.

   Le regole sono funzioni pure, provate da calendario.test.ts con «oggi»
   passato dall'esterno. Il disegno (apriCalendario) sta in coda.

   NON IMPORTA NIENTE, di proposito: in una prova Deno «/comune/date.js» non
   si risolve, e un modulo che dev'essere provato da solo non puo'
   dipenderne. `notti` e' la stessa regola di nottiFra in date.js.

   Va importato con il PERCORSO ASSOLUTO `/comune/calendario.js`: un percorso
   relativo, sotto un indirizzo tradotto come /it/prenota, cerca
   /it/comune/... e la pagina resta bianca. */
'use strict';

export const TESTI = {
  it: {
    campo: 'Arrivo e partenza', scegli: 'Scelga le date',
    scegliArrivo: 'Scelga il giorno di arrivo', scegliPartenza: 'Ora il giorno di partenza',
    notti: (n) => n === 1 ? '1 notte' : `${n} notti`,
    conferma: 'Conferma', cancella: 'Cancella', chiusi: 'chiusi', chiudi: 'Chiudi',
    giorni: ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom'],
    mesiBrevi: ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'],
    mesiLunghi: ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'],
  },
  de: {
    campo: 'An- und Abreise', scegli: 'Daten wählen',
    scegliArrivo: 'Wählen Sie den Anreisetag', scegliPartenza: 'Jetzt den Abreisetag',
    notti: (n) => n === 1 ? '1 Nacht' : `${n} Nächte`,
    conferma: 'Bestätigen', cancella: 'Löschen', chiusi: 'geschlossen', chiudi: 'Schließen',
    giorni: ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'],
    mesiBrevi: ['Jan', 'Feb', 'März', 'Apr', 'Mai', 'Juni', 'Juli', 'Aug', 'Sept', 'Okt', 'Nov', 'Dez'],
    mesiLunghi: ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'],
  },
  en: {
    campo: 'Arrival and departure', scegli: 'Choose your dates',
    scegliArrivo: 'Choose your arrival day', scegliPartenza: 'Now the departure day',
    notti: (n) => n === 1 ? '1 night' : `${n} nights`,
    conferma: 'Confirm', cancella: 'Clear', chiusi: 'closed', chiudi: 'Close',
    giorni: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    mesiBrevi: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    mesiLunghi: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  },
  fr: {
    campo: 'Arrivée et départ', scegli: 'Choisissez vos dates',
    scegliArrivo: 'Choisissez le jour d’arrivée', scegliPartenza: 'Puis le jour de départ',
    notti: (n) => n === 1 ? '1 nuit' : `${n} nuits`,
    conferma: 'Confirmer', cancella: 'Effacer', chiusi: 'fermé', chiudi: 'Fermer',
    giorni: ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'],
    mesiBrevi: ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'],
    mesiLunghi: ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'],
  },
};

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const pezzi = (iso) => { const m = ISO.exec(String(iso ?? '')); return m ? { a: +m[1], m: +m[2], g: +m[3] } : null; };
/* mezzogiorno UTC: l'aritmetica dei giorni non inciampa nell'ora legale */
const data = (iso) => { const p = pezzi(iso); return p ? new Date(Date.UTC(p.a, p.m - 1, p.g, 12)) : null; };
const isoDi = (d) =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;

/** Le notti fra due date ISO; 0 se una manca. Stessa regola di nottiFra in /comune/date.js. */
export function notti(arrivo, partenza) {
  const a = data(arrivo), p = data(partenza);
  return a && p ? Math.round((p - a) / 86400000) : 0;
}

/** I mesi da quello di oggi in avanti; ogni giorno con la sua colonna (0 = lunedì). */
export function griglia(oggiISO, quantiMesi = 14) {
  const o = pezzi(oggiISO);
  if (!o) return [];
  const mesi = [];
  for (let k = 0; k < quantiMesi; k++) {
    const primo = new Date(Date.UTC(o.a, o.m - 1 + k, 1, 12));
    const anno = primo.getUTCFullYear(), mese = primo.getUTCMonth() + 1;
    const quanti = new Date(Date.UTC(anno, mese, 0, 12)).getUTCDate();
    const giorni = [];
    for (let g = 1; g <= quanti; g++) {
      const d = new Date(Date.UTC(anno, mese - 1, g, 12));
      giorni.push({ iso: isoDi(d), giorno: g, colonna: (d.getUTCDay() + 6) % 7 });
    }
    mesi.push({ anno, mese, giorni });
  }
  return mesi;
}

const chiuso = (iso, chiusure) => (chiusure || []).some((c) => iso >= c.chiusura && iso < c.riapertura);
/* almeno una notte chiusa fra arrivo e partenza: stessa regola di chiusuraCheCopre nel server */
const attraversa = (arrivo, partenza, chiusure) =>
  (chiusure || []).some((c) => arrivo < c.riapertura && partenza > c.chiusura);

/** Lo stato di un giorno: passato, chiuso, arrivo, partenza, dentro, libero. */
export function statoGiorno(iso, { oggi, arrivo = '', partenza = '', chiusure = [] }) {
  if (iso < oggi) return 'passato';
  if (chiuso(iso, chiusure)) return 'chiuso';
  if (arrivo && iso === arrivo) return 'arrivo';
  if (partenza && iso === partenza) return 'partenza';
  if (arrivo && partenza && iso > arrivo && iso < partenza) return 'dentro';
  return 'libero';
}

/** La macchina dei due tocchi. Un giorno passato o chiuso non si tocca; un
 *  tocco prima dell'arrivo, o con tutte e due le date gia' scelte, ricomincia;
 *  un intervallo che passa sopra una chiusura non si accetta. */
export function tocca(scelta, iso, { oggi, chiusure }) {
  const s = { arrivo: (scelta && scelta.arrivo) || '', partenza: (scelta && scelta.partenza) || '' };
  if (iso < oggi || chiuso(iso, chiusure)) return s;
  if (!s.arrivo || s.partenza) return { arrivo: iso, partenza: '' };
  if (iso <= s.arrivo) return { arrivo: iso, partenza: '' };
  if (attraversa(s.arrivo, iso, chiusure)) return { arrivo: iso, partenza: '' };
  return { arrivo: s.arrivo, partenza: iso };
}

const testi = (l) => TESTI[l] || TESTI.it;

/** «sab 13 feb», «Sa 13. Feb», «Sat 13 Feb», «sam 13 févr». */
export function giornoBreve(iso, lingua) {
  const d = data(iso);
  if (!d) return '';
  const t = testi(lingua), l = TESTI[lingua] ? lingua : 'it';
  return `${t.giorni[(d.getUTCDay() + 6) % 7]} ${d.getUTCDate()}${l === 'de' ? '.' : ''} ${t.mesiBrevi[d.getUTCMonth()]}`;
}

/** «sab 13 feb → mer 17 feb · 4 notti»; «sab 13 feb → …» con la sola partenza da scegliere; '' senza niente. */
export function riassunto(scelta, lingua) {
  const t = testi(lingua);
  if (!scelta || !scelta.arrivo) return '';
  if (!scelta.partenza) return `${giornoBreve(scelta.arrivo, lingua)} → …`;
  return `${giornoBreve(scelta.arrivo, lingua)} → ${giornoBreve(scelta.partenza, lingua)} · ${t.notti(notti(scelta.arrivo, scelta.partenza))}`;
}

/** Cosa manca ancora: il giorno di arrivo, quello di partenza, o niente. */
export function suggerimento(scelta, lingua) {
  const t = testi(lingua);
  if (!scelta || !scelta.arrivo) return t.scegliArrivo;
  if (!scelta.partenza) return t.scegliPartenza;
  return '';
}
