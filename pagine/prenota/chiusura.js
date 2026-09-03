/* chiusura.js — la chiusura invernale come la dice la pagina Prenota.

   PERCHE'. Chi cercava date dentro la chiusura leggeva «non risultano camere
   libere»: non era vero, eravamo chiusi, e non sapeva quando riapriamo. Le
   date della stagione vengono dal server (tabella stagione_chiusura, azione
   a=stagione della funzione richieste); qui stanno i testi nelle quattro
   lingue, gli orari dell'ufficio e le regole pure, provate da
   chiusura.test.ts. Deciso con la proprieta' il 3 settembre 2026. */
'use strict';

/** L'ufficio prenotazioni durante la chiusura: da quando, e quando. Non
 *  sta nella tabella, che dice solo chiusura e riapertura. */
export const UFFICIO = {
  dal: '2027-01-08',
  orari: {
    it: 'lunedì–venerdì 9–17',
    de: 'Montag–Freitag 9–17 Uhr',
    en: 'Monday–Friday 9am–5pm',
    fr: 'lundi–vendredi 9h–17h',
  },
};

const MESI = {
  it: ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'],
  de: ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  fr: ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'],
};

const pezzi = (iso) => {
  const m = String(iso ?? '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? { a: +m[1], m: +m[2], g: +m[3] } : null;
};

/** «29 novembre 2026», nella lingua; il tedesco vuole il punto dopo il giorno. */
export function dataEstesa(iso, lingua) {
  const p = pezzi(iso);
  if (!p) return String(iso ?? '');
  const l = MESI[lingua] ? lingua : 'it';
  return `${p.g}${l === 'de' ? '.' : ''} ${MESI[l][p.m - 1]} ${p.a}`;
}

const isoDa = (d) =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
const piuGiorni = (iso, n) => {
  const p = pezzi(iso);
  if (!p) return iso;
  return isoDa(new Date(Date.UTC(p.a, p.m - 1, p.g + n)));
};

/** Il giorno prima di una data ISO: l'ultimo giorno chiuso e' la vigilia della riapertura. */
export function giornoPrima(iso) { return piuGiorni(iso, -1); }

/** «Cerca dal 13 febbraio»: stesse notti, dalla riapertura. Almeno una. */
export function dateDallaRiapertura(riapertura, notti) {
  const n = Math.max(1, Number(notti) || 0);
  return { arrivo: riapertura, partenza: piuGiorni(riapertura, n) };
}

/** La stagione, se oggi ci siamo dentro: chiusura ≤ oggi < riapertura. */
export function stagioneInCorso(stagione, oggiISO) {
  if (!stagione || !stagione.chiusura || !stagione.riapertura) return null;
  return oggiISO >= stagione.chiusura && oggiISO < stagione.riapertura ? stagione : null;
}

export const TESTI = {
  it: {
    chiusi: (dal, ultimo, riapre) => `In quel periodo l'hotel è chiuso, dal ${dal} al ${ultimo}. Riapriamo il ${riapre}.`,
    cerca: (riapre) => `Cerca dal ${riapre}`,
    ora: (ultimo, ufficio) => `Siamo chiusi fino al ${ultimo}. Le prenotazioni per la nuova stagione sono aperte: ${ufficio}.`,
    ufficioDa: (da, orari) => `l'ufficio prenotazioni risponde dall'${da}, ${orari}`,
    ufficioOra: (orari) => `l'ufficio prenotazioni risponde ${orari}`,
  },
  de: {
    chiusi: (dal, ultimo, riapre) => `In diesem Zeitraum ist das Hotel geschlossen, vom ${dal} bis ${ultimo}. Wir öffnen am ${riapre} wieder.`,
    cerca: (riapre) => `Ab ${riapre} suchen`,
    ora: (ultimo, ufficio) => `Wir haben bis ${ultimo} geschlossen. Buchungen für die neue Saison sind möglich: ${ufficio}.`,
    ufficioDa: (da, orari) => `das Reservierungsbüro antwortet ab dem ${da}, ${orari}`,
    ufficioOra: (orari) => `das Reservierungsbüro antwortet ${orari}`,
  },
  en: {
    chiusi: (dal, ultimo, riapre) => `The hotel is closed in that period, from ${dal} to ${ultimo}. We reopen on ${riapre}.`,
    cerca: (riapre) => `Search from ${riapre}`,
    ora: (ultimo, ufficio) => `We are closed until ${ultimo}. Bookings for the new season are open: ${ufficio}.`,
    ufficioDa: (da, orari) => `the reservations office replies from ${da}, ${orari}`,
    ufficioOra: (orari) => `the reservations office replies ${orari}`,
  },
  fr: {
    chiusi: (dal, ultimo, riapre) => `L'hôtel est fermé à cette période, du ${dal} au ${ultimo}. Nous rouvrons le ${riapre}.`,
    cerca: (riapre) => `Chercher à partir du ${riapre}`,
    ora: (ultimo, ufficio) => `Nous sommes fermés jusqu'au ${ultimo}. Les réservations pour la nouvelle saison sont ouvertes : ${ufficio}.`,
    ufficioDa: (da, orari) => `le bureau des réservations répond à partir du ${da}, ${orari}`,
    ufficioOra: (orari) => `le bureau des réservations répond ${orari}`,
  },
};

const testi = (lingua) => TESTI[lingua] || TESTI.it;
const linguaNota = (lingua) => (TESTI[lingua] ? lingua : 'it');

/** La riga in cima alla pagina mentre siamo chiusi; '' quando siamo aperti. */
export function rigaChiusiOra(stagione, oggiISO, lingua) {
  const s = stagioneInCorso(stagione, oggiISO);
  if (!s) return '';
  const t = testi(lingua), l = linguaNota(lingua);
  const ufficio = oggiISO < UFFICIO.dal
    ? t.ufficioDa(dataEstesa(UFFICIO.dal, l), UFFICIO.orari[l])
    : t.ufficioOra(UFFICIO.orari[l]);
  return t.ora(dataEstesa(giornoPrima(s.riapertura), l), ufficio);
}

/** Il messaggio al posto di «nessuna camera», con le date della stagione toccata. */
export function messaggioChiuso(chiuso, lingua) {
  const t = testi(lingua), l = linguaNota(lingua);
  return t.chiusi(
    dataEstesa(chiuso.chiusura, l),
    dataEstesa(giornoPrima(chiuso.riapertura), l),
    dataEstesa(chiuso.riapertura, l),
  );
}
