/* ============================================================
   ruoli.ts — chi può leggere le richieste, e quali.

   IL BUCO CHE CHIUDE. Fino al 18 agosto 2026 il cancello di questa
   funzione finiva così:

       const { data } = await db.auth.getUser(token);
       return !!data?.user;

   QUALUNQUE utente autenticato, senza guardare il dominio. E sul progetto
   la registrazione era aperta: registrarsi con un indirizzo qualsiasi,
   confermarlo, chiedere un token, e `?a=elenco` restituiva nome, email,
   telefono e dettagli di ogni ospite che avesse scritto dal sito.

   La funzione usa la chiave di servizio, quindi RLS non protegge nulla:
   questo file è l'unica difesa.

   `buoni` il controllo sul dominio ce l'aveva già. Questa no — la stessa
   protezione, in due funzioni, a due livelli diversi. Ed è sempre quella
   più debole a decidere quanto vale l'insieme.

   PERCHÉ È RICOPIATO da buoni/index.ts e non condiviso: `strumenti/
   pubblica.js` manda alla Management API soltanto i file della cartella
   della funzione, quindi `richieste/` non può importare da `buoni/`. Il
   deploy non può tenerle insieme; una prova sì.
   ============================================================ */

/* Gli stessi di buoni/index.ts. Si leggono dall'ambiente perché il giorno
   che l'hotel cambia dominio non si tocca il codice. */
export const DOMINI_AMMESSI = (Deno.env.get('DOMINI_AMMESSI') || 'termeleonardo.com,hldv.com')
  .split(',').map((d) => d.trim().toLowerCase()).filter(Boolean);

const piatto = (v: unknown) => String(v ?? '').trim().toLowerCase();

/** Il dominio dell'indirizzo è uno dei nostri.
 *
 *  Si confronta il dominio ESATTO, non «contiene»: `termeleonardo.com.evil.net`
 *  e `nontermeleonardo.com` contengono tutti e due la nostra stringa, e un
 *  controllo per sottostringa li farebbe entrare. */
export function dominioAmmesso(email: unknown): boolean {
  const e = piatto(email);
  const chiocciola = e.lastIndexOf('@');
  if (chiocciola < 1) return false;
  const dominio = e.slice(chiocciola + 1);
  return DOMINI_AMMESSI.includes(dominio);
}

export type Ruolo = 'reception' | 'spa' | 'amministrazione';

/* Un elenco chiuso, indirizzo per indirizzo, e non «tutti quelli del
   dominio».

   IL PRINCIPIO: un account nuovo NON si aggiunge da solo con pieni poteri.
   Chi crea `direzione@termeleonardo.com` domani non deve trovarsi in mano
   tutte le richieste degli ospiti perché nessuno ha pensato a lui. Chi
   resta fuori telefona, e lo si aggiunge in una riga.

   Non è un oggetto indicizzato ma una Map: una chiave come `toString`
   esiste su Object.prototype, e una lookup diretta ci cascherebbe
   restituendo la funzione ereditata invece di sparire — lo stesso difetto
   già pagato con i circoli del golf in tipi.ts. */
const RUOLI = new Map<string, Ruolo>([
  ['reception@termeleonardo.com', 'reception'],
  ['spa@termeleonardo.com', 'spa'],
  ['amministrazione@termeleonardo.com', 'amministrazione'],
]);

export function ruoloDi(email: unknown): Ruolo | null {
  const e = piatto(email);
  if (!dominioAmmesso(e)) return null;
  return RUOLI.get(e) ?? null;
}

/* Cosa vede ognuno.

   `spa` vede i trattamenti e il Day Spa: sono le richieste che gestisce.
   Transfer, green fee, maestro e soggiorni sono dati di ospiti che con la
   spa non c'entrano, e non deve leggerli.

   `amministrazione` per ora vede tutto, come oggi: la proprietà ha detto
   «tutto tranne le richieste che non gli interessano», e quali siano non lo
   sappiamo ancora. Restringere indovinando toglierebbe a qualcuno qualcosa
   che usa ogni giorno, e nessuno saprebbe perché. Quando arriva la
   risposta, si cambia questa riga. */
const TIPI_PER_RUOLO: Record<Ruolo, string[] | 'tutto'> = {
  reception: 'tutto',
  amministrazione: 'tutto',
  spa: ['trattamenti', 'dayspa'],
};

export function vedeTutto(ruolo: Ruolo | null): boolean {
  return !!ruolo && TIPI_PER_RUOLO[ruolo] === 'tutto';
}

/** I tipi di richiesta che questo ruolo può leggere. Vuoto = nessuno. */
export function tipiVisibili(ruolo: Ruolo | null): string[] {
  if (!ruolo) return [];
  const t = TIPI_PER_RUOLO[ruolo];
  return t === 'tutto' ? [] : [...t];
}
