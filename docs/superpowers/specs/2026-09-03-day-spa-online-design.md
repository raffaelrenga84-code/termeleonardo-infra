# Il Day Spa si prenota e si paga da noi — ingressi e abbonamenti

*3 settembre 2026 — bozza da rivedere con la proprietà*

## Il problema, detto da chi ci lavora

> «L'ingresso Day Spa viene prenotato esclusivamente online; perché non
> facciamo tutto noi come con i buoni regalo, ovviamente in modo migliore e
> più intuitivo? Abbiamo Stripe per i pagamenti, manca solo il tassello
> delle ricevute. Possiamo creare tutto su una pagina non pubblica da
> provare e testare, e non appena troviamo soluzione per dare disponibilità
> e ricevute fiscali andiamo online.»

> «L'abbonato oggi deve chiamare o mandare una mail per prenotare; nel
> sistema che stiamo prevedendo deve poter controllare disponibilità e
> prenotare online in autonomia. Inoltre attualmente l'abbonato non può
> acquistare online: implementerei anche questo.»

> «Non voglio che fai test sulle ricevute fiscali, per non fare danni.»

## Cosa c'è oggi, verificato il 3 settembre 2026

**Sul sito vecchio** (termeleonardo.com) l'ospite sceglie quante persone,
il giorno, poi deve **registrare un account**, pagare con carta (Stripe
dentro il loro checkout) e scaricare un biglietto; ogni accompagnatore
riceveva un invito a registrarsi a sua volta. Cinque passi e un account
obbligatorio: è lì che la gente si perde. La prenotazione nasce in un
carrello del loro sistema: non esiste una porta pubblica per crearla da
fuori.

**In Fidra** vivono quattro cose:

| risorsa | cosa contiene | oggi |
|---|---|---|
| Disponibilità Day-Spa | per ogni giorno: posti, tipo (Feriale, Pre-Festivo, Festivo, Serale), tot/pers/pren/hotel, prezzo | caricata a mano ogni settimana dalla proprietà, in base all'occupazione dell'hotel |
| Doc. Fiscali | i documenti commerciali battuti dalla stampante fiscale, col numero assegnato dalla stampante | le prenotazioni online si stampano da sole in portineria, anche alle sette di mattina |
| Entrate | una riga per persona entrata: biglietto, ricevuta, prenotazione | «Riscatta prenotazione» con lo scanner del QR allo sportello |
| Abbonamenti | titolare, tipo (Feriale, Festivo), ingressi rimasti, scadenza 31/12, ricevuta | venduti solo al banco; per prenotare un giorno l'abbonato telefona o scrive |

L'API del sito vecchio (`/it/api/1/availability`) espone la stessa
disponibilità di Fidra: per ogni giorno le fasce con orari, tipo, prezzo in
centesimi e posti rimasti, nomi in quattro lingue. Il nostro ponte
`?a=dayspa` la interroga già e restituisce una parola sola.

**La stampante fiscale** della portineria è una **Olivetti PRT 80 FX**,
registratore telematico, a `192.168.0.51` nella rete dell'hotel, con la
porta 9100 aperta. Fidra la raggiunge da fuori sulla porta 8990 del router
(il Bistrot ha la sua, 8989, e non ci riguarda). La stampante lavora in
«modalità collegamento», cioè riceve i comandi dalla rete. Olivetti
dichiara per questo modello i protocolli Olivetti, XML, JavaPOS, Xon/Xoff.
Il documento del protocollo XML non è pubblico: lo ha l'assistenza
(Vettori, 0429 789060).

**Da noi** esistono già, e si riusano tali e quali:

- il pagamento con Stripe dei buoni regalo: link di pagamento a uso
  singolo, webhook con firma verificata, rimborso, chiave con limitazioni;
- il QR generato da noi (`?a=qr`), l'email che lo porta, il campo del back
  office che legge il lettore della portineria;
- il back office con i ruoli (la spa vede il Day Spa), le email in quattro
  lingue, le date di chiusura (`stagione_chiusura`), il calendario a un
  giorno (`comune/calendario.js`), la fattura XML su richiesta per il Day
  Spa (serie dedicata, decisa il 13 agosto);
- il freno per IP, la validazione sul server, la regola «da qui non esce
  mai il numero dei posti» (`dayspa-disponibilita.ts`).

## Le decisioni della proprietà, 3 settembre 2026

