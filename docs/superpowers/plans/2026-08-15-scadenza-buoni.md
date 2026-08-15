# Scadenza dei buoni: proroga visibile e promemoria — piano di realizzazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** un buono che scade mentre l'hotel è chiuso nasce già con una scadenza usabile, lo dice a chi lo riceve, e trenta giorni prima avvisa chi ce l'ha in mano.

**Architecture:** le date della chiusura stanno in una tabella (`stagione_chiusura`), non nel codice, perché cambiano ogni anno e le sa la reception. Una funzione pura `scadenza.ts` prende la data d'acquisto e le stagioni e restituisce **due** date — quella valida e quella naturale dei dodici mesi — più il fatto che ci sia stata una proroga. `acquista.ts` la chiama e salva entrambe. Foglio, email e anteprima leggono le due colonne e scrivono la riga di spiegazione solo quando serve. Un lavoro programmato giornaliero cerca i buoni in scadenza fra trenta giorni e non ancora avvisati, manda l'email e segna la data d'invio.

**Tech Stack:** Deno / TypeScript (Supabase Edge Functions), PostgreSQL via Management API, Resend per le email, JavaScript nudo per le pagine (`pagine/buoni/buono.js`).

**Spec:** `docs/superpowers/specs/2026-08-14-scadenza-buoni-design.md` — va letta prima di iniziare.

## Global Constraints

- **Le date della chiusura non si scrivono nel codice.** Stagione 2026/2027: chiusura **29 novembre 2026**, riapertura **13 febbraio 2027**. Vivono nella tabella `stagione_chiusura`, una riga per stagione.
- **La regola della proroga:** se la scadenza naturale cade nella chiusura (estremi compresi), si sposta a **riapertura + 1 mese**. Con le date di quest'anno: **13 marzo 2027**.
- **Se per una stagione le date mancano, non si proroga niente:** si emette la scadenza naturale. Meglio un promemoria mancato che una proroga inventata.
- **Il numero di mesi non si scrive mai** in nessun testo mostrato al cliente, in nessuna lingua. Né "due mesi", né "tre mesi". Si scrive solo la data nuova.
- **La riga di spiegazione compare solo quando c'è stata una proroga.**
- **Quattro lingue sempre:** `it`, `de`, `en`, `fr`. Un testo nuovo senza tutte e quattro è incompleto.
- **Il foglio stampato e l'anteprima devono dire la stessa cosa.** Esiste già `pagine/buoni/listino-copie.test.ts` che confronta le copie: va esteso, mai aggirato.
- **Mai indicizzare un oggetto con una chiave che arriva da fuori.** Si usa `Object.hasOwn(OGGETTO, chiave)` o un elenco chiuso con `.includes`. Questo progetto ha già pagato quattro volte questo difetto.
- **Il promemoria si manda una volta sola per buono**, e mai per buoni annullati, già riscossi per intero o già scaduti.
- **Le date si maneggiano a mezzogiorno UTC** (`new Date(s + 'T12:00:00Z')`), come già fa `richieste/tipi.ts:26`: evita che un fuso sposti un giorno.
- I test si eseguono con `deno test --allow-env` dentro `supabase/functions/buoni/`.

---

### Task 1: La regola della scadenza, come funzione pura

**Files:**
- Create: `supabase/functions/buoni/scadenza.ts`
- Test: `supabase/functions/buoni/scadenza.test.ts`

**Interfaces:**
- Consumes: niente.
- Produces:
  ```ts
  export type Stagione = { chiusura: string; riapertura: string };  // 'AAAA-MM-GG'
  export type Scadenza = {
    scade_il: string;        // la data che vale
    scade_il_base: string;   // i dodici mesi pieni, sempre valorizzata
    prorogato: boolean;
  };
  export function calcolaScadenza(acquisto: Date, stagioni: Stagione[]): Scadenza;
  ```

- [ ] **Step 1: Scrivere i test che falliscono**

