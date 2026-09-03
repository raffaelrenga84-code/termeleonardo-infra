# Day Spa online, fase 1: gli ingressi — piano di lavoro

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un ospite compra un ingresso Day Spa (giornaliero o serale) su una pagina nostra, paga con Stripe, riceve un QR per email; la reception carica i posti settimanali nel back office, vede gli arrivi del giorno e segna i presenti con lo scanner. Tutto su una pagina nascosta con Stripe in modalità di prova.

**Architecture:** Una funzione Supabase nuova, `dayspa`, con i moduli puri (listino, tipo del giorno, stato dei posti, numerazione) separati da `index.ts` che parla col database, con Stripe e con Resend; due tabelle (`dayspa_giorno`, `dayspa_prenotazione`) e una funzione SQL che toglie i posti in un'istruzione sola; una pagina `pagine/dayspa/` che riusa il calendario comune; tre schede nuove nel back office. Le ricevute fiscali (fase 3) e gli abbonamenti (fase 2) restano fuori: la prenotazione pagata finisce in una coda `ricevuta_stato = 'da_battere'` che per ora nessuno svuota.

**Tech Stack:** Deno (Supabase Edge Functions, prove con `deno test`), Postgres (Supabase), Stripe Payment Links + webhook, Resend, HTML/JS senza framework per pagina e back office (come i moduli esistenti), Vercel (riscritture in `termeleonardo/frontend/vercel.json`).

## Global Constraints

- Specifica: `docs/superpowers/specs/2026-09-03-day-spa-online-design.md`. Le decisioni della proprietà del 3 settembre 2026 non si rimettono in discussione qui.
- Prezzi, in centesimi: giornaliero feriale 3500, giornaliero prefestivo/festivo 4500, serale 2900. Persone da 1 a 8 (`PERSONE_DAYSPA_MAX = 8`, già in `supabase/functions/richieste/tipi.ts`). Bambini dai 2 anni prezzo pieno. Ingressi pagati non annullabili né rimborsabili dall'ospite.
- Fasce: `giornaliero` (9:00–18:30, tutti i giorni) e `serale` (18:00–22:30, solo venerdì e sabato).
- Da qui **non esce mai il numero dei posti**: la pagina riceve uno stato (`chiuso`, `non-in-vendita`, `esaurito`, `ultimi`, `disponibile`); `ultimi` quando restano 5 posti o meno.
- Una prenotazione in `in_pagamento` tiene i posti per **20 minuti**; poi scade e li restituisce.
- Nessuna regola scritta due volte: il listino sta in `listino.ts` e la pagina lo riceve dal server. Dove una copia è inevitabile (un aiutante copiato da `buoni/`), una prova incrociata la tiene identica.
- Ogni prova deve poter fallire: prima di asserire su un elenco si asserisce che non è vuoto.
- Niente verifiche di invii riusciti in produzione; si verificano i rifiuti. Nessuna prova tocca la stampante fiscale (decisione della proprietà).
- La chiave di servizio è in mano alla funzione: il cancello è il codice, non le regole del database.
- Stile del repository: commenti in italiano che dicono il perché, apostrofi dritti nei file di prova, `deno test <cartella> --allow-read --allow-env` dalla radice.
- Ogni cartella nuova sotto `pagine/` vuole la sua riga di passaggio in `termeleonardo/frontend/vercel.json` (vedi `pagine/README.md`); gli import nelle pagine sono assoluti (`/comune/...`).
- Commit su `main`, uno per compito, con il messaggio che dice cosa cambia per chi usa il sito.

---

## Struttura dei file

**Da creare**
- `supabase/2026-09-03-dayspa.sql` — tabelle, funzione `dayspa_prendi_posti`, `dayspa_libera_posti`, sequenza per il numero.
- `supabase/functions/dayspa/deno.json` — come `buoni/deno.json`.
- `supabase/functions/dayspa/listino.ts` (+ `.test.ts`) — fasce, prezzi, tipo del giorno, feste, totale.
- `supabase/functions/dayspa/posti.ts` (+ `.test.ts`) — stato di un giorno per la pagina, scadenza delle prenotazioni in pagamento, numero e codice.
- `supabase/functions/dayspa/validazione.ts` (+ `.test.ts`) — il corpo di `?a=prenota`, validato.
- `supabase/functions/dayspa/email-dayspa.ts` (+ `.test.ts`) — conferma con QR, quattro lingue.
- `supabase/functions/dayspa/stripe.ts` (+ `.test.ts`) — i parametri del link di pagamento e la verifica della firma (copiati da `buoni/index.ts`, con prova incrociata).
- `supabase/functions/dayspa/qr.js` — copia di `buoni/qr.js` (prova incrociata).
- `supabase/functions/dayspa/index.ts` — le azioni.
- `pagine/dayspa/index.html` — la pagina dell'ospite.
- `pagine/dayspa/testi.js` (+ `.test.ts`) — i testi della pagina, quattro lingue.
- `pagine/dayspa/pagina.test.ts` — prove sul sorgente della pagina.

**Da modificare**
- `pagine/comune/calendario.js` — un gancio `statoExtra(iso)` per i giorni esauriti e non in vendita, con legenda; `pagine/comune/calendario.test.ts`.
- `pagine/buoni/index.html` — tre schede: `dayspaOggi`, `dayspaDisponibilita`, `dayspaPrenotazioni`; `ORDINE_SCHEDE`; `pagine/buoni/schede.test.ts`.
- `pagine/indicizzazione.test.ts` — `dayspa/index.html` fra le NASCOSTE finché è di prova.
- `termeleonardo/frontend/vercel.json` — riga `/dayspa/:percorso*`; `termeleonardo/frontend/public/robots.txt` — `Disallow: /dayspa/`.
- `supabase/2026-09-03-dayspa-cron.sql` — il lavoro periodico che scade le prenotazioni in pagamento (stesso schema di `supabase/2026-08-15-cron-promemoria.sql`).

---

### Task 1: Le tabelle e la funzione che toglie i posti in un'istruzione sola

**Files:**
- Create: `supabase/2026-09-03-dayspa.sql`
- Create: `supabase/dayspa-sql.test.ts`

**Interfaces:**
- Produces: tabella `dayspa_giorno(giorno date, fascia text, tipo text, posti int, venduti int, prezzo_cent int, note text, primary key (giorno, fascia))`; tabella `dayspa_prenotazione` (colonne sotto); funzione `dayspa_prendi_posti(p_giorno date, p_fascia text, p_n int) returns boolean`; funzione `dayspa_libera_posti(p_giorno date, p_fascia text, p_n int) returns void`; sequenza `dayspa_numero_seq`.

- [ ] **Step 1: Scrivere la prova sul sorgente SQL**

`supabase/dayspa-sql.test.ts`:

```ts
/* ============================================================
   dayspa-sql.test.ts — il file SQL del Day Spa contiene cio' che il codice
   si aspetta. Non esegue niente: il database in Deno non c'e'. Presidia
   il caso in cui qualcuno rinomina una colonna nel file e non nel codice,
   o toglie la clausola che rende atomica la presa dei posti.
   ============================================================ */
import { assert } from 'jsr:@std/assert';

const SQL = Deno.readTextFileSync(new URL('./2026-09-03-dayspa.sql', import.meta.url));

Deno.test('le due tabelle e la sequenza esistono', () => {
  assert(/create table if not exists dayspa_giorno/i.test(SQL));
  assert(/create table if not exists dayspa_prenotazione/i.test(SQL));
  assert(/create sequence if not exists dayspa_numero_seq/i.test(SQL));
});

Deno.test('i posti si prendono in UNA istruzione, con la condizione dentro l update', () => {
  const f = SQL.match(/create or replace function dayspa_prendi_posti[\s\S]*?\$\$;/i);
  assert(f, 'manca dayspa_prendi_posti');
  assert(/update dayspa_giorno[\s\S]*set venduti = venduti \+ p_n[\s\S]*where[\s\S]*posti - venduti >= p_n/i.test(f[0]),
    'la condizione «posti - venduti >= p_n» deve stare nell UPDATE: e quella che impedisce di vendere due volte l ultimo posto');
});

Deno.test('le colonne che il codice usa ci sono', () => {
  for (const c of ['numero', 'giorno', 'fascia', 'persone', 'adulti', 'bambini', 'importo_cent', 'stato',
    'presenti', 'nome', 'email', 'telefono', 'lingua', 'codice', 'stripe_link', 'stripe_pagamento',
    'ricevuta_stato', 'ricevuta_numero', 'creato_il', 'pagato_il', 'scade_il', 'arrivato_il', 'prova']) {
    assert(new RegExp(`\\b${c}\\b`).test(SQL), `manca la colonna ${c}`);
  }
});

Deno.test('lo stato ammette solo i cinque valori della specifica', () => {
  assert(/stato text not null[\s\S]*check \(stato in \('in_pagamento', 'pagata', 'annullata', 'rimborsata', 'scaduta'\)\)/i.test(SQL));
});
```

