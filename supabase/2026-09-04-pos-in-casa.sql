/* ============================================================
   Chi e' in casa, letto da Fidra ogni mattina.

   La reception apre «In Casa» (day-overview) e preme il pulsante
   dell'estensione: qui finisce una riga per ospite, con camera, nome,
   arrangiamento, lingua e le note della prenotazione.

   A cosa serve al POS: aprendo un conto in camera si scelgono i nomi veri
   invece di scriverli, si vede subito se l'ospite e' in mezza pensione (il
   menu' del giorno non si paga) e la nota della prenotazione arriva in
   cucina insieme alla comanda.

   Si riscrive tutta a ogni invio del giorno: e' una fotografia, non un
   archivio. Ripetibile.
   ============================================================ */
create table if not exists pos_in_casa (
  id text primary key,
  giorno date not null,
  camera text not null,
  cognome text not null,
  nome text,
  fidra_cliente text,
  fidra_soggiorno text,
  fidra_prenotazione text,
  email text,
  lingua text,
  arrangiamento text,
  pasti text not null default 'colazione' check (pasti in ('colazione', 'mezza', 'completa')),
  adulti int not null default 1,
  bambini int not null default 0,
  arrivo date,
  partenza date,
  note text,
  aggiornato_il timestamptz not null default now()
);
create index if not exists pos_in_casa_giorno on pos_in_casa(giorno, camera);

alter table pos_in_casa enable row level security;
