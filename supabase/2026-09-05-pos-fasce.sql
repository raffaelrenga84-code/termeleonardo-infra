/* ============================================================
   I listini a fasce: happy hour, il prezzo di sera.

   «i listini a fasce (happy hour, prezzo diverso di sera)» (la
   proprieta', 4 settembre 2026). Una fascia: ore, giorni, locale, uno
   sconto per categoria; e i prezzi scritti apposta articolo per
   articolo. Le regole stanno in fasce.ts. Ripetibile.
   ============================================================ */
create table if not exists pos_fascia (
  id text primary key,
  nome text not null,
  locale text references pos_locale(id),
  dalle text not null,
  alle text not null,
  giorni int[],
  sconto_percento int check (sconto_percento between 0 and 100),
  categorie text[],
  attiva boolean not null default true,
  aggiornato_il timestamptz not null default now()
);
create table if not exists pos_prezzo_fascia (
  id text primary key,
  fascia text not null references pos_fascia(id) on delete cascade,
  articolo text not null references pos_articolo(id) on delete cascade,
  prezzo_cent int not null check (prezzo_cent >= 0),
  aggiornato_il timestamptz not null default now(),
  unique (fascia, articolo)
);
alter table pos_fascia enable row level security;
alter table pos_prezzo_fascia enable row level security;
