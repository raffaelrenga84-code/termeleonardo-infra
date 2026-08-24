# Offerta Leonardo v2.6.1

E' la **2.6.0 esatta** — fanghi e orari del Bistrot compresi — piu' l'unica
cosa che nel passaggio si era persa: la descrizione del **Dolce Vita
Spezial**.

## Perche' 2.6.1 e non 2.6.0

Dopo il Ricarica leggerai **2.6.1**. Serve allo stesso scopo: se leggi
2.6.1 e' entrata, se leggi 2.5.0 o meno no. Il numero e' piu' alto perche'
questo pacchetto contiene qualcosa in piu' della 2.6.0.

## Cosa e' stato aggiunto, e nient'altro

Un solo file toccato, `template.js`:

- la voce `spezial` nella tabella `PACCHETTI` — pacchetto salute piu' il
  Wohlfuehlprogramm: aperitivo, Dinner du Patron con vini abbinati, vini da
  tavola liberi, driving range e biciclette. In quattro lingue;
- il numero di applicazioni letto dal nome della tariffa: "Spezial 10 cure"
  scrive "10 Naturfangopackungen", "Spezial 5 cure" scrive 5.

Gli altri diciotto file sono **identici byte per byte** alla 2.6.0, incluso
il `popup.js` che manda `cure` alla pagina d'arrivo.

## Verifiche fatte prima di consegnare

- sintassi: tutti i 19 file JavaScript passano il controllo;
- la regola di `orari.test.ts` ricalcolata a mano: 21 righe nominano il
  Bistrot, 9 danno un orario, tutte e 9 portano chiusura 23:00 e pranzo
  12:30;
- `Spezial 10 cure` e `Spezial 5 cure` prendono il blocco nuovo con il
  numero giusto; `Dolce Vita 10 cure` resta com'era.

## Resta com'era

Le tariffe chiamate **"November Spezial"** o **"Februar Spezial"**
continuano a prendere i vecchi blocchi `novem` e `feb` (Gala-Dinner,
escursione ai Colli), perche' nella tabella vengono prima. Se il listino
2026 li sostituisce, e' una riga da cambiare — ma e' una decisione
commerciale.

---

## v2.6.2 — Shiatsu, con la esse

`template-extra.js` scriveva «shiatzu» nel modello dei buoni regalo: unico
punto rimasto dopo la correzione del 17 agosto nel prompt del centralino.
L'ha trovato la prova sugli orari, estesa il 20 agosto anche ai nomi dei
trattamenti.

---

## v2.7.0 — la richiesta si legge prima di aprire Fidra (20/08/2026)

Il pulsante "Prepara bozza in Fidra" apriva il modulo con quello che aveva
capito, senza mostrarlo. Il caso peggiore non e' quando la lettura fallisce:
e' quando produce date plausibili ma sbagliate, che finiscono in una
prenotazione e poi in un'offerta senza che nessuno le abbia guardate.

Ora al primo clic compare un riquadro con ospite, email, periodo, persone e
trattamento — e quello che non e' stato letto e' scritto in rosso, con la
nota che le date sono la cosa piu' facile da sbagliare. Si prosegue con un
secondo clic; "Annulla" chiude e basta.

**Se la richiesta e' per un ospite solo**, il riquadro lo dice a chiare
lettere: ricordati il supplemento uso singola prima di generare l'offerta.
E' l'errore del caso Kreiner, dove la nota di portineria ha scritto
"mandata mail 2 volte perche' nella prima ho copiato il modello con prezzi
dus non inseriti".

### Due difetti di lettura trovati provando sui casi veri

Il riquadro serve a poco se legge male, e provandolo sulle richieste di
Ippolito e Kreiner **non leggeva le date in nessuna delle due**:

- ora si riconoscono anche "con arrivo venerdi' 21 agosto e partenza
  domenica 23 agosto 2026" e "Dienstag 27. Oktober bis Samstag 31. Oktober
  2026", saltando il giorno della settimana e accettando due mesi diversi
  (30 ottobre - 2 novembre);
