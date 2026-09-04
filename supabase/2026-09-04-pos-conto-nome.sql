/* ============================================================
   Il nome del conto, e le categorie in ordine.

   Al tavolo i conti si chiamavano tutti «Esterno» e non si distinguevano
   («non posso eliminare gli esterni o scrivere nome», la proprieta',
   4 settembre 2026): adesso ognuno puo' portare il nome di chi paga.

   Le categorie arrivavano da Fidra nell'ordine in cui le elenca lei, cioe'
   a caso; sul POS di prima stanno in ordine alfabetico. Le rinumeriamo
   cosi', a passi di dieci, lasciando spazio per infilarne altre dal back
   office.
   Ripetibile.
   ============================================================ */
alter table pos_conto add column if not exists nome text;

with in_ordine as (
  select id, row_number() over (order by lower(nome)) * 10 as posto from pos_categoria
)
update pos_categoria c set posizione = o.posto, aggiornato_il = now()
from in_ordine o where o.id = c.id and c.posizione is distinct from o.posto;
