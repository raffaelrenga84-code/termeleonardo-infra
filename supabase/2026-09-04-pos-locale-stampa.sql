/* ============================================================
   Il ristorante ordina al Bistrot, e il biglietto esce li'.

   «Il ristorante, alcune volte, deve avere la possibilita' di ordinare
   delle cose nel servizio di sera al bistro, quindi deve poter stampare
   direttamente al bistro, cosi' gli portano le bevande dal bistro al
   ristorante senza dover chiamare telefonicamente» (la proprieta',
   4 settembre 2026).

   `locale_stampa` dice DOVE SI PREPARA una cosa, quando non e' dove si
   ordina. Vuoto = si prepara nel locale del tavolo, come sempre. Si puo'
   mettere sulla categoria (i cocktail si fanno al Bistrot), sull'articolo
   (uno solo fa eccezione) o sulla singola riga (stasera questo lo fa il
   Bistrot). Vince la piu' precisa: riga, poi articolo, poi categoria.

   Sul biglietto che esce di la' comparira' «PORTARE AL RISTORANTE»: chi
   lo prepara deve sapere dove si mangia. Ripetibile.
   ============================================================ */
alter table pos_categoria add column if not exists locale_stampa text references pos_locale(id);
alter table pos_articolo add column if not exists locale_stampa text references pos_locale(id);
alter table pos_riga add column if not exists locale_stampa text references pos_locale(id);
