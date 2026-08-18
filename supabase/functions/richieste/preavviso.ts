/* ============================================================
   preavviso.ts — quanto prima si chiede un trattamento.

   Deciso dalla proprietà il 18 agosto 2026: le richieste di trattamenti
   vogliono 48 ore di preavviso. Vale per TUTTE, non solo per quelle fatte
   con un buono regalo.

   PERCHÉ NON STA IN tipi.ts, che è dove istintivamente si metterebbe.
   `?a=conferma` rivalida i dati con `validaDati()`: una regola messa là
   impedirebbe alla RECEPTION di confermare una richiesta per domani — che è
   un gesto legittimo e quotidiano, perché la reception può dire sì anche a
   chi ha chiesto tardi. La regola riguarda quello che un OSPITE può
   chiedere dal sito, non quello che è un dato valido.

   Per questo vive qui e la applica solo il percorso pubblico.

   DUE GIORNI E NON 48 ORE CONTATE. Una richiesta di trattamenti porta un
   GIORNO e una fascia (mattina/pomeriggio), non un'ora: 48 ore esatte non si
   possono misurare. Il giorno del servizio deve cadere almeno due giorni
   dopo oggi — che non è mai meno di 24 ore reali e nel caso peggiore è 48
   piene. È l'approssimazione onesta di una regola scritta in ore su un dato
   che ha solo i giorni.
   ============================================================ */

export const PREAVVISO_GIORNI = 2;

/* I tipi a cui la regola si applica. Il Day Spa NON c'è: la proprietà ha
   detto «tutte le richieste di trattamenti», e un ingresso alle piscine si
   chiede anche per domani — la disponibilità la dice già il ponte. */
export const TIPI_CON_PREAVVISO = ['trattamenti'];

function giornoUTC(s: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(s + 'T12:00:00Z');
  if (isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) return null;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

const GIORNO_MS = 86400000;

/** Il primo giorno che un ospite può chiedere, in ISO. Serve anche alla
 *  pagina, per non lasciargli scegliere una data che verrà respinta. */
export function primoGiornoUtile(oggi: Date): string {
  const base = Date.UTC(oggi.getUTCFullYear(), oggi.getUTCMonth(), oggi.getUTCDate());
  return new Date(base + PREAVVISO_GIORNI * GIORNO_MS).toISOString().slice(0, 10);
}

/** Se questo giorno rispetta il preavviso. Una data che non si legge torna
 *  `false`: non è questa funzione a spiegare perché una data è sbagliata —
 *  lo fa già `validaDati` — ma non deve nemmeno lasciarla passare. */
export function preavvisoSufficiente(giorno: unknown, oggi: Date): boolean {
  const g = giornoUTC(String(giorno ?? '').trim());
  if (g === null) return false;
  return g >= giornoUTC(primoGiornoUtile(oggi))!;
}

/** Se questa richiesta arriva con poco preavviso.
 *
 *  NON RIFIUTA, ed e' una decisione della proprieta' del 18 agosto 2026.
 *  Bloccare vorrebbe dire far rifiutare al modulo una richiesta che la
 *  RECEPTION accetterebbe — e questo sistema ripete ovunque che una
 *  richiesta non e' una prenotazione: e' la reception a decidere. Bloccando
 *  si perde la vendita E l'informazione, perche' chi viene respinto non ci
 *  dice niente.
 *
 *  Serve a due cose: avvisare l'ospite mentre sceglie la data, e far sapere
 *  alla reception che quella richiesta e' la piu' urgente della casella. */
export function pocoPreavviso(tipo: unknown, dati: Record<string, unknown> | null | undefined, oggi: Date): boolean {
  if (!TIPI_CON_PREAVVISO.includes(String(tipo ?? ''))) return false;
  return !preavvisoSufficiente((dati ?? {}).giorno, oggi);
}
