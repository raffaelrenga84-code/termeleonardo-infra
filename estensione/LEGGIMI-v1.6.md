# Offerta Leonardo — v1.6.0

## Il problema che questa versione risolve (caso 18824)

Nella camera Queen 425 c'erano due soggiornanti con **date e prezzi diversi**:
Michele Lullo 13–18 agosto (5 notti, 650 €), Barbara Bello Sacchi 15–18 agosto
(3 notti, 390 €). Totale vero: **1.040 €**.

La pagina di Fidra però scrive un solo "Totale 650,00 € p.p." — che è il prezzo
del **primo** ospite, non una media. L'estensione lo leggeva e lo moltiplicava
per gli adulti: 650 × 2 = **1.300 €**. La conferma inviata chiedeva un saldo di
109 € che non esisteva: con la caparra di 1.191 € l'ospite era in **credito di
151 €**.

## Cosa cambia

### 1. Prezzi e date per singolo ospite, dall'API (`extractor.js`)

- Nuova lettura di `/api/reservations/{id}`: per ogni camera si leggono
  `prices.adults` (un prezzo per adulto) e `stays` (il periodo di ciascun
  soggiornante). Il parser è **tollerante** sui nomi dei campi e, dove non
  riconosce nulla, rinuncia invece di indovinare.
- Il **totale è la somma dei prezzi per ospite** (650 + 390), non più
  "p.p. × adulti".
- **Confronto pagina/API, mai in silenzio**: se i due totali divergono, il
  popup mostra un avviso rosso e l'email usa i prezzi per ospite.
- Avviso dedicato quando la **caparra versata supera il totale** (il caso dei
  151 € di credito).

### 2. Tripwire senza API

La pagina stessa tradisce il caso misto: la data propria dell'ospite accanto
al nome ("Arrivo 15-Aug"). Se compare e il dettaglio API non è leggibile, la
generazione **si blocca** — meglio niente che sbagliato. Le camere normali non
sono toccate: nessun falso positivo.

Correzione collegata: quando la data sta su una riga propria tra il nome e
"vai al Soggiorno", il nome dell'ospite viene ora letto correttamente.

### 3. Email: righe separate per ospite (IT/DE/EN/FR, offerte e conferme)

Camera con prezzi o date diversi →

    nr. 1 CAMERA MATRIMONIALE QUEEN · 2 ospiti
    Miglior Prezzo Mezza Pensione
    1° ospite · dal 13 al 18 agosto · 5 notti · 650,00 €
    2° ospite · dal 15 al 18 agosto · 3 notti · 390,00 €
    Totale camera 1.040,00 €

- I **nomi non compaiono mai** in email (regola della casa): etichette
  "1° ospite / 2° ospite". Per cambiare: costante `EMAIL_MOSTRA_NOMI_OSPITI`
  in `template.js`.
- Il trattamento del singolo ospite compare **solo se differisce** tra gli
  ospiti (es. Dolce Vita vs mezza pensione).
- La riga "Soggiorno" della conferma diventa "2 persone · date indicate per
  ciascun ospite" invece del fuorviante "5 notti per 2 persone".

### 4. Saldo mai negativo

Se l'acconto supera il totale, la conferma mostra saldo **0,00 €** più la
riga: "L'acconto ricevuto supera il totale di X €: regoleremo la differenza
al suo arrivo." (tradotta in DE/EN/FR).

## File toccati

`extractor.js`, `template.js`, `template-conferma.js`, `template-de.js`,
`template-en.js`, `template-fr.js`, `popup.js`, `manifest.json` (→ 1.6.0).

## Collaudo eseguito

Caso 18824 riprodotto (pagina sintetica + risposta API sulla struttura
osservata in Fidra): totale corretto a 1.040, entrambi gli avvisi nel popup,
blocco con API rotta, nessuna regressione sulla camera normale, resa
verificata nelle 4 lingue per conferme e offerte.

## Avvertenza al primo uso reale

Il formato esatto della risposta API è stato dedotto da quanto osservato in
Chrome sulla 18824. Alla **prima prenotazione vera con date miste**, verifica
che il popup mostri l'avviso e che l'email porti le righe per ospite. Se
l'API reale usa nomi di campo diversi, il sistema non sbaglia: **si blocca e
lo dice**.

## La pratica 18824

Va sistemata a mano: la conferma inviata chiede 109 € che non esistono e
l'ospite risulta in credito di 151 € (salvo extra non registrati).

---

## v1.6.3 — correzioni dal primo collaudo sul campo (12/08/2026)

Il primo invio di prova sulla 18824 ha mostrato "65.000,00 €" a ospite:

1. **L'API di Fidra lavora in CENTESIMI** (65000 = 650,00 €), come
   /api/available. Ora la scala si **tara camera per camera** contro il
   prezzo mostrato in pagina: se nessuna scala fa combaciare i numeri,
   il dettaglio API si scarta e — se la camera è mista — la generazione
   si blocca. Mai più importi assurdi in email.
2. **Le date per ospite** non arrivavano (gli `stays` reali hanno un
   formato diverso dal previsto). Ora: ricerca più larga nell'oggetto
   camera (solo array con arrivo E partenza, tanti quanti i prezzi — le
   tariffe giornaliere non vengono scambiate per ospiti) e, in mancanza,
   **fallback dalla pagina**: la data annotata accanto al nome
   ("Arrivo 15-Aug") completata con le date della camera.
3. Controllo di buon senso sull'abbinamento prezzo/ospite: a parità di
   trattamento, chi sta più notti non può pagare meno; se succede, i
   prezzi si riabbinano per durata.

---

## v1.6.4 — secondo giro di collaudo sul campo (12/08/2026)

1. **Camere scambiate (18988)**: l'ordine delle camere nell'API può differire
   da quello di pagina. L'abbinamento ora va per numero camera, poi per
   **firma di prezzo** (un prezzo adulto API che combacia col p.p. di pagina,
   in euro o centesimi), e per posizione solo come ultima spiaggia. Spariscono
   i falsi "Prezzi API non decifrabili" da scambio.
2. **Bambini**: si legge `prices.children` (stessa scala degli adulti). In
   email compare la riga "1 bambino (12 anni) · 90,00 €", il prezzo adulti
   diventa "per adulto", e il totale comprende la quota bambino (18988:
   720 → 810). Se il bambino c'è ma il prezzo non si trova, avviso nel popup.
3. **Date per ospite (18824)**: gli stays reali hanno nomi campo diversi dal
   previsto. Ora, se i nomi non sono riconosciuti, si scandaglia l'oggetto
   per qualunque coppia di date con anno (prima=arrivo, ultima=partenza);
   le voci con una sola data (tariffe giornaliere) restano escluse.
4. La caparra proposta a 0 € in Fidra resta la regola fissa:
   75 € × adulti (per la 18988: 4 × 75 = 300 €).

---

## v1.6.5 — ritocchi ai testi delle offerte (12/08/2026)

- Tolto il **percorso Kneipp** dalla riga "Attività" (IT/DE/EN/FR).
- La riga **"A tavola"** ora è dinamica: se almeno una camera ha un
  trattamento che comprende la cena (tutto tranne pernottamento e
  colazione), aggiunge: "nella mezza pensione è compresa la **cena a
  buffet al ristorante**, dalle 19:30 (ultimo ingresso alle 20:20)" —
  tradotta nelle quattro lingue. Con solo B&B resta la sola colazione.

---

## v1.6.6 — link al listino spa (12/08/2026)

