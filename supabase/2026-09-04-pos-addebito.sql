/* ============================================================
   Il conto in camera: la coda degli addebiti.

   Chiuso un conto «in camera», l'importo non e' ancora nel conto camera
   di Fidra: resta qui, con la camera, la tessera letta e le righe, finche'
   la reception non lo riporta. La chiusura di giornata guarda questa
   tabella: se e' vuota, e' tutto riportato.

   Quando il conto camera sara' nostro, cambia solo chi svuota la coda.
   Ripetibile.
   ============================================================ */
create table if not exists pos_addebito (
  id text primary key,
  conto text not null references pos_conto(id),
  locale text references pos_locale(id),
  camera text not null,
  tessera text,
  ospite text,
  totale_cent int not null default 0,
  righe jsonb not null default '[]'::jsonb,
  chiuso_da text references pos_cameriere(id),
  chiuso_il timestamptz not null default now(),
  stato text not null default 'da_riportare' check (stato in ('da_riportare', 'riportato', 'annullato')),
  riportato_il timestamptz,
  riportato_da text,
  nota text,
  aggiornato_il timestamptz not null default now()
);
create index if not exists pos_addebito_stato on pos_addebito(stato, chiuso_il);

alter table pos_addebito enable row level security;
