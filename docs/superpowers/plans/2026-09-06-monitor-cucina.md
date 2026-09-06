# Monitor cucina — piano di lavoro

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** le comande del POS su uno schermo (tablet o TV), per postazione, accanto o al posto della carta, con «in preparazione» e «pronto» che il palmare vede.

**Architecture:** una tabella `pos_postazione` (locale + stampante) decide come ogni postazione riceve i biglietti; `pos_stampa` porta anche i dati strutturati (`biglietto` jsonb) e i tempi (`vista_il`, `presa_il`, `pronta_il`); due azioni nuove (`schermo`, `schermo-stato`) servite dal cloud e dal PC del Bistrot con lo stesso contratto; una pagina `pagine/cucina` che parla prima col PC e poi col cloud, come il palmare. Il ripiego sulla carta è una funzione pura eseguita da chi stampa.

**Tech Stack:** Deno + TypeScript (edge function `pos`, server locale `pos-locale`), SQLite locale (`node:sqlite`), pagine statiche (HTML + JS puro con prove Deno), Supabase Postgres.

**Spec:** `docs/superpowers/specs/2026-09-06-monitor-cucina-design.md` (letta per intero solo dal controllore; ogni task ha qui tutto ciò che gli serve).

## Global Constraints

- Le stampanti fiscali (192.168.0.51, .52, porte 8989/8990) non compaiono mai nel codice: la prova `azioni.test.ts` lo controlla e resta.
- Il testo del biglietto (`testoBiglietto` in `comanda.ts`) non cambia: la carta resta identica riga per riga. Per una postazione con `schermo = false` e `stampa_sempre = true` tutto si comporta come oggi.
- Il cloud stampa solo se il PC tace da più di 90 s (`stampa-cloud`, `pos_battito`): resta.
- Valori esatti: stato nuovo di `pos_stampa` = `a_schermo`; intestazione = `x-schermo-chiave`; azioni = `schermo`, `schermo-stato`, `postazioni-salva`; passi = `presa`, `pronta`, `riapri`; il «riapri» vale entro **2 minuti** da `pronta_il`; «pronto in cucina» sul palmare dura **20 minuti**; il confine di «oggi» è **04:00** ora di Roma (stesso di `sala`); soglie colore dello schermo **5** e **12** minuti; aggiornamento dello schermo ogni **3 s**; `ripiego_s` di default **30**.
- Messaggi esatti del server: 401 `schermo non riconosciuto`; 403 `di un'altra postazione`; 400 `passo sconosciuto`; 409 `troppo tardi per riaprire`.
- `pagine/buoni/index.html` è CRLF: chi lo modifica preserva i fine riga (script applicatore che normalizza e ripristina, o Edit riga per riga).
- Nessuna dipendenza nuova. Nomi e commenti in italiano, nello stile dei file toccati (commenti che citano la richiesta della proprietà con la data). Ogni modulo puro ha la sua prova; i punti d'integrazione hanno prove «sul codice» come `azioni.test.ts`.
- Prove: `deno test --node-modules-dir=none . --allow-read --allow-env --allow-write` dalla radice del repo deve restare verde (2546 al 6 settembre 2026). La funzione: `cd supabase/functions/pos && deno check index.ts`. Il server locale: `cd pos-locale && deno check main.ts`.
- I subagenti non fanno deploy, push, SQL sul cloud, né toccano OneDrive: commit sul proprio ramo e basta. Il controllore fa il resto (Task 8).

---

### Task 1: il modulo puro `schermo.ts`, lo SQL, lo schema SQLite

**Files:**
- Create: `supabase/2026-09-06-pos-schermo.sql`
- Create: `supabase/functions/pos/schermo.ts`
- Create: `supabase/functions/pos/schermo.test.ts`
- Modify: `pos-locale/db.ts` (schema: `pos_postazione`, colonne nuove di `pos_stampa`)
- Modify: `pos-locale/db.test.ts`

**Interfaces (produces):**
```ts
export type Postazione = { locale: string; stampante: 'cucina' | 'bar'; nome: string; schermo: boolean; stampa_sempre: boolean; ripiego_s: number; chiave_hash?: string | null };
export type Passo = 'presa' | 'pronta' | 'riapri';
export function statoIniziale(p: { schermo?: unknown; stampa_sempre?: unknown } | null | undefined): 'da_stampare' | 'a_schermo';
export function daRipiegare(s: { stato: unknown; vista_il?: unknown; creato_il: unknown }, p: { ripiego_s?: unknown } | null | undefined, adesso: Date): boolean;
export function passo(s: { presa_il?: unknown; pronta_il?: unknown }, quale: string, adesso: Date, postazione: string): { campi: Record<string, string | null> } | { errore: string; stato: 400 | 409 };
export function inizioGiornata(adesso: Date, minutiRoma: number): Date;
export function daMostrare(s: { pronta_il?: unknown; creato_il: unknown }, inizio: Date): boolean;
export function prontoInCucina(stampe: { pronta_il?: unknown }[], adesso: Date): { pronto: boolean; alle: string | null };
export async function impronta(chiave: string): Promise<string>;   // SHA-256 esadecimale
export function chiaveCasuale(): string;                            // 16 caratteri [A-Z2-9] senza O/0/I/1
```
`schermo` e `stampa_sempre` arrivano anche come 0/1 da SQLite: `statoIniziale` li tratta con `!!Number(x)` se numerici, `=== true` se booleani (helper `vero(x)`).

- [ ] **Step 1: scrivere la prova** `supabase/functions/pos/schermo.test.ts`

