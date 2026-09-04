-- 2026-09-04-opinione-voti.sql — un voto per reparto, oltre al voto generale.
--
-- «e' molto spoglia, e' veramente una recensione generale: si potrebbe
-- prendere spunto dal feedback che chiediamo in modo cartaceo» (la
-- proprieta', 4 settembre 2026). Camera, pulizia, ristorante, cure
-- termali, piscine, personale, prezzo: ognuno con le sue stelle, tutti
-- facoltativi. Un oggetto solo, cosi' aggiungere o togliere un reparto
-- domani non vuol dire cambiare la tabella. Ripetibile.

alter table opinione add column if not exists voti jsonb not null default '{}'::jsonb;
