/* ============================================================
   La firma dell'ospite sull'addebito in camera.

   Si passa il palmare all'ospite: legge cosa ha preso, l'importo e la
   camera, e firma col dito. Al check-out, davanti a chi dice «questo io
   non l'ho preso», la reception apre l'addebito e mostra la firma.

   La firma non e' un consenso: e' la prova di un ordine dato. Vive con
   l'addebito e se ne va con lui.

   `lingua` sul conto: la dice Fidra quando si passa la tessera, cosi' la
   schermata della firma parla la lingua dell'ospite.
   Ripetibile.
   ============================================================ */
alter table pos_conto add column if not exists lingua text;
alter table pos_addebito add column if not exists firma text;
alter table pos_addebito add column if not exists firmato_il timestamptz;