Sotto il "Massaggio antistress" (offerte E conferme) compare il link per
scaricare il listino trattamenti e massaggi in PDF: versione tedesca per
le email DE, versione italiana per IT/EN/FR (con nota "in Italian" /
"en italien" dove serve).

---

## v1.6.7 — extra e mail vuota (12/08/2026)

**Mail con destinatario e oggetto ma corpo vuoto.** La firma anti-doppione
era il solo numero offerta: rigenerando la stessa prenotazione (tipico dopo
aver aggiunto gli extra), una scheda Outlook che conteneva già quel numero
faceva saltare l'inserimento. Ora la firma include l'istante di generazione,
e il controllo anti-doppione si applica solo a un editor che ha già del
contenuto — su un editor vuoto non c'è nulla da duplicare.

**Extra ignorati nel totale.** Gli extra della prenotazione non venivano
letti affatto: la 18990 offriva 190 € pur avendo 60 € di camera d'appoggio
e 30 € a testa di ingresso alle terme. Ora si leggono nome, prezzo unitario
e unità ("Al giorno per camera", "Al giorno per adulto"), si moltiplicano
per notti e persone, entrano nel totale e compaiono in email sotto la
camera: "Camera d'appoggio · 60,00 € (1 camera × 1 notte)". Il popup elenca
gli extra conteggiati per un controllo veloce.

Se l'unità di un extra non è tra quelle note, la voce **non** entra nel
totale: compare in email col prezzo unitario e la sua unità, e il popup
avvisa che va aggiunta a mano. Meglio una voce da completare che un totale
inventato.

---

## v1.6.8 — date per ospite inventate (12/08/2026)

La conferma 18824 mostrava "dal 14 maggio al 13 agosto · 1917 notti": il
fallback introdotto in 1.6.4, che cercava "qualunque coppia di date"
nell'oggetto ospite, pescava le date di sistema del record (creazione,
modifica) invece del soggiorno. Due difese:

1. **Chiavi di metadato escluse** dalla ricerca (created/updated/modified,
   inserimento, nascita, scadenza, log…).
2. **Controllo di plausibilità**: un periodo per ospite deve stare dentro il
   soggiorno — mai più notti del soggiorno, anno coerente, date dentro
   l'intervallo arrivo/partenza. Se anche una sola data non regge, si
   scartano TUTTE le date per ospite di quella camera: in email restano i
   prezzi per ospite senza periodi, e il popup avvisa. Meglio una riga senza
   date che "1917 notti".

Il controllo sulla durata funziona anche quando l'anno non è leggibile
dalla pagina, che è il caso in cui la versione precedente si lasciava
sfuggire l'errore.

---

## v1.6.9 — documento fiscale in PDF A4 (12/08/2026)

Nelle pagine `leonardo.fidra.cloud/invoices/...` compare il pulsante
**"📄 PDF A4"** in basso a destra. Al clic legge il documento dalla pagina
(intestatario e dati fiscali, righe con quantità/prezzo/IVA, riepilogo per
aliquota, totale, pagamenti) e apre la finestra di stampa su un foglio A4
con **intestazione e dati dell'hotel**: nome, società, indirizzo, contatti,
P.IVA e CIN, logo, e piè di pagina con la data di stampa.

Dalla finestra di stampa si sceglie "Salva come PDF" (oppure la stampante).
La stampa avviene in un frame interno, quindi nessun pop-up da sbloccare.

Sola lettura: non modifica nulla in Fidra e non manda dati fuori dal browser.
Il foglio è una **copia di cortesia** del documento registrato in Fidra, non
un documento fiscale sostitutivo.

---

## v1.7.0 — prezzo bambini invertito (12/08/2026)

Nella 18840 l'email scriveva "1 bambino (5 anni) · 30,00 €" e "1 bambino
(2 anni) · 50,00 €": età e prezzi venivano accoppiati per posizione, ma
l'ordine dei prezzi nell'API non segue l'ordine delle età in pagina. Il
totale era comunque giusto (la somma non cambia), sbagliato l'abbinamento.

Ora si abbinano **per rango**: il listino della casa cresce con l'età
(2 anni 30 €, 6 anni 50 €, 10 anni 80 €), quindi l'età più bassa prende il
prezzo più basso. In email i bambini restano nell'ordine in cui stanno in
Fidra. Con età uguali il risultato non cambia, essendo uguali anche i prezzi.

---

## v1.7.1 — logo e colori di marca nel PDF A4 (12/08/2026)

Il foglio dei documenti fiscali usa ora il **logo ufficiale 2025** (versione
verde su fondo pieno), incorporato nel file come data URI: si stampa anche
senza rete e non dipende dal sito. Gli accenti del foglio — filetto della
testata, titolo, riquadro dello stato — e il pulsante passano dal turchese
al **verde della casa #333B20**, preso dal logo stesso.

Toccato solo `fidra-fattura-pdf.js`: email, offerte, conferme e gli altri
pannelli restano come prima.

---

## v1.7.2 — testata del PDF (13/08/2026)

Testata rifatta e centrata: **logo nero** (versione `_G`) al centro, sotto
il nome dell'hotel in corpo minore e maiuscoletto spaziato, poi società,
indirizzo, contatti e P.IVA. Il **CIN è stato tolto dalla testata** — non è
obbligatorio lì — e resta nel piè di pagina insieme agli altri dati
societari.

---

## v1.7.3 — testata solo logo (13/08/2026)

- **Logo molto più grande** (78 mm di larghezza). Il file originale ha una
  cornice vuota attorno al marchio, che a parità di spazio lo faceva
  sembrare minuscolo: il viewBox è stato ritagliato al marchio misurandone
  il riquadro reale, senza toccare i tracciati.
- Tolti nome, indirizzo, contatti e P.IVA **sotto il logo**: erano già nel
  piè di pagina. In testata resta il solo marchio; il piè di pagina ora
  porta anche telefono, email e sito, così nessun dato è andato perso.
- Tolto **"Emesso da"** dal riquadro del documento.

---

## v1.7.4 — impianto per i marchi GSTC + ente certificatore (13/08/2026)

Predisposti i due marchi affiancati (GSTC-Certified e Vireo) in **tutte le
email** — offerte e conferme, IT/DE/EN/FR — e nel **piè di pagina del PDF**
dei documenti fiscali. Finché gli indirizzi non sono compilati non viene
stampato nulla: nessun riquadro rotto.

### Per attivarli

**Email** — in cima a `template.js`:

    const MARCHIO_GSTC  = 'https://www.termeleonardo.com/img/gstc-certified.png';
    const MARCHIO_ENTE  = 'https://www.termeleonardo.com/img/vireo.png';

Servono indirizzi **https pubblici**: Outlook e Gmail scartano le immagini
incorporate (data:) nelle email, quindi i due file vanno caricati sul sito.

**PDF** — le stesse due costanti in cima a `fidra-fattura-pdf.js`; lì
funziona anche un file incorporato.

### Vincoli rispettati dal codice

Stessa altezza per i due marchi, zona di rispetto del 33% tutt'intorno,
GSTC mai da solo. Restano a carico di chi incolla gli indirizzi: usare il
marchio **intero con il codice identificativo della struttura**, senza
ritagli né cambi di colore. Se la certificazione venisse sospesa o non
rinnovata, basta svuotare le due costanti e i marchi spariscono ovunque.

---

## v1.7.5 — indirizzo intestatario e piè di pagina (14/08/2026)

