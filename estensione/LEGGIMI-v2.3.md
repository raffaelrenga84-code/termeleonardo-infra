# Offerta Leonardo v2.3.0 — il modulo dei tassisti si compila da solo

## Cosa cambia

Dal back office, aprendo una richiesta di **transfer**, c'è ora **«Apri su
ATAM già compilato»**. Si preme, si apre atam.biz e il modulo è pieno: data,
ora, pax, arrivo o partenza, luogo, nome del cliente, dettagli e note.
In basso a destra un pannello dice campo per campo cos'è entrato.

**Prenota lo premi tu.** L'estensione non salva mai niente, come su Fidra.

**Pagamento e individuale/collettivo non li tocca**: la richiesta non li dice,
e sceglierli sarebbe indovinare. Restano come li trova (il loro predefinito è
Diretto, che è anche il nostro caso normale).

## Perché non è un link

Il primo tentativo era un indirizzo precompilato — niente da installare,
funziona anche dal telefono. Provato dal vivo:

    atam.biz/prenotazioni/?pax=3&note_cliente=Prova
    → Pax resta 1, Nome del cliente resta vuoto

La loro vista Django ignora la query. Il link non esiste, e serve un content
script. Chi non ha l'estensione continua a usare il copia campo per campo,
che resta.

## Come viaggiano i dati

Nel **frammento** dell'indirizzo, tutto ciò che sta dopo il `#`: il browser
non lo manda mai al server, quindi atam.biz riceve la richiesta della pagina e
basta. È lo stesso meccanismo del segnalibro «Documenti Leonardo». Letto una
volta, viene tolto dall'indirizzo, così non resta nella cronologia.

## I due campi che vivono in jQuery

La data è un `bootstrap-datepicker`, il luogo una tendina `Chosen`: nessuno
dei due si lascia scrivere da un content script, che vive in un mondo isolato.
Il comando parte dal service worker con `world: 'MAIN'` — esattamente come
`LEONARDO_SET_DATE` fa già per il flatpickr di Fidra.

Due cose imparate provando, non leggendo:

- **Il formato della data è `dd/mm/yyyy`**, non il predefinito `mm/dd/yyyy`:
  `language: "it"` lo cambia davvero. `setDate` con una data vera scavalca il
  problema comunque.
- **Il confronto esatto sul nome del luogo non scatta mai.** `option.text`
  comprime i doppi spazi, e mezzo elenco dei tassisti ne ha uno dentro —
  «Venezia  aeroporto», «Terme  Euganee FS» — quindi quelle voci non
  combaciano nemmeno con se stesse. È il confronto normalizzato a fare il
  lavoro.

## Collaudo

Fatto contro il **modulo vero**, salvato con tutti i suoi script (jQuery,
bootstrap-datepicker con la lingua italiana, Chosen, timeWidgets) e servito in
locale: la catena completa, dal frammento fino ai campi, con tutti e nove i
valori riletti dal modulo dopo la compilazione. Nessuna chiamata a atam.biz.

## File

- `atam-booking.js` — NUOVO
- `background.js` — gestore `ATAM_SET_DATE` / `ATAM_SET_LUOGO`
- `manifest.json` — versione 2.3.0, permesso `atam.biz`, content script

## Aggiornamento

Sostituire l'intera cartella e premere **Ricarica** in `edge://extensions/`.
Alla prima apertura di atam.biz Edge chiederà di approvare il nuovo permesso:
accettare.