- "1 Person" non veniva riconosciuto per un errore nel modello di ricerca:
  `Personen?` vuol dire «Persone» con la n facoltativa, non «Person» con
  «en» facoltativo. Restava fuori proprio chi viaggia solo, cioe' il caso
  in cui serve l'avviso.

---

## v2.7.1 — tre pulsanti, tutti con l'anteprima (20/08/2026)

Nel riquadro di lettura di Outlook compaiono ora, secondo il tipo di
richiesta:

    Prepara bozza in Fidra     richieste di soggiorno  (turchese)
    Rispondi: Info Day Spa     ingressi, orari, prezzi (verde acqua)
    Rispondi: Buoni regalo     buoni e gift voucher    (verde oliva)

**Tutti e tre passano da un'anteprima.** Per le richieste di soggiorno
mostra ospite, email, periodo, persone e trattamento; per le risposte
pronte mostra modello, lingua dedotta e destinatario. Si prosegue con un
secondo clic, "Annulla" chiude.

Serve perche' le due cose che sbagliano — le date lette dal testo e la
lingua dedotta contando le parole — prima non si vedevano mai prima di
premere Rispondi.

### Le persone dedotte dal tipo di camera

Chi scrive «una camera matrimoniale» quasi mai aggiunge «per due persone»:
lo da' per scontato. Ora il tipo di camera lo dice — singola 1,
matrimoniale/doppia/queen 2, tripla 3, familiare 4, anche in tedesco,
inglese e francese — e l'anteprima dichiara che e' una deduzione, non un
dato letto. Senza, restava muto proprio il numero che determina il
supplemento uso singola.

### Due difetti trovati provando

«Vorrei regalare un buono» non attivava il pulsante: cercavo «buono
regalo» attaccato. Ora basta la parola «buono», con il contesto
(regalare, acquistare, prezzo) a filtrare. Verificato che «un buon
soggiorno» e «che buoni i vostri dolci» non attivino nulla.

---

## v2.7.2 — richieste dal sito (20/08/2026)

Il modulo del sito manda una mail gia' in ordine: campi con l'etichetta
accanto, date in cifre, e in piu' due cose che nessun'altra richiesta ha —
il **prezzo** e la **caparra che l'ospite ha visto sulla pagina**.

Passarla al lettore del testo libero sarebbe stato uno spreco: su
"22/08/2026 → 24/08/2026" non avrebbe letto niente. Ha ora un lettore suo,
provato con i campi su righe separate e sulla stessa riga, perche' la
tabella arriva in entrambi i modi secondo la larghezza della finestra.

Legge: riferimento RS-anno-numero, nome, periodo, notti, adulti e bambini,
email, telefono, categoria, pacchetto, trattamento, prezzo, caparra e
lingua. L'ordine di lettura va dal piu' affidabile al meno — sito,
centralino, testo libero.

**Il prezzo visto dall'ospite finisce nell'anteprima**, in un riquadro a
parte: «L'ospite ha visto 600,00 € sulla pagina, con caparra 150,00 €. Se
in Fidra esce un altro prezzo, decidi tu quale vale — ma non lasciarlo
scoprire a lui.» E' l'unico caso in cui sappiamo in anticipo che numero il
cliente si aspetta, e vale la pena averlo sotto gli occhi prima di
rispondere.

---

## v2.7.3 — sigle, plurali e date nelle quattro lingue (20/08/2026)

**Le sigle.** DZ, EZ, DBL, SGL, TWN, TRPL: chi scrive dall'Austria e le
agenzie le usano piu' delle parole intere, e prima non venivano
riconosciute.

**«Doppia uso singola» vale una persona, non due.** La riga dell'uso
singola viene ora per prima e vince su tutte: DUS, Alleinbenutzung,
Einzelnutzung, single use, usage individuel. Guardando prima il tipo di
camera si sarebbe dedotto due — l'errore peggiore possibile, perche' e'
esattamente il caso in cui serve il supplemento.

