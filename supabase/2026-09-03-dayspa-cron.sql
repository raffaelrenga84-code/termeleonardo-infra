-- Ogni cinque minuti: le prenotazioni Day Spa rimaste «in pagamento» oltre i
-- venti minuti diventano «scadute» e restituiscono i posti. Senza questo, un
-- carrello abbandonato terrebbe un posto tutta la sera, e nei giorni pieni
-- «esaurito» lo direbbe a chi avrebbe potuto comprare.
--
-- Stesso schema del cron dei promemoria dei buoni: pg_cron chiama la
-- funzione, e la chiave si legge dal Vault a ogni esecuzione (e' la stessa
-- chiave dei buoni, cron_key_buoni: una chiave sola per i lavori periodici,
-- e la funzione dayspa la confronta con la stessa variabile d'ambiente).
select cron.unschedule('dayspa-scadute') where exists
  (select 1 from cron.job where jobname = 'dayspa-scadute');

select cron.schedule('dayspa-scadute', '*/5 * * * *', $$
  select net.http_post(
    url := 'https://mvuiuwakuseockotlcnp.supabase.co/functions/v1/dayspa?a=scadute',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-cron-key', (select decrypted_secret from vault.decrypted_secrets
                     where name = 'cron_key_buoni')),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
$$);
