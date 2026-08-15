-- ============================================================
-- La traccia dell'invio del promemoria di scadenza.
--
-- PERCHE' SERVE. Il lavoro che cerca i buoni in scadenza gira ogni giorno.
-- Senza una traccia di chi e' gia' stato avvisato, ogni giorno rimanderebbe
-- lo stesso promemoria alle stesse persone: da favore a molestia in una
-- settimana, e con l'indirizzo del dominio bruciato nei filtri antispam.
--
-- Vuota (null) vuol dire «mai avvisato»: e' lo stato di tutti i buoni
-- esistenti, ed e' quello giusto.
-- ============================================================

alter table buono_regalo add column if not exists promemoria_il timestamptz;

-- L'indice serve alla query giornaliera, che cerca «pagati, non riscossi,
-- non ancora avvisati, in scadenza entro trenta giorni». Senza, ogni giorno
-- si leggerebbe l'intera tabella: oggi sono zero righe e non si nota, fra
-- due anni sono migliaia e si nota.
create index if not exists buono_regalo_promemoria
  on buono_regalo (scade_il)
  where promemoria_il is null and riscosso_il is null;