```ts
/* ============================================================
   schermo.test.ts — il monitor cucina: cosa nasce da stampare, cosa va
   sullo schermo, quando la carta fa da ripiego, e i passi di una comanda.
   «Un monitor per ordini al posto dei biglietti stampati» (la proprieta',
   6 settembre 2026). Puro: nessuna rete, nessun database.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';
import { chiaveCasuale, daMostrare, daRipiegare, impronta, inizioGiornata, passo, prontoInCucina, statoIniziale } from './schermo.ts';

const T = (s: string) => new Date(s);

Deno.test('senza schermo si stampa come oggi; con schermo e carta si stampa e si mostra; solo schermo = a_schermo', () => {
  assertEquals(statoIniziale(null), 'da_stampare', 'nessuna postazione: come oggi');
  assertEquals(statoIniziale({ schermo: false, stampa_sempre: true }), 'da_stampare');
  assertEquals(statoIniziale({ schermo: false, stampa_sempre: false }), 'da_stampare', 'senza schermo la carta esce comunque');
  assertEquals(statoIniziale({ schermo: true, stampa_sempre: true }), 'da_stampare');
  assertEquals(statoIniziale({ schermo: true, stampa_sempre: false }), 'a_schermo');
  assertEquals(statoIniziale({ schermo: 1, stampa_sempre: 0 }), 'a_schermo', 'da SQLite arrivano 0 e 1');
});

Deno.test('il ripiego: a_schermo, mai visto, oltre ripiego_s secondi', () => {
  const s = { stato: 'a_schermo', vista_il: null, creato_il: '2026-09-06T10:00:00.000Z' };
  assertEquals(daRipiegare(s, { ripiego_s: 30 }, T('2026-09-06T10:00:29Z')), false, 'non ancora');
  assertEquals(daRipiegare(s, { ripiego_s: 30 }, T('2026-09-06T10:00:31Z')), true);
  assertEquals(daRipiegare({ ...s, vista_il: '2026-09-06T10:00:05Z' }, { ripiego_s: 30 }, T('2026-09-06T10:05:00Z')), false, 'uno schermo l ha mostrato');
  assertEquals(daRipiegare({ ...s, stato: 'da_stampare' }, { ripiego_s: 30 }, T('2026-09-06T10:05:00Z')), false, 'gia in coda di stampa');
  assertEquals(daRipiegare(s, { ripiego_s: 0 }, T('2026-09-07T10:00:00Z')), false, '0 = mai');
  assertEquals(daRipiegare(s, null, T('2026-09-07T10:00:00Z')), true, 'senza postazione vale il default di 30 s');
});

Deno.test('i passi: presa, pronta, riapri entro due minuti', () => {
  const ora = T('2026-09-06T12:00:00.000Z');
  assertEquals(passo({ presa_il: null, pronta_il: null }, 'presa', ora, 'Banco Bistrot'), { campi: { presa_il: '2026-09-06T12:00:00.000Z' } });
  assertEquals(passo({ presa_il: null, pronta_il: null }, 'pronta', ora, 'Banco Bistrot'), { campi: { presa_il: '2026-09-06T12:00:00.000Z', pronta_il: '2026-09-06T12:00:00.000Z', pronta_da: 'Banco Bistrot' } }, 'pronta senza presa: presa nello stesso istante');
  assertEquals(passo({ presa_il: '2026-09-06T11:58:00.000Z', pronta_il: null }, 'pronta', ora, 'Banco Bistrot'), { campi: { pronta_il: '2026-09-06T12:00:00.000Z', pronta_da: 'Banco Bistrot' } }, 'la presa resta quella vera');
  assertEquals(passo({ presa_il: '2026-09-06T11:58:00.000Z', pronta_il: '2026-09-06T11:59:00.000Z' }, 'riapri', ora, 'x'), { campi: { pronta_il: null, pronta_da: null } });
  assertEquals(passo({ presa_il: null, pronta_il: '2026-09-06T11:57:59.000Z' }, 'riapri', ora, 'x'), { errore: 'troppo tardi per riaprire', stato: 409 });
  assertEquals(passo({ presa_il: null, pronta_il: null }, 'riapri', ora, 'x'), { errore: 'troppo tardi per riaprire', stato: 409 }, 'non era pronta');
  assertEquals(passo({}, 'salta', ora, 'x'), { errore: 'passo sconosciuto', stato: 400 });
});

Deno.test('oggi comincia alle quattro del mattino, ora di Roma', () => {
  /* stessa regola della sala: alle 3 di notte si e' ancora nella giornata di ieri */
  const alle10 = inizioGiornata(T('2026-09-06T08:00:00Z'), 10 * 60);
  assertEquals(alle10.toISOString(), '2026-09-06T02:00:00.000Z', 'le 4 di Roma in estate sono le 2 UTC');
  const alle3 = inizioGiornata(T('2026-09-06T01:00:00Z'), 3 * 60);
  assertEquals(alle3.toISOString(), '2026-09-05T02:00:00.000Z');
  assert(daMostrare({ pronta_il: null, creato_il: '2026-09-06T05:00:00Z' }, alle10));
  assert(!daMostrare({ pronta_il: null, creato_il: '2026-09-06T01:00:00Z' }, alle10), 'di ieri');
  assert(!daMostrare({ pronta_il: '2026-09-06T06:00:00Z', creato_il: '2026-09-06T05:00:00Z' }, alle10), 'gia pronta');
});

Deno.test('pronto in cucina per venti minuti, con l ora dell ultima', () => {
  const ora = T('2026-09-06T12:30:00Z');
  assertEquals(prontoInCucina([], ora), { pronto: false, alle: null });
  assertEquals(prontoInCucina([{ pronta_il: '2026-09-06T12:15:00.000Z' }, { pronta_il: null }], ora), { pronto: true, alle: '2026-09-06T12:15:00.000Z' });
  assertEquals(prontoInCucina([{ pronta_il: '2026-09-06T12:09:00.000Z' }], ora), { pronto: false, alle: null }, 'passati i venti minuti');
  assertEquals(prontoInCucina([{ pronta_il: '2026-09-06T12:11:00.000Z' }, { pronta_il: '2026-09-06T12:20:00.000Z' }], ora).alle, '2026-09-06T12:20:00.000Z', 'l ultima');
});

Deno.test('la chiave dello schermo: casuale, leggibile, e si conserva solo l impronta', async () => {
  const k = chiaveCasuale();
  assert(/^[A-HJ-NP-Z2-9]{16}$/.test(k), k);
  assert(chiaveCasuale() !== k);
  const h = await impronta('ABCDEFGHJKLMNPQR');
  assertEquals(h.length, 64);
  assertEquals(h, await impronta('ABCDEFGHJKLMNPQR'), 'stabile');
  assert(h !== await impronta('ABCDEFGHJKLMNPQ2'));
});
```

- [ ] **Step 2: eseguire e vedere il fallimento** — `deno test --node-modules-dir=none supabase/functions/pos/schermo.test.ts --allow-read --allow-env` → errore: modulo `./schermo.ts` mancante.

- [ ] **Step 3: scrivere `supabase/functions/pos/schermo.ts`**

