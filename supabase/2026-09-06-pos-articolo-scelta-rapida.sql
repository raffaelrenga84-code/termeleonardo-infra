-- La scelta rapida del menu dal QR diventa una lista gia' aperta, non dei
-- pulsanti: «conviene mettere una lista di quei prodotti fuori dai pulsanti,
-- siccome sono pochi uno li vede subito» (la proprieta', 6 settembre 2026).
-- Tutte e quattro le proprieta' sono spunte della reception (POS · Menu):
-- «senza glutine» e «senza lattosio» non si deducono piu' dagli allergeni
-- (una bistecca non ha glutine, ma non e' un «prodotto senza glutine» del
-- menu). Gli allergeni scritti restano un freno: una spunta non vince su
-- una sigla GL o LA scritta (vedi pagine/ordina/filtri.js).
alter table pos_articolo add column if not exists senza_glutine boolean not null default false;
alter table pos_articolo add column if not exists senza_lattosio boolean not null default false;
update pos_articolo set senza_glutine = true, aggiornato_il = now()
 where attivo and not senza_glutine
   and (nome ilike '%glutenfree%' or nome ilike '%gluten free%' or nome ilike '%senza glutine%');
