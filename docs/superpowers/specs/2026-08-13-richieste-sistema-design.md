# Le richieste dal sito — un sistema solo, quattro moduli

**Obiettivo.** Un ospite chiede una cosa; la reception la prenota dove va
prenotata. Quattro tipi di richiesta, una sola macchina sotto.

Assorbe [2026-08-13-golf-transfer-design.md](2026-08-13-golf-transfer-design.md),
che copriva solo due dei quattro e non teneva conto del token.

| Tipo | La reception prenota su | Note |
|---|---|---|
| `transfer` | ATAM | modulo esterno, 189 destinazioni |
| `greenfee` | OpenGolf o Chronogolf **più** ATAM | una richiesta, due prenotazioni |
| `maestro` | agenda interna | campo pratica dell'hotel |
| `trattamenti` | agenda della spa | listino gia' noto dai buoni regalo |

---

## Il pezzo che tiene tutto insieme

**Il token.** `arrivo_link` associa gia' un codice a una prenotazione. Da
qui discendono i due modi di arrivare allo stesso modulo:

- **dalla vostra email** (`?t=<token>`): la pagina si apre gia' compilata
  con nome, numero di conferma, email, telefono e **periodo di soggiorno**
  — che e' il dato di cui i trattamenti hanno bisogno per proporre giorni
  possibili;
- **dal sito**, senza token: stessa pagina, chiede tutto.

Una pagina per tipo, due porte. Non due pagine da tenere allineate: quella
divergenza l'abbiamo gia' pagata una volta con l'anteprima del buono.

---

## Dove vivono le pagine

Sotto `pagine/richieste/<tipo>/`, servite da Vercel come gia' accade per
`/buoni/regala/`. I pulsanti sul sito nuovo ci portano con la lingua
nell'indirizzo, esattamente come fa oggi il pulsante dei buoni regalo.

**Perche' non dentro il sito React.** Non ha un router, e aggiungerne uno
per quattro moduli e' sproporzionato. Le pagine statiche sono gia'
multilingua, gia' collaudate e si pubblicano da sole a ogni push.

---

## Dati

`richiesta_sito` prende due colonne:

| Colonna | Uso |
|---|---|
| `tipo` | `soggiorno` (quello che c'e' gia'), `transfer`, `greenfee`, `maestro`, `trattamenti` |
| `dati` | `jsonb` con i campi propri del tipo |
| `arrivo_token` | il legame con la prenotazione, quando c'e' |

Le colonne comuni restano dove sono: numero, nome, email, telefono, lingua,
stato, ip, origine. **Il quinto tipo non richiedera' una migrazione**, e
questo conta piu' della purezza: le idee arrivano piu' in fretta delle
migrazioni.

I campi di `dati` per tipo:

- **transfer** — `quando`, `ora`, `pax`, `arrivo_o_partenza`, `luogo`
  (dall'elenco ATAM), `volo`, `ritorno`, `note`
- **greenfee** — `circolo`, `data`, `ora`, `giocatori`, `percorso`,
  `golfcar`, `carrello`, `carrello_elettrico`, `sacca`, `tessera`, `note`,
  piu' `taxi`, `taxi_ora`, `taxi_ritorno`
- **maestro** — `data`, `ora`, `persone` (1–4), `livello`, `note`
- **trattamenti** — `voci` (dal listino), `giorno_preferito`, `fascia`
  (mattina/pomeriggio), `note`

---

## La regola che vale per tutti e quattro

**Sono richieste, non prenotazioni.** Non abbiamo accesso automatico ad
ATAM, OpenGolf o Chronogolf, e l'agenda della spa la tiene una persona.
Ogni pagina lo dice con parole semplici: un ospite convinto di avere una
partenza confermata che si presenta al circolo senza, e' un danno peggiore
del non aver mai messo la pagina.

**Si conferma solo cio' che il server conferma.** Come il form del
soggiorno: la richiesta si salva prima di rispondere, e se qualcosa non va
l'ospite legge telefono e indirizzo dell'hotel invece di un falso
«inviata».

---

## Back office

La scheda «Richieste dal sito» che esiste gia', con un filtro per tipo. Il
dettaglio cambia forma secondo il tipo, e per i due che finiscono su
sistemi esterni mostra **il riepilogo gia' pronto da copiare**: per ATAM
nella forma esatta che quel modulo vuole, compreso il nome della
destinazione come compare nel loro elenco.

---

## Test

Un modulo di validazione per tipo, puro come `valida.ts`.

1. Ogni tipo rifiuta i dati impossibili del suo dominio: date nel passato,
   giocatori fuori da 1–4, circolo sconosciuto, voce di listino inesistente.
2. Un tipo sconosciuto viene rifiutato, non salvato «per sicurezza».
3. Il token: valido precompila, scaduto o inventato non precompila e non
   blocca la richiesta.
4. Il riepilogo ATAM contiene la destinazione **testualmente** come
   nell'elenco del loro modulo.
5. Email: marchio, `reply_to` all'ospite, nessuna eccezione se Resend tace.

---

## Ordine dei lavori

1. **L'impianto** — `tipo`, `dati`, `arrivo_token`, lettura del token,
   validazione per tipo, back office che sa mostrarli.
2. **Transfer**, primo modulo sopra l'impianto.
3. **Green fee**, che si porta dietro anche il taxi al circolo.
4. **Trattamenti**.
5. **Maestro**.

---

## Punti aperti

**Chronogolf**: so che e' il secondo portale, non quali circoli ci stiano
sopra. Serve per mettere il collegamento giusto accanto a ogni circolo.

**Tessera federale e handicap**: i circoli la chiedono, ma non so con che
regola. Campo facoltativo finche' non lo sappiamo, invece di rifiutare
richieste valide.

**Listino del maestro**: 50/60/75/80 € per 1–4 persone, rangefee 6 € ospiti
e 10 € esterni, gettone 3 € per 22 palline. Da confermare prima di
pubblicarli.

---

## Fuori ambito

- Prenotazione automatica su ATAM, OpenGolf, Chronogolf: non c'e' accesso.
- Disponibilita' e prezzi in tempo reale.
- Pagamento online di green fee o trattamenti.
