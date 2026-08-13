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

Campi, tutti obbligatori quando la spunta è attiva tranne dove indicato:

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
                        Via Monteortone 46 · 35037 Abano Terme · PD · IT
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

**Aliquote IVA — ricevute il 13 agosto 2026, e cambiano una domanda.**

| Servizio | Ospite alloggiato | Cliente esterno |
|---|---|---|
| Pernottamento e prima colazione | 10% | non applicabile |
| Ingresso Day Spa / massaggi estetici | **10%** (accessorio) | **22%** (ordinario) |
| Cure termali mediche / fanghi | esente art. 10 (se certificate) | esente art. 10 (se certificate) |

Le aliquote non sono più il punto aperto. Il punto aperto è diventato un
altro, e più importante.

**L'aliquota di un ingresso Day Spa dipende da CHI lo usa**, e alla vendita
di un buono regalo non si sa: chi lo riceverà potrebbe presentarsi come
ospite dell'hotel (10%) o come esterno (22%). Un buono è monouso solo se il
trattamento IVA è determinabile **all'emissione**. Se dipende da un fatto
che si conoscerà solo al riscatto, il buono è **multiuso**, e allora l'IVA
non si assolve alla vendita — cioè non si emette la fattura al momento
dell'acquisto, che è l'impianto su cui è costruita tutta questa specifica.

Contro questa lettura gioca la prassi attuale dell'hotel: in Fidra i buoni
Day Spa portano già un numero di documento fiscale emesso alla vendita,
quindi di fatto vengono trattati come determinabili — presumibilmente al
22%, perché chi compra un regalo per un esterno.

**Domanda precisa per il commercialista:** un buono regalo per un ingresso
Day Spa, venduto a un cliente esterno, è monouso al 22% — e quindi si
fattura alla vendita come previsto qui — oppure il fatto che il portatore
possa risultare ospite dell'hotel (10%) lo rende multiuso, e va trattato
come i buoni monetari?

Fino alla risposta il listino porta le aliquote della tabella sopra e il
test di presidio resta rosso: sono i **buoni per cure termali** il caso
ancora più delicato, perché l'esenzione art. 10 vale solo "se certificate",
e la certificazione non esiste al momento della vendita del buono.

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
