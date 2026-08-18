<title>Dire il vero dove viene letto</title>

# Dire il vero dove viene letto

*18 agosto 2026*

Due cose diverse, una regola sola: **una cosa vera scritta dove nessuno guarda
non è stata detta.**

1. Il modulo transfer non chiede se la corsa è privata o condivisa, e
   l'estensione lascia quei due pallini in bianco sul modulo dei tassisti.
2. Quando la reception sposta un orario, l'ospite lo scopre in fondo
   all'email, nel carattere più piccolo e più pallido che ci sia.

---

## Parte 1 — La navetta condivisa

### Il problema, misurato

`pagine/richieste/transfer/index.html` compone `dati` con **quando, ora, pax,
verso, luogo, volo, ritorno, note**. Individuale o collettivo non c'è.

Di conseguenza `datiATAM()` non lo porta, e `atam-booking.js` lascia
`is_collettivo` in bianco — sta scritto nel codice: *«la richiesta non lo dice,
sceglierlo sarebbe indovinare»*. Era corretto finché la richiesta taceva; ma la
richiesta tace perché non lo abbiamo mai chiesto.

Sul modulo ATAM sono due pallini (`is_collettivo`, valori `False` e `True`),
nessuno preselezionato, nessuno obbligatorio, e **nessuna spiegazione**.
«Individuale o collettivo?» è la lingua interna dei tassisti.

### Il listino decide tutto

Dalla pagina pubblica del sito:

| | 1 | 2 | 3 | 4 |
|---|---|---|---|---|
| Navetta condivisa (solo Venezia aeroporto) | 65 € | 95 € | 135 € | — |
| Taxi privato Venezia | 135 € | 135 € | 135 € | 135 € |
| **risparmio** | **70 €** | **40 €** | **zero** | **non esiste** |

Prezzi a corsa, non a testa (confermato). Ne discendono tre vincoli, e non sono
opinioni:

- **La navetta esiste solo per Venezia aeroporto.** Il modulo offre dodici
  destinazioni: per Treviso, Verona, Bologna, Padova, le stazioni e i tre golf
  la condivisa non è in listino.
- **A tre passeggeri costa esattamente come il privato.** Stesso prezzo, ma con
  altri a bordo e con le fermate. A quattro non è nemmeno in listino.
- **Vuole 24 ore.** Il listino lo scrive sulla navetta e su nessun'altra riga.
  Il modulo oggi accetta anche il giorno stesso.

### Cosa si fa

Due pulsanti nello stile che il modulo ha già per «Arrivo / Partenza»:

> **Auto solo per lei** · va diritto in hotel
> **Navetta condivisa** · *(la seconda riga cambia con i passeggeri — vedi sotto)*

**Mai le parole «individuale» e «collettivo».** Sono la lingua di ATAM, non
quella di chi prenota da casa in tedesco.

### La frase cambia, il pulsante no

La navetta è **sempre visibile sull'aeroporto**: non si nasconde un'opzione a
chi ha diritto di vederla. È la seconda riga che dice la verità a ogni numero
di passeggeri.

| passeggeri | cosa dice |
|---|---|
| 1 o 2 | si divide l'auto con altri ospiti, **e costa meno** |
| 3 | si divide l'auto con altri ospiti; a tre persone **costa come il taxi privato** |
| 4 o più | **non compare**: a quattro la navetta non è in listino |

Così niente è nascosto e niente è falso. Chi è in tre vede l'opzione e sa
esattamente com'è messo; se la sceglie lo stesso, la sceglie sapendo.

**E non serve scrivere un solo euro nel modulo.** I prezzi stanno sulla pagina
da cui vengono; scritti anche qui diventano due copie, e il giorno che ne
aggiornate una l'altra mente. La differenza si racconta a parole, che è quello
che serve per decidere. L'avviso in cima dice già che orario e prezzo li
conferma la reception.

### Quando compare

Tutte e tre insieme:

```
luogo === 'Venezia  aeroporto'      <- DUE spazi
pax <= 3
quando + ora >= adesso + 24 ore
```

**Il doppio spazio non è un refuso.** Il valore è `Venezia  aeroporto` perché
deve combaciare parola per parola con l'elenco di atam.biz. Una regola scritta
con uno spazio solo **non scatterebbe mai**, e il difetto sarebbe muto: la
navetta semplicemente non comparirebbe, e nessuno saprebbe perché. Il confronto
usa la stessa normalizzazione di `atam-booking.js`.

**Preselezionata l'auto privata**, che è ciò che succede oggi: chi non guarda
ottiene il servizio di sempre.

**Se le condizioni cadono, la scelta torna a privata.** L'ospite sceglie la
navetta in tre, poi diventano quattro: il pulsante sparisce **e la scelta si
azzera**. Altrimenti una richiesta da quattro persone viaggerebbe marcata
«condivisa», e ATAM riceverebbe una cosa che l'ospite non ha più davanti agli
occhi. Vale allo stesso modo cambiando destinazione o anticipando la data sotto
le 24 ore.

**Vale in tutte e due le direzioni**, arrivo e partenza: il listino non
distingue.

### Dove va il dato

`dati.collettivo` (booleano) → `datiATAM()` → `vociATAM()`, quindi compare nel
riepilogo che legge la reception → `atam-booking.js`, che smette di lasciare
quei due pallini in bianco.

In quattro lingue, come tutto il resto del modulo.

### Cosa non si fa, di proposito

- **Non si mostra il prezzo**, per la ragione di sopra.
- **Non si tocca `pagamento`**: resta Diretto, il predefinito loro e il caso
  normale nostro.
