# La strada unica — tutte le comunicazioni dell'ospite in un posto solo

*19 agosto 2026*

## Il problema, detto da chi ci lavora

> «devo avere un backend dove arrivano tutte le richieste altrimenti la
> reception si perde (dati richiesta fattura, richiesta transfer, dati
> check-in online). Fai un unico contenitore che contenga tutte le
> comunicazioni.»

Oggi le comunicazioni di un ospite prendono **tre strade diverse**, e solo
una delle tre porta da qualche parte.

| da dove | dove finisce | numero | ricevuta all'ospite | in back office | prezzo | conferma |
|---|---|---|---|---|---|---|
| moduli del sito | `richiesta_sito` | sì | sì | sì, si lavora | dal listino | sì |
| check-in online | `arrivo_richiesta` + una email scritta a mano | no | **niente** | da ieri, in sola lettura | no | no |
| buoni regalo | `buono` | sì | sì | sì | sì | — |

Chi compila «Prepari il suo arrivo» scrive l'ora d'arrivo, i dati per la
fattura e la richiesta di un transfer, e poi **non riceve nulla**: né una
conferma di ricezione, né un prezzo, né un numero a cui riferirsi.

## Cosa ho trovato guardando il codice

Cinque cose, tutte verificate eseguendo o leggendo, non a memoria.

**1. Il contenitore esiste già.** `richiesta_sito` ha il numero, lo stato,
la ricerca sul server, i ruoli, le etichette, il riepilogo, la ricevuta, la
conferma coi dati definitivi, il prezzo dal listino e il pulsante ATAM. La
reception non si perde perché manca il contenitore: si perde perché metà
delle comunicazioni non ci entra. **Costruirne un secondo riprodurrebbe
esattamente il problema di oggi**: due posti dove guardare, nessuno dei due
completo.

**2. `arrivo_token` è scritto e non è letto da nessuno.** La colonna esiste
su `richiesta_sito` dal primo giorno, e `?a=precompila` riconosce già chi
arriva da una nostra email. Ma cercandola in tutto il repository compare
una volta sola: nell'`insert`. È la stessa malattia di `arrivo_richiesta`
prima del 18 agosto — un dato che c'è e che nessuna schermata guarda.

**3. Il transfer ha due strade, e quella del check-in è la più debole.** Il
modulo del sito ha un **elenco chiuso di 189 destinazioni ATAM**, copiate
parola per parola dal loro modulo perché la reception ricopia il valore.
La pagina d'arrivo ha una **casella di testo libera da 40 caratteri**:
l'ospite ci scrive «Venezia», «aeroporto di Venezia», «VCE», e nessuna
delle tre è una voce ATAM (la voce è `Venezia  aeroporto`, con due spazi).
Quel campo riapre da solo il problema per cui l'elenco era stato copiato.

**4. L'email del check-in non si può rispondere.** `prepara-arrivo` la
manda senza `reply_to`: chi in reception preme «Rispondi» scrive a
`noreply@hoteltermeleonardo.com`, cioè a nessuno. L'avviso standard delle
richieste (`avvisaHotel`) mette invece l'indirizzo dell'ospite.

**5. L'elenco ATAM esiste già in tre copie, e nessuna prova le tiene
ferme.** `supabase/functions/richieste/luoghi.ts`, `pagine/buoni/index.html`
(che dichiara di essere una copia, in un commento) e
`pagine/richieste/transfer/index.html`, che ha i 189 `<option>` scritti a
mano. Aggiungerne una quarta nella pagina d'arrivo garantirebbe la
divergenza.

## Le decisioni della proprietà

Prese in questa conversazione, e vincolanti per il piano:

1. **Tutto diventa richiesta.** Una compilazione del check-in fa nascere
   fino a tre richieste vere, ognuna col suo numero, il suo stato e il suo
   proprietario.
2. **Una sola ricevuta all'ospite**, riepilogativa, coi numeri accanto alle
   cose che avranno una risposta.
