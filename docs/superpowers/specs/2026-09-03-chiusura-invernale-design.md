# La chiusura invernale, detta bene: in Outlook e sul sito

*3 settembre 2026 — deciso con la proprietà in brainstorming*

## Perché

L'hotel chiude dal **29 novembre 2026** (ultima notte il 28) e riapre con il primo
arrivo il **13 febbraio 2027**; l'ufficio prenotazioni torna operativo dall'**8
gennaio 2027, lunedì–venerdì 9–17**. Oggi il sistema lo dice male o non lo dice:

- **Sito, pagina Prenota.** Chi cerca date dentro la chiusura legge «Non risultano
  camere libere per queste date. Provi con altre date…». Non è vero che non ci
  sono camere: siamo chiusi, e l'ospite non viene a saperlo, né sa quando
  riapriamo.
- **Outlook.** Il pulsante «Rispondi: siamo chiusi» esiste solo per le richieste
  con arrivo dentro la chiusura, e dice «riapre a metà febbraio». Niente auguri,
  niente ufficio prenotazioni, e a chi scrive a dicembre per marzo non propone
  niente.

## Le date, in un posto solo

- **Sito e funzioni** leggono la tabella `stagione_chiusura` del database
  (colonne `chiusura`, `riapertura`), già usata da buoni, chat e richieste. La
  riga 2026/27 deve valere `2026-11-29` → `2027-02-13`. Non è leggibile da qui:
  si verifica con la nuova lettura pubblica appena la funzione è pubblicata; se
  manca o è diversa, si corregge nella tabella, non nel codice.
- **L'estensione** non può leggere il database e tiene la sua copia in
  `template.js`, `CHIUSURA`. Diventa:

  ```js
  const CHIUSURA = {
    dal: '2026-11-29',        // primo giorno di chiusura
    al: '2027-02-13',         // riapertura: primo arrivo
    riaperturaVaga: false,    // la data è esatta
    ufficioDal: '2027-01-08', // l'ufficio prenotazioni torna operativo
    auguriFinoAl: '2027-01-06' // fino all'Epifania i testi augurano buone feste
  };
  ```

  Gli orari dell'ufficio stanno nei testi per lingua (`CHIUSURA_T[l].orari`):
  «lunedì–venerdì 9–17», «Montag–Freitag 9–17 Uhr», «Monday–Friday 9am–5pm»,
  «lundi–vendredi 9h–17h». La prova «LA STAGIONE NON È VECCHIA» resta e vale
  anche per `ufficioDal`.

## 1. La funzione `richieste`

**`a=stagione`** (GET, pubblica, con CORS): restituisce `{ esito: 'ok', stagione:
{ chiusura, riapertura } }` con la prima stagione la cui `riapertura` è dopo oggi
(data UTC), oppure `{ esito: 'ok', stagione: null }`. Legge con `leggiStagioni()`;
se la lettura fallisce risponde `stagione: null`, non un errore: la pagina non
deve rompersi per un guasto di lettura.

**`a=disponibilita`**: dopo la convalida dei parametri e **prima** di chiamare
`check-availability`, se il soggiorno chiesto tocca una chiusura risponde
`{ esito: 'ok', proposte: [], chiuso: { chiusura, riapertura } }` senza chiamare
il servizio a monte. «Tocca» vuol dire che c'è almeno una notte dentro:
`check_in < riapertura && check_out > chiusura`. La regola è una funzione pura,
`chiusuraCheCopre(check_in, check_out, stagioni)` in `dayspa-disponibilita.ts`
accanto ad `aHotelChiuso`, che restituisce la stagione o `null`.

## 2. La pagina Prenota (`pagine/prenota/index.html`)

**All'apertura** la pagina chiede `?a=stagione`. Se oggi è dentro la stagione
(`chiusura ≤ oggi < riapertura`) compare, sopra la guida «Scelga le date…», una
riga color oro:

- prima dell'8 gennaio: «Siamo chiusi fino al 12 febbraio 2027. Le prenotazioni
  per la nuova stagione sono aperte: l'ufficio prenotazioni risponde dall'8
  gennaio, lunedì–venerdì 9–17.»
- dall'8 gennaio: «Siamo chiusi fino al 12 febbraio 2027. Le prenotazioni per la
  nuova stagione sono aperte: l'ufficio prenotazioni risponde lunedì–venerdì
  9–17.»

L'8 gennaio e gli orari li scrive la pagina nei suoi testi (`ufficioDal`,
`orari`), perché non stanno nella tabella; la tabella dà chiusura e riapertura.
Se la lettura fallisce o non c'è una stagione, non compare niente: niente date
inventate.

**Alla ricerca**, se la risposta porta `chiuso`, al posto di «Non risultano
camere libere» esce:

> In quel periodo l'hotel è chiuso, dal 29 novembre 2026 al 12 febbraio 2027.
> Riapriamo il 13 febbraio 2027.

con sotto un pulsante **«Cerca dal 13 febbraio»** che mette l'arrivo alla
riapertura, la partenza alla riapertura più le stesse notti che l'ospite aveva
chiesto (`dateDallaRiapertura(riapertura, notti)`, funzione pura), e rilancia la
ricerca. Le date si scrivono per esteso nella lingua della pagina, con la
funzione che la pagina usa già per il riepilogo. Quattro lingue:

