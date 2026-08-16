-- ============================================================
-- Il consenso a ricevere offerte: separato, facoltativo, con la sua data.
--
-- PERCHE'. Il sito raccoglie indirizzi da mesi — richieste, buoni regalo,
-- prenotazioni — e non li puo' usare per mandare un'offerta: nessuno ha mai
-- chiesto quel permesso. Il concorrente lo chiede a ogni prenotazione e si
-- costruisce una lista; qui gli indirizzi ci sono e restano fermi.
--
-- TRE COSE CHE NON SONO DETTAGLI, e per cui questa colonna e' separata dalle
-- altre invece di essere un campo qualsiasi:
--
--   1. E' un consenso A PARTE. Non si ottiene dentro «accetto le condizioni»
--      ne' dentro la presa d'atto della privacy: sono cose diverse e vanno
--      chieste diverse, o non vale.
--   2. NON e' condizione per comprare o per mandare una richiesta. Chi dice
--      di no compra lo stesso, e la casella nasce SPENTA.
--   3. Si registra QUANDO, come per gli altri consensi: «ha detto di si'»
--      senza una data non dice a cosa ha detto di si', perche' i testi
--      cambiano.
--
-- E soprattutto: serve poterlo TOGLIERE. Chi si disiscrive non si cancella
-- dalla riga — quella e' la sua richiesta o il suo acquisto — si azzera
-- questa colonna. Per questo e' una data e non un vero/falso: null vuol dire
-- «non ce l'ho», e ci si arriva sia non avendolo mai dato sia avendolo tolto.
-- La distinzione fra i due casi, se un giorno servira', vorra' una tabella
-- di storico: oggi non serve e non si costruisce.
-- ============================================================

alter table richiesta_sito add column if not exists marketing_il timestamptz;
alter table buono_regalo  add column if not exists marketing_il timestamptz;

comment on column richiesta_sito.marketing_il is
  'Quando l''ospite ha acconsentito a ricevere offerte via email. Null = nessun consenso (mai dato, o revocato). Separato dalla presa d''atto privacy.';
comment on column buono_regalo.marketing_il is
  'Quando l''acquirente ha acconsentito a ricevere offerte via email. Null = nessun consenso (mai dato, o revocato). Separato dalle condizioni di vendita.';

-- Chi cerca «a chi posso scrivere» filtra su questa colonna: senza indice
-- diventa una scansione di tutta la tabella, e quella query la si fa ogni
-- volta che si prepara una comunicazione.
create index if not exists richiesta_sito_marketing
  on richiesta_sito (marketing_il) where marketing_il is not null;
create index if not exists buono_regalo_marketing
  on buono_regalo (marketing_il) where marketing_il is not null;
