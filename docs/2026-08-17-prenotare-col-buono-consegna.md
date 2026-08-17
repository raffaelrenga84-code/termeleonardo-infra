<title>Prenotare col buono — consegna</title>

# Prenotare col buono regalo — cosa è stato fatto, e cosa resta

*17 agosto 2026*

Chi riceve un buono regalo doveva telefonare per usarlo. Ora prenota dal sito.
Sei compiti, tutti chiusi e revisionati; **niente è ancora pubblicato**.

Questo documento serve a due cose: pubblicare nell'ordine giusto, e non
perdere quello che è stato trovato ma non chiuso.

---

## L'ordine di pubblicazione, e perché non è indifferente

**`richieste` → pagine → riscritture `vercel.json` → `buoni` → `chat`.**
Il foglio A4 si stampa **solo alla fine**.

Ogni inversione produce un guasto che risponde `200` — di quelli che nessuno
vede finché non se ne lamenta un ospite:

| Se si pubblica… | Succede |
|---|---|
| le pagine **prima** della funzione `richieste` | L'ospite compila tutto e legge «non siamo riusciti a registrare la richiesta, ci chiami» — la telefonata che questo lavoro esiste per togliere |
| le riscritture **prima** delle pagine | `/it/day-spa` apre il modulo **green fee**: il `percorso.js` in linea non conosce quell'indirizzo e ripiega sul primo tipo |
| la funzione `buoni` **prima** delle riscritture | Ogni pulsante «Prenota online» di un buono Day Spa porta alla **home della vetrina** |

Misurato in produzione il 17 agosto: `/it/day-spa` risponde 6583 byte (la
vetrina); il modulo vero ne pesa 45513. È il modo più rapido di verificare che
una riscrittura sia viva davvero.

---

## Un difetto vivo, trovato per caso e corretto

`linkStampa()` componeva l'indirizzo del foglio **con una barra finale**, e
quella barra fa fallire la riscrittura:

```
/buoni/stampa?codice=…    →  Buono Regalo — Hotel Terme Leonardo   ✓
/buoni/stampa/?codice=…   →  Hotel Terme Leonardo | 4 stelle …     ✗
```

Il pulsante «Stampa il tuo buono» di **ogni** mail portava alla homepage.
Nessuno ci è sbattuto perché di buoni non ne è stato venduto ancora nessuno.

Un commento nel codice affermava il contrario — che la riscrittura copriva
anche `/buoni/stampa/`. Era la ragione per cui nessuno era andato a
controllare. Corretto anche quello.

**Il difetto è generale: la barra finale rompe qualunque riscrittura.**
`/it/trattamenti` dà 45513 byte, `/it/trattamenti/` dà i 6583 della vetrina.

---

## Cosa va deciso dalla proprietà

**Un buono con quantità maggiore di uno.** Chi regala due massaggi vede il
modulo spuntarne uno solo, e in reception arriva una richiesta per uno. La
quantità è scritta nelle note, quindi l'informazione non si perde. Aggiungere
un campo quantità al modulo è una decisione a parte.

**Il caso di punta della specifica oggi tace.** Buono «Day Spa + massaggio»:
se l'ospite sceglie uno Shiatsu da 80 € invece dei 70 coperti, la pagina non
dice nulla, né in un verso né nell'altro. La scelta è deliberata — meglio
niente che una cifra falsa — ma la somma delle sole voci-trattamento è già
calcolata e sarebbe dicibile senza approssimare.

**Il sottotitolo dei buoni di reception.** Il campo accetta 120 caratteri; a
quel limite il margine del foglio scende da 23 a 11 pixel. **Non taglia** —
il taglio comincia oltre i 200 caratteri, che il server non permette — ma il
margine di sicurezza dichiarato è 20. Il rimedio giusto è abbassare il tetto
del campo a 90-95 caratteri, non stringere ancora il foglio.

**Il pulsante nelle email su Outlook.** Il padding sta sull'`<a>` invece che
sul `<td>` e manca `bgcolor`: è proprio quello che il motore Word non regge.
È la copia fedele del pulsante «Stampa» già in produzione, quindi vanno
cambiati insieme, con una prova su un Outlook vero. Nessuno dei due è mai
stato guardato lì.

**L'agente vocale.** La stessa Knowledge Base vive nel prompt vocale, che si
aggiorna a mano per sostituzioni. Finché quel blocco non è sostituito, al
telefono l'agente continua a dire che il Day Spa «si prenota esclusivamente
online» anche a chi ha un buono.

---

## Da verificare dopo la pubblicazione, in ordine di rischio

1. **La prima richiesta Day Spa vera, fino alla casella della reception.**
   Guardare l'email, non il back office: l'email è il modo in cui la reception
   *scopre* che è arrivata una richiesta.
2. **Le quattro riscritture, misurate a byte**, anche con la barra finale.
3. **La latenza vera di `?a=dayspa`.** Fa una lettura sul database più una
   chiamata **non cachata** al sito precedente. Se supera i 6 secondi, ogni
   risposta diventa «non riusciamo a verificare» e la riga della disponibilità
   non serve più a niente. Insieme: il freno e il rifiuto delle date impossibili,
   mai esercitati dal vivo — il ponte usato nelle prove era finto.
4. **Una data Day Spa davvero piena**, se capita. È l'unico modo di sapere cosa
   risponda l'API quando non c'è posto. Oggi il sistema dice «disponibile» in
   caso di dubbio: sbaglia nella direzione sicura, ma sbaglia.
5. **Il primo buono venduto davvero, fino al foglio stampato.**

---

## Due cose che il codice non dice

**La tabella dei buoni è vuota.** Non ne è stato venduto nessuno. Le pagine
d'acquisto sono vive in tutte e quattro le lingue, quindi si può comprare: se
il negozio è online da un po', vale la pena guardare se la pagina si trova.

**Un tipo nuovo attraversa più moduli di quanti se ne elenchino.** Il piano ne
nominava due; il tipo `dayspa` ne ha attraversati **sei**: la validazione, il
riepilogo del back office, l'email alla reception, la conferma all'ospite, il
prompt del chatbot e l'elenco degli strumenti del chatbot. I quattro dimenticati
li ha trovati la revisione d'insieme, non le sei revisioni per compito — ognuna
guardava la propria lista.
