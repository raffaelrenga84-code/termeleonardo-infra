-- ============================================================
-- Il promemoria è arrivato? La traccia di consegna nel back office.
--
-- LA RICHIESTA. «Nel backend voglio vedere che ha ricevuto il promemoria
-- del buono in scadenza e se l'ha letto, per evitare contestazioni.»
--
-- COSA SI PUÒ SAPERE DAVVERO, e la differenza conta:
--
--   INVIATO      — l'abbiamo consegnato a Resend. Lo sappiamo già oggi
--                  (`promemoria_il`), ma non dice niente sull'arrivo.
--   CONSEGNATO   — il server di posta del destinatario l'ha ACCETTATO.
--                  Questo è il fatto che regge in una contestazione.
--   RESPINTO     — casella piena, indirizzo inesistente, rifiutato. È
--                  l'informazione più utile di tutte: si può richiamare
--                  l'ospite prima che il buono scada davvero.
--
-- COSA NON SI REGISTRA, DI PROPOSITO: «letto».
-- Si misurerebbe con un'immagine invisibile che il client scarica. Ma
-- Apple Mail Privacy Protection scarica QUELLE IMMAGINI DA SOLO, per
-- tutti, anche per chi non ha aperto niente — e su un pubblico italiano
-- di clienti alberghieri è una fetta enorme. Il risultato sarebbe «letto»
-- su email mai aperte e «non letto» su email lette da chi blocca le
-- immagini: rumore in tutte e due le direzioni.
--
-- E in una contestazione sarebbe una prova CONTRO di noi: l'ospite dice
-- «non l'ho mai visto», noi mostriamo «risulta letto», lui ha ragione, e
-- ci siamo giocati la credibilità anche sul resto. «Consegnato al suo
-- server di posta» invece è vero, verificabile e non si può smentire.
--
-- L'identificativo di Resend serve a ricollegare l'evento che arriva dopo
-- (la consegna può impiegare minuti od ore) alla riga giusta.
-- ============================================================

alter table buono_regalo add column if not exists promemoria_resend_id     text;
alter table buono_regalo add column if not exists promemoria_consegnato_il timestamptz;
alter table buono_regalo add column if not exists promemoria_respinto_il   timestamptz;
alter table buono_regalo add column if not exists promemoria_respinto_perche text;

comment on column buono_regalo.promemoria_resend_id is
  'Identificativo del messaggio restituito da Resend: serve a ricollegare gli eventi di consegna, che arrivano minuti od ore dopo.';
comment on column buono_regalo.promemoria_consegnato_il is
  'Quando il server di posta del destinatario ha ACCETTATO il messaggio. È il fatto che regge in una contestazione. Non significa «letto» — quello non si registra, vedi il file della migrazione.';
comment on column buono_regalo.promemoria_respinto_il is
  'Quando la consegna è fallita in modo definitivo (indirizzo inesistente, casella piena, rifiuto). Da guardare per richiamare l''ospite prima che il buono scada.';
comment on column buono_regalo.promemoria_respinto_perche is
  'Il motivo dichiarato dal server che ha respinto, così com''è arrivato.';

-- Il back office chiede «quali promemoria sono stati respinti»: senza
-- indice è una scansione di tutta la tabella, e quella riga la si guarda
-- ogni volta che si apre l'elenco dei buoni in scadenza.
create index if not exists buono_regalo_promemoria_respinto
  on buono_regalo (promemoria_respinto_il) where promemoria_respinto_il is not null;

-- L'evento di Resend arriva con il solo identificativo del messaggio: è
-- da lì che si risale alla riga, e senza indice sarebbe una scansione a
-- ogni evento.
create index if not exists buono_regalo_promemoria_resend
  on buono_regalo (promemoria_resend_id) where promemoria_resend_id is not null;
