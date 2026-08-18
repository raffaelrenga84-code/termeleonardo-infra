-- ============================================================
-- Il desiderio d'orario per i fanghi, nella pagina «Prepara il suo arrivo».
--
-- PERCHE'. Il ciclo fanghi e' la risorsa piu' vincolata dell'hotel — sei
-- turni al mattino, dalle 5:50 alle 10:30, con la visita medica di
-- ammissione obbligatoria prima — ed e' la meno digitale: l'unico canale e'
-- il telefono della Segreteria Cure. La conferma dice gia' «la segreteria
-- cure le confermera' il turno», ed e' onesto. Mancava il passo prima:
-- l'ospite non aveva modo di dire cosa PREFERIREBBE.
--
-- E' UNA PREFERENZA, NON UN APPUNTAMENTO. Il turno lo assegna la Segreteria
-- Cure dopo la visita medica, e qualunque cosa somigli a una prenotazione
-- qui sarebbe una promessa che il servizio non puo' mantenere. Per questo
-- la colonna si chiama `fanghi_desiderio` e non `fanghi_turno`: il nome di
-- una colonna e' la prima cosa che legge chi ci lavorera' fra un anno.
--
-- DUE COLONNE, IN DUE TABELLE DIVERSE, e non e' un dettaglio:
--
--   arrivo_link.cure          lo sappiamo NOI quando creiamo il link
--   arrivo_richiesta.fanghi_desiderio  lo dice l'OSPITE quando compila
--
-- `cure` serve perche' ?action=crea riceve reservation_id, intestatario,
-- date e ospiti, ma NON il trattamento: senza, la pagina non puo' sapere se
-- quell'ospite ha le cure, e mostrare la domanda a chi viene per due notti
-- di relax sarebbe rumore. Il dato ce l'ha gia' l'estensione — `deduci(d).cure`
-- in popup.js, la stessa regola che decide se mettere il blocco «cure
-- termali» nell'email — e da qui in poi lo passa.
--
-- Tutte e due NULLABLE, con un default onesto: le righe gia' esistenti non
-- sanno niente di cure ne' di preferenze, e devono continuare a valere.
-- ============================================================

alter table arrivo_link
  add column if not exists cure boolean not null default false;

comment on column arrivo_link.cure is
  'true se questo soggiorno comprende il ciclo di cure termali. Lo passa '
  'l''estensione a ?action=crea (deduci(d).cure in popup.js). Decide se la '
  'pagina d''arrivo mostra la sezione «Cure termali»: a chi viene per due '
  'notti di relax quella domanda sarebbe rumore.';

alter table arrivo_richiesta
  add column if not exists fanghi_desiderio text;

comment on column arrivo_richiesta.fanghi_desiderio is
  'La PREFERENZA d''orario per i fanghi: presto | tardi | indifferente. '
  'Non e'' un turno e non e'' un appuntamento — il turno lo assegna la '
  'Segreteria Cure dopo la visita medica di ammissione. Il nome dice '
  '«desiderio» apposta: chi ci lavorera'' fra un anno non deve poterlo '
  'scambiare per una prenotazione.';