```ts
import { assertEquals } from 'jsr:@std/assert';
import { calcolaScadenza, type Stagione } from './scadenza.ts';

/* Le date vere della stagione 2026/2027, dalla proprietà. */
const STAGIONI: Stagione[] = [
  { chiusura: '2026-11-29', riapertura: '2027-02-13' },
];

const acquisto = (s: string) => new Date(s + 'T12:00:00Z');

Deno.test('fuori dalla chiusura: dodici mesi pieni, nessuna proroga', () => {
  assertEquals(calcolaScadenza(acquisto('2026-08-15'), STAGIONI), {
    scade_il: '2027-08-15', scade_il_base: '2027-08-15', prorogato: false,
  });
});

Deno.test('dentro la chiusura: spostata a riapertura piu un mese', () => {
  /* comprato il 30 novembre 2025 -> scadrebbe il 30 novembre 2026, che e'
     il giorno dopo la chiusura: l'hotel e' chiuso, si sposta */
  assertEquals(calcolaScadenza(acquisto('2025-11-30'), STAGIONI), {
    scade_il: '2027-03-13', scade_il_base: '2026-11-30', prorogato: true,
  });
});

Deno.test('il giorno della chiusura conta come chiuso', () => {
  assertEquals(calcolaScadenza(acquisto('2025-11-29'), STAGIONI).prorogato, true);
});

Deno.test('il giorno della riapertura conta come chiuso: nessun margine per prenotare', () => {
  const r = calcolaScadenza(acquisto('2026-02-13'), STAGIONI);
  assertEquals(r.scade_il_base, '2027-02-13');
  assertEquals(r.prorogato, true);
  assertEquals(r.scade_il, '2027-03-13');
});

Deno.test('il giorno prima della chiusura non si tocca', () => {
  assertEquals(calcolaScadenza(acquisto('2025-11-28'), STAGIONI).prorogato, false);
});

Deno.test('il giorno dopo la riapertura non si tocca', () => {
  assertEquals(calcolaScadenza(acquisto('2026-02-14'), STAGIONI).prorogato, false);
});

Deno.test('senza le date della stagione non si proroga: scadenza naturale', () => {
  assertEquals(calcolaScadenza(acquisto('2025-11-30'), []), {
    scade_il: '2026-11-30', scade_il_base: '2026-11-30', prorogato: false,
  });
});

Deno.test('sceglie la stagione giusta fra piu stagioni', () => {
  const due: Stagione[] = [
    { chiusura: '2026-11-29', riapertura: '2027-02-13' },
    { chiusura: '2027-11-28', riapertura: '2028-02-12' },
  ];
  assertEquals(calcolaScadenza(acquisto('2026-12-01'), due).scade_il, '2028-03-12');
});

Deno.test('29 febbraio: i dodici mesi non inventano un giorno che non esiste', () => {
  /* comprato il 29 febbraio 2028 (bisestile): un anno dopo il 29 febbraio
     non esiste. Il risultato deve essere una data vera, non il 1 marzo per
     scivolamento silenzioso di Date. */
  const r = calcolaScadenza(acquisto('2028-02-29'), []);
  assertEquals(r.scade_il_base, '2029-02-28');
});

Deno.test('riapertura piu un mese: il 31 non diventa il 3 del mese dopo', () => {
  const strane: Stagione[] = [{ chiusura: '2026-11-29', riapertura: '2027-01-31' }];
  /* 31 gennaio + 1 mese: il 31 febbraio non esiste */
  assertEquals(calcolaScadenza(acquisto('2026-01-15'), strane).scade_il, '2027-02-28');
});
```

- [ ] **Step 2: Eseguirli e vederli fallire**

Run: `cd supabase/functions/buoni && deno test --allow-env scadenza.test.ts`
Expected: FAIL — `Module not found ./scadenza.ts`.

- [ ] **Step 3: Scrivere `scadenza.ts`**

Il punto delicato è che `Date.setFullYear`/`setMonth` **scivolano** in silenzio: il 29 febbraio più un anno diventa il 1 marzo, il 31 gennaio più un mese diventa il 3 marzo. Va fermato esplicitamente, altrimenti un cliente su mille riceve una data che non è quella che gli spetta.

