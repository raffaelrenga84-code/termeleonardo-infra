# Monitor cucina — progetto (6 settembre 2026)

## Da dove nasce

«Come riusciamo a fare un monitor per ordini al posto dei biglietti
stampati? Ha senso sviluppare l'idea?» e poi «buona idea, implementa» (la
proprietà, 6 settembre 2026). È il pezzo 2 della piattaforma POS
(`2026-09-06-piattaforma-pos-multi-attivita-design.md`), costruito per
l'hotel di oggi e in modo che entri nella piattaforma senza rifarlo.

**La prova sul campo decisa:** il banco del Bistrot, con schermo e carta
insieme per due settimane. Se il banco usa lo schermo, si spegne la carta lì
e si passa alla cucina.

## Come funziona oggi, in breve

Ogni «invia» dal palmare (e ogni ordine dal QR pagato) passa da
`creaStampe` in `supabase/functions/pos/index.ts` e da una copia SQL in
`pos-locale/azioni.ts`: le righe si raggruppano per locale che prepara e per
stampante (`cucina` o `bar`), e per ogni gruppo nasce una riga in
`pos_stampa` con il testo del biglietto (`testoBiglietto` in
`comanda.ts`, che riceve un oggetto `Biglietto` con tipo, tavolo, conto,
coperti, portata, ora, cameriere, righe, note, avviso). Il PC del Bistrot
(`pos-locale/stampa.ts`, `giroStampe` ogni 2 s) stampa ciò che è
`da_stampare`; se il PC tace per più di 90 s stampa il cloud (`stampa-cloud`,
cron). Un locale senza stampante non crea il biglietto (`siStampa` in
`dove.ts`). `pos_stampa` sale e scende fra PC e cloud (`allinea.ts`).

## Il disegno

### 1. La postazione

Tabella nuova `pos_postazione`, una riga per ogni coppia locale + stampante
che oggi riceve biglietti:

| colonna | tipo | note |
|---|---|---|
| `locale` | text references pos_locale(id) | |
| `stampante` | text, `cucina` o `bar` | lo stesso valore che oggi sceglie la stampante |
| `nome` | text not null | «Banco Bistrot», «Cucina» |
| `schermo` | boolean not null default false | la postazione ha un monitor |
| `stampa_sempre` | boolean not null default true | il biglietto esce sempre, anche col monitor |
| `ripiego_s` | integer not null default 30 | col solo monitor: se nessuno schermo mostra il biglietto entro tanti secondi, esce di carta; 0 = mai |
| `chiave_hash` | text | impronta SHA-256 della chiave dello schermo; vuota = nessuno schermo può collegarsi |
| `aggiornato_il` | timestamptz | |
| chiave primaria | (`locale`, `stampante`) | |

Righe iniziali per l'hotel: `bistrot/bar` «Banco Bistrot» con
`schermo = true, stampa_sempre = true` (la prova: schermo e carta);
`bistrot/cucina` «Cucina Bistrot» e `ristorante/cucina`, `ristorante/bar`
con `schermo = false, stampa_sempre = true`. Con `schermo = false` e
`stampa_sempre = true` tutto si comporta esattamente come oggi.

**La regola di `siStampa` cambia di una parola:** un biglietto nasce se il
locale ha l'indirizzo della stampante **oppure** la postazione ha lo
schermo. Così il ristorante, che non ha stampanti, un giorno può avere un
monitor.

### 2. Il biglietto porta anche i dati, non solo il testo

`pos_stampa` prende cinque colonne:

| colonna | note |
|---|---|
| `biglietto` jsonb | l'oggetto `Biglietto` così com'è passato a `testoBiglietto`: tipo, tavolo, conto, coperti, portata, ora, cameriere, righe (nome, quantità, variante, nota), noteVitto, portareA, avviso. Vuoto sulle righe vecchie: lo schermo allora mostra `testo` |
| `vista_il` timestamptz | la prima volta che uno schermo lo ha mostrato |
| `presa_il` timestamptz | «in preparazione» |
| `pronta_il` timestamptz | «pronto» |
| `pronta_da` text | il nome della postazione che ha detto pronto |

Lo `stato` ammette un valore in più: `a_schermo`, cioè «non stampare, lo
mostra il monitor». Lo stato iniziale lo decide una funzione pura
`statoIniziale(postazione)` in un modulo nuovo `supabase/functions/pos/schermo.ts`:

