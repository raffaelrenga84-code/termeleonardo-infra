-- Gli orari del menu' per chi ordina dal QR (fase 2 della spec
-- 2026-09-05-menu-ospiti-design.md): una riga di testo per categoria o
-- per articolo, «12:15-14:30; ven,sab 12:15-20:30». Vuoto = sempre.
-- L'articolo vince sulla categoria; la categoria figlia eredita dalla madre.
-- Il palmare non li guarda: il cameriere ordina quello che vuole.
alter table pos_categoria add column if not exists orari text;
alter table pos_articolo add column if not exists orari text;
-- Gli orari della cucina di ogni locale: fuori da quelli il biglietto
-- della cucina esce al bancone (bar), perche' i cuochi non ci sono piu'.
alter table pos_locale add column if not exists orari_cucina text;