```ts
/* ============================================================
   schermo.ts — il monitor cucina: cosa nasce da stampare e cosa va sullo
   schermo, quando la carta fa da ripiego, i passi di una comanda.

   «Come riusciamo a fare un monitor per ordini al posto dei biglietti
   stampati?» (la proprieta', 6 settembre 2026). Una postazione (locale +
   stampante) dice come riceve i biglietti: stampante, schermo, o tutt'e
   due; col solo schermo la carta esce di ripiego se nessuno schermo ha
   mostrato il biglietto entro `ripiego_s` secondi, cosi' uno schermo
   spento non fa perdere niente. Puro: lo prova schermo.test.ts, lo usano
   la funzione (index.ts) e il server locale (pos-locale).
   ============================================================ */
export type Postazione = {
  locale: string; stampante: 'cucina' | 'bar'; nome: string;
  schermo: boolean; stampa_sempre: boolean; ripiego_s: number; chiave_hash?: string | null;
};
export type Passo = 'presa' | 'pronta' | 'riapri';

export const RIPIEGO_S = 30;
export const RIAPRI_MS = 2 * 60 * 1000;
export const PRONTO_MS = 20 * 60 * 1000;

/* da SQLite arrivano 0 e 1, dal cloud true e false */
const vero = (x: unknown): boolean => x === true || (typeof x === 'number' && x !== 0) || x === '1' || x === 'true';
const data = (x: unknown): Date | null => { const d = new Date(String(x ?? '')); return Number.isNaN(d.getTime()) ? null : d; };

/** Lo stato con cui nasce un biglietto per questa postazione. */
export function statoIniziale(p: { schermo?: unknown; stampa_sempre?: unknown } | null | undefined): 'da_stampare' | 'a_schermo' {
  if (!p || !vero(p.schermo)) return 'da_stampare';
  return vero(p.stampa_sempre) ? 'da_stampare' : 'a_schermo';
}

/** Vero se un biglietto «a schermo» che nessuno ha mostrato deve uscire di carta. */
export function daRipiegare(s: { stato: unknown; vista_il?: unknown; creato_il: unknown }, p: { ripiego_s?: unknown } | null | undefined, adesso: Date): boolean {
  if (s.stato !== 'a_schermo' || s.vista_il) return false;
  const secondi = p && p.ripiego_s !== undefined && p.ripiego_s !== null ? Number(p.ripiego_s) : RIPIEGO_S;
  if (!(secondi > 0)) return false;
  const nato = data(s.creato_il);
  return !!nato && adesso.getTime() - nato.getTime() > secondi * 1000;
}

/** I campi da scrivere per un passo dello schermo, o l'errore. */
export function passo(s: { presa_il?: unknown; pronta_il?: unknown }, quale: string, adesso: Date, postazione: string): { campi: Record<string, string | null> } | { errore: string; stato: 400 | 409 } {
  const ora = adesso.toISOString();
  if (quale === 'presa') return { campi: { presa_il: ora } };
  if (quale === 'pronta') {
    const campi: Record<string, string | null> = { pronta_il: ora, pronta_da: postazione };
    if (!s.presa_il) campi.presa_il = ora;
    return { campi: Object.fromEntries(Object.entries(campi).sort(([a], [b]) => a.localeCompare(b))) };
  }
  if (quale === 'riapri') {
    const pronta = data(s.pronta_il);
    if (!pronta || adesso.getTime() - pronta.getTime() > RIAPRI_MS) return { errore: 'troppo tardi per riaprire', stato: 409 };
    return { campi: { pronta_il: null, pronta_da: null } };
  }
  return { errore: 'passo sconosciuto', stato: 400 };
}

/** Le quattro del mattino di oggi, ora di Roma: stessa regola della sala. */
export function inizioGiornata(adesso: Date, minutiRoma: number): Date {
  const inizio = new Date(adesso.getTime()); inizio.setUTCSeconds(0, 0);
  inizio.setUTCMinutes(inizio.getUTCMinutes() - minutiRoma + 4 * 60);
  if (minutiRoma < 4 * 60) inizio.setUTCDate(inizio.getUTCDate() - 1);
  return inizio;
}

/** Sullo schermo: nato oggi e non ancora pronto. */
export function daMostrare(s: { pronta_il?: unknown; creato_il: unknown }, inizio: Date): boolean {
  if (s.pronta_il) return false;
  const nato = data(s.creato_il);
  return !!nato && nato.getTime() >= inizio.getTime();
}

/** «Pronto in cucina» sul palmare: un biglietto pronto negli ultimi venti minuti. */
export function prontoInCucina(stampe: { pronta_il?: unknown }[], adesso: Date): { pronto: boolean; alle: string | null } {
  const recenti = stampe.map((s) => data(s.pronta_il)).filter((d): d is Date => !!d && adesso.getTime() - d.getTime() <= PRONTO_MS).sort((a, b) => a.getTime() - b.getTime());
  const ultima = recenti.pop();
  return ultima ? { pronto: true, alle: ultima.toISOString() } : { pronto: false, alle: null };
}

/** L'impronta della chiave dello schermo: nel database sta solo questa. */
export async function impronta(chiave: string): Promise<string> {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(chiave));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

/** Una chiave da scrivere a mano senza sbagliare: niente O/0 e I/1. */
export function chiaveCasuale(): string {
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return [...crypto.getRandomValues(new Uint8Array(16))].map((b) => alfabeto[b % alfabeto.length]).join('');
}
```

Nota: la prova di `passo` per «pronta senza presa» confronta con `{ presa_il, pronta_il, pronta_da }` in quell'ordine: `assertEquals` non guarda l'ordine delle chiavi, quindi l'ordinamento nel codice è solo pulizia; se dà fastidio, toglierlo.

- [ ] **Step 4: eseguire la prova → verde.**

- [ ] **Step 5: lo SQL** `supabase/2026-09-06-pos-schermo.sql`

```sql
-- Il monitor cucina (la proprieta', 6 settembre 2026): una postazione per
-- ogni coppia locale + stampante dice come riceve i biglietti; il biglietto
-- porta anche i dati e i tempi. Vedi docs/superpowers/specs/2026-09-06-monitor-cucina-design.md.
create table if not exists pos_postazione (
  locale text not null references pos_locale(id),
  stampante text not null check (stampante in ('cucina', 'bar')),
  nome text not null,
  schermo boolean not null default false,
  stampa_sempre boolean not null default true,
  ripiego_s integer not null default 30,
  chiave_hash text,
  aggiornato_il timestamptz not null default now(),
  primary key (locale, stampante)
);
alter table pos_stampa
  add column if not exists biglietto jsonb,
  add column if not exists conto text,
  add column if not exists vista_il timestamptz,
  add column if not exists presa_il timestamptz,
  add column if not exists pronta_il timestamptz,
  add column if not exists pronta_da text;
alter table pos_stampa drop constraint if exists pos_stampa_stato_check;
alter table pos_stampa add constraint pos_stampa_stato_check check (stato in ('da_stampare', 'a_schermo', 'stampata', 'errore'));
create index if not exists pos_stampa_schermo on pos_stampa (locale, stampante, creato_il) where pronta_il is null;
-- la prova sul campo: il banco del Bistrot con schermo E carta; il resto come oggi
insert into pos_postazione (locale, stampante, nome, schermo, stampa_sempre) values
  ('bistrot', 'bar', 'Banco Bistrot', true, true),
  ('bistrot', 'cucina', 'Cucina Bistrot', false, true),
  ('ristorante', 'cucina', 'Cucina ristorante', false, true),
  ('ristorante', 'bar', 'Bar ristorante', false, true)
on conflict do nothing;
```
Non eseguirlo: lo applica il controllore con `node strumenti/migra.js`.

- [ ] **Step 6: lo schema SQLite** in `pos-locale/db.ts`, dentro `creaSchema`: dopo `create table if not exists pos_stampa (...)` aggiungere le colonne `biglietto text, conto text, vista_il text, presa_il text, pronta_il text, pronta_da text` alla CREATE, e una tabella nuova:
```sql
create table if not exists pos_postazione (
  locale text not null, stampante text not null, nome text not null,
  schermo integer not null default 0, stampa_sempre integer not null default 1, ripiego_s integer not null default 30,
  chiave_hash text, aggiornato_il text not null default ${ORA},
  primary key (locale, stampante));
```
Poi, sempre in `creaSchema` dopo `db.exec(...)`, un piccolo aggiornamento per un database già esistente: per ogni colonna nuova di `pos_stampa` non presente in `colonneDi(db, 'pos_stampa')` eseguire `alter table pos_stampa add column <nome> text`, e poi svuotare la cache delle colonne (la Map `colonne` in db.ts: aggiungere `colonne.delete('pos_stampa')`). Commento: «un PC gia' installato prima del monitor cucina non si reinstalla da zero».

- [ ] **Step 7: la prova dello schema** in `pos-locale/db.test.ts`: nella lista delle tabelle attese (riga 16) aggiungere `'pos_postazione'`; aggiungere una prova: creando lo schema su un database in memoria, `colonneDi(db, 'pos_stampa')` contiene `biglietto`, `conto`, `vista_il`, `presa_il`, `pronta_il`, `pronta_da`; e su un database dove `pos_stampa` è stata creata senza quelle colonne (eseguire a mano una CREATE vecchia prima di `creaSchema`), dopo `creaSchema` le colonne ci sono.

