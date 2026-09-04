# L'opinione dell'ospite sul totem in hall

4 settembre 2026. Approvata dalla proprietà («1», strada 1) dopo la proposta in chat.

## Perché

La proprietà vuole che l'ospite possa dire la sua sul totem in hall, anche in
forma anonima, o dicendo chi è passando la tessera della camera; ogni opinione
arriva subito per email a direzione@termeleonardo.com. L'obiettivo è sapere
prima della partenza se qualcosa non va, e spingere chi è contento a dirlo
anche fuori. Costruita in casa, come il resto del totem: niente canoni.

## Dove si entra

Nella schermata di riposo del totem (`pagine/ingresso/index.html`, modalità
totem), sotto il testo, un pulsante grande con le quattro lingue insieme:
«La sua opinione · Your feedback · Ihre Meinung · Votre avis». Un tocco apre
la scelta della lingua (quattro pulsanti grandi). Da lì il percorso è nella
lingua scelta. Il cartello «NON TOCCARE» sul totem va cambiato in «Passi il
codice, o tocchi per dire la sua».

Il tocco sul pulsante non deve far scattare il «tocco ovunque» del riposo (che
oggi riporta il fuoco al lettore o chiude): dentro il percorso quel gestore è
spento e si riaccende al riposo.

## Il percorso

Sempre presenti: «Salta» dove il passo è facoltativo, «Indietro», e il ritorno
al riposo dopo 60 secondi senza tocchi (ogni tocco azzera il tempo).

1. **Stelle.** Cinque stelle grandi, un tocco sceglie e passa avanti.
2. **Temi**, a scelta multipla: Camera, Cure termali, Piscine e spa,
   Ristorante, Personale, Pulizia, Prezzo. Titolo «Cosa le è piaciuto?» con 4
   o 5 stelle, «Cosa possiamo migliorare?» con 3 o meno. «Avanti».
3. **Commento** facoltativo, una casella di testo con la tastiera del Sunmi,
   massimo 500 caratteri. «Salta» o «Avanti».
4. **Chi è.** «Se desidera una risposta, passi la tessera della camera al
   lettore» con il campo del lettore a fuoco, oppure il pulsante «Resto
   anonimo». Dalla tessera si prende solo il numero di camera, con lo stesso
   canale del conto (`?a=conto` → Fidra); il codice della tessera non si
   salva.
5. **Grazie.** «Grazie, la sua opinione è arrivata alla direzione.» Con 4 o 5
   stelle, se esiste il link Google delle recensioni (secret
   `GOOGLE_RECENSIONE_URL`), un QR grande con «Se le va, lo dica anche su
   Google» per 20 secondi; senza link, 8 secondi di grazie e poi il riposo.

Tutte le parole vengono da `testiOpinione(lingua)` in
`pagine/ingresso/lettura.js` (it/en/de/fr, stesse chiavi in ogni lingua).

## La funzione

`supabase/functions/dayspa/index.ts`, azione `POST ?a=opinione`, accettata
solo dal totem (`eTotem`: intestazione `x-totem-key` e IP dell'hotel, come il
conto camera). Corpo: `{ lingua, stelle, temi, commento, tessera? }`.

- `opinione.ts` (puro): `leggiOpinione(corpo)` → `{ ok: true, valore }` con
  stelle 1–5 intere, temi solo fra i sette noti e senza doppioni, commento
  tagliato a 500 caratteri o null, lingua fra le quattro (altrimenti `it`),
  tessera solo cifre (4–20) o null; altrimenti `{ ok: false, errore }`.
  `emailOpinione(o)` → `{ oggetto, html, testo }`: oggetto
  «Opinione dal totem: ★★★★☆ 4/5 · camera 320» (o «· anonima»), corpo con
  stelle, temi in italiano, commento, lingua, ora di Roma, fonte.
  `destinatariOpinione(o, direzione, reception)` → sempre la direzione; anche
  la reception se stelle ≤ 3 e camera nota.
