/* ============================================================
   chiusura.ts — la riga di chiusura stagionale per il prompt della chat.

   IL DIFETTO CHE QUESTO FILE CORREGGE. Un ospite chiede se il Day Spa del
   20 dicembre e' disponibile: l'hotel quel giorno e' CHIUSO (chiude il 29
   novembre, riapre a febbraio), ma l'assistente rispondeva con la frase
   dello strumento verifica_dayspa ("le prenotazioni non sono ancora
   aperte, controlli nei giorni precedenti") — uno strumento che in questo
   canale non esiste nemmeno. La causa profonda non era la frase sbagliata
   (quella si toglie in prompt.ts): era che nessuna data di chiusura
   arrivava mai nel prompt. La chiusura era NOMINATA nella Knowledge Base
   ma mai con una data, quindi il modello non aveva modo di sapere che il
   20 dicembre cade proprio li' dentro.

   Le date vengono dalla tabella stagione_chiusura — la stessa che legge
   gia' la funzione buoni (leggiStagioni() in buoni/index.ts). Lo schema
   (colonne chiusura/riapertura) e' copiato qui, non importato da li': sono
   due funzioni Supabase indipendenti, pubblicate separatamente, e un
   import fra le due cartelle romperebbe il bundle di una delle due appena
   l'altra cambiasse.

   SE LE DATE MANCANO O SONO SPORCHE NON SI INVENTA NIENTE: frasechiusura
   restituisce una stringa vuota e il prompt resta com'e' oggi. Un
   chatbot che non sa e' meglio di uno che afferma una chiusura sbagliata:
   una data di chiusura inventata fa perdere una prenotazione vera tanto
   quanto quella mancante che ha causato il difetto originale.
   ============================================================ */

export type Stagione = { chiusura: string; riapertura: string };

const MESI = [
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio',
  'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
];

/* Stessa validazione "andata e ritorno" di scadenza.ts (buoni/scadenza.ts):
   una stringa che non è AAAA-MM-GG, o che sembra una data ma non lo è
   davvero (es. "2026-11-31"), non deve scivolare silenziosamente su un
   altro giorno — va scartata. Copiata apposta, non importata: stesso
   motivo del commento in testa al file. */
function data(s: string | null | undefined): Date | null {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(s + 'T12:00:00Z');
  return isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s ? null : d;
}

function formattaData(d: Date): string {
  return `${d.getUTCDate()} ${MESI[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/* Solo il giorno conta, non l'ora: "oggi" arriva tipicamente da `new
   Date()`, con l'ora corrente dentro. Troncarlo a mezzanotte UTC prima di
   confrontarlo evita che l'ora del momento in cui gira la funzione decida
   se una chiusura che finisce "oggi" viene mostrata o no. */
function soloData(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/* Costruisce la riga (o le righe) di chiusura da mettere nel prompt.
   Pura: stessi argomenti, stesso risultato, sempre — è quello che la rende
   provabile senza database e senza modello.

   QUALI STAGIONI ENTRANO. Solo quelle non ancora del tutto passate
   (riapertura >= oggi): una chiusura finita mesi fa non aiuta il modello a
   rispondere su una data futura, lo confonderebbe soltanto. Le stagioni
   vecchie restano nella tabella (le rilegge anche calcolaScadenza dei
   buoni, per acquisti fatti negli anni passati) ma qui si escludono. E'
   per questo che la funzione vuole "oggi" come argomento e non lo legge da
   sola con `new Date()`: senza, non si potrebbe provare il filtro.

   QUANTE NE MOSTRA. Tutte quelle che passano il filtro, non solo la prima
   o la più vicina. La tabella può contenere più stagioni insieme — per
   esempio la reception inserisce già la stagione successiva mentre quella
   in corso non è ancora chiusa — e un ospite può chiedere di una data che
   cade nella seconda. Nasconderla sarebbe esattamente il difetto che
   questo file esiste per correggere: una chiusura vera che il modello non
   conosce. Si ordinano per data di chiusura crescente, così l'ordine non
   dipende da come sono arrivate le righe dal database. */
export function frasechiusura(stagioni: Stagione[], oggi: Date): string {
  const sogliaOggi = soloData(oggi);

  const valide = stagioni
    .map((s) => ({ chiusura: data(s?.chiusura), riapertura: data(s?.riapertura) }))
    /* stessa tolleranza di scadenza.ts: si scarta solo se manca una delle
       due date, o se la riapertura cade PRIMA della chiusura — non se sono
       uguali, che comunque qui non succede mai (vedi il filtro sopra). */
    .filter((s): s is { chiusura: Date; riapertura: Date } =>
      s.chiusura !== null && s.riapertura !== null && s.riapertura >= s.chiusura && s.riapertura >= sogliaOggi)
    .sort((a, b) => a.chiusura.getTime() - b.chiusura.getTime());

  if (!valide.length) return '';

  const righe = valide.map((s) =>
    `L'hotel è chiuso dal **${formattaData(s.chiusura)}** al **${formattaData(s.riapertura)}** compreso, e riapre il **${formattaData(s.riapertura)}**. ` +
    `Per qualunque data in questo periodo (Day Spa compreso) rispondi che l'hotel è chiuso e indica la data di riapertura. ` +
    `Non dire mai che le prenotazioni "non sono ancora aperte", e non dire "esaurito": in quei giorni l'hotel semplicemente non è operativo.`
  );

  return [
    '**CHIUSURA STAGIONALE — dalla tabella stagione_chiusura, non dal modello.**',
    ...righe,
  ].join('\n');
}