- [ ] **Step 8: prove verdi, commit** — `deno test --node-modules-dir=none supabase/functions/pos/schermo.test.ts pos-locale/db.test.ts --allow-read --allow-env --allow-write`; `git add` dei file toccati; commit «Monitor cucina: il modulo schermo.ts, lo SQL delle postazioni e lo schema SQLite».

---

### Task 2: i biglietti nascono con lo stato della postazione e portano i dati

**Files:**
- Modify: `supabase/functions/pos/dove.ts` (`siStampa` con `postazione`), `supabase/functions/pos/dove.test.ts`
- Modify: `supabase/functions/pos/index.ts` (`creaStampe` righe 198-235; `allinea-giu` riga ~1216 elenco tabelle e le stampe in discesa riga ~1224)
- Modify: `pos-locale/azioni.ts` (`creaStampe` righe 75-112), `pos-locale/allinea.ts` (`JSON_DI`, `TABELLE_GIU`)
- Modify: `supabase/functions/pos/azioni.test.ts`, `pos-locale/azioni.test.ts`, `pos-locale/allinea.test.ts`

**Interfaces (consumes):** `statoIniziale` da Task 1. **Produces:** `siStampa({ stampante, locale, postazione })`.

- [ ] **Step 1: prova per `siStampa`** in `dove.test.ts`, nuovo test:
```ts
Deno.test('con uno schermo si stampa anche dove non c e la stampante', () => {
  /* il ristorante non ha stampanti, ma un giorno puo' avere un monitor
     (la proprieta', 6 settembre 2026): il biglietto nasce lo stesso */
  const ristorante = { stampante_cucina: null, stampante_bar: '' };
  assertEquals(siStampa({ stampante: 'cucina', locale: ristorante, postazione: { schermo: true } }), true);
  assertEquals(siStampa({ stampante: 'cucina', locale: ristorante, postazione: { schermo: 1 } }), true, 'da SQLite');
  assertEquals(siStampa({ stampante: 'cucina', locale: ristorante, postazione: { schermo: false } }), false);
  assertEquals(siStampa({ stampante: 'cucina', locale: ristorante, postazione: null }), false);
  assertEquals(siStampa({ stampante: 'cucina', locale: null, postazione: { schermo: true } }), true, 'lo schermo basta anche senza locale');
});
```
- [ ] **Step 2: eseguire → fallisce** (tipo: `postazione` non è un parametro).
- [ ] **Step 3: `siStampa`** in `dove.ts`: firma `{ stampante, locale, postazione }` con `postazione?: { schermo?: unknown } | null`; prima riga: `if (postazione && (postazione.schermo === true || Number(postazione.schermo) === 1)) return true;` poi il resto com'è. Aggiornare il commento (una riga: «o la postazione ha uno schermo, 6 settembre 2026»).
- [ ] **Step 4: prove `dove.test.ts` verdi.**
- [ ] **Step 5: `creaStampe` nel cloud** (`index.ts` 198-235):
  - dopo la lettura dei `locali` (riga 205) leggere le postazioni: `const { data: postazioni } = await db.from('pos_postazione').select('*');` e `const postazioneDi = (locale: string, stampante: string) => (postazioni ?? []).find((p) => p.locale === locale && p.stampante === stampante) ?? null;`
  - nella `siStampa` (riga 221) passare `postazione: postazioneDi(dove, stampante)`;
  - la riga inserita (231) diventa: `{ id: crypto.randomUUID(), locale: dove, stampante, testo: testoBiglietto(b), biglietto: b, conto: conto.id, stato: statoIniziale(postazioneDi(dove, stampante)) }`;
  - import `statoIniziale` da `./schermo.ts`.
- [ ] **Step 6: `creaStampe` sul PC** (`pos-locale/azioni.ts` 75-112): stesse tre mosse con SQLite: `const postazioni = db.prepare('select * from pos_postazione').all() as Riga[];`, `postazione` a `siStampa`, e nella `salva(db, 'pos_stampa', {...})` aggiungere `biglietto: b` (perSqlite lo serializza in JSON), `conto: String(conto.id)`, `stato: statoIniziale(postazioneDi(dove, stampante))`, e i campi `vista_il: null, presa_il: null, pronta_il: null, pronta_da: null`. Import di `statoIniziale` da `../supabase/functions/pos/schermo.ts`.
- [ ] **Step 7: l'allineamento.** In `pos-locale/allinea.ts`: `JSON_DI` prende `pos_stampa: ['biglietto']` (così `biglietto` sale come oggetto); `TABELLE_GIU` prende `'postazione'`. Nel cloud, `allinea-giu` (index.ts ~1216): aggiungere `'pos_postazione'` all'elenco `tabelle`, e la query delle stampe in discesa (riga ~1224) passa da `.eq('stato', 'da_stampare')` a `.in('stato', ['da_stampare', 'a_schermo'])` (commento: «anche quelle solo a schermo: le mostra e le ripiega il PC»). Le stampe in discesa (`giu`, allinea.ts 73-76) devono passare da `conJson`? No: `salva` accetta un oggetto e lo serializza; `biglietto` arriva come oggetto dal cloud e va bene così.
- [ ] **Step 8: prove.** In `supabase/functions/pos/azioni.test.ts`, nel test che guarda `creaStampe` (riga ~133-141): aggiungere `assert(c.includes("from('pos_postazione')") && c.includes('stato: statoIniziale(') && c.includes('biglietto: b,'), 'il biglietto nasce con lo stato della postazione e porta i dati');` e per `allinea-giu`: `assert(S.includes("'pos_postazione'"), 'le postazioni scendono al PC')` e `assert(S.includes(".in('stato', ['da_stampare', 'a_schermo'])"))`. In `pos-locale/azioni.test.ts`: nel test che legge `stampante, stato, allineato` da `pos_stampa` (riga 40) lo stato resta `da_stampare` senza postazioni; aggiungere un test: inserita una postazione `('L1','bar','Banco',1,0,30)` prima dell'invio, il biglietto del bar nasce `a_schermo` e ha `biglietto` (JSON con `righe`) e `conto`. In `pos-locale/allinea.test.ts`: `TABELLE_GIU` non è esportata: aggiungere alla prova esistente di `giu` (riga ~79) una riga `postazione: [{ locale: 'L1', stampante: 'bar', nome: 'Banco', schermo: true, stampa_sempre: false, ripiego_s: 30, chiave_hash: null, aggiornato_il: '2026-09-06T00:00:00Z' }]` nella risposta finta e verificare che `select * from pos_postazione` la contenga con `schermo = 1`.
- [ ] **Step 9: `deno check` della funzione e del server locale; prove verdi; commit** «Monitor cucina: i biglietti nascono con lo stato della postazione e portano i dati; le postazioni scendono al PC».

---

### Task 3: le azioni dello schermo nel cloud, il ripiego, «pronto» in sala, le postazioni dal back office

**Files:**
- Modify: `supabase/functions/pos/index.ts` (CORS riga 70-74; `sala` 589-641; `stampa-cloud` 1148-1181; nuove azioni; `azioniBackOffice` 1376; `allinea-giu`)
- Modify: `supabase/functions/pos/ruoli.ts` (`AZIONI_BISTROT` += `'postazioni-salva'`), `ruoli.test.ts`
- Modify: `supabase/functions/pos/azioni.test.ts`

