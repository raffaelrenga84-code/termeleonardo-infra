Pagine pubblicate su arrivo-terme-leonardo.vercel.app: arrivo, documenti, segnalibri, buoni.

## Una cartella nuova qui vuole una riga in vercel.json

Queste pagine sono servite dal progetto Vercel **arrivo-terme-leonardo**, e
riscritte sul dominio dell'hotel dalle regole in
`termeleonardo/frontend/vercel.json` (dell'altro repository, dentro
`frontend/` e non nella radice: la radice non viene letta).

**Ogni cartella di primo livello qui dentro deve avere là la sua riga di
passaggio.** Oggi: `buoni`, `comune`, `prenota`, `richieste`.

Senza quella riga i moduli e le immagini di quella cartella non danno 404:
danno **200 con `text/html`**, perché rispondono con la home del sito React.
Il browser rifiuta di eseguire un modulo servito come HTML, la pagina resta
col solo logo su fondo bianco, e nei controlli di rete non compare nessun
errore. È già successo tre volte in un giorno.

Per la stessa ragione gli import nelle pagine vanno scritti con il **percorso
assoluto** (`/comune/date.js`), mai relativo: un percorso relativo si risolve
contro l'indirizzo che vede l'ospite, e sotto `/it/prenota` diventa
`/it/comune/date.js`.

E in `vercel.json` non si aggiungono chiavi fuori dallo schema, nemmeno per
commentare: Vercel valida quel file, e una chiave sconosciuta fa fallire la
costruzione senza che il sito cambi — la correzione sembra pubblicata e non
lo è.
