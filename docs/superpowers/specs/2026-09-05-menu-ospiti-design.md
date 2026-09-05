# Il menù per l'ospite: nomi tradotti, descrizioni, allergeni

Approvato dalla proprietà il 5 settembre 2026 («Vai» sui punti 1 e 2).

## Perché

La pagina dell'ordine dal tavolo (`/ordina`) mostra i nomi interni del POS,
in maiuscolo, con refusi, solo in italiano. L'ospite è spesso tedesco o
inglese, e il menù stampato («La Piazza Bistrot», PDF 2026) ha nomi puliti,
ingredienti, allergeni, in italiano e tedesco. Il POS resta com'è (serve ai
camerieri e alle stampanti); cambia solo cosa vede l'ospite.

## Cosa cambia

1. **Sull'articolo** tre campi nuovi: `nomi` (jsonb `{it,en,de,fr}`),
   `descrizioni` (jsonb, gli ingredienti), `allergeni` (testo, i codici del
   menù: GL, LA, U, CR, P…). La pagina dell'ospite mostra `nomi[lingua]`, se
   manca `nomi.it`, se manca il nome del POS; sotto, la descrizione nella
   lingua; gli allergeni come sigle piccole. Il palmare non li usa.
2. **Sulla categoria** un campo `nomi` (jsonb) con il nome per l'ospite nelle
   quattro lingue («Vetrinetta» → «Dalla vetrinetta», «From the counter»…).
3. **Cosa vede l'ospite**: `per_ospiti = false` su «Varie», «Menu» e «Del
   Giorno» (finché la proprietà non decide i prezzi doppi). Il resto resta.
4. **Il riempimento**: uno script (`strumenti/menu-ospiti.js`) con il
   dizionario del PDF — italiano e tedesco dalla carta, inglese e francese
   tradotti — per il cibo, i dolci, la vetrinetta e le bevande generiche
   (acque, caffetteria, tè). Le marche (Coca Cola, Campari…) non si toccano.
   Lo script si può rieseguire; non tocca i prezzi.
5. **Il back office** (POS · Menù): un pulsante «🌐» per articolo apre i
   campi nomi/descrizioni/allergeni; le categorie hanno i nomi tradotti.
   Le correzioni della proprietà sopravvivono a una riesecuzione dello
   script solo se lo script non riscrive quel campo: lo script scrive
   soltanto dove il campo è vuoto.

## Non in questa fase

Gli orari del menù (cucina 12:15–14:30, gli «X» fino alle 17:30, venerdì e
sabato 20:30): seconda fase, con un orario per categoria.

## Prove

- `ospite-menu` restituisce `nomi`, `descrizioni`, `allergeni` e i `nomi`
  delle categorie (prova del contratto su index.ts).
- La pagina usa `nomi[LINGUA] || nomi.it || nome` (prova sul sorgente).
- Lo script in prova a vuoto elenca cosa scriverebbe; le due incongruenze di
  prezzo con il PDF (Veggie Delizia, Bruschetta) restano in attesa.
