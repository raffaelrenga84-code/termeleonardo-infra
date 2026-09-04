/* ============================================================
   I pagamenti di un conto: uno o piu' per conto.

   «dividere il conto fra persone al tavolo» e «strumenti aggiuntivi per
   incassare, dare resto» (la proprieta', 4-5 settembre 2026). Finora un
   conto si chiudeva in un colpo con un modo solo; adesso ogni incasso e'
   una riga qui, e il conto si chiude da solo quando le righe coprono il
   totale. «In camera» resta un addebito (pos_addebito), non un
   pagamento. Il resto dei contanti si calcola da ricevuto_cent.
   Ripetibile.
   ============================================================ */
create table if not exists pos_pagamento (
  id text primary key,
  conto text not null references pos_conto(id),
  modo text not null check (modo in ('contanti', 'carta')),
  importo_cent int not null check (importo_cent > 0),
  ricevuto_cent int,
  cameriere text references pos_cameriere(id),
  il timestamptz not null default now(),
  aggiornato_il timestamptz not null default now()
);
create index if not exists pos_pagamento_conto on pos_pagamento(conto);
create index if not exists pos_pagamento_il on pos_pagamento(il desc);

alter table pos_pagamento enable row level security;

/* un conto pagato un po' in contanti e un po' con la carta si chiude
   «misto»: il vincolo di prima non lo ammetteva */
alter table pos_conto drop constraint if exists pos_conto_chiuso_come_check;
alter table pos_conto add constraint pos_conto_chiuso_come_check check (chiuso_come in ('camera', 'contanti', 'carta', 'misto'));
