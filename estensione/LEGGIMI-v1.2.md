# Offerta Leonardo v1.2 — Preventivo rapido

Base: v1.1.1 completa (inserimento automatico in Outlook, caparra modificabile,
firma dall'operatore, categorie tradotte). Tutto il resto è invariato.

## Preventivo rapido

Apri l'estensione **senza** una prenotazione Fidra davanti (da Outlook, da
qualsiasi pagina): compare un modulo — cognome e nome (prima il cognome, come
in Fidra), email, date con conteggio notti, camere con prezzo a persona
(+ aggiungi camera), scadenza proposta a 7 giorni, acconto proposto a
75 €/adulto, riferimento pratica (es. P26/1008). Le cure si spuntano da sole
con le parole chiave o oltre 5 notti. Entrambi i pulsanti funzionano: "Copia e
apri Outlook" per un messaggio nuovo, "Prepara per la risposta" per rispondere
alla mail dell'ospite. Anche dagli errori "Pagina non pronta" / "Errore di
lettura" c'è il link "prepara un preventivo rapido".

## La caparra passa da Fidra, per scelta

L'email del preventivo rapido mostra **solo il bonifico** (causale =
riferimento pratica): il pulsante di pagamento con carta esiste solo dentro
Fidra, che registra la caparra da solo. Un incasso fuori da Fidra andrebbe
riportato a mano nel gestionale, col rischio di perderlo per strada.

Per questo il modulo ha il pulsante **"Prepara la bozza in Fidra"**: usa lo
stesso canale del centralino (fidra-booking.js) — apre /booking e il pannello
si compila da solo con date (anche a cavallo di mese), adulti, bambini,
trattamento, categoria richiesta e la ricerca cliente già scritta. Come sempre:
**il cliente lo scegli tu e il salvataggio è tuo**, la bozza non tocca niente
da sola. Dall'offerta salvata rigeneri l'email con il pulsante "Conferma Ora"
vero e la caparra che si registra automaticamente.

Il giro completo al telefono: modulo → email col bonifico subito all'ospite →
"Prepara la bozza in Fidra" → salvi l'offerta → (se serve il pagamento con
carta) riapri l'estensione dall'offerta e rigeneri.

Limiti del modulo: solo offerte, e per l'email soggiorni dentro lo stesso mese
(il modello scrive le date con un mese solo; a cavallo blocca e lo dice — la
bozza in Fidra invece passa). Le camere accessibili non compaiono fra le
proposte.

## Camere: quantità, non nomi

Nelle offerte e nelle conferme, in tutte e quattro le lingue, ogni camera ora
si presenta come **"1 Matrimoniale Queen"** (la quantità nel titolo) e sotto
riporta **il numero di ospiti** — "1 ospite", "2 ospiti", "2 Gäste", "2 guests",
"2 personnes" — mai più i nomi delle persone né il vecchio "1 ospite/i".
Il saluto resta ovviamente intestato all'ospite.

## Altre correzioni ai modelli

- **Check-in online**: la frase ora dice "prima dell'arrivo" (Anreise /
  arrival / arrivée), non più "prima di partire", in offerte e conferme.
- **Piscine del giorno di partenza**: la frase "…fino alle 18:30 · 30 € a
  persona, tariffa riservata ai nostri ospiti. Spogliatoi inclusi" sta su
  un'unica riga continua, senza a capo, nelle quattro lingue.

## Pannello laterale di Edge (barra sempre a lato)

Il modulo può restare **fisso a lato dello schermo** mentre navighi Fidra e
Outlook, senza chiudersi da solo come il popup:

- clic **destro** sull'icona dell'estensione → "Apri nel riquadro laterale",
  oppure la linguetta **"📌 Tieni fisso a lato"** in fondo al popup;
- nel pannello la larghezza si adatta e il modulo scorre per tutta l'altezza;
- per il preventivo rapido al telefono è la modalità comoda: resti sul
  pannello, compili, e con un clic apri Outlook o la bozza in Fidra.

## Il pannello dopo il riavvio di Edge

Edge (come Chrome) **non riapre il pannello laterale al riavvio**, e l'API delle
estensioni vieta di aprirlo senza un gesto dell'operatore: serve a impedire che
un'estensione si prenda mezzo schermo da sola. Non è aggirabile, ma la
riapertura ora costa un gesto solo:

- premendo "📌 Tieni fisso a lato" la scelta viene ricordata: da quel momento
  **il clic sull'icona nella barra apre direttamente il pannello**, non più la
  finestrella;
- in alternativa c'è la scorciatoia **Ctrl+Shift+L** (⌘+⇧+L su Mac), che apre il
  pannello da qualsiasi pagina;
- dentro il pannello, in fondo, un collegamento permette di tornare quando si
  vuole alla finestrella normale.

La preferenza sopravvive al riavvio: al lancio di Edge l'estensione la rilegge e
riconfigura l'icona.

## Day Spa da Outlook e coda solleciti

**Pulsante Day Spa in Outlook.** Le richieste sul Day Spa non passano da Fidra:
arrivano per email e basta rispondere. Ora, quando la mail aperta parla di
piscine, grotte o spa **e** di prezzi, orari, ingresso o biglietti, in basso a
destra compare "💧 Rispondi: Info Day Spa" (sopra il pulsante della bozza). Al
clic l'estensione riconosce la lingua della richiesta (IT/DE/EN/FR), usa il nome
del mittente per il saluto e prepara il modello: si preme **Rispondi** e il testo
si inserisce da solo, sopra la citazione. Le richieste di soggiorno restano al
pulsante della bozza in Fidra: i due non si pestano i piedi.

