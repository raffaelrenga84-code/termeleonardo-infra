# Offerta Leonardo 2.33.0 - gli articoli si chiedono, non si leggono

4 settembre 2026.

## Cosa cambia

«Manda gli articoli al POS» non legge piu' la tabella dallo schermo: chiede
l'elenco completo allo stesso indirizzo che usa Fidra
(`/nova-api/items`, cento articoli per volta) con la sessione gia' aperta
della reception. Niente pagine da sfogliare, niente attese, niente righe
perse. Se quell'indirizzo non rispondesse, il pulsante torna a leggere la
tabella come prima.

## Perche'

Fidra e' fatto con Laravel Nova: la tabella non sta nella pagina, la
disegna il browser dopo. Salvare la pagina non serviva a niente, e leggerla
dallo schermo funzionava male.

## Cosa NON fa

Non salva e non modifica niente in Fidra: chiede e basta. Usa la chiave
hotel del pannello (`hotelKey`).

## File

`fidra-articoli.js`, `manifest.json` (2.33.0).
