# v2.7 — i pulsanti giusti alle persone giuste

## Cosa cambia nelle email di conferma

**Inglese e francese avevano due buchi.** La conferma italiana e quella
tedesca offrono da mesi il pulsante del **transfer** e quello del **buono
regalo**; l'inglese e la francese no. Non era una scelta: era una
dimenticanza che nessuno poteva vedere, perché chi scrive in italiano non
legge mai la conferma francese. Ora le quattro conferme offrono gli stessi
servizi, e c'è una prova che le confronta a ogni modifica — se domani se ne
aggiunge uno in una lingua sola, i test si accorgono.

**Green fee e maestro, ma solo a chi ha il golf.** Se la tariffa della
camera dice «golf», la conferma aggiunge una riga con i due pulsanti:
prenotare la partenza (Frassanelle o Montecchia) e l'ora con il maestro.
A chi viene per le cure quei due pulsanti non compaiono: in fondo a
un'email già lunga, due pulsanti in più per tutti valgono meno di due
pulsanti giusti per chi li usa.

**Il desiderio sull'orario dei fanghi, a chi ha le cure.** Con la casella
«cure termali» spuntata, e solo se la pratica ha il link «Prepari il suo
arrivo», compare una riga in più: i turni sono al mattino dalle 5:50 alle
10:30, e la preferenza si può dire ORA dalla pagina d'arrivo. Non si
promette nessun turno — l'orario lo assegna la Segreteria Cure dopo la
visita di ammissione, e la riga lo dice.

Se il link d'arrivo non c'è, la riga non compare: chiedere una preferenza
senza dare il modo di esprimerla è peggio del silenzio.

## Dove finisce quel desiderio

Nel back office (`/buoni/`) c'è una **quinta scheda, «Arrivi del giorno»**:
si sceglie un giorno e si vede chi arriva, con l'ora, il mezzo, il
transfer, le note e il desiderio dei fanghi — e accanto le richieste di
trattamenti e Day Spa per quello stesso giorno. Prima quel dato viveva solo
dentro un'email nella casella info@: se l'email si perdeva, il dato c'era e
non si poteva guardare.

`spa@termeleonardo.com` vede quella scheda con i fanghi e i trattamenti, e
**non** vede la fatturazione: partita IVA, codice SDI, PEC e cellulare del
transfer non sono nascosti con il CSS, il server non glieli manda proprio.

## Per installarla

Scarichi `fidra-offerta-v2_7_0.zip`, sostituisca la cartella
dell'estensione con quella dentro lo zip, poi `edge://extensions/` →
**Ricarica**. Dopo il ricaricamento la versione deve leggere **2.7.0**.