1. **Tutto da noi**, come i buoni regalo: vendita, pagamento, QR, arrivo.
2. **Due prodotti**: gli ingressi singoli e gli abbonamenti, entrambi
   venduti online.
3. **L'abbonato prenota da solo**: vede i posti e sceglie il giorno senza
   telefonare.
4. **Nessuna prova sulla stampante fiscale** da parte di chi scrive il
   codice: la parte ricevute si progetta ora e si collauda con il tecnico.
5. **Prima una pagina nascosta** con Stripe in modalità di prova; si va in
   linea quando disponibilità e ricevute sono a posto.

E le risposte ai punti aperti, la sera stessa:

6. **Il documento commerciale serve, e si emette alla vendita.**
7. **Gli ingressi pagati non si annullano e non si rimborsano.**
8. **L'abbonato** scala l'ingresso alla prenotazione, e l'ingresso torna se
   annulla entro il giorno prima.
9. **I bambini dai 2 anni** pagano prezzo pieno, come oggi.
10. **Sulla ricevuta il nome del cliente**, come fa Fidra.

## Il disegno

### I prodotti e i prezzi

Quelli pubblicati sul sito oggi. Il listino sta in un modulo puro
(`supabase/functions/dayspa/listino.ts`), unica copia, e la pagina lo
riceve dal server: un prezzo cambiato in un posto solo.

| prodotto | quando | prezzo a persona |
|---|---|---|
| Ingresso giornaliero, 9:00–18:30 | feriale | 35 € |
| Ingresso giornaliero | prefestivo, festivo | 45 € |
| Ingresso serale, 18:00–22:30 | venerdì e sabato | 29 € |
| Abbonamento 10 ingressi, feriale | vale fino al 31/12 | 300 € |
| Abbonamento 10 ingressi, tutti i giorni | vale fino al 31/12 | 400 € |

Bambini dai 2 anni pagano come gli adulti (è la regola del sito vecchio:
«adulti e bambini dai 2 anni in su»); i neonati non si contano e non
pagano, e l'email lo dice. Fino a 8 persone per prenotazione
(`PERSONE_DAYSPA_MAX`, già in `tipi.ts`); oltre, la pagina rimanda alla
richiesta alla reception, che esiste già.

*Decisione presa senza chiedere, ribaltabile:* il tipo del giorno
(feriale, prefestivo, festivo) lo decide una regola — sabato prefestivo,
domenica e feste nazionali festivo — che la reception può correggere sul
singolo giorno nella scheda di disponibilità.

### La disponibilità sta da noi

La reception carica i posti settimanali nel **nostro** back office, in una
scheda «Disponibilità Day Spa» fatta come quella di Fidra: un rigo per
giorno e fascia, con posti, tipo e prezzo proposto dalla regola. Fidra
smette di essere caricata per il Day Spa: due copie dei posti
divergerebbero alla prima vendita.

Tabella `dayspa_giorno`: giorno, fascia (`giornaliero` | `serale`), tipo,
posti, prezzo in centesimi, note. Un giorno non caricato è «non ancora in
vendita», che non è «esaurito»: la pagina lo dice con parole diverse,
come fa già il ponte. I giorni dentro `stagione_chiusura` non si vendono.

**Il posto si toglie in una istruzione sola.** Una funzione nel database,
`dayspa_prendi_posti(giorno, fascia, n)`, fa `UPDATE … SET venduti =
venduti + n WHERE posti - venduti >= n` e restituisce se ci è riuscita:
due ospiti che comprano insieme gli ultimi due posti non possono
riuscirci entrambi. I posti si prendono **quando si genera il link di
pagamento**, con una prenotazione in stato `in_pagamento` che scade dopo
20 minuti: se il pagamento non arriva, un lavoro periodico (lo stesso
meccanismo dei promemoria dei buoni) la mette a `scaduta` e restituisce i
posti. Così un carrello abbandonato non tiene un posto tutta la sera, e un
pagamento riuscito trova sempre il suo posto.

### La prenotazione dell'ospite

Una pagina sola, in tre passi sullo stesso schermo, come Prenota per le
camere, pensata prima per il telefono:

1. **Quando.** Il calendario a un giorno (`comune/calendario.js`): grigi i
   giorni chiusi, esauriti e non ancora in vendita, con la parola giusta
   per ciascuno. Scelto il giorno, le fasce disponibili con orario e
   prezzo, e «ultimi 4 posti» quando ne restano cinque o meno.