3. **Le persone da aggiungere restano dentro «Arrivo»**, marcate «da
   confermare»: niente tipo nuovo.
4. **La posta: tutto alla casella dell'hotel come oggi, più una copia** —
   la fattura ad amministrazione, i trattamenti e il Day Spa alla spa, e i
   buoni regalo che contengono trattamenti alla spa.

## Il disegno

### Cosa nasce da una compilazione

La pagina d'arrivo smette di scrivere per conto suo e usa la stessa porta
dei moduli del sito. Una compilazione produce, in un colpo solo:

| tipo | proprietario | contenuto |
|---|---|---|
| **`arrivo`** | reception | ora, mezzo, piccole attenzioni (culla, seggiolone, parcheggio, cane), note, desiderio fanghi, **persone da aggiungere marcate «da confermare»** |
| **`transfer`** | reception | gli stessi campi del modulo del sito: luogo **dall'elenco chiuso**, giorno, ora, passeggeri, volo, ritorno con giorno e ora, cellulare |
| **`fattura`** | amministrazione | ragione sociale, indirizzo, P.IVA, codice fiscale, SDI, PEC |

Chi compila solo l'ora d'arrivo genera **una riga sola**. Le sezioni non
spuntate non fanno nascere niente.

Il transfer nato dal check-in dev'essere **indistinguibile** da quello nato
dal sito: stesso validatore, stesso prezzo dal listino, stesso pulsante
ATAM, stessa conferma con l'orario definitivo. Non una seconda
implementazione che gli somiglia.

### Tutte o nessuna

Le righe si scrivono con **un solo `insert` di più elementi**: è una sola
istruzione, quindi non può restarne mezza. I numeri si chiedono prima; se
l'inserimento poi fallisce restano numeri saltati, che è un difetto
innocuo. Una riga orfana — un transfer senza il suo arrivo, o viceversa —
non lo sarebbe.

### Le persone da aggiungere

Restano dentro la richiesta `arrivo`, ma non come una nota fra le altre:
finché non è stata data una risposta, **quella richiesta non si può portare
allo stato «chiusa»**. Chi ha scritto «si aggiunge mia figlia» sta
aspettando di sapere se c'è posto e quanto costa, e una richiesta d'arrivo
si chiude in fretta perché quasi sempre non c'è niente da rispondere: è
esattamente il caso in cui una riga si perde.

La risposta si dà dalla richiesta stessa, come per tutte le altre: la
reception conferma disponibilità e prezzo, e da quel momento la riga si può
chiudere.

### Il filo: `arrivo_token`

Tutte le richieste nate dal check-in portano il token della prenotazione.
Da qui in poi quella colonna **si legge**: è ciò che tiene insieme la
prenotazione in Fidra e tutto quello che l'ospite ha chiesto.

### Chi vede cosa

Nessun meccanismo nuovo: due righe in `TIPI_PER_RUOLO`. Reception e
amministrazione continuano a vedere tutto; **la spa continua a vedere solo
trattamenti e Day Spa**, quindi non vede né l'arrivo, né il transfer, né la
fattura.

*Decisione presa senza chiedere, ribaltabile con una riga:* la fattura
resta visibile anche alla reception, perché è la reception a fare il
check-out.

### L'instradamento della posta

Accanto alla regola dei ruoli, non altrove, e non come secondo elenco di
tipi:

```
trattamenti  → copia a EMAIL_SPA
dayspa       → copia a EMAIL_SPA
fattura      → copia a EMAIL_AMMINISTRAZIONE
```

`dayspa` c'è perché è l'altro tipo che la spa già vede in back office:
lasciarlo fuori vorrebbe dire che la spa legge quelle richieste sullo
schermo ma non le riceve.

**Copia, non email separata.** `cc` sullo stesso invio: la reception vede
che la spa è in copia. Con due email separate nessuno dei due sa che
l'altro l'ha ricevuta, e ci si telefona per chiedere «l'hai vista?».

