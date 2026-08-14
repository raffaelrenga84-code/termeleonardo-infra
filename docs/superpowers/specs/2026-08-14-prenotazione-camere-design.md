# Pagina di prenotazione camere — specifica

*14 agosto 2026*

## Il problema

Chi vuole una camera oggi finisce su `termeleonardo.com/booking/select-dates`.
Quel percorso funziona, ma è vecchio, poco chiaro, e all'ultimo passo
**obbliga a registrarsi** per concludere. Una registrazione fra l'ospite e il
pagamento è il punto in cui si perdono le prenotazioni: chi voleva una notte
in agosto non apre un account per farlo.

Nel frattempo l'hotel ha già tutto quello che serve per fare di meglio: la
disponibilità vera, i prezzi veri, le descrizioni delle camere in quattro
lingue e un incasso con carta che funziona.

## Quello che si può fare, e quello che non si può

**`check-availability` legge, non prenota.** È lo stesso endpoint che usa il
loro motore — `POST /api/available/rates` — quindi i numeri che mostriamo
sono gli stessi che mostra il booking ufficiale, non un'approssimazione. Ma
non esiste, o non ci è stata data, una via per **scrivere** una prenotazione
dentro Fidra.

Conseguenza, dichiarata qui perché non venga scoperta dopo: **questa pagina
non blocca la camera.** Fra l'incasso della caparra e l'inserimento in Fidra
da parte della reception, quella camera resta in vendita su tutti gli altri
canali, Booking compreso. Con poco volume non succede niente; nel pienone
succede, ed è un ospite che arriva con la ricevuta e non ha la stanza.

Il rischio è stato posto alla proprietà il 14 agosto 2026 e **accettato**,
con la scelta di incassare comunque la caparra. Questa specifica lo riduce
dove può — rendendo impossibile che una prenotazione passi inosservata — ma
non lo elimina. Solo una scrittura in Fidra lo eliminerebbe.

## Cosa vede l'ospite

1. **Date e ospiti.** Arrivo, partenza, adulti, bambini con le età.
2. **Le camere disponibili**, con i piani tariffari e i prezzi veri letti da
   `check-availability`, la descrizione della categoria e le fotografie.
3. **I suoi dati.** Nome, email, telefono. **Nessuna registrazione.**
4. **Condizioni e cancellazione**, prima di qualunque campo di pagamento.
5. **La caparra**, con l'importo calcolato ed esposto in chiaro.
6. **Pagamento con carta.**
7. **La schermata finale**, che è il punto delicato di tutta la pagina.

## La schermata finale non dice "prenotazione confermata"

Perché non lo sarebbe. Finché la reception non l'ha messa in Fidra, quella
camera non è riservata a nessuno.

Dirà che **la caparra è stata ricevuta**, con un numero di riferimento, e che
la reception conferma entro poche ore. L'email che parte dice la stessa cosa,
con le stesse parole.

Questa non è prudenza formale: i buoni regalo venduti online sono rimasti
pagati-e-mai-consegnati per settimane perché il sistema diceva "fatto" quando
non lo era. Qui c'è un incasso e una camera, e l'errore costerebbe di più.

## La caparra: 75 € a persona

Non a camera. È la regola che la reception applica già oggi: i modelli di
offerta calcolano `acconto / adulti` e scrivono "75 € a persona"; il LEGGIMI
dell'estensione la dà come regola fissa, con l'esempio della pratica 18988 —
quattro adulti, 300 €.

La pagina calcola **75 × adulti**. Un ospite che riceve un'offerta via email e
poi prenota da solo sul sito deve trovare la stessa cifra: due canali che
chiedono importi diversi per la stessa camera sono un reclamo al check-in.

I bambini non entrano nel conto della caparra, coerentemente con la formula
attuale, che divide per gli adulti.

La caparra **si detrae dal totale**: non è un costo in più. La pagina lo dice
com'è scritto nelle offerte — "alla partenza pagherà X".

## Le condizioni di cancellazione restano diverse per lingua

Nei modelli della reception le condizioni italiane e quelle
tedesche/inglesi/francesi **non dicono la stessa cosa**:

| | Italiano | Tedesco · Inglese · Francese |
|---|---|---|
| Addebito 100% | da **2 giorni** prima | da **7 giorni** prima |
| Fino a 7 giorni prima | non previsto | si trattiene **solo la caparra** |
| Camera con numero fisso | non previsto | **70%** da 30 giorni, 100% da 7 |

**È una scelta voluta, confermata dalla proprietà il 14 agosto 2026:** ogni
lingua mantiene il testo che la reception manda già oggi. Chi legge questo
documento in futuro non lo tratti come un difetto da uniformare.

