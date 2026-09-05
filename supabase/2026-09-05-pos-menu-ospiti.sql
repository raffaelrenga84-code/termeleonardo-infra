/* ============================================================
   Il menu' per l'ospite: nomi tradotti, descrizioni, allergeni.

   Spec docs/superpowers/specs/2026-09-05-menu-ospiti-design.md. Il POS
   resta com'e'; cambia cosa vede chi ordina dal QR sul tavolo. Ripetibile.
   ============================================================ */
alter table pos_articolo add column if not exists nomi jsonb;
alter table pos_articolo add column if not exists descrizioni jsonb;
alter table pos_articolo add column if not exists allergeni text;
alter table pos_categoria add column if not exists nomi jsonb;
