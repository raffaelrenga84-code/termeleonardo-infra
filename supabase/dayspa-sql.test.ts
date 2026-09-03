/* ============================================================
   dayspa-sql.test.ts — i file SQL del Day Spa contengono cio' che il codice
   si aspetta. Non eseguono niente: il database in Deno non c'e'. Presidiano
   il caso in cui qualcuno rinomina una colonna nel file e non nel codice, o
   toglie la clausola che rende atomica la presa dei posti.

   Si lancia con:  deno test supabase/dayspa-sql.test.ts --allow-read
   ============================================================ */
import { assert } from 'jsr:@std/assert';

const SQL = Deno.readTextFileSync(new URL('./2026-09-03-dayspa.sql', import.meta.url));
const CRON = Deno.readTextFileSync(new URL('./2026-09-03-dayspa-cron.sql', import.meta.url));

Deno.test('le due tabelle e la sequenza esistono', () => {
  assert(/create table if not exists dayspa_giorno/i.test(SQL));
  assert(/create table if not exists dayspa_prenotazione/i.test(SQL));
  assert(/create sequence if not exists dayspa_numero_seq/i.test(SQL));
  assert(/create or replace function dayspa_prossimo_numero\(\)[\s\S]*nextval\('dayspa_numero_seq'\)/i.test(SQL),
    'la funzione legge il prossimo numero dalla sequenza');
});

Deno.test('i posti si prendono in UNA istruzione, con la condizione dentro l update', () => {
  const f = SQL.match(/create or replace function dayspa_prendi_posti[\s\S]*?\$\$;/i);
  assert(f, 'manca dayspa_prendi_posti');
  assert(
    /update dayspa_giorno[\s\S]*set venduti = venduti \+ p_n[\s\S]*where[\s\S]*posti - venduti >= p_n/i.test(f[0]),
    'la condizione «posti - venduti >= p_n» deve stare nell UPDATE: e quella che impedisce di vendere due volte l ultimo posto',
  );
  assert(/create or replace function dayspa_libera_posti/i.test(SQL), 'manca dayspa_libera_posti');
  assert(/greatest\(0, venduti - p_n\)/i.test(SQL), 'liberare non deve mai portare venduti sotto zero');
});

Deno.test('le colonne che il codice usa ci sono', () => {
  const colonne = ['numero', 'giorno', 'fascia', 'persone', 'adulti', 'bambini', 'importo_cent', 'stato',
    'presenti', 'nome', 'email', 'telefono', 'lingua', 'codice', 'stripe_link', 'stripe_pagamento', 'buono',
    'ricevuta_stato', 'ricevuta_numero', 'creato_il', 'pagato_il', 'scade_il', 'arrivato_il', 'annullato_il', 'prova'];
  assert(colonne.length > 20);
  for (const c of colonne) assert(new RegExp(`\\b${c}\\b`).test(SQL), `manca la colonna ${c}`);
});

Deno.test('lo stato ammette solo i cinque valori della specifica', () => {
  assert(/stato\s+text not null[\s\S]*?check \(stato in \('in_pagamento', 'pagata', 'annullata', 'rimborsata', 'scaduta'\)\)/i.test(SQL));
});

Deno.test('la ricevuta parte «da battere»: la coda si riempie anche prima della fase 3', () => {
  assert(/ricevuta_stato\s+text not null default 'da_battere'/i.test(SQL));
});

Deno.test('il cron chiama ?a=scadute ogni cinque minuti con la chiave dal Vault', () => {
  assert(/cron\.schedule\(\s*'dayspa-scadute'/.test(CRON));
  assert(/\*\/5 \* \* \* \*/.test(CRON));
  assert(/functions\/v1\/dayspa\?a=scadute/.test(CRON));
  assert(/x-cron-key/.test(CRON));
  assert(/vault\.decrypted_secrets/.test(CRON), 'la chiave si legge dal Vault, non si scrive nel file');
});
