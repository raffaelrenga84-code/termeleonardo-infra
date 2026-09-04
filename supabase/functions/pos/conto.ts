/* ============================================================
   conto.ts — il prezzo di una riga e il totale di un conto.
   Tutto in centesimi; l'euro si scrive solo per mostrarlo.
   Modulo puro: lo prova conto.test.ts.
   ============================================================ */
type Articolo = { prezzo_cent: number; prezzo_libero: boolean };
type Scelta = {
  articolo: Articolo;
  variante?: { supplemento_cent: number } | null;
  prezzo_manuale_cent?: number | null;
};

/** Il prezzo applicato a una riga.
    - articolo a prezzo libero («Varie», «Vino fuori carta»): l'importo lo
      mette il cameriere, senza permessi; se manca, «prezzo richiesto»;
    - prezzo a mano su un articolo normale: solo con il permesso `prezzo`;
    - altrimenti listino piu' il supplemento della variante. */
export function prezzoRiga(s: Scelta, puoPrezzoManuale: boolean): number {
  const manuale = s.prezzo_manuale_cent;
  if (s.articolo.prezzo_libero) {
    if (manuale === undefined || manuale === null) throw new Error('prezzo richiesto');
    return manuale;
  }
  if (manuale !== undefined && manuale !== null) {
    if (!puoPrezzoManuale) throw new Error('prezzo a mano non permesso');
    return manuale;
  }
  return s.articolo.prezzo_cent + (s.variante?.supplemento_cent ?? 0);
}

/** Il totale: quantita' per prezzo applicato, le righe stornate non contano. */
export function totaleCent(righe: { quantita: number; prezzo_cent: number; stato: string }[]): number {
  return righe.filter((r) => r.stato !== 'stornata').reduce((t, r) => t + r.quantita * r.prezzo_cent, 0);
}

/** 6650 → «66,50 €», 123456 → «1.234,56 €». A mano: l'ICU italiano non mette il punto sotto le cinque cifre. */
export function euro(cent: number): string {
  const [intero, decimali] = (Math.abs(cent) / 100).toFixed(2).split('.');
  const conPunti = intero.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (cent < 0 ? '-' : '') + conPunti + ',' + decimali + ' €';
}
