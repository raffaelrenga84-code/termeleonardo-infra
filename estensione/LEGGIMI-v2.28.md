# Offerta Leonardo 2.28.0 - Privacy al totem

4 settembre 2026.

## Cosa cambia

Sulla prenotazione aperta in Fidra compare in alto a destra un pulsante
**Privacy al totem**. Al check-in la reception lo preme: per ogni camera
assegnata l'estensione manda alla nostra funzione `privacy` cognome, nome,
email, lingua (dal paese), camera, date e numero della prenotazione, letti
dalla pagina con `extractor.js`. Da quel momento l'ospite che passa la
tessera al totem, o che la reception sceglie sull'iPad
(`hoteltermeleonardo.com/ingresso-totem?privacy=1`), trova il modulo del
consenso gia' compilato: legge, tocca tre volte, firma col dito.

## Perche'

Il modulo privacy di Fidra sugli iPad fa scrivere cognome, nome ed email
all'ospite, con la tastiera che copre il modulo e la firma in fondo a tutta
l'informativa. Il nostro non fa scrivere nessuno. Il consenso resta da noi
(tabella `consenso`, scheda «Privacy» nel back office con la stampa).

## Cosa NON fa

Non salva e non modifica niente in Fidra: la spunta privacy in Fidra resta
a mano. Usa la chiave hotel gia' salvata dal pannello (`hotelKey`).

## File

`fidra-privacy.js` (nuovo), `manifest.json` (aggiunto ai content script
della prenotazione, dopo `extractor.js`; versione 2.28.0).