**Piu' camere.** «zwei Doppelzimmer», «2 DBL rooms», «due camere
matrimoniali» danno ora quattro persone e due camere, non due persone.
Il numero si legge anche a parole, nelle quattro lingue.

**Due difetti trovati provando.** «matrimoniali» al plurale non era
coperto (cercavo solo matrimoniale/matrimoniala), e soprattutto **le date
in inglese e francese non venivano lette affatto**: «from 4 to 6 April»,
«du 3 au 5 juillet». Il tipo di camera lo leggevamo gia' in quattro lingue,
ma senza le date la richiesta non veniva riconosciuta e la deduzione non
serviva a niente. Ora ci sono anche i mesi inglesi e francesi, abbreviati
compresi.

L'anteprima dichiara da dove viene la deduzione: «2 adulti (dedotto da
"DZ", 2 camere — verifica)».

---

## v2.7.4 — nessun pulsante nel nuovo Outlook (20/08/2026)

Su `outlook.cloud.microsoft` non compariva niente. Il dominio era gia' nel
manifest: il problema e' che **il nuovo Outlook mette il corpo del
messaggio in un iframe**, e la ricerca guardava solo il documento
principale. Trovava zero testo e quindi zero richieste, in silenzio.

Ora si cercano anche i frame dello stesso dominio (quelli di altra origine
sollevano un errore ed e' giusto ignorarli). E il controllo di visibilita'
non si affida piu' al solo `offsetParent`, che dentro un iframe puo'
essere nullo anche per elementi perfettamente visibili: si guarda se
l'elemento occupa spazio.

### Se ancora non compare

Nella pagina di Outlook, console del browser (F12), scrivere:

    leoDiagnostica()

Risponde quanti documenti sta guardando, quanti ne sono frame, quanto
testo legge, se ci trova dentro «RICHIESTA DAL SITO» e quale
riconoscimento scatta. Con quei numeri il punto in cui si ferma si
individua subito, invece di tirare a indovinare.

---

## v2.7.5 — il corpo del messaggio sta in un frame (20/08/2026)

Nessun pulsante compariva, nemmeno aprendo la mail da sola. Due cose
insieme, e la seconda si vede a occhio: aprendo il messaggio in una
finestra a se', l'indirizzo diventa **about:blank**. Il manifest chiedeva
`https://outlook...`, quindi li' lo script non partiva proprio. E nel
riquadro di lettura il corpo sta in un frame che dalla pagina principale
non si riesce a leggere.

Ora il manifest carica lo script **anche nei frame** (`all_frames`) e
**anche su about:blank** (`match_about_blank`).

Dentro un frame pero' lo script non disegna niente e non tocca la posta:
fa una cosa sola, mandare alla pagina principale il testo che vede. I
pulsanti, l'anteprima e l'inserimento della risposta restano dove
l'operatore li vede — nella finestra vera. Il testo che arriva dal frame
entra nei riconoscimenti come se fosse un elemento qualsiasi della pagina,
cosi' nessuna delle funzioni deve sapere da dove viene.

Provato: prima del messaggio dal frame la richiesta non si trova, dopo si
legge per intero — nome, periodo, adulti, camera, prezzo.

`leoDiagnostica()` dice ora anche quanti caratteri arrivano dai frame: se
quel numero e' zero, il problema e' a monte e si vede subito.

---

## v2.7.7 — il testo era dietro uno shadow root (20/08/2026)

La console ha detto quello che tre tentativi di indovinare non avevano
trovato: lo script **girava** ("attivo nella pagina"), senza errori, e
**nessun frame** eseguiva estensioni. Restava una sola spiegazione: il
testo c'era ma non era raggiungibile da fuori.

Outlook costruisce l'interfaccia con componenti che tengono il contenuto in
uno **shadow root**, e querySelectorAll non lo attraversa: dal di fuori la
pagina sembra vuota. Ora la ricerca ci scende dentro, con un limite di
profondita' perche' l'albero di OWA e' profondo.

Restano attive anche le due strade precedenti — i frame dello stesso
dominio e il testo che i frame mandano da soli — perche' Outlook cambia e
tenerle non costa niente.

leoDiagnostica() dice ora anche quanti iframe vede e quanti componenti
hanno uno shadow root: se il secondo numero e' alto e i caratteri letti
sono pochi, il problema e' di nuovo qui.

---

## v2.7.8 — la diagnostica si stampa da sola (20/08/2026)

Chiedere leoDiagnostica() a mano ha fatto perdere un altro giro. Ora, se
dopo qualche secondo non e' comparso nessun pulsante ma nella pagina c'e'
qualcosa che somiglia a una richiesta, il riepilogo finisce in console da
solo — una volta ogni due minuti, per non intasare.

Dice quanti documenti guarda, quanti sono frame, quanti componenti hanno
uno shadow root, quanti caratteri legge, cosa ci trova dentro e quale
riconoscimento scatta. E i primi 300 caratteri del testo, che spesso
bastano a capire se sta leggendo l elenco dei messaggi invece del corpo.

---

## v2.7.10 — il baco vero (20/08/2026)

La diagnostica ha detto tutto in una riga:

    riconosce: {sito: true, centralino: false, libera: true}
    caratteriLetti: 790

La richiesta **veniva riconosciuta**. Il testo si leggeva benissimo. Il
pulsante non compariva perche' la funzione che lo disegna controllava
**solo** la richiesta del centralino, mentre il ciclo che la chiama accetta
anche quelle dal sito e quelle scritte a mano. Per tutte le altre si usciva
alla seconda riga.

E' un difetto che ho introdotto io aggiungendo il parser del sito:
aggiornato il ciclo, dimenticata la funzione. Da allora il pulsante non e'
mai comparso su nessuna richiesta che non fosse del centralino vocale.

Le quattro versioni precedenti — ricerca negli iframe, all_frames e
match_about_blank, spia nei frame, attraversamento degli shadow root —
inseguivano un problema che non c'era: iframeVisti 0, caratteriDaiFrame 0,
il testo era li' e si leggeva. Restano nel codice perche' non fanno danno e
Outlook cambia, ma nessuna serviva.

La lezione sta nei numeri: quattro versioni a indovinare, una riga di
diagnostica per trovarlo.

---

## v2.8.8 — le due copie tornano una sola (20/08/2026)

L'estensione viveva in due posti che si erano allontanati: la cartella
di OneDrive che Edge carica, ferma alla 2.8.7, e la copia nel deposito
git, ferma alla 2.7.0. **Ognuna delle due aveva qualcosa che all'altra
mancava**, quindi non era una copia: era una fusione.

**Quello che mancava al deposito** — diciotto versioni di lavoro mai
entrate in git: `outlook-transfer.js` per intero, il pulsante «Prepara
bozza in Fidra» con l'anteprima, il lettore delle richieste dal sito
RS-, la verifica del pacchetto che ha impedito di scegliere la tariffa
da 330 al posto di quella da 290, le tre prove node. Stavano in una
cartella sola: nessuna storia, nessuna copia di sicurezza.

**Quello che mancava alla cartella viva:**

- **green fee e maestro** solo a chi ha il golf, e la **preferenza
  sull'orario dei fanghi** solo a chi ha le cure (`rigaGolf`,
  `rigaFanghi` in template.js, richiamate dalle quattro conferme);
