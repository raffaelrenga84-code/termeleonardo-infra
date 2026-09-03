# Il preventivo che parte dalla richiesta

*3 settembre 2026 — deciso con la proprietà in brainstorming*

## Perché

Il preventivo senza Fidra esiste: dal pannello «Disponibilità e prezzi» si scelgono
fino a quattro sistemazioni e «Crea preventivo e apri Outlook» scrive l'email nella
lingua dell'ospite. Ma il pannello riceve dalla richiesta letta in Outlook solo nome,
email, lingua, cure, cane e telefono: **date e persone le ribatte l'operatore**, e
l'alternativa la sceglie a mano.

E il lettore delle email, sul tedesco, perde troppo. Provato il 3 settembre 2026 su
dieci richieste tedesche realistiche: **sei escono senza date**. Sfuggono «Anreise:
05.11.2026, Abreise: 12.11.2026», «12.-19.10.2026», «vom 3. bis zum 10. Oktober»,
«7 Nächte ab 20.09.2026», «eine Woche ab dem 20. September», «Anreise Sonntag
15.11., 5 Nächte». Inoltre «Fangokur» non conta come cure, «HP» non è mezza pensione,
«2 Personen und 1 Kind» dà un adulto solo, «6 und 9 Jahre» legge solo il 9.

E l'italiano non sta meglio: su dieci richieste italiane realistiche, **cinque escono
senza date**. Sfuggono «Arrivo 05/11/2026 partenza 12/11/2026», «3 notti dal 3
ottobre», «una settimana a partire dal 20 settembre», «4 notti a novembre, arrivo
domenica 15», «dal 6 all'8 dicembre». «Siamo in 2» non conta le persone, «per due
coppie, due camere matrimoniali» dà 2 adulti invece di 4, «(6 e 9 anni)» legge solo
il 9, «HB» non è mezza pensione. «Una settimana a fine settembre» giustamente non dà
date: lì non c'è niente da indovinare.

Sono le stesse forme in due lingue: le regole si scrivono una volta e valgono in
tutte e quattro, come già fa il lettore.

Tre pezzi, nell'ordine in cui i dati scorrono: il lettore, quello che si mette da
parte, il pannello. Nessun servizio nuovo, niente che esce dall'hotel, l'ultimo clic
resta dell'operatore.

## 1. Il lettore delle email (`estensione/outlook-inject.js`)

Regole in più, dentro `leggiDate()` e `parseLibera()`, ognuna con la sua prova. Le
forme già lette continuano a leggersi uguali: le prove esistenti non si toccano.

**Date** (`leggiDate`), nelle quattro lingue:

- etichettate: «Anreise[:] 05.11.2026 … Abreise[:] 12.11.2026», «Arrivo 05/11/2026
  partenza 12/11/2026», «Arrival … departure», «Arrivée … départ», anche con i mesi a
  parole e con il giorno della settimana in mezzo («Anreise Sonntag 15.11.»);
- compatte: «12.-19.10.2026», «12. bis 19. Oktober» (senza «vom»), «vom 3. bis zum
  10. Oktober», «bis einschließlich», «dal 6 all'8 dicembre» (l'apostrofo, con o
  senza spazio);
- arrivo più durata: «7 Nächte ab 20.09.2026», «für eine Woche ab dem 20.
  September», «zwei Wochen», «3 notti dal 3 ottobre», «una settimana a partire dal
  20 settembre», «5 nights from 12 October», «une semaine à partir du 20 septembre».
  «Nächte/notti/nights/nuits» e «Woche/settimana/week/semaine» danno le notti; con
  «Tage/giorni/days/jours» le notti sono una **deduzione** (`nottiDedotte`), e
  l'anteprima lo dichiara come fa già per adulti e trattamento;
- giorno senza mese col mese altrove: «4 notti a novembre, arrivo domenica 15».
  Si usa il mese solo se nel testo ce n'è **uno solo**; con due mesi non si
  indovina niente;
- l'anno mancante si deduce come oggi (`annoDedotto`).

Ordine di prova: prima le forme etichettate (Anreise/Abreise), poi quelle di oggi
nell'ordine di oggi, poi le compatte tedesche, poi arrivo più durata. Una forma nuova
si prova solo se le precedenti non hanno prodotto una data: è la regola già scritta
per «dal 25/09 al 3/10», e vale per tutte.

