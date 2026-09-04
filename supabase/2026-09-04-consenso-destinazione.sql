-- 2026-09-04-consenso-destinazione.sql — dove va il consenso in attesa.
--
-- «aggiungi i pulsanti privacy all'iPad o al totem» (la proprieta', 4
-- settembre 2026). Chi lo manda all'iPad lo vede comparire nell'elenco
-- della reception; chi lo manda al totem lascia che sia l'ospite a
-- passare la tessera, e l'elenco dell'iPad resta pulito. In tutti e due i
-- casi il consenso e' lo stesso: cambia solo dove si va a prenderlo.
--
-- Ripetibile.

alter table consenso add column if not exists destinazione text not null default 'ipad'
  check (destinazione in ('ipad', 'totem'));
