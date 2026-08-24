<title>Il preventivo che non ricopia</title>

# Il preventivo che non ricopia

*23 agosto 2026*

Una richiesta di prezzi arriva per email, l'ospite non ha una pratica in Fidra,
e per rispondergli oggi bisogna aprirgliene una. **Il preventivo fuori da Fidra
c'era già: fu tolto perché chiedeva i prezzi a mano.** Torna adesso perché
«Disponibilità e prezzi» li legge da solo, e la ragione per cui fu tolto non
esiste più.

---

## Non è una funzione nuova: è una che fu tolta

Sta ancora tutta nel codice, spenta.

| dove | cosa c'è |
|---|---|
| `popup.js:6` | `MODO = 'fidra'` oppure `'rapido'` |
| `popup.js:499` `disegnaRapido()` | disegna **solo** Info Day Spa e Buoni regalo |
| `popup.js:549` `aggiungiCameraRapida()` | definita, **non la chiama nessuno** |
| `popup.js:625` `costruisciDatiRapidi()` | legge ancora `rapArrivo`, `rapPartenza`, `.camRapida`, `rapBambini`, `rapScadenza`, `rapAcconto`, `rapRif` |
| `popup.js:986` | stampa ancora *«quando l'ospite accetta, registra l'offerta in Fidra»* |

Il riquadro che l'operatore vede al posto di quel modulo dice perché:

> Offerte, conferme e solleciti si generano **solo dalla prenotazione aperta in
> Fidra**: apri la scheda del cliente e riapri l'estensione. Così i dati sono
> quelli veri, non ricopiati.

## Perché fu tolta, e perché ora torna

Quel modulo chiedeva **il prezzo a persona in una casella** (`rapPrezzo`), più
acconto e scadenza. È il caso Kreiner scritto nel LEGGIMI della 2.7.0 — *«ho
copiato il modello con prezzi dus non inseriti»*. Un preventivo che si digita è
un preventivo che si sbaglia, e si sbaglia proprio sull'uso singola.

«Disponibilità e prezzi» non digita niente:

- `fidra-disponibilita.js:199-200` chiama `/api/available/rooms` e
  `/api/available/rates` con `credentials: 'same-origin'` — la sessione di Fidra
  è già valida, nessuna chiave, nessun dato che esce;
- `calcola()` (`:223`) somma **l'uso singola** e **i bambini per età**, cioè i
  due numeri che a mano non venivano messi.

Sono le stesse tariffe che alimentano il motore del sito. Rimettere la funzione
prendendo i prezzi da lì rimette la funzione **senza rimettere il difetto.**

Il ponte esiste già a metà: `copiaDettaglio()` (`:1393`) mette in
`chrome.storage` un `leonardo_dettaglio` che `popup.js:398` rilegge. Una riga
lo ferma proprio nel nostro caso:

```js
if (dt.prenotazione && !idOra) return;   // fuori da una prenotazione: non si applica
```

Quella riga resta com'è. Il preventivo prende una strada sua — il perché è più
sotto.

## Perché non da `check-availability`

L'endpoint esiste ed è nostro, ma serve a un'altra domanda.
`supabase/functions/check-availability/index.ts` è un **proxy CSRF verso il sito
pubblico**: carica `termeleonardo.com/it` come farebbe un browser, ne estrae il
token e il cookie, e con quelli interroga `termeleonardo.com/api/available/rates`.
È il modo con cui una pagina **senza sessione** legge i prezzi — nato per il
modulo di richiesta del sito, dove chi guarda non è loggato in niente.

Il modale sta dalla parte opposta del banco.

| | modale, dentro Fidra | `check-availability` |
|---|---|---|
| da dove legge | `leonardo.fidra.cloud` (il gestionale) | `www.termeleonardo.com` (il sito) |
| che cosa espone | `/api/available/rooms` **e** `/api/available/rates` | **solo** `rates` |
| come si autentica | la sessione dell'operatore, `same-origin` | proxy CSRF + `PROXY_KEY` |
| che cosa vede | quello che vede la reception | quello che vede il pubblico |

Tre conseguenze, e la prima da sola decide:

1. **Manca `rooms`, e senza `rooms` non c'è preventivo.** `libere()` (`:206`)
   costruisce tutto da `camere.rooms`, `stay_days`, `unavailability` e
   `room_category`: i numeri di camera, quante ne restano, e la capienza che
   `punteggio()` usa per ordinare. `calcola()` (`:223`) riceve proprio quella
   `categoria`. Con le sole tariffe non si sa nemmeno se la camera c'è.
