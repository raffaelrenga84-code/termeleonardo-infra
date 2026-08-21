<title>Aggiornamenti Prompt Vocale</title>

# Cosa cambiare nel prompt di Grok voice

*15 agosto 2026 — dieci sostituzioni, dalla v4.8.1*

> ## ⚠ Non incollare il file `kb.ts`
>
> La Knowledge Base del chatbot scritto e quella vocale sono **quasi** identiche,
> ma non del tutto: nella versione del chatbot **manca la sezione FRASI CHIAVE
> NELLE 4 LINGUE**, tolta apposta perché scritta per essere pronunciata, coi
> numeri in lettere.
>
> Se copi tutto, **cancelli quella sezione dall'agente vocale**. Sostituisci solo
> i blocchi qui sotto.

---

## 1 · La data di riapertura è sbagliata

**Dove:** sezione 3, CHIUSURA STAGIONALE.

Il prompt dice che si riapre il **quattordici** febbraio. La proprietà ha
confermato che **il 13 febbraio l'hotel è già aperto**: è il giorno della
riapertura, non l'ultimo giorno di chiusura.

Non è un dettaglio: il 13 febbraio è il **primo giorno di stagione**, quello che
si riempie di meno, e così com'è l'agente manda via chi vuole venire proprio
quel giorno.

**Sostituisci le due righe delle date con:**

```
⟨verificare ogni anno⟩ **L'hotel è chiuso dal 29 novembre 2026 al 12 febbraio
2027 compreso, e riapre il 13 febbraio 2027.** In questo periodo sono chiusi
**hotel, SPA, campo pratica golf e Day Spa**: tutto.
```

**E nella formula da dire all'ospite**, sostituisci «riapriamo il quattordici
febbraio» con **«riapriamo il tredici febbraio»**.

---

## 2 · I buoni regalo si comprano online

**Dove:** Knowledge Base, sezione DAY SPA, nell'elenco puntato.

Questa è la correzione che vale più soldi di tutte. La riga attuale dice che i
buoni regalo **non** si comprano online — e non è più vero da mesi. L'agente sta
mandando al telefono gente che poteva comprare in due minuti, di sera, quando la
reception è chiusa.

**Sostituisci la riga che comincia con «Abbonati e buoni regalo» con queste due:**

```
- **Abbonati:** si gestiscono al telefono o via email, non online (vale anche
  per camera d'appoggio e massaggi collegati). Raccogli nome, data, recapito
  → inoltra.
- **Buoni regalo: si COMPRANO ONLINE** su termeleonardo.com, sezione Buoni
  Regalo. Al telefono si gestiscono solo i buoni **già emessi** — ricerca,
  riscatto, problemi: raccogli nome, recapito e n. buono → inoltra.
```

---

## 3 · Togli il vecchio elenco dei tre pacchetti

**Dove:** Knowledge Base, la riga che comincia con **«BUONI REGALO A LISTINO»**
(Ingresso Day Spa da 35 € · Spa & Massaggio Relax da 75 € · Giornata Benessere
Deluxe da 90 €).

**Cancellala.** Il sito non vende più quei tre pacchetti fissi: il buono si
compone liberamente. Lasciarla vuol dire far promettere all'agente un catalogo
che non esiste.

---

## 4 · La sezione nuova sui buoni regalo

**Dove:** Knowledge Base, come sezione nuova (va bene subito prima di
SOSTENIBILITÀ, o dopo TRANSFER E TAXI).

