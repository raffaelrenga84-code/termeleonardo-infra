/* ============================================================
   2026-09-06-pos-portate-semplici.sql — portate semplici e «Segue» a tempo.

   «il bistro non e' un vero ristorante: nella maggior parte dei casi
   l'ordinazione deve arrivare tutta insieme al tavolo; si puo' togliere
   [le portate] e aggiungere solo il pulsante SEGUE per spezzare la
   comanda, e magari far apparire tre scelte: segue in 5, 10, 15 min»
   (la proprieta', 6 settembre 2026).

   pos_locale.portate_semplici: acceso al Bistrot, spento al Ristorante
   (che tiene antipasti/primi/secondi). segue_minuti: le scelte a tempo
   sul palmare. pos_riga.segue_min: null = parte subito, 0 = segue a
   chiamata, N = segue tra N minuti; segue_alle: quando parte da se'.
   ============================================================ */
alter table pos_locale add column if not exists portate_semplici boolean not null default false;
alter table pos_locale add column if not exists segue_minuti text not null default '5,10,15';
alter table pos_riga add column if not exists segue_min int;
alter table pos_riga add column if not exists segue_alle timestamptz;
update pos_locale set portate_semplici = true where id = 'bistrot';