2. **Chi.** Persone (adulti e bambini dai 2 anni), il totale che si
   aggiorna a ogni tocco. Un rigo: «neonati fino a 1 anno gratis, non
   serve contarli».
3. **I suoi dati.** Nome, email, telefono, la lingua della pagina; il
   consenso; «Paga 90 €». Si apre il link di pagamento Stripe (la pagina
   di Stripe, come per i buoni: carta, Apple Pay, Google Pay). Al ritorno:
   «Grazie, il QR arriva per email tra pochi minuti».

Il webhook di Stripe porta la prenotazione a `pagata`, mette in coda la
ricevuta, manda l'email con il QR. Se l'ospite ha un buono regalo Day Spa,
lo inserisce al passo 3 e il buono copre l'ingresso: la regola c'è già
(`buonoUsabileSu`, `coperturaBuono`).

Tabella `dayspa_prenotazione`: numero (`DS-2026-0001`), giorno, fascia,
persone, adulti, bambini, importo in centesimi, stato (`in_pagamento`,
`pagata`, `annullata`, `rimborsata`, `scaduta`), presenti (quante persone
sono entrate, 0 finché non arrivano), ospite (nome, email, telefono,
lingua), codice (dieci caratteri casuali: è il contenuto del QR),
riferimenti Stripe, abbonamento (se prenotata da un abbonato), buono (se
pagata con un buono), ricevuta (stato e numero), date di creazione,
pagamento, arrivo, annullamento.

La lingua e i dati precompilati arrivano dal link, come per gli altri
moduli (`?giorno=&persone=&l=`).

### Gli abbonati

**Comprare l'abbonamento online.** Stessa pagina, scheda «Abbonamento»:
feriale o tutti i giorni, il nome del titolare (l'abbonamento è
personale), i dati, il pagamento. L'email porta il **codice
dell'abbonamento** e un QR, e la ricevuta segue la stessa coda.

