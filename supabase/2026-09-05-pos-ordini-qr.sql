-- Gli ordini dal QR dopo il pagamento (spec 2026-09-05-ordini-qr-design.md):
-- quanto e' stato restituito, l'ultimo rimborso Stripe, la nota della
-- reception, l'annullo; lo stato ammette anche «rimborsato». Ripetibile.
alter table pos_ordine_ospite add column if not exists rimborsato_cent int not null default 0;
alter table pos_ordine_ospite add column if not exists rimborso_stripe text;
alter table pos_ordine_ospite add column if not exists nota text;
alter table pos_ordine_ospite add column if not exists annullato_il timestamptz;
alter table pos_ordine_ospite add column if not exists annullato_da text;
alter table pos_ordine_ospite drop constraint if exists pos_ordine_ospite_stato_check;
alter table pos_ordine_ospite add constraint pos_ordine_ospite_stato_check
  check (stato in ('in_attesa', 'pagato', 'in_cucina', 'annullato', 'errore', 'rimborsato'));