- **Indirizzo dell'intestatario perso.** L'anagrafica occupa più righe (nome,
  via, città, paese) e ne veniva letta una sola: sulla 5370 finiva stampata
  la sola "Ovada (AL) Alessandria" al posto del nome. Ora si risalgono le
  righe consecutive sopra "CF." — la più alta è il nome, le altre l'indirizzo
  — saltando data ed emittente e scartando il codice paese. Le fatture senza
  indirizzo restano come prima.
- **Piè di pagina a metà foglio.** Seguiva l'ultimo blocco di testo invece di
  stare in fondo: ora è ancorato al margine inferiore e, se il documento
  occupasse più pagine, si ripete su ciascuna. Il margine inferiore del
  foglio è stato portato a 26 mm per fargli posto.

---

## v1.7.6 — seconda pagina vuota (14/08/2026)

Il piè di pagina, ancorato con un margine negativo, sconfinava sotto l'area
di stampa: Chrome lo considerava contenuto in eccesso e apriva una seconda
pagina. Ora resta **dentro** l'area di stampa (`bottom:0`), il margine
inferiore del foglio torna a 16 mm e il corpo riserva 20 mm in basso perché
il testo non finisca sotto il piè di pagina. Impaginazione verificata con un
motore di stampa reale su un documento di una riga e su uno di sei: una
pagina in entrambi i casi.

---

## v1.7.7 — sconti sottratti e blocchi prima del totale (15/08/2026)

1. **Gli sconti venivano sommati.** Sull'offerta 19130 il totale usciva
   220 + 11 = 231 invece di 220 − 11 = 209. Ora una voce di sconto si
   riconosce dal segno meno in pagina oppure dalla parola nel nome
   (sconto/riduzione/discount/rabatt/remise) e viene **sottratta**; in email
   compare con il meno e in verde: "Soggiorno/Pensione sconto · − 11,00 €".
2. **Cure termali, cane e sconti ora stanno PRIMA del totale**, in offerte e
   conferme (IT e DE): spiegano come si arriva a quella cifra, e in fondo
   alla mail arrivavano troppo tardi.
3. Testi rivisti: il 5% fedeltà dice "Sul prezzo di pensione… dal quinto
   soggiorno in poi. È già conteggiato nel totale"; il 3% anticipato dice
   che lo sconto è già nel totale e mette le due condizioni (bonifico prima
   dell'arrivo o contanti; vale sulla sola pensione) in una frase sola.

---

## v1.7.8 — sconto 3%: scalato alla partenza (15/08/2026)

Il blocco del pagamento anticipato diceva che lo sconto era già compreso nel
totale: non è così, viene **scalato alla partenza**. Riscritto in italiano e
tedesco, con tre punti espliciti: la condizione (bonifico prima dell'arrivo,
fa fede la data di accredito sul nostro conto), il fatto che l'importo **non**
è compreso nel totale mostrato, e il perimetro (solo pensione, non cure né
extra).

Il tedesco correggeva anche tre difetti dell'originale: la costruzione
condizionale senza *wenn*, l'italianismo "Valuta für uns" (ora
*Zahlungseingang auf unserem Konto*) e *Rabatt* al posto di *Nachlass*.

Resta valida la sottrazione automatica delle voci di sconto registrate in
Fidra (v1.7.7): quelle sono righe del documento e vanno tolte dal totale.
Lo sconto 3%, che in Fidra non compare, è un'altra cosa e resta fuori.

---

## v1.7.9 — pannello disponibilità: precompilazione e sconti (15/08/2026)

**Precompilazione.** Aperto da dentro una prenotazione, il pannello parte
con le date, gli adulti, i bambini e le loro età letti dalla pagina, invece
di oggi + 3 notti. L'anno, che accanto al periodo non è scritto, si sceglie
come quello che rende la data più vicina a oggi (regge anche i periodi a
cavallo di Capodanno). Fuori da una prenotazione tutto resta come prima.

**Sconti sulla quota di pensione.** Nuovo menù "Sconto pensione": nessuno,
5% fedeltà, 3% pagamento anticipato, oppure entrambi. Ogni riga di
trattamento mostra sconto e totale scontato, e la riga copiata negli
appunti se li porta dietro.

Regole applicate:
- la base scontabile è il totale **meno cure e trattamenti**, che non si
  scontano mai;
- nel **Dolce Vita** la quota del pacchetto è esclusa: con un soggiorno di
  sole settimane intere lo sconto è zero e il pannello lo dice; con notti
  in più si sconta la sola coda, e l'importo mostrato è una **stima
  proporzionale** — il conto esatto sta in "Notte per notte", dove le notti
  fuori pacchetto hanno il loro prezzo.

---

## v1.8.0 — il 3% è un rimborso, non uno sconto (15/08/2026)

Chiarita la natura dei due sconti, che il codice trattava allo stesso modo:

- **5% fedeltà**: si toglie dal prezzo, il cliente paga meno.
- **3% anticipo 2027**: il cliente paga il prezzo pieno e riceve l'importo
  **alla partenza**. Non va mai sottratto dal totale dell'offerta.

Nel pannello disponibilità le due voci sono ora separate e mostrate in
colori diversi: il 5% dà "→ X € da pagare", il 3% dice "Y € resi alla
partenza — non toglierli dall'offerta". Con entrambi attivi il 3% si
calcola sulla pensione già scontata del 5%. La riga copiata riporta la
distinzione.

Testi email riscritti (IT e DE) con il contesto reale: durante la chiusura
invernale l'hotel prosegue i lavori grazie a chi prenota in anticipo; chi
prenota un soggiorno **2027** e bonifica l'intero importo **entro il 31
gennaio 2027** riceve alla partenza il 3% sul prezzo di pensione, con la
data di accredito sul conto come riferimento.

---

## v1.8.1 — i prezzi si scrivono da soli in Fidra (15/08/2026)

**Copia l'elenco non serviva a niente**: Fidra chiede un campo per ogni
notte, e un elenco va incollato una casella alla volta — per quindici notti
è una tortura. Nel riquadro "Notte per notte" c'è ora il pulsante
**"✍ Compila i campi in Fidra"**: con il riquadro «Prezzi» della camera
aperto, riempie da solo Notte 1, Notte 2… e il Totale.

Come funziona: i campi si riconoscono dalla loro etichetta ("Notte 3"), non
dall'ordine; il valore si scrive con il setter nativo e gli eventi
input/change/blur, perché il framework di Fidra ignora una semplice
assegnazione. **Non salva nulla**: il pulsante Salva resta all'operatore,
che vede i numeri prima di confermarli. Se il riquadro non è aperto, o se le
notti nel riquadro non corrispondono a quelle calcolate, non tocca niente e
lo dice. Il vecchio pulsante di copia resta come ripiego.

**Sconto fedeltà da inserire come extra.** Fin qui andava calcolato a mano:
semplice su due notti, meno su quindici. Ogni riga del pannello mostra ora
la cifra pronta da mettere in Fidra: "come extra: 5,50 € al giorno per
camera (× 15 notti)", nella stessa forma che il gestionale si aspetta.

---

## v1.8.2 — la prenotazione in corso segnata in rosso (15/08/2026)

Nel pannello disponibilità, quando è aperto da dentro una prenotazione,
sono ora marcati in rosso: la **categoria** della camera prenotata (bordo,
fondo chiaro e la dicitura "questa prenotazione"), il **numero di camera**
assegnato tra quelli liberi, e la **riga del trattamento** in offerta, con
la freccia "← in offerta". Le alternative restano tutte visibili: il rosso
dice solo da dove si parte.