**Interfaces (produces):**
- `GET ?a=schermo&locale=<id>&stampante=<cucina|bar>`, intestazione `x-schermo-chiave` → `{ postazione: { nome }, biglietti: [{ id, stato, creato_il, vista_il, presa_il, biglietto, testo, stampante }], adesso }`. Prima di rispondere scrive `vista_il = adesso` dove è vuoto.
- `POST ?a=schermo-stato { id, passo }` stessa intestazione → `{ esito: 'ok', ...campi }`; 403 `di un'altra postazione` se il biglietto non è di quel locale + stampante; 400/409 come `passo()`.
- `POST ?a=postazioni-salva { postazioni: [{ locale, stampante, nome, schermo, stampa_sempre, ripiego_s, nuova_chiave }] }` (back office) → `{ esito: 'ok', chiavi: [{ locale, stampante, nome, chiave }] }` (solo per chi ha chiesto `nuova_chiave`).
- `sala`: ogni conto porta `pronto_in_cucina: boolean` e `pronto_alle: string | null`.

- [ ] **Step 1: prove sul codice** in `azioni.test.ts` (rosse prima):
```ts
Deno.test('il monitor cucina: due azioni con la chiave dello schermo, il ripiego nel cron, pronto in sala', () => {
  assert(S.includes("'x-schermo-chiave'"), 'l intestazione dello schermo e in CORS');
  for (const a of ['schermo', 'schermo-stato', 'postazioni-salva']) assert(new RegExp(`azione === '${a}'`).test(S), `manca ?a=${a}`);
  const sc = S.slice(S.indexOf("azione === 'schermo'"), S.indexOf("azione === 'schermo-stato'"));
  assert(sc.includes('schermo non riconosciuto') && sc.includes('vista_il') && sc.includes('inizioGiornata('), 'lo schermo legge solo la sua postazione, di oggi, e segna cosa ha mostrato');
  const st = S.slice(S.indexOf("azione === 'schermo-stato'"), S.indexOf("azione === 'postazioni-salva'"));
  assert(st.includes("di un'altra postazione") && st.includes('passo('), 'i passi passano dal modulo puro');
  const cloud = S.slice(S.indexOf("azione === 'stampa-cloud'"), S.indexOf("azione === 'allinea-su'"));
  assert(cloud.includes('daRipiegare('), 'il cloud ripiega sulla carta per i locali che tacciono');
  const sala = S.slice(S.indexOf("azione === 'sala'"), S.indexOf("azione === 'conto'"));
  assert(sala.includes('prontoInCucina(') && sala.includes('pronto_in_cucina'), 'la sala dice cosa e pronto');
  assert(S.includes("'postazioni-salva'") && S.includes('chiaveCasuale()') && S.includes('impronta('), 'le postazioni si salvano dal back office con la chiave nuova');
});
```
- [ ] **Step 2: eseguire → rossa.**
- [ ] **Step 3: CORS**: `'Access-Control-Allow-Headers': 'content-type, authorization, x-hotel-key, x-cron-key, x-pos-dispositivo, x-pos-sessione, x-schermo-chiave'`.
- [ ] **Step 4: un aiuto per la postazione dello schermo**, accanto a `chiaveHotel` (riga ~82):
```ts
/* ---------- lo schermo di una postazione (monitor cucina) ---------- */
async function postazioneDelloSchermo(req: Request, url: URL): Promise<Riga | null> {
  const chiave = req.headers.get('x-schermo-chiave') || '';
  const locale = url.searchParams.get('locale') || '', stampante = url.searchParams.get('stampante') || '';
  if (!chiave || !locale || !stampante) return null;
  const { data: p } = await db.from('pos_postazione').select('*').eq('locale', locale).eq('stampante', stampante).maybeSingle();
  if (!p || !p.chiave_hash || p.chiave_hash !== await impronta(chiave)) return null;
  return p;
}
```
Import da `./schermo.ts`: `chiaveCasuale, daMostrare, daRipiegare, impronta, inizioGiornata, passo, prontoInCucina`.
- [ ] **Step 5: le azioni**, da mettere PRIMA del blocco «dal server locale e dall'estensione» (riga 1118), con il commento di sezione `/* ================= il monitor cucina (chiave dello schermo) ================= */`:
```ts
  if (azione === 'schermo') {
    const p = await postazioneDelloSchermo(req, url);
    if (!p) return risposta({ errore: 'schermo non riconosciuto' }, 401);
    const ora = new Date();
    const inizio = inizioGiornata(ora, oraLocale(ora).minuti);
    const { data: stampe } = await db.from('pos_stampa').select('id, stato, creato_il, vista_il, presa_il, pronta_il, biglietto, testo, stampante, conto')
      .eq('locale', p.locale as string).eq('stampante', p.stampante as string).is('pronta_il', null).gte('creato_il', inizio.toISOString()).order('creato_il').limit(200);
    const biglietti = (stampe ?? []).filter((s) => daMostrare(s, inizio));
    /* da qui in poi il ripiego non scatta: uno schermo l'ha mostrato */
    const nonViste = biglietti.filter((s) => !s.vista_il).map((s) => s.id as string);
    const adessoIso = ora.toISOString();
    if (nonViste.length) await db.from('pos_stampa').update({ vista_il: adessoIso, aggiornato_il: adessoIso }).in('id', nonViste).is('vista_il', null);
    return risposta({ postazione: { nome: p.nome }, biglietti: biglietti.map((s) => ({ ...s, vista_il: s.vista_il ?? adessoIso })), adesso: adessoIso });
  }

  if (azione === 'schermo-stato') {
    if (req.method !== 'POST') return risposta({ errore: 'metodo non ammesso' }, 405);
    const p = await postazioneDelloSchermo(req, url);
    if (!p) return risposta({ errore: 'schermo non riconosciuto' }, 401);
    const b = await corpo();
    const { data: s } = await db.from('pos_stampa').select('id, locale, stampante, presa_il, pronta_il').eq('id', String(b.id ?? '')).maybeSingle();
    if (!s) return risposta({ errore: 'biglietto non trovato' }, 404);
    if (s.locale !== p.locale || s.stampante !== p.stampante) return risposta({ errore: "di un'altra postazione" }, 403);
    const esito = passo(s, String(b.passo ?? ''), new Date(), String(p.nome));
    if ('errore' in esito) return risposta({ errore: esito.errore }, esito.stato);
    const ora = adesso();
    const { error } = await db.from('pos_stampa').update({ ...esito.campi, aggiornato_il: ora }).eq('id', s.id as string);
    if (error) return risposta({ errore: error.message }, 500);
    return risposta({ esito: 'ok', ...esito.campi });
  }
```
`oraLocale` viene da `./fasce.ts` (già importato per la sala). `adesso()` è l'aiuto esistente che dà l'ISO.
- [ ] **Step 6: `postazioni-salva`** nel blocco del back office, dopo `tavoli-salva` (riga ~1613); aggiungere `'postazioni-salva'` a `azioniBackOffice`:
```ts
  if (azione === 'postazioni-salva') {
    const b = await corpo();
    const ora = adesso();
    const righe = Array.isArray(b.postazioni) ? b.postazioni as Riga[] : [];
    const chiavi: { locale: string; stampante: string; nome: string; chiave: string }[] = [];
    try {
      for (const p of righe) {
        const locale = String(p.locale ?? ''), stampante = String(p.stampante ?? '');
        if (!locale || !['cucina', 'bar'].includes(stampante)) return risposta({ errore: 'ogni postazione ha locale e stampante (cucina o bar)' }, 400);
        const riga: Riga = { locale, stampante, nome: String(p.nome ?? '').trim() || `${locale} ${stampante}`, schermo: !!p.schermo, stampa_sempre: p.stampa_sempre !== false, ripiego_s: Math.max(0, Number(p.ripiego_s ?? 30) || 0), aggiornato_il: ora };
        /* la chiave si vede una volta sola: qui resta l'impronta */
        if (p.nuova_chiave) { const chiave = chiaveCasuale(); riga.chiave_hash = await impronta(chiave); chiavi.push({ locale, stampante, nome: String(riga.nome), chiave }); }
        else { const { data: e } = await db.from('pos_postazione').select('chiave_hash').eq('locale', locale).eq('stampante', stampante).maybeSingle(); riga.chiave_hash = e?.chiave_hash ?? null; }
        const { error } = await db.from('pos_postazione').upsert(riga, { onConflict: 'locale,stampante' });
        if (error) throw new Error(error.message);
      }
      return risposta({ esito: 'ok', chiavi });
    } catch (e) { return risposta({ errore: (e as Error).message }, 500); }
  }
```
In `ruoli.ts`: `AZIONI_BISTROT` += `'postazioni-salva'`; in `ruoli.test.ts` aggiungerla alla lista delle azioni del bistrot.
- [ ] **Step 7: il ripiego nel cron** (`stampa-cloud`): prima della query delle stampe da stampare, per i locali NON vivi: leggere `pos_postazione`, poi `const { data: aSchermo } = await db.from('pos_stampa').select('id, locale, stampante, stato, vista_il, creato_il').eq('stato', 'a_schermo').is('vista_il', null).order('creato_il').limit(50);` e per ciascuna con `!vivi.has(locale)` e `daRipiegare(s, postazioneDi(...), new Date())` → `update({ stato: 'da_stampare', aggiornato_il })`; contarle in `ripiegate` e restituirle nella risposta `{ esito, fatte, saltate, ripiegate }`. Commento: «uno schermo spento non fa perdere niente: la carta esce dopo ripiego_s secondi; per i locali col PC vivo lo fa il PC (stampa.ts)».
- [ ] **Step 8: «pronto» in sala** (`sala`, righe 596-610): dopo la lettura delle `righe`, leggere `const { data: pronte } = idConti.length ? await db.from('pos_stampa').select('conto, pronta_il').in('conto', idConti).not('pronta_il', 'is', null).gte('pronta_il', new Date(Date.now() - 20 * 60 * 1000).toISOString()) : { data: [] };` e in `contiPronti` aggiungere `...(() => { const p = prontoInCucina((pronte ?? []).filter((s) => s.conto === c.id), new Date()); return { pronto_in_cucina: p.pronto, pronto_alle: p.alle }; })()`.
- [ ] **Step 9: `deno check`, prove verdi (azioni.test.ts, ruoli.test.ts), commit** «Monitor cucina: le azioni dello schermo nel cloud, il ripiego nel cron, pronto in sala, le postazioni dal back office».

