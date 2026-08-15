-- Quanto della cache del prompt xAI viene riusato a ogni scambio della chat.
-- Eseguire nel SQL Editor di Supabase (progetto mvuiuwakuseockotlcnp).

-- Il prompt di sistema della chat (regole di canale + Knowledge Base) e' di
-- circa 9.300 token a ogni domanda: se xAI lo riconosce dalla cache
-- (usage.prompt_tokens_details.cached_tokens) c'e' margine di risparmio su
-- tempo e costo, altrimenti no. Nullable: quando il campo non arriva nella
-- risposta del modello non si scrive uno zero inventato, la riga resta
-- senza valore.
alter table chat_messaggio
  add column if not exists cached_tokens integer;

comment on column chat_messaggio.cached_tokens is
  'usage.prompt_tokens_details.cached_tokens dalla risposta di xAI; null se il campo non arriva.';