Il confronto è normalizzato — la pagina scrive "MIGLIOR PREZZO BED &
BREAKFAST", l'API "Miglior Prezzo Bed & Breakfast" — e tratta "&" e "and"
come equivalenti.

---

## v1.8.3 — pulsanti verso i moduli del sito (15/08/2026)

Sotto le voci "Trattamenti e massaggi" e "Transfer" di offerte e conferme
(IT, DE, EN, FR) c'e' ora un pulsante che porta al modulo sul sito con i
dati dell'ospite gia' in coda all'indirizzo.

Indirizzi in cima a `template.js`, costante `MODULI`: trattamenti,
transfer, buoni-regalo, green-fee, maestro-di-golf. Per metterne uno
altrove basta inserire nel template la chiamata a `bottoneServizio` con la
chiave del servizio, i dati e la lingua.

### Parametri inviati, da leggere sul sito

    rif       numero offerta o conferma     O26/19130
    nome      intestatario                  Marcheselli Alessandro
    email     indirizzo dell'ospite
    tel       telefono (se presente in Fidra)
    arrivo    data ISO                      2026-08-17
    partenza  data ISO                      2026-08-19
    adulti    numero
    lang      it | de | en | fr

Lato sito basta una riga per campo, leggendo `location.search` con
`URLSearchParams` e assegnando il valore all'input corrispondente.

Finche' il sito non li legge, i pulsanti funzionano lo stesso: portano al
modulo giusto, semplicemente vuoto.

---

## v1.8.4 — blocco fedelta', testo (15/08/2026)

    prima:  Grazie di tornare da noi
            Sul prezzo di pensione abbiamo applicato il 5% di sconto fedelta'
    ora:    Siamo felici di rivederla
            Sul prezzo di pensione abbiamo applicato uno sconto del 5%

Il tedesco segue: "Wir freuen uns, Sie wiederzusehen" e "einen Nachlass von
5 %" al posto di "Stammgast-Nachlass", che etichettava l'ospite invece di
parlargli.

---

## v1.8.5 — blocco fedelta' asciugato (15/08/2026)

    Siamo felici di rivederla
    Sul prezzo di pensione abbiamo applicato uno sconto del 5%.
    E' gia' conteggiato nel totale.

Tolta la spiegazione sul quinto soggiorno: chi riceve l'email sa gia'
di essere un cliente abituale. Lo stesso in tedesco.

---

## v1.8.6 — due bug e tre testi (15/08/2026)

**«Categoria "1" non trovata».** Cliccando sul solo contatore, il testo
letto era "19 Disponibili" e da li' si ricavava la categoria "1" con 9
camere. Ora un nome di categoria deve contenere lettere: senza, si continua
a salire verso il contenitore giusto.

**"Compila i campi in Fidra" non trovava il riquadro** anche quando era
aperto. Cercavo l'etichetta "Notte 3" fra gli antenati del campo, ma in
Fidra e' un elemento fratello che lo precede. Ora si parte dalle etichette
e da ciascuna si scende al primo campo che la segue, con un limite di
distanza perche' non peschi un campo a fondo pagina. Provato su un riquadro
da 18 notti piu' totale.

**Pannello disponibilita':** la categoria della prenotazione aperta e' ora
la prima dell'elenco (oltre a essere segnata in rosso), e "Copia la riga"
e' stato tolto: non serviva a nulla, resta "Notte per notte".

**Testi.** La voce Terme diventa: "Le tre piscine termali, interna ed
esterna, collegate tra loro - una piscina con acqua termale fresca - grotte
con biosauna e bagno turco - zona relax riservata agli adulti", nelle
quattro lingue. E la firma: l'utenza Fidra "Nena" diventa "Elena" nelle
email, che e' il nome vero.

---

## v1.8.7 — sconti esatti nel Notte per notte (15/08/2026)

Nel riquadro "Notte per notte" ci sono due spunte, **5% fedelta'** e
**3% anticipo**. Qui ogni notte ha il suo prezzo e la sua tariffa, quindi
il conto e' esatto e non piu' una stima proporzionale:

