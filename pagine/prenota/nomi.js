/* nomi.js — i nomi delle tariffe e dei trattamenti, nella lingua giusta.

   IL DIFETTO CHE PRESIDIA, misurato il 21 agosto 2026 chiedendo alla
   nostra stessa funzione: IL MOTORE RISPONDE SEMPRE IN ITALIANO. Si chiede
   la disponibilita' in tedesco e tornano «Miglior Prezzo», «Soggiorno
   breve», «Mezza Pensione». La lingua che gli passiamo serve solo alle
   descrizioni delle camere, che sono nostre.

   Quindi un ospite tedesco leggeva righe meta' e meta':
     «Mezza Pensione · Frühstück und Abendbuffet»
   e una tariffa che si chiama «Miglior Prezzo», che non gli dice niente.

   IL SITO VECCHIO FA ESATTAMENTE QUESTO. Nella sua pagina di prenotazione
   c'e' un dizionario di traduzione lato pagina — e' li' che ho preso le
   parole tedesche: «Half Board» → «Halbpension», «Bed & Breakfast» →
   «Zimmer und Frühstück». Non sono una mia scelta di stile.

   QUELLO CHE NON SI CONOSCE NON SI TRADUCE. Una tariffa nuova, o
   stagionale, esce col suo nome italiano — che e' come usciva prima, per
   tutti. Inventare una traduzione di un nome commerciale che non abbiamo
   mai visto sarebbe peggio del nome originale.

   L'ITALIANO NON PASSA DI QUI: torna sempre il nome com'e' arrivato, che
   e' gia' la sua lingua.

   Presidiato da nomi.test.ts. */

'use strict';

/** I trattamenti, per come il motore li scrive. La chiave e' il nome
 *  ridotto a minuscole e spazi singoli. */
export const TRATTAMENTI = {
  'mezza pensione': {
    de: 'Halbpension',
    en: 'Half board',
    fr: 'Demi-pension',
  },
  'bed & breakfast': {
    de: 'Zimmer und Frühstück',
    en: 'Bed & breakfast',
    fr: 'Chambre et petit-déjeuner',
  },
};

/** Le tariffe. «Thermal Escape» non c'e' apposta: e' un nome di prodotto,
 *  uguale in tutte le lingue, come lo sono «Soggiorno Smart» e «Deluxe». */
export const TARIFFE = {
  'miglior prezzo': {
    de: 'Bestpreis',
    en: 'Best price',
    fr: 'Meilleur prix',
  },
  'soggiorno breve': {
    de: 'Kurzaufenthalt',
    en: 'Short stay',
    fr: 'Court séjour',
  },
};

function tradotto(tavola, nome, lingua) {
  const chiave = String(nome ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  const l = String(lingua ?? '').toLowerCase();
  const voce = Object.hasOwn(tavola, chiave) ? tavola[chiave] : null;
  if (!voce || !Object.hasOwn(voce, l)) return String(nome ?? '');
  return voce[l];
}

/** Il nome del trattamento nella lingua chiesta, o com'e' arrivato. */
export const nomeTrattamento = (nome, lingua) => tradotto(TRATTAMENTI, nome, lingua);

/** Il nome della tariffa nella lingua chiesta, o com'e' arrivato. */
export const nomeTariffa = (nome, lingua) => tradotto(TARIFFE, nome, lingua);
