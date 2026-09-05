# Buono regalo: un solo foglio, in PDF, sulla carta intestata — e il modulo del sito che fa da solo

Data: 5 settembre 2026. Richiesta della proprietà (messaggi della sera, con foto):

> Buono regalo, non corrisponde: a parte l'impaginazione che conviene prenderla dalla carta intestata. La foto non è bella e in più non capisco perché ne fa vedere due diverse nella pagina. Quando lo riscatto al totem non registra riscattato e non si aggiorna la pagina del backend; campi mail non allega pdf del buono, mette solo oggetto e indirizzo del cliente; la copia stampata non corrisponde a quella a video; centra il logo come nella carta intestata.

> Lo vedi che il buono non corrisponde dall'anteprima alla stampa (nella stampa addirittura la foto è tagliata): c'è molto da migliorare di design e di aspetto. La mail ancora non si apre con l'allegato pdf da poter stampare e un testo accompagnatorio; se invece uso il pulsante copia e incolla viene un'immagine in miniatura, non sono sicuro che qualcuno possa stamparla. Il discorso del riscatto deve funzionare perfettamente anche per la Day Spa: hanno anche loro un QR code, deve funzionare tutto.

> Se metto il numero del buono su /it/day-spa (o negli altri campi dove posso mettere il numero del buono sul sito) e ho un buono per esempio per due persone, lui me lo conferma ma sotto mi dice scegli la data (il calendario deve essere lo stesso di 14 giorni al massimo come sulla prenotazione Day Spa) e quante persone: dovrebbe metterlo in automatico in base al buono, precompilando anche i nomi come sul buono, e su note ricapitolare cosa comprende. Deve essere tutto più proattivo, non aspettare che il cliente faccia tutto.

Il riscatto al totem e l'aggiornamento del back office sono già fatti (commit 31d15db). Questa specifica copre il resto.

## Il problema

Il buono oggi ha TRE rese diverse dello stesso contenuto: `buonoHTML` (anteprima a schermo, clipboard, e la copia in `buonoEmailHTML` per l'email — due colonne, foto della grotta), `buonoStampaHTML` (foglio A4 da piegare, altra impaginazione, foto tagliata) e l'email. Nessuna delle tre è un PDF: «Email a …» apriva Outlook e chiedeva di incollare, e il cliente riceveva un'immagine in miniatura.

## La decisione: un PDF solo

Il buono È un file PDF generato dal server (`pdf-buono.ts`, pdf-lib), disegnato sopra la carta intestata vera dell'hotel (`carta-intestata.ts`, il PDF «Carta intestata nuova» incorporato in base64). Quel PDF è:

- l'anteprima nel back office (iframe);
- quello che si stampa («Stampa subito» apre il PDF, si stampa da lì);
- l'allegato di ogni email del buono (automatica all'emissione, e «Email a …» dal back office, che ora spedisce il server con un testo di accompagnamento);
- quello che il cliente apre da «Stampa il tuo buono» nell'email (`/buoni/stampa`);
- l'anteprima nella pagina pubblica di acquisto (`/buoni/regala`), in bozza.

Una resa sola: non può più «non corrispondere».

### Il foglio

A4 verticale, la carta intestata così com'è (marchio centrato in alto, piè di pagina con indirizzo, società, recapiti e segno grafico). Fra i due, dall'alto:

1. fotografia a tutta larghezza (483 pt × 140 pt): la cascata termale (`pagine/buoni/img/buono-terme.jpg`, ritaglio già fatto), una sola per tutti i buoni;
2. occhiello BUONO REGALO (oro, spaziato), titolo «MARCO, hai ricevuto un dono speciale» (Times 22, verde), CON AFFETTO, DA + nome, dedica in corsivo;
3. il riquadro del servizio (filo d'oro a sinistra, fondo carta): descrizione (una riga per voce), sottotitolo, cosa comprende (Day Spa), la nota «ogni ingresso vale per una persona»;
4. la riga del codice: CODICE BUONO, il codice in Courier grande, «Valido fino al …», l'eventuale proroga; a destra il QR (vettoriale, solo il codice dentro, correzione Q) con «Mostri questo codice in reception»;
5. COME PRENOTARE: la frase, e «Oppure prenoti online su hoteltermeleonardo.com/it/day-spa» (dominio senza www, come sul foglio di prima);
6. CONDIZIONI in corpo piccolo;
7. in fondo, sopra il piè: «TERME LEONARDO · Riferimento BR-2026-0002».

Bozza (buono in attesa, o anteprima dal modulo): filigrana diagonale «BOZZA · NON VALIDO», codice coperto, niente QR, la nota «il codice viene assegnato al pagamento».

Niente recapiti ripetuti sul foglio: stanno già nel piè della carta intestata. Font standard PDF (Helvetica, Times, Courier: si vedono ovunque, niente da incorporare); i caratteri fuori WinAnsi si tolgono, non fanno esplodere il foglio.

### L'email

Testo di accompagnamento (quello di sempre: «Gentile …, grazie del suo acquisto…» / «qualcuno ha pensato a lei…») + un riepilogo a una colonna (marchio nero centrato, titolo, descrizione, codice con QR, validità, come prenotare, condizioni) + **il PDF in allegato** («Il buono è in allegato in PDF, pronto da stampare») + il pulsante «Stampa il tuo buono» che apre il PDF. Sparisce la foto dall'email (sta nel PDF) e la colonna verde.

«Email a …» nel back office non apre più Outlook: chiama `?a=manda`, il server spedisce con l'allegato e segna la consegna. «Copia» copia il testo del buono con il link al PDF (niente più immagine in miniatura).

### Il modulo del sito col buono (`/it/day-spa?buono=…` e `/it/trattamenti?buono=…`)

Col buono valido il modulo si compila da solo: **persone** = gli ingressi Day Spa del buono (2 per «n. 2 · ingressi Day Spa»), **nome** = il destinatario del buono se il campo è vuoto, **note** = sempre il contenuto del buono. Sul Day Spa il calendario si ferma a 14 giorni da oggi (lo stesso orizzonte di `/dayspa`, `ORIZZONTE_GIORNI`), con o senza buono: oltre non si prenota comunque.

## Fuori da questa specifica

- `buono.js` tiene `buonoHTML`/`buonoStampaHTML` (nessuna pagina le usa più; le prove sì): si tolgono in un secondo momento.
- Il riscatto Day Spa dei biglietti (QR della prenotazione, `?a=presenti`) c'è già; va provato in hall, non ricostruito.
- Un font di marca nel PDF (Cormorant): quando la proprietà lo chiede.