**La prova che tiene insieme posta e schermo:** ogni tipo che va in copia
alla spa dev'essere un tipo che la spa può davvero leggere, e ogni tipo che
la spa può leggere dev'esserle mandato in copia. Se domani qualcuno cambia
`TIPI_PER_RUOLO` e si dimentica della posta, la prova se ne accorge.

### I buoni regalo con trattamenti

Il predicato esiste già: `buonoDellaSpa()` in `supabase/functions/buoni/ruoli.ts`.
Dice che un buono **a importo** non è della spa (è denaro, si spende su
tutto), che una voce del listino sì, e che un buono scritto a mano in
reception sì — perché non si sa classificare, e nasconderlo impedirebbe di
riscuoterlo al banco della spa.

Oggi decide solo una vista del back office. **Si riusa per la posta**: se
`buonoDellaSpa(b)` è vero, copia a `EMAIL_SPA`. Nessuna regola nuova da
inventare, quindi nessuna che possa divergere da quella dello schermo.

### Le due finestre sulla stessa cosa

- **«Richieste dal sito»** — l'elenco cronologico di oggi, con due
  etichette in più. Nient'altro cambia.
- **«Arrivi del giorno»** — legge `arrivo_link` per quel giorno e accanto
  **le richieste che portano quel token**, raggruppate per ospite.
  Sostituisce la lettura di `arrivo_richiesta` messa in produzione il 19
  agosto.

### La ricevuta

Una sola email riepilogativa: cosa abbiamo ricevuto, e i numeri accanto
alle cose che avranno una risposta. La ricevuta a riga singola resta com'è
per i moduli del sito, che continuano a produrre una richiesta per volta.

### Chi rimanda il modulo

*Decisione presa senza chiedere, ribaltabile.* Oggi `prepara-arrivo` fa un
`insert` e chi rimanda il modulo lascia due righe. Con le richieste vere,
rimandarlo creerebbe **tre richieste nuove con tre numeri nuovi**, e
l'ospite riceverebbe una seconda ricevuta per cose già in lavorazione —
peggio di oggi, non meglio.

Quindi: la pagina d'arrivo, se per quel token esistono già delle richieste,
**mostra quello che è stato mandato** con i suoi numeri e dice che per
cambiare qualcosa basta scrivere. La correzione la fa la reception sulla
richiesta, che è esattamente il meccanismo già in piedi per tutte le altre
(`?a=conferma` rivalida le correzioni con lo stesso validatore della
richiesta: non ha senso essere severi col cliente e permissivi con noi).

### Cosa smette di esistere

`prepara-arrivo` perde il `POST`: non scrive più in `arrivo_richiesta` e
non manda più l'email scritta a mano. Restano la lettura (la pagina deve
mostrare all'ospite la sua prenotazione) e `?action=crea`, che fabbrica il
link.

`arrivo_link` **resta**: è il token e il legame con Fidra.

**Niente migrazione dello storico.** Le righe già scritte in
`arrivo_richiesta` restano dove sono, e la scheda «Arrivi» legge tutte e
due le fonti finché quegli arrivi non sono passati; poi la vecchia tabella
si spegne da sola. Inventare numeri di richiesta a posteriori per righe
vecchie sarebbe lavoro e rischio in cambio di niente.

### L'elenco ATAM, prima di aggiungerne una quarta copia

L'elenco si estrae in `pagine/comune/luoghi.js`, e le pagine lo importano
invece di riscriverlo: la pagina d'arrivo, il modulo transfer del sito e il
back office. Una **prova incrociata** confronta quel modulo con
`supabase/functions/richieste/luoghi.ts`, che resta l'originale — così una
voce cambiata da una parte sola non passa.

Non è un rifacimento gratuito: senza, la pagina d'arrivo diventerebbe la
quarta copia scritta a mano di un elenco di 189 righe che deve combaciare
parola per parola.

## Vincoli globali

Valgono per ogni compito del piano.

- **Nessuna regola scritta due volte.** I tipi della spa si leggono da
  `ruoli.ts`; i buoni della spa da `buonoDellaSpa()`; i luoghi da
  `luoghi.ts`. Dove la copia è inevitabile (una pagina HTML non può
  importare un modulo Deno) ci va una prova incrociata che la tiene ferma.
