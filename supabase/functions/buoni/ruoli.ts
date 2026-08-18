/* ============================================================
   ruoli.ts — chi vede quali buoni.

   `spa@termeleonardo.com` deve vedere «anche i buoni regalo, ma solo quelli
   con trattamenti e massaggi».

   IL FATTO CHE SEMPLIFICA TUTTO: il listino dei buoni è INTERAMENTE spa —
   programmi, massaggi, viso, corpo e i tre ingressi Day Spa. Non ci sono
   cene, soggiorni o green fee. Quindi oggi «un buono con dei trattamenti» e
   «un buono che non è denaro» sono la stessa cosa.

   E IL DIFETTO CHE QUELLA SEMPLICITÀ NASCONDE: il giorno che qualcuno
   aggiunge al listino una cena, la regola «non è denaro dunque è della spa»
   diventa falsa in silenzio, e la spa si trova in elenco buoni che non la
   riguardano senza che nessuno l'abbia deciso.

   Per questo la regola non è `tipo !== 'valore'` — che sarebbe più corta e
   oggi darebbe la stessa risposta — ma passa dalle FAMIGLIE del listino. Ed
   è per questo che ruoli.test.ts passa in rassegna tutto il listino: una
   voce nuova che non appartiene a nessuna famiglia della spa fa diventare la
   prova rossa, e costringe a decidere invece di scoprirlo dopo.

   ⚠ I ruoli e il controllo sul dominio sono gli stessi di
   richieste/ruoli.ts, ricopiati: `strumenti/pubblica.js` manda alla
   Management API soltanto i file della cartella della funzione, quindi le
   due funzioni non possono condividere un modulo. Chi cambia un ruolo qui
   deve cambiarlo anche là.
   ============================================================ */

import { LISTINO } from './acquista.ts';

/* Le famiglie di identificativi del listino, per prefisso. Sono le stesse
   che categoriaBuono() conosce in pagine/buoni/buono.js. */
export const FAMIGLIE_SPA = [
  'prog', 'relax', 'plantare', 'candle', 'antistress', 'ayurveda', 'hotstone',
  'pindasweda', 'linfo', 'shiatsu',
  'visofango', 'pulizia', 'ialuronico', 'collagene', 'vitaminac',
  'scrub', 'riducente', 'seno', 'antiage', 'manicure', 'pedicure', 'epil',
  'dayspa',
];

const piatto = (v: unknown) => String(v ?? '').trim().toLowerCase();

/** Se questo buono riguarda la spa.
 *
 *  · un buono a IMPORTO no: è denaro, si spende su qualunque cosa, e lo
 *    gestisce la reception;
 *  · una voce del listino sì, perché il listino è tutto spa;
 *  · un buono scritto a mano in reception, senza voce di listino, SÌ —
 *    non si sa classificare, e nasconderlo vorrebbe dire non poterlo
 *    riscuotere quando l'ospite lo presenta al banco della spa. Fra i due
 *    errori possibili, quello che ferma il lavoro di una persona è il
 *    peggiore;
 *  · una voce che NON è in listino no: un identificativo sconosciuto non è
 *    una prova che sia un trattamento. */
export function buonoDellaSpa(b: Record<string, unknown> | null | undefined): boolean {
  if (!b) return false;
  if (piatto(b.tipo) === 'valore') return false;

  const id = String(b.voce_id ?? '').trim();
  if (!id) return true; // scritto in reception: si mostra
  if (!Object.hasOwn(LISTINO, id)) return false;
  return FAMIGLIE_SPA.some((f) => id.startsWith(f));
}

export type Ruolo = 'reception' | 'spa' | 'amministrazione';

export const DOMINI_AMMESSI = (Deno.env.get('DOMINI_AMMESSI') || 'termeleonardo.com,hldv.com')
  .split(',').map((d) => d.trim().toLowerCase()).filter(Boolean);

/* Dominio ESATTO, non «contiene»: «termeleonardo.com.evil.net» e
   «nontermeleonardo.com» contengono tutti e due la nostra stringa. */
function dominioAmmesso(email: string): boolean {
  const chiocciola = email.lastIndexOf('@');
  if (chiocciola < 1) return false;
  return DOMINI_AMMESSI.includes(email.slice(chiocciola + 1));
}

/* Una Map e non un oggetto indicizzato: una chiave come `toString` esiste su
   Object.prototype, e una lookup diretta restituirebbe la funzione ereditata
   invece di sparire — lo stesso difetto già pagato coi circoli del golf. */
const RUOLI = new Map<string, Ruolo>([
  ['reception@termeleonardo.com', 'reception'],
  ['spa@termeleonardo.com', 'spa'],
  ['amministrazione@termeleonardo.com', 'amministrazione'],
]);

/** Il ruolo di questo indirizzo, o null. Un indirizzo del dominio giusto ma
 *  non previsto NON entra: un account nuovo non si aggiunge da solo con
 *  pieni poteri. */
export function ruoloDi(email: unknown): Ruolo | null {
  const e = piatto(email);
  if (!dominioAmmesso(e)) return null;
  return RUOLI.get(e) ?? null;
}

export type Vista = 'tutti' | 'solo spa' | 'nessuno';

export function vedeIBuoni(ruolo: Ruolo | null): Vista {
  if (!ruolo) return 'nessuno';
  return ruolo === 'spa' ? 'solo spa' : 'tutti';
}

/* CHI SCRIVE I BUONI. Deciso dalla proprietà il 18 agosto 2026: la spa no.

   Emettere un buono, segnarlo pagato e rimandare il link sono gesti che
   riguardano il denaro incassato e chi l'ha versato: stanno alla reception e
   all'amministrazione.

   LEGGERE E SCRIVERE NON SONO LO STESSO PERMESSO, ed è il punto. La spa deve
   poter RISCUOTERE un buono che l'ospite le presenta al banco — altrimenti
   non può servirlo — e questo non le dà il diritto di emetterne uno nuovo. */
export function puoScrivereBuoni(ruolo: Ruolo | null): boolean {
  return ruolo === 'reception' || ruolo === 'amministrazione';
}
