# Offerta Leonardo 2.29.0 - la sala al POS

4 settembre 2026.

## Cosa cambia

Sulla pagina del POS di Fidra, quella con la piantina dei tavoli, compare
in alto a destra una barra con due campi e un pulsante **Manda la sala al
POS**. Legge i tavoli della zona aperta - nome, posti e posizione sulla
pianta - e li manda alla nostra funzione `pos`. Una zona per volta: si
cambia scheda in Fidra (Interno, Hall, Esterno, Terrazza) e si preme di
nuovo.

I due campi si possono correggere prima di premere: il **locale** del
nostro POS (`bistrot` o `ristorante`, viene ricordato) e il **nome della
zona**, che l'estensione prova a leggere da sola dalla barra di Fidra.

## Perche'

Le zone e i tavoli in Fidra sono gia' disegnati al posto giusto: rifarli a
mano nel back office sarebbe un lavoro lungo e sbagliato in partenza. Cosi'
la piantina del palmare somiglia a quella che i camerieri conoscono.

## Cosa fa la nostra funzione con quello che arriva

Uniforma i nomi: in Fidra alcune zone dicono «Table 21» e altre «Tavolo 9»,
da noi diventano tutti «Tavolo». Un tavolo che c'e' gia' con lo stesso nome
nella stessa zona viene **spostato**, non sdoppiato. Niente viene
cancellato: i tavoli che abbiamo noi e Fidra no restano, e l'esito li
elenca.

## Cosa NON fa

Non salva e non modifica niente in Fidra: non clicca nemmeno. Usa la chiave
hotel gia' salvata dal pannello (`hotelKey`).

## File

`fidra-sala.js` (nuovo), `manifest.json` (nuovo content script su
`leonardo.fidra.cloud/pos/*`; versione 2.29.0).
