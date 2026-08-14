-- Buoni regalo — due voci con quantità
-- Eseguire nel SQL Editor di Supabase (progetto mvuiuwakuseockotlcnp).

-- La scelta dell'ospite in forma leggibile da una macchina: descrizione e
-- valore continuano a portare il testo composto e il totale, che sono cio'
-- che leggono email, stampa e back office. Questa colonna serve a sapere
-- COSA e' stato scelto senza dover interpretare del testo.
alter table buono_regalo
  add column if not exists voci jsonb;

comment on column buono_regalo.voci is
  'Elenco [{voce_id, quantita}]. Null per i buoni monetari.';