- i pulsanti **transfer** e **buono regalo** nelle conferme **inglese e
  francese**, dove erano spariti senza che nessuno se ne accorgesse;
- **lo Shiatsu tolto dal modello dei buoni regalo.** La proprieta' l'ha
  tolto dal listino il 20 agosto, ma qui l'email diceva ancora «dal
  relax di 25 minuti allo shiatsu» in tutte e quattro le lingue: chi
  rispondeva a una richiesta di buoni offriva un massaggio che il
  reparto non fa piu'. Ora dice «all'anticellulite di 50 minuti».

I quattro modelli tenuti dal deposito differivano dalla copia viva
**solo** per queste righe — verificato contando le differenze prima di
scegliere, non a occhio.

### Perche' 2.8.8 e non 2.8.7

Stesso scopo di sempre: dopo il Ricarica, se leggi **2.8.8** e' entrata.
Il numero e' anche nelle due righe che lo script scrive in console
all'avvio, cosi' si controlla da li' senza aprire il manifest.

### Da adesso

Le prove del deposito — `orari.test.ts`, `pulsanti.test.ts`,
`pacchetti.test.ts`, `tolti.test.ts` — guardano il codice che gira
davvero, non un suo fratello. Prima sorvegliavano una copia che nessuno
caricava, ed e' per questo che lo Shiatsu era sopravvissuto.

