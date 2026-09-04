/* ============================================================
   Chi tocca un prezzo o storna deve dire perche'.

   «se uno applica una variazione di prezzo deve scrivere la motivazione
   altrimenti non deve permettere la modifica; la stessa cosa anche in
   caso di storno o cancellazione comanda» (la proprieta', 4 settembre
   2026).

   Il motivo di una riga sta sulla riga; quello di uno storno c'era gia'
   (motivo_storno) ma si poteva lasciare vuoto — adesso no. Il prezzo di
   listino cambiato dal palmare non aveva dove lasciare traccia: ci pensa
   pos_prezzo_cambiato, che tiene il prima, il dopo, chi e perche'.
   Ripetibile.
   ============================================================ */
alter table pos_riga add column if not exists motivo_prezzo text;

create table if not exists pos_prezzo_cambiato (
  id text primary key,
  articolo text not null references pos_articolo(id),
  da_cent int not null,
  a_cent int not null,
  motivo text not null,
  cameriere text references pos_cameriere(id),
  quando timestamptz not null default now()
);
create index if not exists pos_prezzo_cambiato_quando on pos_prezzo_cambiato(quando desc);

alter table pos_prezzo_cambiato enable row level security;
