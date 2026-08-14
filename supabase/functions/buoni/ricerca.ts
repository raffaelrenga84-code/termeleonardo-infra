/* ============================================================
   ricerca.ts — filtro "or" per la ricerca libera dell'elenco buoni
   (?a=elenco&cerca=…, azione GET protetta da autenticazione in
   index.ts — quella protezione resta com'è, qui c'entra solo cosa
   succede DOPO che una richiesta è passata).

   Cerca in codice, acquirente/acquirente_email, destinatario/
   destinatario_email. Prima di questa modifica cercava solo codice,
   acquirente e destinatario: chi telefona in reception dicendo «ho
   comprato un buono ma non mi è arrivato» spesso sa dare solo la
   propria email, non il codice — con quella non si trovava nulla.

   IL TESTO ARRIVA DA CHI DIGITA, non da un modulo controllato, e va
   trattato sempre come testo letterale, mai come sintassi. La sintassi
   da difendere qui è quella di PostgREST per i filtri combinati
   or(...), non SQL — le richieste verso Supabase restano parametrizzate,
   non c'è modo di iniettare SQL vero. Ma prima ancora di arrivare al
   database il valore passa dal PARSER dei filtri combinati, che usa
   virgola e parentesi per separare le condizioni: senza protezione, un
   testo con quei caratteri non verrebbe cercato, verrebbe LETTO come
   sintassi — esattamente il difetto già annotato in troppeRichieste
   (richieste/index.ts), dove un'email finiva in un .or(...) senza
   schermo. Qui è più delicato perché è un campo di ricerca libera: la
   reception ci digita nomi con l'apostrofo ("D'Amico"), email con
   caratteri di ogni tipo, codici incollati con spazi — tutto testo,
   mai sintassi.

   Due protezioni distinte, per due sintassi distinte, ATTRAVERSATE DA DUE
   LIVELLI CHE MANGIANO CIASCUNO UN BACKSLASH — il punto su cui una prima
   versione di questo file sbagliava, corretto in revisione leggendo il
   parser vero di PostgREST (ApiRequest/QueryParams.hs):

   1. GRAMMATICA or() DI POSTGREST — virgola, parentesi e apice doppio
      separano o delimitano le condizioni. Il valore va sempre chiuso fra
      apici doppi (così virgole e parentesi al suo interno restano testo,
      non delimitatori). DENTRO GLI APICI, PERÒ, IL PARSER DI POSTGREST
      TRATTA OGNI BACKSLASH COME UN "PRENDI IL CARATTERE DOPO ALLA
      LETTERA, QUALUNQUE ESSO SIA" — non solo davanti ad apice o
      backslash (l'unico caso che la documentazione descrive a parole):
      un backslash scritto davanti a QUALSIASI carattere sparisce, e
      quel carattere passa al livello dopo da solo, senza più backslash
      davanti. Un solo backslash aggiunto qui non sopravvive.

   2. JOLLY DI ILIKE, LATO POSTGRES — dentro il valore che arriva dal
      livello 1, `%` e `_` sono i jolly di Postgres ("qualunque sequenza"
      e "qualunque carattere"); Postgres li prende alla lettera solo se
      preceduti da un backslash (l'escape di default di LIKE/ILIKE). Ma
      quel backslash, per arrivarci ANCORA acceso dopo che il livello 1
      ne ha mangiato uno, va scritto DOPPIO nel testo che si manda a
      PostgREST: il livello 1 ne consuma uno e lascia passare l'altro,
      che a quel punto è l'unico backslash che Postgres vede — esattamente
      quello che gli serve per leggere il carattere dopo alla lettera.
      Un solo backslash, mangiato dal livello 1, arriva a Postgres nudo:
      `%` e `_` restano jolly veri, non testo.

   L'apice doppio fa eccezione e usa UN SOLO backslash: la citazione che
   protegge è quella del livello 1 stesso (PostgREST), che la consuma lì
   e non la passa oltre — non c'è un secondo livello a valle per l'apice,
   perché un apice non è mai speciale per Postgres LIKE/ILIKE.

   Il `*` è un caso a parte: PostgREST lo sostituisce SEMPRE con `%` per
   chi lo usa come alias (comodo per non scrivere %25 nell'URL) — una
   semplice sostituzione carattere per carattere, cieca al backslash che
   lo precede. Anche raddoppiando il backslash, un asterisco digitato non
   può restare "un asterisco cercato alla lettera": al massimo atterra
   come un `%` sfuggito (quindi letterale, non jolly) — non l'esito
   ideale, ma quello giusto per lo scopo di questo file: MAI un jolly
   aperto che allarga il risultato a righe che non c'entrano, anche se il
   carattere esatto cercato non è più "*" ma "%". Un errore cosmetico,
   non un buco.

   L'ordine delle sostituzioni conta: il backslash del testo originale si
   raddoppia (anzi, si quadruplica — vedi sotto) per primo, o le sostituzioni
   successive raddoppierebbero anche i backslash che aggiungono loro stesse.
   ============================================================ */

/** Colonne su cui cercare, in ordine: il codice del buono, poi
 *  acquirente e destinatario con le rispettive email. */
const COLONNE_RICERCA = [
  'codice', 'acquirente', 'acquirente_email', 'destinatario', 'destinatario_email',
] as const;

/* Sfugge un valore perché stia, testo e basta, dentro un apice doppio
   nella grammatica or()/and() di PostgREST, e perché non faccia scattare
   i jolly di ilike una volta arrivato a Postgres — vedi il commento in
   cima al file per il perché dei conteggi di backslash qui sotto: un
   apice ne vuole uno solo (lo mangia PostgREST, non arriva mai a
   Postgres); `%`, `_` e `*` ne vogliono due (uno lo mangia PostgREST,
   l'altro deve restare acceso per Postgres); il backslash letterale del
   testo originale ne vuole quattro — stessa regola di `%`/`_` (uno
   mangiato da PostgREST, uno per Postgres), ma applicata al backslash
   stesso, che per Postgres segue la sua propria regola («per matchare
   l'escape, scrivilo doppio»): due backslash raddoppiati, quattro. */
function sfuggiValoreRicerca(testo: string): string {
  const bs = (n: number) => '\\'.repeat(n);
  return testo
    .replace(/\\/g, bs(4))          // backslash letterale: quattro, per primo (vedi sopra)
    .replace(/"/g, bs(1) + '"')     // apice doppio: chiuderebbe la citazione PostgREST
    .replace(/%/g, bs(2) + '%')     // jolly ilike: "qualunque sequenza"
    .replace(/_/g, bs(2) + '_')     // jolly ilike: "un carattere qualunque"
    .replace(/\*/g, bs(2) + '*');   // alias di % per like/ilike lato PostgREST
}

/** Costruisce il filtro `or` per la ricerca libera dell'elenco buoni:
 *  case-insensitive (ilike, come già prima), su codice, acquirente,
 *  destinatario e le loro email — con `cerca` sempre trattato come
 *  testo letterale, qualunque cosa contenga. */
export function filtroRicercaBuoni(cerca: string): string {
  const valore = sfuggiValoreRicerca(cerca);
  return COLONNE_RICERCA
    .map((colonna) => `${colonna}.ilike."%${valore}%"`)
    .join(',');
}