**Coda solleciti dalla home di Fidra.** Sulla pagina front-office, dove c'è la
sezione "Prenotazioni in scadenza", compare "✉ Coda solleciti (N)". Al clic
l'estensione mette in fila tutte le prenotazioni elencate (senza doppioni) e
apre la prima. Il popup, su una prenotazione della coda, mostra in cima
"1 di N · prossima → · chiudi" e si presenta **già su "Sollecito offerta"**:
rivedi l'email, la mandi, premi "prossima" e passi alla successiva.

Nessun invio automatico, mai: ogni email viene riletta e spedita da te. È la
regola di tutto il sistema e vale anche qui — un sollecito sbagliato mandato in
massa costerebbe più di quanto faccia risparmiare.

## Rifiniture dai casi reali (O26/18968 e conferme)

- **Bistrot** con la t finale, ovunque era scritto Bistro, in tutte le lingue.
- **Orario d'arrivo nelle conferme**: via il "anche di notte non è un problema"
  che suonava come un via libera; ora dice "Se prevede di arrivare dopo le
  22:00, la preghiamo di avvisarci in anticipo: ci organizziamo per riceverla
  anche a tarda ora" (equivalenti in DE/EN/FR).
- **Camere con periodi diversi** (come l'offerta Boos: Doppia 2–4 settembre +
  Queen per tutto il soggiorno): l'intestazione non dichiara più "dal X al Y,
  18 notti per 3 persone" — dice "Le sue camere la aspettano" e rimanda ai
  periodi scritti accanto a ogni camera. In quel caso il titolo di ogni camera
  diventa completo — "1 Doppelzimmer für 2 Personen vom 2. bis 4. September",
  "1 Queen-Doppelzimmer für 1 Person vom 2. bis 20. September" — così nessuna
  camera resta senza date: quella che coincide col soggiorno intero le mostra
  comunque, altrimenti sembrerebbe una dimenticanza. La riga separata con il
  numero di ospiti sparisce, perché è già nel titolo.
  Anche il totale perde il conteggio notti fuorviante, la riga Soggiorno delle
  conferme diventa "3 persone in 2 camere · periodi accanto a ogni camera" e il
  sollecito usa un'introduzione senza date. Con periodi uguali non cambia nulla.
- **Trattamenti diversi nella stessa prenotazione**: le camere **con pacchetto
  vanno in fondo** all'elenco, così la lunga descrizione del pacchetto non
  seppellisce le informazioni delle altre camere/persone (prima chi non ha il
  pacchetto, poi chi ce l'ha). Ogni riga camera resta con il suo trattamento e
  il suo prezzo.

## Due documenti nuovi: Sollecito offerta e Info Day Spa

I modelli di cortesia salvati in Outlook sono entrati nell'estensione, riscritti
con la grafica delle nostre email e in quattro lingue.

**Sollecito offerta** (dalla prenotazione in Fidra): il vecchio "saremmo
veramente molto dispiaciuti" diventa un richiamo cortese coi dati concreti —
date, notti, totale — e si adatta da solo: opzione **in scadenza** → "Le teniamo
la camera fino al X" con pulsante Conferma Ora e coordinate per l'acconto;
opzione **già scaduta** → niente pulsante, "la camera è tornata prenotabile:
ci scriva e verifichiamo la disponibilità". In coda l'uscita gentile: se i piani
sono cambiati basta un cenno. L'etichetta nel popup dice già quale variante uscirà.

**Info Day Spa** (da Fidra e dal preventivo rapido, dove basta il nome):
prezzi 35/45/29 € con orari, regola bimbi (gratis fino a 1 anno, poi tariffa
piena), pulsante di prenotazione sul sito nella lingua giusta (per il francese
la pagina inglese, la francese è in costruzione), cosa comprende (piscine e
grotte SPA), Bistro La Piazza e cena a buffet 35 €, kit SPA 19 €, camera
d'appoggio 60 €, cuffia obbligatoria, niente cani e niente pranzo al sacco.
Tutti i numeri vengono dai modelli della reception: nulla di inventato.

Nel preventivo rapido la scelta "Cosa prepariamo?" in testa al modulo nasconde
le sezioni del soggiorno quando serve solo il Day Spa.

## Bug sistemato

Il campo **Titolo** (Dr., Prof.) aveva lo stesso id dell'intestazione del
popup: il valore non arrivava mai all'email. Ora funziona in tutte le lingue,
anche in modalità Fidra.

## File modificati rispetto alla v1.1.1

- `popup.js` — preventivo rapido, bozza in Fidra, sollecito e Day Spa, bug del titolo
- `template-extra.js` — NUOVO: sollecito offerta e Info Day Spa nelle 4 lingue
- `fidra-scadenze.js` — NUOVO: coda solleciti dalla home di Fidra
- `outlook-inject.js` — pulsante “Rispondi: Info Day Spa”
- `popup.html` — carica template-extra.js
- `template.js`, `template-de.js`, `template-en.js`, `template-fr.js` —
  pulsante carta solo se il link di pagamento esiste (in modalità Fidra c'è
  sempre, come prima)
- `manifest.json` — versione 1.2.0, permesso `sidePanel` e riquadro laterale

## Aggiornamento

Sostituire l'intera cartella e premere **Ricarica** in edge://extensions/.
