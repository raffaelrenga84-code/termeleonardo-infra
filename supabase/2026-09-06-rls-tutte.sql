/* ============================================================
   2026-09-06-rls-tutte.sql — la sicurezza per riga su TUTTE le tabelle.

   Trovato dalla revisione del 6 settembre 2026: ventidue tabelle (fra cui
   pos_cameriere con le impronte dei PIN, pos_dispositivo con i token dei
   palmari, pos_sessione, pos_pacchetto con il codice che il PC del Bistrot
   esegue) erano senza RLS, e la chiave pubblica «anon» — che sta scritta
   nelle pagine — ha i permessi su ogni tabella dello schema. Da PostgREST
   si leggeva e si scriveva tutto, saltando i cancelli delle funzioni.

   Nessuna pagina e nessuna estensione parla con PostgREST: tutto passa
   dalle funzioni, che usano la chiave di servizio e non sono toccate dalla
   RLS. Quindi: RLS accesa, nessuna policy = nessuno entra dalla porta
   pubblica. Vale per tutte le tabelle, anche quelle future: si ripete.
   ============================================================ */
do $$
declare t record;
begin
  for t in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
  loop
    execute format('alter table public.%I enable row level security', t.relname);
  end loop;
end $$;
