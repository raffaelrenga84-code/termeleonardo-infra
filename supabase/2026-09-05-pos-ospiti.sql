/* ============================================================
   L'ordine dal tavolo, con il QR: l'ospite ordina e paga da solo.

   «un QR code sul tavolo che vada su una pagina per permettere a loro
   stessi di fare l'ordine pagando con Google Pay o Apple Pay, e se
   ospiti dell'hotel scansionando la carta stanza» (la proprieta', 5
   settembre 2026).

   pos_ordine_ospite tiene l'ordine finche' non e' pagato (carta, via
   Stripe) o addebitato (camera: tessera + numero di camera che devono
   combaciare, contro la tessera trovata per terra). Quando e' pagato
   nasce un pos_conto normale, aperto e chiuso dal cameriere fittizio
   «Ospiti al tavolo (QR)», che non puo' entrare da nessun palmare
   (codice non numerico, bloccato). per_ospiti sulle categorie: cosa
   vede l'ospite. Ripetibile.
   ============================================================ */
alter table pos_categoria add column if not exists per_ospiti boolean not null default true;

create table if not exists pos_ordine_ospite (
  id text primary key,
  tavolo text not null references pos_tavolo(id),
  lingua text,
  righe jsonb not null default '[]',
  totale_cent int not null check (totale_cent >= 0),
  modo text not null check (modo in ('carta', 'camera')),
  camera text, tessera text, ospite text,
  stato text not null default 'in_attesa' check (stato in ('in_attesa', 'pagato', 'in_cucina', 'annullato', 'errore')),
  stripe_link text, stripe_pagamento text,
  conto text references pos_conto(id),
  errore text,
  prova boolean not null default false,
  creato_il timestamptz not null default now(),
  aggiornato_il timestamptz not null default now()
);
create index if not exists pos_ordine_ospite_stato on pos_ordine_ospite(stato, creato_il desc);
create index if not exists pos_ordine_ospite_link on pos_ordine_ospite(stripe_link);
alter table pos_ordine_ospite enable row level security;

insert into pos_cameriere (id, nome, codice, pin_hash, ruolo, storni, bloccato, senza_pin, aggiornato_il)
values ('ospiti-qr', 'Ospiti al tavolo (QR)', 'QR-OSPITI', 'nessuno', 'cameriere', false, true, false, now())
on conflict (id) do nothing;