```ts
/* ============================================================
   scadenza.ts — quando scade un buono, e perche' a volte piu' tardi.

   Un buono vale dodici mesi. Ma l'hotel chiude da fine novembre a meta'
   febbraio, e un buono che scade dentro quella finestra e' un buono che il
   cliente NON PUO' usare: non per una regola, perche' l'albergo e' chiuso.

   Allora si sposta — ma non "di due mesi", che era la prima idea e falliva
   proprio dove serviva (30 novembre + 2 mesi = 30 gennaio, ancora chiuso).
   Si sposta a UNA DATA CERTAMENTE USABILE: un mese dopo la riapertura. Il
   calcolo non dipende da quanto manca alla scadenza, quindi due clienti che
   comprano a un giorno di distanza non si ritrovano con proroghe diverse.

   Le date della chiusura NON stanno qui: cambiano ogni stagione e le sa la
   reception. Arrivano dalla tabella stagione_chiusura. Se per una stagione
   mancano, non si proroga niente — meglio un promemoria mancato che una
   proroga inventata su date sbagliate.
   ============================================================ */

export type Stagione = { chiusura: string; riapertura: string };

export type Scadenza = {
  /** la data che vale, l'unica che va scritta grande sul foglio */
  scade_il: string;
  /** i dodici mesi pieni: serve a scrivere «sarebbe scaduto il...» */
  scade_il_base: string;
  prorogato: boolean;
};

const gg = (d: Date) => d.toISOString().slice(0, 10);

/* Date scivola in silenzio: 2028-02-29 + 1 anno diventa 2029-03-01, e
   2027-01-31 + 1 mese diventa 2027-03-03. Su una scadenza sono giorni
   regalati o tolti a caso. Si costruisce la data a mano e, se il giorno
   e' straripato nel mese dopo, si torna all'ultimo giorno del mese giusto. */
function sposta(d: Date, anni: number, mesi: number): Date {
  const a = d.getUTCFullYear() + anni;
  const m = d.getUTCMonth() + mesi;
  const giorno = d.getUTCDate();
  const fine = new Date(Date.UTC(a, m + 1, 0)).getUTCDate();  // ultimo giorno del mese
  return new Date(Date.UTC(a, m, Math.min(giorno, fine), 12));
}

function data(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(s + 'T12:00:00Z');
  return isNaN(d.getTime()) || gg(d) !== s ? null : d;
}

export function calcolaScadenza(acquisto: Date, stagioni: Stagione[]): Scadenza {
  const base = sposta(acquisto, 1, 0);
  const naturale = gg(base);

  for (const s of stagioni) {
    const chiusura = data(s?.chiusura ?? '');
    const riapertura = data(s?.riapertura ?? '');
    /* una stagione mezza compilata non e' una stagione: si ignora, non si
       indovina il pezzo che manca */
    if (!chiusura || !riapertura || riapertura < chiusura) continue;
    /* estremi compresi: il giorno della riapertura non lascia margine per
       telefonare e trovare posto */
    if (base >= chiusura && base <= riapertura) {
      return { scade_il: gg(sposta(riapertura, 0, 1)), scade_il_base: naturale, prorogato: true };
    }
  }
  return { scade_il: naturale, scade_il_base: naturale, prorogato: false };
}
```

- [ ] **Step 4: Eseguirli e vederli passare**

Run: `cd supabase/functions/buoni && deno test --allow-env scadenza.test.ts`
Expected: PASS, tutti.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/buoni/scadenza.ts supabase/functions/buoni/scadenza.test.ts
git commit -m "La scadenza di un buono non cade piu' dentro l'albergo chiuso"
```

---

### Task 2: La tabella delle stagioni, e `acquista.ts` che la usa

**Files:**
- Create: `supabase/migrazioni/2026-08-15-stagione-chiusura.sql`
- Modify: `supabase/functions/buoni/acquista.ts` (la scadenza a riga 191-192 e `DatiAcquisto` a riga 64)
- Modify: `supabase/functions/buoni/index.ts` (chi chiama `validaAcquisto`, e l'inserimento della riga)
- Test: `supabase/functions/buoni/acquista.test.ts` (il test «scadenza a 12 mesi da oggi» a riga 57 va aggiornato, non cancellato)

**Interfaces:**
- Consumes: `calcolaScadenza`, `Stagione` da `./scadenza.ts` (Task 1).
- Produces: `validaAcquisto(b, stagioni: Stagione[] = [])` — il secondo parametro è nuovo e ha un default, così le chiamate esistenti nei test continuano a compilare; `DatiAcquisto` guadagna `scade_il_base: string` e `prorogato: boolean`.

- [ ] **Step 1: La migrazione**

```sql
-- Le date di chiusura e riapertura cambiano ogni anno e le sa la reception:
-- se stessero nel codice, ogni stagione richiederebbe una pubblicazione.
create table if not exists stagione_chiusura (
  id          uuid primary key default gen_random_uuid(),
  etichetta   text not null,               -- '2026/2027', per chi guarda
  chiusura    date not null,
  riapertura  date not null,
  creato_il   timestamptz not null default now(),
  constraint riapertura_dopo_chiusura check (riapertura > chiusura)
);

-- Nessun accesso pubblico: la leggono solo le funzioni, con la chiave di servizio.
alter table stagione_chiusura enable row level security;

insert into stagione_chiusura (etichetta, chiusura, riapertura)
values ('2026/2027', '2026-11-29', '2027-02-13')
on conflict do nothing;

-- Le due date del buono: quella che vale e quella naturale dei dodici mesi.
-- Senza la seconda non si puo' scrivere «sarebbe scaduto il...», e
-- ricalcolarla dopo darebbe una data diversa se il regolamento cambia.
alter table buono_regalo add column if not exists scade_il_base date;
alter table buono_regalo add column if not exists prorogato boolean not null default false;
```

Si applica con `node scratchpad/sql.js "<contenuto>"` oppure dalla console SQL di Supabase. **Verificare dopo:** `select * from stagione_chiusura;` deve restituire una riga con 2026-11-29 e 2027-02-13.

- [ ] **Step 2: Scrivere il test che fallisce**

In `acquista.test.ts`, sostituire il test «scadenza a 12 mesi da oggi» con:

```ts
import { type Stagione } from './scadenza.ts';

