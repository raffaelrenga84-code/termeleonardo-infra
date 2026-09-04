# Offerta Leonardo 2.27.0 - gli articoli di Fidra al POS

4 settembre 2026.

## Cosa cambia

Sulla pagina degli articoli di Fidra (`admin/resources/items`) compare in
alto a destra un pulsante **Manda gli articoli al POS**. Legge la tabella
pagina per pagina (l'unico clic che fa su Fidra e' su "Prossimo") e manda
intestazioni e righe alla funzione `pos`, che riconosce le colonne dal nome
e assegna da sola a ogni categoria la stampante (bar o cucina) e la portata.
Il listino del POS nasce cosi'; ripremendo il pulsante si aggiorna: gli
articoli gia' noti cambiano solo il nome, quelli nuovi entrano, prezzi e
stampanti sistemati a mano nel back office restano.

## Perche'

Il POS nostro (`hoteltermeleonardo.com/pos`, solo dall'IP dell'hotel) parte
dal listino che il Bistrot usa gia' in Fidra: ricopiarlo a mano sono
centinaia di righe, e ogni cambio di prezzo andrebbe fatto due volte.

## Cosa NON fa

Non salva e non modifica niente in Fidra. Usa la chiave hotel gia' salvata
dal pannello (`hotelKey`); se manca o e' sbagliata lo dice e si ferma.

## File

`fidra-articoli.js` (nuovo), `manifest.json` (nuovo content script su
`admin/resources/items*`, versione 2.27.0).
