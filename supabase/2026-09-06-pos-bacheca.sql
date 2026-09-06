/* ============================================================
   2026-09-06-pos-bacheca.sql — la bacheca all'ingresso (TV): i piatti del giorno.

   «un monitor da posizionare all'ingresso del Bistro per far leggere i
   piatti del giorno; attualmente c'e' un primo del giorno e un secondo
   del giorno» (la proprieta', 6 settembre 2026). Sull'articolo la spunta
   «in bacheca» e il testo del giorno («Tagliatelle al ragu'»), dal back
   office POS · Menu'. La pagina e' /bacheca, pubblica come il menu' dal QR.
   ============================================================ */
alter table pos_articolo add column if not exists in_bacheca boolean not null default false;
alter table pos_articolo add column if not exists bacheca_testo text;
