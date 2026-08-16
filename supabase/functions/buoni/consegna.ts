/* ============================================================
   consegna.ts — gli eventi di consegna di Resend.

   A COSA SERVE. Quando parte un promemoria di scadenza sappiamo l'ora in
   cui l'abbiamo consegnato a Resend, e basta. Se l'indirizzo non esiste
   piu' o la casella e' piena, il buono scade e nessuno se ne accorge: che
   e' esattamente la contestazione che la traccia doveva evitare.

   Resend richiama un nostro indirizzo quando il messaggio viene accettato
   dal server del destinatario (`email.delivered`) o respinto
   (`email.bounced`, `email.complained`). Questo file decide se credere a
   quella chiamata e a quale colonna appartiene.

   L'INDIRIZZO E' PUBBLICO, e deve esserlo: Resend non ha la nostra chiave
   hotel. L'unica cosa che distingue un evento vero da uno inventato e' la
   FIRMA. Senza verificarla, chiunque conosca l'indirizzo potrebbe mandare
   un finto «consegnato» e fabbricare la prova che in una contestazione
   mostreremmo all'ospite — una traccia falsificabile e' peggio di nessuna
   traccia, perche' nessuno la mette in dubbio.

   IL «LETTO» NON C'E', ED E' UNA SCELTA. Si misurerebbe con un'immagine
   invisibile, ma Apple Mail Privacy Protection la scarica da sola per
   tutti: risulterebbe «letto» cio' che nessuno ha aperto. Il ragionamento
   completo sta in supabase/2026-08-15-promemoria-consegna.sql.
   ============================================================ */

/** Da quanto tempo un evento firmato resta buono. Un evento vero,
    intercettato una volta, non deve poter essere rigiocato per sempre:
    senza questo controllo un «consegnato» di sei mesi fa varrebbe ancora
    oggi. Cinque minuti e' il margine che Svix stesso consiglia — copre lo
    scarto fra gli orologi senza aprire una finestra utile a nessuno. */
const TOLLERANZA_SECONDI = 5 * 60;

/** Elenco CHIUSO: il tipo di evento arriva da fuori, e indicizzare un
    oggetto con una chiave esterna lascerebbe pescare da Object.prototype
    (`toString`, `constructor`). Una funzione con casi espliciti non ha
    quel problema per costruzione. */
export function colonnaPerEvento(tipo: unknown): string | null {
  switch (tipo) {
    case 'email.delivered':
      return 'promemoria_consegnato_il';
    /* un reclamo per spam e' un respingimento a tutti gli effetti: quel
       messaggio all'ospite non e' arrivato in modo utile, e il buono
       rischia di scadere lo stesso */
    case 'email.bounced':
    case 'email.complained':
      return 'promemoria_respinto_il';
    default:
      return null;
  }
}

/** Confronto a tempo costante. Un `===` su stringhe esce al primo
    carattere diverso, e quel tempo si misura: con abbastanza tentativi si
    ricostruisce la firma giusta un carattere alla volta. Qui si guardano
    sempre tutti i byte. */
function ugualiATempoCostante(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diverso = 0;
  for (let i = 0; i < a.length; i++) diverso |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diverso === 0;
}

async function firmaAttesa(corpo: string, id: string, quando: string, segreto: string) {
  /* il segreto arriva come `whsec_<base64>`: la parte dopo il prefisso va
     decodificata, non usata come testo */
  const grezzo = Uint8Array.from(atob(segreto.slice('whsec_'.length)), (c) => c.charCodeAt(0));
  const chiave = await crypto.subtle.importKey(
    'raw',
    grezzo as unknown as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const f = await crypto.subtle.sign('HMAC', chiave, new TextEncoder().encode(`${id}.${quando}.${corpo}`));
  return btoa(String.fromCharCode(...new Uint8Array(f)));
}

/** Vero solo se la chiamata viene davvero da Resend e non e' vecchia.
 *
 * Il corpo va passato COSI' COM'E' ARRIVATO, non riserializzato da un
 * oggetto: la firma copre i byte esatti, e `JSON.stringify` di un oggetto
 * appena analizzato puo' produrre spazi o un ordine diversi. E' l'errore
 * classico di chi implementa un ricevitore di questo tipo.
 */
export async function firmaValida(
  corpoGrezzo: string,
  svixId: string,
  svixTimestamp: string,
  svixSignature: string,
  segreto: string | undefined,
): Promise<boolean> {
  /* Un segreto non configurato NON e' un permesso. E' il caso in cui si
     sbaglia piu' facilmente, perche' senza segreto «funziona tutto» in
     sviluppo e la porta resta spalancata in produzione. */
  if (!segreto || !segreto.startsWith('whsec_')) return false;
  if (!svixId || !svixTimestamp || !svixSignature) return false;

  const quando = Number(svixTimestamp);
  if (!Number.isFinite(quando)) return false;
  const scarto = Math.abs(Math.floor(Date.now() / 1000) - quando);
  if (scarto > TOLLERANZA_SECONDI) return false;

  let attesa: string;
  try {
    attesa = await firmaAttesa(corpoGrezzo, svixId, svixTimestamp, segreto);
  } catch {
    /* segreto non decodificabile: si rifiuta, non si passa oltre */
    return false;
  }

  /* Resend puo' mandare piu' firme separate da spazio durante la
     rotazione del segreto: basta che UNA combaci. Ognuna e' `v1,<base64>`. */
  for (const pezzo of svixSignature.split(' ')) {
    const virgola = pezzo.indexOf(',');
    if (virgola < 0) continue;
    if (ugualiATempoCostante(pezzo.slice(virgola + 1), attesa)) return true;
  }
  return false;
}
