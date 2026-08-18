# Offerta Leonardo v1.5 — solo da Fidra, e i segnalibri per tutti

## Offerte e conferme solo dalla prenotazione aperta

Il "Preventivo rapido" — offerte e conferme compilate a mano fuori da Fidra —
non c'è più: i dati ricopiati erano la porta degli errori. Fuori da Fidra il
popup ora offre solo l'**Info Day Spa** (l'unico documento senza soggiorno) e
indirizza ad aprire la prenotazione per tutto il resto. Con questo se ne vanno
anche il "Prepara la bozza in Fidra" del popup e il passaggio "Usa nel
preventivo" dal pannello disponibilità, che ora si chiama **"Copia la riga"**:
mette negli appunti categoria, trattamento, periodo, occupazione e prezzi.

## Pagina Documenti + segnalibri (per chi non ha l'estensione)

Nasce `documenti.html`: una pagina nostra (progetto Vercel arrivo-terme-leonardo)
con dentro TUTTI i modelli — offerta, conferma, sollecito, Day Spa, quattro
lingue, bonifico annunciato compreso. Il segnalibro **🧾 Documenti Leonardo**,
piccolo, legge la prenotazione aperta in Fidra e la porta alla pagina nel
frammento dell'indirizzo (che non lascia mai il browser: nessun dato viaggia
verso il server). Lì si sceglie documento, lingua, firma, e si copia l'email.

Il vantaggio dell'architettura: quando i modelli cambiano si aggiorna LA PAGINA,
e chi ha il segnalibro è aggiornato senza ritrascinare nulla.

La cartella `pagine-vercel` (fuori da questo zip) contiene le tre pagine e le
istruzioni per pubblicarle. Finché non sono pubblicate, il segnalibro Documenti
apre una pagina che ancora non esiste: prima il deploy, poi la distribuzione.

# Offerta Leonardo v1.4.3 — finestra mobile e notte per notte ovunque

- La finestra "Disponibilità e prezzi" non copre più lo schermo: **si sposta
  prendendola dalla barra del titolo**, così si affianca alla pagina di Fidra
  per confrontare i numeri. Idem il riquadro "Notte per notte". La pagina
  dietro resta viva e scorribile.
- **📐 Notte per notte** ora c'è su **tutte** le righe, non solo sui pacchetti:
  su qualsiasi trattamento elenca le notti alla tariffa del giorno (con l'uso
  singola compreso quando la ricerca è per una persona) — pronto da incollare
  nel riquadro "Prezzi" di Fidra. A settimane va **solo il Dolce Vita**; Smart,
  Deluxe e simili vanno notte per notte alla propria tariffa, con le cure
  elencate a parte.

# Offerta Leonardo v1.4.2 — il bonifico annunciato

## Conferme con la caparra ancora a zero

Molti clienti pagano con bonifico e mandano subito la copia per email: la
conferma parte prima che i soldi arrivino fisicamente. Finora l'email usciva
con "Acconto ricevuto 0,00 €" e saldo pieno — vero per la contabilità, ma
sbagliato verso il cliente, che il bonifico l'ha appena fatto.

Ora, quando si genera una **conferma** e in Fidra la caparra è a 0,00 con un
acconto previsto, il popup chiede cosa scrivere:

- **Bonifico annunciato** (predefinito): l'email dice "abbiamo ricevuto la
  copia del suo bonifico", la riga diventa "Acconto · bonifico annunciato,
  − 150,00 €" e il saldo è quello giusto, al netto dell'acconto. In tedesco
  "Wir haben die Kopie Ihrer Überweisung erhalten", e così in inglese e
  francese.
- **Davvero nessun acconto**: comportamento di prima, 0,00 e saldo pieno.

Il riquadro compare solo sulla conferma e ricorda anche l'altra possibilità:
se la caparra dovrebbe esserci ed è a zero, forse è solo da registrare in
Fidra.

# Offerta Leonardo v1.4.1 — lo scorporo dei pacchetti

## "Notte per notte": il conto che si faceva a mano

Fidra, per le camere con pacchetto, chiede il prezzo **notte per notte** e non
scorpora niente: il Dolce Vita copre settimane intere, i giorni in più vanno a
tariffa normale, e finora il conto si faceva a mano nel riquadro "Prezzi".

Ora, sulle righe con un pacchetto, quando il soggiorno non è fatto di settimane
esatte compare **📐 Notte per notte**. Il pannello calcola:

- quante notti copre il pacchetto (le settimane intere) e quante restano;
- il prezzo del pacchetto a notte dal **listino Dolce Vita** (Werbesaison e
  Spezial, con i rispettivi periodi): per la Queen è la riga "Einzelzimmer",
  cioè 130 € in Werbesaison, già in uso singola;
- i giorni extra alla tariffa Fidra di quel giorno più il supplemento uso
  singola della categoria (Queen 15 €, Doppia 50 €, suite 60 €);
- le cure del pacchetto, voce per voce, e il totale a persona.

Un pulsante copia l'elenco pronto da incollare nel riquadro "Prezzi" di Fidra.

### Cosa non può indovinare