---

### Task 4: il PC del Bistrot: le stesse azioni, il ripiego, la pagina servita

**Files:**
- Modify: `pos-locale/azioni.ts` (azioni `schermo`, `schermo-stato`; `sala` con pronto), `pos-locale/stampa.ts` (`giroStampe` ripiega), `pos-locale/pagina.ts` (`/cucina`, `/cucina/schermo.js`), `pos-locale/main.ts` (CORS += `x-schermo-chiave`)
- Modify: `pos-locale/azioni.test.ts`, `pos-locale/stampa.test.ts`, `pos-locale/pagina.test.ts`

**Interfaces:** identiche a Task 3 (stesso contratto). `Richiesta` porta `query` e `intestazioni` (minuscole).

- [ ] **Step 1: prove** (rosse prima):
  - `pagina.test.ts`: `assertEquals(fileDellaPagina('/cucina'), { file: 'cucina/index.html', tipo: 'text/html; charset=utf-8' })`, idem `/cucina/`; `assertEquals(fileDellaPagina('/cucina/schermo.js')?.file, 'cucina/schermo.js')`.
  - `stampa.test.ts`: nuovo test «un biglietto a schermo che nessuno ha visto esce di carta dopo ripiego_s»: database in memoria con `pos_postazione ('L1','bar','Banco',1,0,30)` e `pos_stampa` `a_schermo` creato 60 s fa con `vista_il` null → `giroStampe(db, {bar:'192.168.0.61:9101'}, finta, new Date())` lo stampa (stato `stampata`); uno creato 10 s fa resta `a_schermo`; uno con `vista_il` valorizzato resta `a_schermo`. `giroStampe` prende un quarto parametro `adesso: Date = new Date()`.
  - `azioni.test.ts` (pos-locale): con una postazione con `chiave_hash = impronta('ABCDEFGHJKLMNPQR')` e due stampe (una di oggi non pronta, una pronta), `esegui(db, 'schermo', { metodo: 'GET', query: { locale: 'L1', stampante: 'bar' }, corpo: null, intestazioni: { 'x-schermo-chiave': 'ABCDEFGHJKLMNPQR' } }, cfg)` risponde 200 con un solo biglietto e scrive `vista_il`; chiave sbagliata → 401 `schermo non riconosciuto`; `schermo-stato` con `passo: 'pronta'` scrive `pronta_il` e `pronta_da = 'Banco'` e `allineato = 0`; con l'id di un biglietto di un'altra stampante → 403. E `sala` restituisce `pronto_in_cucina: true` per il conto con un biglietto pronto da 5 minuti.
- [ ] **Step 2: `pagina.ts`**: in `fileDellaPagina`, `if (p === '/cucina') return { file: 'cucina/index.html', tipo: 'text/html; charset=utf-8' };` e in `FILE`: `'/cucina/schermo.js': 'cucina/schermo.js'`.
- [ ] **Step 3: `main.ts`**: CORS `'content-type, x-pos-dispositivo, x-pos-sessione, x-schermo-chiave'`.
- [ ] **Step 4: `stampa.ts`**: in `giroStampe(db, stampanti, connetti = connettiVero, adesso = new Date())`, prima di leggere `da_stampare`: leggere `pos_postazione` e le `a_schermo` con `vista_il is null`, e per ciascuna con `daRipiegare(s, postazione, adesso)` → `update pos_stampa set stato = 'da_stampare', aggiornato_il = ?, allineato = 0 where id = ?`. Import `daRipiegare` da `../supabase/functions/pos/schermo.ts`. Commento come nel cloud.
- [ ] **Step 5: `azioni.ts`**: un aiuto `postazioneDelloSchermo(db, req)` (chiave da `testa(req, 'x-schermo-chiave')`, locale e stampante da `req.query`, confronto con `await impronta(chiave)`), poi le due azioni con lo stesso comportamento del cloud in SQL (`select ... from pos_stampa where locale = ? and stampante = ? and pronta_il is null and creato_il >= ? order by creato_il limit 200`; `update pos_stampa set vista_il = ?, aggiornato_il = ?, allineato = 0 where id in (...) and vista_il is null`; per `schermo-stato` `update ... set <campi>, aggiornato_il = ?, allineato = 0 where id = ?`). `biglietto` torna al client come oggetto: usare `conJson(['biglietto'])` sulle righe. In `sala` (169-192): leggere `select conto, pronta_il from pos_stampa where conto in (...) and pronta_il is not null and pronta_il >= ?` e aggiungere `pronto_in_cucina`/`pronto_alle` come nel cloud.
- [ ] **Step 6: `cd pos-locale && deno check main.ts`; prove verdi; commit** «Monitor cucina: le azioni dello schermo anche sul PC del Bistrot, il ripiego in giroStampe, /cucina servita».