| | chiusi per quelle date | pulsante |
|---|---|---|
| it | In quel periodo l'hotel è chiuso, dal {dal} al {ultimo}. Riapriamo il {riapertura}. | Cerca dal {riapertura} |
| de | In diesem Zeitraum ist das Hotel geschlossen, vom {dal} bis {ultimo}. Wir öffnen am {riapertura} wieder. | Ab {riapertura} suchen |
| en | The hotel is closed in that period, from {dal} to {ultimo}. We reopen on {riapertura}. | Search from {riapertura} |
| fr | L'hôtel est fermé à cette période, du {dal} au {ultimo}. Nous rouvrons le {riapertura}. | Chercher à partir du {riapertura} |

«{ultimo}» è il giorno prima della riapertura. La riga in cima, nelle quattro
lingue, con la stessa forma: «Siamo chiusi fino al {ultimo}. Le prenotazioni per
la nuova stagione sono aperte: l'ufficio prenotazioni risponde {da quando}
{orari}.»

Il campo delle date resta com'è (`min` = oggi): prenotare per dopo la
riapertura è proprio quello che vogliamo.

## 3. L'estensione, in Outlook

Un pulsante solo, **«Rispondi: siamo chiusi»**, che sceglie il testo dalle date.
Due funzioni pure in `template.js`, accanto a `dentroChiusura`:

- `faseChiusura(oggiISO)` → `'aperto'` | `'chiusoPrimaUfficio'` |
  `'chiusoUfficioAperto'`: aperto fuori da `[dal, al)`; prima dell'ufficio se
  `oggi < ufficioDal`.
- `auguri(oggiISO)` → vero da `dal` a `auguriFinoAl` compresi.

Quando compare (`trovaRichiestaChiusura`, che oggi guarda solo le date lette):

- **arrivo dentro la chiusura**, in qualunque momento: variante «in quel periodo»
  (come oggi, con la riapertura esatta);
- **oggi dentro la chiusura e prima dell'8 gennaio**, su una richiesta con arrivo
  dopo la riapertura o senza date: variante «chiusi ora»;
- **dall'8 gennaio** l'ufficio lavora: a quelle richieste si risponde con
  l'offerta normale, e il pulsante resta solo per le date dentro la chiusura.

I testi (`CHIUSURA_T`, quattro lingue) cambiano così:

- `intro`: la riapertura è una data esatta («riapre il 13 febbraio 2027»); sparisce
  «a metà febbraio»;
- nuova variante `chiusoOra`: titolo «In questo momento siamo chiusi», testo «La
  ringraziamo per la Sua richiesta. L'Hotel Terme Leonardo è chiuso per la pausa
  stagionale fino al 12 febbraio 2027. L'ufficio prenotazioni riapre l'8 gennaio
  2027 (lunedì–venerdì 9–17) e Le risponderà con una proposta per la nuova
  stagione.»;
- riga `ufficio` anche nella variante «in quel periodo», quando la risposta parte
  prima dell'8 gennaio: «L'ufficio prenotazioni riapre l'8 gennaio 2027,
  lunedì–venerdì 9–17.»;
- riga `auguri`, in coda, quando `auguri(oggi)`: «Le auguriamo buone feste.» /
  «Wir wünschen Ihnen frohe Festtage.» / «We wish you a happy holiday season.» /
  «Nous vous souhaitons de bonnes fêtes.»

L'anteprima in Outlook dice quale variante ha scelto e perché («oggi 15 dicembre:
chiusi, ufficio dall'8 gennaio; ha chiesto il 20 marzo»). Versione 2.26.0.

## Casi limite

- Tabella non leggibile o senza stagione: il sito non mostra niente di speciale e
  la ricerca cade sul messaggio di oggi; la funzione scrive l'errore nel log.
- Soggiorno a cavallo dell'inizio chiusura (arrivo 25 novembre, partenza 2
  dicembre): «tocca» la chiusura, esce il messaggio con le date; l'ospite può
  accorciare o spostare.
- Dopo il 13 febbraio 2027: `dentroChiusura` falso, fase «aperto», il pulsante non
  compare; il sito non mostra la riga in cima.
- Stagione successiva: si aggiungono la riga in tabella e le date in `CHIUSURA`;
  la prova «LA STAGIONE NON È VECCHIA» ricorda di farlo.

## Prove

- `supabase/functions/richieste`: `chiusuraCheCopre` sui quattro casi (dentro,
  a cavallo dell'inizio, a cavallo della fine, fuori); `a=stagione` e il ramo
  `chiuso` di `a=disponibilita` letti dal sorgente dell'handler.
- `pagine/prenota/chiusura.test.ts`: i testi delle quattro lingue estratti ed
  eseguiti con date vere; `dateDallaRiapertura` eseguita; il ramo `chiuso` e la
  riga in cima letti dal sorgente.
- `estensione/chiusura.test.ts`: `faseChiusura` e `auguri` eseguite su date
  scelte (28 novembre, 15 dicembre, 6 gennaio, 7 gennaio, 8 gennaio, 12 febbraio,
  13 febbraio); i quattro testi con la riapertura esatta e senza «metà febbraio»;
  la variante «chiusi ora» con la riga dell'ufficio; le condizioni del pulsante
  lette dal sorgente; «la chiusura si aggiorna in un posto solo» e «LA STAGIONE
  NON È VECCHIA» restano.

## Rilascio

- Sito: da `main`, Vercel.
- Funzione `richieste`: a mano, `--no-verify-jwt`, serve il token della
  proprietà; poi `curl ?a=stagione` per verificare la riga 2026/27.
- Estensione 2.26.0: `node strumenti/estensione.js`, ricaricare sui PC.

## Fuori da questo disegno

La scelta delle date su Prenota da telefono (calendario unico): disegno a parte,
subito dopo.
