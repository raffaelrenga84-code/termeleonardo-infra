-- 2026-09-04-pos.sql — POS di Bistrot e ristorante, fase 1 (comande).
-- Spec: docs/superpowers/specs/2026-09-04-pos-design.md
--
-- Id in testo: li genera il palmare (crypto.randomUUID), cosi' il server
-- locale sul PC del Bistrot e il cloud accettano la stessa riga senza
-- contarsi. Ogni tabella allineabile porta aggiornato_il: vince il piu'
-- recente. Solo `create if not exists`: la migrazione si puo' rilanciare
-- (strumenti/migra.js non e' transazionale).
--
-- Le stampanti: qui stanno solo cucina e bar. Le altre stampanti dell'hotel,
-- quelle degli scontrini in testa, non compaiono e non compariranno in questa fase.

create table if not exists pos_locale (
  id text primary key,
  nome text not null,
  reparto text not null default 'F&B',
  stampante_cucina text,   -- host:porta sulla LAN, li mette il back office
  stampante_bar text,
  aggiornato_il timestamptz not null default now()
);

create table if not exists pos_zona (
  id text primary key,
  locale text not null references pos_locale(id),
  nome text not null,
  posizione int not null default 0,
  aggiornato_il timestamptz not null default now()
);

create table if not exists pos_tavolo (
  id text primary key,
  zona text not null references pos_zona(id),
  nome text not null,
  posti int not null default 4,
  x int not null default 0,
  y int not null default 0,
  attivo boolean not null default true,
  aggiornato_il timestamptz not null default now()
);

create table if not exists pos_categoria (
  id text primary key,
  nome text not null,
  posizione int not null default 0,
  colore text,
  stampante text not null check (stampante in ('cucina', 'bar')),
  portata text not null default 'secondi' check (portata in ('bevande', 'antipasti', 'primi', 'secondi', 'dolci')),
  sotto text references pos_categoria(id),
  note_rapide text[] not null default '{}',
  fidra_id text,
  attiva boolean not null default true,
  aggiornato_il timestamptz not null default now()
);

create table if not exists pos_articolo (
  id text primary key,
  categoria text not null references pos_categoria(id),
  nome text not null,
  prezzo_cent int not null default 0,
  iva int not null default 10,
  portata text check (portata in ('bevande', 'antipasti', 'primi', 'secondi', 'dolci')),   -- null = quella della categoria
  stampante text check (stampante in ('cucina', 'bar')),                                    -- null = quella della categoria
  prezzo_libero boolean not null default false,
  incluso_trattamento boolean not null default false,
  conto_ricavo text,
  esaurito boolean not null default false,
  posizione int not null default 0,
  fidra_id text,
  attivo boolean not null default true,
  aggiornato_il timestamptz not null default now()
);
create unique index if not exists pos_articolo_fidra on pos_articolo(fidra_id) where fidra_id is not null;

create table if not exists pos_variante (
  id text primary key,
  articolo text references pos_articolo(id),
  categoria text references pos_categoria(id),
  nome text not null,
  supplemento_cent int not null default 0,
  posizione int not null default 0,
  aggiornato_il timestamptz not null default now()
);

create table if not exists pos_preferito (
  id text primary key,
  locale text not null references pos_locale(id),
  articolo text not null references pos_articolo(id),
  posizione int not null,
  aggiornato_il timestamptz not null default now()
);

create table if not exists pos_cameriere (
  id text primary key,
  nome text not null,
  codice text not null unique,
  pin_hash text not null,   -- SHA-256 di «codice:pin», mai il PIN in chiaro
  ruolo text not null check (ruolo in ('cameriere', 'capo_sala', 'amministrazione')),
  storni boolean not null default false,
  bloccato boolean not null default false,
  aggiornato_il timestamptz not null default now()
);

create table if not exists pos_dispositivo (
  id text primary key,
  nome text not null,
  token text not null unique,
  locale text references pos_locale(id),
  ultimo_accesso timestamptz,
  bloccato boolean not null default false,
  aggiornato_il timestamptz not null default now()
);

create table if not exists pos_sessione (
  id text primary key,
  cameriere text not null references pos_cameriere(id),
  dispositivo text not null references pos_dispositivo(id),
  scade_il timestamptz not null,
  aggiornato_il timestamptz not null default now()
);

create table if not exists pos_conto (
  id text primary key,
  tavolo text not null references pos_tavolo(id),
  tipo text not null check (tipo in ('camera', 'esterno')),
  camera text,
  ospite text,
  tessera text,
  coperti int not null default 1,
  stato text not null default 'aperto' check (stato in ('aperto', 'conto_chiesto', 'chiuso')),
  chiuso_come text check (chiuso_come in ('camera', 'contanti', 'carta')),
  aperto_da text references pos_cameriere(id),
  aperto_il timestamptz not null default now(),
  chiuso_da text references pos_cameriere(id),
  chiuso_il timestamptz,
  aggiornato_il timestamptz not null default now()
);

create table if not exists pos_riga (
  id text primary key,
  conto text not null references pos_conto(id),
  articolo text references pos_articolo(id),
  nome text not null,                 -- copiato al momento: il menu' puo' cambiare dopo
  quantita int not null default 1,
  prezzo_listino_cent int not null,
  prezzo_cent int not null,           -- quello applicato: listino + variante, o a mano
  variante text,
  nota text,
  portata text not null check (portata in ('bevande', 'antipasti', 'primi', 'secondi', 'dolci')),
  stato text not null check (stato in ('da_inviare', 'inviata', 'partita', 'stornata')),
  creata_da text references pos_cameriere(id),
  creata_il timestamptz not null default now(),
  partita_il timestamptz,
  stornata_da text references pos_cameriere(id),
  stornata_il timestamptz,
  motivo_storno text,
  aggiornato_il timestamptz not null default now()
);

create table if not exists pos_comanda (
  id text primary key,
  conto text not null references pos_conto(id),
  portata text not null,
  tipo text not null check (tipo in ('comanda', 'vai', 'storno', 'modifica')),
  righe text[] not null,
  aggiornato_il timestamptz not null default now()
);

create table if not exists pos_stampa (
  id text primary key,
  locale text not null references pos_locale(id),
  stampante text not null check (stampante in ('cucina', 'bar')),
  testo text not null,
  stato text not null default 'da_stampare' check (stato in ('da_stampare', 'stampata', 'errore')),
  creato_il timestamptz not null default now(),
  stampata_il timestamptz,
  stampata_da text,                   -- 'locale' o 'cloud'
  errore text,
  aggiornato_il timestamptz not null default now()
);

create table if not exists pos_battito (
  locale text primary key references pos_locale(id),
  visto_il timestamptz not null default now()
);