---

### Task 5: la pagina dello schermo `pagine/cucina/`

**Files:**
- Create: `pagine/cucina/index.html`, `pagine/cucina/schermo.js`, `pagine/cucina/schermo.test.ts`, `pagine/cucina/pagina.test.ts`

**Interfaces (consumes):** le azioni `schermo` e `schermo-stato` (Task 3/4); `creaServer` da `/pos/server.js` (importato come modulo ES: `import { creaServer } from '/pos/server.js';` — sul PC e su Vercel quel percorso c'è). Il cloud è `https://mvuiuwakuseockotlcnp.supabase.co/functions/v1/pos`; il PC è `location.origin` quando la pagina è servita in http dal PC (stesso riconoscimento `DAL_PC` di `pagine/pos/index.html`: leggerlo e copiarne la regola, non reinventarla; il `ping` verso il PC è `fetch(base + '?a=stato-locale')` con esito ok).

**Produces (`schermo.js`, puro, ES module):**
```js
export const SOGLIE_MIN = { verde: 5, giallo: 12 };
export function colorePerAttesa(minuti)            // 'verde' | 'giallo' | 'rosso'
export function minutiDa(iso, adesso)              // intero, mai negativo
export function ordina(biglietti)                  // per creato_il crescente, poi id
export function resa(s)                            // { tipo, tavolo, portata, ora, cameriere, righe:[{quantita,nome,variante,nota}], avviso, portareA, noteVitto, testo } da s.biglietto; senza biglietto: righe [] e testo = s.testo
export function nuovi(prima, dopo)                 // gli id in `dopo` che non erano in `prima` → suono
export function tastoPer(key, quante)              // '1'..'9' → {azione:'scegli', indice}; 'p'/'P' → {azione:'presa'}; 'Enter' → {azione:'pronta'}; 'Backspace' → {azione:'riapri'}; altro → null; un indice oltre `quante` → null
export const TESTI = { inizia: 'Tocca per iniziare', vuoto: 'Nessuna comanda in attesa', presa: 'In preparazione', pronta: 'Pronto', riapri: 'Riapri', pc: 'PC del Bistrot', cloud: 'cloud', senzaRete: 'senza rete', ultime: 'Ultime pronte' };
```

- [ ] **Step 1: prove** `schermo.test.ts` (Deno, `import ... from './schermo.js'`): colori alle soglie (4→verde, 5→giallo, 11→giallo, 12→rosso); `minutiDa` con `adesso` iniettato, mai negativo; `ordina` stabile; `resa` con e senza `biglietto`; `nuovi`; `tastoPer` per ogni tasto, indice fuori → null; i testi hanno le chiavi elencate.
- [ ] **Step 2: eseguire → rosse (modulo mancante).**
- [ ] **Step 3: `schermo.js`** con intestazione di commento nello stile di `pagine/ordina/filtri.js` (perché, richiesta della proprietà, «puro: niente DOM, niente rete»).
- [ ] **Step 4: prove verdi.**
- [ ] **Step 5: `index.html`** (italiano soltanto; nessuna libreria; caratteri grandi; funziona a 1280×720 su TV e su un tablet 10"):
  - legge `l`, `s`, `k` dall'indirizzo; se ci sono li salva in `localStorage.cucinaPostazione` e pulisce l'indirizzo con `history.replaceState`; se mancano e non c'è niente salvato mostra «Manca la chiave: aprire il link dato dal back office».
  - schermata iniziale a tutto schermo «Tocca per iniziare»: al tocco crea l'`AudioContext` (per il suono), chiede `navigator.wakeLock.request('screen')` se esiste (e lo richiede al `visibilitychange`), poi parte il giro.
  - `chiama(azione, opz)`: come nel palmare, `base = await server.base()`, intestazione `x-schermo-chiave`, query `&locale=&stampante=`; su errore di rete `server.localeCaduto()` e ritenta una volta; aggiorna la spia in alto (`TESTI.pc` / `TESTI.cloud` / `TESTI.senzaRete` + ora dell'ultimo giro riuscito).
  - giro ogni 3 s: `schermo` → `ordina` → disegna le schede in una griglia (`grid-template-columns: repeat(auto-fill, minmax(300px, 1fr))`): tavolo grande, `tipo` se non è COMANDA (VAI / STORNO / MODIFICA in evidenza), portata, ora, «N′» con classe colore da `colorePerAttesa`, `avviso` e `portareA` in cima in giallo, righe «2 × Focaccia margherita» con variante «+ …» e nota «> …» evidenziate; due tasti «In preparazione» (nascosto se già presa) e «Pronto». Nessuna scheda: `TESTI.vuoto` grande e grigio. Suono breve (oscillatore 880 Hz, 150 ms) quando `nuovi(prima, dopo)` non è vuoto.
  - tocco su un tasto → `schermo-stato` con `passo`; poi giro subito. Una scheda pronta finisce nella striscia in fondo «Ultime pronte» (ultime 5, in memoria) con un tasto «Riapri» che manda `riapri`; se il server risponde 409 lo dice per 3 s.
  - tastiera: `keydown` → `tastoPer`; `scegli` evidenzia la scheda (classe `.scelta`), `presa`/`pronta` agiscono sulla scheda scelta (se nessuna, sulla prima), `riapri` sull'ultima pronta.
  - errori di server (401): schermata «Schermo non riconosciuto: chiedere un link nuovo dal back office».
  - stile: sfondo scuro `#101814`, testo chiaro, schede bianche su verde/giallo/rosso tenui; `@media (max-width: 700px)` una colonna.
- [ ] **Step 6: `pagina.test.ts`** (sul codice, come `pagine/pos/pagina.test.ts`): la pagina importa `./schermo.js` e `/pos/server.js`; manda `x-schermo-chiave`; chiama `?a=schermo` e `?a=schermo-stato`; contiene `wakeLock`, `AudioContext`, `TESTI.inizia`; non contiene `fidra`; ogni 3 s (`3000`).
- [ ] **Step 7: prova visiva** con Chrome senza finestra (c'è `C:/Program Files/Google/Chrome/Application/chrome.exe`): servire `pagine/` con `deno run --allow-net --allow-read jsr:@std/http/file-server pagine -p 8765` in sottofondo e fare `chrome --headless --screenshot=... --window-size=1280,720 http://localhost:8765/cucina/?l=bistrot&s=bar&k=X` → la schermata «Tocca per iniziare» si vede; allegare il percorso dello screenshot nel rapporto. Poi fermare il server.
- [ ] **Step 8: prove verdi; commit** «Monitor cucina: la pagina dello schermo».

---

### Task 6: il palmare vede «pronto»

**Files:**
- Modify: `pagine/pos/index.html` (`conStato` 499-509; CSS delle voci tavolo ~riga 85; `pannelloConto` 564+), `pagine/pos/pagina.test.ts`

- [ ] **Step 1: prova sul codice** in `pagine/pos/pagina.test.ts`: la pagina contiene `pronto_in_cucina` in `conStato` e la classe `pronto` nel CSS (`.tavoloVoce.pronto`), e in `pannelloConto` il testo «Pronto in cucina alle».
- [ ] **Step 2: rossa.**
- [ ] **Step 3: `conStato`**: `const pronto = aperti.some((c) => c.pronto_in_cucina);` e nella classe restituita aggiungere ` pronto` se vero (`stato` resta com'è: la classe si aggiunge accanto, es. `class="tavoloVoce ${c.stato}${c.pronto ? ' pronto' : ''}"` in entrambe le viste); nel `dentro` un bollino `<span class="bollinoPronto">pronto</span>` dopo il nome. CSS: `.tavoloVoce.pronto,.tavolo.pronto{box-shadow:0 0 0 3px var(--verde);} .bollinoPronto{background:var(--verde);color:#fff;border-radius:999px;padding:1px 7px;font-size:11px;margin-left:6px;}`.
- [ ] **Step 4: `pannelloConto`**: se `c.pronto_in_cucina`, una riga in cima al pannello `<div class="prontoRiga">✅ Pronto in cucina alle ${ora(c.pronto_alle)}</div>` (usare l'aiuto per l'ora HH:MM che la pagina già ha per `minuti`/orari; se non c'è, `new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })`).
- [ ] **Step 5: prove verdi (`pagine/pos/*.test.ts`); commit** «Monitor cucina: il palmare vede «pronto in cucina» sul tavolo e sul conto».

---

### Task 7: il back office delle postazioni, il pacchetto, il sito

**Files:**
- Modify: `pagine/buoni/index.html` (`vistaPosTavoli` 2928-3000: sezione «Postazioni», salvataggio, link della chiave) — file CRLF
- Modify: `pagine/buoni/pos-schede.test.ts`
- Modify: `strumenti/pacchetto-bistrot.js` (copia `pagine/cucina/index.html` e `schermo.js` in `pagina/cucina/`)
- Modify: `pos-locale/pagina.test.ts` se serve (no), `strumenti/pacchetto-bistrot.js` prova? (non ce n'è: verifica a mano nel rapporto che lo script gira: `node strumenti/pacchetto-bistrot.js C:/Users/admin/AppData/Local/Temp/pacchetto-prova` e la cartella `pagina/cucina` esiste; poi cancellare la cartella di prova)

**Interfaces (consumes):** `postazioni-salva` (Task 3); `allinea-giu` restituisce anche `postazione: [...]` (Task 2). Costante nella pagina: `const PC_BISTROT = 'http://192.168.0.18:8080';` (il PC del Bistrot, 6 settembre 2026).

- [ ] **Step 1: prova sul codice** in `pos-schede.test.ts`: la pagina contiene `postazioni-salva`, `nuova_chiave`, `PC_BISTROT`, `/cucina?l=`, e i testi «Postazioni» e «schermo».
- [ ] **Step 2: rossa.**
- [ ] **Step 3: la sezione**. Dove `vistaPosTavoli` carica `D` da `allinea-giu`, aggiungere `postazioni: j.postazione || []`. In `disegna()`, dopo il riquadro «Locali», un riquadro:
```
<div class="riquadro"><b>Postazioni</b><div class="mini">Come ogni postazione riceve le comande: solo carta, carta e schermo, o solo schermo (la carta esce di ripiego se nessuno schermo mostra la comanda entro i secondi indicati; 0 = mai). «Nuova chiave» dà il link da aprire sullo schermo, una volta sola.</div>
<table><tr><th>Locale</th><th>Stampante</th><th>Nome</th><th>Schermo</th><th>Stampa sempre</th><th>Ripiego (s)</th><th>Nuova chiave</th></tr> … una riga per postazione (data-post="locale|stampante", campi data-p="nome|schermo|stampa_sempre|ripiego_s|nuova_chiave") … </table>
<button type="button" class="azione" id="ptSalvaPost" style="width:auto;">Salva le postazioni</button><div class="esito" id="ptEsitoPost"></div><div id="ptChiavi"></div></div>
```
Per ogni locale mancano le righe cucina/bar? Mostrarle lo stesso con i default (nome `Cucina <locale>` / `Bar <locale>`, schermo no, stampa sempre sì, 30): si creano al salvataggio.
- [ ] **Step 4: il salvataggio**: `ptSalvaPost` raccoglie le righe (`valoreCampo` come le altre), chiama `chiama('?a=postazioni-salva', { method: 'POST', body: JSON.stringify({ postazioni }) }, FUNZIONE_POS)`; in `j.chiavi` per ogni voce mostra in `#ptChiavi` un riquadro: nome, il link cloud `https://www.hoteltermeleonardo.com/cucina?l=${locale}&s=${stampante}&k=${chiave}` e il link PC `${PC_BISTROT}/cucina?l=…&s=…&k=…`, con un pulsante «copia» (`navigator.clipboard.writeText`) e la nota «si vede una volta sola: chi la perde ne chiede una nuova». Poi ricarica `D`.
- [ ] **Step 5: `pacchetto-bistrot.js`**: nel passo `[3/4]`, dopo le icone: `fs.mkdirSync(path.join(pagina, 'cucina'), { recursive: true }); for (const f of ['index.html', 'schermo.js']) fs.copyFileSync(path.join('pagine/cucina', f), path.join(pagina, 'cucina', f));` e aggiornare il commento in testa (la pagina dello schermo va sul PC, 6 settembre 2026).
- [ ] **Step 6: prove verdi (`pagine/buoni/*.test.ts` e la suite intera); commit** «Monitor cucina: le postazioni dal back office, con il link dello schermo; il pacchetto porta anche /cucina».

Il sito (`C:/Users/admin/termeleonardo/frontend/vercel.json`, repo separato) lo tocca il controllore in Task 8: due riscritture come `/ordina`:
```json
{ "source": "/cucina", "destination": "https://arrivo-terme-leonardo.vercel.app/cucina/" },
{ "source": "/cucina/:percorso*", "destination": "https://arrivo-terme-leonardo.vercel.app/cucina/:percorso*" }
```

---

### Task 8 (controllore): in linea, dal vivo

- [ ] `node strumenti/migra.js supabase/2026-09-06-pos-schermo.sql`; verificare con una query che `pos_postazione` ha le quattro righe e `pos_stampa` le colonne.
- [ ] Deploy `pos`; push del repo (pagine su Vercel); riscrittura `/cucina` nel sito e push; verifica su `arrivo-terme-leonardo.vercel.app/cucina/` ogni 30 s.
- [ ] `node strumenti/pacchetto-bistrot.js`.
- [ ] Dal back office (accesso reception): «Nuova chiave» per Banco Bistrot → link; aprirlo in Chrome senza finestra → «Tocca per iniziare» si vede; con puppeteer: tocco, poi `?a=schermo` risponde con `biglietti: []`.
- [ ] Prova completa: dal palmare di prova (cloud) inviare una comanda al bar del Bistrot → compare sullo schermo (query o pagina); «pronto» → `sala` dice `pronto_in_cucina: true`; niente stampa dal cloud (il PC tace da >90 s: attenzione, il cron proverebbe a stampare da `POS_STAMPANTE_BAR` se il secret esiste: controllare prima i secret e, se servono, mettere `stampa_sempre = false` alla postazione di prova per non far uscire carta durante la prova; poi rimettere `true`). Ripulire i conti di prova.
- [ ] Memoria (`pos-stato.md`) e risposta alla proprietà: i due link, cosa comprare, come si prova per due settimane.
