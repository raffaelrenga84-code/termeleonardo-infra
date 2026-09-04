-- 2026-09-04-opinione.sql — l'opinione dell'ospite lasciata al totem in hall.
-- Spec: docs/superpowers/specs/2026-09-04-opinione-totem-design.md
--
-- Nessun dato personale oltre al numero di camera, e solo se l'ospite lo
-- sceglie passando la tessera: il codice della tessera non si salva. Ogni
-- opinione parte subito per email alla direzione; `email_inviata` dice se
-- Resend l'ha presa. `prova` segue DAYSPA_PROVA come le prenotazioni.
-- Ripetibile: solo `create ... if not exists`.

create table if not exists opinione (
  id            uuid primary key default gen_random_uuid(),
  creato_il     timestamptz not null default now(),
  fonte         text not null default 'totem' check (fonte in ('totem', 'qr')),
  lingua        text not null default 'it' check (lingua in ('it', 'en', 'de', 'fr')),
  stelle        int  not null check (stelle between 1 and 5),
  temi          text[] not null default '{}',
  commento      text,
  camera        text,
  prova         boolean not null default false,
  email_inviata boolean not null default false
);

create index if not exists opinione_creato on opinione (creato_il desc);
