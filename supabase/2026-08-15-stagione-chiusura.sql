-- ============================================================
-- Le stagioni di chiusura, e le due date di scadenza sul buono.
--
-- PERCHE' UNA TABELLA E NON DUE COSTANTI NEL CODICE. Le date di chiusura e
-- riapertura cambiano ogni anno e le decide la proprieta'. Scritte nel
-- codice, ogni stagione richiederebbe una modifica e una pubblicazione per
-- una cosa che sa la reception: la volta che nessuno se ne ricorda, i buoni
-- nascono con la scadenza sbagliata e nessuno se ne accorge finche' un
-- cliente non si presenta davanti a un albergo chiuso.
--
-- Se per una stagione le date mancano, la regola in scadenza.ts non proroga
-- niente ed emette la scadenza naturale dei dodici mesi: meglio un
-- promemoria mancato che una proroga inventata su date sbagliate.
-- ============================================================

create table if not exists stagione_chiusura (
  id          uuid primary key default gen_random_uuid(),
  etichetta   text not null,               -- '2026/2027', per chi la guarda
  chiusura    date not null,
  riapertura  date not null,
  creato_il   timestamptz not null default now(),
  constraint riapertura_dopo_chiusura check (riapertura > chiusura)
);

-- Nessun accesso pubblico: la leggono solo le funzioni, con la chiave di
-- servizio. Senza questa riga la tabella sarebbe interrogabile da chiunque
-- conosca l'indirizzo del progetto.
alter table stagione_chiusura enable row level security;

-- Stagione 2026/2027, dalla proprieta' il 14 agosto 2026.
insert into stagione_chiusura (etichetta, chiusura, riapertura)
select '2026/2027', date '2026-11-29', date '2027-02-13'
where not exists (select 1 from stagione_chiusura where etichetta = '2026/2027');

-- Le due date del buono: quella che vale e quella naturale dei dodici mesi.
-- Senza la seconda non si puo' scrivere «sarebbe scaduto il...», e
-- ricalcolarla dopo darebbe una data diversa il giorno che il regolamento
-- cambia — cioe' proprio quando la frase conta.
alter table buono_regalo add column if not exists scade_il_base date;
alter table buono_regalo add column if not exists prorogato boolean not null default false;