Con una differenza rispetto all'email, che va detta: in un'email le
condizioni le legge una persona sola, in quella lingua. Su una pagina web il
**selettore di lingua diventa un selettore di condizioni** — un ospite
italiano può passare a tedesco e vedere la finestra dei sette giorni. Se un
giorno questo diventasse un problema, la soluzione è un testo solo, non un
accorgimento tecnico.

Resta comune a tutte le lingue: gli annullamenti valgono **solo per
iscritto**, a info@termeleonardo.com; trattandosi di servizio alberghiero con
data stabilita **non c'è diritto di recesso**; con il versamento della caparra
si accettano le condizioni.

## Il buono regalo monetario a sconto

Chi ha un buono monetario inserisce il codice. La funzione `buoni` lo verifica
e mostra il residuo come credito sul soggiorno.

**Se il residuo copre i 75 € a persona, la caparra si paga col buono** invece
che con la carta: si trattengono dal buono, esattamente come si tratterrebbe
una caparra in contanti se l'ospite disdicesse. È simmetrico e non richiede
regole nuove.

Il resto del credito **non si consuma alla prenotazione**: si salda in hotel,
dove si sa cosa l'ospite ha effettivamente usato. È lo stesso motivo per cui i
buoni monetari sono multiuso e non si fatturano alla vendita.

**Doppia spesa.** Il codice va bloccato per l'importo trattenuto nel momento
in cui la caparra viene incassata, non prima e non dopo: due prenotazioni
aperte con lo stesso buono in due schede diverse non devono poter passare
entrambe. Il vincolo si esprime sul database, non nel codice della pagina.

## Le descrizioni delle camere

Vengono dai modelli della reception, dove **esistono già nelle quattro
lingue** con metrature, letti, balconi e dotazioni: `CAMERE_IT`, `ZIMMER_DE`,
`ROOMS_EN`, `CHAMBRES_FR`. Le fotografie ci sono già nel sito nuovo
(`ROOM_GALLERY`).

**Non si prende niente da Booking.com.** Quel contenuto è dell'hotel, ma
raschiare Booking viola le loro condizioni e non vale la pena.

Un'avvertenza lasciata da chi ha scritto quei modelli, e che qui va onorata:
i nomi delle categorie in Fidra (Abano, Monteortone, Colli Euganei) non
coincidono con quelli pubblicati su Booking (Familiare, Deluxe, con Balcone).
**Metrature e dotazioni sono verificate, l'abbinamento nome→descrizione è una
deduzione.** Va confermato dalla direzione prima che la pagina vada pubblica:
una descrizione giusta attaccata alla camera sbagliata è peggio di nessuna
descrizione.

## Il back office

Le prenotazioni nuove arrivano con un segnale forte e un filtro **"da inserire
in Fidra"**, come è stato fatto per i buoni. Non elimina la finestra di
overbooking: fa in modo che nessuno se ne dimentichi, che è il modo in cui
quella finestra diventa davvero un problema.

Da lì la reception emette anche la **ricevuta** per la caparra pagata col
buono regalo.

## Cosa questa pagina non fa

Non blocca la camera. Non conferma. Non gestisce modifiche né cancellazioni.
Non vende cure termali, trattamenti o extra: quelli restano richieste. Non
sostituisce il motore vecchio finché la reception non è a suo agio col nuovo.

## Come si costruisce, in tre passi

Ognuno lascia qualcosa di funzionante:

1. **Mostra e raccoglie.** Date, camere vere, dati dell'ospite, condizioni.
   Finisce in una richiesta come quelle di transfer e green fee, senza
   pagamento. Già così è meglio del modulo attuale, e non incassa nulla che
   non si sappia gestire.
2. **Incassa la caparra.** Stripe, 75 × adulti, schermata onesta, email,
   segnale nel back office.
3. **Il buono a sconto.** Verifica del codice, blocco dell'importo, ricevuta
   dal back office.

## Dati fissi, presi dai modelli della reception

- Tassa di soggiorno: **1,50 € a persona al giorno**, massimo 7 notti, si
  salda in hotel. Esenti i bambini fino a 13 anni e le persone con disabilità.
- Check-in dalle **15:00**, check-out entro le **11:00**.
- Bonifico, per chi lo preferisce: Tria S.r.l., Intesa Sanpaolo,
  IBAN `IT11C0306962321100000006041`, BIC `BCITITMM`, causale = riferimento
  della prenotazione.
- Piè di pagina: Tria S.r.l. · P.IVA IT 02042330288 · CIN IT028089A18QYO48ED.

## Cosa resta aperto

- **L'abbinamento nome camera → descrizione**, da confermare con la direzione.
- **Una via per scrivere in Fidra.** Se un giorno esistesse, questa pagina
  diventerebbe un motore di prenotazione vero e la finestra di overbooking
  sparirebbe. Vale la pena chiederlo a Fidra.