- [ ] **Step 2: Eseguire la prova e vederla fallire**

Run: `deno test supabase/dayspa-sql.test.ts --allow-read`
Expected: FAIL, «No such file» sul file SQL.

- [ ] **Step 3: Scrivere il file SQL**

`supabase/2026-09-03-dayspa.sql`:

```sql
-- ============================================================
-- Il Day Spa venduto da noi: i posti di ogni giorno e le prenotazioni.
--
-- PERCHE' I POSTI STANNO QUI E NON IN FIDRA. Dal 3 settembre 2026 la
-- vendita online e' nostra: due copie dei posti (una qui, una in Fidra)
-- divergerebbero alla prima vendita. La reception li carica ogni settimana
-- dal back office, come faceva in Fidra.
--
-- PERCHE' UNA FUNZIONE E NON DUE ISTRUZIONI. «Leggi i posti liberi, e se
-- bastano scrivi venduti+n» sono due istruzioni: fra la prima e la seconda
-- un altro ospite puo' aver comprato gli stessi posti. dayspa_prendi_posti
-- mette la condizione DENTRO l'UPDATE: Postgres serializza le due scritture
-- sulla stessa riga, e una sola delle due trova la condizione vera.
--
-- Si esegue una volta nel pannello Supabase (SQL editor), come gli altri
-- file di questa cartella.
-- ============================================================

create table if not exists dayspa_giorno (
  giorno      date not null,
  fascia      text not null check (fascia in ('giornaliero', 'serale')),
  tipo        text not null check (tipo in ('feriale', 'prefestivo', 'festivo')),
  posti       int  not null check (posti >= 0),
  venduti     int  not null default 0 check (venduti >= 0),
  prezzo_cent int  not null check (prezzo_cent > 0),
  note        text,
  aggiornato_il timestamptz not null default now(),
  primary key (giorno, fascia)
);

create sequence if not exists dayspa_numero_seq;

create table if not exists dayspa_prenotazione (
  id            bigserial primary key,
  numero        text not null unique,           -- DS-2026-0001
  giorno        date not null,
  fascia        text not null,
  persone       int  not null check (persone between 1 and 8),
  adulti        int  not null,
  bambini       int  not null default 0,
  importo_cent  int  not null,
  stato         text not null default 'in_pagamento'
                check (stato in ('in_pagamento', 'pagata', 'annullata', 'rimborsata', 'scaduta')),
  presenti      int  not null default 0,
  nome          text not null,
  email         text not null,
  telefono      text,
  lingua        text not null default 'it',
  codice        text not null unique,           -- il contenuto del QR
  stripe_link   text,                           -- id del payment link
  stripe_pagamento text,                        -- payment_intent, per il rimborso
  buono         text,                           -- numero del buono regalo, se ha pagato con quello
  ricevuta_stato  text not null default 'da_battere'
                check (ricevuta_stato in ('da_battere', 'battuta', 'errore', 'non_richiesta')),
  ricevuta_numero text,
  ricevuta_il     timestamptz,
  ricevuta_errore text,
  prova         boolean not null default false, -- Stripe in modalita' di prova
  creato_il     timestamptz not null default now(),
  scade_il      timestamptz,                    -- fine dei 20 minuti di in_pagamento
  pagato_il     timestamptz,
  arrivato_il   timestamptz,
  annullato_il  timestamptz,
  foreign key (giorno, fascia) references dayspa_giorno (giorno, fascia)
);

create index if not exists dayspa_prenotazione_giorno on dayspa_prenotazione (giorno, fascia);
create index if not exists dayspa_prenotazione_stato on dayspa_prenotazione (stato, scade_il);

-- Vero se i posti sono stati presi, falso se non bastavano. Una riga sola.
create or replace function dayspa_prendi_posti(p_giorno date, p_fascia text, p_n int)
returns boolean language plpgsql as $$
declare presi int;
begin
  update dayspa_giorno
     set venduti = venduti + p_n, aggiornato_il = now()
   where giorno = p_giorno and fascia = p_fascia and posti - venduti >= p_n;
  get diagnostics presi = row_count;
  return presi = 1;
end;
$$;

-- Restituisce i posti di una prenotazione scaduta o annullata. Mai sotto zero.
create or replace function dayspa_libera_posti(p_giorno date, p_fascia text, p_n int)
returns void language plpgsql as $$
begin
  update dayspa_giorno
     set venduti = greatest(0, venduti - p_n), aggiornato_il = now()
   where giorno = p_giorno and fascia = p_fascia;
end;
$$;
```

- [ ] **Step 4: Eseguire la prova e vederla passare**

Run: `deno test supabase/dayspa-sql.test.ts --allow-read`
Expected: PASS, 4 prove.

- [ ] **Step 5: Commit**

```bash
git add supabase/2026-09-03-dayspa.sql supabase/dayspa-sql.test.ts
git commit -m "Day Spa: le tabelle dei posti e delle prenotazioni, e la presa dei posti in una istruzione sola"
```

*Nota per la proprietà:* il file va eseguito nel pannello Supabase (SQL editor) del progetto `mvuiuwakuseockotlcnp` prima del Task 5. Fino ad allora la funzione risponde «tabella mancante».

---

### Task 2: Il listino e il tipo del giorno

**Files:**
- Create: `supabase/functions/dayspa/deno.json`, `supabase/functions/dayspa/listino.ts`, `supabase/functions/dayspa/listino.test.ts`

**Interfaces:**
- Produces: `FASCE = ['giornaliero','serale']`, `TIPI = ['feriale','prefestivo','festivo']`, `PERSONE_MAX = 8`, `SOGLIA_ULTIMI = 5`, `tipoDelGiorno(iso: string): 'feriale'|'prefestivo'|'festivo'`, `fasceDelGiorno(iso): Fascia[]`, `prezzoCent(tipo, fascia): number`, `totaleCent(tipo, fascia, persone): number`, `ORARI = { giornaliero: '9:00–18:30', serale: '18:00–22:30' }`, `pasqua(anno): string`.

- [ ] **Step 1: Scrivere le prove**

`supabase/functions/dayspa/listino.test.ts`:

```ts
/* ============================================================
   listino.test.ts — prezzi e fasce del Day Spa, l'unica copia.
   I prezzi sono quelli del sito il 3 settembre 2026: 35 feriale, 45
   prefestivo e festivo, 29 serale. Il tipo del giorno lo dice il
   calendario: sabato prefestivo, domenica e feste festivo. Pasqua si
   calcola, non si scrive a mano ogni anno.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';
import { fasceDelGiorno, pasqua, prezzoCent, tipoDelGiorno, totaleCent, PERSONE_MAX } from './listino.ts';

Deno.test('un mercoledi e feriale, un sabato prefestivo, una domenica festivo', () => {
  assertEquals(tipoDelGiorno('2026-09-09'), 'feriale');
  assertEquals(tipoDelGiorno('2026-09-05'), 'prefestivo');
  assertEquals(tipoDelGiorno('2026-09-06'), 'festivo');
});

Deno.test('le feste nazionali sono festivo anche in settimana', () => {
  assertEquals(tipoDelGiorno('2026-12-08'), 'festivo');   // Immacolata, martedi
  assertEquals(tipoDelGiorno('2026-04-06'), 'festivo');   // Pasquetta 2026
  assertEquals(tipoDelGiorno('2026-06-02'), 'festivo');   // Repubblica
  assertEquals(tipoDelGiorno('2026-08-15'), 'festivo');
});

Deno.test('Pasqua si calcola: 2026 il 5 aprile, 2027 il 28 marzo', () => {
  assertEquals(pasqua(2026), '2026-04-05');
  assertEquals(pasqua(2027), '2027-03-28');
});

Deno.test('la vigilia di una festa in settimana e prefestivo', () => {
  assertEquals(tipoDelGiorno('2026-12-07'), 'prefestivo');  // lunedi prima dell Immacolata
});

Deno.test('il serale c e solo venerdi e sabato', () => {
  assertEquals(fasceDelGiorno('2026-09-04'), ['giornaliero', 'serale']);  // venerdi
  assertEquals(fasceDelGiorno('2026-09-05'), ['giornaliero', 'serale']);  // sabato
  assertEquals(fasceDelGiorno('2026-09-06'), ['giornaliero']);            // domenica
  assertEquals(fasceDelGiorno('2026-09-09'), ['giornaliero']);
});

Deno.test('i prezzi sono quelli del sito, in centesimi', () => {
  assertEquals(prezzoCent('feriale', 'giornaliero'), 3500);
  assertEquals(prezzoCent('prefestivo', 'giornaliero'), 4500);
  assertEquals(prezzoCent('festivo', 'giornaliero'), 4500);
  assertEquals(prezzoCent('feriale', 'serale'), 2900);
  assertEquals(prezzoCent('festivo', 'serale'), 2900);
});

Deno.test('il totale e prezzo per persone, e sopra il massimo si rifiuta', () => {
  assertEquals(totaleCent('feriale', 'giornaliero', 2), 7000);
  assertEquals(PERSONE_MAX, 8);
  let errore = '';
  try { totaleCent('feriale', 'giornaliero', 9); } catch (e) { errore = String(e); }
  assert(/persone/.test(errore), 'nove persone dovevano essere rifiutate');
});
```

- [ ] **Step 2: Eseguire e vedere fallire**

Run: `deno test supabase/functions/dayspa/listino.test.ts --allow-read`
Expected: FAIL, modulo `./listino.ts` mancante.

- [ ] **Step 3: Scrivere `deno.json` e `listino.ts`**

`supabase/functions/dayspa/deno.json`: copiare `supabase/functions/buoni/deno.json` tale e quale.

`supabase/functions/dayspa/listino.ts`:

```ts
/* Il listino del Day Spa: l'unica copia. La pagina lo riceve da ?a=listino
   e il server lo usa per il totale: un prezzo cambiato qui cambia ovunque.
   Prezzi del sito il 3 settembre 2026, decisi dalla proprieta'. */

export type Fascia = 'giornaliero' | 'serale';
export type Tipo = 'feriale' | 'prefestivo' | 'festivo';

export const FASCE: Fascia[] = ['giornaliero', 'serale'];
export const TIPI: Tipo[] = ['feriale', 'prefestivo', 'festivo'];
export const PERSONE_MAX = 8;      // come PERSONE_DAYSPA_MAX in richieste/tipi.ts
export const SOGLIA_ULTIMI = 5;    // «ultimi posti» da qui in giu'

export const ORARI: Record<Fascia, string> = { giornaliero: '9:00–18:30', serale: '18:00–22:30' };

const PREZZI_CENT: Record<Fascia, Record<Tipo, number>> = {
  giornaliero: { feriale: 3500, prefestivo: 4500, festivo: 4500 },
  serale:      { feriale: 2900, prefestivo: 2900, festivo: 2900 },
};

export function prezzoCent(tipo: Tipo, fascia: Fascia): number {
  return PREZZI_CENT[fascia][tipo];
}

export function totaleCent(tipo: Tipo, fascia: Fascia, persone: number): number {
  if (!Number.isInteger(persone) || persone < 1 || persone > PERSONE_MAX) {
    throw new Error(`persone fuori dall intervallo 1-${PERSONE_MAX}`);
  }
  return prezzoCent(tipo, fascia) * persone;
}

/* Pasqua col metodo di Gauss (algoritmo di Meeus): torna AAAA-MM-GG. */
export function pasqua(anno: number): string {
  const a = anno % 19, b = Math.floor(anno / 100), c = anno % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mese = Math.floor((h + l - 7 * m + 114) / 31);
  const giorno = ((h + l - 7 * m + 114) % 31) + 1;
  return `${anno}-${String(mese).padStart(2, '0')}-${String(giorno).padStart(2, '0')}`;
}

const giornoDopo = (iso: string): string => {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

/* Le feste nazionali italiane: fisse piu' Pasqua e Pasquetta. */
export function eFesta(iso: string): boolean {
  const [anno, mmgg] = [Number(iso.slice(0, 4)), iso.slice(5)];
  const fisse = ['01-01', '01-06', '04-25', '05-01', '06-02', '08-15', '11-01', '12-08', '12-25', '12-26'];
  if (fisse.includes(mmgg)) return true;
  const p = pasqua(anno);
  return iso === p || iso === giornoDopo(p);
}

const giornoSettimana = (iso: string): number => new Date(iso + 'T12:00:00Z').getUTCDay(); // 0 domenica

/* Domenica e feste: festivo. Sabato e vigilie di festa: prefestivo. Il resto
   feriale. La reception puo' correggere il singolo giorno nella scheda. */
export function tipoDelGiorno(iso: string): Tipo {
  const g = giornoSettimana(iso);
  if (g === 0 || eFesta(iso)) return 'festivo';
  if (g === 6 || eFesta(giornoDopo(iso))) return 'prefestivo';
  return 'feriale';
}

/* Il serale c'e' venerdi e sabato. */
export function fasceDelGiorno(iso: string): Fascia[] {
  const g = giornoSettimana(iso);
  return g === 5 || g === 6 ? ['giornaliero', 'serale'] : ['giornaliero'];
}
```

- [ ] **Step 4: Eseguire e vedere passare**

Run: `deno test supabase/functions/dayspa/listino.test.ts --allow-read`
Expected: PASS, 7 prove.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/dayspa/deno.json supabase/functions/dayspa/listino.ts supabase/functions/dayspa/listino.test.ts
git commit -m "Day Spa: il listino e il tipo del giorno, con Pasqua calcolata"
```

---

### Task 3: Lo stato dei posti, il numero e il codice

**Files:**
- Create: `supabase/functions/dayspa/posti.ts`, `supabase/functions/dayspa/posti.test.ts`

**Interfaces:**
- Consumes: `SOGLIA_ULTIMI` da `listino.ts`.
- Produces: `type Stato = 'chiuso'|'non-in-vendita'|'esaurito'|'ultimi'|'disponibile'`; `statoPosti(riga: {posti:number, venduti:number}|null, chiuso: boolean): Stato`; `MINUTI_PAGAMENTO = 20`; `scadenza(adesso: Date): string` (ISO); `eScaduta(scadeIl: string, adesso: Date): boolean`; `numeroPrenotazione(anno: number, progressivo: number): string`; `codicePrenotazione(casuale: () => number): string` (10 caratteri, senza 0/O/1/I).

- [ ] **Step 1: Scrivere le prove**

```ts
/* ============================================================
   posti.test.ts — la parola detta all'ospite, e i venti minuti.
   Da qui non esce mai il numero dei posti: solo uno stato. «ultimi» sotto
   la soglia, mai il numero. Il codice del QR non ha caratteri che si
   confondono a voce al telefono (0/O, 1/I).
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';
import { codicePrenotazione, eScaduta, numeroPrenotazione, scadenza, statoPosti, MINUTI_PAGAMENTO } from './posti.ts';

Deno.test('stato dei posti', () => {
  assertEquals(statoPosti(null, true), 'chiuso');
  assertEquals(statoPosti(null, false), 'non-in-vendita');
  assertEquals(statoPosti({ posti: 40, venduti: 40 }, false), 'esaurito');
  assertEquals(statoPosti({ posti: 40, venduti: 36 }, false), 'ultimi');
  assertEquals(statoPosti({ posti: 40, venduti: 35 }, false), 'ultimi');
  assertEquals(statoPosti({ posti: 40, venduti: 34 }, false), 'disponibile');
  assertEquals(statoPosti({ posti: 40, venduti: 10 }, true), 'chiuso', 'chiuso vince su tutto');
});

Deno.test('la scadenza e venti minuti dopo, e si legge con lo stesso orologio', () => {
  const adesso = new Date('2026-09-10T10:00:00Z');
  assertEquals(MINUTI_PAGAMENTO, 20);
  assertEquals(scadenza(adesso), '2026-09-10T10:20:00.000Z');
  assert(!eScaduta(scadenza(adesso), new Date('2026-09-10T10:19:59Z')));
  assert(eScaduta(scadenza(adesso), new Date('2026-09-10T10:20:01Z')));
});

Deno.test('il numero e DS-anno-progressivo a quattro cifre', () => {
  assertEquals(numeroPrenotazione(2026, 1), 'DS-2026-0001');
  assertEquals(numeroPrenotazione(2026, 12345), 'DS-2026-12345');
});

Deno.test('il codice ha dieci caratteri senza 0, O, 1, I', () => {
  const c = codicePrenotazione(Math.random);
  assertEquals(c.length, 10);
  assert(/^[A-HJ-NP-Z2-9]{10}$/.test(c), c);
  /* con un casuale fisso il codice e' deterministico: si puo' provare */
  assertEquals(codicePrenotazione(() => 0), 'AAAAAAAAAA');
});
```

- [ ] **Step 2: Eseguire e vedere fallire** — Run: `deno test supabase/functions/dayspa/posti.test.ts --allow-read` — Expected: FAIL, modulo mancante.

- [ ] **Step 3: Scrivere `posti.ts`**

```ts
import { SOGLIA_ULTIMI } from './listino.ts';

