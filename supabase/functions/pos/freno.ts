/* ============================================================
   freno.ts — un tetto di richieste per indirizzo, in memoria.

   PERCHE' ESISTE. L'elenco dei tavoli («dove e' seduto?») e' pubblico:
   «puoi fare entrambe? con QR e senza?» (la proprieta', 6 settembre 2026).
   Consegna pero' la firma di OGNI tavolo, cioe' la chiave che apre il menu
   senza inquadrare niente. La firma da sola non fa danni — ogni ordine si
   paga con la carta prima di stampare in cucina, o si addebita in camera
   solo con tessera e numero che combaciano — ma non c'e' motivo di
   lasciare che qualcuno se le porti via a raffica, ne' di far girare tre
   letture del database per ogni richiesta di chi insiste.

   QUELLO CHE NON E'. Non e' una difesa: chi vuole le firme le prende
   comunque, una richiesta basta, e sono le stesse ogni giorno. E' un
   freno contro l'abuso a raffica e contro un baco nostro (un ciclo
   impazzito in una pagina), come i freni della funzione buoni.

   IN MEMORIA, DUNQUE PER ISTANZA. Le funzioni girano su piu' istanze e
   ognuna conta per conto suo: il tetto vero e' quello moltiplicato per
   quante ne stanno in piedi. Va bene per quello che deve fare; se un
   giorno servisse un conto esatto, andrebbe sul database.

   NON TOCCA LA RETE DELL'HOTEL. Dietro il Wi-Fi dell'hotel escono tutti
   gli ospiti con lo stesso indirizzo: un tetto per indirizzo li terrebbe
   fuori tutti insieme. Chi e' sulla rete dell'hotel non passa dal freno
   (vedi ?a=ospite-tavoli in index.ts).
   ============================================================ */

/** Un freno: `maxPerIp` richieste ogni `finestraMs` per indirizzo. */
export function creaFreno(maxPerIp: number, finestraMs: number) {
  const visti = new Map<string, number[]>();

  /** true se la richiesta puo' passare; la registra. Senza indirizzo passa
   *  sempre: contare su una chiave vuota mescolerebbe persone diverse. */
  const entroIlLimite = (ip: string, ora: number = Date.now()): boolean => {
    if (!ip) return true;
    const soglia = ora - finestraMs;
    const recenti = (visti.get(ip) || []).filter((t) => t > soglia);
    if (recenti.length >= maxPerIp) {
      visti.set(ip, recenti);                 // niente accumulo infinito
      return false;
    }
    recenti.push(ora);
    visti.set(ip, recenti);
    /* pulizia opportunistica: senza, la mappa cresce finche' l'istanza vive */
    if (visti.size > 500) {
      for (const [k, v] of visti) if (!v.some((t) => t > soglia)) visti.delete(k);
    }
    return true;
  };

  /** Vero se quella chiave ha gia' raggiunto il tetto; NON registra niente.
      Con `segna` si conta solo cio' che si vuole contare — gli errori, non
      i tentativi: chi sbaglia una volta il numero non paga niente. */
  const pieno = (chiave: string, ora: number = Date.now()): boolean => {
    if (!chiave) return false;
    const soglia = ora - finestraMs;
    return (visti.get(chiave) || []).filter((t) => t > soglia).length >= maxPerIp;
  };
  const segna = (chiave: string, ora: number = Date.now()): void => { if (chiave) entroIlLimite(chiave, ora); };

  /** Quanti indirizzi il freno ricorda ancora a quell'istante: per le prove. */
  const quanti = (ora: number = Date.now()): number => {
    const soglia = ora - finestraMs;
    let n = 0;
    for (const v of visti.values()) if (v.some((t) => t > soglia)) n++;
    return n;
  };

  const azzera = (): void => { visti.clear(); };

  return { entroIlLimite, pieno, segna, quanti, azzera };
}
