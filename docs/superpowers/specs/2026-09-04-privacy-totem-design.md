# Il consenso privacy al totem e sugli iPad

4 settembre 2026. Approvato dalla proprietà («ok procedi con privacy su totem e su ipad»). Tre scelte, come consigliato; se la proprietà ne vuole due, si toglie l'ultima (marketing) dal testo e dalla tabella non cambia nulla.

## Perché

Oggi il consenso si raccoglie su due iPad con la pagina privacy di Fidra: l'ospite deve scrivere cognome, nome ed email con la tastiera che copre il modulo, scorrere tutta l'informativa, e firmare in fondo; l'iPad finisce spesso in «Navigazione privata». Il modulo di ASA è più semplice: nome già scritto, due frasi, firma subito sotto. Il nostro fa così, e in più non fa scrivere nessuno: i dati arrivano dalla prenotazione Fidra tramite l'estensione, al check‑in.

Fidra non offre un modo per scrivere il consenso da fuori (hldv ha aperto solo la lettura del conto) e la sua pagina vuole la firma dell'ospite: il consenso quindi vive **da noi**, nel backend, dove resta per anni come prova. In Fidra la reception mette la spunta a mano come oggi.

## Il flusso

1. **Check‑in, sulla prenotazione in Fidra.** L'estensione (`fidra-privacy.js`) mostra un pulsante «Privacy al totem». Un clic manda alla funzione `privacy` (`?a=attesa`, chiave hotel) cognome, nome, email, lingua, camera, date e riferimento della prenotazione, letti dalla pagina con `extractor.js`. Se la camera ha già un consenso in attesa, lo sostituisce. Il pulsante conferma «In attesa al totem: camera 320, Rossi Mario».
2. **Sul totem** (schermata di riposo) un pulsante «Privacy · Datenschutz · Confidentialité» accanto a «La sua opinione». Tocco → «Passi la tessera della camera al lettore». Con la tessera si legge la camera (`contoFidra`, come per il conto), si cerca il consenso in attesa di quella camera e si apre il modulo già compilato. Senza consenso in attesa, il totem chiede solo cognome e nome con la tastiera, poi apre il modulo.
3. **Sugli iPad**, stessa pagina all'indirizzo `https://www.hoteltermeleonardo.com/ingresso-totem?privacy=1`: niente lettore, niente Day Spa; un elenco dei consensi in attesa (camera e cognome), un tocco apre il modulo. L'iPad è sul Wi‑Fi dell'hotel, quindi passa il controllo dell'IP; si installa come app a schermo intero come il totem, così niente Safari e niente pannello privato.
4. **Il modulo**, nella lingua della prenotazione (cambiabile con quattro pulsanti in alto): «Buongiorno, Mario Rossi · camera 320»; tre frasi, ciascuna con due pulsanti grandi «Autorizzo» / «Non autorizzo», nessuna scelta preimpostata (un consenso pre‑spuntato non vale: Corte di giustizia UE, Planet49, 2019); la riga «L'informativa completa (Regolamento UE 2016/679) è su termeleonardo.com/it/privacy e alla reception. Titolare: Stabilimento Termale Hotel Terme Leonardo Tria srl, via Monteortone 46, 35037 Teolo (PD), tel. 049 9939200, info@termeleonardo.com» con un pulsante «Leggi» che apre il testo in un riquadro; la riga sulla revoca; il riquadro della **firma col dito** con «Cancella»; «Conferma», attivo solo con tre risposte e una firma. Poi «Grazie», 6 secondi, e il riposo (o l'elenco, sull'iPad).
5. **Dopo la conferma** la funzione salva tutto, manda alla reception (`EMAIL_HOTEL`) un'email con il riepilogo e la firma in allegato, e all'ospite, se ha l'email, una copia di ciò che ha scelto nella sua lingua, con la riga sulla revoca.

Le tre frasi (italiano; en/de/fr nel modulo):

1. **Conservazione.** «Autorizzo l'hotel a conservare i miei dati per rendere più veloci le registrazioni dei miei prossimi soggiorni.»
2. **Messaggi.** «Autorizzo l'hotel a confermare a chi telefona o chiede di me che sono ospite, e a passarmi messaggi e chiamate.»
3. **Offerte.** «Desidero ricevere per email offerte e novità dell'hotel.»

Le frasi hanno una **versione** (`2026-09-04`): si salva con ogni consenso, così si sa sempre cosa ha firmato l'ospite anche se il testo cambierà.

## La funzione `privacy`

