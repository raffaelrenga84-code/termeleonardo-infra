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

/* un tetto alla dimensione della mappa, non solo alle chiamate per singolo
   indirizzo: senza, chi ruota gli indirizzi puo' far crescere la memoria in
   fretta, dentro la stessa finestra, prima che ci sia qualcosa di scaduto
   da ripulire. 5000 voci sono qualche megabyte al massimo (misurato dalla
   revisione: circa 267 byte a voce), una quantita' trascurabile per
   un'istanza di questa funzione. */
const MAX_INDIRIZZI = 5000;

export function creaFrenoIp(tetto: number, finestraMs: number, maxIndirizzi = MAX_INDIRIZZI) {
  const chiamate = new Map<string, number[]>();

  /* Butta via le voci del tutto scadute: senza questo, un indirizzo che
     chiama una volta sola e non torna piu' resterebbe nella mappa per
     sempre, fino al riavvio a freddo dell'istanza — nessuno richiama
     `permesso` per quell'indirizzo, quindi nessun altro punto del codice
     lo riguarderebbe mai piu'. Un giro sull'intera mappa a ogni chiamata
     costa poco per il traffico di un piccolo sito alberghiero, ed e'
     comunque limitato dal tetto di dimensione qui sotto. */
  function pulisci(soglia: number) {
    for (const [ip, tempi] of chiamate) {
      const vivi = tempi.filter((t) => t > soglia);
      if (vivi.length === 0) chiamate.delete(ip);
      else if (vivi.length !== tempi.length) chiamate.set(ip, vivi);
    }
  }

  /* `adesso` si puo' passare da fuori (i test lo fanno) cosi' la finestra
     scorrevole si prova senza dover davvero aspettare che il tempo passi. */
  function permesso(ip: string, adesso: number = Date.now()): boolean {
    const soglia = adesso - finestraMs;
    pulisci(soglia);

    const recenti = chiamate.get(ip) ?? [];
    if (recenti.length >= tetto) {
      return false;
    }

    /* Un indirizzo nuovo che arriva quando la mappa e' gia' al tetto passa
       comunque, senza essere tracciato: questo e' un freno contro un
       abuso a raffica sul sito dell'hotel, non un sistema antifrode. Fra
       rifiutare un ospite vero e lasciar passare qualche chiamata di
       troppo quando la memoria e' sotto pressione, l'errore giusto e' il
       secondo. */
    if (!chiamate.has(ip) && chiamate.size >= maxIndirizzi) {
      return true;
    }

    recenti.push(adesso);
    chiamate.set(ip, recenti);
    return true;
  }

  /* esposta solo per i test: dimensione() guarda dentro alla mappa per
     provare che le voci scadute spariscono davvero e che il tetto tiene,
     senza dover esporre la mappa stessa */
  permesso.dimensione = () => chiamate.size;

  return permesso;
}
