# POS di Bistrot e ristorante — disegno

Data: 4 settembre 2026. Stato: da rivedere con la proprietà.

## Perché

Il POS di Fidra sui palmari Sunmi è lento, non lascia scrivere note libere,
non gestisce le portate (tutto esce in cucina insieme), la scelta degli
articoli passa da trentatré categorie in fila, e i prezzi non si possono
adattare a una personalizzazione. Alla chiusura, la tessera della camera
chiude il tavolo: se un ospite ordina ancora qualcosa bisogna richiederla.

È il primo pezzo del gestionale nostro: si costruisce accanto a Fidra, che
resta acceso finché il conto camera e il fiscale non sono nostri.

## Obiettivi (dalle parole della proprietà)

1. Veloce: ogni tocco risponde subito; funziona anche senza internet.
2. Note libere, con i pulsanti rapidi in aggiunta e non al posto del testo.
3. Portate: si ordina tutto insieme; parte subito la prima portata e le
   bevande; le altre partono con «Vai» quando il cameriere decide.
4. Articoli in due tocchi: preferiti, ultimi del tavolo, ricerca, categorie
   e sottogruppi dietro.
5. Prezzi: varianti con supplemento, articoli a prezzo libero, prezzo a
   mano con permesso e traccia.
6. Il tavolo ha più conti (uno per camera, uno per gli esterni); la
   tessera si passa una volta e resta agganciata al suo conto.

## Prese da ASA Touch POS

Annotazione vitto dell'ospite mostrata all'apertura del conto e stampata in
comanda; trattamento incluso (mezza pensione: menù del giorno a zero, si
pagano gli extra) per il ristorante; tavolo assegnato per il soggiorno nel
ristorante; «il solito» dallo storico dell'ospite; lista consumazioni per
ospite; quantità prima dell'articolo; articoli a prezzo libero; sottogruppi;
cameriere con codice, PIN e spunta «storni ammessi»; uscita automatica dopo
inattività e a scelta dopo ogni comanda; reparti per i report; conto di
ricavo per articolo; giornata del POS che chiude alle 5.

Lasciate fuori: risoluzioni fisse, pulsanti in rilievo, codici a video, le
varianti di «quale ospite mostrare».

## Architettura

Tre pezzi, stesso contratto:

- **La pagina** `pagine/pos/` (repo `termeleonardo-infra`, progetto Vercel
  `arrivo-terme-leonardo`): una web app installata a tutto schermo sui
  Sunmi e usata anche dal PC del Bistrot come cassa. Service worker che
  tiene in cache la pagina e il menù; coda locale (IndexedDB) delle
  comande quando nessun server risponde.
- **Il server locale** `pos-locale/`: un programma Deno compilato in un
  eseguibile, installato come servizio Windows sul PC del Bistrot, che
  parte da solo. Tiene i dati in SQLite, espone in HTTPS sulla rete locale
  (porta 8443, certificato della nostra CA privata installata una volta su
  ogni Sunmi) le stesse azioni della funzione cloud, stampa in cucina e al
  bar, e allinea con il cloud. Durante il servizio comanda lui.
- **Il cloud**: tabelle `pos_*` su Supabase, funzione `pos` con le stesse
  azioni, realtime per lo stato dei tavoli, back office nelle schede della
  pagina `pagine/buoni/` (menù, tavoli, personale, cassa, report).

**Scelta del server dal palmare.** All'apertura e a ogni azione la pagina
prova il server locale con un timeout di un secondo; se non risponde usa la
funzione cloud; riprova il locale ogni 30 secondi e torna su di lui appena
risponde. Un pallino mostra: locale, cloud, da solo. Il cameriere non fa
nulla.

**Chi comanda su cosa.** Menù, tavoli, personale, permessi, ospiti in casa:
nascono nel cloud e scendono al locale. Conti, righe, comande, chiusure:
nascono dove il cameriere lavora (locale o cloud), con id generati dal
palmare (UUID), e si allineano nei due sensi con upsert idempotente per id;
per una riga cambiata in due posti vince `aggiornato_il` più recente. Le
comande stampate portano il segno di dove sono state stampate, così non
escono due volte.

## Dati (tabelle `pos_*`, uguali su SQLite e Postgres)