- il **5%** si calcola sulle sole notti **fuori pacchetto** (con un Dolce
  Vita di due settimane piu' quattro notti, sulle quattro);
- premendo "Compila i campi in Fidra" con il 5% attivo, in Fidra finiscono
  le notti **gia' scontate**: lo sconto si distribuisce sulle sole notti
  fuori pacchetto e l'ultima assorbe l'arrotondamento, cosi' la somma resta
  esatta al centesimo e le notti del pacchetto restano intatte;
- il pannello mostra anche la cifra pronta per la voce extra ("X euro al
  giorno per camera per N notti").

**Il 3% dipende dalla caparra.** Si legge dalla pagina della prenotazione e
si confronta con il totale: la spunta e' attiva solo se l'ospite ha versato
tutto (tolleranza un euro). Chi ha versato meno vede scritto quanto manca e
la spunta resta bloccata. Se la caparra non e' leggibile, la spunta e'
spenta e il pannello lo dice invece di dare per buono il saldo.

---

## v1.8.8 — 3%: spunta libera, base ridotta (15/08/2026)

La spunta del 3% non si blocca piu' quando la caparra e' inferiore al
totale: decide chi sta in reception. Il calcolo pero' tiene conto del
mancato versamento — il 3% premia il denaro arrivato in anticipo, e la
parte non versata non e' stata anticipata. Quindi la base scende della
differenza, e accanto compare il 3% pieno per il confronto:

    versati 2.500 su 2.771  ->  3% proposto 75,00 EUR
                                (sull'intero sarebbe 83,13 EUR
                                 - decidi tu quale riconoscere)

Con piu' adulti la differenza si divide per gli adulti, perche' gli importi
del riquadro sono a persona. La riga verde con la caparra saldata resta
com'era.

---

## v1.8.9 — commento in email, conteggio persone, buono regalo (16/08/2026)

**Un commento del codice finiva nell'email.** Nella v1.7.7 l'avevo scritto
dentro il testo HTML invece che nel codice, e compariva in cima a offerte e
conferme. Rimosso.

**"10 persone, di cui 2 bambini" con 10 adulti e 2 bambini.** Il totale non
li comprendeva: ora sono "12 persone, di cui 2 bambini". Corretto nelle
quattro lingue.

**Buono regalo nelle conferme.** Sotto "Prepariamo il suo arrivo" c'e' una
voce nuova con il pulsante verso la pagina dei buoni: chi ha appena
prenotato e' la persona piu' propensa a regalare terme a qualcun altro.
In italiano e tedesco.

---

## v1.9.0 — una finestra sola, una linguetta per camera (16/08/2026)

Il pannello ragionava su **un solo periodo**, quello globale della
prenotazione. Con camere su periodi diversi (18968: la Doppia due notti,
la Queen diciotto) lavorava su date che non erano di nessuna delle due, e
per confrontare bisognava aprire piu' finestre.

Ora legge **tutte le camere con il loro periodo**: quando una ha date
proprie, Fidra le scrive accanto al nome ("2 notti 02 - 04 Sep") e vengono
prese da li'; le altre ereditano il periodo del soggiorno.

Sopra i filtri compare una **linguetta per ogni camera** ("Doppia n. 414 -
02-04/09"). Premendola, il pannello si sposta su quella camera: periodo,
adulti, bambini ed eta', ricerca rilanciata, categoria in cima e
trattamento segnati in rosso. Una finestra sola per tutta la prenotazione,
e da li' si va al "Notte per notte" con gli sconti e a "Compila i campi in
Fidra".

Con una camera sola la barra non compare e nulla cambia.

---

## v1.9.1 — modello "Buoni regalo" (16/08/2026)

Nuova voce nel selettore dei documenti, accanto a Info Day Spa: **Buoni
regalo**. Serve il solo nome dell'ospite, come per il Day Spa, e produce
un'email breve nelle quattro lingue: si comprano online, si pagano con
carta, arrivano subito per email.

Nessun listino nel modello. Tagli, contenuti e condizioni stanno sulla
pagina, che e' l'unica fonte che si aggiorna da sola: cosi' l'email non
invecchia quando cambiano i prezzi. Il pulsante porta alla pagina nella
lingua giusta (parametro l=it/de/en/fr).

---

## v1.9.2 — due difetti della 1.9.0 (16/08/2026)

**"Cannot read properties of null (reading 'value')".** Nel codice nuovo
avevo scritto i campi data come `dDa` e `dA`, ma nel pannello si chiamano
`dArrivo` e `dPartenza`: la ricerca falliva appena si apriva il pannello
dentro una prenotazione. Corretto nei tre punti.

**Le linguette mostravano lo stesso periodo per tutte le camere.** Il
periodo proprio ("2 notti 02 - 04 Sep") non e' sempre sulla riga subito
dopo il nome — in mezzo ci finisce "Opzioni" — quindi ora si guardano le
prime righe del blocco della camera. Il periodo globale, scritto "18 Notti
**dal** 02 - 20 Sep", resta escluso perche' ha "dal" tra le due parti.

---

## v1.9.3 — via la firma doppia in Outlook (16/08/2026)

Le nostre email hanno gia' il pie' di pagina dell'hotel, e la firma che
Outlook aggiunge da sola arrivava subito sotto ripetendo nome, indirizzo,
telefono e dati societari. Ora, prima di inserire il messaggio, la firma
automatica viene rimossa.

Si cancella solo cio' che e' riconoscibile con certezza:

- il contenitore che Outlook marca come firma (id o classe "signature"),
  oppure
- un blocco che porta **almeno due** dati esclusivi della firma (P.IVA
  aziendale, codice SDI, PEC, la riga sul non stampare).

Una sola impronta non basta di proposito: se l'operatore scrive la P.IVA
dentro il messaggio, cancellargli il testo sarebbe molto peggio di una
firma ripetuta. Le citazioni delle conversazioni precedenti ("Da:",
"From:", "Von:") non vengono mai toccate. Provato su sei casi, compresi
il messaggio nuovo dove la firma e' l'unico contenuto e la risposta con
citazione lunga.

---

## v1.9.4 — uso singola 25 € sulle offerte Spezial (16/08/2026)

Sulla Queen il supplemento uso singola vale **25 € a notte** con la
November Spezial e la Februar Spezial, e **15 €** con il Dolce Vita valido
tutto l'anno e con tutte le altre tariffe.

La regola guarda il **nome della tariffa**, non le date. E' voluto: se
l'ospite anticipa l'arrivo o prolunga, le notti in piu' hanno un'altra
tariffa e tornano da sole a 15 €, che e' proprio il comportamento chiesto.
Nel riquadro "Notte per notte" la differenza e' scritta: nel pacchetto
25 €, nelle notti fuori pacchetto 15 €.

Nella tabella dei prezzi la riga dice perche' il supplemento e' quello
("offerta Spezial: uso singola 25 € invece di 15 €"), cosi' chi guarda non
pensa a un errore.

Le eccezioni stanno in una tabella in cima a `fidra-disponibilita.js`,
`SUPPL_ECCEZIONI`: una riga per eccezione, con categoria, tariffa e
importo. L'input "€/notte" accanto alla categoria continua a funzionare
per le correzioni al volo.

---

## v1.9.5 — colonna stretta e sconti invisibili nelle conferme (16/08/2026)

**Il blocco delle cure schiacciato in una colonna sottile.** Spostando i
blocchi prima del totale (v1.7.7) li avevo infilati **dentro** la tabella a
due colonne del riepilogo, quella con "Arrivo / Partenza": finivano nella
colonna dei valori, larga un terzo del foglio. Ora stanno fuori, come righe
a piena larghezza, subito sotto il riquadro con totale, acconto e saldo.

**Gli sconti non comparivano nelle conferme.** I blocchi 5% e 3%
esistevano solo nelle offerte: nella conferma della 18968 il prezzo arrivava
gia' scontato (3.181 → 3.152,75) senza una riga che lo spiegasse, e
l'ospite vedeva solo un numero con i centesimi strani. Ora entrambi i
blocchi ci sono anche nelle conferme, in italiano e tedesco:

    Siamo felici di rivederla
    Sul prezzo di pensione abbiamo applicato uno sconto del 5%.
    E' gia' conteggiato nei prezzi qui sopra.

Il 3% mantiene la sua natura di rimborso: dice che non e' compreso nel
totale e che si consegna alla partenza.

---

## v1.9.6 — listino Spezial: la Queen e' "101+25" (16/08/2026)

I prezzi del listino cartaceo Dolce Vita SPEZIAL combaciavano gia' con
quelli nel codice (112 / 126 / 122 / 131 al giorno). Il listino pero'
scrive la Queen come **"Einzelzimmer Queen (101+25)"**: quel 126 vale in
**uso singola** e comprende gia' il supplemento. Il codice lo usava anche
quando la camera e' occupata da due persone, gonfiando il prezzo di 25 € a
testa per notte.

Ora le due cifre sono separate: 101 € a persona, 126 € quando la Queen e'
occupata da uno solo. Verificato contro i totali a sette notti del listino:
Queen in uso singola 882 €, Doppia 784 €, Junior Suite 854 €, Suite 917 €.
Lo stesso vale per la Werbesaison (115 e 130).

Le notti del pacchetto non ricevono il supplemento due volte: quando il
prezzo viene dal listino, l'uso singola e' gia' dentro e il riquadro lo
scrive. Le notti fuori pacchetto continuano a prendere il supplemento
normale.

---

## v1.9.7 — uso singola sulle notti del pacchetto (16/08/2026)

La Junior Suite tiene il supplemento di sempre, e questo ha fatto emergere
un buco piu' ampio: sulle **notti del pacchetto** il supplemento uso
singola non veniva mai aggiunto. Andava bene finche' si dava per scontato
che il listino lo comprendesse sempre, ma vale solo per la Queen
("101+25"). Per tutte le altre camere mancava.

Ora la notte del pacchetto in uso singola somma il supplemento della
categoria, tranne quando il listino lo comprende gia':

    Queen         126,00 €   (101+25, gia' incluso)
    Junior Suite  182,00 €   (122 + 60 di sempre)
    Suite         191,00 €   (131 + 60)
    Doppia        162,00 €   (112 + 50)

In camera doppia non si aggiunge nulla, come prima. Il riquadro "Notte per
notte" scrive quale dei due casi si sta applicando.

---

## v1.9.8 — il dettaglio del soggiorno, con lo sconto al posto giusto (16/08/2026)

Dall'offerta non si capiva come si arrivasse al totale: quanto pesano le
14 notti di pacchetto, quanto le 4 in mezza pensione, e soprattutto che il
5% cade solo su quelle 4.

Nel riquadro "Notte per notte" ci sono ora due pulsanti — **italiano** e
**deutsch** — che copiano il dettaglio gia' scritto, costruito dai numeri
veri del calcolo. Si incolla nel campo "Dettaglio del soggiorno" del
pannello email, che esisteva gia' ma andava riempito a mano:

    14 notti Dolce Vita 10 cure · 1.820,00 €
    4 notti Miglior Prezzo Mezza Pensione · 565,00 €
    cure e trattamenti · 796,00 €
    sconto fedelta' 5% sulle 4 notti · −28,25 €
    totale a persona · 3.152,75 €

In tedesco: "5 % Treuerabatt auf die 4 N\u00e4chte".

Nell'email quelle righe non sono piu' un elenco puntato: le righe che
finiscono con un importo lo mostrano **allineato a destra**, gli sconti in
verde col meno, e la riga del totale staccata da un filetto. Si legge come
una distinta.

Quando il 5% cade su tutto il soggiorno (nessun pacchetto) la riga dice
semplicemente "sconto fedelta' 5%", senza il numero di notti.

---

## v1.9.9 — il dettaglio arriva da solo nel pannello (16/08/2026)

Nella 1.9.8 il dettaglio finiva negli appunti e andava incollato a mano nel
campo del pannello: un passaggio facile da dimenticare, e infatti la
conferma successiva e' uscita identica a prima.

Ora premendo "italiano" o "deutsch" nel riquadro "Notte per notte" il testo
viene anche **messo da parte**, e il pannello email lo trova gia' scritto
nel campo "Dettaglio del soggiorno", con sotto una riga verde che dice da
dove viene. Resta anche negli appunti, per chi preferisce incollarlo altrove.

Due limiti voluti: vale **mezz'ora** (piu' tardi si riferirebbe a un'altra
pratica) e non tocca mai un campo gia' scritto — quanto ha scritto
l'operatore non si sovrascrive.

---

## v2.0.0 — la spunta dello sconto si mette da sola (16/08/2026)

Chiedere a chi scrive l'email di ricordarsi la casella "Sconto 5% fedelta'"
era una trappola: il prezzo usciva scontato e nessuna riga lo diceva.
Ora la casella si spunta da sola in tre casi, e sotto compare il motivo:

- lo **sconto e' gia' in prenotazione** come voce di extra
  ("Soggiorno/Pensione sconto") — il caso piu' comune;
- le **note di portineria** parlano di 5%, fedelta', Treuerabatt o
  Stammgast;
- il **riquadro "Notte per notte"** ha appena calcolato il 5%: il dettaglio
  che arriva da li' lo contiene, e la casella lo segue. Lo stesso per il 3%.

Resta una casella: se il caso e' particolare basta togliere la spunta.

---

## v2.0.1 — offerte senza numero di camera (16/08/2026)

"Non genero l'email: mancano dei dati - camere", con quattro camere in
pagina. Il motivo: l'estrattore riconosceva una camera solo se la riga
finiva con un numero ("Matrimoniale Queen n. 425"), ma in offerta le
camere non sono ancora assegnate e Fidra scrive "Matrimoniale Queen n."
senza cifra. Nessuna camera veniva vista, e l'offerta si bloccava.

Il numero e' ora facoltativo: serve solo, quando c'e', ad abbinare la
camera ai dati dell'API. Perche' una riga qualsiasi che finisce con "n."
non passi per camera, si controlla che nelle righe seguenti compaia
"Adulti n Bambini n".

Stessa correzione nel pannello disponibilita', che leggeva le camere con
lo stesso criterio.

---

## v2.0.2 — camere identiche raggruppate (16/08/2026)

Sulla 19140 le quattro Queen uguali producevano quattro riquadri identici,
descrizione della camera ripetuta quattro volte. Ora camere uguali in tutto
— categoria, trattamento, occupazione, prezzo, periodo — diventano una riga
sola con la quantita' davanti:

    4 Matrimoniale Queen
    1 ospite per camera - miglior prezzo bed & breakfast - 705,00 EUR a persona

In tedesco "pro Zimmer", in inglese "per room", in francese "par chambre".
Vale per offerte e conferme, in tutte e quattro le lingue.

Basta una differenza — un ospite in piu', un prezzo diverso, un periodo
proprio — e le camere restano separate, perche' quella differenza l'ospite
deve vederla. Le camere con dettaglio per ospite o con extra propri non si
accorpano mai.

---

## v2.0.3 — buoni regalo: i contenuti veri (16/08/2026)

Il modello "Buoni regalo" diceva solo "si comprano online". Ora risponde
alle domande che arrivano davvero, nelle quattro lingue:

- **come si compone**: importo libero da 25 a 1.000 €, oppure fino a due
  voci del listino ciascuna in piu' copie;
- **qualche prezzo** per orientarsi: i tre ingressi Day Spa con orari
  (35 / 45 / 29 €) e le fasce di massaggi, viso e corpo, programmi;
- **il vincolo del serale**, che e' la domanda ricorrente: si regala, ma
  non si abbina a un trattamento nello stesso buono, perche' di sera il
  centro benessere non fa trattamenti. Senza questa riga l'ospite compone
  un buono che il sito rifiuta al pagamento;
- **validita' dodici mesi con la proroga** se la scadenza cade in chiusura
  invernale, promemoria a trenta giorni, codice e QR, fattura anche per le
  aziende.

Niente listino completo: le fasce di prezzo bastano a orientare e non
invecchiano a ogni ritocco. I numeri esatti restano sulla pagina.

**Indirizzi per lingua.** Il pulsante e il modello puntano ora a
`/de/gutscheine`, `/en/gift-vouchers`, `/fr/cheques-cadeaux`: l'ospite
tedesco atterra su una pagina tedesca invece di veder passare per un
attimo quella italiana.

Verificato che nell'estensione non compaiano il massaggio californiano ne'
i tre pacchetti fissi, che non esistono piu'.

---

## v2.0.4 — Buoni regalo anche fuori da Fidra (16/08/2026)

Le richieste di buoni arrivano per email e non passano da Fidra: era
sbagliato pretendere una prenotazione aperta. Nella schermata "Fuori da
Fidra" ora si sceglie tra due documenti:

- **Info Day Spa** (ingressi, orari, come prenotare)
- **Buoni regalo** (come si compone, prezzi, validita', acquisto online)

Entrambi chiedono soltanto il nome di chi riceve l'email, la lingua e il
modo di rivolgersi. Offerte, conferme e solleciti continuano a esigere la
prenotazione aperta, perche' li' i dati devono essere quelli veri.

Provato generando il modello tedesco dei buoni senza alcuna pagina Fidra
sotto: 10.912 caratteri, oggetto "Gutscheine — Hotel Terme Leonardo",
saluto "Sehr geehrte Frau M\u00fcller".

---

## v2.0.5 — nome facoltativo per Day Spa e buoni (16/08/2026)

Le richieste di Day Spa e buoni arrivano spesso da un indirizzo senza
firma: pretendere il nome bloccava la risposta per un dato che non si ha.
Per questi due documenti il nome e' ora facoltativo — per offerte e
conferme resta obbligatorio, li' serve davvero.

Senza nome l'email saluta in modo generico, e in italiano si aggiusta
anche il caso in cui si conosce solo il genere:

    (nulla)      Gentile Ospite / Sehr geehrte Damen und Herren /
                 Dear Guest / Madame, Monsieur
    solo "F"     Gentile Signora
    solo "M"     Gentile Signore

Prima l'italiano produceva "Gentile " seguito dal vuoto, o "Gentile
Signora " con lo spazio penzolante. Il tedesco, l'inglese e il francese
passano alla forma neutra quando manca il cognome, perche' "Sehr geehrte
Frau" senza nome non si scrive.

---

## v2.1.0 — il Notte per notte si apre dalla scheda camera (17/08/2026)

La "i" accanto a "Totale 705,00 € p.p." e' il punto in cui ci si chiede
come sia fatto quel prezzo. Premendola si apre ora direttamente il riquadro
**"Notte per notte"** di quella camera e di quel trattamento: niente
pannello da aprire, niente periodo e occupazione da reimpostare.

Dal punto cliccato si risale al riquadro della camera e se ne leggono
categoria, trattamento, occupazione e periodo proprio; poi si interroga
Fidra per quel periodo e si sceglie la tariffa che corrisponde al
trattamento della prenotazione. Su una prenotazione con due camere, ogni
"i" apre la sua: la Doppia con le sue due notti, la Queen con diciotto.

Da li' si prosegue come sempre: spunte 5% e 3%, dettaglio per l'email,
"Compila i campi in Fidra".

Il pannello "Disponibilita' e prezzi" resta identico — questa e' una strada
in piu', non al posto di quella. E la "i" di Fidra continua a fare quello
che faceva: l'estensione ascolta soltanto, non le toglie il clic.

---

## v2.1.1 — la "i" riconosciuta anche senza etichetta (17/08/2026)

Il riconoscimento del pulsante informazioni si fermava alla lettera "i" o a
un titolo tipo "info". Se nella pagina fosse un'icona muta, non sarebbe
scattato nulla. Ora, quando l'elemento cliccato non ha testo, si guarda
dove si trova: vale come "i" solo se e' un segno piccolo appoggiato al
prezzo "… € p.p.".

Cosi' un clic su "Opzioni", su un nome o su un'icona in un blocco grande
non apre niente. Provato su sei combinazioni.

---

## v2.1.2 — il sito, cliccabile (17/08/2026)

Nelle email l'indirizzo del sito era scritto ma non collegato: chi voleva
guardare l'hotel doveva copiarlo a mano. Ora ci sono due strade verso
**www.hoteltermeleonardo.com**, in ogni documento e in ogni lingua:

- il **logo in testa** e' un collegamento;
- nel **pie' di pagina** il nome del sito e' cliccabile e sottolineato.

Vale per offerte, conferme, solleciti, Info Day Spa e Buoni regalo.

Il nome scritto e' passato da "termeleonardo.com" a
"hoteltermeleonardo.com", perche' e' li' che portano tutti i pulsanti dei
servizi: mostrare un indirizzo e mandare a un altro sarebbe stato strano.
Restano invariati l'indirizzo email info@termeleonardo.com e il PDF del
listino, che sono sull'altro dominio.

---

## v2.1.3 — listino Dolce Vita completo (17/08/2026)

Il listino con tutte e due le stagioni conferma i prezzi gia' nel codice.
Il controllo torna su tutte le otto righe: prezzo al giorno x 7 = totale
sette notti, e sette notti + Kurpaket (398 €) = totale Dolce Vita.

Due dati nuovi presi da li':

- **Kurpaket 398 €** a persona per cinque cure (con dieci raddoppia: 796 €,
  come nella 18968). Serve da riferimento per accorgersi se l'API dovesse
  restituire una cifra molto diversa.
- **Reparto fanghi chiuso dal 18 luglio al 9 agosto 2026.** Se la ricerca
  cade in quelle settimane il pannello lo scrive in rosso: le tariffe con
  cure non sono utilizzabili. Meglio accorgersene prima di mandare
  l'offerta. Le date sono in `CHIUSURE_CURE` e vanno aggiornate ogni anno.

---

## v2.1.4 — dettaglio legato alla camera, e totale per camera (17/08/2026)

**"Ihr Aufenthalt im Uberblick" sembrava riferito alla camera sbagliata.**
Il dettaglio veniva stampato dopo tutte le camere, e nella 18968 finiva
sotto la Doppia pur riguardando la Queen. Ora il titolo porta il nome della
camera a cui appartiene — lo sa il riquadro "Notte per notte" che l'ha
prodotto:

    Ihr Aufenthalt im Uberblick - Queen-Doppelzimmer - Dolce Vita 10 cure

**Totale per camera.** Con piu' di una camera, sotto ciascuna compare il
suo totale prima di quello complessivo: la Doppia 580,00 € (290 x 2), la
Queen 3.191,00 €. Senza, l'ospite vedeva solo prezzi a persona e un totale
finale, con i conti in mezzo da fare a mente. Con una camera sola la riga
non compare, perche' il totale e' gia' li' sotto. Vale per offerte e
conferme, in tutte e quattro le lingue; con camere accorpate mostra anche
il conto ("2 x 705,00 €").

---

## v2.1.5 — il dettaglio parla tedesco davvero (17/08/2026)

Il blocco usciva con i nomi come li scrive Fidra, in mezzo a un testo
tedesco: "Matrimoniale Queen", "Miglior Prezzo Mezza Pensione". Ora si
traducono, con le stesse regole dei modelli email:

    Ihr Aufenthalt im Uberblick · Queen-Doppelzimmer zur Alleinbenutzung
                                · Dolce Vita mit 10 Anwendungen
    - 14 Nachte Dolce Vita mit 10 Anwendungen      1.820,00 EUR
    - 4 Nachte Bestpreis Halbpension                 565,00 EUR
    - Kuren und Behandlungen                         796,00 EUR
    - 5 % Treuerabatt auf die 4 Nachte              - 28,25 EUR
      Gesamt                                       3.152,75 EUR

Tre cose insieme: le **categorie** tradotte (Matrimoniale Queen →
Queen-Doppelzimmer), i **trattamenti** tradotti (Miglior Prezzo Mezza
Pensione → Bestpreis Halbpension, DOLCE VITA 10 CURE → Dolce Vita mit 10
Anwendungen), e l'**uso singola** detto nel titolo quando l'ospite e' solo.

E "Gesamt pro Person" diventa **"Gesamt"** con un ospite solo, dove il "a
persona" non significava niente. Lo stesso in italiano.

Le regole di traduzione sono ricopiate dai modelli email perche' questo
script gira dentro Fidra e non ha accesso a quei file: se un domani si
aggiunge una categoria o un trattamento, va aggiunta in tutti e due i posti.

---

## v2.2.0 — il Dolce Vita parte di sabato (17/08/2026)

Le settimane di pacchetto venivano messe sempre all'inizio del soggiorno.
Su un arrivo infrasettimanale il conto era sbagliato: sulla 18968 (arrivo
mercoledi', 18 notti) risultavano 14 notti di pacchetto dal 2 settembre e
4 in coda, mentre il pacchetto parte di sabato.

La regola, come si applica in reception:

- **7 o 14 notti esatte** → tutto pacchetto, qualunque sia il giorno di
  arrivo;
- **soggiorno piu' lungo, arrivo di sabato o domenica** → le settimane
  partono subito, le notti in piu' restano in coda;
- **soggiorno piu' lungo, arrivo infrasettimanale** → le notti fino al
  primo sabato sono a tariffa del giorno, poi partono le settimane, e
  l'eventuale resto torna in coda.

Cosi' la 18968 diventa: 3 notti a tariffa del giorno (mer-sab), 14 di
pacchetto, 1 in coda. E l'esempio dei 10 giorni: da mercoledi' 3 + 7, da
sabato o domenica 7 + 3. Il riquadro scrive dove cadono le notti fuori
pacchetto, cosi' il conto si segue.

Verificato su dieci combinazioni di giorno e durata.

---

## v2.2.1 — il 3% sulla pensione, e la cifra pronta per Fidra (17/08/2026)

**Due sconti, due basi.** Erano calcolati sulla stessa base, e per un Dolce
Vita era sbagliato:

- il **5% fedelta'** vale solo sulle notti **fuori pacchetto** — il
  pacchetto ha gia' il suo prezzo di listino;
- il **3% anticipo** vale su **tutto il pernottamento**, notti di pacchetto
  comprese, perche' quelle sono camera e pensione. Restano fuori cure,
  trattamenti ed extra.

Con entrambi attivi il 3% si calcola sulla pensione gia' scontata del 5%.
Sulla 18968: 5% = 28,25 €, 3% = 70,70 € su 2.356,75 € di pensione.

**Niente piu' decurtazione automatica per il mancato saldo.** Il 3% si vede
sempre per intero; se manca qualcosa al saldo il pannello lo scrive e dice
quanto sarebbe sul solo versato, ma non decide al posto di chi guarda.

**La cifra pronta per Fidra.** Il gestionale accetta solo importi al giorno,
per camera o per persona: il pannello li calcola per entrambi gli sconti,
nelle due forme. Corretto anche un errore che c'era nel 5%: la cifra
"al giorno per camera" era in realta' quella a persona, e con due adulti in
camera valeva la meta' del dovuto.

---

## v2.2.2 — il 3% sul lordo della pensione (17/08/2026)

Il 3% veniva calcolato **dopo** aver tolto il 5%: 2.385 - 28,25 = 2.356,75,
da cui 70,70 €. Era una scelta mia, non la regola della casa. I due sconti
si calcolano ognuno sulla propria base lorda:

    pensione   1.820,00 (pacchetto) + 565,00 (4 notti) = 2.385,00 EUR
    5% sulle 4 notti fuori pacchetto                   =    28,25 EUR
    3% sulla pensione                                  =    71,55 EUR

**Arrotondamento della voce giornaliera.** Fidra accetta solo importi al
giorno, e 71,55 su 18 notti fa 3,98 - che moltiplicato torna 71,64, nove
centesimi in piu'. Ora il pannello lo scrive: "in conto risultera' 71,64 EUR
invece di 71,55 EUR: +0,09 EUR per l'arrotondamento al centesimo". Meglio
saperlo prima che trovarselo in fattura.

---

## v2.2.3 — il 3% resta sul netto del 5% (17/08/2026)

Regola confermata: quando entrambi gli sconti sono riconosciuti, il 3%
si calcola sulla pensione **gia' scontata** del 5%.

    pensione   1.820,00 + 565,00        = 2.385,00 EUR
    meno 5% sulle 4 notti fuori pacchetto -  28,25 EUR
    base del 3%                          = 2.356,75 EUR
    3%                                   =    70,70 EUR

La riga del pannello lo dichiara: "3% di 2.356,75 EUR di pensione, cure e
trattamenti esclusi, al netto del 5%". Senza il 5% attivo il 3% cade sulla
pensione intera (71,55 EUR).

---

## v2.2.4 — il dettaglio non segue piu' la pratica sbagliata (17/08/2026)

Il campo "Dettaglio del soggiorno" si precompilava su **qualsiasi**
prenotazione aperta entro mezz'ora dal calcolo, con i dati di quella
precedente: un testo che sembra giusto e non lo e', il peggio che possa
capitare in un'offerta.

Ora il dettaglio porta con se' il numero della prenotazione da cui e' nato
e si applica solo a quella. Su un'altra pratica, o fuori da una
prenotazione, il campo resta vuoto.

In piu' si consuma all'uso: dopo essere stato scritto una volta viene messo
via, cosi' se lo si svuota di proposito e si riapre il pannello non
ricompare da solo. Per riaverlo basta ripremere il pulsante nel riquadro
"Notte per notte".

Gli altri campi che restano tra una pratica e l'altra — firma, chiave hotel,
supplementi corretti a mano — sono memorizzati apposta.

---

## v2.2.5 — "Spezial 5 cure" non era riconosciuto come pacchetto (17/08/2026)

Sulla Queen in uso singola il riquadro mostrava **116,00 €** a notte invece
di 126: prendeva la tariffa del giorno (101) e ci sommava il supplemento
normale (15), invece del prezzo di listino che vale 126 comprensivo di uso
singola.

La causa: il riconoscimento del pacchetto cercava le parole "Dolce Vita",
ma in Fidra quelle offerte si chiamano **"Spezial 5 cure"** e basta. Ora
conta la sostanza — cure comprese piu' un nome che parla di Dolce Vita o
di Spezial — ed e' una regola sola, condivisa con la tabella dei prezzi
che gia' la applicava bene.

Il conto torna con il listino: 126,00 € a notte, 882,00 € per sette notti,
1.280,00 € con le cure.

Restano a notte, come devono, il Golf Mezza Pensione e il Thermal Escape:
hanno trattamenti ma non sono pacchetti settimanali.

---

## v2.2.6 — camere bloccate: "n. 640 fix" (17/08/2026)

Sulla 19146 non venivano letti gli extra. In realta' non veniva letta
nemmeno la camera, e con lei sparivano il totale e tutto il resto: la riga
in pagina e' "Suite Monteortone n. 640 (lucchetto) fix" per una camera
bloccata, e il riconoscimento pretendeva che finisse subito dopo il numero.

Ora il suffisso viene scartato prima della lettura, nell'estrattore e nel
pannello. Sulla 19146: camera riconosciuta, due extra ("Camera d'appoggio
60 € al giorno per camera", "Ingresso alle Terme 30 € al giorno per adulto")
e totale 460,00 €.

Verificato che non mangi altro: le categorie senza "fix", quelle senza
numero e una categoria che contenesse la parola restano leggibili. Rifatti
i controlli sui casi 18968, 19140, 19130 e 18824: invariati.

---

## v2.2.7 — extra fuori portata, e la firma spezzata (17/08/2026)

**Gli extra ancora invisibili.** Il "fix" della 2.2.6 era necessario ma non
bastava: la riga "Extra" veniva cercata solo entro le sedici righe del
blocco camera, e con due soggiornanti — ognuno con i suoi pulsanti — cade
piu' in basso. Sulla 19146 uscivano 340,00 EUR invece di 460,00. Ora si
cerca fino all'inizio della camera successiva, o alla fine dell'elenco.

**La firma non spariva.** Outlook la scrive come una fila di blocchi
fratelli — "Cordiali saluti", il nome dell'hotel, i dati societari, la riga
sul non stampare — e nessuno di quei blocchi porta due impronte da solo,
che era la condizione per rimuoverlo. Ora, su un messaggio nuovo, si guarda
l'insieme: se il testo complessivo porta due impronte, non c'e' citazione e
**ogni** blocco e' riconoscibile come parte della firma, si svuota tutto.

Quell'ultima condizione e' la salvaguardia: se in mezzo c'e' del testo
scritto da chi manda l'email, non si tocca niente e si torna al controllo
blocco per blocco. Provato su otto casi, compresi la risposta con citazione
e l'email in cui l'operatore cita la P.IVA nel testo.