| `schermo` | `stampa_sempre` | stato alla nascita |
|---|---|---|
| false | qualsiasi | `da_stampare` (come oggi) |
| true | true | `da_stampare` (esce di carta **e** si vede sul monitor) |
| true | false | `a_schermo` (solo monitor; carta solo di ripiego) |

Il testo del biglietto non cambia di una virgola: la carta resta identica.

### 3. Il ripiego sulla carta

Funzione pura `daRipiegare(stampa, postazione, adesso)` nello stesso modulo:
vera se `stato = 'a_schermo'`, `vista_il` vuoto, `ripiego_s > 0` e il
biglietto è nato da più di `ripiego_s` secondi. Chi la trova vera mette
`stato = 'da_stampare'` e il biglietto esce dalla stampante di sempre. La
eseguono sia `giroStampe` sul PC (ogni 2 s) sia `stampa-cloud` nel cloud
(ogni minuto, per i locali di cui il PC tace). Uno schermo spento non fa
perdere niente.

### 4. Le due azioni dello schermo

Stesso contratto nel cloud (`pos/index.ts`) e sul PC (`pos-locale/azioni.ts`),
intestazione `x-schermo-chiave` (aggiunta a `CORS`), che deve combaciare con
`chiave_hash` della postazione; senza o sbagliata: 401 «schermo non
riconosciuto».

- `GET ?a=schermo&locale=bistrot&stampante=bar` → `{ postazione: { nome },
  biglietti: [ { id, stato, creato_il, vista_il, presa_il, biglietto, testo } ],
  adesso }`. I biglietti della postazione con `pronta_il` vuoto, nati dopo
  le 04:00 di oggi (lo stesso confine di «oggi» della sala), dal più vecchio.
  Prima di rispondere il server scrive `vista_il = adesso` su quelli che
  l'hanno vuoto: da quel momento il ripiego non scatta più.
- `POST ?a=schermo-stato { id, passo }` con `passo` fra `presa`, `pronta`,
  `riapri`: `presa` scrive `presa_il`; `pronta` scrive `pronta_il` e
  `pronta_da`; `riapri` cancella `pronta_il` e `pronta_da` solo se
  `pronta_il` è di meno di due minuti fa (un tocco sbagliato si annulla, la
  storia no). Un id di un'altra postazione: 403 «di un'altra postazione».

Le transizioni sono in `schermo.ts` (`passo(stampa, passo, adesso, postazione)`
restituisce i campi da scrivere o un errore) e hanno la loro prova.

### 5. Lo schermo: `pagine/cucina/`

- `index.html` più `schermo.js` (puro, con prove) e il riuso di
  `/pos/server.js` (`creaServer`): prima il PC del Bistrot, poi il cloud,
  come il palmare.
- Si apre con `/cucina?l=bistrot&s=bar&k=<chiave>`; la pagina conserva
  locale, stampante e chiave in `localStorage` e da quel momento basta
  `/cucina`.
- Prima schermata «Tocca per iniziare»: un tocco sblocca il suono e chiede
  il wake lock, così il tablet non si spegne.
- Poi le schede in colonne, dal più vecchio: tavolo grande, portata, ora e
  minuti di attesa, righe come «2 × Focaccia margherita», variante e nota in
  evidenza, avviso in cima (per esempio «cucina chiusa: al bancone»). Il
  colore segue l'attesa: verde sotto 5 minuti, giallo sotto 12, rosso oltre.
  Un suono breve quando arriva una scheda nuova.
- Due tasti per scheda: «In preparazione» e «Pronto». Una scheda pronta
  sparisce e finisce nella striscia «ultime pronte» in fondo, dove un tocco
  la riapre entro due minuti.
- Con una tastiera o un tastierino (TV senza tocco): le cifre scelgono la
  scheda per posizione, `P` = in preparazione, `Invio` = pronto,
  `Backspace` = riapri l'ultima.
- Aggiornamento ogni 3 secondi; in alto lo stato «PC del Bistrot», «cloud» o
  «senza rete», con l'ora dell'ultimo aggiornamento riuscito.
- Testi in italiano soltanto: è per il personale.

### 6. Il palmare vede «pronto»