export type Stato = 'chiuso' | 'non-in-vendita' | 'esaurito' | 'ultimi' | 'disponibile';

/* La parola per l'ospite. `riga` e' la riga di dayspa_giorno, o null se la
   reception non ha ancora caricato quel giorno. Chiuso vince su tutto. */
export function statoPosti(riga: { posti: number; venduti: number } | null, chiuso: boolean): Stato {
  if (chiuso) return 'chiuso';
  if (!riga) return 'non-in-vendita';
  const liberi = riga.posti - riga.venduti;
  if (liberi <= 0) return 'esaurito';
  return liberi <= SOGLIA_ULTIMI ? 'ultimi' : 'disponibile';
}

export const MINUTI_PAGAMENTO = 20;

export function scadenza(adesso: Date): string {
  return new Date(adesso.getTime() + MINUTI_PAGAMENTO * 60_000).toISOString();
}

export function eScaduta(scadeIl: string, adesso: Date): boolean {
  return new Date(scadeIl).getTime() < adesso.getTime();
}

export function numeroPrenotazione(anno: number, progressivo: number): string {
  return `DS-${anno}-${String(progressivo).padStart(4, '0')}`;
}

/* Senza 0/O e 1/I: si legge a voce al telefono senza equivoci. */
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function codicePrenotazione(casuale: () => number = Math.random): string {
  let s = '';
  for (let i = 0; i < 10; i++) s += ALFABETO[Math.floor(casuale() * ALFABETO.length) % ALFABETO.length];
  return s;
}
```

- [ ] **Step 4: Eseguire e vedere passare** — Expected: PASS, 4 prove.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/dayspa/posti.ts supabase/functions/dayspa/posti.test.ts
git commit -m "Day Spa: lo stato dei posti detto in una parola, la scadenza dei venti minuti, numero e codice"
```

---

### Task 4: La validazione della prenotazione

**Files:**
- Create: `supabase/functions/dayspa/validazione.ts`, `supabase/functions/dayspa/validazione.test.ts`

**Interfaces:**
- Consumes: `fasceDelGiorno`, `PERSONE_MAX` da `listino.ts`.
- Produces: `validaPrenotazione(corpo: unknown, oggi: string): { errore?: string; dati?: DatiPrenotazione }` con `DatiPrenotazione = { giorno, fascia, adulti, bambini, persone, nome, email, telefono, lingua, buono? }`; `LINGUE = ['it','de','en','fr']`.

- [ ] **Step 1: Scrivere le prove**

```ts
/* ============================================================
   validazione.test.ts — cosa entra in una prenotazione, e cosa no.
   Stesse regole del modulo richieste per il Day Spa: data ISO, oggi
   ammesso, passato no, persone 1-8 fra adulti e bambini, email con una
   chiocciola, nome non vuoto, lingua fra le quattro o italiano.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';
import { validaPrenotazione } from './validazione.ts';

const buono = { giorno: '2026-09-12', fascia: 'giornaliero', adulti: 2, bambini: 1, nome: 'Maria Rossi', email: 'maria@esempio.it', telefono: '333 1234567', lingua: 'it' };
const OGGI = '2026-09-10';

Deno.test('una prenotazione buona passa, con persone = adulti + bambini', () => {
  const v = validaPrenotazione(buono, OGGI);
  assertEquals(v.errore, undefined);
  assertEquals(v.dati?.persone, 3);
  assertEquals(v.dati?.fascia, 'giornaliero');
});

Deno.test('oggi si puo, ieri no, una data impossibile no', () => {
  assertEquals(validaPrenotazione({ ...buono, giorno: OGGI }, OGGI).errore, undefined);
  assert(validaPrenotazione({ ...buono, giorno: '2026-09-09' }, OGGI).errore);
  assert(validaPrenotazione({ ...buono, giorno: '9999-99-99' }, OGGI).errore);
});

Deno.test('il serale di un mercoledi non esiste', () => {
  assert(/serale/.test(validaPrenotazione({ ...buono, giorno: '2026-09-16', fascia: 'serale' }, OGGI).errore ?? ''));
});

Deno.test('almeno un adulto, al massimo otto persone', () => {
  assert(validaPrenotazione({ ...buono, adulti: 0, bambini: 2 }, OGGI).errore);
  assert(validaPrenotazione({ ...buono, adulti: 5, bambini: 4 }, OGGI).errore);
  assertEquals(validaPrenotazione({ ...buono, adulti: 5, bambini: 3 }, OGGI).errore, undefined);
});

Deno.test('nome ed email servono; la lingua sconosciuta diventa italiano', () => {
  assert(validaPrenotazione({ ...buono, nome: ' ' }, OGGI).errore);
  assert(validaPrenotazione({ ...buono, email: 'senza-chiocciola' }, OGGI).errore);
  assertEquals(validaPrenotazione({ ...buono, lingua: 'xx' }, OGGI).dati?.lingua, 'it');
});

Deno.test('un corpo che non e un oggetto e un errore, non un crollo', () => {
  assert(validaPrenotazione(null, OGGI).errore);
  assert(validaPrenotazione('ciao', OGGI).errore);
});
```

- [ ] **Step 2: Eseguire e vedere fallire.**

- [ ] **Step 3: Scrivere `validazione.ts`**

```ts
import { fasceDelGiorno, PERSONE_MAX, type Fascia } from './listino.ts';

export const LINGUE = ['it', 'de', 'en', 'fr'];
const ISO = /^\d{4}-\d{2}-\d{2}$/;

export type DatiPrenotazione = {
  giorno: string; fascia: Fascia; adulti: number; bambini: number; persone: number;
  nome: string; email: string; telefono: string; lingua: string; buono?: string;
};

const intero = (v: unknown): number => (typeof v === 'number' || typeof v === 'string') && /^\d+$/.test(String(v)) ? Number(v) : NaN;

function dataValida(iso: string): boolean {
  if (!ISO.test(iso)) return false;
  const d = new Date(iso + 'T12:00:00Z');
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso;
}

export function validaPrenotazione(corpo: unknown, oggi: string): { errore?: string; dati?: DatiPrenotazione } {
  if (!corpo || typeof corpo !== 'object') return { errore: 'richiesta vuota' };
  const b = corpo as Record<string, unknown>;
  const giorno = String(b.giorno ?? '');
  if (!dataValida(giorno)) return { errore: 'data non valida' };
  if (giorno < oggi) return { errore: 'la data e passata' };
  const fascia = String(b.fascia ?? '') as Fascia;
  if (!fasceDelGiorno(giorno).includes(fascia)) return { errore: `la fascia ${fascia || '?'} non esiste in quel giorno (il serale c e venerdi e sabato)` };
  const adulti = intero(b.adulti), bambini = b.bambini === undefined ? 0 : intero(b.bambini);
  if (!(adulti >= 1)) return { errore: 'serve almeno un adulto' };
  if (!(bambini >= 0)) return { errore: 'bambini non valido' };
  const persone = adulti + bambini;
  if (persone > PERSONE_MAX) return { errore: `al massimo ${PERSONE_MAX} persone: per un gruppo scriva alla reception` };
  const nome = String(b.nome ?? '').trim();
  if (!nome) return { errore: 'manca il nome' };
  const email = String(b.email ?? '').trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { errore: 'email non valida' };
  const telefono = String(b.telefono ?? '').trim().slice(0, 40);
  const lingua = LINGUE.includes(String(b.lingua)) ? String(b.lingua) : 'it';
  const buono = b.buono ? String(b.buono).trim().toUpperCase().slice(0, 32) : undefined;
  return { dati: { giorno, fascia, adulti, bambini, persone, nome: nome.slice(0, 120), email: email.slice(0, 160), telefono, lingua, buono } };
}
```

