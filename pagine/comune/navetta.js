/* Quando offrire la navetta condivisa, e cosa dirle.

   Vive qui e non dentro la pagina perche' e' una regola che si prova da sola,
   senza browser — e perche' e' fatta di numeri del listino, non di grafica.

   IL LISTINO COMANDA. Dalla pagina pubblica del sito:

       navetta condivisa   65 € (1)   95 € (2)   135 € (3)   — (4)
       taxi privato       135 €      135 €      135 €      135 €

   Prezzi a corsa, non a testa. Ne discendono tutti e tre i limiti qui sotto,
   e nessuno e' un'opinione:

   · A TRE PASSEGGERI LA NAVETTA COSTA COME IL PRIVATO. Il pulsante resta —
     non si nasconde un'opzione a chi ha diritto di vederla — ma la frase
     cambia: «costa meno» a tre persone e' falso, e costerebbe all'ospite la
     comodita' di un'auto sua in cambio di zero euro.
   · A QUATTRO la navetta non e' in listino, e il privato li porta tutti allo
     stesso prezzo: non compare.
   · SOLO VENEZIA AEROPORTO. Il modulo offre dodici destinazioni, la condivisa
     la vendiamo su una.
   · VENTIQUATTRO ORE. Il listino lo scrive sulla navetta e su nessun'altra
     riga.

   `adesso` si passa da fuori: una regola che legge l'orologio da sola non si
   puo' provare. */

/* I DUE SPAZI NON SONO UN REFUSO. E' il valore vero del modulo, e ha due
   spazi perche' deve combaciare parola per parola con l'elenco di atam.biz.
   Il confronto e' normalizzato lo stesso: una regola scritta con uno spazio
   solo non scatterebbe mai, e il difetto sarebbe muto — la navetta
   semplicemente non comparirebbe, e nessuno saprebbe perche'. */
export const META_NAVETTA = 'Venezia  aeroporto';

export const PAX_MASSIMO = 3;
export const PREAVVISO_ORE = 24;

const piatto = (s) => String(s ?? '').replace(/\s+/g, ' ').trim().toLowerCase();

/* Il momento della corsa. Senza l'ora si prende l'inizio del giorno, il
   momento piu' presto possibile: cosi' la navetta compare solo quando e'
   certo che ci sia, e non sparisce piu' quando l'ospite sceglie l'ora.
   Un'opzione che si ritira e' peggio di una che arriva tardi. */
function momento(quando, ora) {
  const g = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(quando || ''));
  if (!g) return null;
  const o = /^(\d{1,2}):(\d{2})$/.exec(String(ora || ''));
  return new Date(
    Number(g[1]), Number(g[2]) - 1, Number(g[3]),
    o ? Number(o[1]) : 0, o ? Number(o[2]) : 0,
  );
}

/* null = non si offre. Altrimenti { nota } dice QUALE frase mettere sotto il
   pulsante: la pagina ha le quattro lingue, questo modulo ha la verita'. */
export function navetta(dati, adesso) {
  if (!dati) return null;
  if (piatto(dati.luogo) !== piatto(META_NAVETTA)) return null;

  /* il campo parte da «2» ma l'ospite puo' svuotarlo: vuoto vale uno, non
     quattro — un campo lasciato in bianco non deve far sparire la navetta */
  const pax = Number(dati.pax) || 1;
  if (pax > PAX_MASSIMO) return null;

  const partenza = momento(dati.quando, dati.ora);
  if (!partenza) return null;
  if (partenza.getTime() - adesso.getTime() < PREAVVISO_ORE * 3600 * 1000) return null;

  return { nota: pax >= 3 ? 'stessoPrezzo' : 'costaMeno' };
}
