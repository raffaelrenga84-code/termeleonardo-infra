-- Il lavoro giornaliero dei promemoria: ogni mattina alle 7:15 ora italiana.
-- pg_cron ragiona in UTC: d'estate l'Italia e' UTC+2, d'inverno UTC+1, quindi
-- l'ora locale oscilla di un'ora fra le 6:15 e le 7:15. Va benissimo: e' un
-- promemoria, non un treno. Quello che conta e' che giri PRIMA che la
-- reception apra, cosi' se qualcuno chiama avendo appena letto l'email,
-- in reception il buono e' gia' li'.
select cron.unschedule('promemoria-buoni') where exists
  (select 1 from cron.job where jobname = 'promemoria-buoni');

select cron.schedule('promemoria-buoni', '15 5 * * *', $$
  select net.http_post(
    url := 'https://mvuiuwakuseockotlcnp.supabase.co/functions/v1/buoni?a=promemoria',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      -- la chiave si legge dal Vault a ogni esecuzione: non e' scritta qui,
      -- e questa riga puo' finire in un backup senza portarsela dietro
      'x-cron-key', (select decrypted_secret from vault.decrypted_secrets
                     where name = 'cron_key_buoni')),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
$$);
