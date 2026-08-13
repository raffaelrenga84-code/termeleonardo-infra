/* ============================================================
   limite.ts — freno sulle richieste pubbliche.
   ?a=acquista è aperto a chiunque e ogni chiamata consuma un numero
   di buono e crea due oggetti su Stripe: un ciclo automatico bucherebbe
   la numerazione dell'amministrazione. Il conteggio sta in memoria,
   quindi vale finché l'istanza resta calda: non ferma un attacco
   distribuito, ma basta per il caso realistico di un singolo che
   martella. Il resto lo fa il pagamento, che nessun robot completa.
   ============================================================ */

const FINESTRA_MS = 10 * 60 * 1000;   // dieci minuti
const MAX_PER_IP = 8;                 // acquisti plausibili nella finestra

const visti = new Map<string, number[]>();

/** true se la richiesta può passare; registra il tentativo. */
export function entroIlLimite(ip: string, ora: number = Date.now()): boolean {
  if (!ip) return true;                     // senza IP non si discrimina
  const soglia = ora - FINESTRA_MS;
  const recenti = (visti.get(ip) || []).filter((t) => t > soglia);
  if (recenti.length >= MAX_PER_IP) {
    visti.set(ip, recenti);                 // niente accumulo infinito
    return false;
  }
  recenti.push(ora);
  visti.set(ip, recenti);
  /* pulizia opportunistica: senza, la mappa cresce finché l'istanza vive */
  if (visti.size > 500) {
    for (const [k, v] of visti) if (!v.some((t) => t > soglia)) visti.delete(k);
  }
  return true;
}

/** solo per i test: azzera lo stato fra un caso e l'altro */
export function azzeraLimite(): void {
  visti.clear();
}
