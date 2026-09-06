/* ============================================================
   2026-09-06-pos-storno-con-motivo.sql — il motivo dello storno lo
   pretende solo chi ha la spunta.

   «dammi la possibilita' di decidere che cameriere deve darmi motivazione
   e quale non serve; all'inizio lo terrei disattivato per tutti per fare
   pratica» (la proprieta', 6 settembre 2026). Spenta per tutti: si
   accende dal back office, POS · Personale, persona per persona. Vale
   per lo storno di una riga e per «Cancella tutto il tavolo».
   ============================================================ */
alter table pos_cameriere add column if not exists storno_con_motivo boolean not null default false;
