-- Il nome per il cliente (QR) di due articoli legati alla stagione: sul POS e
-- in cucina restano «CACO» e «ANGURIA O MELONE A FETTE», al cliente si dice
-- «frutto di stagione» — vero tutto l'anno (la proprieta', 6 settembre 2026).
-- Due nomi diversi, non uno: sono due porzioni diverse (un frutto a 3 €, un
-- piatto a fette a 6 €), e due voci uguali con prezzi diversi confonderebbero.
update pos_articolo set nomi = '{"it":"Frutto di stagione","en":"Seasonal fruit","de":"Obst der Saison","fr":"Fruit de saison"}'::jsonb, aggiornato_il = now()
 where nome = 'CACO' and attivo;
update pos_articolo set nomi = '{"it":"Frutta di stagione a fette","en":"Sliced seasonal fruit","de":"Obst der Saison in Scheiben","fr":"Fruits de saison en tranches"}'::jsonb, aggiornato_il = now()
 where nome = 'ANGURIA O MELONE A FETTE' and attivo;