```
## BUONI REGALO — SI COMPRANO ONLINE, SUBITO

**Su termeleonardo.com, sezione Buoni Regalo.** Si paga con carta e il buono
arriva **per email in pochi minuti**, pronto da stampare o da inoltrare a chi
lo riceve. Non serve passare dalla reception e non serve aspettare.

*Questa è la cosa da dire per prima.* Chi chiede di un buono regalo di solito
lo vuole adesso — è un regalo, spesso all'ultimo.

**Cosa si può mettere dentro**
- **Un servizio a listino** (ingressi Day Spa, massaggi, trattamenti viso e
  corpo, programmi benessere): fino a **due voci diverse**, ognuna in quantità
  fino a **quattro**. Il prezzo è la somma del listino, senza sconti.
- **Un importo libero**, da **25 a 1000 €**, spendibile in hotel.

⟨verificare ogni anno⟩ **Prezzi degli ingressi a buono:** Day Spa
infrasettimanale **35 €** · festivo **45 €** · serale **29 €**.

**Il Day Spa SERALE non si può abbinare a un trattamento.** Di sera il centro
benessere non fa trattamenti, quindi quel buono non sarebbe utilizzabile in una
volta sola: il sito lo rifiuta. Chi vuole regalare tutti e due prende il Day Spa
infrasettimanale o festivo più il trattamento.

**Validità e chiusura stagionale**
- Dodici mesi dall'emissione.
- **Se la scadenza cadrebbe durante la chiusura, viene prorogata da noi** a un
  mese dopo la riapertura, e la data prorogata è quella stampata sul buono.
- **Trenta giorni prima della scadenza mandiamo un promemoria** a chi ha il
  buono in mano. Una volta sola.

**Regole da dire, se pertinenti**
- Non utilizzabile nelle **prime 48 ore** dall'acquisto.
- Non rimborsabile, non convertibile in denaro; gli importi residui dopo il
  primo utilizzo non sono trasferibili.
- Ingressi e trattamenti **sempre su prenotazione**.
- Ogni ingresso o trattamento vale **per una persona**.

**In reception:** il buono porta un **codice** e un **QR** che il banco legge
col lettore. Chi lo ha ricevuto può ristamparlo da solo dal link nella sua email.

**Fattura:** si può chiedere **al momento dell'acquisto**, come privato o come
azienda. Le aziende comprano buoni per il welfare aziendale: senza fattura non
possono, quindi se senti nominare "azienda", "welfare" o "dipendenti", dillo.

**Quando serve comunque la reception:** buoni già emessi da cercare o modificare,
riscatti, rimborsi, e le vendite al banco. Raccogli nome, recapito e **numero del
buono**, e inoltra.
```

---

## 5 · Le cure si possono fare anche privatamente

**Dove:** Knowledge Base, sezione CURE TERMALI.

La riga attuale — *«Convenzione SSN → serve la prescrizione del medico»* — sta
sotto un elenco che comincia con «Convenzionate SSN», e l'agente ne conclude che
**senza prescrizione non si può fare niente**. Verificato: è quello che risponde
oggi.

Chi pagherebbe di tasca sua sente «serve la prescrizione» e rinuncia. Un ospite
straniero non ha un medico di base italiano da cui farsela fare.

**Sostituisci quella riga con:**

```
- **Due strade, e vanno nominate tutte e due: in forma PRIVATA, oppure con la
  convenzione SSN.** La **prescrizione del medico serve solo per la convenzione
  SSN**: chi paga privatamente non ne ha bisogno. Basta la visita medica di
  ammissione, obbligatoria in tutti e due i casi.
```

---

## 6 · L'indirizzo postale, per esteso

**Dove:** Knowledge Base, subito prima di «Come arrivare».

Circolavano **cinque versioni diverse** di questo indirizzo, una col comune
sbagliato («di Teolo») in nove documenti che i clienti ricevono.

```
**INDIRIZZO POSTALE — questo, per esteso, quando lo chiedono:**
**Via Monteortone, 46 · 35037 Monteortone di Abano Terme (PD)**
*Coordinate: 45.349404, 11.754545.* Non dire solo "Abano Terme": Monteortone è
la frazione, e chi imposta il navigatore senza quella finisce altrove.
```

---

## 7 · La certificazione GSTC

**Dove:** Knowledge Base, sezione nuova.

Alla domanda sulla sostenibilità l'agente oggi **non ha niente da dire**, mentre
il concorrente risponde con le sue certificazioni. Ed è un primato vostro.

```
## SOSTENIBILITÀ E CERTIFICAZIONI ⟨verificare⟩

**L'hotel è certificato GSTC — Global Sustainable Tourism Council**, ed è il
**primo hotel termale in Europa** a ottenerla.

Rispondi con orgoglio ma senza gonfiare: riguarda la gestione responsabile delle
risorse, la riduzione degli impatti ambientali e l'attenzione al territorio.
**Non attribuire all'hotel certificazioni che non sono elencate qui** (per
esempio ISO): se l'ospite ne nomina una che non c'è, di' che quella non la puoi
confermare e gliela conferma la reception.
```

---

## 8 · Il periodo migliore per venire

**Dove:** Knowledge Base, sezione nuova.

```
## PERIODO MIGLIORE PER VENIRE

Non esiste un periodo "migliore" in assoluto: dipende da cosa cerca l'ospite.
Chiediglielo se non è chiaro, altrimenti rispondi per stagioni, una riga
ciascuna.

- **Primavera e autunno** — il periodo classico per le cure termali e per chi
  vuole camminare sui Colli: temperature miti, struttura meno affollata.
- **Estate** — piscine, prato con vista sui Colli, parco e ingressi Day Spa. È
  il periodo più richiesto nei weekend, quindi il Day Spa si prenota prima.
- **Inverno** — **attenzione: siamo aperti solo fino a fine novembre e poi da
  metà febbraio.** Nel mezzo l'hotel è chiuso per la pausa stagionale.

**Non promettere il meteo** e non dire che un mese è "sempre" bello.
```

