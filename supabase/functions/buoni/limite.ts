/* ============================================================
   limite.ts — freno sulle richieste pubbliche.
   ?a=acquista e ?a=stampa sono pubbliche, senza autenticazione, e
   condividevano lo stesso contatore in memoria (8 chiamate ogni dieci
   minuti per indirizzo). Rilievo della revisione: frenano due rischi
   DIVERSI — l'integrità della numerazione da una parte (?a=acquista
   inserisce una riga e consuma un numero di buono: un ciclo automatico
   la bucherebbe), l'enumerazione dei codici dall'altra (senza un freno
   su ?a=stampa si potrebbero provare codici a raffica finché non se ne
   indovina uno valido) — con un'unica risorsa: chi stampa il proprio
   buono più volte, o lo stampa da una rete condivisa insieme ad altri
   clienti (il wifi dell'hotel, un business center), può erodere il
   budget di chi sta per comprare, e viceversa. Due contatori separati,
   uno per azione, ciascuno con il proprio tetto — vedi le due costanti
   sotto per lo scenario pensato per ciascuna.

   Due freni per l'acquisto (in memoria + sul database), perché quello in
   memoria da solo non basta: provato in produzione, quattordici
   richieste di fila non lo fanno mai scattare, perché ogni chiamata
   prende un'istanza nuova e il contatore riparte da zero. Resta come
   prima linea a costo zero quando l'istanza è calda; il tetto che regge
   davvero, per l'acquisto, è quello contato sul database (troppiDalSito,
   più sotto) — la stampa non ne ha uno equivalente perché non scrive
   nulla: nel peggiore dei casi (istanza fredda) resta il rischio di
   enumerazione, non quello sulla numerazione.
   ============================================================ */

const FINESTRA_MS = 10 * 60 * 1000;   // dieci minuti

/* Motore comune ai due freni: una mappa indirizzo→istanti, un tetto e
   una finestra. Le due azioni NON condividono la mappa — è proprio
   questo che le separa — solo il modo di contare. */
