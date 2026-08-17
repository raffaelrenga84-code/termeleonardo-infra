# Le richieste dal sito: contatti, trattamenti veri, e una scheda che si può correggere

*15 agosto 2026 — decisioni prese con la proprietà*

## Tre cose trovate guardando la stessa schermata

**1. Il back office non dice di che richiesta si tratta.** L'elenco mostra
periodo, notti e ospiti — i campi di un *soggiorno* — per ogni richiesta,
anche quando è un transfer o dei trattamenti. Per quelle, quei campi sono
vuoti, e in schermata si legge:

> `→` · **null notti · null ospiti**

Chi guarda non sa se deve chiamare le terme, i tassisti o il campo da golf.
E il contenuto vero della richiesta — quali trattamenti, che giorno, a che
ora, da quale aeroporto — **non si vede da nessuna parte**, pur essendo
salvato per intero nella colonna `dati`.

**2. Il telefono non è obbligatorio.** Né nel modulo (`pagine/richieste/index.html`,
il controllo guarda solo nome ed email) né sul server (`valida.ts` pretende
un'email valida, del telefono controlla solo la lunghezza). Si può quindi
chiedere un massaggio per giovedì mattina senza lasciare un numero. Se poi
l'orario va spostato — e si sposta spesso — l'operatore non ha modo di
chiamare, e resta a mandare un'email sperando che venga letta in tempo.

**3. I trattamenti del modulo sono otto; ne esistono ventuno.** Il modulo ha
un elenco scritto a mano dentro la pagina. Il listino vero, quello che decide
anche i prezzi dei buoni regalo, ne ha ventuno in quattro gruppi. E i nomi
non coincidono nemmeno per quelli presenti:

| Nel modulo | Nel listino |
|---|---|
| Antistress (45–55 min) | Massaggio antistress (45 min) |
| Anti-age acido ialuronico (55 min) | Trattamento anti-age all'acido ialuronico (55 min) |

Mancano fra gli altri Riflessologia plantare, Shiatsu, Pindasweda, Body
Candle, lo Scrub del Mar Morto, il riducente-anticellulite e **tutti e cinque
i Programmi benessere** — che sono anche i più cari, da 90 a 130 €.

## Le decisioni

### Il telefono diventa obbligatorio, e l'email resta obbligatoria

Su **tutte** le richieste: trattamenti, transfer, green fee, maestro,
soggiorno. Una regola sola, uguale dappertutto, che nessuno deve ricordarsi.

Servono tutti e due e servono per cose diverse:

- **il telefono** perché ognuna di queste è un appuntamento che si può
  spostare — il taxi per un volo in ritardo, la partenza al campo, il
  lettino del massaggio — e per spostarlo bisogna poter chiamare;
- **l'email** perché è il canale su cui arriva la conferma scritta con
  giorno e ora. Senza, l'ospite non ha niente da rileggere e l'hotel non ha
  niente da mostrare se poi contesta.

Il controllo va in tutti e due i posti: nella pagina perché l'ospite se ne
accorga mentre compila, e sul server perché la pagina non è una difesa —
basta una chiamata diretta per saltarla.

*(Costo accettato: qualche richiesta in meno da chi non vuole lasciare il
numero. Una richiesta senza un contatto raggiungibile vale poco: diventa
un'email che nessuno risponde e un appuntamento che salta.)*

### I trattamenti si prendono dall'unica fonte

Non si aggiungono a mano i tredici mancanti: sarebbe un **terzo** elenco che
diverge dagli altri due entro un mese. Questo progetto ha già pagato questo
difetto coi prezzi dei buoni, e per quello esiste `listino-copie.test.ts`.

I trattamenti vivono in un modulo condiviso, con i **nomi esatti del
listino** e i **quattro gruppi** (Programmi benessere, Massaggi, Viso e
corpo). Gli ingressi Day Spa restano fuori: sono un ingresso, non un
trattamento, e si prenotano altrove.

Il test che confronta le copie va **esteso** al modulo nuovo: se un nome
cambia in un posto solo, deve fallire.

Perché conta che i nomi coincidano: la reception riceve la richiesta e la
ricopia nel gestionale del centro benessere. Un nome che non corrisponde a
nessuna voce del listino è una voce da cercare a mano, e un prezzo che
qualcuno deve indovinare.

### La scheda mostra il tipo e il contenuto

Ogni tipo con la sua etichetta e la sua riga di riepilogo, al posto di
periodo/notti/ospiti:

| Tipo | Riga di riepilogo |
|---|---|
| Trattamenti | `3 trattamenti · 21 agosto · mattina` |
| Transfer | `Venezia aeroporto → hotel · 15 ago 15:30 · 2 persone` |
| Green fee | `Montecchia · 10 set 09:30 · 2 giocatori` |
| Maestro | `10 set 09:30 · 2 persone · principiante` |
| Soggiorno | periodo, notti, ospiti — come oggi |

Nella scheda aperta, il contenuto della richiesta compare **dentro campi
modificabili**, non come testo da rileggere: le voci scelte, il giorno,
l'ora, la fascia, il luogo, i passeggeri, le note. Quello che c'è dipende
dal tipo.

### L'originale non si perde

Oggi correggere una richiesta **sovrascrive** `dati`: di quello che l'ospite
aveva chiesto non resta niente.

Si aggiunge una colonna che conserva la richiesta **come è arrivata**,
scritta una volta sola alla creazione e mai più toccata. Dove la reception ha
cambiato qualcosa, la scheda lo mostra accanto — *«aveva chiesto la
mattina»* — e chi apre quella richiesta fra sei mesi sa cosa è successo.

Per le quattro richieste già in tabella, che non sono mai state modificate,
la colonna si riempie con i dati attuali: sono gli stessi.

### Quando si conferma, l'operatore sceglie se dirlo

Una casella nel back office: **«segnala all'ospite cosa è cambiato»**. Se
spuntata, l'email di conferma affianca ai dati definitivi una riga su quello
che è stato spostato — *«aveva chiesto la mattina, le confermiamo il
pomeriggio»*. Nelle quattro lingue.

**Nasce già spuntata quando qualcosa è davvero cambiato**, spenta quando non
è cambiato niente. L'operatore la toglie in un clic se ha già sentito
l'ospite al telefono. Il motivo è che i due errori non pesano uguale:
segnalare una cosa che l'ospite sapeva già è un fastidio piccolo; non
segnalarne una che non sa è un ospite che si presenta all'ora sbagliata,
convinto di avere ragione.

## Cosa NON cambia

**Il server accetta già le correzioni.** L'azione `?a=conferma` in
`richieste/index.ts` riceve un `dati` corretto, lo **rivalida con le stesse
regole del modulo** — così non si può confermare un transfer con un luogo
che i tassisti non hanno in elenco — manda all'ospite i dati definitivi e li
salva. Non va rifatto: va usato. Il lavoro nuovo è quasi tutto nella pagina.

Non cambiano: come nascono le richieste, la numerazione, l'email che avvisa
l'hotel, gli stati (da guardare / vista / risposta / chiusa).

## I punti dove si sbaglia, e i presidi

**La validazione solo nella pagina.** Il telefono obbligatorio scritto solo
nel modulo è una cortesia, non una regola: va anche in `valida.ts`, con un
test.

**Il tipo che arriva dal database.** Le etichette per tipo si scelgono con un
elenco chiuso o `Object.hasOwn`, mai `OGGETTO[tipo]`. Questo progetto ha
chiuso sei occorrenze di questo difetto oggi stesso; non se ne apre una
settima.

**La riga di riepilogo su dati incompleti.** Le richieste vecchie possono non
avere tutti i campi. Nessuna riga deve mai mostrare `null`, `undefined` o
`NaN`: è esattamente il difetto da cui parte questa specifica. Va presidiato
da test su dati mancanti, non solo su dati completi.

**Il confronto fra originale e corretto.** Va fatto su valori, non su
oggetti: due elenchi di trattamenti con le stesse voci in ordine diverso non
sono una modifica. Un test lo fissa.

**Le quattro lingue.** La riga sul cambiamento senza tutte e quattro è
incompleta, come ogni altro testo mostrato all'ospite.

## In che ordine

Le tre cose sono indipendenti e ognuna sta in piedi da sola:

1. **I contatti obbligatori** — poche righe, effetto immediato, nessuna
   dipendenza. Da fare per prima.
2. **I trattamenti dall'unica fonte** — il modulo comincia a offrire i
   ventuno veri, coi nomi giusti.
3. **La scheda** — il pezzo più lungo: riepilogo per tipo, campi
   modificabili, colonna dell'originale, casella e riga nell'email.
