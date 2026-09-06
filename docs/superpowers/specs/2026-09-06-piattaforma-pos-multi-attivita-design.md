# Piattaforma POS multi-attività — progetto (6 settembre 2026)

## Da dove nasce

«Pensa se tutto quello che stiamo facendo è replicabile per un altro hotel o
ristorante o un bar o altro sito» (la proprietà, 6 settembre 2026). Le
risposte date nel colloquio di progetto, che qui diventano vincoli:

- **Scopo:** offrirlo ad altri come servizio. Un prodotto che si accende per
  un cliente nuovo senza copiare il codice. Non una copia su misura.
- **Primo modulo da vendere:** il POS con gli ordini dal QR.
- **Scontrino fiscale:** la prima versione non lo emette. Come all'hotel
  oggi: il POS chiude il conto, il cliente batte il totale sul suo
  registratore telematico. Il collegamento al registratore è un modulo
  successivo.
- **Cliente tipo:** tutti, «dal bar piccolo al ristorante grande con i
  monitor in cucina». Quindi la consegna delle comande è modulabile per
  postazione: stampante, monitor, o niente.
- **Architettura:** una piattaforma sola, tante attività dentro (strada A).
  Un solo codice, un solo database, l'hotel è la prima attività. Scartata la
  strada B (una copia per cliente da script): costi e aggiornamenti crescono
  col numero dei clienti.

## Lo stato di partenza, in numeri

Il nome dell'hotel o del progetto Supabase compare 990 volte in 166 file;
Fidra 1.162 volte in 158. Il POS (`supabase/functions/pos`, `pagine/pos`,
`pagine/ordina`, `pos-locale`) dipende da Fidra solo per il conto in camera e
per la lista di chi è in casa. I buoni regalo dipendono da listino, carta
intestata e testi, che sono dati. Day Spa, privacy, arrivi, richieste ed
estensione sono dell'hotel e restano dell'hotel.

## Il prodotto e i suoi pezzi, in ordine

Un'**attività** (bar, ristorante, hotel) ha uno o più **locali** (il Bistrot e
il Ristorante sono già due locali dell'hotel: tabella `pos_locale`); ogni
locale ha le sue **postazioni** (cucina, bar, banco); ogni postazione riceve
le comande come vuole. Palmare, pagina del QR e back office sono gli stessi
per tutti e capiscono da soli a quale attività appartengono.

1. **Fondamenta multi-attività** — questo documento nel dettaglio.
2. **Consegna comande a postazioni.** Monitor cucina (una pagina su tablet o
   schermo, «in preparazione» e «pronto»), scelta per postazione fra
   stampante e monitor, pacchetto del PC locale reso generico.
3. **Pagamenti per attività.** Ogni cliente incassa sul proprio Stripe
   (Stripe Connect), con commissione trattenibile dalla piattaforma. Gli
   ordini dal QR con carta diventano vendibili.
4. **Amministrazione del prodotto.** La pagina per accendere un cliente:
   attività, listino da un foglio, tavoli e QR, accessi, palmari, logo e
   nome. Qui si scelgono nome e dominio del prodotto.
5. **Dopo:** buoni regalo come modulo, registratore telematico, fasce prezzo
   e conto in camera per chi ha un gestionale.

Ogni pezzo sta in piedi da solo e ha una prova dal vivo che lo chiude.

---

# Pezzo 1 — Fondamenta multi-attività

## Risultato verificabile

Esiste un'attività `bar-prova` accanto a `termeleonardo`. Con un palmare di
`bar-prova` si entra, si apre un tavolo, si ordina; dal QR di un suo tavolo
un ospite ordina; dal back office un accesso di `bar-prova` salva il menù.
Niente di tutto questo vede un dato dell'hotel, e l'hotel non vede
`bar-prova`. L'hotel lavora identico a prima, senza riconfigurare estensione
o PC del Bistrot.

## Dati