Le tariffe di Fidra sono **flessibili**: cambiano con l'occupazione e col tempo.
Sulla prenotazione Boos il pannello oggi calcola 140 / 140 / 140 / **145** per le
notti fuori pacchetto, mentre nell'offerta inviata a suo tempo c'era
140 / 140 / 140 / **155**: dieci euro di differenza sull'ultima notte, un sabato,
perché quella tariffa nel frattempo è scesa da 140 a 130. Non è un errore del
calcolo — le prime tre notti coincidono al centesimo — ma è la ragione per cui
i numeri vanno riletti prima di salvarli, soprattutto su un'offerta preparata
giorni prima.

Se il periodo cade fuori dalle finestre del listino, il pannello lo dice e ricava
il prezzo da Fidra invece di fingere di saperlo.

# Offerta Leonardo v1.3.2 — disponibilità più intelligente

## L'ordine segue chi deve dormirci

Le categorie ora si ordinano in base all'occupazione richiesta: con **1 persona**
le singole vengono per prime, con **3 persone** prima le camere che ne tengono
tre (Junior Suite), poi a scendere. Con bambini al seguito, le categorie che non
li accettano scendono. Le accessibili restano sempre in fondo, segnate.

## Le categorie senza camere libere non compaiono più

Prima restavano in elenco sbiadite: allungavano la lista senza dire nulla. Se
non c'è nemmeno una camera libera per tutte le notti, la categoria sparisce; se
non ce n'è nessuna in tutto l'hotel, il pannello lo dice in una riga sola.

## Supplemento uso singola: correggibile e memorizzato

Fidra tiene il supplemento uso singola in archivio ma non lo applica da solo:
il pannello lo somma. I valori attuali sono Queen 15 €, Doppia 50 €, suite 60 €,
niente sulle singole. Se un domani un valore non fosse quello giusto, quando
cerchi per **1 persona** accanto alla categoria c'è un campo con gli euro a
notte: lo correggi una volta e resta memorizzato, e la riga scrive "corretto da
te" così si vede che non è il dato del gestionale.

Restano da fare a mano i pacchetti a notti fisse con giorni in più (il Dolce
Vita parte di sabato e finisce di sabato): quelli il gestionale non li espone in
una forma calcolabile, e il pannello lo dichiara invece di indovinare.

# Offerta Leonardo v1.3.1 — correzioni

## Soggiorni a cavallo di due mesi

Su una prenotazione come la 18973 (25 Aug → 03 Sep) il popup rifiutava di
generare: "mancano il numero di notti e l'anno di arrivo". La lettura accettava
un solo mese ("9 Notti dal 25 - 03 Sep") e su "25 Aug - 03 Sep" non trovava
nulla; senza le date saltava anche la deduzione dell'anno.

Ora il periodo viene letto in entrambe le forme, l'estensione tiene mese e anno
**di partenza** separati (quindi regge anche dicembre → gennaio) e le email
scrivono le date per esteso: "dal 25 agosto 2026 al 3 settembre 2026", con gli
equivalenti in tedesco, inglese e francese. Lo stesso vale per il periodo di una
singola camera quando le camere hanno date diverse. Anche il **preventivo
rapido** non ha più il limite del mese unico: si può fare un soggiorno a cavallo
senza spezzarlo.

## Il link di pagamento non blocca più

Mancando il link di pagamento (per esempio con caparra a 0,00 €) l'offerta non
si generava affatto. Dalla v1.2 i modelli sanno già stare senza — mostrano solo
il bonifico — quindi ora non è più un errore bloccante ma un avviso: "l'offerta
uscirà solo con il bonifico, senza il pulsante per la carta". Se lo vuoi, generi
il link in Fidra e riapri.

# Offerta Leonardo v1.3 — novità

## Disponibilità e prezzi: i numeri di camera che Fidra non mostra

Dentro Fidra, in basso a destra, c'è "🔎 Disponibilità e prezzi". Si sceglie il
periodo, quanti adulti e quanti bambini (con l'età, che cambia il prezzo) e il
pannello risponde a due domande che il gestionale lascia scoperte:

**Quali camere, non quante.** Per ogni categoria compaiono i **numeri** delle
camere libere per tutte le notti del periodo: se l'ospite chiede la 413 fix dal
10 al 13, si vede subito se c'è. Un clic sul numero lo copia. Le camere occupate
anche una sola notte del periodo non compaiono; la categoria Fittizia è esclusa;
le accessibili restano in fondo, segnate "solo su richiesta".

**Quanto costa davvero.** Per ogni trattamento: prezzo a persona e totale del
soggiorno, con il **supplemento uso singola** calcolato (Fidra ha il dato nella
categoria ma il modulo non lo applica) e i **bambini conteggiati per età**, con
il dettaglio riga per riga. Le categorie troppo piccole per il gruppo lo dicono,
invece di mostrare un prezzo che non si potrebbe applicare.

Il pulsante **"Usa nel preventivo"** passa la riga scelta al preventivo rapido
dell'estensione: date, occupazione, categoria, trattamento e prezzo si trovano
già compilati, con un promemoria di rileggerli.

I dati arrivano dalle stesse API che alimentano il motore del sito
(`/api/available/rooms` e `/api/available/rates`), lette dentro la sessione di
Fidra già aperta: nessuna chiave, nessun dato che esce. Il supplemento uso
singola qui viene calcolato come importo di categoria × notti: se sul sito il
totale non torna, vince il sito — il pannello lo scrive.

Il preventivo rapido a mano resta com'era: questo si aggiunge, non lo sostituisce.

# Offerta Leonardo v1.2 — novità

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