- `locale` (Bistrot, Ristorante): nome, reparto (F&B), stampanti.
- `zona`, `tavolo`: nome, posti, posizione x/y sulla piantina, locale,
  camera assegnata per il soggiorno (ristorante).
- `categoria`: nome, ordine, colore, stampante (cucina/bar), sottogruppo di,
  locali in cui compare, note rapide.
- `articolo`: nome, prezzo, IVA, portata predefinita, categoria, stampante
  se diversa dalla categoria, prezzo libero (sì/no), incluso nel
  trattamento (sì/no), conto di ricavo, esaurito, posizione.
- `variante`: articolo o categoria, nome, supplemento.
- `preferito`: locale, articolo, posizione (dodici).
- `cameriere`: nome, codice, PIN (hash), ruolo (cameriere, capo sala,
  amministrazione), storni ammessi, bloccato.
- `dispositivo`: nome, token, locale, ultimo accesso, bloccato.
- `ospite_in_casa`: camera, nome, trattamento, note vitto, codice tessera,
  arrivo, partenza, tavolo assegnato; esportata da Fidra dall'estensione.
- `conto`: tavolo, tipo (camera/esterno), camera, ospite, tessera, coperti,
  stato (aperto, conto chiesto, chiuso), chiuso come (camera, contanti,
  carta), scontrino numero/ora/esito, aperto da, chiuso da.
- `riga`: conto, articolo, nome al momento, quantità, prezzo listino,
  prezzo applicato, variante, nota, portata, stato (da inviare, inviata,
  partita, stornata), chi e quando per ogni passaggio.
- `comanda`: conto, portata, righe, stampante, stampata dove e quando.
- `addebito_fidra`: conto chiuso in camera, camera, importo, righe, stato
  (in coda, riportato, errore), riportato quando e da chi.
- `chiusura`: locale, giornata (dalle 5 alle 5), totali per tipo, storni,
  scontrini, anomalie.

## La schermata del cameriere