---

## v2.9.0 — il preventivo torna, con i prezzi letti (24/08/2026)

Una richiesta di prezzi arriva per email e l'ospite non ha una pratica in
Fidra: per rispondergli bisognava aprirgliene una.

**Il preventivo fuori da Fidra c'era gia'.** Il codice era ancora tutto li',
spento: `aggiungiCameraRapida()` definita e mai chiamata, `costruisciDatiRapidi()`
che leggeva ancora `rapPrezzo` e `rapAcconto`, e nel gestore di «Copia» il
messaggio «quando l'ospite accetta, registra l'offerta in Fidra». Fu tolto per
una ragione buona: chiedeva **il prezzo a persona in una casella**, ed e' il
caso Kreiner — «ho copiato il modello con prezzi dus non inseriti».

Torna perche' quella ragione non c'e' piu'. «Disponibilita' e prezzi» i prezzi
non li fa digitare: li legge da `/api/available/rooms` e `/api/available/rates`
con la sessione dell'operatore, e `calcola()` ci mette dentro l'uso singola e i
bambini per eta' — i due numeri che a mano non venivano messi.

### Come si usa

Nel riquadro, accanto a «Notte per notte», ogni riga ha `+ Prev.`. Se ne
scelgono fino a quattro, si preme «Crea preventivo», si apre il pannello
(Ctrl+Shift+L) e si sceglie «Preventivo soggiorno». Nome, lingua, e l'email
esce in italiano, tedesco, inglese o francese.

### Le tre regole che il codice fa rispettare

- **Nel pannello non c'e' un solo campo dove digitare un prezzo.** Se il
  preventivo non e' stato preparato, la voce non compare: non esiste un
  ripiego manuale. Il vecchio modulo e' stato cancellato — settantacinque
  righe — e `preventivo.test.ts` diventa rossa se `rapPrezzo` o
  `aggiungiCameraRapida` tornano nel file.
- **Non puo' somigliare a un'offerta.** Niente numero, acconto, scadenza,
  «Conferma Ora», IBAN: una prova cerca quelle parole in tutte e quattro le
  lingue, anche su un preventivo con pacchetto, e fallisce se ne trova una.
  Dice invece, in tutte e quattro, che **non blocca la camera**.
- **Una stima non si manda.** Con un pacchetto settimanale piu' una coda di
  notti il 5% e' una stima — lo dice gia' il modale. Li' il pulsante e' spento
  col motivo nel `title`; e se una voce cosi' arrivasse lo stesso al modello,
  il modello solleva un errore invece di scriverla.

### Che cosa c'e' dentro l'email

Non solo il prezzo, perche' sono le stesse funzioni delle offerte vere:

- **che cosa comprende il pacchetto** — `notaPacchetto`, col numero di
  applicazioni letto dal nome della tariffa;
- **com'e' fatta la camera** — metratura, letti, balcone, piu' la dotazione
  comune, dai quattro dizionari;
- **i bambini con il loro prezzo per eta'** — `rigaBambini`. Il modale quel
  calcolo lo faceva gia' e finiva nel cestino: restava il conteggio;
- **cure termali e cane**, con due spunte. Qui una riga, non i blocchi interi
  dell'offerta: turni dei fanghi e condizioni stanno nell'offerta, che si manda
  quando l'ospite accetta.

