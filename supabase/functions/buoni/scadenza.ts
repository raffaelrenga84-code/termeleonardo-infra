/* ============================================================
   scadenza.ts — quando scade un buono, e perche' a volte piu' tardi.

   Un buono vale dodici mesi. Ma l'hotel chiude da fine novembre a meta'
   febbraio, e un buono che scade dentro quella finestra e' un buono che il
   cliente NON PUO' usare: non per una regola, perche' l'albergo e' chiuso.

   Allora si sposta — ma non "di due mesi", che era la prima idea e falliva
   proprio dove serviva (30 novembre + 2 mesi = 30 gennaio, ancora chiuso).
   Si sposta a UNA DATA CERTAMENTE USABILE: un mese dopo la riapertura. Il
   calcolo non dipende da quanto manca alla scadenza, quindi due clienti che
   comprano a un giorno di distanza non si ritrovano con proroghe diverse.

   Le date della chiusura NON stanno qui: cambiano ogni stagione e le sa la
   reception. Arrivano dalla tabella stagione_chiusura. Se per una stagione
   mancano, non si proroga niente — meglio un promemoria mancato che una
   proroga inventata su date sbagliate.
   ============================================================ */

export type Stagione = { chiusura: string; riapertura: string };

export type Scadenza = {
  /** la data che vale, l'unica che va scritta grande sul foglio */
  scade_il: string;
  /** i dodici mesi pieni: serve a scrivere «sarebbe scaduto il...» */
  scade_il_base: string;
  prorogato: boolean;
};

const gg = (d: Date) => d.toISOString().slice(0, 10);

/* Date scivola in silenzio: 2028-02-29 + 1 anno diventa 2029-03-01, e
   2027-01-31 + 1 mese diventa 2027-03-03. Su una scadenza sono giorni
   regalati o tolti a caso. Si costruisce la data a mano e, se il giorno
   e' straripato nel mese dopo, si torna all'ultimo giorno del mese giusto. */
function sposta(d: Date, anni: number, mesi: number): Date {
  const a = d.getUTCFullYear() + anni;
  const m = d.getUTCMonth() + mesi;
  const giorno = d.getUTCDate();
  const fine = new Date(Date.UTC(a, m + 1, 0)).getUTCDate();  // ultimo giorno del mese
  return new Date(Date.UTC(a, m, Math.min(giorno, fine), 12));
}

/* Esportata: la riusa scadenzaCrea (acquista.ts) per validare la data che
   l'operatore scrive a mano in back office, prima che arrivi a Postgres.
   Una sola copia del controllo "e' una data vera, andata e ritorno" — due
   copie divergono, ed e' gia' successo in questo progetto. */
export function data(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(s + 'T12:00:00Z');
  return isNaN(d.getTime()) || gg(d) !== s ? null : d;
}

export function calcolaScadenza(acquisto: Date, stagioni: Stagione[]): Scadenza {
  const base = sposta(acquisto, 1, 0);
  const naturale = gg(base);

  /* Due stagioni non dovrebbero accavallarsi, ma le inserisce a mano la
     reception, e una riga duplicata o corretta senza cancellare la vecchia
     e' l'errore piu' facile da fare di fretta. Se piu' stagioni contengono
     la stessa scadenza naturale, si tiene la riapertura piu' TARDIVA fra
     quelle che matchano, non la prima incontrata: le righe arrivano da una
     query senza order by, quindi "la prima" e' un dettaglio interno di
     Postgres, non una regola — con quella scelta stesso cliente e stessa
     data potrebbero ricevere proroghe diverse a seconda del giorno. Fra due
     proroghe possibili si dà sempre la piu' lunga: se i dati sono sporchi,
     a perderci non deve essere il cliente. */
  let riaperturaMigliore: Date | null = null;

  for (const s of stagioni) {
    const chiusura = data(s?.chiusura ?? '');
    const riapertura = data(s?.riapertura ?? '');
    /* una stagione mezza compilata non e' una stagione: si ignora, non si
       indovina il pezzo che manca */
    if (!chiusura || !riapertura || riapertura < chiusura) continue;
    /* estremi compresi: il giorno della riapertura non lascia margine per
       telefonare e trovare posto */
    if (base >= chiusura && base <= riapertura) {
      if (!riaperturaMigliore || riapertura > riaperturaMigliore) riaperturaMigliore = riapertura;
    }
  }

  if (riaperturaMigliore) {
    return { scade_il: gg(sposta(riaperturaMigliore, 0, 1)), scade_il_base: naturale, prorogato: true };
  }
  return { scade_il: naturale, scade_il_base: naturale, prorogato: false };
}
