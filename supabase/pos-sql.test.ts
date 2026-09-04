/* ============================================================
   pos-sql.test.ts — la migrazione del POS letta dal sorgente.

   Cio' che deve restare vero nel tempo: le tabelle ci sono tutte, gli id
   sono testo (li genera il palmare, cosi' locale e cloud accettano la
   stessa riga), gli stati sono chiusi da un check, ogni riga allineabile
   porta aggiornato_il, e la migrazione si puo' rilanciare (strumenti/
   migra.js non e' transazionale).
   ============================================================ */
import { assert } from 'jsr:@std/assert';

const S = Deno.readTextFileSync(new URL('./2026-09-04-pos.sql', import.meta.url));
const TABELLE = ['pos_locale', 'pos_zona', 'pos_tavolo', 'pos_categoria', 'pos_articolo', 'pos_variante',
  'pos_preferito', 'pos_cameriere', 'pos_dispositivo', 'pos_sessione', 'pos_conto', 'pos_riga', 'pos_comanda', 'pos_stampa', 'pos_battito'];

Deno.test('le tabelle del POS esistono, ripetibili, con id testo generati dal palmare', () => {
  for (const t of TABELLE) assert(S.includes(`create table if not exists ${t} (`), `manca ${t}`);
  assert(S.includes('id text primary key'), 'gli id sono testo (UUID generati dal palmare), non seriali');
  assert(/pos_riga[\s\S]*stato text not null check \(stato in \('da_inviare', 'inviata', 'partita', 'stornata'\)\)/.test(S));
  assert(/pos_articolo[\s\S]*stampante text check \(stampante in \('cucina', 'bar'\)\)/.test(S));
  assert(/pos_categoria[\s\S]*stampante text not null check \(stampante in \('cucina', 'bar'\)\)/.test(S));
  assert(/pos_stampa[\s\S]*stato text not null default 'da_stampare'/.test(S));
  assert(S.includes('aggiornato_il timestamptz not null default now()'), 'ogni riga allineabile ha aggiornato_il');
  assert(!/alter table|drop table/.test(S), 'solo create if not exists: rieseguibile');
});

Deno.test('le portate sono cinque e sempre le stesse, in categoria, articolo e riga', () => {
  const portate = "('bevande', 'antipasti', 'primi', 'secondi', 'dolci')";
  assert(S.split(portate).length - 1 >= 3, 'la lista delle portate compare nei tre check');
});

Deno.test('niente stampanti fiscali nella migrazione', () => {
  assert(!/8989|8990|fiscal/i.test(S));
});