**Prenotare un giorno con l'abbonamento.** «Ho un abbonamento» → il codice
(o il link nell'email, che lo porta già) → il calendario con i posti veri →
il giorno e la fascia → conferma, senza pagare. Nasce una prenotazione
come le altre, con il suo QR, che **scala un ingresso al momento della
prenotazione**; se l'abbonato annulla entro il giorno prima, l'ingresso
torna. Chi non si presenta e non annulla lo ha consumato: è l'unico modo
perché un posto prenotato e non usato costi qualcosa a chi lo blocca. Un
abbonamento feriale non può prenotare un festivo, e la pagina lo dice
prima, non dopo. Gli accompagnatori senza abbonamento pagano l'ingresso
nello stesso passaggio.

Tabella `dayspa_abbonamento`: codice, titolare, email, telefono, tipo,
ingressi totali e rimasti, scadenza, origine (`online` | `fidra`),
riferimenti Fidra (id, ricevuta) per quelli importati, riferimenti Stripe
per quelli venduti da noi.

**Gli abbonamenti già venduti in Fidra** (425 righe al 3 settembre) si
importano una volta, da un'esportazione della risorsa Abbonamenti:
titolare, tipo, ingressi rimasti, scadenza, numero di ricevuta. Ognuno
riceve un codice. Chi ha l'email in Fidra lo riceve per posta; gli altri
(la colonna email è vuota per molti) lo ricevono allo sportello o al
telefono la prima volta che chiamano, e la reception glielo legge dal back
office cercando per nome. Dal giorno dell'importazione il contatore vive
da noi: in Fidra gli abbonamenti restano in sola lettura, e la reception
scala gli ingressi dal nostro back office anche per chi si presenta senza
prenotare.

### La ricevuta fiscale

Il documento commerciale lo batte la **stessa PRT 80 FX** della
portineria, nel reparto Hotel, come oggi per le prenotazioni online. Ma il
comando parte da dentro l'hotel, non da internet:

- un piccolo programma sul PC della reception (`strumenti/ricevute.js`,
  Node, avviato con Windows come le altre cose della reception) chiede al
  nostro server ogni dieci secondi «ricevute da battere?», con una chiave
  del dispositivo;
- per ognuna manda alla stampante, sulla porta 9100 della rete locale, il
  documento nel **protocollo XML Olivetti PRT FX**, fatto come quello che
  Fidra batte oggi (documento 5974 del 3 settembre, letto in Fidra):
  articolo «Ingresso alle Terme», quantità, prezzo, **reparto «pool» della
  stampante** (l'aliquota IVA sta nel reparto dentro l'apparecchio, non nel
  documento: in Fidra la colonna IVA è a zero per questo), pagamento
  «online», cliente in intestazione; e riporta al server il numero che la
  stampante assegna (`Fiscal Printed Number`, ad esempio 24260021), la data
  e l'esito. Il numero del reparto «pool» sulla PRT 80 FX ce lo dice il
  tecnico o uno scontrino già battuto;
- il back office mostra lo stato di ogni ricevuta: da battere, battuta con
  il suo numero, errore con il messaggio. Una ricevuta in attesa da più
  di dieci minuti accende un avviso rosso nella scheda Day Spa: il PC è
  spento o la stampante non risponde, e nessuna ricevuta si perde, si
  accoda.

**Il collaudo non lo fa chi scrive il codice.** Il modulo che compone il
documento XML è puro e provato contro il documento del protocollo; la
prima stampa vera si fa con il tecnico presente, nella modalità di prova
della stampante se il modello la offre, e solo dopo aver ricevuto da
Vettori il documento «Protocollo XML PRT FX». Nessuna porta nuova aperta
sul router: il PC della reception è già nella rete della stampante.

Il documento commerciale **serve e si emette alla vendita** (proprietà, 3
settembre): la coda non ha un interruttore per spegnerla. La fattura XML
su richiesta, per chi la chiede al posto del documento, resta quella che
c'è già per i buoni Day Spa.

### L'arrivo

Scheda «Day Spa oggi» nel back office: le prenotazioni del giorno per
fascia, con nome, persone, stato. In cima il campo che legge il lettore
della portineria, con il fuoco già dentro come nella scheda dei buoni: si
scansiona il QR, compare la prenotazione, «Presenti 2» la segna arrivata
(anche in parte: «sono venuti in due su tre»). Chi non ha il QR si cerca
per nome. In alto: «presenti 25 su 49» per la fascia. Per gli abbonati che
si presentano senza aver prenotato: cerca per nome, «scala un ingresso».

Le presenze degli abbonati, degli ospiti dell'hotel e di chi paga al banco
restano in Fidra; il totale del giorno è la somma delle due. Se dopo un
mese la somma pesa, la reception può aggiungere in Fidra una «Entrata»
senza ricevuta per ogni arrivo online: un clic in più a persona, e si
decide allora.

### Le email, in quattro lingue

- **Conferma con QR**: giorno, fascia e orari, persone, importo, cosa
  portare, il regolamento (il PDF esiste già sul sito vecchio; si copia
  da noi), e la riga «ingresso non rimborsabile».
- **Promemoria** il giorno prima, con lo stesso QR (il lavoro periodico
  dei promemoria dei buoni, riusato).
- **Abbonamento**: codice, QR, ingressi rimasti, scadenza, il link per
  prenotare.
- **Abbonato, prenotazione annullata**: l'ingresso è tornato, quanti ne
  restano.
- **Rimborso** con l'importo, solo quando è la reception a rimborsare.

### Annullare e rimborsare

**Un ingresso pagato non si annulla e non si rimborsa** (proprietà, 3
settembre). La pagina lo dice **prima** del pulsante di pagamento, in una
riga sopra «Paga»: «Ingresso non rimborsabile», e l'email lo ripete. Non
c'è un link per annullare.

**La prenotazione di un abbonato** invece si annulla dal link nell'email
fino al giorno prima, e l'ingresso torna sul suo abbonamento: non ha
pagato niente per quel giorno, ha solo bloccato un posto.

*Decisione presa senza chiedere, ribaltabile:* la reception conserva nel
back office il pulsante «Annulla e rimborsa», con la stessa regola dei
buoni (`rimborso.ts`, solo la reception), per il caso in cui siamo noi a
non poter dare il servizio — le piscine chiuse per un guasto, una giornata
di maltempo con la struttura chiusa. Non è un diritto dell'ospite: è uno
strumento nostro.

### Chi vede cosa

Reception e spa vedono le tre schede Day Spa (oggi, prenotazioni,
disponibilità); il rimborso lo fa solo la reception, come per i buoni
(`puoScrivereBuoni` in `ruoli.ts`, stessa regola). La chiave del PC della
reception per la coda delle ricevute è una chiave sua, revocabile.

## La fase di prova

- Pagina in `pagine/dayspa/`, servita come le altre attraverso una riga di
  passaggio in `vercel.json` del sito, con `noindex` e un parametro `?k=`
  finché è di prova; `robots.txt` la esclude.
- Stripe in **modalità di prova**: chiavi di prova in variabili separate
  (`STRIPE_PROVA_*`), scelte da una impostazione `DAYSPA_PROVA=1`; le
  prenotazioni di prova portano il segno e si cancellano prima di andare in
  linea.
- Ricevute: la coda si riempie e si vede nel back office, ma il programma
  della reception non si installa finché non c'è il documento del
  protocollo e il collaudo col tecnico.

## Le condizioni per andare in linea

1. La risposta del commercialista sul documento commerciale, e il collaudo
   della stampa con il tecnico (oppure la coda spenta, se non serve).
2. La reception ha caricato i posti da noi almeno per la settimana
   successiva.
3. Gli abbonamenti sono importati e i codici distribuiti a chi ha l'email.
4. Il giorno del passaggio: il pulsante «Prenota il Day Spa» del sito
   punta alla nostra pagina; la disponibilità in Fidra si azzera, così il
   sito vecchio non vende più; la pagina vecchia resta raggiungibile solo
   per chi ha un link.

## Come si prova

- Le regole pure hanno ognuna la sua prova: tipo del giorno dalla data e
  dalle feste; prezzo da tipo e fascia; scadenza delle prenotazioni in
  pagamento; abbonamento feriale che rifiuta un festivo; ingresso scalato
  e restituito.
- **Due acquisti insieme per gli ultimi due posti: uno solo riesce.** Si
  prova contro il database con due richieste lanciate in parallelo, non a
  parole.
- Il documento XML della ricevuta: composto da un modulo puro e confrontato
  con gli esempi del documento Olivetti, senza mai toccare la stampante.
- Il webhook: firma valida, firma falsa, evento ripetuto (Stripe li manda
  due volte: la seconda non deve mandare due email).
- Da qui non esce mai il numero dei posti: solo «ultimi posti» sotto la
  soglia, come già oggi.
- Le email in quattro lingue: ogni testo esiste in tutte e quattro, e il
  QR c'è.
- La pagina si compila import compresi (`sintassi.test.ts`, che c'è già).

## Cosa resta fuori, apposta

- Gli ospiti dell'hotel che usano le piscine: contati da Fidra, non da noi.
- Chi paga al banco senza prenotare: Fidra, come oggi.
- Il Bistrot e la sua stampante.
- L'app per il telefono: la pagina è già fatta per il telefono.
- Gruppi oltre le 8 persone: richiesta alla reception, che esiste.

## Punti aperti

Uno solo, e non dipende da noi: **Vettori** deve mandare il documento
«Protocollo XML» della PRT 80 FX e dire il numero del reparto «pool» sulla
stampante. Finché non arriva, tutto il resto si costruisce e si prova; la
coda delle ricevute si riempie e si vede, e la stampa vera aspetta il
collaudo col tecnico.

## In che ordine si costruisce

Tre piani, uno per fase, ognuno con software che funziona da solo:

1. **Gli ingressi**: listino, disponibilità nostra, la pagina, il
   pagamento, il QR, l'email, la scheda «Day Spa oggi» e la scansione, la
   scheda «Disponibilità». Alla fine si prova tutto sulla pagina nascosta
   con Stripe in modalità di prova.
2. **Gli abbonamenti**: vendita online, prenotazione con il codice,
   importazione di quelli di Fidra, distribuzione dei codici.
3. **Le ricevute**: il modulo che compone il documento XML (puro, provato
   contro il documento Olivetti), la coda, il programma della reception,
   il collaudo col tecnico. Poi il passaggio in linea.

## Rischi noti

- **Il PC della reception spento** ferma le ricevute, non le vendite: la
  coda le tiene e il back office lo segnala.
- **Il sito vecchio che vende ancora** durante il passaggio: si azzera la
  sua disponibilità il giorno stesso, altrimenti si vendono gli stessi
  posti due volte.
- **Stripe che manda il webhook in ritardo**: l'ospite vede «il QR arriva
  tra pochi minuti», non un errore; il back office mostra le prenotazioni
  in pagamento da più di 20 minuti.
- **Due registri delle presenze** (nostro e Fidra) per un periodo: scelta
  consapevole, da rivedere dopo un mese.