- **Non si impedisce niente.** Chi vuole la navetta fuori da quelle condizioni
  non la vede nel modulo, ma può sempre telefonare, e la reception decide. È
  una richiesta, non una prenotazione.
- **Non si allega la richiesta al modulo dei tassisti.** Il campo «Allegato» su
  atam.biz esiste, ma `datiATAM()` sceglie da tempo, campo per campo, cosa il
  fornitore deve sapere — e **email e telefono dell'ospite non ci sono**.
  Allegare la richiesta intera annullerebbe quella decisione di nascosto, e
  creerebbe due copie degli stessi fatti: l'operatore corregge un campo e
  l'allegato dice un'altra cosa.

---

## Parte 2 — Le modifiche dove l'ospite guarda

### Il problema, misurato

In `conferma.ts` l'email si compone così: la tabella dei dettagli da `r.dati` —
i dati **corretti** — e poi, in coda, `boxDifferenze()`.

Il riquadro ha una didascalia da **12,5 px in `#8A938F`**, il testo più piccolo
e più pallido dell'email, e sotto righe fatte con lo stesso `riga()` di tutto il
resto:

```
Ora    Aveva chiesto: 18:00 → Confermiamo: 19:00
```

Quindi la notizia c'è, nella lingua giusta, in tutte e quattro. Ma più in alto
la tabella dice già «Ora 19:00» in carattere normale: **chi scorre i dettagli e
si ferma lì ha letto 19:00 e non ha mai saputo che si era spostato.** La cosa
più importante è scritta in punta di piedi.

Il confronto che lo rende evidente: **nel back office lo facciamo già bene.**
`differenzaDi()` in `pagine/buoni/index.html` mette la differenza **accanto al
campo**, sotto gli occhi dell'operatore. Il trattamento buono ce l'ha chi
modifica; a chi subisce la modifica tocca la nota a piè di pagina.

### Cosa si fa

**La differenza si sposta sul campo**, nella tabella dove l'ospite guarda:

> **Ora** — ~~18:00~~ **19:00**

Vecchio valore sbarrato e in grigio, nuovo accanto in evidenza. È lo stesso
schema del back office: **un modo solo, in due posti.**

**Sbarrato più la parola, non solo lo sbarrato.** Certi programmi di posta
buttano via gli stili, e c'è chi i colori li legge male: se cade la linea, il
testo deve restare comprensibile da solo.

**Il riquadro in coda resta, ma solo per gli avanzi** — le differenze su campi
che per quel tipo di richiesta non vengono disegnati non avrebbero altro posto
dove stare. È esattamente la logica che il back office ha già in
`differenzeNonMostrate()`.

**La didascalia smette di essere il testo più pallido dell'email.**

### Cosa non cambia

- **La spunta resta una scelta dell'operatore.** Il riquadro compare solo se
  `segnala_modifiche` è vero **e** ci sono differenze vere: mai uno dei due da
  solo. Questa regola non si tocca.
- **`differenze.ts` non si tocca.** Il confronto per valore, gli array come
  insiemi, le date per esteso, i centesimi in euro: funziona, ed è provato. Qui
  cambia solo **dove** e **come** si mostra il risultato.

---

## Le prove, e il difetto che ognuna presidia

| prova | il difetto che presidia |
|---|---|
| con `pax = 3` la navetta compare, ma **non** dice «costa meno» | «costa meno» quando costa uguale: la bugia che ha fatto nascere questa specifica |
| con `pax = 4` la navetta non compare | offrire un servizio che il listino non ha |
| la navetta non compare su Treviso, sui golf, sulle stazioni | vendere una cosa che non vendiamo |
| la navetta **compare** su `Venezia  aeroporto` con due spazi | la regola scritta con uno spazio solo: non scatterebbe mai, e in silenzio |
| la navetta non compare se mancano meno di 24 ore | il listino chiede 24 ore |
| portando i passeggeri da 3 a 4 la scelta **torna a privata** | una richiesta da quattro marcata «condivisa», che l'ospite non vede più |
| in nessuna delle quattro lingue compaiono le parole «individuale» / «collettivo» | la lingua interna dei tassisti addosso all'ospite |
| `datiATAM()` porta il collettivo, e continua a non portare né email né telefono | dare al fornitore terzo più dati di quelli che gli servono |
| una differenza sull'ora si vede **accanto al campo**, non solo in coda | la notizia importante nel posto più silenzioso dell'email |
| il valore vecchio resta leggibile togliendo gli stili | il programma di posta che butta via lo sbarrato |
| una differenza su un campo non disegnato finisce nel riquadro in coda | una modifica che sparisce del tutto |
| senza la spunta non compare niente, nemmeno con differenze vere | la scelta dell'operatore scavalcata |

---

## Cosa resta fuori, e perché

- **Il prezzo nella conferma.** Continua a scriverlo la reception a mano nel
  messaggio: è l'unico posto dove qualcuno lo ha verificato per quella corsa.
- **La navetta sulle altre mete.** Se un domani ATAM la fa anche su Treviso, la
  regola qui è una riga da cambiare — ma va cambiata quando è vero, non prima.
- **Il ritorno come seconda corsa.** Su atam.biz il ritorno si prenota a parte;
  qui resta una nota nelle note, come oggi.
- **Gli altri buchi del 18 agosto** — il dopo-soggiorno, la richiesta che non
  entra in Fidra, le due porte del Day Spa, la camera d'appoggio, il back
  office per ruoli. Ognuno con la sua specifica quando toccherà.
