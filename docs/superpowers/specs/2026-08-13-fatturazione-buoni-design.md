# Fatturazione dei buoni regalo — progetto

**Obiettivo.** Permettere a un'azienda di comprare buoni regalo lasciando i
dati per la fattura, e all'amministrazione di scaricare dal back office un
file XML FatturaPA pronto da caricare su Fatture e Corrispettivi.

**Perché serve.** Le aziende usano i buoni regalo come welfare aziendale.
Senza fattura non possono comprare: oggi la vendita si ferma lì.

---

## Contesto: cosa fa già Fidra

Verificato in sola lettura sul gestionale il 13 agosto 2026. Tre fatti che
hanno determinato le scelte di questo progetto.

**1. Fidra ha già 303 gift card attive.** Il sistema dei buoni è un secondo
registro. Decisione presa: il sistema nuovo vende online, l'amministrazione
ricopia il buono in Fidra. Il back office deve quindi dire *quali* buoni
mancano ancora, altrimenti il passaggio manuale si perde e la reception non
trova il buono quando l'ospite lo presenta.

**2. In Fidra non esistono fatture elettroniche.** La risorsa `invoices`
("Doc. Fiscali") contiene documenti commerciali battuti dal registratore
telematico:

```
fiscal_printed_number: 7770031    fiscal_printed_status: OK
department: bar   serial: 4783    amount: 5630 (centesimi)
```

Il numero lo assegna la stampante, non il gestionale. Non esiste una serie
di fatture da cui attingere, e le fatture elettroniche l'hotel le compila a
mano su Fatture e Corrispettivi. Da qui la scelta della serie dedicata.

**3. La distinzione monouso/multiuso è già la prassi dell'hotel.** Nella
lista gift card di Fidra le voci Day Spa portano un numero di ricevuta
fiscale, quelle "Valore Monetario" hanno la colonna vuota. Questo progetto
rispetta la prassi esistente invece di introdurne una nuova.

**4. L'aliquota IVA non è un dato di Fidra.** I reparti puntano a stampanti
fiscali fisiche e l'aliquota è configurata dentro l'apparecchio, non nel
gestionale. I buoni regalo si stampano sul reparto `hotel`, stampante
*Portineria - Fiscale* (46.234.202.29:8990): l'aliquota da usare in fattura
è quella che quel registratore applica ai buoni, e si legge su uno scontrino
di buono regalo già emesso. Vedi *Punti aperti*.

---

## La regola che decide tutto

Il trattamento fiscale dipende dal tipo di buono, e il sistema lo deduce da
solo dal record esistente. Nessuno in reception deve sapere cosa significhi
"monouso".

| Buono | Riconosciuto da | Alla vendita |
|---|---|---|
| Day Spa o trattamento | `voce_id` valorizzato | Fattura emessa, XML scaricabile |
| Monetario | `tipo = 'valore'` | Nessuna fattura, ricevuta non fiscale |

**Perché il monetario non si fattura.** È un buono multiuso: alla vendita non
si sa se verrà speso in massaggi, ristorante o pernottamento, quindi l'IVA
non è determinabile. L'imposta si assolve quando l'ospite consuma — e quel
documento lo emette già il gestionale dell'hotel. Se lo emettesse anche
questo sistema, la stessa operazione risulterebbe fatturata due volte.

All'azienda che compra un buono monetario va comunque un documento: una
ricevuta non fiscale con i suoi dati e la dicitura che l'IVA sarà assolta al
momento dell'utilizzo.

---

## Dati raccolti

Una spunta «Mi serve la fattura» apre il riquadro. Presente in due punti:

- `pagine/buoni/regala/index.html` — l'azienda che compra online
- `pagine/buoni/index.html` — la reception che vende al banco

### Prima si sceglie chi è l'intestatario

*(Aggiunto il 15 agosto 2026, con la proprietà, dopo aver guardato il
modulo di una struttura concorrente.)*

Subito dentro il riquadro, **una scelta fra due: privato o azienda.** Poi
compaiono solo i campi di quel caso.

