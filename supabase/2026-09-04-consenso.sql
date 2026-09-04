-- 2026-09-04-consenso.sql — il consenso privacy firmato al totem o sull'iPad.
-- Spec: docs/superpowers/specs/2026-09-04-privacy-totem-design.md
--
-- Nasce «in attesa» al check-in (l'estensione manda i dati della
-- prenotazione Fidra), diventa «firmato» quando l'ospite conferma sul
-- totem o sull'iPad: tre scelte, la firma (PNG in base64) e la versione
-- delle frasi che ha letto. Resta qui per anni: e' la prova del consenso.
-- Il codice della tessera non si salva; la data di nascita non serve.
-- Ripetibile: solo `create ... if not exists`.

create table if not exists consenso (
  id                 uuid primary key default gen_random_uuid(),
  creato_il          timestamptz not null default now(),
  firmato_il         timestamptz,
  stato              text not null default 'in_attesa' check (stato in ('in_attesa', 'firmato', 'annullato')),
  camera             text not null,
  cognome            text not null,
  nome               text not null default '',
  email              text,
  lingua             text not null default 'it' check (lingua in ('it', 'en', 'de', 'fr')),
  fidra_prenotazione text,
  arrivo             date,
  partenza           date,
  conservazione      boolean,
  messaggi           boolean,
  marketing          boolean,
  firma              text,
  testi_versione     text,
  fonte              text check (fonte in ('totem', 'ipad')),
  ip                 text,
  email_inviata      boolean not null default false
);

create index if not exists consenso_camera on consenso (camera, stato);
create index if not exists consenso_firmato on consenso (firmato_il desc);
