/* ============================================================
   rimborso.ts — la decisione di "Annulla e rimborsa" (?a=rimborsa in
   index.ts), separata dalla rete: cosa fare con un buono lo decide
   questo modulo leggendo solo la riga già in mano, senza mai aprire
   una connessione. Chi chiama (index.ts) fa la rete e il database,
   qui dentro non c'è né l'uno né l'altro — tranne eseguiRimborsoStripe,
   che la rete la fa ma attraverso un fetch RICEVUTO da chi chiama, mai
   quello globale: nei test è sempre un fetch finto, così questo file
   si collauda senza mai contattare Stripe davvero.

   IL PROBLEMA CHE RISOLVE — perché due gesti separati (annullare qui,
   rimborsare a mano dentro Stripe) sono un rischio: si annulla e ci si
   dimentica di rimborsare, o si rimborsa e il buono resta spendibile.
   Le regole che tengono insieme i due gesti stanno tutte qui:

   1. IL RIMBORSO PRIMA, LA SCRITTURA SOLO SE RIESCE. idoneitaRimborso
      decide COSA fare guardando solo la riga (nessuna rete ancora);
      eseguiRimborsoStripe fa la chiamata vera; solo se quella chiamata
      è andata a buon fine (o Stripe dice "già rimborsato", regola 5)
      chi chiama scrive `stato: 'annullato'`. Se il rimborso fallisce,
      la riga non si tocca: un buono annullato senza soldi restituiti
      è un cliente che ha pagato e non ha più niente, e in reception
      nessuno se ne accorge finché non telefona.

   2. Il verso opposto — rimborso riuscito ma scrittura fallita — non è
      questo file a chiuderlo (qui non c'è un database): chi chiama
      ritenta la scrittura, e se fallisce anche dopo i tentativi usa
      messaggioScritturaFallita per dire all'operatore, in chiaro, cosa
      è successo e cosa fare. Vedi il commento sopra quella funzione.

   3. Un buono pagato in contanti, bonifico o omaggio (`pagamento` non è
      'stripe', o non c'è un riferimento Stripe usabile) non ha nulla
      da rimborsare qui: idoneitaRimborso risponde `senza_stripe`, chi
      chiama annulla e basta e lo dice all'operatore — MAI un rimborso
      finto.

   4. Un buono non ancora pagato, già riscosso o già annullato non si
      rimborsa: idoneitaRimborso rifiuta con un motivo leggibile,
      prima di qualunque chiamata a Stripe.

   5. "Già rimborsato" non è un errore da mostrare come un guasto: è
      uno stato. classificaRispostaRimborso ed eseguiRimborsoStripe lo
      riconoscono dal codice d'errore che manda Stripe
      (`charge_already_refunded`) e lo trattano come un successo ai
      fini dell'annullamento — il buono va comunque annullato, i soldi
      sono già tornati al cliente una volta, non si ritenta.
   ============================================================ */

/** I soli campi della riga di buono_regalo che servono per decidere:
 *  niente altro, così chi chiama seleziona solo questi dal database
 *  e non passa qui una riga intera con dati che non c'entrano. */
export interface RigaPerRimborso {
  stato: string;
  pagamento: string | null;
  pagamento_rif: string | null;
  valore: number;
}

export type Idoneita =
  | { tipo: 'rifiutato'; motivo: string }
  | { tipo: 'senza_stripe' }
  | { tipo: 'da_rimborsare'; riferimentoStripe: string; centesimi: number };

/** Un buono con un pagamento Stripe da rimborsare porta, nella colonna
 *  pagamento_rif, o il payment_intent (webhook, il caso normale) o il
 *  charge — MAI un id di sessione (cs_...): quello è il fallback che il
 *  webhook usa quando manca il payment_intent, e Stripe non lo accetta
 *  come riferimento di un rimborso. Un prefisso qualunque diverso da
 *  questi due non è un errore da segnalare qui: è semplicemente un
 *  riferimento che non basta per chiamare Stripe, e si tratta come
 *  `senza_stripe` — meglio annullare e avvisare l'operatore che fingere
 *  un rimborso che fallirebbe comunque. */
function riferimentoUsabile(pagamento_rif: string | null): pagamento_rif is string {
  return !!pagamento_rif && (pagamento_rif.startsWith('pi_') || pagamento_rif.startsWith('ch_'));
}

/** L'importo in centesimi da chiedere a Stripe. Math.round e non un
 *  troncamento: `valore * 100` in virgola mobile può cadere un
 *  millesimo sotto l'intero (33.3 * 100 = 3329.999999999996 in certi
 *  casi), e troncare rimborserebbe un centesimo in meno di quanto
 *  pagato — la stessa difesa già usata in creaLinkStripe (index.ts)
 *  per il prezzo del link di pagamento. */
export function centesimiDaEuro(valore: number): number {
  return Math.round(Number(valore) * 100);
}

/** Cosa si può fare con questo buono, decidendo SOLO dai campi già
 *  letti — nessuna chiamata a Stripe qui: quella (se serve) la fa chi
 *  chiama, dopo aver ricevuto `da_rimborsare`. */
export function idoneitaRimborso(buono: RigaPerRimborso): Idoneita {
  if (buono.stato === 'attesa') return { tipo: 'rifiutato', motivo: 'il buono non risulta ancora pagato' };
  if (buono.stato !== 'pagato') return { tipo: 'rifiutato', motivo: `il buono risulta già ${buono.stato}` };
  if (buono.pagamento !== 'stripe' || !riferimentoUsabile(buono.pagamento_rif)) return { tipo: 'senza_stripe' };
  return { tipo: 'da_rimborsare', riferimentoStripe: buono.pagamento_rif, centesimi: centesimiDaEuro(buono.valore) };
}

