/* ============================================================
   2026-09-07-pos-bacheca-estero.sql — la bacheca parla anche agli ospiti stranieri.

   «multilingue per bacheca» (la proprieta', 6 settembre 2026, sera). Le
   etichette sulla TV sono in tre lingue da sole; per il piatto, una riga
   facoltativa scritta a mano in inglese o tedesco, sotto quella italiana.
   ============================================================ */
alter table pos_bacheca add column if not exists primo_estero text;
alter table pos_bacheca add column if not exists secondo_estero text;
