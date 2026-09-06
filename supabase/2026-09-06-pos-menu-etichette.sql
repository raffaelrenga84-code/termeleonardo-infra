-- Le etichette del menu del Bistrot, dal menu stampato (La Piazza, IT 2026,
-- letto il 6 settembre 2026) e dagli allergeni che l'hotel dichiara.
--
-- SENZA GLUTINE: i piatti con la spiga barrata sul menu stampato, otto.
-- I cannelloni portano la spiga ma in archivio avevano GL fra gli allergeni:
-- vale il menu stampato (pasta senza glutine), restano ricotta e uova.
-- VEGETARIANO: per ingredienti stampati, niente carne ne' pesce.
-- VEGANO: per ingredienti e allergeni stampati (niente LA, niente U).
-- SENZA LATTOSIO: gli allergeni stampati non dicono LA.
-- La reception aggiusta dal back office (POS · Menu) quello che non torna.
update pos_articolo set allergeni = 'LA-U', aggiornato_il = now()
 where nome = 'CANNELLONI CON RICOTTO E SPINACE' and allergeni = 'GL-LA-U';

update pos_articolo set senza_glutine = true, aggiornato_il = now()
 where attivo and not senza_glutine and nome in (
   'Mozzarella di Bufala & Pomodoro Rosso Origano e Basilico', 'Prosciutto Crudo Burrata e Valeriana', 'RISO VENERE',
   'Penne rigate alle verdure Glutenfree', 'CANNELLONI CON RICOTTO E SPINACE', 'Petto di Pollo Grigliato al Rosmarino',
   'Verdure alla griglia', 'Insalata mista verde');

update pos_articolo set vegetariano = true, aggiornato_il = now()
 where attivo and not vegetariano and nome in (
   'Mozzarella di Bufala & Pomodoro Rosso Origano e Basilico', 'Penne rigate alle verdure Glutenfree',
   'CANNELLONI CON RICOTTO E SPINACE', 'Verdure alla griglia', 'Insalata mista verde', 'Patate fritte',
   'FIORI DI ZUCCA IN TEMPURA', 'GINEVRA', 'La Pinsa VEGETARIANA', 'La Pinsa Margherita', 'BRUSCHETTA ALL’ITALIANA',
   'VEGGIE DELIZIA', 'MACEDONIA', 'ANGURIA O MELONE A FETTE', 'CACO', 'Sorbetto', 'TORTINO CALDO AL CIOCCOLATO',
   'TIRAMISU’ DELLA CASA', 'TRIS DI GELATI ARTIGIANALI', 'Pallina Gelato');

update pos_articolo set vegano = true, aggiornato_il = now()
 where attivo and not vegano and nome in (
   'Verdure alla griglia', 'Insalata mista verde', 'Patate fritte', 'FIORI DI ZUCCA IN TEMPURA', 'VEGGIE DELIZIA',
   'MACEDONIA', 'ANGURIA O MELONE A FETTE', 'CACO', 'Sorbetto');

update pos_articolo set senza_lattosio = true, aggiornato_il = now()
 where attivo and not senza_lattosio and nome in (
   'RISO VENERE', 'Petto di Pollo Grigliato al Rosmarino', 'Penne rigate alle verdure Glutenfree', 'ZUPPA DI CEREALI',
   'COTOLETTA DI POLLO MILANESE', 'FIORI DI ZUCCA IN TEMPURA', 'Insalata mista verde', 'Patate fritte',
   'Verdure alla griglia', 'LEONARDO', 'SALMONE AFFUMICATO TOAST', 'INSALATA DI FARRO CON VERDURE E GAMBERI',
   'VEGGIE DELIZIA', 'MACEDONIA', 'CACO', 'ANGURIA O MELONE A FETTE', 'Sorbetto', 'SCHIACCIATA ROMANA');
