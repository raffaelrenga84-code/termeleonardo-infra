-- «Vegetariano» sull'articolo, quarta pastiglia della scelta rapida del menu
-- dal QR (la proprieta', 6 settembre 2026). Come «vegano»: non si deduce dagli
-- allergeni, e' una spunta del back office. Parte accesa solo sui piatti che
-- si chiamano gia' cosi' sul menu; il resto lo decide la reception.
alter table pos_articolo add column if not exists vegetariano boolean not null default false;
update pos_articolo set vegetariano = true, aggiornato_il = now()
 where attivo and not vegetariano
   and (nome ilike '%vegetarian%' or nome ilike '%veggie%');
