-- 2026-09-04-pos-cron.sql — ogni minuto il cloud controlla le comande da
-- stampare: le stampa lui SOLO se il PC del Bistrot tace da 90 secondi
-- (pos?a=stampa-cloud). Stessa chiave del cron dei buoni (vault
-- cron_key_buoni = secret CRON_KEY della funzione). Ripetibile.
select cron.unschedule('pos-stampa-cloud') where exists
  (select 1 from cron.job where jobname = 'pos-stampa-cloud');

select cron.schedule('pos-stampa-cloud', '* * * * *', $$
  select net.http_post(
    url := 'https://mvuiuwakuseockotlcnp.supabase.co/functions/v1/pos?a=stampa-cloud',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-cron-key', (select decrypted_secret from vault.decrypted_secrets
                     where name = 'cron_key_buoni')),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
$$);