const STAGIONI: Stagione[] = [{ chiusura: '2026-11-29', riapertura: '2027-02-13' }];

Deno.test('senza stagioni: dodici mesi, e le due date coincidono', () => {
  const r = validaAcquisto(ACQUISTO_VALIDO, []);
  const attesa = new Date(); attesa.setFullYear(attesa.getFullYear() + 1);
  assertEquals(r.dati!.scade_il, attesa.toISOString().slice(0, 10));
  assertEquals(r.dati!.scade_il_base, r.dati!.scade_il);
  assertEquals(r.dati!.prorogato, false);
});

Deno.test('le stagioni arrivano da fuori, non dal codice di acquista', () => {
  /* si prova che validaAcquisto le USA davvero, con una stagione finta che
     copre l'anno intero: qualunque scadenza deve risultare prorogata */
  const anno = new Date().getFullYear() + 1;
  const sempre: Stagione[] = [{ chiusura: `${anno}-01-01`, riapertura: `${anno}-12-31` }];
  const r = validaAcquisto(ACQUISTO_VALIDO, sempre);
  assertEquals(r.dati!.prorogato, true);
  assertEquals(r.dati!.scade_il, `${anno + 1}-01-31`);
  assertNotEquals(r.dati!.scade_il, r.dati!.scade_il_base);
});
```

(`ACQUISTO_VALIDO` è l'oggetto già usato negli altri test del file: riusare quello, non inventarne uno nuovo. Aggiungere `assertNotEquals` all'import da `jsr:@std/assert`.)

- [ ] **Step 3: Eseguirlo e vederlo fallire**

Run: `cd supabase/functions/buoni && deno test --allow-env acquista.test.ts`
Expected: FAIL — `scade_il_base` non esiste su `DatiAcquisto`.

- [ ] **Step 4: Modificare `acquista.ts`**

In cima al file, accanto agli altri import:
```ts
import { calcolaScadenza, type Stagione } from './scadenza.ts';
```

In `DatiAcquisto` (riga 64), accanto a `scade_il: string;`:
```ts
  scade_il_base: string;
  prorogato: boolean;
```

Sostituire le righe 191-192 e il campo `scade_il` del ritorno:
```ts
  /* scadenza: dodici mesi, spostati se cadrebbero ad albergo chiuso.
     Le stagioni arrivano da fuori (tabella stagione_chiusura): qui non
     c'e' nessuna data scritta a mano, apposta. */
  const scadenza = calcolaScadenza(new Date(), stagioni);
```
e nel ritorno, al posto di `scade_il: scade.toISOString().slice(0, 10)`:
```ts
    scade_il: scadenza.scade_il,
    scade_il_base: scadenza.scade_il_base,
    prorogato: scadenza.prorogato,