`sala` (cloud e PC) aggiunge a ogni conto `pronto_in_cucina`: vero se un suo
biglietto ha `pronta_il` negli ultimi 20 minuti. Il riquadro del tavolo
mostra un bollino verde «pronto» (in `conStato` del palmare), e nel pannello
del conto ogni comanda pronta porta l'ora: «pronto alle 12:41». Nessuna
conferma da parte del cameriere: il bollino si spegne da solo dopo 20 minuti
o quando il conto si chiude.

### 7. Il back office

In «POS · Tavoli», sotto «Locali», una tabella «Postazioni»: per ogni riga
nome, spunta «schermo», spunta «stampa sempre», «ripiego (secondi)», e la
spunta «nuova chiave». Si salva con `?a=postazioni-salva` (titolare,
gestione e l'account del Bistrot: aggiunta a `AZIONI_BISTROT`). Se si è
chiesta una chiave nuova, la risposta la restituisce **una volta sola**
insieme ai due link pronti da aprire sullo schermo:
`https://www.hoteltermeleonardo.com/cucina?l=…&s=…&k=…` e
`http://192.168.0.18:8080/cucina?l=…&s=…&k=…`; il back office li mostra in
un riquadro con «copia». Rigenerare la chiave chiude fuori lo schermo
vecchio, come per i palmari. `allinea-giu` manda anche `pos_postazione` al
PC; `pos_postazione` è fra le tabelle in discesa di `allinea.ts` e nello
schema SQLite di `db.ts`, con le colonne nuove di `pos_stampa`.

### 8. Il PC del Bistrot e il pacchetto

`pos-locale/pagina.ts` serve `/cucina` e `/cucina/schermo.js`;
`strumenti/pacchetto-bistrot.js` copia anche `pagine/cucina`. Il sito
(repo `termeleonardo`, `frontend/vercel.json`) riscrive `/cucina` verso la
pagina come già fa per `/pos` e `/ordina`, senza vincolo di IP: la chiave
della postazione è il cancello.

### 9. Lo schermo fisico

Per il banco: un tablet Android da 10 pollici con supporto a parete e
alimentazione fissa, browser in modalità chiosco. Per una TV in cucina: una
chiavetta Android TV con un browser e un tastierino senza fili. La scelta
del modello è fuori da questo documento.

## Cosa non cambia

- Il testo dei biglietti e la stampa per le postazioni senza schermo:
  identici a oggi, riga per riga.
- Le stampanti fiscali: mai toccate (la prova esistente resta).
- Il cloud stampa solo se il PC tace da più di 90 s: resta.

## Prove

- Pure: `schermo.test.ts` (stato iniziale, ripiego, transizioni, il confine
  delle 04:00, il «riapri» entro due minuti), `pagine/cucina/schermo.test.ts`
  (ordine, colori per attesa, tasti, la resa di un biglietto vecchio senza
  `biglietto`), `sala.test.ts` (pronto_in_cucina a 20 minuti).
- Sul codice: le azioni `schermo`, `schermo-stato`, `postazioni-salva`
  esistono nel cloud e sul PC; `x-schermo-chiave` è in `CORS`;
  `pos_postazione` è in discesa; `pagina.ts` serve `/cucina`; il pacchetto
  copia `pagine/cucina`.
- Dal vivo: dal palmare di prova si invia una comanda al bar del Bistrot,
  esce la carta **e** compare sullo schermo aperto su
  `arrivo-terme-leonardo.vercel.app/cucina/…`; «pronto» sullo schermo →
  bollino sul palmare; con `stampa_sempre = false` e lo schermo chiuso, dopo
  30 secondi la carta esce lo stesso.
- La suite intera resta verde.

## Passaggio in linea, nell'ordine

1. SQL `supabase/2026-09-06-pos-schermo.sql` (tabella, colonne, righe
   iniziali dell'hotel): il server vecchio non se ne accorge.
2. Deploy della funzione `pos`; push delle pagine; riscrittura `/cucina` nel
   sito.
3. Pacchetto del Bistrot rifatto (il PC non è ancora installato: prende già
   la versione nuova).
4. Dal back office: chiave nuova per «Banco Bistrot», link aperto sul tablet.

## Fuori, apposta

La lavagna dei piatti del giorno su una TV all'ingresso (pezzo a sé, stesso
cancello a chiave), la conferma del «pronto» da parte del cameriere, le
statistiche dei tempi di preparazione, più postazioni per la stessa
stampante, la traduzione dello schermo.
