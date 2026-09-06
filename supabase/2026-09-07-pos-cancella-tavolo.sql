/* ============================================================
   2026-09-07-pos-cancella-tavolo.sql — «Cancella tutto il tavolo» con un
   interruttore per persona.

   «preferisco avere l'opzione di poterlo limitare con un pulsante» (la
   proprieta', 7 settembre 2026). Acceso per tutti all'inizio, perche'
   l'hanno chiesto i camerieri; si spegne dal back office, POS · Personale,
   a chi non deve averlo. Capo sala e amministrazione ce l'hanno sempre.
   ============================================================ */
alter table pos_cameriere add column if not exists cancella_tavolo boolean not null default true;
