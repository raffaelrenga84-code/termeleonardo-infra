/* ============================================================
   filtri.js — la scelta rapida del menu dal QR: senza glutine, vegano,
   senza lattosio.

   «Metterei un filtro fuori da tutto: prodotti senza glutine, prodotti
   vegani e prodotti senza lattosio, cosi' fanno prima a scegliere; sono
   due o tre prodotti» (la proprieta', 6 settembre 2026).

   DUE FONTI DIVERSE, APPOSTA. Senza glutine e senza lattosio si leggono
   dagli allergeni del menu stampato (le sigle GL e LA, in pos_articolo
   .allergeni): sono l'informazione che l'hotel dichiara gia' per legge.
   Vegano NO: la carne non e' un allergene, e da «nessun allergene» non si
   deduce niente — serve la spunta `vegano` che la reception mette nel back
   office (POS · Menu). Un vegano dedotto sbagliato e' peggio di nessuno.

   CHI NON HA GLI ALLERGENI SCRITTI NON PASSA. `allergeni` a null vuol dire
   «non ancora compilato», non «nessun allergene»: un piatto senza sigle
   scritte non si promette a un celiaco. La stringa vuota invece e' stata
   scritta (il menu stampato dice: niente allergeni) e passa.

   Puro: niente DOM, niente rete. Lo importa pagine/ordina/index.html e
   lo provano le prove in Deno.
   ============================================================ */
'use strict';

/** I tre filtri, nell'ordine in cui compaiono. */
export const FILTRI = ['glutine', 'vegano', 'lattosio'];

const SIGLA = { glutine: 'GL', lattosio: 'LA' };

const sigle = (a) => (typeof a.allergeni === 'string' ? a.allergeni : null);

/** Vero se l'articolo entra nel filtro. */
export function passaFiltro(a, filtro) {
  if (!a) return false;
  if (filtro === 'vegano') return a.vegano === true;
  const s = SIGLA[filtro];
  if (!s) return false;
  const scritti = sigle(a);
  if (scritti === null) return false;
  return !scritti.split('-').map((x) => x.trim().toUpperCase()).includes(s);
}

/** I filtri che hanno almeno un articolo: gli altri non si mostrano. */
export function filtriDisponibili(articoli) {
  const lista = Array.isArray(articoli) ? articoli : [];
  return FILTRI.filter((f) => lista.some((a) => passaFiltro(a, f)));
}

export const TESTI_FILTRI = {
  it: { titolo: 'Scelta rapida', glutine: 'Senza glutine', vegano: 'Vegano', lattosio: 'Senza lattosio', nessuno: 'Nessun piatto in questa scelta.' },
  en: { titolo: 'Quick picks', glutine: 'Gluten-free', vegano: 'Vegan', lattosio: 'Lactose-free', nessuno: 'No dishes match this choice.' },
  de: { titolo: 'Schnellauswahl', glutine: 'Glutenfrei', vegano: 'Vegan', lattosio: 'Laktosefrei', nessuno: 'Keine Gerichte in dieser Auswahl.' },
  fr: { titolo: 'Choix rapide', glutine: 'Sans gluten', vegano: 'Végan', lattosio: 'Sans lactose', nessuno: 'Aucun plat pour ce choix.' },
};

export const ICONE_FILTRI = { glutine: '🌾', vegano: '🌱', lattosio: '🥛' };
