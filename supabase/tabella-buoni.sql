-- Buoni regalo — Hotel Terme Leonardo
-- Eseguire nel SQL Editor di Supabase (progetto mvuiuwakuseockotlcnp).

create table if not exists public.buono_regalo (
  id            uuid primary key default gen_random_uuid(),
  -- numerazione per l'amministrazione: BR-2026-0001, progressiva per anno
  anno          int  not null default extract(year from now()),
  progressivo   int  not null,
  numero        text not null unique,
  -- codice per il cliente: LEO-A7K3-M2P9 (assegnato solo quando è pagato)
  codice        text unique,
  creato_il     timestamptz not null default now(),
  creato_da     text,
  tipo          text not null,                  -- 'servizio' | 'valore'
  voce_id       text,
  descrizione   text not null,
  sottotitolo   text,
  valore        numeric(10,2) not null,
  lingua        text not null default 'it',
  acquirente        text,
  acquirente_email  text,
  acquirente_tel    text,
  destinatario      text,
  destinatario_email text,
  dedica            text,
  scade_il      date,
  -- ciclo di vita:  attesa → pagato → riscosso ; annullato in ogni momento
  stato         text not null default 'attesa',
  pagamento     text,          -- contanti | bancomat | bonifico | stripe
  pagato_il     timestamptz,
  pagato_da     text,          -- operatore che ha verificato l'incasso
  pagamento_rif text,          -- CRO del bonifico, id Stripe, scontrino…
  stripe_sessione text,
  riscosso_il   timestamptz,
  riscosso_da   text,
  riscosso_note text,
  note          text
);

create index if not exists buono_codice_idx on public.buono_regalo (codice);
create index if not exists buono_numero_idx on public.buono_regalo (numero);
create index if not exists buono_stato_idx  on public.buono_regalo (stato, scade_il);
create index if not exists buono_creato_idx on public.buono_regalo (creato_il desc);

alter table public.buono_regalo enable row level security;

-- Numerazione progressiva senza buchi né doppioni, anche con più operatori
-- che emettono nello stesso momento (lock sulla riga dell'anno).
create table if not exists public.buono_contatore (
  anno int primary key,
  ultimo int not null default 0
);

create or replace function public.prossimo_numero_buono()
returns table (anno int, progressivo int, numero text)
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_anno int := extract(year from now())::int;
  v_n int;
begin
  /* niente ON CONFLICT: il nome "anno" è anche un campo restituito e
     Postgres non saprebbe a quale dei due riferirsi (errore 42702).
     Prima si prova l'aggiornamento, e solo se l'anno non c'è si inserisce. */
  update public.buono_contatore as c
     set ultimo = c.ultimo + 1
   where c.anno = v_anno
  returning c.ultimo into v_n;

  if v_n is null then
    begin
      insert into public.buono_contatore (anno, ultimo) values (v_anno, 1);
      v_n := 1;
    exception when unique_violation then
      /* un altro operatore ha creato l'anno nello stesso istante */
      update public.buono_contatore as c
         set ultimo = c.ultimo + 1
       where c.anno = v_anno
      returning c.ultimo into v_n;
    end;
  end if;

  return query select v_anno, v_n,
    ('BR-' || v_anno || '-' || lpad(v_n::text, 4, '0'))::text;
end;
$fn$;