2. **È la vista del pubblico, non quella della reception.** Un preventivo
   preparato al banco deve portare il prezzo che Fidra applicherà, non quello
   che il sito espone.
3. **Vuole una chiave.** `PROXY_KEY` finirebbe dentro una cartella scompattata
   sui computer della reception. L'intestazione del modale dichiara oggi il
   contrario — *«la sessione è già valida: nessuna chiave, nessun dato che esce
   da qui»* — e non vale la pena perderlo. Oggi l'estensione chiama una sola
   funzione Supabase, `prepara-arrivo` (`popup.js:852`), e nessun endpoint di
   disponibilità.

**Quando servirebbe davvero.** Se un giorno si volesse preventivare **da
Outlook, senza aprire Fidra**, il modale non c'è e il proxy sarebbe la strada —
ma andrebbe esteso anche a `rooms`, e resterebbe la vista pubblica. È un altro
progetto: qui l'operatore è già dentro Fidra, perché è lì che guarda se la
camera c'è.

---

## Il confine: chi fa cosa

| | |
|---|---|
| **Modale** `fidra-disponibilita.js` | sceglie e misura → dati grezzi, **in italiano come li scrive Fidra** |
| **Pannello** `popup.js` | a chi è rivolto, in che lingua |
| **Modelli** `template*.js` | traducono e impaginano |

**Il modale non traduce.** Le quattro lingue sono già nei modelli, e sono quelle
provate da mesi sulle offerte vere:

- `template.js:128` `traduciTrattamento` → it, de, en, fr
- `kategorieDE` (`template-de.js:14`), `categoryEN` (`template-en.js:20`),
  `categorieFR` (`template-fr.js:20`)
- `MESI_LUNGHI`, `importoLingua` → quattro lingue

Le tabelle `CATEG` e `TRATT` dentro `fidra-disponibilita.js:1324-1337` sono un
doppione parziale — **solo tedesco** — di quel lavoro. Restano dove sono perché
servono a `testoDettaglio()`, che è un'altra strada e non si tocca. Il
preventivo non le usa: chiedere al modale di tradurre vorrebbe dire mantenere
due traduzioni che devono restare uguali, e non lo resteranno.

## Il dato che passa

Chiave nuova `leonardo_preventivo` in `chrome.storage.local`:

```js
{
  quando:  1755950000000,
  arrivo:  '2026-08-23',
  partenza:'2026-08-26',
  notti:   3,
  adulti:  2,
  etaBambini: [],
  voci: [
    { categoria: 'DOPPIA',
      trattamento: 'Miglior Prezzo Mezza Pensione',
      prezzoPP: 39000,        // centesimi, a persona
      totale:   78000,        // centesimi, soggiorno intero
      cure:     0,            // a persona
      sconto5:  0,            // già tolto dal prezzo
      sconto3:  0 }           // reso alla partenza: NON tolto dal prezzo
  ]
}
```

Centesimi interi: è l'unità che `euro(cent)` usa in tutto il file, e passare ai
decimali qui vorrebbe dire convertire due volte.

Nomi **non tradotti**: `categoria` e `trattamento` come Fidra li scrive. A
tradurli ci pensano i modelli.

Nessun campo `prenotazione`: è precisamente il caso in cui non ce n'è una.

**Perché una chiave nuova e non `leonardo_dettaglio`.** Quello è testo già
impaginato e appartiene a **una** pratica: il controllo di `popup.js:406` esiste
perché nella v2.2.4 il dettaglio di una prenotazione ricompariva su un'altra,
con i dati sbagliati e l'aria di essere giusto. Far passare da lì un dato senza
pratica vorrebbe dire indebolire quel controllo. Due chiavi, due regole, nessuna
delle due allentata.

## La selezione nel modale

In `disegna()` (`fidra-disponibilita.js:658`) ogni riga trattamento ha già
`Notte per notte`. Le si affianca `+ Prev.`, con gli stessi `data-cat` /
`data-tratt` / `data-idx` che il pulsante accanto usa già.

In fondo al riquadro, una barra che compare solo con almeno una voce scelta:

    2 sistemazioni scelte  ·  [ Crea preventivo ]

**Massimo quattro voci.** Oltre, il pulsante `+ Prev.` si disattiva e la barra
lo dice. Dieci alternative non sono un preventivo, sono un listino: chi le
riceve non sceglie, richiede.

`Crea preventivo` scrive `leonardo_preventivo` e lo dice nel riquadro d'esito,
come fa già `copiaDettaglio()`.