/** Il corpo della richiesta POST /v1/refunds: Stripe vuole SOLO uno fra
 *  `payment_intent` e `charge`, mai l'altro al posto del suo — un
 *  charge passato come payment_intent (o viceversa) Stripe lo rifiuta
 *  con un errore di validazione, non fa la cosa giusta da sé. */
export function corpoRimborso(riferimentoStripe: string, centesimi: number): Record<string, string> {
  /* if/else esplicito, non un accesso a un oggetto con una chiave calcolata:
     solo due campi possibili, entrambi decisi qui, mai da un valore esterno */
  if (riferimentoStripe.startsWith('ch_')) return { charge: riferimentoStripe, amount: String(centesimi) };
  return { payment_intent: riferimentoStripe, amount: String(centesimi) };
}

export type EsitoStripeRimborso =
  | { esito: 'riuscito'; id: string }
  | { esito: 'gia_rimborsato' }
  | { esito: 'fallito'; messaggio: string };

/** Il solo codice d'errore di Stripe che NON è un fallimento vero ai
 *  fini di questa azione: significa che i soldi sono già tornati al
 *  cliente in un rimborso precedente. Un Set letterale, non un oggetto
 *  indicizzato dal codice che arriva da Stripe — quel codice è testo
 *  esterno, e un oggetto risponderebbe anche a chiavi che non ha
 *  scritto nessuno (toString, constructor…), esattamente il difetto
 *  che questo progetto ha già pagato più volte altrove (vedi
 *  index.html, `etichetta()`). */
const GIA_RIMBORSATO = new Set(['charge_already_refunded']);

/** Legge la risposta di Stripe (già in JSON, corpo e stato http già
 *  separati da chi ha fatto la fetch) e la riduce a uno dei tre esiti
 *  che contano per questa azione: riuscito, già-rimborsato (regola 5,
 *  non un guasto), fallito (il buono NON va annullato). */
export function classificaRispostaRimborso(risposta: { ok: boolean; corpo: unknown }): EsitoStripeRimborso {
  const corpo = (risposta.corpo ?? {}) as { id?: unknown; error?: { code?: unknown; message?: unknown } };
  if (risposta.ok) return { esito: 'riuscito', id: typeof corpo.id === 'string' ? corpo.id : '' };
  const codice = corpo.error?.code;
  if (typeof codice === 'string' && GIA_RIMBORSATO.has(codice)) return { esito: 'gia_rimborsato' };
  const messaggio = typeof corpo.error?.message === 'string' && corpo.error.message
    ? corpo.error.message
    : 'Stripe non ha confermato il rimborso';
  return { esito: 'fallito', messaggio };
}

const STRIPE_REFUNDS = 'https://api.stripe.com/v1/refunds';

/** La sola funzione di questo file che tocca la rete — e lo fa solo
 *  attraverso il `fetchImpl` ricevuto, mai `fetch` globale: chi chiama
 *  in produzione passa il `fetch` vero, i test passano un finto fetch
 *  che non contatta mai Stripe davvero, nemmeno in modalità di prova.
 *  Non lancia mai: un errore di rete (fetch che rifiuta la promise, un
 *  corpo non leggibile) diventa un esito `fallito` come un altro, così
 *  chi chiama ha sempre un solo posto — classificaRispostaRimborso più
 *  sopra, o il fallback qui sotto — dove guardare cos'è successo,
 *  senza un try/catch sparso a ogni chiamata. */
export async function eseguiRimborsoStripe(
  fetchImpl: typeof fetch,
  chiaveStripe: string,
  riferimentoStripe: string,
  centesimi: number
): Promise<EsitoStripeRimborso> {
  try {
    const r = await fetchImpl(STRIPE_REFUNDS, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${chiaveStripe}`,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(corpoRimborso(riferimentoStripe, centesimi)).toString(),
    });
    const corpo = await r.json().catch(() => ({}));
    return classificaRispostaRimborso({ ok: r.ok, corpo });
  } catch (e) {
    return { esito: 'fallito', messaggio: (e as Error).message || 'chiamata a Stripe non riuscita' };
  }
}

/** Regola 2: il rimborso è già partito (i soldi sono già tornati al
 *  cliente, su Stripe), ma la scrittura di `stato: 'annullato'` sul
 *  database ha fallito anche dopo i tentativi. Non basta un "errore"
 *  generico: l'operatore deve sapere SUBITO tre cose — quale buono,
 *  che i soldi SONO GIA' PARTITI (o rimborserebbe una seconda volta a
 *  mano, pensando che il primo tentativo non sia riuscito), e cosa
 *  fare adesso (segnare il buono annullato a mano, avvisare chi
 *  amministra). Il log CRITICO (console.error, in index.ts accanto a
 *  questa chiamata) è per chi legge i log più tardi; questo messaggio
 *  è per chi ha il problema in mano ORA, davanti allo schermo. */
export function messaggioScritturaFallita(codice: string, centesimi: number, riferimentoStripe: string): string {
  const euro = (centesimi / 100).toFixed(2).replace('.', ',');
  return `Il rimborso di ${euro} € è stato eseguito su Stripe (riferimento ${riferimentoStripe}), ` +
    `ma il buono ${codice} NON risulta ancora annullato nel sistema: la scrittura sul database ha fallito. ` +
    `Lo segni annullato A MANO e avvisi chi amministra i buoni — i soldi sono già tornati al cliente, ` +
    `non ritenti il rimborso manualmente.`;
}