Nuova funzione `supabase/functions/privacy/` (non dentro `dayspa`: è un'altra cosa). Riusa lo schema del totem di `dayspa`: `indirizzo(req)`, `eTotem(req)` (intestazione `x-totem-key` con `TOTEM_KEY` o IP `TOTEM_IP`), `chiaveHotel`, `autorizzato` con `ruoli.ts` (copia), `inviaEmail` con Resend più gli allegati, `contoFidra` per la camera dalla tessera.

| azione | chi | cosa |
|---|---|---|
| `POST ?a=attesa` | estensione (chiave hotel) | crea o sostituisce il consenso in attesa di una camera |
| `GET ?a=attese` | totem/iPad (`eTotem`) | l'elenco dei consensi in attesa: id, camera, cognome, nome, lingua |
| `GET ?a=tessera&codice=` | totem (`eTotem`) | dalla tessera la camera (Fidra) e, se c'è, il consenso in attesa |
| `GET ?a=testi&lingua=` | pubblica | le frasi e le parole del modulo, con la versione |
| `POST ?a=firma` | totem/iPad (`eTotem`) | salva scelte e firma, manda le email |
| `GET ?a=elenco&cerca=&da=&a=` | back office (reception, amministrazione) | i consensi firmati |
| `GET ?a=uno&id=` | back office | un consenso intero, firma compresa, per la stampa |
| `POST ?a=annulla` | back office | segna annullato un consenso in attesa |

`consenso.ts` (puro): `TESTI_CONSENSO` e `testiConsenso(lingua)` con `VERSIONE_TESTI`; `leggiAttesa(corpo)` (camera e cognome obbligatori, email pulita o null, lingua fra le quattro o `it`, date ISO o null); `leggiFirma(corpo)` (id o camera+cognome+nome, tre scelte booleane tutte presenti, firma `data:image/png;base64,` fino a 200 kB, versione, fonte `totem`|`ipad`); `emailConsensoReception(c)` e `emailConsensoOspite(c)`; `firmaBase64(dataUrl)`.

## I dati

`supabase/2026-09-04-consenso.sql`:

```sql
create table if not exists consenso (
  id                 uuid primary key default gen_random_uuid(),
  creato_il          timestamptz not null default now(),
  firmato_il         timestamptz,
  stato              text not null default 'in_attesa' check (stato in ('in_attesa', 'firmato', 'annullato')),
  camera             text not null,
  cognome            text not null,
  nome               text not null default '',
  email              text,
  lingua             text not null default 'it' check (lingua in ('it', 'en', 'de', 'fr')),
  fidra_prenotazione text,
  arrivo             date,
  partenza           date,
  conservazione      boolean,
  messaggi           boolean,
  marketing          boolean,
  firma              text,
  testi_versione     text,
  fonte              text check (fonte in ('totem', 'ipad')),
  ip                 text,
  email_inviata      boolean not null default false
);
create index if not exists consenso_camera on consenso (camera, stato);
create index if not exists consenso_firmato on consenso (firmato_il desc);
```

La firma è un PNG in base64 (data URL). Il codice della tessera non si salva. Niente data di nascita: non serve al consenso.

## Il back office

Scheda «Privacy» in `pagine/buoni/index.html`: elenco dei consensi firmati (data, camera, cognome nome, tre scelte come ✓/✗, fonte), ricerca per cognome o camera, intervallo di date; «Stampa» apre il consenso su una pagina da stampare con firma e testi nella versione firmata; sezione «In attesa» con «Annulla». La vede la reception e l'amministrazione; la spa no (il server rifiuta comunque).

## Errori

- Tessera che Fidra non riconosce: il totem lo dice e chiede cognome e nome.
- Rete assente alla conferma: «Non sono riuscito a salvare: si rivolga alla reception» e ritorno al riposo; niente coda.
- Email non inviate: il consenso resta salvato (`email_inviata = false`), lo si vede nella scheda.

## Prove

Puro: `consenso.test.ts` (lettura dei corpi, quattro lingue con le stesse chiavi, email). Sorgente: `azioni.test.ts` della funzione (chi può cosa), `privacy-pagina.test.ts` (pulsante, modo `?privacy=1`, canvas della firma, nessuna scelta preimpostata, chiamate), `privacy.test.ts` dell'estensione, `privacy-schede.test.ts` del back office, `consenso-sql.test.ts`.

## Fuori da questa fase

Scrivere in automatico una nota sulla prenotazione Fidra; l'archiviazione dei PDF su storage (oggi la stampa nasce dal back office); la revoca dal back office con email all'ospite.