```

E la firma (riga 154):
```ts
export function validaAcquisto(b: Record<string, unknown>, stagioni: Stagione[] = []):
  { errore?: string; dati?: DatiAcquisto } {
```

- [ ] **Step 5: Eseguire e vedere passare**

Run: `cd supabase/functions/buoni && deno test --allow-env`
Expected: PASS — tutti i test del modulo, non solo quelli nuovi.

- [ ] **Step 6: Collegare `index.ts`**

Trovare la chiamata a `validaAcquisto` in `index.ts` e farla precedere dalla lettura delle stagioni:

```ts
/* Le stagioni si leggono a ogni acquisto e non si tengono in memoria: la
   funzione gira su istanze diverse, e una cache qui vorrebbe dire due
   clienti con due regole diverse a seconda di quale istanza li serve.
   Se la lettura fallisce si prosegue senza: la scadenza naturale e' un
   ripiego onesto, perdere l'acquisto no. */
let stagioni: Stagione[] = [];
try {
  const { data } = await db.from('stagione_chiusura').select('chiusura, riapertura');
  stagioni = (data ?? []) as Stagione[];
} catch (e) { console.error('stagioni non lette, scadenza naturale:', e); }
```
e passarle: `validaAcquisto(corpo, stagioni)`.

Nell'inserimento della riga in `buono_regalo`, aggiungere le due colonne nuove:
```ts
  scade_il_base: d.scade_il_base,
  prorogato: d.prorogato,
```

Aggiungere `scade_il_base, prorogato` anche al `.select(...)` di `?a=stampa` (riga ~305) e a quello del back office (riga ~269), altrimenti il foglio non potrà scrivere la spiegazione.

- [ ] **Step 7: Verificare che compili**

Run: `cd supabase/functions/buoni && deno check index.ts && deno test --allow-env`
Expected: nessun errore, tutti i test verdi.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrazioni/ supabase/functions/buoni/
git commit -m "Le date della chiusura stanno in tabella, non nel codice: le cambia la reception"
```

---

### Task 3: La proroga si vede — foglio, email e anteprima, quattro lingue

**Files:**
- Modify: `supabase/functions/buoni/email-buono.ts` (i quattro blocchi di testi, righe 23/36/49/62; il punto dove si scrive `e.valido(...)`, riga 230)
- Modify: `pagine/buoni/buono.js` (i quattro blocchi `valido:`, righe 96/102/108/114; i due punti che scrivono la scadenza, righe 307 e 404)
- Test: `supabase/functions/buoni/email-buono.test.ts`, `pagine/buoni/buono.test.ts`, `pagine/buoni/listino-copie.test.ts`

**Interfaces:**
- Consumes: le colonne `scade_il`, `scade_il_base`, `prorogato` sulla riga del buono (Task 2).
- Produces: in entrambi i file una voce di testo nuova per ognuna delle quattro lingue:
  ```
  prorogato: (naturale: string, nuova: string) => string
  ```

- [ ] **Step 1: I testi, nelle quattro lingue**

Identici nei due file (il test delle copie li confronta):

```js
it: (n, x) => `La validità sarebbe scaduta il ${n}, quando l’hotel è chiuso: l’abbiamo prorogata fino al ${x}.`,
de: (n, x) => `Die Gültigkeit wäre am ${n} abgelaufen, während das Hotel geschlossen ist: Wir haben sie bis zum ${x} verlängert.`,
en: (n, x) => `It would have expired on ${n}, while the hotel is closed: we have extended it to ${x}.`,
fr: (n, x) => `La validité aurait expiré le ${n}, alors que l’hôtel est fermé : nous l’avons prolongée jusqu’au ${x}.`,
```

Nessuno dei quattro nomina un numero di mesi. È voluto: vedi i vincoli globali.

- [ ] **Step 2: Scrivere i test che falliscono**

```ts
Deno.test('buono prorogato: si vedono tutte e due le date', () => {
  const html = emailBuonoHTML({ ...BUONO, lingua: 'it',
    scade_il: '2027-03-13', scade_il_base: '2026-11-30', prorogato: true });
  assertStringIncludes(html, 'Valido fino al 13 marzo 2027');
  assertStringIncludes(html, '30 novembre 2026');
  assertStringIncludes(html, 'prorogata fino al 13 marzo 2027');
});

Deno.test('buono non prorogato: nessuna spiegazione, solo la data', () => {
  const html = emailBuonoHTML({ ...BUONO, lingua: 'it',
    scade_il: '2027-08-15', scade_il_base: '2027-08-15', prorogato: false });
  assertStringIncludes(html, 'Valido fino al 15 agosto 2027');
  assertEquals(html.includes('sarebbe scaduta'), false);
});

Deno.test('la spiegazione non nomina mai un numero di mesi, in nessuna lingua', () => {
  for (const lingua of ['it', 'de', 'en', 'fr']) {
    const html = emailBuonoHTML({ ...BUONO, lingua,
      scade_il: '2027-03-13', scade_il_base: '2026-11-30', prorogato: true });
    /* «due mesi», «zwei Monate», «two months», «deux mois» — e qualunque
       altro numero attaccato alla parola mese */
    assertEquals(/\b(due|zwei|two|deux|\d+)\s+(mesi|monate|months|mois)\b/i.test(html), false,
      `la lingua ${lingua} nomina un numero di mesi`);
  }
});

Deno.test('senza scade_il_base non si inventa niente: si mostra solo la data valida', () => {
  /* i buoni emessi prima di questa modifica non hanno la colonna popolata */
  const html = emailBuonoHTML({ ...BUONO, lingua: 'it',
    scade_il: '2027-08-15', scade_il_base: null, prorogato: true });
  assertStringIncludes(html, 'Valido fino al 15 agosto 2027');
  assertEquals(html.includes('sarebbe scaduta'), false);
});
```

Gli stessi quattro, tradotti su `buonoStampaHTML`, in `pagine/buoni/buono.test.ts`.

- [ ] **Step 3: Eseguirli e vederli fallire**

Run: `cd supabase/functions/buoni && deno test --allow-env email-buono.test.ts`
Expected: FAIL — la spiegazione non c'è.

- [ ] **Step 4: Scrivere la riga, nei due file**

In `email-buono.ts`, dopo la riga 230:
```ts
${b.prorogato && b.scade_il_base ? `
  <div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;color:#8A8A8A;margin-top:3px;line-height:1.45;">
    ${e.prorogato(dataLingua(b.scade_il_base, L), dataLingua(b.scade_il, L))}
  </div>` : ''}
```
La data valida resta quella grande e non cambia dimensione: alla reception non deve mai venire il dubbio su quale delle due leggere.

Stessa cosa in `buono.js` ai due punti (riga 307 e riga 404), con le classi di quel foglio.

- [ ] **Step 5: Eseguire e vedere passare**

Run: `cd supabase/functions/buoni && deno test --allow-env` e `cd pagine/buoni && deno test --allow-env`
Expected: PASS.

- [ ] **Step 6: Estendere il test delle copie**

`pagine/buoni/listino-copie.test.ts` confronta i testi fra il foglio e l'email. Aggiungere `prorogato` all'elenco delle voci confrontate, così una traduzione cambiata in un file solo fa fallire il test invece di divergere in silenzio.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/buoni/ pagine/buoni/
git commit -m "Il buono prorogato dice anche da quando: due date, una sola vale"
```

---

### Task 4: La traccia dell'invio, e chi va avvisato

**Files:**
- Create: `supabase/functions/buoni/promemoria.ts` (selezione pura, niente rete)
- Test: `supabase/functions/buoni/promemoria.test.ts`
- Modify: `supabase/migrazioni/2026-08-15-stagione-chiusura.sql` — no: **creare** `supabase/migrazioni/2026-08-15-promemoria.sql`

**Interfaces:**
- Consumes: niente.
- Produces:
  ```ts
  export type RigaBuono = {
    codice: string; stato: string; scade_il: string | null;
    riscosso_il: string | null; promemoria_il: string | null;
    destinatario_email: string | null; acquirente_email: string | null;
  };
  export const GIORNI_PRIMA = 30;
  export function daAvvisare(righe: RigaBuono[], oggi: Date): { codice: string; email: string }[];
  ```

- [ ] **Step 1: La migrazione**

```sql
-- Senza traccia dell'invio, un lavoro che gira ogni giorno manderebbe il
-- promemoria ogni giorno: da favore a molestia in una settimana.
alter table buono_regalo add column if not exists promemoria_il timestamptz;
```

- [ ] **Step 2: Scrivere i test che falliscono**

```ts
import { assertEquals } from 'jsr:@std/assert';
import { daAvvisare, type RigaBuono } from './promemoria.ts';

const OGGI = new Date('2026-08-15T09:00:00Z');

const riga = (p: Partial<RigaBuono> = {}): RigaBuono => ({
  codice: 'LEO-1', stato: 'pagato', scade_il: '2026-09-14',
  riscosso_il: null, promemoria_il: null,
  destinatario_email: 'silvia@example.com', acquirente_email: 'marco@example.com',
  ...p,
});

Deno.test('trenta giorni prima: si avvisa', () => {
  assertEquals(daAvvisare([riga()], OGGI), [{ codice: 'LEO-1', email: 'silvia@example.com' }]);
});

Deno.test('trentuno giorni prima: non ancora', () => {
  assertEquals(daAvvisare([riga({ scade_il: '2026-09-15' })], OGGI), []);
});

Deno.test('ventinove giorni prima: si avvisa lo stesso, non si salta il giorno perso', () => {
  /* se il lavoro non gira un giorno, chi scadeva quel giorno non deve
     restare senza avviso per sempre */
  assertEquals(daAvvisare([riga({ scade_il: '2026-09-13' })], OGGI).length, 1);
});

Deno.test('gia scaduto: non si avvisa', () => {
  assertEquals(daAvvisare([riga({ scade_il: '2026-08-14' })], OGGI), []);
});

Deno.test('gia avvisato: non si ripete', () => {
  assertEquals(daAvvisare([riga({ promemoria_il: '2026-08-14T09:00:00Z' })], OGGI), []);
});

Deno.test('gia riscosso: non si avvisa', () => {
  assertEquals(daAvvisare([riga({ riscosso_il: '2026-07-01T10:00:00Z' })], OGGI), []);
});

Deno.test('annullato: non si avvisa', () => {
  assertEquals(daAvvisare([riga({ stato: 'annullato' })], OGGI), []);
});

Deno.test('non pagato: non si avvisa', () => {
  assertEquals(daAvvisare([riga({ stato: 'attesa' })], OGGI), []);
});

Deno.test('senza email del destinatario si scrive a chi ha comprato', () => {
  assertEquals(daAvvisare([riga({ destinatario_email: null })], OGGI),
    [{ codice: 'LEO-1', email: 'marco@example.com' }]);
});

Deno.test('senza nessun indirizzo non si manda niente, e non si esplode', () => {
  assertEquals(daAvvisare([riga({ destinatario_email: null, acquirente_email: null })], OGGI), []);
});

Deno.test('scade_il assente: si salta', () => {
  assertEquals(daAvvisare([riga({ scade_il: null })], OGGI), []);
});
```

- [ ] **Step 3: Eseguirli e vederli fallire**

Run: `cd supabase/functions/buoni && deno test --allow-env promemoria.test.ts`
Expected: FAIL — modulo inesistente.

- [ ] **Step 4: Scrivere `promemoria.ts`**

```ts
/* ============================================================
   promemoria.ts — chi va avvisato che il buono sta per scadere.

   Modulo puro: righe dentro, elenco fuori. Nessuna rete, nessun database,
   cosi' la regola si prova per intero senza toccare la produzione.

   La finestra e' «trenta giorni o meno, e non ancora scaduto», non
   «esattamente trenta»: se il lavoro non gira un giorno — e prima o poi
   non girera' — con l'uguaglianza secca chi scadeva quel giorno resterebbe
   senza avviso per sempre.
   ============================================================ */

export const GIORNI_PRIMA = 30;

export type RigaBuono = {
  codice: string; stato: string; scade_il: string | null;
  riscosso_il: string | null; promemoria_il: string | null;
  destinatario_email: string | null; acquirente_email: string | null;
};

const GIORNO_MS = 86400000;
const valida = (e: string | null) => !!e && /.+@.+\..+/.test(e);

export function daAvvisare(righe: RigaBuono[], oggi: Date): { codice: string; email: string }[] {
  const adesso = Date.UTC(oggi.getUTCFullYear(), oggi.getUTCMonth(), oggi.getUTCDate());
  const fuori: { codice: string; email: string }[] = [];

  for (const r of righe) {
    if (r.stato !== 'pagato') continue;          // annullato, in attesa: niente
    if (r.riscosso_il) continue;                 // gia' speso
    if (r.promemoria_il) continue;               // gia' avvisato, una volta sola
    if (!r.scade_il) continue;

    const scade = new Date(r.scade_il + 'T12:00:00Z').getTime();
    if (isNaN(scade)) continue;
    const mancano = Math.round((scade - adesso) / GIORNO_MS);
    if (mancano < 0 || mancano > GIORNI_PRIMA) continue;

    /* a chi ha il buono in mano: il destinatario se il suo indirizzo c'e',
       altrimenti chi l'ha comprato. Non a entrambi — chi ha regalato ha gia'
       fatto la sua parte. */
    const email = valida(r.destinatario_email) ? r.destinatario_email!
      : valida(r.acquirente_email) ? r.acquirente_email! : '';
    if (!email) continue;

    fuori.push({ codice: r.codice, email });
  }
  return fuori;
}
```

- [ ] **Step 5: Eseguire e vedere passare**

Run: `cd supabase/functions/buoni && deno test --allow-env promemoria.test.ts`
Expected: PASS, tutti.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrazioni/ supabase/functions/buoni/promemoria.ts supabase/functions/buoni/promemoria.test.ts
git commit -m "Chi va avvisato che il buono scade, e chi no"
```

---

### Task 5: L'email del promemoria e il lavoro che la manda

**Files:**
- Create: `supabase/functions/buoni/email-promemoria.ts`
- Test: `supabase/functions/buoni/email-promemoria.test.ts`
- Modify: `supabase/functions/buoni/index.ts` (azione nuova `?a=promemoria`, protetta)

**Interfaces:**
- Consumes: `daAvvisare` da `./promemoria.ts` (Task 4); il mittente e lo stile già usati in `email-buono.ts`.
- Produces: `emailPromemoriaHTML(b, lingua): string` e `oggettoPromemoria(lingua): string`.

- [ ] **Step 1: Scrivere i test che falliscono**

```ts
Deno.test('il promemoria dice quanto vale, entro quando, e come si prenota', () => {
  const html = emailPromemoriaHTML({ codice: 'LEO-ABC', descrizione: 'Day Spa festivo',
    valore: 45, scade_il: '2026-09-14', destinatario: 'Silvia' }, 'it');
  assertStringIncludes(html, 'LEO-ABC');
  assertStringIncludes(html, '14 settembre 2026');
  assertStringIncludes(html, '+39 049 9939200');
});

Deno.test('nelle quattro lingue, e mai un oggetto vuoto', () => {
  for (const l of ['it', 'de', 'en', 'fr']) {
    const o = oggettoPromemoria(l);
    assertEquals(o.trim().length > 0, true, `oggetto vuoto per ${l}`);
    assertStringIncludes(emailPromemoriaHTML(BUONO, l), 'LEO-ABC');
  }
});

Deno.test('una lingua sconosciuta non rompe niente: si ripiega sull italiano', () => {
  /* la lingua arriva dalla riga del database, ma resta un valore esterno:
     mai indicizzare un oggetto con una chiave che arriva da fuori */
  assertEquals(oggettoPromemoria('toString'), oggettoPromemoria('it'));
  assertEquals(oggettoPromemoria('xx'), oggettoPromemoria('it'));
});
```

- [ ] **Step 2: Eseguirli e vederli fallire**

Run: `cd supabase/functions/buoni && deno test --allow-env email-promemoria.test.ts`
Expected: FAIL — modulo inesistente.

- [ ] **Step 3: Scrivere `email-promemoria.ts`**

Riusare la struttura e i colori di `email-buono.ts`. La scelta della lingua **con elenco chiuso**:
```ts
const LINGUE = ['it', 'de', 'en', 'fr'];
const L = LINGUE.includes(lingua) ? lingua : 'it';
```
Mai `TESTI[lingua]` diretto.

Il testo, in quattro lingue, dice: il buono è ancora valido, cosa comprende, la data di scadenza, e che si prenota telefonando allo **+39 049 9939200** o scrivendo a **info@termeleonardo.com**. Se il buono era stato prorogato, la data è già quella prorogata: non serve rispiegarlo.

- [ ] **Step 4: Eseguire e vedere passare**

Run: `cd supabase/functions/buoni && deno test --allow-env email-promemoria.test.ts`
Expected: PASS.

- [ ] **Step 5: L'azione `?a=promemoria` in `index.ts`**

Protetta come le altre azioni di servizio (`x-hotel-key`, come `?a=elenco`): non deve poterla far girare un estraneo. Legge i buoni candidati, chiama `daAvvisare`, per ognuno manda l'email e **subito dopo** scrive `promemoria_il`.

```ts
/* Si segna PRIMA di considerare fatto il giro, e per ogni buono
   singolarmente: se l'invio numero tre fallisce, i primi due restano
   segnati e non ripartono domani. Il caso peggiore e' un buono che non
   riceve l'avviso, non un cliente che lo riceve ogni giorno. */
```

Restituisce quanti ne ha mandati e quanti sono falliti, così si vede dal back office.

- [ ] **Step 6: Verificare che compili, e provare a vuoto**

Run: `cd supabase/functions/buoni && deno check index.ts && deno test --allow-env`
Poi, dopo la pubblicazione: chiamare `?a=promemoria` con la chiave e verificare che risponda `{ mandati: 0 }` — la tabella è vuota, quindi zero è la risposta giusta. Un numero diverso da zero significa che qualcosa non va.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/buoni/
git commit -m "Trenta giorni prima, un'email a chi ha il buono in mano"
```

---

### Task 6: Il testo delle condizioni, chiarito

**Files:**
- Modify: `pagine/buoni/buono.js` (riga 172 e le tre lingue accanto)
- Modify: `supabase/functions/buoni/email-buono.ts` (riga 96 e le tre lingue accanto)
- Test: `pagine/buoni/listino-copie.test.ts`

- [ ] **Step 1: Il testo nuovo**

Oggi dice *"l'hotel chiude ogni anno da fine novembre a febbraio"*, che si legge in due modi opposti — chiuso *per tutto* febbraio, o chiuso *fino a* febbraio. Diventa:

> Apertura stagionale: l'hotel chiude ogni anno da fine novembre a metà febbraio; il buono non è utilizzabile mentre l'hotel è chiuso. **Se la scadenza cade in quel periodo, la prolunghiamo noi fino a un mese dopo la riapertura, e la data prorogata è quella scritta sul buono.**

Nelle quattro lingue. Il resto della frase non si tocca.

- [ ] **Step 2: Il test che fallisce**

```ts
Deno.test('le condizioni non dicono piu "a febbraio", che si legge in due modi', () => {
  for (const l of ['it', 'de', 'en', 'fr']) {
    assertEquals(/da fine novembre a febbraio/.test(CONDIZIONI[l]), false);
  }
});
```

- [ ] **Step 3: Cambiare i due file, verificare che le copie coincidano**

Run: `cd pagine/buoni && deno test --allow-env listino-copie.test.ts`
Expected: PASS — i due testi identici parola per parola.

- [ ] **Step 4: Commit**

```bash
git add pagine/buoni/ supabase/functions/buoni/
git commit -m "«Fino a meta' febbraio», e la proroga scritta nelle condizioni"
```

---

## Alla fine

- Pubblicare la funzione: `node scratchpad/pubblica.js buoni`
- Pubblicare le pagine: commit e push (Vercel costruisce da solo)
- **Ricontare i buoni emessi:** `select count(*) from buono_regalo;` — se non è più zero, il buono comprato nel frattempo va guardato a mano.
- **Programmare il lavoro giornaliero** che chiama `?a=promemoria`. Va deciso con Raffael se con `pg_cron` dentro Supabase o con un servizio esterno: è una scelta operativa, non tecnica, e comporta dove finiscono gli errori quando falliscono.
