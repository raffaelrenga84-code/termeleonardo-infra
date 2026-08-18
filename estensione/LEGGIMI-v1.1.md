# Offerta Leonardo v1.1 — cosa cambia

## Niente più Ctrl+V
Il pulsante **Copia email per Outlook** ora apre Outlook Web e il testo
**si inserisce da solo** nel corpo del messaggio, con tutta la grafica intatta.

Perché: il Ctrl+V in Outlook Web "sanifica" l'HTML incollato — rimuove gli
sfondi colorati, sostituisce Georgia con Calibri, normalizza i colori.
È il motivo per cui le email incollate arrivavano spoglie. La v1.1 salta
gli appunti e scrive direttamente nell'editor.

Gli appunti vengono comunque riempiti: se l'inserimento automatico non
parte (avviso arancione in basso), Ctrl+V funziona come prima.

## Caparra nella conferma — corretto
Prima: se la lettura della "Caparra Disponibile" da Fidra falliva (importi
senza decimali, sezione non visibile), la conferma usciva con
"Acconto ricevuto − 0,00 €" e saldo pieno, da correggere a mano.

Ora:
- la lettura accetta anche importi senza decimali ("75 €")
- nel popup c'è il campo **Acconto ricevuto**, precompilato con il valore
  letto da Fidra e modificabile: la conferma calcola il saldo da lì
- l'avviso spiega cosa fare quando la lettura fallisce

## Altre novità
- **Logo hotel** nell'intestazione al posto della scritta a testo
  (https://www.termeleonardo.com/img/logo.png — se l'ospite ha le immagini
  bloccate appare il testo alternativo "LEONARDO — TERME HOTEL ****")
- **Badge GSTC aggiornato** nelle 4 lingue: "Primo hotel termale in Europa
  certificato GSTC Hotel Standard…"
- **Logo GSTC predisposto** nei modelli, in commento: attivarlo quando
  l'immagine sarà caricata sul sito (verificare prima le linee guida GSTC
  sull'uso del marchio)

## File modificati rispetto alla v1.0
- manifest.json        → permessi outlook.office.com/outlook.live.com + nuovo content script (versione 1.1.0)
- outlook-inject.js    → NUOVO: inserisce l'email nell'editor di Outlook
- popup.js             → passa l'email via chrome.storage invece dei soli appunti
- template*.js         → logo hotel + badge GSTC nelle 4 lingue

## Aggiornamento
Sostituire l'intera cartella e premere **Ricarica** in edge://extensions/.
Alla prima apertura di Outlook, Edge può chiedere di approvare il nuovo
permesso per outlook.office.com: accettare.
