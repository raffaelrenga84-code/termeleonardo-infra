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

/** I PIANI CHE SONO OFFERTE: comprendono qualcosa oltre alla camera e al
 *  trattamento — un massaggio, dei green fee, un ciclo di cure.
 *
 *  Perche' l'elenco sta QUI e non in piani.js, che gia' sa quali
 *  comprendono un massaggio: piani.js si importa col percorso assoluto
 *  /prenota/piani.js, che nel browser e' l'unico che funziona e in una
 *  prova Deno non si risolve. Un modulo che dev'essere provato da solo non
 *  puo' dipenderne. La duplicazione e' voluta e presidiata: una prova
 *  pretende che ogni piano con un massaggio sia anche un'offerta. */
export const OFFERTE = [
  /soggiorno\s*smart|\bsmart\b/i,
  /thermal\s*escape|\bescape\b/i,
  /\bgolf\b/i,
  /dolce\s*vita/i,
];

/** Questa tariffa e' un'offerta? Quello che non si riconosce NON lo e':
 *  chiamare «offerta» un prezzo normale e' una promessa che la scheda
 *  poi non mantiene. */
export function eOfferta(tariffa) {
  const s = String(tariffa ?? '');
  return OFFERTE.some((r) => r.test(s));
}

/** Il nome CORTO di un'offerta, quando quello del motore ripete una
 *  parola che l'etichetta gia' porta. «Offerta Soggiorno Smart» dice
 *  «soggiorno» due volte; «Offerta Smart» si legge in mezzo secondo.
 *  Quello che non sta qui esce col nome che arriva. */
export const NOME_OFFERTA = new Map([
  ['soggiorno smart', 'Smart'],
]);

/** Come si dice «offerta» in ciascuna lingua, e DOVE si mette. Italiano e
 *  francese davanti, tedesco e inglese dopo — con lo SPAZIO e non col
 *  trattino, perche' i nomi sono di due parole e «Dolce Vita-Angebot»
 *  attacca il trattino alla seconda invece che al tutto. */
export const ETICHETTA_OFFERTA = {
  it: (n) => `Offerta ${n}`,
  fr: (n) => `Offre ${n}`,
  de: (n) => `${n} Angebot`,
  en: (n) => `${n} offer`,
};

/** Il nome della tariffa nella lingua chiesta, o com'e' arrivato — e con
 *  «Offerta» davanti quando comprende qualcosa in piu'. */
export function nomeTariffa(nome, lingua) {
  const base = tradotto(TARIFFE, nome, lingua);
  if (!eOfferta(nome)) return base;
  const chiave = String(nome ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  const corto = NOME_OFFERTA.get(chiave) ?? base;
  const l = String(lingua ?? '').toLowerCase();
  /* una lingua che non conosciamo non si inventa: esce il nome nudo */
  return Object.hasOwn(ETICHETTA_OFFERTA, l) ? ETICHETTA_OFFERTA[l](corto) : corto;
}
