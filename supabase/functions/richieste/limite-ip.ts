/* limite-ip.ts — freno in memoria per indirizzo IP, a finestra scorrevole.

   Serve all'azione pubblica a=disponibilita: senza un tetto, chiunque puo'
   bombardarla, e ogni chiamata innesca una richiesta a check-availability
   (e, a sessione scaduta, due richieste al sito reale dell'hotel). Non si
   puo' riusare troppeRichieste() di index.ts: quella conta a database le
   righe salvate in richiesta_sito e ha bisogno di una email, mentre qui non
   si salva niente e non c'e' nessuna email — e' solo una ricerca.

   ATTENZIONE, e va detto a chi legge senza che debba dedurlo: questo e' un
   freno PER ISTANZA della funzione, quindi approssimativo. Istanze diverse
   in esecuzione in parallelo hanno ciascuna il proprio contatore, e un
   riavvio a freddo lo azzera. E' attrito onesto contro un abuso a raffica
   dallo stesso IP, non una difesa distribuita ne' una difesa perfetta. */

export function creaFrenoIp(tetto: number, finestraMs: number) {
  const chiamate = new Map<string, number[]>();

  /* `adesso` si puo' passare da fuori (i test lo fanno) cosi' la finestra
     scorrevole si prova senza dover davvero aspettare che il tempo passi. */
  return function permesso(ip: string, adesso: number = Date.now()): boolean {
    const soglia = adesso - finestraMs;
    const recenti = (chiamate.get(ip) ?? []).filter((t) => t > soglia);
    if (recenti.length >= tetto) {
      chiamate.set(ip, recenti);
      return false;
    }
    recenti.push(adesso);
    chiamate.set(ip, recenti);
    return true;
  };
}
