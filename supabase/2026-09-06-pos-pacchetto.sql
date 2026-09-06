/* ============================================================
   2026-09-06-pos-pacchetto.sql — il pacchetto del PC del Bistrot nel cloud.

   «aggiornamento automatico del PC per non ricopiare la cartella a ogni
   modifica» (la proprieta', 6 settembre 2026). Un file per riga: src/ e
   pagina/ della cartella «POS Bistrot» (non deno.exe, che cambia di
   rado e viaggia ancora sulla chiavetta). Ce li mette
   strumenti/pubblica-pacchetto.js dalla reception; il PC li chiede con
   la chiave hotel (?a=pacchetto, ?a=pacchetto-file) e si aggiorna da solo
   (pos-locale/aggiorna.ts). Tutte le righe portano la stessa versione:
   se ce n'e' piu' d'una la pubblicazione e' a meta' e il PC aspetta.
   ============================================================ */
create table if not exists pos_pacchetto (
  percorso text primary key,          -- es. src/pos-locale/main.ts, pagina/index.html
  versione text not null,             -- la data del pacchetto (VERSIONE.txt)
  sha256 text not null,
  byte int not null,
  contenuto text not null,            -- base64
  aggiornato_il timestamptz not null default now()
);
