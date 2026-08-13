# Richieste dal sito, golf e trattamenti, logo e lingua — design

Data: 2026-08-13 · Stato: approvato da Raffael

## Il problema

Tre cose, in ordine di danno che fanno oggi.

**1. Le richieste dal sito nuovo si perdono.** `BookingForm.jsx` importa axios e definisce
un endpoint API, ma è codice morto: l'invio apre una `mailto:` e subito dopo mostra la
schermata di successo **incondizionatamente** (`BookingForm.jsx:33-34`). Se il cliente non
ha un client di posta configurato — cioè quasi sempre da telefono — legge "richiesta
inviata" e in hotel non arriva niente, senza che nessuno se ne accorga.

**2. Golf e trattamenti non si possono chiedere prima di arrivare.** `Golf.jsx` e
`Treatments.jsx` sono sole vetrine: prezzi e nient'altro, nessun invito all'azione.

**3. Il sito nuovo non ha il logo vero né la lingua nell'indirizzo.** Il marchio è testo
(`Navbar.jsx:33-40`), manca la favicon, la lingua sta solo in `localStorage` (`tl_lang`)
quindi un link condiviso non la porta, e `<html lang="en">` dichiara inglese su un sito
che parte in italiano.

## Decisioni prese

- Le richieste sono **richieste da confermare**, non prenotazioni: nessuna disponibilità
  di maestro e terapisti da gestire, l'hotel risponde. Il testo deve dirlo chiaramente.
- Golf e trattamenti valgono **solo per chi ha già prenotato**: entrano in `/arrivo/`,
  la pagina che la reception già manda, non in pagine nuove.
- Nessun pagamento su queste richieste.

## 1 · Richieste dal sito

**Il punto**: la conferma si mostra solo dopo che un server ha risposto, e la richiesta
si salva **prima** di provare a mandare email. Una riga scritta nel database non si perde
nemmeno se Resend non è configurato — ed oggi non lo è.

**Nuova funzione Edge `richieste`** (`supabase/functions/richieste/`), separata da `buoni`
perché è un dominio diverso:

| Azione | Accesso | Cosa fa |
|---|---|---|
| `POST ?a=invia` | pubblica, con freno | valida, salva, poi tenta l'email; risponde 200 solo se il salvataggio è riuscito |
| `GET ?a=elenco` | reception | ultime richieste, con filtro per stato |
| `POST ?a=gestita` | reception | segna la richiesta come gestita, con nota |

L'autenticazione della reception riusa lo stesso schema di `buoni`: utente Supabase con
email del dominio dell'hotel. Il freno sulle richieste pubbliche riusa `limite.ts`.

**Nuova tabella `richiesta_sito`**: nome, email, telefono, date, adulti, bambini,
messaggio, offerta di provenienza, lingua, origine, stato (`nuova` / `gestita`), note
interne, creato_il, gestita_il, gestita_da.

**Nel sito nuovo**: `BookingForm.jsx` chiama la funzione. Successo solo su risposta 200.
Se la chiamata fallisce, la pagina mostra **telefono e indirizzo email** invece di
fingere — così il cliente ha comunque una strada.

**Nel back office**: una vista nuova "Richieste dal sito" accanto a quelle esistenti,
perché la reception ha già quella pagina aperta e autenticata. Senza un posto dove
leggerle, salvarle nel database sarebbe scrivere in un cassetto chiuso.

## 2 · Golf e trattamenti in `/arrivo/`

Due sezioni nuove nella pagina esistente, salvate nella stessa riga della richiesta di
arrivo e incluse nell'email che già arriva in hotel. Servono colonne nuove sulla tabella
di `prepara-arrivo` (migrazione SQL inclusa nel piano).

**Golf** — prezzi veri dal sito attuale: lezione col maestro da 60 minuti, 50 € per una
persona, 60 per due, 75 per tre, 80 per quattro; in alternativa solo rangefee (6 € per gli
ospiti) e gettone da 22 palline (3 €). Giorno e fascia oraria preferiti, note.

**Trattamenti** — scelta dal listino con quantità, giorno e fascia preferiti. Il testo
dice che è una richiesta e che l'hotel conferma.

**Transfer**: già presente in `prepara-arrivo` (tipo, scalo, volo, passeggeri, orario,
cellulare). Non si duplica; semmai gli si dà più evidenza nella pagina.

## 3 · Logo e lingua sul sito nuovo

**Logo**: `logo.svg` (nero) e `logo-bianco.svg` in `frontend/public/`, che in CRA viene
copiata così com'è. Il Navbar inverte il colore allo scorrimento (`Navbar.jsx:9,15`):
si scambia il file, bianco sopra la foto e nero sulla barra chiara. Lo stesso file diventa
la **favicon**, che oggi manca del tutto.

**Lingua nell'indirizzo**: `?lang=de` letto all'avvio e aggiornato con
`history.replaceState` quando si cambia lingua. Nessun router da montare e nessuna
riscrittura da configurare su Vercel. `localStorage` resta come ripiego. `<html lang>` si
allinea alla lingua attiva.

## 4 · Cose minori dello stesso giro

Le sezioni Trattamenti, Transfer, Regali e Ristorante esistono nel sito ma non sono nel
menu (`data.js:33-41`): si aggiungono. E la sezione Trattamenti non ha nessun invito
all'azione: ne prende uno verso `/arrivo/` o verso il form.

## Fuori portata

Disponibilità reale di maestro e terapisti · pagamenti su queste richieste · porting del
modulo buoni dentro React · rifacimento del backend FastAPI, che non è deployato e il cui
endpoint nel frontend è codice morto.

## Collaudo

- Form del sito: invio riuscito → riga nel database e conferma; server irraggiungibile →
  la pagina mostra telefono ed email e **non** dichiara successo.
- Le richieste compaiono nel back office e si possono segnare come gestite.
- `/arrivo/`: golf e trattamenti si compilano, si salvano e finiscono nell'email.
- Sito nuovo: logo corretto sopra la foto e sulla barra, favicon presente, `?lang=de`
  apre in tedesco e cambiando lingua l'indirizzo si aggiorna.
