# Prenotare con un buono regalo, senza telefonare

*17 agosto 2026 — decisioni prese con la proprietà*

## Il problema

Chi riceve un buono regalo legge, nell'email e sul foglio stampato:

> **COME PRENOTARE** — «Per prenotare ci chiami o ci scriva: fissiamo insieme
> il giorno e l'ora.»

Chiamare, oppure scrivere un'email bianca da zero. In quattro lingue
(`PRENOTA` in `supabase/functions/buoni/email-buono.ts`).

Nel frattempo il sito ha già: un modulo di richiesta che funziona in quattro
lingue, si precompila dai parametri dell'indirizzo, valida i trattamenti
contro il listino vero e finisce in una scheda del back office con la riga di
riepilogo giusta. **Niente di tutto questo è raggiungibile da un buono.**

Chi ha ricevuto un massaggio in regalo deve telefonare per fissarlo, mentre
chi non ha nessun buono può chiederlo dal sito in due minuti.

## Le decisioni

### Tutto passa dal modulo delle richieste, anche il Day Spa

La prenotazione del Day Spa vive su `termeleonardo.com` (sito precedente) e
**non è nostra**: non possiamo farle accettare un codice buono. La proprietà
ha deciso che per i buoni il Day Spa **diventa una richiesta**, che la
reception verifica e conferma — come farebbe al telefono oggi.

Conseguenza: una sola strada per tutti i tipi di buono, invece di due.

### Il buono si riconosce da solo

Il pulsante nell'email e l'indirizzo sul foglio portano al modulo **con il
codice nell'indirizzo**. La pagina interroga `?a=verifica&codice=…` e mostra
in cima cosa contiene quel buono, poi **preseleziona** la voce.

`?a=verifica` esiste già ed è stata scritta apposta per questo: restituisce
`valido`, `stato`, `descrizione`, `valore`, `voci`, `scade_il`, `riscosso_il`
— e **nessun dato personale**. Non va allargata.

### Resta libero di cambiare

La voce preselezionata **si può cambiare**. Chi ha un buono da 65 € e vuole
un trattamento da 80 lo sceglie, e la richiesta dice alla reception cosa
copriva il buono e cosa è stato chiesto. Bloccarlo impedirebbe una vendita
che si farebbe volentieri.

### Il numero si MOSTRA, non si chiede

La proprietà aveva proposto di chiedere anche il numero del buono come
secondo codice di verifica. **Non si fa, e il motivo è tecnico:**

- il **numero** è sequenziale (`BR-2026-0001`, `0002`…): si indovina contando;
- il **codice** è casuale, ed è quello che protegge;
- stanno **nella stessa email**: chi ha l'uno ha l'altro.

Chiedere tutti e due aggiungerebbe un campo da digitare a chi arriva dal
pulsante — dove oggi non digiterebbe niente — senza chiudere nessuna porta.

E soprattutto: **il modulo non è il punto in cui si riscuote.** Lì si chiede
un appuntamento; il buono lo scala la reception al banco, col QR. Una
richiesta fatta con un codice altrui costa una telefonata, non un trattamento
regalato.

Il bisogno vero dietro quella proposta — *essere certi di aver preso il buono
giusto* — si soddisfa **mostrando** il numero nel riquadro: chi non lo
riconosce si ferma prima di compilare.