- **Il transfer nato dal check-in passa dal validatore del transfer del
  sito.** Non una copia adattata.
- **Nessuna migrazione di dati**, e nessuna scrittura sui dati esistenti.
- **Ogni prova dev'essere capace di fallire.** Prima di asserire su un
  elenco si asserisce che l'elenco non è vuoto: una prova che gira a vuoto
  è peggio di nessuna prova.
- **Niente verifiche di invii riusciti in produzione.** Si verificano i
  rifiuti; il resto si prova in locale.
- **La chiave di servizio è già in mano alla funzione**: le regole del
  database non proteggono niente, e il cancello è il codice. Quello che non
  deve partire non si nasconde nella pagina — non si spedisce.

## Come si prova

- una compilazione con tutto spuntato produce **esattamente tre righe** coi
  tipi giusti; una con la sola ora d'arrivo ne produce **una**;
- un luogo fuori dall'elenco ATAM è **rifiutato**, esattamente come dal
  modulo del sito;
- **la spa non vede né arrivo né fattura né transfer**, e la partita IVA
  non compare in nessuna forma nella risposta (`JSON.stringify`, non «manca
  il campo»);
- **una sola ricevuta**, e contiene i numeri delle richieste che ne hanno
  uno;
- il transfer nato dal check-in ha **lo stesso prezzo** di un transfer
  identico nato dal sito, confrontato contro il listino e non contro una
  tabella scritta a mano;
- ogni tipo copiato alla spa è un tipo che la spa può leggere, **e
  viceversa**;
- un buono con un trattamento va in copia alla spa; un buono da 200 € no;
- la scheda «Arrivi» mostra le richieste con quel token **e** le vecchie
  righe di `arrivo_richiesta` finché ci sono;
- l'elenco luoghi delle pagine combacia voce per voce con `luoghi.ts`;
- il copione delle pagine toccate si legge senza errori di sintassi.

## Cosa resta fuori, apposta

- **Nessun tipo nuovo per le persone da aggiungere** (decisione 3).
- **Nessuna migrazione** dello storico.
- **Nessuna modifica ai moduli del sito**, che funzionano.
- **I pulsanti fuori dalle offerte** sono un lavoro separato e indipendente:
  togliere i due pulsanti di richiesta dalle email di preventivo, tenendo i
  paragrafi che vendono, e sostituirli con una riga che rimanda alla
  conferma. Non dipende da questo piano e non lo blocca.
- **Le risposte via email** degli ospiti restano fuori dal contenitore.
  Nessuna architettura tiene dentro la posta libera; si riduce solo con
  l'abitudine di indirizzare al modulo.

## Prima di pubblicare

1. **Creare `EMAIL_SPA`** con `spa@termeleonardo.com`. Se manca, il codice
   non si rompe: la copia semplicemente non parte, in silenzio. È un passo
   obbligatorio, non una nota a piè di pagina.
2. `spa@termeleonardo.com` **deve confermare la sua email**, altrimenti non
   può entrare nel back office a vedere quello che gli arriva in copia.
3. Pubblicare le funzioni `richieste` e `prepara-arrivo`; spingere le
   pagine.
4. L'estensione non è toccata da questo lavoro.

## Rischi noti

- **Una compilazione può arrivare mentre la reception sta lavorando la
  precedente.** È il caso normale delle richieste e il back office lo regge
  già; qui cambia solo che le righe sono tre invece di una.
- **Numeri saltati** quando l'inserimento fallisce dopo l'assegnazione. Non
  sono numeri fiscali: un buco è innocuo, un duplicato no.
- **La casella dell'hotel riceverà più email di oggi**: una per richiesta
  invece di una per compilazione. È il prezzo di avere un numero e un
  «rispondi a» per ognuna. Se diventasse rumoroso, la strada è un avviso
  raggruppato per token — non togliere i numeri.
