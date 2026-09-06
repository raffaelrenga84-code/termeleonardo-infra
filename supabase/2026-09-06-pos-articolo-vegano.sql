-- «Vegano» sull'articolo, per la scelta rapida del menu dal QR: «prodotti
-- senza glutine, vegani e senza lattosio, cosi' fanno prima a scegliere» (la
-- proprieta', 6 settembre 2026). Senza glutine e senza lattosio si leggono
-- dagli allergeni gia' scritti (GL, LA); vegano no: la carne non e' un
-- allergene, quindi serve una spunta a parte, che la reception mette nel
-- back office (POS · Menu). Parte spenta su tutto: meglio nessun vegano che
-- uno sbagliato.
alter table pos_articolo add column if not exists vegano boolean not null default false;
