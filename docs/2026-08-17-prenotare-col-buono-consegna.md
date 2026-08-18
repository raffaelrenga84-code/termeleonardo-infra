<title>Prenotare col buono — consegna</title>

# Prenotare col buono regalo — cosa è stato fatto, e cosa resta

*17 agosto 2026*

Chi riceve un buono regalo doveva telefonare per usarlo. Ora prenota dal sito.
Sei compiti, tutti chiusi e revisionati.

**Pubblicato il 18 agosto 2026**, alle 06:59-07:00, nell'ordine descritto
qui sotto: `richieste` v29, le pagine, le quattro riscritture, `buoni` v53,
`chat` v28. Entrambi i depositi spinti.

La pubblicazione è partita **per sbaglio**: `strumenti/pubblica-tutto.js`
non aveva la guardia `require.main`, e un comando che voleva solo caricare
il modulo per esaminarlo ha invece eseguito tutti e cinque i passi. I
cancelli hanno tenuto — l'ordine è stato rispettato e ogni passo è passato
la sua verifica prima del successivo — ma nessuno aveva dato il via. La
guardia adesso c'è, e il commento nel file racconta perché.

Questo documento serve a due cose: tenere il perché dell'ordine, e non
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

## Misurato in linea dopo la pubblicazione

`node strumenti/pubblica-tutto.js --prova` rimisura i cancelli quando serve,
senza toccare niente.

| Cosa | Prima | Dopo |
|---|---|---|
| `?a=dayspa` | 401 «non autorizzato» | 200, `stato` giusto |
| `/richieste/` in linea | zero occorrenze di `dayspa` | 20 |
| `/it/day-spa` `/de/` `/en/` `/fr/` | 6583 byte (vetrina) | 91729 byte (il modulo) |
| `/comune/percorso.js` dalla vetrina | — | 200 `application/javascript`, conosce `day-spa` |

I quattro indirizzi resi in un browser vero danno il titolo giusto nella lingua
giusta: «Una giornata alle piscine termali», «Ein Tag in den Thermalbecken»,
«A day at the thermal pools», «Une journée aux piscines thermales». Il tipo e la
lingua li ricava `percorso.js` dal percorso, non dalla query: la riscrittura è
un proxy, e il browser la query non la vede mai.

**La latenza non è un problema**: 0,26 · 0,39 · 0,83 secondi, contro un tetto
di 6. I rifiuti rispondono giusto — data nel passato, data non valida, persone
non valide, `persone=0`. L'orizzonte dei 7 giorni taglia dove deve (24 agosto
disponibile, 26 «non aperte»).

**Il freno per indirizzo IP non è stato provato**: esercitarlo vuol dire
sessanta chiamate in cinque minuti, cioè fare al proprio sito quello che si
chiederebbe a un altro di non fare.

`/it/day-spa/` con la barra finale dà i 6583 byte della vetrina, come previsto:
la barra rompe qualunque riscrittura, e questo non si può correggere dal lato
delle regole.

## Cosa resta da verificare, in ordine di rischio

1. **La prima richiesta Day Spa vera, fino alla casella della reception.**
   Guardare l'email, non il back office: l'email è il modo in cui la reception
   *scopre* che è arrivata una richiesta. È la verifica che conta più di tutte,
   ed è l'unica che non si può fare senza un ospite vero.
2. **Una data Day Spa davvero piena**, se capita. È l'unico modo di sapere cosa
   risponda l'API quando non c'è posto. Oggi il sistema dice «disponibile» in
   caso di dubbio: sbaglia nella direzione sicura, ma sbaglia.
3. **Il primo buono venduto davvero, fino al foglio stampato.**
4. **Il pulsante in un Outlook vero**, insieme a quello «Stampa» già in
   produzione — vanno guardati insieme, vedi sopra.

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