### La tabella `attivita`

| colonna | tipo | note |
|---|---|---|
| `id` | text, chiave primaria | nome breve: minuscole, cifre, trattino; da 3 a 30 caratteri (`termeleonardo`, `bar-prova`) |
| `nome` | text not null | il nome per esteso, quello che compare sulle pagine |
| `chiave_hash` | text not null | impronta SHA-256 della chiave dell'attività; la chiave in chiaro non si conserva |
| `attiva` | boolean not null default true | spenta = tutto rifiutato tranne l'entrata del titolare nel back office |
| `impostazioni` | jsonb not null default `{}` | `lingua` (default `it`), `valuta` (default `EUR`), `logo` (indirizzo di un'immagine, facoltativo) |
| `creato_il`, `aggiornato_il` | timestamptz | |

### La colonna `attivita` su ogni tabella del POS

`attivita text not null references attivita(id)`, con indice, su tutte e
ventidue: `pos_locale, pos_zona, pos_tavolo, pos_categoria, pos_articolo,
pos_variante, pos_preferito, pos_cameriere, pos_dispositivo, pos_sessione,
pos_conto, pos_riga, pos_comanda, pos_stampa, pos_pagamento, pos_addebito,
pos_ordine_ospite, pos_battito, pos_fascia, pos_prezzo_fascia,
pos_prezzo_cambiato, pos_in_casa`. Le righe esistenti vengono marcate
`termeleonardo`.

Le tabelle di buoni, richieste, Day Spa e privacy **non** prendono la
colonna: restano dell'hotel.

### Gli identificativi

I codici scritti a mano o importati (tavoli, zone, categorie, articoli,
locali) oggi sono come `bistrot-t1` e `fidra-cat-vetrinetta` e restano così.
Per ogni attività diversa da `termeleonardo` il server genera i codici nuovi
col nome dell'attività davanti (`bar-prova-t1`, `bar-prova-cat-caffetteria`),
così due attività con «tavolo 1» non collidono. Gli identificativi generati
dal server per conti, righe, comande, stampe, pagamenti e sessioni sono già
casuali e non cambiano. Nessuna rinumerazione all'hotel.

### La tabella `pos_accesso`

| colonna | tipo | note |
|---|---|---|
| `email` | text | minuscola |
| `attivita` | text references attivita(id) | |
| `ruolo` | text | `titolare` oppure `gestione` |
| chiave primaria | (`email`, `attivita`) | un'email può avere accessi a più attività |

- **titolare** fa tutto quello che oggi fanno reception e amministrazione
  nel POS (le azioni del back office: menu-salva, tavoli-salva,
  personale-salva, addebiti, addebito-segna, giornata, fasce-salva,
  tavoli-qr, ospite-ordini, ospite-rimborsa, ospite-annulla-addebito,
  ospite-ristampa, ospite-nota, e la lettura allinea-giu per intero).
- **gestione** fa quello che oggi fa l'account del Bistrot: allinea-giu senza
  camerieri e palmari, menu-salva, tavoli-salva, fasce-salva, tavoli-qr,
  ospite-ordini, ospite-ristampa, ospite-nota.

Righe iniziali: `reception@termeleonardo.com` e
`amministrazione@termeleonardo.com` titolari di `termeleonardo`,
`bistrot@termeleonardo.com` gestione di `termeleonardo`. Il dominio
dell'email non conta più: conta la riga in tabella.

`supabase/functions/pos/ruoli.ts` smette di avere gli indirizzi scritti nel
codice: `ruoloDi(email, attivita)` legge `pos_accesso`; `puoDalBackOffice` e
`tabelleNascoste` restano come sono, con `titolare` al posto di
reception/amministrazione e `gestione` al posto di bistrot. Le copie di
`ruoli.ts` in buoni, richieste, dayspa e privacy non cambiano: sono
dell'hotel.

## Le quattro porte, e da dove si capisce l'attività

L'attività non è mai dichiarata dal client. Il server la deduce dalla porta,
in quest'ordine, e la prima che riconosce vince:

1. **Il PC locale (agente):** intestazioni `x-attivita` e `x-chiave`; la
   chiave combacia con `chiave_hash`. **Compatibilità:** l'intestazione
   `x-hotel-key` uguale al segreto `HOTEL_KEY` vale come `termeleonardo`,
   finché estensione e PC del Bistrot non passano alle intestazioni nuove; poi
   si toglie.
2. **Il palmare:** dal codice del dispositivo (`x-pos-dispositivo`), la riga
   di `pos_dispositivo` porta l'attività; la sessione la eredita.
3. **L'ospite col QR:** dalla firma del tavolo. `k` resta un codice di sedici
   caratteri esadecimali; per `termeleonardo` si calcola come oggi con
   `HOTEL_KEY`, così i QR già stampati sui tavoli restano validi; per ogni
   altra attività con una chiave derivata `HMAC(SEGRETO_FIRME, attivita)`,
   dove `SEGRETO_FIRME` è un segreto unico del server. Nel database non c'è
   nessuna chiave di firma in chiaro. Il tavolo si cerca per identificativo e
   la sua attività deve essere quella della firma.
4. **Il back office:** dal login Supabase; `pos_accesso` dice a quali
   attività quell'email accede e con che ruolo. Se sono più d'una, la pagina
   chiede quale (parametro `?attivita=`), e ogni chiamata la manda
   nell'intestazione `x-attivita`; il server verifica che la riga in
   `pos_accesso` esista.

La chiave cron (`x-cron-key`) resta unica e globale: il cron gira su tutte le
attività, una alla volta.

## La regola d'oro del server

Ogni lettura e ogni scrittura su una tabella `pos_*` porta il filtro
dell'attività riconosciuta: `.eq('attivita', a)` nelle letture, nelle
modifiche e nelle cancellazioni; `attivita: a` nelle righe inserite. Una
prova legge il testo di `supabase/functions/pos/index.ts` (come oggi
`azioni.test.ts` legge il codice per le stampanti fiscali) e fallisce se
trova una chiamata `.from('pos_…')` senza `attivita` nello stesso enunciato,
cioè fino al `;` che lo chiude. Le eccezioni ammesse sono elencate nella
prova stessa, con il motivo accanto: al momento nessuna.

Le risposte di rifiuto:

| caso | risposta |
|---|---|
| nessuna porta riconosce l'attività | 401 «accesso non riconosciuto» |
| chiave dell'attività sbagliata | 401 «accesso non riconosciuto» |
| palmare, QR o PC che toccano una riga di un'altra attività | 403 «di un'altra attività» |
| attività con `attiva = false` | 403 «attività sospesa» su tutto, tranne il login del titolare nel back office |

Il titolare di un'attività spenta entra nel back office, vede l'avviso
«attività sospesa» al posto delle schede e nient'altro funziona: serve a
fargli sapere il perché, non a lavorare. Spegnere un'attività non cancella
niente: si riaccende con la spunta (dal pezzo 4 dalla pagina di
amministrazione, fino ad allora con `node strumenti/attivita.js accendi <id>`
e `spegni <id>`). È il modo per chiudere un cliente che non paga.

## Le pagine

- **Palmare (`pagine/pos`)** e **ordine dal QR (`pagine/ordina`)**: stessi
  file. Dove oggi c'è scritto «Hotel Terme Leonardo» compare `attivita.nome`,
  che il server manda nelle risposte di `menu`, `sala` e `ospite-menu`. La
  lingua di partenza e la valuta vengono da `impostazioni`.
- **Back office (`pagine/buoni`)**: la famiglia POS si disegna per
  l'attività scelta; con più accessi compare un selettore prima delle schede.
  Le famiglie Buoni, Ospiti e Day Spa restano governate dai ruoli di sempre
  delle altre funzioni: la reception continua a vederle, un titolare di un
  bar no.
- Per il pezzo 1 le pagine restano sull'indirizzo attuale
  (`hoteltermeleonardo.com/pos`, `/ordina`, `/backend`); l'attività di prova
  si usa da `arrivo-terme-leonardo.vercel.app`. Il dominio del prodotto
  arriva col pezzo 4.

## Il PC locale

Un PC serve una sola attività. In `config.json`, accanto alla chiave, va
`attivita`; `installa.cmd` chiede entrambi la prima volta. L'agente manda
`x-attivita` e `x-chiave`; `allinea-giu` e `allinea-su` lavorano dentro
quell'attività. Il database locale non ha bisogno della colonna: è già di
un'attività sola. Il pacchetto si rifà con `strumenti/pacchetto-bistrot.js`
come oggi.

## Lo strumento per accendere un'attività di prova

`node strumenti/attivita.js nuova <id> "<nome>" <email-titolare>`: crea la
riga in `attivita` con una chiave generata al momento, un locale con lo
stesso `id`, una zona «Sala» con quattro tavoli, la riga di `pos_accesso`
del titolare, un cameriere «Prova» senza PIN e un palmare col suo codice.
Stampa una volta sola chiave e codice del palmare; la chiave non si può
rileggere, si può solo rigenerare con `node strumenti/attivita.js chiave <id>`.
La pagina per farlo dal browser è del pezzo 4.

## Il passaggio dell'hotel, senza fermarlo

Tre mosse, nell'ordine, in un'ora:

1. **SQL** (`supabase/2026-09-06-pos-attivita.sql`, con `strumenti/migra.js`):
   crea `attivita` con la riga `termeleonardo` (chiave = impronta di
   `HOTEL_KEY`, messa a mano al momento della migrazione), aggiunge la
   colonna a tutte le tabelle con default `'termeleonardo'`, crea
   `pos_accesso` con le tre righe dell'hotel. Il server vecchio ignora la
   colonna e continua a funzionare.
2. **Deploy** della funzione `pos` nuova. Riconosce `x-hotel-key` come
   `termeleonardo`: estensione della reception e PC del Bistrot non si
   toccano. Pubblicazione delle pagine.
3. **SQL**: toglie il default dalla colonna. Da qui ogni riga nuova deve dire
   la sua attività, e la prova sul codice garantisce che il server lo faccia.

Palmari, QR e back office lavorano prima, durante e dopo. Se la mossa 2 va
storta si ripubblica la funzione precedente: la colonna col default non le
dà fastidio.

## Le prove

- **Pure:** `attivita.test.ts` (nome breve valido, chiave derivata stabile e
  diversa per attività diverse, `termeleonardo` firma come oggi),
  `accessi.test.ts` (titolare e gestione, email con più attività, attività
  spenta), `porte.test.ts` (l'ordine delle quattro porte e i rifiuti).
- **Sul codice:** la prova del filtro `attivita` su ogni `.from('pos_…')`.
- **Dal vivo, con `bar-prova`:** entrare col palmare, aprire un tavolo,
  ordinare; ordinare dal QR di un suo tavolo; salvare il menù dal back
  office; il palmare dell'hotel continua uguale; il palmare di `bar-prova`
  che chiede un tavolo dell'hotel riceve 403 «di un'altra attività»; con
  `attiva = false` tutto risponde 403 «attività sospesa» tranne l'entrata
  del titolare.
- La suite intera resta verde (2546 prove al 6 settembre 2026).

## Fuori dal pezzo 1, apposta

Monitor cucina e postazioni (pezzo 2), Stripe per attività (pezzo 3), pagina
per accendere un cliente, dominio e marchio (pezzo 4), buoni regalo come
modulo, registratore telematico, un PC locale per più attività, la
condivisione del menù fra locali di attività diverse.