Chi arriva **senza il link** (ha solo il foglio e digita l'indirizzo)
inserisce **il codice**, uno solo, quello stampato accanto al QR.

### La differenza si dice in tutte e due le direzioni

**Se sceglie più caro:**
> Il suo buono copre **65 €**. Ha scelto un trattamento da **80 €**: all'arrivo
> pagherà la differenza di **15 €**.

**Se sceglie più economico — ed è il lato scomodo:**
> Il suo buono vale **70 €**. Ha scelto un trattamento da **40 €**: le
> ricordiamo che **l'importo residuo non è rimborsabile né riutilizzabile**.

Quella regola è già nelle condizioni stampate sul buono, ma nessuno le
rilegge. Dirla **nel momento della scelta** è la differenza fra una decisione
consapevole e un reclamo al banco — e può fargli scegliere il trattamento
giusto invece di lasciarci trenta euro che poi contesta.

Per i buoni a **importo libero** (25–1000 €) il conto funziona identico.

### La disponibilità Day Spa si vede subito, ma passa da noi

L'API `https://www.termeleonardo.com/it/api/1/availability` — la stessa che
usa lo strumento `check_dayspa_availability` dell'agente vocale — **non manda
intestazioni CORS**: verificato il 17 agosto 2026, zero
`access-control-allow-origin`. Una chiamata dal browser da
`hoteltermeleonardo.com` verrebbe **bloccata**.

E la sua risposta contiene `amount` — i posti residui (42, nella prova). Il
prompt vocale ha una regola esplicita: **non dirlo mai, in nessuna forma**. Se
il browser chiamasse l'API direttamente, quel numero sarebbe visibile a
chiunque apra gli strumenti del browser.

Il vincolo tecnico e la regola commerciale spingono nella stessa direzione:
**un ponte nostro**, che chiama l'API e restituisce solo un esito.

## Cosa NON si tocca

- **Il QR** resta il codice puro che il lettore del banco legge. Cambiarlo in
  un indirizzo romperebbe il gesto della reception.
- **La riscossione** resta al banco. Il modulo chiede un appuntamento, non
  scala il buono.
- **`?a=verifica`** si usa così com'è.
- **Le altre pagine** e gli altri tipi di richiesta.

## I pezzi

### 1. `differenza.ts` — il conto, puro e collaudabile

Dato quanto copre il buono e il prezzo di quello che l'ospite ha scelto,
restituisce quale delle tre frasi mostrare e con quali importi:

```
{ tipo: 'copre' | 'differenza' | 'residuo' | 'ignoto', copre: number,
  scelto: number, differenza: number }
```

Modulo **puro**, senza rete: è la parte dove si sbaglia coi soldi, e va provata
da sola.

Casi che deve reggere: buono a valore libero · buono a servizio · buono a due
voci (la copertura è la somma) · scelto uguale al coperto · scelto più caro ·
scelto più economico · prezzo dello scelto assente (`ignoto`: non inventare un
conto) · valore zero o non numerico.

### 2. Il sesto tipo di richiesta: `dayspa`

Non esiste: il server accetta oggi `greenfee`, `maestro`, `soggiorno`,
`transfer`, `trattamenti` (verificato in `richieste/tipi.ts`). Il Day Spa non
era mai stato una richiesta perché si prenotava pagando online.

- **`tipi.ts`** — validazione: `giorno` (data vera, non passata, dentro la
  stagione), `persone` (intero 1–8), `note`.
  *Il tetto di 8 è preso da `pax` del transfer, non dedotto da una capienza
  vera del Day Spa: è una scelta, non un dato. Un gruppo più numeroso passa
  comunque dalla reception (regola dei gruppi), quindi il tetto non blocca
  niente di legittimo.*
- **`riepilogo.ts`** — la riga che la reception legge: *«2 persone · 21 agosto»*.
- **La pagina** — un blocco di campi in più e `'dayspa'` in `TIPI`.
- **La riscrittura** `/it/day-spa` → `?tipo=dayspa`, e le tre lingue.

**Non è una pagina nuova.** `pagine/richieste/index.html` serve già tre tipi
con la stessa intestazione, gli stessi contatti e la stessa privacy: il Day Spa
è il quarto blocco dentro quella pagina. Il commento in cima al file lo dice
già — tre file quasi identici divergerebbero.

### 3. `?a=dayspa` — il ponte sulla disponibilità

Sulla funzione `richieste`. Riceve una data e il numero di persone, e:

1. **Controlla la chiusura stagionale** (tabella `stagione_chiusura`): se la
   data cade a hotel chiuso, non chiama niente e lo dice.
2. **Applica la regola dei sette giorni**, presa dal prompt vocale. Oltre una
   settimana la disponibilità **non è ancora stata aperta**: è una scelta
   dell'hotel, non un tutto esaurito. Non interroga l'API e non dice mai
   «esaurito».
3. **Entro sette giorni** chiama l'API e traduce la risposta in un esito.
4. **Toglie `amount`** prima di restituire. Un test lo verifica.

Esiti restituiti:

```
'chiuso'        l'hotel è chiuso in quella data
'non-aperte'    oltre i sette giorni: prenotazioni non ancora aperte
'disponibile'   in questo momento risulta disponibilità
'esaurito'      quella data risulta esaurita
'ignoto'        l'API non ha risposto o è illeggibile
```

**Sempre al presente** — *«in questo momento risulta disponibilità»*, mai
*«c'è posto»*: con brutto tempo la capienza si riduce, e chi ha letto «c'è
posto» tre giorni prima si presenta convinto.

### 4. Il pezzo nella pagina

Legge `?buono=CODICE` dall'indirizzo (o dal campo, per chi digita), chiama
`?a=verifica`, disegna il riquadro, preseleziona, e mostra la differenza
mentre l'ospite cambia scelta.

Il codice finisce **nelle note** della richiesta, con l'etichetta in italiano
più la traduzione — la stessa forma già usata per il riferimento dell'offerta
(`Rif. offerta / Angebotsreferenz:`), perché la nota la legge la reception.

### 4-bis. Quando il buono contiene DUE cose

`VOCI_MAX = 2`: un buono può contenere un ingresso Day Spa **e** un massaggio.
Trovato rileggendo la specifica — il disegno non diceva quale modulo aprisse
il pulsante in quel caso.

**Si apre il modulo dei trattamenti, e la richiesta resta UNA.** Un ingresso
Day Spa più un massaggio sono una visita sola, non due: far compilare due
moduli allo stesso ospite per lo stesso pomeriggio sarebbe assurdo, e la
reception riceverebbe due richieste da ricollegare a mano.

Il riquadro elenca **tutto** quello che il buono contiene, e la nota lo ripete
per la reception:

> Il suo buono comprende anche un **ingresso Day Spa infrasettimanale**:
> lo prepariamo per lo stesso giorno.

Se invece il buono contiene **solo** un ingresso Day Spa, il pulsante apre il
modulo `dayspa`, dove la domanda giusta è «quante persone» e non «quale
trattamento».

Regola, in una riga: **se c'è almeno un trattamento → modulo trattamenti;
altrimenti → modulo Day Spa.**

### 5. I due punti d'ingresso

- **Un pulsante nell'email del buono**, in quattro lingue, accanto al blocco
  `PRENOTA` che oggi dice «ci chiami o ci scriva».
- **Un indirizzo breve stampato sul foglio A4.**

⚠ **Il foglio A4 sta in una pagina per un soffio**: nel caso peggiore avanzano
**33 pixel** (misurati con `pagine/buoni/misura-foglio.mjs`). Dopo aver
aggiunto la riga, la misura va **rifatta**, o le condizioni tornano a
tagliarsi come già succedeva prima del 15 agosto.

## Come scorre

```
email o foglio  →  /it/trattamenti?buono=CODICE   (o /it/day-spa?buono=…)
                   ↓
                   ?a=verifica → contenuto, validità, valore
                   ↓
                   riquadro: numero, contenuto, scadenza
                   voce preselezionata, modificabile
                   ↓
                   differenza mostrata mentre sceglie
                   (Day Spa: anche la disponibilità, da ?a=dayspa)
                   ↓
                   richiesta normale, col codice nelle note
                   ↓
                   reception conferma · riscuote al banco col QR
```

## Quando qualcosa va storto

Metà del lavoro sta qui: è ciò che decide se il modulo è utile o irritante.

| Cosa | Cosa vede l'ospite |
|---|---|
| Codice inesistente | «Questo codice non risulta. Controlli sul buono, oppure ci scriva.» |
| Buono **scaduto** | «Questo buono è scaduto il … — la reception valuta caso per caso, ci scriva.» |
| Buono **già riscosso** | «Risulta già utilizzato il … Se non le risulta, ci scriva.» |
| Buono **non ancora pagato** (`attesa`) | «Questo buono non risulta ancora attivo.» |
| `?a=verifica` **non risponde** | Nessun riquadro: si mostra il modulo normale e il codice va nelle note. **Meglio una richiesta senza riquadro che nessuna richiesta.** |
| `?a=dayspa` non risponde | «Al momento non riesco a verificare la disponibilità» — e la richiesta si manda comunque. |

Nessuno di questi casi **blocca** l'invio della richiesta, tranne il codice
inesistente sul modulo aperto col buono: lì si chiede di correggerlo.

## Come si prova

**`differenza.ts`** — test veri sui casi che pagano, con il calcolo verificato
a mano. Per ognuno, la domanda da farsi: quale modifica al codice lo farebbe
fallire?

**`?a=dayspa`** — test che `amount` non esca **mai**. È il genere di cosa che
qualcuno «semplifica» rigirando la risposta intera, e nessuno se ne accorge
finché un cliente non commenta «ma allora c'erano ancora quaranta posti».
Più: la regola dei sette giorni al confine (7 e 8 giorni), la chiusura
stagionale, l'API che non risponde.

**`tipi.ts` per `dayspa`** — giorno inesistente, giorno passato, giorno a
hotel chiuso, persone fuori scala, persone non intero.

**La pagina** — caricata in un **browser vero** con un codice vero, come fatto
il 15 e 17 agosto per la precompilazione. È l'unico modo che ha trovato la
barra rovesciata mancante nei doppi spazi e i trattamenti che sparivano
cambiando gruppo: due difetti che il codice, a leggerlo, sembrava non avere.

**Il foglio A4** — `misura-foglio.mjs` rieseguito dopo aver aggiunto la riga.

## Fuori perimetro, di proposito

- **Far accettare il codice buono alla prenotazione Day Spa online**: quel
  sistema non è nostro.
- **Riscuotere dal modulo.** Resta al banco.
- **Prenotare un orario preciso.** L'ospite indica una fascia; l'ora la fissa
  il reparto, che conosce i turni.
- **Il buono a importo libero speso in altro** (cena, camera): non è un
  appuntamento da fissare.