## Il pannello

`disegnaRapido()` (`popup.js:499`) prende una terza voce sotto «Che cosa mandi»:

    ( ) Info Day Spa
    ( ) Buoni regalo
    ( ) Preventivo soggiorno

**Compare solo se c'è un `leonardo_preventivo` fresco di mezz'ora** — stessa
soglia del dettaglio (`popup.js:401`). Se manca o è scaduto, la voce non c'è.

Sotto, in **sola lettura**, quello che è stato scelto: periodo, ospiti, e le
sistemazioni con i loro prezzi. Poi i campi che il pannello ha già — cognome e
nome, email, genere, lingua (tutte e quattro), firma.

**Nessun campo prezzo, e nessun ripiego manuale.** Se il preventivo non c'è,
non esiste un modulo dove digitarlo: è questa la differenza fra ciò che si
aggiunge e ciò che fu tolto. `aggiungiCameraRapida()` e i rami di
`costruisciDatiRapidi()` che leggono `rapPrezzo`, `rapAcconto`, `rapScadenza`,
`rapRif` si cancellano — codice morto che descrive un modo di lavorare che
abbiamo deciso di non avere.

Prima di generare, l'anteprima, come per gli altri tre pulsanti dalla v2.7.1.

## Il documento

Modello **`preventivo`** nuovo in `template.js` e nelle tre lingue. Riusa
`intestazioneCamera`, `traduciTrattamento`, le tre mappe categoria,
`MESI_LUNGHI`, `importoLingua`, `prezzoCamera`.

**Non riadatta `offerta`.** Quella vive di `numeroOfferta`, `acconto`,
`scadenza`, `linkPagamento` (`template.js:842-1003`): numero d'offerta in
testata, pulsante «Conferma Ora», causale del bonifico, caparra confirmatoria.
Nessuno dei quattro esiste qui, e un'offerta con quei blocchi vuoti sarebbe
peggio di un documento più corto.

Il preventivo dice: periodo, ospiti, le sistemazioni scelte con che cosa
comprendono e quanto costano. E chiude, **in tutte e quattro le lingue**, con
quello che il modale già avverte a schermo:

> I prezzi sono le tariffe di oggi e cambiano con l'occupazione. Questo
> preventivo **non blocca la camera**: la disponibilità si verifica al momento
> della conferma.

Non è una cautela legale, è la verità misurata: sta scritto nel riquadro
«Da rileggere prima di promettere» di `disegna()`, e finora la leggeva solo chi
stava davanti allo schermo.

## Gli sconti: il caso in cui non si manda niente

Se nella ricerca è stato messo uno sconto pensione, ogni riga porta un oggetto
`sconto` con tre proprietà che contano (`fidra-disponibilita.js:773-789`):

- **`imp5`** — il 5% fedeltà si toglie subito, il cliente paga meno. Entra nel
  preventivo, come `sconto5` sulla voce.
- **`imp3`** — il 3% anticipo 2027 il cliente lo riceve **alla partenza**: il
  codice lo dice già, *«non toglierli dall'offerta»*. Non entra nel prezzo. Se
  c'è, il preventivo lo nomina come nota (`sconto3`), non come sottrazione.
- **`stima: true`** — con un pacchetto settimanale più una coda di notti, il 5%
  è una stima e il conto esatto sta in «Notte per notte».

**Con `stima: true` la voce non è preventivabile.** `+ Prev.` si disattiva su
quella riga e dice perché: un preventivo è un numero che il cliente legge come
promessa, e una stima non lo è. Chi vuole quella sistemazione passa da «Notte
per notte», che il conto esatto ce l'ha.

## Errori

| quando | cosa succede |
|---|---|
| nessuna voce scelta | `Crea preventivo` disattivo |
| più di quattro voci | `+ Prev.` disattivo, la barra dice il limite |
| voce con sconto stimato | `+ Prev.` disattivo su quella riga, col motivo |
| `leonardo_preventivo` assente o oltre la mezz'ora | la voce nel pannello non compare |
| pannello aperto senza email dell'ospite | come già oggi: si copia invece di aprire Outlook |

## Le prove

Deno, accanto a `orari.test.ts` e `pacchetti.test.ts`. Nuovo
`preventivo.test.ts`:

1. il testo generato **non nomina mai** numero d'offerta, acconto, scadenza,
   caparra — in nessuna delle quattro lingue;
