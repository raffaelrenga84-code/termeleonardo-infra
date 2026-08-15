-- ============================================================
-- I dati per la fattura dell'acquisto online, e la scelta
-- privato/azienda che decide quali servono.
--
-- SOLO raccolta e validazione: queste colonne conservano ciò che
-- supabase/functions/buoni/fattura.ts ha già controllato (partita IVA
-- con cifra di controllo, codice fiscale, CAP, provincia, codice
-- destinatario o PEC...). Numerazione, emissione dell'XML FatturaPA e
-- aliquote IVA sono un altro lavoro, non ancora iniziato: dipendono da
-- una conferma del commercialista che non è ancora arrivata (vedi
-- docs/superpowers/specs/2026-08-13-fatturazione-buoni-design.md,
-- sezione "Punti aperti"). Per questo qui non compaiono fatt_numero,
-- fatt_emessa_il, fatt_progressivo_invio né fidra_registrato_il, anche
-- se la specifica li nomina: si aggiungono quando si costruisce quella
-- parte, non prima.
--
-- fatt_intestatario sta in colonna propria (non dedotto da quali altri
-- campi sono valorizzati) perché serve a comporre CessionarioCommittente
-- nell'XML — persona fisica e azienda hanno una forma diversa — e a chi
-- guarda una fattura vecchia per capire perché è fatta così.
-- ============================================================

alter table buono_regalo add column if not exists fatt_richiesta boolean not null default false;
alter table buono_regalo add column if not exists fatt_intestatario text;    -- 'privato' | 'azienda'
alter table buono_regalo add column if not exists fatt_denominazione text;   -- ragione sociale, solo azienda
alter table buono_regalo add column if not exists fatt_piva text;            -- solo azienda
alter table buono_regalo add column if not exists fatt_cf text;
alter table buono_regalo add column if not exists fatt_indirizzo text;
alter table buono_regalo add column if not exists fatt_civico text;
alter table buono_regalo add column if not exists fatt_cap text;
alter table buono_regalo add column if not exists fatt_comune text;
alter table buono_regalo add column if not exists fatt_provincia text;
alter table buono_regalo add column if not exists fatt_sdi text;             -- privato: sempre '0000000'
alter table buono_regalo add column if not exists fatt_pec text;             -- solo azienda

comment on column buono_regalo.fatt_intestatario is
  'privato o azienda: decide quali campi fattura sono stati chiesti e la forma di CessionarioCommittente nell''XML. Scelta dal cliente, validata in fattura.ts.';
comment on column buono_regalo.fatt_sdi is
  'Codice destinatario SdI. Per il privato è sempre 0000000, scritto dal sistema — non un valore che l''ospite possa scegliere.';
