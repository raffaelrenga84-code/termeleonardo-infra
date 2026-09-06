/* ============================================================
   2026-09-06-pos-bacheca-settimana.sql — la bacheca scritta a mano, giorno
   per giorno.

   «non deve essere collegata a tutti gli articoli ma in una sezione a
   parte dove uno puo' scrivere a mano per tutti i giorni della settimana
   il primo del giorno e il secondo del giorno, e prendi random dai vini a
   calice del Bistrot il consigliato» (la proprieta', 6 settembre 2026).
   Una riga per locale e giorno (1 = lunedi' … 7 = domenica): primo,
   secondo e — facoltativo — il calice scritto a mano; vuoto = lo sceglie
   il server fra i «Vini al calice», lo stesso per tutta la giornata.
   Le due colonne sull'articolo di poche ore prima non servono piu'.
   ============================================================ */
create table if not exists pos_bacheca (
  locale text not null references pos_locale(id),
  giorno int not null check (giorno between 1 and 7),
  primo text,
  secondo text,
  calice text,
  aggiornato_il timestamptz not null default now(),
  primary key (locale, giorno)
);
alter table pos_articolo drop column if exists in_bacheca;
alter table pos_articolo drop column if exists bacheca_testo;
