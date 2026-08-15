-- ============================================================
-- I consensi restano scritti, invece di essere controllati e buttati.
--
-- COM'ERA. Il modulo chiede la spunta, il server la PRETENDE — senza,
-- rifiuta — e poi non la salva da nessuna parte. Verificato il 15 agosto
-- 2026: `richiesta_sito` ha 29 colonne e nessuna e' il consenso;
-- `buono_regalo` lo stesso.
--
-- PERCHE' PESA. Sui buoni chi compra accetta che il buono NON E'
-- RIMBORSABILE. Se fra otto mesi qualcuno contesta, oggi non c'e' niente da
-- mostrare — nemmeno a noi stessi, per sapere com'e' andata. Ed e' lo stesso
-- problema per cui la proprieta' voleva la traccia dei promemoria: «per
-- evitare contestazioni».
--
-- Si salva la DATA E ORA, non un vero/falso: «ha accettato» senza quando non
-- serve a niente, perche' le condizioni cambiano e conta sapere QUALI ha
-- accettato — e quelle si ricostruiscono dalla data.
--
-- Nullo vuol dire «non registrato», che e' lo stato onesto delle righe
-- esistenti: sono passate dal controllo, ma nessuno ha scritto quando.
-- ============================================================

alter table richiesta_sito add column if not exists privacy_il timestamptz;

alter table buono_regalo  add column if not exists privacy_il    timestamptz;
alter table buono_regalo  add column if not exists condizioni_il timestamptz;

comment on column richiesta_sito.privacy_il is
  'Quando l''ospite ha dichiarato di aver preso atto dell''informativa. Null sulle righe create prima del 15 agosto 2026: il consenso c''era ma non veniva registrato.';
comment on column buono_regalo.privacy_il is
  'Quando l''acquirente ha dichiarato di aver preso atto dell''informativa. Null sulle righe precedenti al 15 agosto 2026.';
comment on column buono_regalo.condizioni_il is
  'Quando l''acquirente ha accettato le condizioni di vendita, fra cui la non rimborsabilita''. E'' la prova in caso di contestazione. Null sulle righe precedenti al 15 agosto 2026.';
