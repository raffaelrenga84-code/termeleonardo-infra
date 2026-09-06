/* ============================================================
   filtri.js — la scelta rapida del menu dal QR: senza glutine,
   vegetariano, vegano, senza lattosio.

   «Metterei un filtro fuori da tutto: prodotti senza glutine, vegani e senza
   lattosio, cosi' fanno prima a scegliere; sono due o tre prodotti» e poi
   «conviene mettere una lista di quei prodotti fuori dai pulsanti: siccome
   sono pochi uno li vede subito senza andare in cerca» (la proprieta', 6
   settembre 2026). Quindi niente pulsanti: i piatti marcati stanno in una
   lista gia' aperta sopra le categorie del cibo, ognuno con le sue etichette.

   QUATTRO SPUNTE DELLA RECEPTION, NON DEDUZIONI. Le proprieta' vivono in
   pos_articolo (senza_glutine, vegetariano, vegano, senza_lattosio) e le
   mette la reception nel back office (POS · Menu). Dagli allergeni non si
   deduce: una bistecca non ha glutine, ma non e' un «prodotto senza glutine»
   del menu, e la carne non e' un allergene, quindi «vegano» non si legge da
   nessuna sigla. Gli allergeni scritti restano pero' un freno: una spunta
   «senza glutine» su un piatto con la sigla GL scritta non vince, perche' la
   sigla e' la dichiarazione di legge e la spunta un clic di troppo.

   Un vegano e' anche vegetariano. Puro: niente DOM, niente rete. Lo importa
   pagine/ordina/index.html e lo provano le prove in Deno.
   ============================================================ */
'use strict';

/** Le quattro etichette, nell'ordine in cui compaiono. */
export const FILTRI = ['glutine', 'vegetariano', 'vegano', 'lattosio'];

const SPUNTA = { glutine: 'senza_glutine', vegetariano: 'vegetariano', vegano: 'vegano', lattosio: 'senza_lattosio' };
const SIGLA = { glutine: 'GL', lattosio: 'LA' };

const haSigla = (a, s) => typeof a.allergeni === 'string' && a.allergeni.split('-').map((x) => x.trim().toUpperCase()).includes(s);

/** Vero se l'articolo porta quell'etichetta. */
export function passaFiltro(a, filtro) {
  if (!a) return false;
  if (filtro === 'vegetariano') return a.vegetariano === true || a.vegano === true;
  const campo = SPUNTA[filtro];
  if (!campo || a[campo] !== true) return false;
  const s = SIGLA[filtro];
  return !(s && haSigla(a, s));
}

/** Le etichette di un articolo, nell'ordine fisso: vuoto per i piatti normali. */
export function etichetteDi(a) {
  return FILTRI.filter((f) => passaFiltro(a, f));
}

/** I piatti della scelta rapida: quelli con almeno un'etichetta, nell'ordine del menu. */
export function sceltaRapida(articoli) {
  return (Array.isArray(articoli) ? articoli : []).filter((a) => etichetteDi(a).length > 0);
}

export const TESTI_FILTRI = {
  it: { titolo: 'Scelta rapida', glutine: 'Senza glutine', vegetariano: 'Vegetariano', vegano: 'Vegano', lattosio: 'Senza lattosio' },
  en: { titolo: 'Quick picks', glutine: 'Gluten-free', vegetariano: 'Vegetarian', vegano: 'Vegan', lattosio: 'Lactose-free' },
  de: { titolo: 'Schnellauswahl', glutine: 'Glutenfrei', vegetariano: 'Vegetarisch', vegano: 'Vegan', lattosio: 'Laktosefrei' },
  fr: { titolo: 'Choix rapide', glutine: 'Sans gluten', vegetariano: 'Végétarien', vegano: 'Végan', lattosio: 'Sans lactose' },
};

export const ICONE_FILTRI = { glutine: '🌾', vegetariano: '🥗', vegano: '🌱', lattosio: '🥛' };