2. con `adulti === 1` l'uso singola è nominata, in tutte e quattro;
3. tutte e quattro producono un documento non vuoto e con i prezzi dentro;
4. una voce con `stima: true` non arriva mai in `leonardo_preventivo`;
5. la frase «non blocca la camera» c'è in tutte e quattro.

`allineata.test.ts` continua a pretendere che la cartella della reception abbia
gli stessi file.

## Fuori scopo

Opzione che scade, sollecito, tracciamento della conversione, qualunque
scrittura dentro Fidra. Il preventivo è informativo: se l'ospite accetta, la
pratica si apre come si è sempre fatto, e da lì l'offerta vera esce come oggi.

Nemmeno si toccano Info Day Spa e Buoni regalo, né la strada
`leonardo_dettaglio` → «Dettaglio del soggiorno».

## Corretto il 24 agosto, leggendo il codice per scrivere il piano

Tre cose di questa specifica sono risultate sbagliate o incomplete. Restano
scritte sopra com'erano, perché il piano è la versione che si implementa.

**1. Il modello non va in `template.js` più le tre lingue, va in
`template-extra.js`.** Gli altri due documenti senza prenotazione — Info Day
Spa e Buoni regalo — vivono lì con **un solo** costruttore base e una tabella a
quattro lingue. Spargere il preventivo su quattro file vorrebbe dire quattro
posti da ricordare a ogni modifica, che è il difetto per cui esiste
`pulsanti.test.ts`.

**2. Mancavano cinque contenuti, e quattro erano già scritti.** Un preventivo
con il solo prezzo è un prezzo senza merce. Vanno riusate, non riscritte:

| cosa | dove sta già |
|---|---|
| che cosa comprende il pacchetto (Dolce Vita, Spezial, Golf, Smart, Escape, Deluxe…) | `notaPacchetto(trattamento, lingua)` — `template.js:679` |
| descrizione della camera: metratura, letti, balcone | `CAMERE_IT` / `ZIMMER_DE` / `ROOMS_EN` / `CHAMBRES_FR` + `descrizioneCamera()` |
| dotazione comune | `DOTAZIONE_IT` / `AUSSTATTUNG_DE` / `AMENITIES_EN` / `EQUIPEMENTS_FR` |
| bambini con il prezzo per età | `rigaBambini(c, lingua)` — `template.js:533` |
| cure termali e cane | riga nuova nelle quattro lingue, con due spunte nel pannello |

Il quinto — cure e cane — non si riusa: i blocchi dell'offerta sono duplicati
otto volte a mano nei quattro file, e toccarli metterebbe a rischio quello che
funziona. Nel preventivo bastano due righe.

Ne segue che `leonardo_preventivo` porta anche `bambiniPrezzi` per voce: il
modale quel calcolo lo fa già (`dettaglioB`), e buttarlo via vorrebbe dire far
ricopiare a mano proprio il numero che si è fatta la fatica di leggere.

**La culla non c'è, e non è una dimenticanza:** nei modelli email non esiste in
nessuna lingua. Sta nel modulo di richiesta del sito.

**3. Il link della caparra: non c'è, ed è la scelta giusta.** Non lo genera
Stripe e non lo genera Fidra — lo compone `extractor.js:322` con l'`id` della
prenotazione, il numero d'offerta e l'importo, e `/deposit-payment` riconcilia
l'incasso attraverso quell'`id`. Fuori da una prenotazione non esiste nessuno
dei tre. E prima ancora: il preventivo dichiara di non bloccare la camera, e
incassare su una camera non tenuta significa poterla vendere a un altro e avere
in mano i soldi di chi resta senza.

**Sul copiare testi da `/prenota`:** non si fa. Le descrizioni nel codice sono
già la versione vagliata, e `template.js:755` porta un avviso che vale la pena
rileggere — *«⚠ ABBINAMENTO DA VERIFICARE CON LA DIREZIONE: i nomi Fidra
(Abano / Monteortone / Colli Euganei) non coincidono con quelli pubblicati su
Booking. Metrature e dotazioni sono verificate; l'attribuzione a ciascun nome è
una deduzione.»* Prendere testi dal sito creerebbe una seconda fonte che
diverge dalla prima. Se l'abbinamento va sistemato, si sistema **lì**, e le
offerte vere ne guadagnano insieme al preventivo.

## Come si consegna

Si scrive in `estensione/` di questo repo, si provano le prove Deno, poi
`node strumenti/estensione.js` porta i file nella cartella che Chrome carica, e
si ricarica da `chrome://extensions` su ogni computer. Il numero del manifest
sale, così dopo il Ricarica si vede se è entrata.