function creaFreno(maxPerIp: number) {
  const visti = new Map<string, number[]>();

  const entroIlLimite = (ip: string, ora: number = Date.now()): boolean => {
    if (!ip) return true;                     // senza IP non si discrimina
    const soglia = ora - FINESTRA_MS;
    const recenti = (visti.get(ip) || []).filter((t) => t > soglia);
    if (recenti.length >= maxPerIp) {
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
  };

  const azzera = (): void => { visti.clear(); };

  return { entroIlLimite, azzera };
}

/* ACQUISTO. Uno scenario che compra sul serio non ripete l'acquisto otto
   volte in dieci minuti: se un cliente vero ne fa due o tre (una carta
   rifiutata, un ripensamento sulla lingua) c'è ancora margine. Il tetto
   resta quello di prima: separarlo da quello della stampa non cambia
   quanto sia largo, solo il fatto che stampare non lo consuma più. */
const MAX_PER_IP_ACQUISTA = 8;
const frenoAcquista = creaFreno(MAX_PER_IP_ACQUISTA);

/** true se un tentativo di acquisto può passare; registra il tentativo. */
export const entroIlLimiteAcquista = frenoAcquista.entroIlLimite;

/** solo per i test: azzera lo stato del freno d'acquisto fra un caso e l'altro */
export const azzeraLimiteAcquista = frenoAcquista.azzera;

/* STAMPA. Uno scenario diverso: stampare il PROPRIO buono è una cosa che
   una persona vera fa più volte — lo perde, il foglio si inceppa, lo
   rifà con margini diversi, lo manda a un'altra stampante o a un collega
   in un'altra stanza dello stesso hotel (stesso IP in rete). Il tetto
   sta più largo apposta, per non far scattare il freno su un uso
   legittimo — resta comunque un tetto: chi prova a indovinare un codice
   a raffica lo raggiunge comunque, solo con qualche tentativo in più. */
const MAX_PER_IP_STAMPA = 30;
const frenoStampa = creaFreno(MAX_PER_IP_STAMPA);

/** true se una richiesta di stampa può passare; registra il tentativo. */
export const entroIlLimiteStampa = frenoStampa.entroIlLimite;

/** solo per i test: azzera lo stato del freno di stampa fra un caso e l'altro */
export const azzeraLimiteStampa = frenoStampa.azzera;

/* QR (?a=qr in index.ts). Un tetto COMPLESSIVO, non per indirizzo — a
   differenza dei due freni qui sopra. Il motivo è specifico di questa
   azione: chi la chiama non impara nulla sull'esistenza di un codice (non
   tocca il database), quindi non c'è enumerazione da fermare; il rischio
   qui è solo il costo di calcolo di chi la chiama a raffica per farci
   lavorare a vuoto. E frenare per indirizzo sarebbe proprio sbagliato:
   l'immagine sta in un'email, e i proxy che la caricano — Gmail, e
   soprattutto Apple Mail Privacy Protection, che PRECARICA ogni immagine
   di ogni email appena arriva, per ogni destinatario, prima ancora che
   qualcuno la apra — arrivano da pool di indirizzi condivisi fra
   destinatari scollegati fra loro: un freno per IP farebbe sparire il QR
   a gruppi interi di ospiti veri, non solo a chi abusa.

   LO SCENARIO PENSATO PER IL NUMERO (finestra di 10 minuti, la stessa di
   acquisto e stampa qui sopra). Un giorno di punta arriva forse a una
   cinquantina di buoni emessi fra sito e reception, non distribuiti piano:
   un gruppo che acquista insieme in reception, o l'esito di una
   promozione, può concentrarne una decina nella stessa finestra di 10
   minuti. Ciascun buono manda fino a due email (acquirente e
   destinatario), e ciascuna email genera più di una richiesta reale
   all'origine: un precaricamento di Apple MPP appena l'email arriva (una
   volta a testa, la apra o no) più qualche ricarica dal proxy di Gmail o
   simili a ogni apertura vera (telefono, poi computer, magari inoltrata).
   Contando largo — 10 buoni × 2 email × (1 precaricamento + 5 riletture
   × 2 fetch) = 220 richieste vere nella finestra più affollata immagi-
   nabile — il tetto sta a più del doppio di quella stima: l'errore da non
   fare qui è far sparire il QR a un ospite vero, non lasciar passare
   qualche disegno di troppo. A ~2,7 ms a chiamata (misurato), anche il
   tetto pieno costa meno di 1,4 secondi di calcolo spalmati sui 10
   minuti — economico anche nel caso limite.

   Riusa creaFreno qui sopra invece di un meccanismo nuovo: una sola
   "chiave" fissa ('*') vale un contatore unico per l'intera funzione,
   non uno per IP. */
const MAX_QR_COMPLESSIVO = 500;
const frenoQr = creaFreno(MAX_QR_COMPLESSIVO);

/** true se la funzione può ancora disegnare un QR in questa finestra di 10
 * minuti (complessiva, non per indirizzo — vedi sopra); registra il
 * tentativo. */
export function entroIlLimiteQr(ora: number = Date.now()): boolean {
  return frenoQr.entroIlLimite('*', ora);
}

/** solo per i test: azzera lo stato del freno QR fra un caso e l'altro */
export function azzeraLimiteQr(): void {
  frenoQr.azzera();
}

/* ---------- il tetto che regge fra istanze diverse ----------
   Conta i buoni nati dal sito nell'ultima mezz'ora: sta nel database,
   quindi vale per tutti. La soglia è molto sopra il traffico vero (un
   hotel non vende trenta buoni online in mezz'ora) e serve solo a
   fermare un ciclo impazzito prima che mangi la numerazione. */
export const TETTO_MEZZORA = 30;

export async function troppiDalSito(
  db: { from: (t: string) => any },
  ora: number = Date.now()
): Promise<boolean> {
  const da = new Date(ora - 30 * 60 * 1000).toISOString();
  const { count, error } = await db.from('buono_regalo')
    .select('numero', { count: 'exact', head: true })
    .eq('creato_da', 'sito')
    .gte('creato_il', da);
  /* se il conteggio non riesce non si blocca la vendita: meglio un
     acquisto in più che una cassa chiusa per un errore di lettura */
  if (error) { console.error('conteggio acquisti non riuscito', error.message); return false; }
  return (count ?? 0) >= TETTO_MEZZORA;
}
