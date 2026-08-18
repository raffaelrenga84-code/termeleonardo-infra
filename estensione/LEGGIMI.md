# Offerta Leonardo — l'estensione del browser

Estensione Chrome/Edge (manifest v3) che la reception installa a mano. Non sta
su nessuno store: si carica da `edge://extensions/` con **Carica estensione
non pacchettizzata**, puntando a questa cartella.

## Cosa fa

Legge la pagina che l'operatore ha gia' aperto e gli risparmia il ricopiare.

| dove | cosa |
|---|---|
| `leonardo.fidra.cloud` | legge l'offerta aperta (`extractor.js`), le disponibilita', i numeri di camera, le scadenze, le fatture |
| Outlook Web | inserisce l'email impaginata nelle quattro lingue (`template-*.js`) |
| `www.atam.biz` | apre il modulo dei tassisti gia' compilato, individuale/collettivo compreso (`atam-booking.js`) |
| le nostre funzioni Supabase | crea il link «Prepara il suo arrivo» |

**Non salva e non invia mai niente da sola.** L'ultimo clic — Prenota, Invia —
resta sempre dell'operatore.

## Le chiavi

Nel codice non ce n'e' nessuna. La `x-hotel-key` la digita l'operatore nel
pannello e vive in `chrome.storage.local`, su quella macchina soltanto; a
schermo se ne vedono solo le ultime quattro cifre. **Qui dentro non va scritta
nessuna chiave**: questo deposito e' pubblico.

## Le versioni

`manifest.json` porta il numero di versione. Ogni versione ha il suo
`LEGGIMI-vX.Y.md` che dice cosa cambia e perche'.

Prima di agosto 2026 le versioni vivevano come cartelle e zip in `Downloads`,
senza storia: per sapere cosa era cambiato bisognava aprirne due e confrontarle
a occhio. Da qui in avanti ogni versione e' un commit.
