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

## Fase 2: gli orari (approvata il 5 settembre 2026, «Procedi con orari»)

Il menù stampato dice: «Piatti disponibili dalle ore 12:15 alle 14:30.
"X" disponibile fino alle ore 17:30, venerdì e sabato fino alle ore 20:30».

1. **Una riga di testo** `orari` sulla categoria e sull'articolo, nel
   formato «12:15-14:30; ven,sab 12:15-20:30» (parti separate da `;`,
   davanti alle ore i giorni: «ven,sab» o «lun-ven»; vuoto = sempre).
   L'articolo vince sulla categoria; la categoria dentro un'altra eredita.
   Modulo puro `orari.ts`: `leggiOrari`, `apertoOra`, `restringi`,
   `stampanteAdesso`.
2. **Chi ordina dal QR** vede la voce chiusa (grigia, col suo orario nella
   sua lingua) ma non la aggiunge; il server rifiuta comunque un ordine
   fuori orario («non a quest'ora»). **La fine si anticipa di dieci
   minuti** per l'ospite (`MARGINE_OSPITI`): alle 14:30 in punto la cucina
   non deve trovare un ordine nuovo. Il palmare non guarda gli orari.
3. **A cucina chiusa il biglietto esce al bancone.** Sul locale
   (`pos_locale.orari_cucina`, back office → POS · Tavoli) si scrivono gli
   orari della cucina; fuori da quelli ogni biglietto «cucina» esce sulla
   stampante del bar con in cima «>>> CUCINA CHIUSA: AL BANCONE». Vale per
   il palmare e per il QR, nel cloud e sul PC del Bistrot.
4. **Riempimento** (`strumenti/orari-menu.js`, solo dove vuoto): le sei
   categorie del cibo prendono «12:15-14:30»; gli articoli con la «X» che
   si riconoscono dal PDF (Mozzarella di bufala, Cannelloni, le tre
   insalatone, i tre hamburger) «12:15-17:30; ven,sab 12:15-20:30»; il
   locale Bistrot `orari_cucina` «12:15-14:30». Quali piatti abbiano
   davvero la X va controllato sulla carta: il simbolo si perde nel PDF.
5. **La rete dell'hotel** può essere più di un IP (`POS_IP_OSPITI`, lista
   separata da virgola, con `TOTEM_IP` come riserva); chi è fuori legge
   nel messaggio l'indirizzo che il server ha visto.