- [ ] **Step 4: Eseguire e vedere passare** — Expected: PASS, 6 prove.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/dayspa/validazione.ts supabase/functions/dayspa/validazione.test.ts
git commit -m "Day Spa: cosa entra in una prenotazione, e cosa no"
```

---

### Task 5: Stripe e QR, copiati dai buoni con la prova incrociata

**Files:**
- Create: `supabase/functions/dayspa/stripe.ts`, `supabase/functions/dayspa/stripe.test.ts`, `supabase/functions/dayspa/qr.js`, `supabase/functions/dayspa/copie.test.ts`

**Interfaces:**
- Produces: `parametriLink(p: { numero, descrizione, importoCent, redirect }): Record<string,string>` (puro: il corpo di `POST /v1/payment_links` piu' il prezzo); `firmaValida(grezzo: string, intestazione: string|null, segreto: string): Promise<boolean>` (copiata da `buoni/index.ts`, righe 132-157, resa pura con il segreto come parametro); `chiaveStripe(prova: boolean): string|undefined` (`STRIPE_PROVA_KEY` se prova, altrimenti `STRIPE_RESTRICTED_KEY`); `qr.js` identico a `buoni/qr.js`.

- [ ] **Step 1: Scrivere le prove**

`stripe.test.ts`:

```ts
import { assert, assertEquals } from 'jsr:@std/assert';
import { firmaValida, parametriLink } from './stripe.ts';

Deno.test('il link e a uso singolo, porta il numero nei metadati e torna alla pagina di grazie', () => {
  const p = parametriLink({ numero: 'DS-2026-0007', descrizione: 'Ingresso Day Spa · sabato 12 settembre · 2 persone', importoCent: 9000, redirect: 'https://www.hoteltermeleonardo.com/dayspa/?grazie=DS-2026-0007' });
  assertEquals(p['restrictions[completed_sessions][limit]'], '1', 'senza, chi ricarica paga due volte');
  assertEquals(p['metadata[numero]'], 'DS-2026-0007');
  assertEquals(p['payment_intent_data[metadata][numero]'], 'DS-2026-0007');
  assertEquals(p['after_completion[type]'], 'redirect');
  assertEquals(p.unit_amount, '9000');
  assertEquals(p.currency, 'eur');
  assert(p['product_data[name]'].startsWith('Ingresso Day Spa'));
});

