-- ============================================================
-- La richiesta come è arrivata, prima che la reception la corregga.
--
-- PERCHE'. L'azione ?a=conferma accetta un `dati` corretto dall'operatore —
-- la reception sposta un orario, cambia un trattamento — e lo SOVRASCRIVE
-- sulla riga. Di quello che l'ospite aveva chiesto non resta niente.
--
-- Serve a due cose diverse, tutte e due vere:
--   1. Alla scheda, per mostrare accanto «aveva chiesto la mattina» dove
--      qualcosa è cambiato: chi apre quella richiesta fra sei mesi capisce.
--   2. Alle contestazioni. «Io avevo chiesto le nove» oggi non si può né
--      confermare né smentire.
--
-- Si scrive UNA VOLTA SOLA, alla creazione, e non si tocca più. Se la si
-- riscrivesse a ogni correzione conserverebbe la penultima versione, che non
-- serve a nessuno.
-- ============================================================

alter table richiesta_sito add column if not exists dati_originali jsonb;

-- Le righe già in tabella non sono mai state corrette: il loro `dati` E'
-- l'originale. Si riempie una volta, e la condizione `is null` fa sì che
-- rieseguire questo file non sovrascriva niente.
update richiesta_sito
   set dati_originali = dati
 where dati_originali is null;

comment on column richiesta_sito.dati_originali is
  'La richiesta come è arrivata dall''ospite. Scritta alla creazione, mai più modificata: `dati` invece porta la versione corretta dalla reception.';
