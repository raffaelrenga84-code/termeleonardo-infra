-- Focaccia margherita, pizzette e schiacciata romana stavano in «Vetrinetta»
-- solo perche' le prepara il banco del Bistrot e non la cucina: la
-- categoria stampa al bar, e serviva la comanda davanti. Per l'ospite dal
-- QR pero' «Dalla vetrinetta» sono le brioche, e li' non hanno senso (la
-- proprieta', 6 settembre 2026). Vanno fra le «specialita' da condividere»
-- (con pinse e piadine), tenendo la stampa al banco (stampante e locale
-- sull'articolo) e l'orario di tutto il giorno («sempre» sull'articolo,
-- che vince sul 12:15-14:30 della categoria — vedi orari.ts). Ultime della
-- categoria, dopo le pinse.
update pos_articolo
   set categoria = 'fidra-cat-da-condividere', stampante = 'bar', locale_stampa = 'bistrot', orari = 'sempre',
       posizione = 90, aggiornato_il = now()
 where attivo and nome in ('FOCACCIA MARGHERITA', 'PIZZETTE', 'SCHIACCIATA ROMANA')
   and categoria = 'fidra-cat-vetrinetta';
