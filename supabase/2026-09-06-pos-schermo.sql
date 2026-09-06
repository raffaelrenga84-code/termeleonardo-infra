-- Il monitor cucina (la proprieta', 6 settembre 2026): una postazione per
-- ogni coppia locale + stampante dice come riceve i biglietti; il biglietto
-- porta anche i dati e i tempi. Vedi docs/superpowers/specs/2026-09-06-monitor-cucina-design.md.
create table if not exists pos_postazione (
  locale text not null references pos_locale(id),
  stampante text not null check (stampante in ('cucina', 'bar')),
  nome text not null,
  schermo boolean not null default false,
  stampa_sempre boolean not null default true,
  ripiego_s integer not null default 30,
  chiave_hash text,
  aggiornato_il timestamptz not null default now(),
  primary key (locale, stampante)
);
alter table pos_stampa
  add column if not exists biglietto jsonb,
  add column if not exists conto text,
  add column if not exists vista_il timestamptz,
  add column if not exists presa_il timestamptz,
  add column if not exists pronta_il timestamptz,
  add column if not exists pronta_da text;
alter table pos_stampa drop constraint if exists pos_stampa_stato_check;
alter table pos_stampa add constraint pos_stampa_stato_check check (stato in ('da_stampare', 'a_schermo', 'stampata', 'errore'));
create index if not exists pos_stampa_schermo on pos_stampa (locale, stampante, creato_il) where pronta_il is null;
-- la prova sul campo: il banco del Bistrot con schermo E carta; il resto come oggi
insert into pos_postazione (locale, stampante, nome, schermo, stampa_sempre) values
  ('bistrot', 'bar', 'Banco Bistrot', true, true),
  ('bistrot', 'cucina', 'Cucina Bistrot', false, true),
  ('ristorante', 'cucina', 'Cucina ristorante', false, true),
  ('ristorante', 'bar', 'Bar ristorante', false, true)
on conflict do nothing;