- Al massimo un'opinione al minuto per totem: si conta in tabella quante ne
  sono arrivate negli ultimi 60 secondi da quella fonte; oltre, 429.
- Con la tessera: si chiede il conto a Fidra (stessa chiamata di `?a=conto`,
  estratta in una funzione condivisa `contoFidra(codice)`), e si tiene solo
  `camera`. Se Fidra non risponde o non trova la tessera, l'opinione si salva
  lo stesso, anonima, e l'email lo dice («tessera non riconosciuta»).
- Si salva in `opinione`, si manda l'email con Resend (`inviaEmail`), si segna
  `email_inviata`. Risposta `{ esito: 'ok', google: true|false }`.
- `GET ?a=qr-google` (pubblica): il PNG del QR del link Google, con
  `generaPngQR`; 404 se il secret manca.

Secret: `EMAIL_DIREZIONE` (in mancanza `direzione@termeleonardo.com`),
`GOOGLE_RECENSIONE_URL` (facoltativo). Esistono già `EMAIL_HOTEL`,
`RESEND_API_KEY`, `TOTEM_KEY`, `TOTEM_IP`, `FIDRA_TOTEM_*`.

## I dati

`supabase/2026-09-04-opinione.sql`:

```sql
create table if not exists opinione (
  id            uuid primary key default gen_random_uuid(),
  creato_il     timestamptz not null default now(),
  fonte         text not null default 'totem' check (fonte in ('totem', 'qr')),
  lingua        text not null default 'it' check (lingua in ('it', 'en', 'de', 'fr')),
  stelle        int  not null check (stelle between 1 and 5),
  temi          text[] not null default '{}',
  commento      text,
  camera        text,
  prova         boolean not null default false,
  email_inviata boolean not null default false
);
create index if not exists opinione_creato on opinione (creato_il desc);
```

Nessun dato personale oltre al numero di camera, e solo se l'ospite lo sceglie.
`prova` segue `DAYSPA_PROVA` come le prenotazioni.

## Errori

- Rete assente al momento dell'invio: la pagina dice «Non sono riuscito a
  mandare la sua opinione: lo dica alla reception, qui accanto» (4 lingue) e
  torna al riposo dopo 10 secondi. Non si tiene una coda: un'opinione persa
  è meno grave di una mandata due volte.
- Email non inviata (Resend giù): l'opinione resta in tabella con
  `email_inviata = false`; la funzione lo scrive nel log. Non si riprova da
  sola in questa fase.

## Prove

Moduli puri con prove di comportamento (`opinione.test.ts`,
`lettura.test.ts`); pagina e funzione con prove sul sorgente come il resto del
totem (`pagina.test.ts`, `azioni.test.ts`); `opinione-sql.test.ts` sul file
SQL. Il vincolo di sempre: niente stampanti fiscali, niente chiavi nella
pagina.

## Fuori da questa fase

Scheda «Opinioni» nel back office (per ora arrivano per email), il QR in
camera e sulla pagina Wi‑Fi (la stessa azione con `fonte = 'qr'` e un limite
per IP), la risposta all'ospite dal back office, il pre‑checkout via email.

## Stato (4 settembre 2026, sera)

In linea: tabella `opinione` sul progetto; funzione `dayspa` con `?a=opinione` (solo totem, una al minuto) e `?a=qr-google`; pagina del totem con il pulsante «La sua opinione» e il percorso in quattro lingue (parole in `pagine/ingresso/opinione.js`, non in lettura.js come diceva la spec: modulo a parte, piu' pulito). Prova dal vivo dall'IP dell'hotel: 200 con email alla direzione, 401 senza intestazione, 429 al secondo invio nel minuto.
Da fare: `GOOGLE_RECENSIONE_URL` quando la proprieta' manda il link (finche' manca, niente QR); il cartello sul totem; il collaudo con la tessera 1466 dal totem vero.
