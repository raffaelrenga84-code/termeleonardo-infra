/* ordine.js — con quale ordine si propongono le categorie di camera.

   IL MOTORE LE RESTITUISCE NEL SUO ORDINE, che non e' quello con cui la
   reception le venderebbe. Chi cercava per due persone si trovava davanti
   le suite e le junior suite, e la Doppia e la Matrimoniale Queen — cioe'
   le due che quasi sempre vuole — piu' in basso, dopo mezza pagina di
   scorrimento.

   E LE ACCESSIBILI USCIVANO IN MEZZO ALLE ALTRE. Il resto della casa non
   fa cosi': il chatbot ha la regola scritta di non proporre una camera
   attrezzata a chi non ha dichiarato un'esigenza di accessibilita', e il
   listino interno le da' «solo su richiesta espressa». Qui vanno in fondo.
   La differenza e' voluta: una pagina di prenotazione non nasconde una
   disponibilita' che il motore ha restituito — chi la cerca la trova — ma
   non la mette davanti a chi non l'ha chiesta.

   FUORI DA QUESTI ELENCHI NON SI DECIDE NIENTE: si tiene l'ordine con cui
   le proposte arrivano dal motore. Un elenco che pretende di ordinare
   tutto invecchia male: basta una categoria nuova e finisce in un posto a
   caso senza che nessuno l'abbia deciso.

   Deciso con la proprieta' il 21 agosto 2026.
   Presidiato da ordine.test.ts. */

'use strict';

/** Le categorie da mettere davanti, per numero di adulti cercati.
 *  L'ordine dentro l'elenco e' l'ordine in cui escono. */
export const PRIMA_PER_ADULTI = new Map([
  /* una persona: la singola col parco, poi la Queen a uso doppia */
  [1, [3, 6]],
  /* due persone: la Queen, poi la Doppia */
  [2, [6, 5]],
]);

/** Le due attrezzate per esigenze di mobilita': in fondo, sempre, qualunque
 *  sia il numero di adulti — anche quando nessun elenco qui sopra si
 *  applica. */
export const IN_FONDO = [4, 8];

/** Riordina i gruppi di proposte. Non tocca l'array che riceve e non ne
 *  perde nessuno: quello che entra esce, in un altro ordine. */
export function ordinaGruppi(gruppi, adulti) {
  const davanti = PRIMA_PER_ADULTI.get(Number(adulti)) ?? [];
  /* [fascia, posto nella fascia]: 0 = messe davanti, 1 = ordine del
     motore, 2 = in fondo */
  const posto = (g) => {
    if (IN_FONDO.includes(g.camera_id)) return [2, 0];
    const i = davanti.indexOf(g.camera_id);
    return i >= 0 ? [0, i] : [1, 0];
  };
  return (gruppi ?? [])
    .map((g, i) => ({ g, i, p: posto(g) }))
    /* l'indice d'arrivo come ultimo criterio: a parita' di fascia l'ordine
       del motore resta quello, e il riordino e' stabile anche dove il
       motore di JavaScript non lo garantisse */
    .sort((a, b) => a.p[0] - b.p[0] || a.p[1] - b.p[1] || a.i - b.i)
    .map((x) => x.g);
}
