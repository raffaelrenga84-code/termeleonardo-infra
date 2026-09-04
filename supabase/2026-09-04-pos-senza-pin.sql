-- 2026-09-04-pos-senza-pin.sql — il cameriere puo' entrare col solo codice.
--
-- «apparte che e' esagerato basta codice» (la proprieta', 4 settembre 2026,
-- provando il palmare). La pagina /pos risponde solo dall'IP dell'hotel e
-- il palmare deve essere registrato col suo codice: il PIN e' un terzo
-- lucchetto su una porta che sta gia' dentro casa. Resta possibile
-- chiederlo, cameriere per cameriere: chi puo' cambiare i prezzi o
-- stornare e' bene che lo tenga.
--
-- Ripetibile.

alter table pos_cameriere add column if not exists senza_pin boolean not null default false;