La **culla** non c'e' perche' non c'e' nei modelli email, in nessuna lingua:
sta nel modulo del sito.

### Due cose trovate provando

**Spezial e Dolce Vita non escono in italiano.** In `PACCHETTI` portano
`lingue: ['de','en','fr']`, e i Soggiorni Smart, Escape e Deluxe portano
`lingue: ['it']`. E' una divisione di mercato scritta nel codice, non un buco:
adesso una prova la tiene ferma, cosi' chi un giorno «aggiunge l'italiano
mancante» sa che sta cambiando una scelta commerciale.

**«Bonifico» non puo' stare fra le parole vietate.** `AVVISO_PREZZO_SPECIALE`
lo nomina legittimamente, perche' su quelle tariffe il prezzo vale solo con
bonifico anticipato o in contanti. La prova gira ora anche su un preventivo con
pacchetto, che e' dove una parola vietata si infilerebbe senza che nessuno la
veda.

### Dove sta

Il documento e' in `template-extra.js`, insieme a Info Day Spa e Buoni regalo:
sono i tre che non vengono da una prenotazione. Un solo costruttore e una
tabella a quattro lingue, come gli altri due — non quattro file da ricordare a
ogni modifica.

Il modale **non traduce**: passa i nomi in italiano come li scrive Fidra, e a
tradurre pensano `traduciTrattamento`, `kategorieDE`, `categoryEN`,
`categorieFR`, che le offerte vere usano da mesi.

### Niente link di pagamento, ed e' voluto

Il link della caparra non lo fa Stripe e non lo fa Fidra: lo compone
`extractor.js` con l'id della prenotazione, il numero d'offerta e l'importo, e
`/deposit-payment` riconcilia l'incasso proprio attraverso quell'id. Fuori da
una prenotazione non esiste nessuno dei tre.

Prima ancora: il preventivo dichiara di non bloccare la camera. Incassare una
caparra su una camera non tenuta vuol dire poterla vendere a un altro e avere
in mano i soldi di chi resta senza. Quando l'ospite accetta si apre la pratica
in Fidra, e l'offerta esce con il link che gia' funziona.

### Scartato: check-availability

L'endpoint Supabase esiste, ma e' un proxy verso il **sito pubblico** ed espone
solo `rates`, non `rooms`. Senza `rooms` non ci sono numeri di camera ne'
capienza, e `calcola()` non parte perche' la categoria che riceve viene da li'.
Servirebbe se un giorno si volesse preventivare da Outlook senza aprire Fidra:
allora andrebbe esteso, ed e' un altro progetto.

### Perche' 2.9.0

Funzione nuova, non correzione. Dopo il Ricarica, se leggi **2.9.0** e' entrata.

---

## v2.9.1 — un gesto solo (24/08/2026)

La reception l'ha provata e ha detto due cose, tutte e due giuste:

> «la faccenda crea preventivo e' poco visibile, e perche' non appena si
> clicca crea preventivo non apre in Outlook ma devo cliccare anche sul
> plugin? Non ha senso, sono operazioni doppie, serve una cosa veloce.»

**Erano due interfacce per una cosa sola, ed e' un difetto di disegno mio.**
Il riquadro metteva da parte un dato; poi bisognava aprire il pannello
laterale, scegliere il documento, ribattere nome ed email — che l'estensione
aveva gia' letto dalla mail — e premere un altro pulsante. Quattro gesti e
due finestre per mandare un preventivo.

### Adesso finisce dove comincia

La barra in fondo al riquadro e' il modulo intero: nome, email, lingua, come
rivolgersi, cure e cane, e **«Crea preventivo e apri Outlook»** arancione,
come «Cerca». L'email si costruisce dentro la pagina di Fidra e Outlook si
apre gia' pronto. Il pannello non si apre mai.