Serve perché i due casi vogliono dati diversi, e mescolarli produce fatture
sbagliate. Il modulo del concorrente li mescola: chiede la **Ragione
Sociale** a chiunque. Una persona fisica ci scrive il proprio nome, e la
fattura esce con una denominazione al posto di nome e cognome — formalmente
diversa da quella che quella persona deve ricevere.

| | Privato | Azienda |
|---|---|---|
| Denominazione | *(nome e cognome, già raccolti nell'acquisto)* | Ragione sociale |
| Partita IVA | — | obbligatoria |
| Codice fiscale | **obbligatorio**, 16 caratteri | facoltativo se c'è la P.IVA |
| Indirizzo, civico, CAP, comune, provincia | obbligatori | obbligatori |
| Codice destinatario | **non si chiede** | obbligatorio, o la PEC |
| PEC | **non si chiede** | obbligatoria, o il codice destinatario |

**Al privato non si chiedono codice destinatario e PEC.** Per una persona
fisica il codice è `0000000` e la fattura arriva nel suo cassetto fiscale:
chiederglieli vorrebbe dire chiedergli due cose che non ha, e ottenere due
campi vuoti o inventati. Il codice `0000000` lo scrive il sistema, non
l'ospite.

**La scelta va registrata**, in una colonna sua: serve a comporre l'XML —
`CessionarioCommittente` cambia forma fra persona fisica e azienda — e serve
a chi guarda una fattura vecchia per capire perché è fatta così.

### I campi

Obbligatori quando la spunta è attiva, secondo la tabella qui sopra:

| Campo | Colonna | Validazione |
|---|---|---|
| Ragione sociale | `fatt_denominazione` | 2–80 caratteri |
| Partita IVA | `fatt_piva` | 11 cifre, cifra di controllo verificata |
| Codice fiscale | `fatt_cf` | 11 cifre o 16 alfanumerici; facoltativo se c'è la P.IVA |
| Indirizzo | `fatt_indirizzo` | 1–60 caratteri |
| Numero civico | `fatt_civico` | facoltativo, max 8 |
| CAP | `fatt_cap` | esattamente 5 cifre |
| Comune | `fatt_comune` | 1–60 caratteri |
| Provincia | `fatt_provincia` | 2 lettere maiuscole |
| Codice destinatario | `fatt_sdi` | 7 caratteri alfanumerici |
| PEC | `fatt_pec` | formato email |

**Codice destinatario o PEC: almeno uno dei due.** È l'errore che le aziende
fanno più spesso, ed è quello che fa scartare la fattura dallo SdI giorni
dopo l'acquisto.

**La validazione è lato server, in `acquista.ts`.** Quella nel browser serve
solo a dare un messaggio gentile: un campo può sempre arrivare falsificato.

Colonne aggiuntive sulla stessa tabella `buono_regalo`:

| Colonna | Uso |
|---|---|
| `fatt_richiesta` | boolean, la spunta |
| `fatt_numero` | `BR/2026/1`, assegnato alla generazione |
| `fatt_emessa_il` | timestamptz |
| `fatt_progressivo_invio` | intero, per il nome del file |
| `fidra_registrato_il` | timestamptz, il ponte verso il gestionale |

---

## Numerazione

Nuova tabella `fattura_contatore (anno int primary key, ultimo int)`, con lo
stesso schema di `buono_contatore` che già funziona per i numeri dei buoni.

**Il numero si assegna quando l'amministrazione genera la fattura, non
quando arriva il pagamento.** Un pagamento fallito non deve bruciare un
numero: i buchi nella numerazione sono la prima cosa che salta all'occhio in
un controllo.

L'ordine delle operazioni conta, ed è questo:

1. si validano i dati e si costruisce l'XML **senza** il numero;
2. una singola istruzione SQL atomica incrementa il contatore, restituisce il
   numero e lo scrive su `fatt_numero` del buono;
3. il numero viene inserito nell'XML e il file torna al browser.

Se il passo 1 fallisce nessun numero è stato chiesto. Se fallisce il passo 2
non è stato assegnato niente. Se si perde la risposta del passo 3 il numero
risulta già assegnato al buono, e ripremere il pulsante ripropone lo stesso
file invece di generarne un secondo.

L'atomicità del passo 2 serve a due persone che premono il pulsante nello
stesso istante: devono ottenere due numeri diversi. È anche il motivo per
cui l'XML lo genera la funzione e non il browser.

---

## Scorporo dell'IVA

I prezzi del listino sono lordi: il Day Spa costa 35 €. La fattura vuole
imponibile e imposta separati.

```
imposta    = arrotonda(lordo × aliquota / (100 + aliquota), 2)
imponibile = lordo − imposta
```

Calcolare l'imponibile come differenza, e non arrotondando anche quello,
garantisce che imponibile + imposta faccia **esattamente** il lordo pagato.

**Divergenza da un centesimo.** Su alcuni importi il controllo inverso non
torna: 45 € al 22% dà imponibile 36,89 e imposta 8,11, ma 36,89 × 22% fa
8,1158, cioè 8,12. Non esiste nessun imponibile che soddisfi entrambe le
condizioni, quindi la tolleranza dello SdI su questo controllo è
strutturalmente necessaria. Il test elenca tutti i prezzi di listino per
ogni aliquota candidata e segnala i casi divergenti; almeno uno di questi
va passato al servizio «Controlla fattura» prima di andare in produzione.

---

## L'XML

Formato FatturaPA `FPR12`, tipo documento `TD01`, generato dalla funzione
`buoni` in un modulo dedicato `fattura.ts`.

Struttura, con i valori fissi del cedente:

```
FatturaElettronicaHeader
  DatiTrasmissione      IdTrasmittente IT/02042330288 · ProgressivoInvio
                        FormatoTrasmissione FPR12 · CodiceDestinatario
                        (PECDestinatario se il codice è 0000000)
  CedentePrestatore     Hotel Terme Leonardo · P.IVA 02042330288
                        Via Monteortone, 46 · 35037 Monteortone di Abano Terme · PD · IT
                        *(corretto il 15 agosto 2026: diceva solo «Abano
                        Terme». È l'indirizzo del CEDENTE, cioè quello che
                        finisce stampato su ogni fattura emessa — non un
                        esempio.)*
                        RegimeFiscale (da confermare, vedi Punti aperti)
  CessionarioCommittente  i dati raccolti sopra
FatturaElettronicaBody
  DatiGeneraliDocumento TD01 · EUR · data · numero · totale
  DettaglioLinee        una riga per voce del buono, con AliquotaIVA
  DatiRiepilogo         per aliquota: imponibile, imposta, EsigibilitaIVA I
  DatiPagamento         modalità dedotta dal campo `pagamento` del buono
```

**Nome del file:** `IT02042330288_00001.xml`, dove le cinque cifre sono il
`fatt_progressivo_invio` in base 36. Deve essere unico e non riutilizzabile:
il file esce già col nome giusto, senza che nessuno debba rinominarlo prima
di caricarlo.

**Mappatura del pagamento:** `carta`/Stripe → `MP08`, `contanti` → `MP01`,
`bancomat`/`pos` → `MP08`, `bonifico` → `MP05`. I buoni `promozionale` non
producono fattura: non c'è corrispettivo.

**Escape XML obbligatorio** su tutti i campi liberi: una ragione sociale con
la `&` dentro romperebbe il file.

---

## Il ponte verso Fidra

Nel back office, in cima all'elenco, un filtro **«da registrare in Fidra»**
che mostra i buoni pagati con `fidra_registrato_il` vuoto. Un pulsante li
segna registrati con data e utente.

Non è automazione: è una lista di cose da fare che non si dimentica. Serve
finché non sappiamo se Fidra permette di creare gift card dall'esterno —
la pagina gift card è Livewire e non espone API, e fra le risorse Nova le
gift card non compaiono.

---

## Errori

| Situazione | Comportamento |
|---|---|
| Dati fattura incompleti | L'acquisto si blocca, messaggio sul campo mancante |
| Buono monetario con richiesta fattura | Acquisto accettato, nessun XML, ricevuta non fiscale con avviso |
| Buono promozionale | Nessuna fattura possibile, pulsante assente |
| Fattura già generata | Il pulsante ripropone lo stesso file, non ne crea un secondo |
| Generazione fallita a metà | Il numero non viene consumato: contatore incrementato solo a XML prodotto |

---

## Test

Il modulo `fattura.ts` è puro: dati dentro, stringa XML fuori. Si prova
senza rete e senza database.

1. Scorporo: quadratura esatta su tutti i prezzi di listino, per ogni
   aliquota candidata; elenco esplicito dei casi con divergenza da un
   centesimo.
2. Validazione: partita IVA con cifra di controllo giusta e sbagliata, CAP
   di 4 e 6 cifre, provincia minuscola, codice destinatario di 6 e 8
   caratteri, PEC malformata, assenza di entrambi.
3. Regola monouso/multiuso: un buono `valore` non produce mai XML; un buono
   con `voce_id` sì.
4. XML: caratteri speciali nella ragione sociale correttamente sfuggiti,
   nome file corretto, totale coerente con la somma dei riepiloghi.
5. Numerazione: due generazioni ravvicinate producono numeri diversi; una
   generazione fallita non consuma il numero.
6. Un test presidia le aliquote e **fallisce finché non sono confermate**
   (vedi sotto): impossibile andare in produzione per distrazione.

Prima dell'uso reale: un XML di prova passato al servizio «Controlla
fattura» dell'Agenzia delle Entrate.

---

## Punti aperti

**Aliquote IVA — RISOLTE il 13 agosto 2026.**

| Servizio | Ospite alloggiato | Cliente esterno |
|---|---|---|
| Pernottamento e prima colazione | 10% | non applicabile |
| **Ingresso Day Spa** | **esente art. 10** | **esente art. 10** |
| **Massaggi estetici** | **22%** | **22%** |
| Cure termali e trattamenti curativi (massaggio di reazione, massaggio speciale, inalazioni, aerosol, fanghi medici) | esente art. 10 (se certificate) | esente art. 10 (se certificate) |

**Nessuna riga dipende da chi riscuote il buono.** È il punto che sblocca
tutto: il trattamento IVA è determinabile all'emissione, quindi i buoni per
Day Spa e per trattamenti restano **monouso** e si fatturano alla vendita,
come previsto da questa specifica. Il dubbio sul multiuso è chiuso.

*Come si legge sul listino della funzione (`LISTINO` in `acquista.ts`):*

| Voci | Trattamento |
|---|---|
| le 4 `dayspa_*` | esente art. 10 |
| le altre 16 (massaggi, viso, corpo) | 22% |

**Tre voci stanno sul confine e vanno confermate**, perché sono a listino
estetico ma nominano il fango o il linfodrenaggio, e la Knowledge Base
distingue il linfodrenaggio Vodder *curativo* da quello estetico:
`linfo60` (Linfodrenaggio completo), `visofango25` (viso al fango termale),
`riducente55` (riducente-anticellulite al fango). Se una di queste è una
prestazione curativa certificata, va spostata fra le esenti.

**Due conseguenze tecniche che nessuna delle due tabelle nomina, e che fanno
scartare la fattura o costano una sanzione:**

1. **Le righe esenti non hanno un'aliquota, hanno una natura.** In FatturaPA
   una riga esente porta `AliquotaIVA` 0.00, `Imposta` 0.00, `Natura` **N4**
   e un `RiferimentoNormativo` — "art. 10 DPR 633/72". Senza la natura lo
   SdI scarta il file: un'aliquota a zero senza spiegazione non è ammessa.

2. **L'imposta di bollo.** Su una fattura senza IVA, quando l'importo esente
   supera **77,47 €**, serve il bollo da 2 €. In FatturaPA è
   `DatiBollo` con `BolloVirtuale: SI` e `ImportoBollo: 2.00`. Un singolo
   ingresso Day Spa da 35 o 45 € sta sotto la soglia; **due ingressi, o un
   paniere, la superano**. La soglia si calcola sulla somma delle sole righe
   esenti, non sul totale del documento.

Il test di presidio può passare al verde per le aliquote, ma ne servono due
nuovi: uno che verifichi la natura N4 sulle righe esenti, e uno che
verifichi il bollo sopra i 77,47 €.

---

*Quello che segue è la cronaca di come ci si è arrivati: le due versioni
arrivate prima, e perché non bastavano. Si tiene perché spiega le scelte.*

**Aliquote IVA — due versioni in conflitto, ricevute lo stesso giorno.**

Il 13 agosto 2026 sono arrivate due indicazioni che non possono essere
entrambe vere. Sono registrate tutte e due perché il conflitto va risolto,
non nascosto scegliendo la più recente.

*Prima versione (tabella riassuntiva):*

| Servizio | Ospite alloggiato | Cliente esterno |
|---|---|---|
| Pernottamento e prima colazione | 10% | non applicabile |
| Ingresso Day Spa / massaggi estetici | 10% (accessorio) | 22% (ordinario) |
| Cure termali mediche / fanghi | esente art. 10 (se certificate) | esente art. 10 (se certificate) |

*Seconda versione (indicazione successiva):*

| Servizio | Aliquota |
|---|---|
| Ingresso Day Spa | **esente** |
| Trattamenti curativi | **esente** |
| Trattamenti estetici e altro | **22%** |

**Dove si contraddicono:** sull'ingresso Day Spa. Nella prima è imponibile
(10% o 22% secondo il cliente), nella seconda è esente. Sui massaggi
estetici la seconda toglie il 10% per l'ospite alloggiato e lascia 22%
sempre.

**Perché la differenza conta più di quanto sembri.** Se il Day Spa è esente
e i trattamenti estetici sono al 22% *indipendentemente da chi li usa*,
allora il trattamento IVA è **determinabile all'emissione**: i buoni
tornano a essere monouso, si fatturano alla vendita, e l'impianto di questa
specifica regge. Se invece vale la prima versione, l'aliquota dipende da chi
riscuote il buono, non è nota alla vendita, e i buoni Day Spa sarebbero
**multiuso** come quelli monetari — cioè niente fattura all'acquisto.

**Una perplessità che vale la pena dire.** L'esenzione dell'articolo 10
riguarda le prestazioni sanitarie di diagnosi, cura e riabilitazione. Sulle
cure termali con prescrizione è pacifica; su un ingresso alle piscine
comprato per svago lo è molto meno. Non sono io a doverlo stabilire, ma
"Day Spa esente" è un'affermazione forte e conviene averla confermata per
iscritto prima di emettere fatture.

**Come si chiude in trenta secondi:** uno scontrino di ingresso Day Spa
stampato dalla *Portineria - Fiscale* riporta l'aliquota applicata. Quel
foglio vale più di qualunque ricostruzione: è ciò che l'hotel dichiara già
oggi al fisco.

Fino ad allora il test di presidio resta rosso e non si emette nessuna
fattura. Resta comunque aperto il caso dei **buoni per cure termali**:
l'esenzione vale "se certificate", e la certificazione non esiste al
momento in cui il buono viene venduto.

**Regime fiscale del cedente.** `RF01` (ordinario) è l'ipotesi. Da
confermare: si legge su qualsiasi fattura già emessa dall'hotel.

---

## Fuori ambito

- Invio automatico allo SdI: l'XML si scarica e si carica a mano, come
  l'hotel già fa oggi.
- Note di variazione e fatture di storno.
- Fatturazione dei buoni monetari al momento del riscatto: la emette il
  gestionale dell'hotel insieme al conto del soggiorno.
- Creazione automatica delle gift card dentro Fidra.

---

## Ordine dei lavori

Questo progetto è il terzo di tre. Prima vengono due lavori indipendenti,
già concordati:

1. **Anteprima pubblica allineata.** Il buono nella pagina di acquisto mostra
   meno di quello che il cliente riceve: mancano testo introduttivo, elenco
   di cosa comprende, contatti e scadenza. Il modello del buono esiste in tre
   copie divergenti; le due copie web vanno unificate in una sorgente sola.
2. **Il form del sito nuovo che perde le richieste.**
3. Questo progetto.