Deno.test('la firma del webhook: giusta passa, sbagliata no, assente no', async () => {
  const segreto = 'whsec_prova';
  const corpo = '{"id":"evt_1"}';
  const t = '1700000000';
  const chiave = await crypto.subtle.importKey('raw', new TextEncoder().encode(segreto), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const firma = Array.from(new Uint8Array(await crypto.subtle.sign('HMAC', chiave, new TextEncoder().encode(`${t}.${corpo}`)))).map((b) => b.toString(16).padStart(2, '0')).join('');
  assert(await firmaValida(corpo, `t=${t},v1=${firma}`, segreto, Number(t) * 1000 + 1000));
  assert(!(await firmaValida(corpo, `t=${t},v1=${'0'.repeat(64)}`, segreto, Number(t) * 1000 + 1000)));
  assert(!(await firmaValida(corpo, null, segreto, Number(t) * 1000)));
});
```

`copie.test.ts`:

```ts
/* Le copie prese da buoni/ restano identiche: se una diverge, questa prova
   lo dice prima che il QR del Day Spa e quello dei buoni comincino a
   differire. */
import { assertEquals } from 'jsr:@std/assert';
const leggi = (p: string) => Deno.readTextFileSync(new URL(p, import.meta.url));
Deno.test('qr.js e la stessa copia dei buoni', () => {
  assertEquals(leggi('./qr.js'), leggi('../buoni/qr.js'));
});
```

- [ ] **Step 2: Eseguire e vedere fallire.**

- [ ] **Step 3: Copiare `qr.js` e scrivere `stripe.ts`**

```bash
cp supabase/functions/buoni/qr.js supabase/functions/dayspa/qr.js
```

`stripe.ts`: la funzione `firmaValida` si prende da `supabase/functions/buoni/index.ts` (righe 132-157: HMAC-SHA256 senza librerie, tolleranza di 5 minuti sul timestamp) e si riscrive con `segreto` e `adessoMs` come parametri, cosi' e' pura e provabile. Poi:

```ts
export function chiaveStripe(prova: boolean): string | undefined {
  return Deno.env.get(prova ? 'STRIPE_PROVA_KEY' : 'STRIPE_RESTRICTED_KEY');
}

export function segretoWebhook(prova: boolean): string | undefined {
  return Deno.env.get(prova ? 'STRIPE_PROVA_WEBHOOK_SECRET' : 'STRIPE_WEBHOOK_SECRET_DAYSPA');
}

/* I parametri del prezzo e del link in un oggetto solo: index.ts li divide
   fra POST /v1/prices (currency, unit_amount, product_data[name]) e
   POST /v1/payment_links (il resto), come fa buoni/index.ts. */
export function parametriLink(p: { numero: string; descrizione: string; importoCent: number; redirect: string }): Record<string, string> {
  return {
    currency: 'eur',
    unit_amount: String(p.importoCent),
    'product_data[name]': p.descrizione.slice(0, 250),
    'line_items[0][quantity]': '1',
    'restrictions[completed_sessions][limit]': '1',
    'metadata[numero]': p.numero,
    'payment_intent_data[metadata][numero]': p.numero,
    'payment_intent_data[description]': `Day Spa ${p.numero}`,
    'after_completion[type]': 'redirect',
    'after_completion[redirect][url]': p.redirect,
  };
}
```

- [ ] **Step 4: Eseguire e vedere passare** — Run: `deno test supabase/functions/dayspa/ --allow-read --allow-env` — Expected: PASS (listino, posti, validazione, stripe, copie).

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/dayspa/stripe.ts supabase/functions/dayspa/stripe.test.ts supabase/functions/dayspa/qr.js supabase/functions/dayspa/copie.test.ts
git commit -m "Day Spa: il link di pagamento a uso singolo, la firma del webhook, il QR copiato dai buoni"
```

---

### Task 6: L'email di conferma con il QR, in quattro lingue

**Files:**
- Create: `supabase/functions/dayspa/email-dayspa.ts`, `supabase/functions/dayspa/email-dayspa.test.ts`

**Interfaces:**
- Consumes: `ORARI` da `listino.ts`.
- Produces: `TESTI_EMAIL: Record<lingua, {...}>`; `emailConferma(p: Prenotazione, linkQr: string): { oggetto: string; html: string; testo: string }`; `dataEstesa(iso, lingua)`.

- [ ] **Step 1: Scrivere le prove**

```ts
import { assert, assertEquals } from 'jsr:@std/assert';
import { emailConferma, TESTI_EMAIL } from './email-dayspa.ts';

const P = { numero: 'DS-2026-0007', giorno: '2026-09-12', fascia: 'giornaliero', persone: 3, adulti: 2, bambini: 1, importo_cent: 13500, nome: 'Maria Rossi', email: 'm@e.it', lingua: 'it', codice: 'ABCDEFGHJK' };
const QR = 'https://x/functions/v1/dayspa?a=qr&codice=ABCDEFGHJK';

Deno.test('ogni lingua ha tutti i testi', () => {
  const chiavi = Object.keys(TESTI_EMAIL.it);
  assert(chiavi.length >= 10);
  for (const l of ['de', 'en', 'fr']) assertEquals(Object.keys(TESTI_EMAIL[l]).sort(), chiavi.sort(), `mancano testi in ${l}`);
});

Deno.test('la conferma porta QR, giorno, orario, persone, importo, numero e la riga non rimborsabile', () => {
  const e = emailConferma(P, QR);
  assert(e.html.includes(QR));
  assert(/12 settembre 2026/.test(e.html));
  assert(/9:00–18:30/.test(e.html));
  assert(/3 persone/.test(e.html));
  assert(/135,00/.test(e.html));
  assert(e.oggetto.includes('DS-2026-0007'));
  assert(/non rimborsabile/i.test(e.html), 'la proprieta ha deciso: l ingresso pagato non si rimborsa, e l email lo dice');
  assert(/neonat/i.test(e.html), 'i neonati non pagano: va detto');
});

Deno.test('in tedesco la data e in tedesco', () => {
  const e = emailConferma({ ...P, lingua: 'de' }, QR);
  assert(/12\. September 2026/.test(e.html));
  assert(/nicht erstattungsf/i.test(e.html));
});
```

- [ ] **Step 2: Eseguire e vedere fallire.**

- [ ] **Step 3: Scrivere `email-dayspa.ts`** — struttura come `buoni/email-buono.ts`: un oggetto `TESTI_EMAIL` con, per lingua: `oggetto(numero)`, `saluto(nome)`, `intro`, `giorno`, `orario`, `persone(n)`, `importo`, `qrTitolo`, `qrIstruzioni` («mostri questo codice allo sportello»), `neonati`, `nonRimborsabile`, `portare` (costume, ciabatte, cuffia obbligatoria 3 €), `firma`. `dataEstesa(iso, lingua)` con `Intl.DateTimeFormat` e `timeZone: 'Europe/Rome'`. L'HTML riusa lo scheletro di `email-buono.ts` (intestazione verde, riquadro col QR a 220 px, riga del numero in mono).

- [ ] **Step 4: Eseguire e vedere passare** — Expected: PASS, 3 prove.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/dayspa/email-dayspa.ts supabase/functions/dayspa/email-dayspa.test.ts
git commit -m "Day Spa: l email di conferma con il QR, in quattro lingue, che dice che l ingresso non si rimborsa"
```

---

### Task 7: La funzione `dayspa`: le azioni pubbliche

**Files:**
- Create: `supabase/functions/dayspa/index.ts`
- Create: `supabase/functions/dayspa/azioni.test.ts` (prove sul sorgente: le azioni ci sono, i freni ci sono, il numero dei posti non esce)

**Interfaces:**
- Consumes: tutto quanto sopra; `creaFrenoIp` copiato da `richieste/limite-ip.ts` (aggiungere la copia a `copie.test.ts`); `inviaEmail` come in `buoni/email-buono.ts` (Resend, `RESEND_API_KEY`, `MITTENTE_EMAIL`); `autorizzato` come in `richieste/index.ts` (ruoli).
- Produces, pubbliche (senza JWT, con freno per IP):
  - `GET ?a=listino` → `{ fasce, orari, prezzi: {fascia: {tipo: cent}}, personeMax, lingue }`.
  - `GET ?a=giorni&da=AAAA-MM-GG&a=AAAA-MM-GG` (massimo 62 giorni) → `{ giorni: [{ giorno, tipo, fasce: [{ fascia, stato, prezzoCent }] }] }`. Lo stato viene da `statoPosti`; il tipo dalla riga se c'e', altrimenti da `tipoDelGiorno`; `chiuso` da `stagione_chiusura`.
  - `POST ?a=prenota` corpo JSON → valida → riga di `dayspa_giorno` (se manca: 409 «non ancora in vendita») → `dayspa_prendi_posti` (falso: 409 «esaurito») → numero da `dayspa_numero_seq` → insert `in_pagamento` con `scade_il` → prezzo e link Stripe (con `chiaveStripe(DAYSPA_PROVA)`) → update `stripe_link` → `{ esito: 'ok', numero, url }`. Se Stripe fallisce: `dayspa_libera_posti` e 502.
  - `POST ?a=webhook` → `firmaValida` con `segretoWebhook(prova)` → evento `checkout.session.completed` → per `metadata.numero`: se gia' `pagata` esce 200 senza rifare (Stripe ripete gli eventi); altrimenti `pagata`, `pagato_il`, `stripe_pagamento`, `ricevuta_stato = 'da_battere'`; poi `emailConferma` + `inviaEmail`. Se la prenotazione era `scaduta` (pagata dopo i 20 minuti): la si riporta a `pagata` e si riprovano i posti con `dayspa_prendi_posti`; se non ci sono piu', si segna `pagata` lo stesso con `note = 'pagata dopo la scadenza, posti non garantiti'` e si avvisa l'hotel con `avvisaHotel` (email alla reception): un pagamento riuscito non si butta.
  - `GET ?a=qr&codice=` → PNG (come `buoni ?a=qr`).
  - `GET ?a=stato&numero=` → `{ stato }` per la pagina di grazie (che aspetta il webhook).
  - `POST ?a=scadute` (chiamata dal cron, con `x-cron-key`) → per ogni `in_pagamento` con `scade_il < now()`: `scaduta` + `dayspa_libera_posti`.
- Produces, riservate (con `autorizzato`, ruoli reception e spa):
  - `GET ?a=oggi&giorno=` → prenotazioni del giorno (`pagata`) con presenti, per fascia, piu' `{ posti, venduti }` per fascia.
  - `POST ?a=presenti` `{ numero|codice, presenti }` → `arrivato_il`, `presenti`.
  - `GET ?a=elenco&cerca=&da=&a=` → prenotazioni.
  - `GET ?a=disponibilita&da=&a=` / `POST ?a=disponibilita` `{ righe: [{giorno, fascia, tipo, posti, prezzo_cent}] }` → upsert; il tipo proposto viene da `tipoDelGiorno`, il prezzo da `prezzoCent`; la reception puo' cambiarli.
  - `POST ?a=rimborsa` `{ numero }` → solo reception (`puoScrivereBuoni` copiato da `buoni/ruoli.ts`): rimborso Stripe come `buoni/rimborso.ts`, `rimborsata`, posti liberati.

- [ ] **Step 1: Scrivere le prove sul sorgente**

```ts
/* azioni.test.ts — index.ts non e importabile (Deno.serve in cima): si
   legge come testo, come fanno le altre funzioni del repository. */
import { assert } from 'jsr:@std/assert';
const S = Deno.readTextFileSync(new URL('./index.ts', import.meta.url));

Deno.test('le azioni pubbliche e riservate esistono', () => {
  for (const a of ['listino', 'giorni', 'prenota', 'webhook', 'qr', 'stato', 'scadute', 'oggi', 'presenti', 'elenco', 'disponibilita', 'rimborsa']) {
    assert(new RegExp(`azione === '${a}'`).test(S), `manca ?a=${a}`);
  }
});

Deno.test('il numero dei posti non esce mai dalle azioni pubbliche', () => {
  const pubblica = S.slice(0, S.indexOf('/* ---------- riservati'));
  assert(pubblica.length > 1000, 'il confine fra pubblico e riservato deve esistere');
  assert(!/venduti/.test(pubblica.replace(/\/\*[\s\S]*?\*\//g, '')), 'venduti compare nella parte pubblica: da qui esce solo statoPosti');
});

Deno.test('prenota chiama dayspa_prendi_posti e libera i posti se Stripe fallisce', () => {
  assert(/rpc\('dayspa_prendi_posti'/.test(S));
  const prenota = S.slice(S.indexOf("azione === 'prenota'"), S.indexOf("azione === 'webhook'"));
  assert(/rpc\('dayspa_libera_posti'/.test(prenota), 'un link Stripe fallito deve restituire i posti');
});

Deno.test('il webhook verifica la firma e non rimanda l email a un evento ripetuto', () => {
  const w = S.slice(S.indexOf("azione === 'webhook'"), S.indexOf("azione === 'qr'"));
  assert(/firmaValida\(/.test(w));
  assert(/stato === 'pagata'/.test(w) && /return risposta\(\{ esito: 'ok', ripetuto: true \}\)/.test(w));
});

Deno.test('le azioni riservate passano da autorizzato', () => {
  const riservata = S.slice(S.indexOf('/* ---------- riservati'));
  assert(/await autorizzato\(req\)/.test(riservata));
  assert(/puoScrivereBuoni\(/.test(riservata.slice(riservata.indexOf("azione === 'rimborsa'"))), 'il rimborso e solo della reception');
});
```

- [ ] **Step 2: Eseguire e vedere fallire.**

- [ ] **Step 3: Scrivere `index.ts`** seguendo `richieste/index.ts` per la forma (`risposta()`, CORS, `Deno.serve`, `db` col service role, `leggiStagioni`, `indirizzo(req)`), con le azioni dell'interfaccia. Il freno: `permessoPubblico = creaFrenoIp(60, 5 * 60 * 1000)` su `giorni` e `prenota`. `DAYSPA_PROVA = Deno.env.get('DAYSPA_PROVA') === '1'`; ogni prenotazione nasce con `prova: DAYSPA_PROVA`. L'indirizzo di ritorno del pagamento: `PAGINA_DAYSPA = Deno.env.get('PAGINA_DAYSPA') || 'https://www.hoteltermeleonardo.com/dayspa/'` + `?grazie=<numero>&l=<lingua>`.

- [ ] **Step 4: Eseguire tutte le prove della funzione** — Run: `deno test supabase/functions/dayspa/ --allow-read --allow-env` — Expected: PASS. Poi `deno check supabase/functions/dayspa/index.ts` senza errori.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/dayspa/index.ts supabase/functions/dayspa/azioni.test.ts supabase/functions/dayspa/copie.test.ts
git commit -m "Day Spa: la funzione con le azioni dell ospite e della reception"
```

---

### Task 8: Il lavoro periodico che scade i pagamenti abbandonati

**Files:**
- Create: `supabase/2026-09-03-dayspa-cron.sql`
- Modify: `supabase/dayspa-sql.test.ts` (una prova in piu')

- [ ] **Step 1: Prova** — in `dayspa-sql.test.ts`:

```ts
Deno.test('il cron chiama ?a=scadute ogni cinque minuti con la chiave', () => {
  const C = Deno.readTextFileSync(new URL('./2026-09-03-dayspa-cron.sql', import.meta.url));
  assert(/cron\.schedule\(\s*'dayspa-scadute'/.test(C));
  assert(/\*\/5 \* \* \* \*/.test(C));
  assert(/functions\/v1\/dayspa\?a=scadute/.test(C));
  assert(/x-cron-key/.test(C));
});
```

- [ ] **Step 2: Vedere fallire.** — [ ] **Step 3: Scrivere il file** sul modello di `supabase/2026-08-15-cron-promemoria.sql` (pg_cron + `net.http_post` verso la funzione, con l'intestazione `x-cron-key` letta da `vault` o da una impostazione, come fa quel file). — [ ] **Step 4: Vedere passare.** — [ ] **Step 5: Commit** `git commit -m "Day Spa: ogni cinque minuti i pagamenti abbandonati restituiscono i posti"`.

---

### Task 9: Il calendario comune impara «esaurito» e «non in vendita»

**Files:**
- Modify: `pagine/comune/calendario.js`, `pagine/comune/calendario.test.ts`

**Interfaces:**
- Produces: `apriCalendario({ ..., statoExtra?: (iso) => 'esaurito'|'non-in-vendita'|'ultimi'|null })` e `innestaGiorno({ ..., statoExtra })`; `statoGiorno(iso, opzioni)` restituisce anche `'esaurito'` e `'non-in-vendita'`, che si disegnano grigi con una legenda («esaurito», «non ancora in vendita») nei `TESTI` delle quattro lingue; `'ultimi'` resta selezionabile con un puntino.

- [ ] **Step 1: Prove** in `calendario.test.ts`:

```ts
Deno.test('statoGiorno chiede a statoExtra prima di dire libero', () => {
  const extra = (iso: string) => iso === '2026-09-12' ? 'esaurito' : iso === '2026-09-20' ? 'non-in-vendita' : null;
  const o = { oggi: '2026-09-10', arrivo: null, partenza: null, chiusure: [], fine: null, statoExtra: extra } as unknown as Parametri;
  assertEquals(statoGiorno('2026-09-12', o), 'esaurito');
  assertEquals(statoGiorno('2026-09-20', o), 'non-in-vendita');
  assertEquals(statoGiorno('2026-09-11', o), 'libero');
});
Deno.test('passato e chiuso vincono su statoExtra', () => { /* ... */ });
Deno.test('i testi della legenda esistono in quattro lingue', () => {
  for (const l of ['it', 'de', 'en', 'fr']) { assert(TESTI[l].esaurito); assert(TESTI[l].nonInVendita); }
});
```

- [ ] **Step 2: Vedere fallire.** — [ ] **Step 3: Implementare**: in `statoGiorno`, dopo `passato`/`oltre`/`chiuso` e prima di `libero`, `const e = opzioni.statoExtra && opzioni.statoExtra(iso); if (e === 'esaurito' || e === 'non-in-vendita') return e;`; `tocca` ignora i giorni in quei due stati; `STILE` aggiunge `.calGiorno[data-stato="esaurito"]` e `[data-stato="non-in-vendita"]` grigi con barra, `[data-stato="ultimi"]` col puntino; la legenda sotto la griglia compare solo se `statoExtra` c'e'. — [ ] **Step 4: `deno test pagine/comune/ --allow-read`** verde, e `deno test pagine/ --allow-read --allow-env` verde (le pagine Prenota e richieste non cambiano). — [ ] **Step 5: Commit** `git commit -m "Il calendario sa dire esaurito e non ancora in vendita"`.

---

### Task 10: La pagina dell'ospite

**Files:**
- Create: `pagine/dayspa/index.html`, `pagine/dayspa/testi.js`, `pagine/dayspa/testi.test.ts`, `pagine/dayspa/pagina.test.ts`
- Modify: `pagine/indicizzazione.test.ts` (aggiungere `'dayspa/index.html'` a NASCOSTE e portare il conto a 7)

**Interfaces:**
- Consumes: `?a=listino`, `?a=giorni`, `?a=prenota`, `?a=stato`; `apriCalendario`/`innestaGiorno` con `statoExtra`; `leggiChiusure`; `parametriOspite`/`normalizzaLingua` da `/comune/ospite-url.js`; `segnaVuoti`/`mancanti` da `/comune/obbligatori.js`.
- Produces: pagina in tre passi in una schermata, `?k=` obbligatorio finche' `PROVA = true` (costante in cima al modulo; senza chiave la pagina dice «pagina in prova»), `noindex`, testi in `testi.js` (`export const T = { it: {...}, de, en, fr }`).

- [ ] **Step 1: Prove sul sorgente** (`pagina.test.ts`):

```ts
const P = Deno.readTextFileSync(new URL('./index.html', import.meta.url));
Deno.test('e nascosta finche e di prova', () => {
  assert(/<meta name="robots" content="noindex, follow">/.test(P));
  assert(/const PROVA = true;/.test(P));
  assert(/searchParams\.get\('k'\)/.test(P));
});
Deno.test('usa il calendario comune con statoExtra e legge le chiusure dal server', () => {
  assert(/from '\/comune\/calendario\.js'/.test(P));
  assert(/statoExtra:/.test(P));
  assert(/leggiChiusure\(/.test(P));
});
Deno.test('la riga non rimborsabile sta prima del pulsante di pagamento', () => {
  const riga = P.indexOf('t.nonRimborsabile'), paga = P.indexOf('id="bPaga"');
  assert(riga > 0 && paga > riga);
});
Deno.test('il totale lo dice il server: la pagina non moltiplica prezzi scritti a mano', () => {
  assert(!/3500|4500|2900/.test(P), 'un prezzo scritto nella pagina divergerebbe dal listino');
});
Deno.test('i neonati sono spiegati e i bambini contano dai 2 anni', () => { assert(/t\.neonati/.test(P) && /t\.bambini/.test(P)); });
```

`testi.test.ts`: ogni chiave di `T.it` esiste in de/en/fr; `nonRimborsabile` in ogni lingua contiene la parola giusta (rimborsabile / erstattungs / refundable / remboursable).

- [ ] **Step 2: Vedere fallire.** — [ ] **Step 3: Scrivere la pagina.** Struttura come `pagine/prenota/index.html` (stesso CSS di base, stessa testata con logo e lingua): 
  1. `#passoQuando`: pulsante data che apre `innestaGiorno` con `statoExtra` alimentato da una mappa `STATI[iso][fascia]` riempita con `?a=giorni` per i due mesi visibili (si ricarica quando il calendario cambia mese, `onMese`); scelto il giorno, le fasce come schede radio con orario, prezzo (dal listino), e la parola `ultimi`; 
  2. `#passoChi`: adulti (1–8) e bambini (0–7) con «−/+», totale = `prezzoCent(tipo, fascia) * persone` ricavato dal listino ricevuto, mai scritto; 
  3. `#passoDati`: nome, email, telefono, riga `t.nonRimborsabile`, consenso, `#bPaga` → `POST ?a=prenota` → `location.href = url`. 
  Al ritorno con `?grazie=<numero>`: la pagina interroga `?a=stato` ogni 3 secondi per 2 minuti e mostra «pagamento ricevuto, il QR e' nella sua email» o, se ancora `in_pagamento`, «stiamo aspettando la conferma del pagamento». Errori 409: «esaurito nel frattempo» con invito a scegliere un altro giorno.

- [ ] **Step 4: Prove verdi**: `deno test pagine/ --allow-read --allow-env` (comprese `sintassi.test.ts`, `indicizzazione.test.ts` aggiornata, `calendario-moduli` non tocca questa pagina).

- [ ] **Step 5: Commit** `git commit -m "Day Spa: la pagina dell ospite, in tre passi su una schermata, nascosta finche e di prova"`.

---

### Task 11: Le tre schede del back office

**Files:**
- Modify: `pagine/buoni/index.html` (schede `dayspaOggi`, `dayspaDisponibilita`, `dayspaPrenotazioni`; `ORDINE_SCHEDE`: reception `['richieste','arrivi','dayspaOggi','emetti','elenco','verifica','dayspaDisponibilita','dayspaPrenotazioni']`, spa `['richieste','arrivi','dayspaOggi','elenco','verifica','dayspaDisponibilita','dayspaPrenotazioni']`), `pagine/buoni/schede.test.ts`, `pagine/buoni/scheda-iniziale.test.ts` (l'iniziale resta `richieste`)
- Create: `pagine/buoni/dayspa-schede.test.ts`

- [ ] **Step 1: Prove sul sorgente**: le tre schede esistono per reception e spa; la scheda «oggi» ha il campo `#scanDayspa` con `autofocus` all'apertura come `#scanBuono`; la scheda disponibilita' ha una griglia di 14 giorni con `tipo` e `prezzo` proposti (il testo «proposto dalla regola») e il pulsante «Salva settimana»; il pulsante `#bRimborsaDayspa` compare solo per la reception (`puoScrivereBuoni` gia' in pagina per i buoni).
- [ ] **Step 2: Vedere fallire.** — [ ] **Step 3: Implementare** seguendo la scheda «Verifica» per la scansione e «Arrivi» per l'elenco del giorno: `?a=oggi` → tabella per fascia con «presenti N su M» in cima; scansione → `?a=presenti`; disponibilita' → `?a=disponibilita` GET/POST; prenotazioni → `?a=elenco` con ricerca e, per la reception, «Annulla e rimborsa» con conferma. Contatore delle ricevute «da battere da piu' di 10 minuti» in cima alla scheda oggi (rosso), che in fase 1 restera' acceso: e' voluto, e lo dice un commento. — [ ] **Step 4: `deno test pagine/buoni/ --allow-read --allow-env` verde.** — [ ] **Step 5: Commit** `git commit -m "Back office: Day Spa oggi con lo scanner, la disponibilita settimanale, le prenotazioni"`.

---

### Task 12: Le riscritture, robots, e la messa in prova

**Files:**
- Modify: `termeleonardo/frontend/vercel.json` (riga `{ "source": "/dayspa/:percorso*", "destination": "https://arrivo-terme-leonardo.vercel.app/dayspa/:percorso*" }` fra le riscritture di cartella), `termeleonardo/frontend/public/robots.txt` (`Disallow: /dayspa/` con una riga di commento: pagina in prova), `termeleonardo/frontend/sitemap.test.ts` gia' controlla che robots e sitemap non si contraddicano.

- [ ] **Step 1**: `deno test frontend/ --allow-read` nel repo `termeleonardo` resta verde (la sitemap non elenca `/dayspa/`). — [ ] **Step 2**: commit e push su `main` di `termeleonardo`: `git commit -m "La pagina Day Spa di prova passa dal dominio dell hotel, esclusa dai motori"`.
- [ ] **Step 3, la proprietà**: eseguire `supabase/2026-09-03-dayspa.sql` e `2026-09-03-dayspa-cron.sql` nel pannello Supabase; creare in Stripe (modalita' di prova) una chiave con limitazioni come quella dei buoni e un webhook verso `https://mvuiuwakuseockotlcnp.supabase.co/functions/v1/dayspa?a=webhook` con l'evento `checkout.session.completed`; mettere nelle variabili della funzione `DAYSPA_PROVA=1`, `STRIPE_PROVA_KEY`, `STRIPE_PROVA_WEBHOOK_SECRET`, `PAGINA_DAYSPA=https://www.hoteltermeleonardo.com/dayspa/`, `DAYSPA_CHIAVE_PROVA=<parola per ?k=>`, `CRON_KEY` se non c'e' gia'.
- [ ] **Step 4**: deploy: `SUPABASE_ACCESS_TOKEN=<token dato in chat> npx --yes supabase functions deploy dayspa --project-ref mvuiuwakuseockotlcnp --no-verify-jwt`; verifica: `POST {}` a `?a=prenota` → 400 con `{"errore":...}`; `GET ?a=listino` → i prezzi.
- [ ] **Step 5, la prova insieme**: la reception carica una settimana dalla scheda; sulla pagina con `?k=` si compra un ingresso con la carta di prova `4242 4242 4242 4242`; arriva l'email col QR; nella scheda «Day Spa oggi» si scansiona il QR e si segna «presenti»; si prova l'ultimo posto con due telefoni insieme: uno dei due deve vedere «esaurito nel frattempo». Poi si cancellano le prenotazioni di prova (`delete from dayspa_prenotazione where prova`).

---

## Autoverifica del piano

- **Copertura della specifica, fase 1**: listino (T2), disponibilità nostra e presa atomica (T1, T7, T11), scadenza dei 20 minuti (T3, T7, T8), pagina in tre passi con calendario e stati (T9, T10), pagamento Stripe a uso singolo con modalità di prova (T5, T7, T12), webhook idempotente (T7), email con QR e riga non rimborsabile (T6), arrivo con scanner e presenti parziali (T11), rimborso solo reception (T7, T11), coda ricevute che si riempie (T7: `ricevuta_stato`), buono regalo come pagamento (T4 accetta `buono`; l'uso in T7 riusa `coperturaBuono` da `comune/buono-url.js` e marca il buono come usato via `buoni ?a=usa` — se quell'azione non esiste, va aggiunta in un compito a parte prima di attivare il buono nella pagina). Abbonamenti e ricevute stampate: fasi 2 e 3, fuori da questo piano per scelta.
- **Nomi coerenti**: `statoPosti`, `tipoDelGiorno`, `fasceDelGiorno`, `prezzoCent`, `totaleCent`, `validaPrenotazione`, `parametriLink`, `firmaValida`, `emailConferma`, `dayspa_prendi_posti`, `dayspa_libera_posti`, `statoExtra` — usati con gli stessi nomi in tutti i compiti.
- **Segnaposto**: nessuno. Dove un compito rimanda a un modello esistente (`richieste/index.ts`, `email-buono.ts`, la scheda «Verifica»), il modello e' un file del repository, nominato.