**Nome, email e lingua arrivano da soli.** Quando in Outlook si preme
«Prepara bozza in Fidra», quello che il lettore ha capito viene messo da
parte (`leonardo_richiesta`, un'ora di validita'), e il riquadro lo trova
gia' scritto — dicendo da dove viene, perche' un campo che si compila da
solo senza dirlo e' un campo che nessuno rilegge.

### Il preventivo non passa piu' dal pannello

Tolto: la voce «Preventivo soggiorno», il riquadro di riepilogo, le due
spunte, e le righe nelle due tabelle MODELLI. Nessuno scrive piu'
`leonardo_preventivo`, quindi quella voce non sarebbe comunque mai comparsa
— e una scelta che non puo' comparire e' peggio di nessuna scelta. Una prova
diventa rossa se torna.

Info Day Spa e Buoni regalo restano dove sono: quelli non hanno prezzi da
guardare, e il pannello e' il posto giusto.

### Due cose da sapere sul come

**I modelli sono caricati anche in Fidra.** Il manifest porta `template.js`
e le tre lingue piu' `template-extra.js` anche sul content script di
`leonardo.fidra.cloud`: senza, `costruisciPreventivoIT` non esiste dove il
riquadro gira. Provato che `template-conferma.js` non serve — quattro file
in meno da caricare su ogni pagina di Fidra.

**Il service worker apre la scheda.** Un content script non puo' chiamare
`chrome.tabs`: il riquadro manda `LEONARDO_APRI_OUTLOOK` a `background.js`,
che apre **solo** indirizzi `https://outlook.` — un controllo che costa una
riga e chiude la porta a una pagina di Fidra compromessa.

### Perche' 2.9.1

Correzione di come si usa, non funzione nuova.

---

## v2.9.7 — l'estensione si ricarica da sola (24/08/2026)

**Il difetto della 2.8.8, moltiplicato per il numero di postazioni.** I file
arrivano su tutti i computer da soli, perche' la cartella e' su OneDrive, ma
Edge non guarda se sono cambiati: a ogni versione bisognava fare il giro
delle postazioni e premere Ricarica. Quando non si faceva, un computer
mandava le email col codice di due settimane prima e nessuno se ne accorgeva.

Adesso il service worker confronta la versione che sta girando con quella
scritta nel `manifest.json` sul disco. Se sul disco il numero e' piu' alto, i
file nuovi sono arrivati e `chrome.runtime.reload()` fa ripartire
l'estensione leggendoli. Controlla ogni cinque minuti e all'avvio di Edge.

### Le tre precauzioni

Un ricaricamento a meta' lavoro fa perdere quello che si stava facendo:

- **solo se il numero e' piu' alto**, mai «diverso»: un numero che scende
  sarebbe un file mezzo scritto da OneDrive, e ricaricare in ciclo e' peggio
  che non ricaricare;
- **mai mentre c'e' un'email in attesa** di essere inserita in Outlook o un
  preventivo fresco nel riquadro: si aspetta il giro dopo;
- **si ricorda l'ultima versione per cui ha ricaricato**, cosi' se il
  ricaricamento non prende effetto non ci riprova all'infinito.

### Che cosa resta da fare a mano, una volta sola

Su ogni computer: aggiungere la cartella condivisa a OneDrive e caricare
l'estensione scompattata da `chrome://extensions`. **Una volta sola.** Da li'
in poi gli aggiornamenti arrivano e si applicano da soli.

### Se non funzionasse

Dipende da come Edge serve i file di un'estensione scompattata: se li rilegge
dal disco a ogni richiesta o se li tiene in cache. Nel dubbio il manifest si
chiede con `cache: 'no-store'` e una marca temporale, ma la prova vera e'
usarlo.

Dalla console del service worker (`chrome://extensions` → «service worker»):

    leoAggiornamento()

Risponde la versione che gira, quella sul disco, se la considera piu' nuova e
perche' eventualmente non ha ricaricato. Se dice sempre la stessa versione per
tutte e due anche dopo che i file sono cambiati, la cache vince e questa
strada non regge: allora si passa a pubblicarla come estensione privata su
Edge Add-ons, dove l'aggiornamento lo fa il browser.
