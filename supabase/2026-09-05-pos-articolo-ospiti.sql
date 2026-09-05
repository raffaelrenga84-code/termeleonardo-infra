-- «Ospiti (QR)» sul singolo articolo: il palmare vede tutto, chi ordina
-- dal QR solo cio' che il Bistrot ha davvero. L'acqua: il Bistrot ha solo
-- la Tavina naturale e gassata da mezzo litro; San Pellegrino, Panna e
-- Gaverina sono del ristorante (la proprieta', 5 settembre 2026).
alter table pos_articolo add column if not exists per_ospiti boolean not null default true;
update pos_articolo set per_ospiti = false, aggiornato_il = now()
 where nome in ('Acqua Gaverina Naturale 0,75 L.', 'Acqua Gaverina Gasata 0,75 L.', 'Acqua Minerale Panna 0,75 L.',
                'Acqua Minerale San Pellegrino 0,75 L.', 'Acqua San Pellegrino 0,5 L.')
   and per_ospiti;