Sala (zone, cerchi dei tavoli con stato e minuti dall'ultima comanda), poi
tavolo (conti aperti; «nuovo conto»: tessera con fotocamera, numero di
camera, esterno; nel ristorante il tavolo propone la camera assegnata), poi
ordine: portata attiva in alto; preferiti, ultimi del tavolo, ricerca dalla
terza lettera, categorie e sottogruppi; un tocco aggiunge, quantità
digitabile prima; tocco lungo apre quantità, nota libera con pulsanti
rapidi, variante, prezzo a mano (capo sala); comanda per portata in basso;
«Invia» e «Vai coi ...». Storno e modifica dopo l'invio stampano STORNO o
MODIFICA in cucina. «Conto» chiude un conto alla volta; il tavolo torna
libero quando tutti sono chiusi. Preconto e lista consumazioni per ospite
stampabili. All'apertura di un conto su una camera compaiono trattamento e
note vitto. Uscita automatica dopo N minuti (impostabile), a scelta dopo
ogni comanda. Sul PC del Bistrot la stessa pagina si dispone a due colonne.

## Stampa

Comande in ESC/POS sulle stampanti di rete di cucina e bar, dal server
locale sulla LAN; dal cloud, solo quando il locale non c'è, passando dalle
porte inoltrate dal router come fa Fidra oggi. Formato comanda: locale,
tavolo, conto, coperti, portata, ora, cameriere, righe con quantità,
varianti e note, note vitto dell'ospite in evidenza. Biglietti VAI, STORNO,
MODIFICA distinti e in grande. Preconto e lista consumazioni sulla
stampante del bar. Scontrino fiscale per gli esterni sulla Bistrot fiscale
con il protocollo XML Olivetti dal server locale: **fase 3, solo dopo il
documento di Vettori e il collaudo con il tecnico; nessuna prova sulle
stampanti fiscali da parte di Claude, mai.** Le porte del router verso le
stampanti si chiudono appena il server locale è in servizio; quelle verso
le fiscali per prime.

## Aggancio a Fidra (finché esiste)

- Ogni mattina alle 7 e su richiesta, l'estensione della reception esporta
  da Fidra chi è in casa (camera, ospite, trattamento, note vitto, tessere
  assegnate, partenza) in `ospite_in_casa`.
- Il menù iniziale si importa una volta dagli articoli del POS di Fidra,
  pagina `leonardo.fidra.cloud/admin/resources/items`, con l'estensione:
  categorie, nomi, prezzi, IVA, stampante di uscita.
- Un conto chiuso in camera finisce in `addebito_fidra`; l'estensione, dal
  PC della reception con Fidra aperto, lo riporta nel conto camera di Fidra
  e lo segna riportato. La chiusura di giornata e il controllo del giorno
  elencano quelli non ancora riportati. Quando il conto camera sarà nostro,
  la coda cambia destinazione e basta.

## Accesso

- Indirizzo `https://www.hoteltermeleonardo.com/pos`: riscrittura Vercel
  con condizione `x-real-ip = 46.234.202.29`, come `/ingresso-totem`; da
  fuori il percorso non esiste. `Disallow: /pos` in robots.txt.
- Sul palmare: PIN del cameriere; il dispositivo è registrato una volta
  dal back office (token) e si spegne da lì se sparisce.
- Sulla rete locale: `https://<ip del PC del Bistrot>:8443`, certificato
  della CA privata installato su ogni Sunmi.

## Permessi

| Azione | Cameriere | Capo sala | Amministrazione |
|---|---|---|---|
| comande, portate, note, varianti, conti | sì | sì | sì |
| storno dopo l'invio | se «storni ammessi» | sì | sì |
| prezzo a mano, sconto | no | sì | sì |
| menù, tavoli, preferiti, personale, dispositivi | no | no | sì |
| chiusura di giornata, report, export | no | sì | sì |

## Report e giornata

Giornata dalle 5 alle 5. Chiusura per locale: incassi per tipo, in camera
per camera, storni con chi, scontrini, anomalie (conti aperti, addebiti non
riportati). Email a fine servizio. Reparto F&B somma Bistrot e ristorante.
Export per il commercialista con conto di ricavo e IVA.

## Prove

Moduli puri con prove Deno: totale del conto e trattamento incluso,
regole delle portate e dei «Vai», scelta del server e coda offline, formato
ESC/POS delle comande, allineamento locale/cloud (idempotenza, vincitore),
permessi. Pagina letta dal sorgente come le altre. Server locale provato
con SQLite in memoria e una finta stampante TCP. Le stampanti fiscali non
si provano.

## Fasi

1. Comande: menù importato, sala e tavoli, portate, note, preferiti,
   varianti, prezzi, stampa in cucina e bar, server locale, cloud di
   riserva. Esempio su `/pos` dall'IP dell'hotel, da provare sui Sunmi.
2. Conti: tessera, camera, ospiti in casa da Fidra, note vitto, coda degli
   addebiti, chiusura di giornata, report.
3. Esterni: scontrino con il protocollo Olivetti, preconto, carta.

Prova in parallelo con Fidra nelle ultime settimane della stagione;
servizio alla riapertura di febbraio 2027.

## Fuori

Prenotazione dei tavoli, magazzino e food cost, fatture (solo scontrino),
mance, menù per il cliente al tavolo.

## Stato (4 settembre 2026, sera)

Costruito e in linea, fase 1:

- tabelle `pos_*` sul progetto Supabase; funzione `pos` con tutte le azioni del contratto; cron `pos-stampa-cloud` ogni minuto;
- pagina del cameriere su `https://www.hoteltermeleonardo.com/pos` (solo dall'IP dell'hotel; app a schermo intero; coda offline; server locale prima, cloud dopo);
- estensione 2.27.0: «Manda gli articoli al POS» sulla pagina Articoli di Fidra;
- back office: schede POS · Menu, POS · Tavoli, POS · Personale (le salva solo l'amministrazione); il back office e' passato a `/backend`, solo dall'IP dell'hotel;
- server locale `pos-locale/` (SQLite, stampa sulla LAN, allineamento col cloud) pronto da installare sul PC del Bistrot: certificati.md, installa.cmd;
- dati iniziali: Bistrot con Interno/Hall/Esterno/Terrazza e i 23 tavoli della piantina, tre camerieri di prova, palmare «Sunmi 1».

Non ancora fatto: collaudo sui Sunmi (Task 12), installazione sul PC del Bistrot, importazione del menu' dalla reception. Le stampanti del cloud (`POS_STAMPANTE_CUCINA/BAR`) sono volutamente NON impostate finche' la proprieta' non chiede la prima stampa di prova in cucina.