**Persone** (`parseLibera`):

- «2 Erw.» e «2 Pers.» valgono come «Erwachsene» e «Personen»;
- «2 Personen und 1 Kind» fa **2 adulti e 1 bambino**. Il totale si riduce dei
  bambini solo quando il testo lo dice: «davon», «inkl.», «including», «di cui»,
  «dont», o i bambini fra parentesi subito dopo il totale. Con «und», «+», «sowie»,
  «e», «and», «et» si somma. Il caso inglese già coperto («three guests (2 adults, 1
  girl)») resta uguale: lì gli adulti sono scritti;
- «siamo in 2», «in 2», «per 2» valgono come «in due»; «N coppie» fa 2N adulti e
  vince su «per due»; «due camere matrimoniali» fa due camere e quattro adulti anche
  quando una forma generica ha già letto un numero;
- età: «6 und 9 Jahre», «6 e 9 anni», «6, 9 Jahre», «(6 und 9)» leggono tutte le
  età, non solo l'ultima. Solo età da bambino (0–17), come oggi.

**Trattamento**: «HP», «HB» → Mezza Pensione; «VP», «FB» → pensione completa (con la
risposta di sempre: solo mezza, pranzo al Bistrot); «ÜF», «Übernachtung mit
Frühstück», «BB» → Bed & Breakfast. Le sigle si accettano solo come parola intera
in maiuscolo («HP», non «hp» dentro un'altra parola).

**Cure**: «Fangokur», «Fangopackungen», «Fangotherapie», «Thermalkur», «Kur» (parola
intera), «Kuraufenthalt», «Anwendungen».

**Cane**: «Hündin», «Vierbeiner», oltre a «Hund», «Hunde».

**Camera**: «Zweibettzimmer» come doppia (2 persone). E una cosa nuova, la
**categoria chiesta** (`categoriaChiesta`): una parola chiave fra `superior`,
`queen`, `junior`, `suite`, `singola|einzel|single`, letta dal testo in qualunque
lingua. È una parola chiave, non un nome: si confronta poi col nome della categoria
che il motore restituisce, ridotto a minuscole. «Doppelzimmer», «doppia», «DZ» non
danno una categoria: sono un tipo di camera, e la casa ne ha tre.

Sinonimi: `Juniorsuite`, `Junior-Suite` → `junior`; `Superiorzimmer`,
`Doppelzimmer Superior` → `superior`. **I nomi vecchi delle categorie**, cambiati di
recente, si aggiungono alla stessa tabella quando la proprietà li fornisce, uno per
riga con la sua prova; un nome vecchio che non contiene nessuna parola chiave non
viene riconosciuto e il pannello non pre-spunta niente — non indovina.

**Lingua** (`linguaTesto`): parole tedesche in più — «Anreise», «Abreise», «Zimmer»,
«Nächte», «Übernachtung», «Doppelzimmer», «Halbpension», «Angebot», «Anfrage» — così
anche un'email di due righe viene riconosciuta come tedesca.

## 2. Cosa si mette da parte (`ricordaRichiesta`, chiave `leonardo_richiesta`)

Oltre a quello che c'è (quando, ospite, email, telefono, lingua, cure, cane, oggetto):

| campo | da dove | forma |
|---|---|---|
| `arrivo`, `partenza` | `dati.arrivo/partenza` | ISO `AAAA-MM-GG` (con `isoDaLetta`) |
| `notti` | `dati.notti` | numero |
| `adulti`, `bambini` | `dati.adulti/bambini` | numeri |
| `etaBambini` | `dati.etaBambini` | «6 9», come oggi nell'anteprima |
| `trattamento` | `dati.trattamento` | «Mezza Pensione» / «Bed & Breakfast» |
| `categoriaChiesta` | `dati.categoriaChiesta` | parola chiave |
| `nCamere` | `dati.nCamere` | numero |
| `dedotti` | i flag `*Dedott*` | elenco di parole: `adulti`, `trattamento`, `notti` |

Un campo che il lettore non ha prodotto non si scrive. Validità un'ora, come oggi.
Si salva quando l'operatore preme il pulsante in Outlook, come oggi.

## 3. Il pannello (`estensione/fidra-disponibilita.js`)

**Quando si compila.** All'apertura, se sulla pagina **non** c'è una prenotazione
(`datiPrenotazione()` vuoto) e in memoria c'è una richiesta di meno di un'ora con
almeno l'arrivo: arrivo, partenza (o arrivo più notti), adulti, bambini ed età si
scrivono nei filtri; la nota dice «Compilato dalla richiesta aperta in Outlook «…» —
rileggi prima di mandare», più «persone non lette: controlla» se gli adulti mancano
(restano i 2 di default) e «notti dedotte da «10 Tage»» se le notti sono dedotte.
Poi la ricerca parte da sola. Con una prenotazione aperta sulla pagina **comanda la
prenotazione**, come oggi: la richiesta non tocca niente.

**Cosa si propone.** Dopo i risultati, una funzione pura `proposteDaRichiesta(righe,
richiesta)` riceve le righe disegnate — per ognuna categoria, trattamento, totale in
centesimi, camere libere, posti massimi — e restituisce **al massimo due** righe:

1. la categoria chiesta, se c'è, se è libera e tiene le persone, col trattamento
   chiesto se esiste per quella categoria, altrimenti la prima tariffa della
   categoria;
2. la categoria libera **subito più cara** con lo stesso trattamento; se la chiesta
   è già la più cara, quella subito meno cara;
3. senza categoria chiesta, o con una chiesta che non è libera: le **due meno care**
   libere che tengono le persone, con il trattamento chiesto o la prima tariffa.

Le righe con prezzo stimato (`data-stima`) non si propongono mai: una stima non si
manda a un cliente, e il pulsante è già spento. Le proposte entrano nel preventivo
attraverso gli stessi pulsanti «+ Prev.» — stessi prezzi, sconti e bambini — la
barra dice «2 proposte dalla richiesta — rileggi», e un clic le toglie. Niente
parte da solo: «Crea preventivo e apri Outlook» resta dell'operatore.

**Cosa non cambia.** Il massimo di quattro sistemazioni; «servono insieme» resta
spento (le proposte sono alternative); i prezzi vengono solo dai pulsanti; il
pannello non scrive dentro Fidra.

## Casi limite

- Richiesta senza date: si compilano solo persone e i campi di oggi; niente ricerca
  automatica.
- Arrivo nel periodo di chiusura: il pannello mostra quello che il motore risponde
  (niente), come oggi; la risposta all'ospite è il pulsante di chiusura che c'è già.
- Categoria chiesta non riconosciuta o non libera: regola 3.
- Trattamento chiesto non offerto per quella categoria: prima tariffa della
  categoria.
- Richiesta più vecchia di un'ora: il pannello si apre come oggi, senza compilare.
- Una sola categoria libera: una proposta sola.

## Prove

- `estensione/richieste.test.ts`: le dieci email tedesche e le dieci italiane eseguite sul lettore vero
  (stesso caricamento di oggi), una prova per forma; regressioni: le prove esistenti
  restano com'erano.
- una prova che esegue `ricordaRichiesta` con uno storage finto e legge cosa scrive.
- `estensione/preventivo.test.ts`: `proposteDaRichiesta` estratta ed eseguita a
  tavolino sui sei casi delle regole; il cablaggio del pannello letto dal sorgente
  (compila solo senza prenotazione, poi cerca, la nota dichiara le deduzioni).
- `strumenti/variabili.js` (variabili non definite) e `allineata.test.ts` (OneDrive)
  come per ogni versione.

## Rilascio

Versione 2.25.0. `node strumenti/estensione.js` porta i file su OneDrive; su ogni PC
della reception va ricaricata da `chrome://extensions`. Sito e funzioni non cambiano.

## Fuori da questo disegno

- Il pulsante di risposta per la chiusura invernale (auguri, riapertura, ufficio
  prenotazioni dall'8 gennaio): **secondo disegno**, subito dopo questo.
- Il lettore col modello (Grok) per le forme che le regole non prendono: si valuta
  dopo, se il pannello continua a dire «non lette» su email vere.
