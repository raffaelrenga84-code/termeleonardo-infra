# Il calendario di Prenota, da telefono

*3 settembre 2026 — deciso con la proprietà in brainstorming*

## Perché

Su `/prenota` le date sono due campi nativi del telefono, arrivo e partenza
separati: due pannelli diversi, il secondo che si apre su oggi, nessun conto
delle notti, nessun segno dei giorni chiusi. «Trovo ancora problematica la
scelta delle date, poco intuitiva» (la proprietà, 3 settembre 2026). Il modulo
`/comune/date.js` ha già rattoppato il peggio (partenza che segue l'arrivo,
pannello che si chiude), ma resta una scelta in due passaggi su due strumenti
che non parlano fra loro.

## Cosa si costruisce

**Un modulo solo, riusabile: `pagine/comune/calendario.js`.** Un calendario a
intervallo, senza librerie esterne, con le regole in funzioni pure e il disegno
a parte.

### Regole (pure, provate)

- `griglia(oggiISO, quantiMesi = 14)` → i mesi da quello di oggi in avanti, ognuno
  con `{ anno, mese, giorni: [{ iso, giorno, colonna }] }`; la settimana parte da
  lunedì (`colonna` 0–6).
- `statoGiorno(iso, { oggi, arrivo, partenza, chiusure })` → uno fra `passato`,
  `chiuso`, `arrivo`, `partenza`, `dentro`, `libero`. `chiusure` è l'elenco
  `[{ chiusura, riapertura }]` letto dal server (`a=stagione`); un giorno è chiuso
  se `chiusura ≤ iso < riapertura`. Il giorno di riapertura è libero. Un giorno
  passato è prima di oggi; oggi è libero (poi decide `chiusoPerOggi`, come oggi).
- `tocca(scelta, iso, { oggi, chiusure })` → la macchina dei due tocchi:
  - senza arrivo, o con arrivo e partenza già scelti: il tocco diventa il nuovo
    arrivo, partenza vuota;
  - con arrivo e senza partenza: se `iso > arrivo` diventa la partenza, se
    `iso ≤ arrivo` diventa il nuovo arrivo;
  - un giorno `passato` o `chiuso` non si tocca (la scelta resta com'è);
  - un intervallo che attraversa una chiusura non si accetta: il tocco sulla
    partenza diventa un nuovo arrivo.
- `nottiFra(arrivo, partenza)` è quella di `/comune/date.js`.
- `riassunto(scelta, lingua)` → «ven 13 feb → mar 17 feb · 4 notti», o «Scelga
  il giorno di arrivo», o «Ora il giorno di partenza».

### Disegno

`apriCalendario({ radice, lingua, oggi, chiusure, arrivo, partenza, onConferma, onChiudi })`
disegna dentro `radice`:

- una testa fissa con il riassunto e il pulsante di chiusura;
- i mesi: nome del mese e anno, sette intestazioni dei giorni, la griglia; ogni
  giorno è un `<button>` con `data-iso` e la classe del suo stato (`passato`,
  `chiuso`, `arrivo`, `partenza`, `dentro`, `libero`); il primo giorno chiuso di
  ogni stagione porta la scritta «chiusi» sotto il numero;
- una barra fissa in basso: «Cancella» e «Conferma» (attiva solo con arrivo e
  partenza).

Sul telefono (larghezza ≤ 640 px) la radice è un foglio a tutto schermo
(`position: fixed`, mesi uno sotto l'altro da scorrere, testa e barra fisse). Su
computer è un riquadro sotto il campo, con due mesi affiancati e le frecce
avanti/indietro. Stessa funzione: il vestito lo decide il CSS con una media
query, non due codici.

Testi del modulo, quattro lingue: nome del campo «Arrivo e partenza», «Scelga il
giorno di arrivo», «Ora il giorno di partenza», «{n} notti» / «1 notte»,
«Conferma», «Cancella», «chiusi», i nomi dei mesi e i giorni abbreviati (lun,
mar, …; Mo, Di, …; Mon, Tue, …; lun, mar, …).

## La pagina Prenota

- I due `<input type="date">` restano nel modulo ma diventano `type="hidden"`,
  con gli stessi id `fArrivo` e `fPartenza` e gli stessi valori ISO: tutto quello
  che c'è sotto (ricerca, ramo chiuso, riepilogo, prove) legge gli stessi campi.
- Al loro posto un campo solo, un pulsante largo come il modulo con l'etichetta
  «Arrivo e partenza» e dentro il riassunto («ven 13 feb → mar 17 feb · 4 notti»
  o «Scelga le date»); al tocco apre il calendario.
- Alla conferma la pagina scrive i due ISO nei campi nascosti, lancia un evento
  `change` su ciascuno (così `collegaArrivoPartenza` e gli avvisi di oggi
  continuano a lavorare) e aggiorna il riassunto.
- Le chiusure per il grigio vengono da `STAGIONE` (già letta all'avvio); se non
  è ancora arrivata, nessun giorno grigio: il server rifiuta comunque le date
  dentro la chiusura con il messaggio giusto (disegno della chiusura).
- Arrivo e partenza precompilati dall'indirizzo (`ARRIVO_URL`, `PARTENZA_URL`) o
  da una ricerca precedente restano precompilati: il campo li mostra subito.
- Gli altri moduli (transfer, richieste, check-in) restano com'erano: il modulo è
  pronto per servirli dopo.

## Casi limite

- Chi tocca la partenza prima dell'arrivo (partenza ≤ arrivo): diventa il nuovo
  arrivo, senza errore.
- Un intervallo che passa sopra la chiusura: non si accetta, il tocco riparte.
- Oggi come arrivo: ammesso qui; `chiusoPerOggi` decide dopo, come oggi.
- Il foglio aperto e la pagina che si ridisegna (`disegna()`): il foglio si
  chiude, la scelta confermata è già nei campi nascosti.
- Tastiera su computer: i giorni sono pulsanti, Tab e Invio bastano; Esc chiude.

## Prove

- `pagine/comune/calendario.test.ts`: `griglia` (mesi, colonna del primo giorno,
  quattordici mesi da oggi), `statoGiorno` su ogni stato, `tocca` su tutti i
  rami (compreso l'intervallo sopra una chiusura), `riassunto` nelle quattro
  lingue; eseguite con `oggi` passato dall'esterno.
- `pagine/prenota/calendario-pagina.test.ts`: dal sorgente della pagina: import
  del modulo, campi nascosti con gli stessi id, il pulsante che apre, la
  conferma che scrive i valori e lancia `change`.
- Tutte le prove esistenti di `pagine/prenota/` restano verdi (semaforo, ordine,
  chiusura…).

## Rilascio

Sito da `main` (Vercel). Niente funzione, niente estensione.
