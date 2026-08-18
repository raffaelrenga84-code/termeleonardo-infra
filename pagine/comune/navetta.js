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

  /* L'ORA DELLA CORSA, che non sempre e' quella scritta nel campo.
     In PARTENZA il campo contiene l'ora del VOLO — e' quella che l'ospite
     conosce — e la navetta parte tre ore prima. La fascia oraria e il
     preavviso si misurano sulla CORSA, non sul volo. */
  const corsa = oraDellaCorsa(dati);
  if (!corsa) return null;
  /* senza un'ora la fascia non si puo' giudicare: non si nega per un dato
     che l'ospite non ha ancora scritto */
  if (corsa.ora && (corsa.ora < DALLE || corsa.ora > ALLE)) return null;

  const partenza = momento(dati.quando, corsa.ora);
  if (!partenza) return null;
  /* un ritiro il giorno prima e' un giorno indietro anche per il preavviso */
  if (corsa.giornoPrima) partenza.setDate(partenza.getDate() - 1);
  if (partenza.getTime() - adesso.getTime() < PREAVVISO_ORE * 3600 * 1000) return null;

  return { nota: pax >= 3 ? 'stessoPrezzo' : 'costaMeno' };
}

/* LA FASCIA ORARIA. Il servizio collettivo va dalle 8:00 alle 20:00,
   estremi compresi (confermato dalla proprieta' il 18 agosto 2026).

   Vale sulla CORSA. Siccome per le partenze la corsa parte tre ore prima
   del volo, di fatto restano i voli fra le 11:00 e le 23:00: un volo alle
   6 del mattino vorrebbe un ritiro alle 3 di notte, e un volo all'una di
   notte un ritiro alle 22:00 del giorno prima — fuori tutti e due.

   Senza questa regola il modulo li avrebbe offerti lo stesso: un impegno
   che il servizio non puo' mantenere, preso in automatico e scoperto solo
   dalla reception, a richiesta gia' inviata. */
export const DALLE = '08:00';
export const ALLE = '20:00';

function oraDellaCorsa(dati) {
  if (dati.verso === 'partenza') return ritiroPerVolo(dati.ora);
  const s = String(dati.ora ?? '').trim();
  return /^\d{1,2}:\d{2}$/.test(s)
    ? { ora: s.padStart(5, '0'), giornoPrima: false }
    /* senza l'ora si giudica sull'inizio del giorno: vedi `momento()` */
    : { ora: '', giornoPrima: false };
}

/* LE TRE ORE PRIMA DEL VOLO.

   Il servizio collettivo dall'hotel all'aeroporto parte tre ore prima
   dell'ora del volo: e' una navetta che raccoglie piu' ospiti e fa fermate,
   non un taxi che va dritto.

   Il modulo, per le partenze, chiede «l'ora a cui vuole essere preso in
   hotel». Ma un ospite conosce l'ORA DEL VOLO, non quella del ritiro: il
   conto lo dovrebbe fare lui, e se sbaglia perde l'aereo. Lo facciamo noi.

   `giornoPrima` non e' un dettaglio: un volo all'una di notte fa scattare il
   ritiro alle 22:00 del GIORNO PRIMA. Senza dirlo, l'ospite legge «22:00» e
   aspetta la sera sbagliata. */
export const ORE_PRIMA_DEL_VOLO = 3;

export function ritiroPerVolo(oraVolo) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(oraVolo ?? '').trim());
  if (!m) return null;
  const o = Number(m[1]), min = Number(m[2]);
  if (o > 23 || min > 59) return null;

  const minuti = o * 60 + min - ORE_PRIMA_DEL_VOLO * 60;
  const giornoPrima = minuti < 0;
  const dentro = ((minuti % 1440) + 1440) % 1440;
  const due = (n) => String(n).padStart(2, '0');
  return { ora: `${due(Math.floor(dentro / 60))}:${due(dentro % 60)}`, giornoPrima };
}

/* IL RITORNO E' UNA SECONDA CORSA, NEL VERSO OPPOSTO.

   Chi arriva dall'aeroporto torna in aeroporto: il ritorno di un arrivo e'
   una partenza. Luogo, passeggeri e nome sono gli stessi; cambiano il
   giorno, l'ora e il verso.

   Serve perche' la navetta va giudicata sul ritorno per conto suo. Chi
   sceglie la condivisa per l'andata da' per scontato che valga anche al
   ritorno, ma un ritorno alle 22 in arrivo e' fuori fascia — e il modulo
   deve dirlo prima, non lasciarlo scoprire alla reception.

   Su atam.biz il ritorno e' una PRENOTAZIONE A PARTE, e vuole i suoi dati:
   il suo volo e il suo servizio, non solo giorno e ora. */
export function corsaDiRitorno(dati) {
  if (!dati || !dati.ritorno_quando) return null;
  return {
    luogo: dati.luogo,
    pax: dati.pax,
    quando: dati.ritorno_quando,
    ora: dati.ritorno_ora,
    verso: dati.verso === 'partenza' ? 'arrivo' : 'partenza',
    volo: dati.ritorno_volo || '',
  };
}