---

## 9 · Gli indirizzi dei reparti

**Dove:** Knowledge Base, sezione nuova.

```
## INDIRIZZI DEI REPARTI ⟨verificare⟩

Da dare all'ospite quando chiede a chi scrivere per una cosa specifica:

- **Massaggi, trattamenti e benessere:** spa@termeleonardo.com
- **Tutto il resto:** info@termeleonardo.com · Reception +39 049 9939200
- **Cure termali:** Segreteria Cure +39 049 9939234

Darli è utile, ma **non sostituisce l'inoltro**: se hai già nome e recapito, la
richiesta la giri tu e non la scarichi sull'ospite.
```

---

## 10 · Il numero di versione

In cima al prompt, aggiungi la riga delle novità e porta la versione a **v4.9**,
così fra sei mesi si capisce quale versione è caricata sull'agente.

---

## 11 · I più richiesti erano quelli sbagliati

**Dove:** Knowledge Base, sezione MASSAGGI E TRATTAMENTI, il blocco «Se
l'ospite non sa cosa scegliere».

Il prompt propone **antistress, relax al cacao, Ayurveda**. Sul listino
stampato del centro benessere i più richiesti sono segnati col ♥, e sono
altri: i **cinque Programmi**, il **Relax con olio di cacao**, lo **Shiatsu**,
**manicure** e **pedicure**. Le due liste coincidono su **una voce sola**.

Il prompt dice anche «Antistress — il più richiesto», che secondo il listino
non è vero. E non nomina mai i Programmi, che sono anche i più cari (90–130 €).

La proprietà ha confermato il 15 agosto 2026: **vale il listino**.

**Sostituisci quel blocco con questo:**

```
**I PIÙ RICHIESTI — sono questi, e sono quelli segnati col ♥ sul listino del
centro benessere.** ⟨verificare ogni anno col listino⟩

- i **cinque Programmi**: Coccola 90 € · Viso Antirughe 90 € · Viso Termale
  95 € · Oriente 130 € · Antistress 130 €
- **Massaggio Relax con olio di cacao**, 25 min, 40 €
- **Massaggio Shiatsu**, 50 min, 70 €
- **Manicure** da 30 € · **Pedicure** da 40 €

**Se l'ospite non sa cosa scegliere, dinne al massimo TRE**, una riga
ciascuna, poi fermati — l'elenco qui sopra è quello da cui pescare, non da
recitare. Scegli i tre in base a cosa ha detto:

- vuole **qualcosa di veloce**, o è appena uscito dalle piscine → Relax con
  olio di cacao, venticinque minuti
- vuole **un massaggio vero**, o parla di tensioni → Shiatsu, cinquanta minuti
- vuole **coccolarsi**, è un regalo, o ha tempo → un Programma, dicendo cosa
  comprende

**Non elencare mai l'intero listino a voce**, e non nominare manicure e
pedicure come consiglio: sono fra i più richiesti perché la gente le prenota,
non perché siano una risposta a «cosa mi consiglia».
```

L'ultima riga conta: manicure e pedicure sono nella lista dei ♥, ma proporle a
chi chiede «cosa mi consiglia» fa sembrare che il centro benessere non abbia
di meglio.

---

## Cosa NON è cambiato

Prezzi delle camere, fasce dei bambini, transfer, tassa di soggiorno, animali,
piscine, cure, procedure degli strumenti, divieti. Non toccarli.

## Una cosa da verificare, non da modificare

Nel prompt c'è la formula del Day Spa **«le prenotazioni non sono ancora aperte,
apriamo circa una settimana prima»**. Nell'agente vocale è **legittima**, perché
lì esiste davvero lo strumento `check_dayspa_availability` che distingue i casi.

Nel chatbot scritto quello strumento **non esiste**, e la frase pronta lo faceva
rispondere così anche per date in cui l'hotel è **chiuso**. Nel vocale il
problema non si pone, **a patto che** la regola della chiusura stagionale (punto
1) venga controllata **prima**, come già dice la sezione 3. Vale la pena provarlo
con una telefonata: chiedi il Day Spa del 20 dicembre 2026 e senti cosa risponde.
