-- ============================================================
-- Il Day Spa venduto da noi: i posti di ogni giorno e le prenotazioni.
--
-- PERCHE' I POSTI STANNO QUI E NON IN FIDRA. Dal 3 settembre 2026 la
-- vendita online e' nostra: due copie dei posti (una qui, una in Fidra)
-- divergerebbero alla prima vendita. La reception li carica ogni settimana
-- dal back office, come faceva in Fidra.
--
-- PERCHE' UNA FUNZIONE E NON DUE ISTRUZIONI. «Leggi i posti liberi, e se
-- bastano scrivi venduti+n» sono due istruzioni: fra la prima e la seconda
-- un altro ospite puo' aver comprato gli stessi posti. dayspa_prendi_posti
-- mette la condizione DENTRO l'UPDATE: Postgres serializza le due scritture
-- sulla stessa riga, e una sola delle due trova la condizione vera.
--
-- Si esegue una volta nel pannello Supabase (SQL editor), come gli altri
-- file di questa cartella.
-- ============================================================

create table if not exists dayspa_giorno (
  giorno        date not null,
  fascia        text not null check (fascia in ('giornaliero', 'serale')),
  tipo          text not null check (tipo in ('feriale', 'prefestivo', 'festivo')),
  posti         int  not null check (posti >= 0),
  venduti       int  not null default 0 check (venduti >= 0),
  prezzo_cent   int  not null check (prezzo_cent > 0),
  note          text,
  aggiornato_il timestamptz not null default now(),
  primary key (giorno, fascia)
);

create sequence if not exists dayspa_numero_seq;

-- Il prossimo progressivo, letto dalla funzione: supabase-js non chiama
-- nextval direttamente. Un buco nella numerazione (Stripe fallito dopo il
-- numero) e' innocuo; un doppione no, e la sequenza non ne fa.
create or replace function dayspa_prossimo_numero()
returns bigint language sql as $$
  select nextval('dayspa_numero_seq');
$$;

create table if not exists dayspa_prenotazione (
  id               bigserial primary key,
  numero           text not null unique,        -- DS-2026-0001
  giorno           date not null,
  fascia           text not null,
  persone          int  not null check (persone between 1 and 8),
  adulti           int  not null,
  bambini          int  not null default 0,
  importo_cent     int  not null,
  stato            text not null default 'in_pagamento'
                   check (stato in ('in_pagamento', 'pagata', 'annullata', 'rimborsata', 'scaduta')),
  presenti         int  not null default 0,
  nome             text not null,
  email            text not null,
  telefono         text,
  lingua           text not null default 'it',
  codice           text not null unique,        -- il contenuto del QR
  stripe_link      text,                        -- id del payment link
  stripe_pagamento text,                        -- payment_intent, per il rimborso
  buono            text,                        -- numero del buono regalo, se ha pagato con quello
  note             text,
  ricevuta_stato   text not null default 'da_battere'
                   check (ricevuta_stato in ('da_battere', 'battuta', 'errore', 'non_richiesta')),
  ricevuta_numero  text,
  ricevuta_il      timestamptz,
  ricevuta_errore  text,
  prova            boolean not null default false, -- Stripe in modalita' di prova
  creato_il        timestamptz not null default now(),
  scade_il         timestamptz,                 -- fine dei 20 minuti di in_pagamento
  pagato_il        timestamptz,
  arrivato_il      timestamptz,
  annullato_il     timestamptz,
  foreign key (giorno, fascia) references dayspa_giorno (giorno, fascia)
);

create index if not exists dayspa_prenotazione_giorno on dayspa_prenotazione (giorno, fascia);
create index if not exists dayspa_prenotazione_stato  on dayspa_prenotazione (stato, scade_il);
create index if not exists dayspa_prenotazione_email  on dayspa_prenotazione (lower(email));

-- Vero se i posti sono stati presi, falso se non bastavano. Una riga sola.
create or replace function dayspa_prendi_posti(p_giorno date, p_fascia text, p_n int)
returns boolean language plpgsql as $$
declare presi int;
begin
  update dayspa_giorno
     set venduti = venduti + p_n, aggiornato_il = now()
   where giorno = p_giorno and fascia = p_fascia and posti - venduti >= p_n;
  get diagnostics presi = row_count;
  return presi = 1;
end;
$$;

-- Restituisce i posti di una prenotazione scaduta o annullata. Mai sotto zero.
create or replace function dayspa_libera_posti(p_giorno date, p_fascia text, p_n int)
returns void language plpgsql as $$
begin
  update dayspa_giorno
     set venduti = greatest(0, venduti - p_n), aggiornato_il = now()
   where giorno = p_giorno and fascia = p_fascia;
end;
$$;
