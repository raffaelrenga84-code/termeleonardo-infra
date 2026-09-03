# La chiusura invernale — piano di lavoro

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** sito e Outlook dicono che siamo chiusi dal 29 novembre 2026 al 12 febbraio 2027, quando riapriamo (13 febbraio) e da quando risponde l'ufficio prenotazioni (8 gennaio 2027, lun–ven 9–17), invece di «nessuna camera» o «metà febbraio».

**Architecture:** tre pezzi. (1) La funzione `richieste` legge la tabella `stagione_chiusura` e la espone alla pagina (`a=stagione`); `a=disponibilita` risponde `chiuso` quando il soggiorno tocca una chiusura, senza chiamare il motore. (2) La pagina Prenota ha un modulo puro `pagine/prenota/chiusura.js` con testi e regole, e due innesti: la riga in cima e il ramo `chiuso` della ricerca. (3) L'estensione aggiorna la copia delle date in `template.js`, aggiunge due funzioni pure (`faseChiusura`, `varianteChiusura`) e i testi nuovi in `template-extra.js`; il pulsante di Outlook sceglie la variante.

**Tech Stack:** Deno edge function (Supabase), pagine HTML statiche con moduli ES, estensione Chrome MV3, prove Deno `jsr:@std/assert`.

## Global Constraints

- Specifica: `docs/superpowers/specs/2026-09-03-chiusura-invernale-design.md`.
- Date: chiusura `2026-11-29`, riapertura `2027-02-13`, ufficio dal `2027-01-08`, auguri fino al `2027-01-06`; orari «lunedì–venerdì 9–17» / «Montag–Freitag 9–17 Uhr» / «Monday–Friday 9am–5pm» / «lundi–vendredi 9h–17h».
- Sito e funzioni leggono le date dalla tabella `stagione_chiusura`; l'8 gennaio e gli orari stanno nei testi della pagina (`UFFICIO` in `chiusura.js`). L'estensione tiene la sua copia in `CHIUSURA` (`template.js`): le date NON si ricopiano in `template-extra.js` (prova «la chiusura si aggiorna in un posto solo»).
- Niente date inventate: tabella non leggibile → `stagione: null`, la pagina non mostra niente di speciale.
- Prove prima del codice; `deno test --allow-read --allow-env <file>`; suite intera dalla radice `C:\Users\admin\termeleonardo-infra`.
- Estensione: dopo ogni modifica `node strumenti/estensione.js`; versione finale `2.26.0`. Script di appoggio e prove con `\\` si scrivono con il Write tool (memoria `script-con-barre-rovesciate`).
- Commit su `main` con `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

---

## File Structure

| file | responsabilità | task |
|---|---|---|
| `supabase/functions/richieste/dayspa-disponibilita.ts` | regole pure sulle stagioni; nuova `chiusuraCheCopre` | 1 |
| `supabase/functions/richieste/dayspa-disponibilita.test.ts` | prove di quelle regole | 1 |
| `supabase/functions/richieste/index.ts` | handler: `a=stagione` nuova, ramo `chiuso` in `a=disponibilita` | 2 |
| `supabase/functions/richieste/disponibilita-azione.test.ts` | prove sul sorgente dell'handler | 2 |
| `pagine/prenota/chiusura.js` (nuovo) | testi in quattro lingue, `dataEstesa`, `giornoPrima`, `dateDallaRiapertura`, `stagioneInCorso`, `UFFICIO` | 3 |
| `pagine/prenota/chiusura.test.ts` (nuovo) | prove del modulo, poi del cablaggio della pagina | 3, 4 |
| `pagine/prenota/index.html` | lettura di `?a=stagione`, riga in cima, ramo `chiuso` con pulsante | 4 |
| `estensione/template.js` | `CHIUSURA` con i campi nuovi; `faseChiusura`, `auguri`, `varianteChiusura` | 5 |
| `estensione/template-extra.js` | `CHIUSURA_T` con riapertura esatta, variante «chiusi ora», ufficio, auguri; `costruisciChiusuraBase` con `o.variante` e `o.oggi` | 5 |
| `estensione/chiusura.test.ts` | prove aggiornate e nuove | 5, 6 |
| `estensione/outlook-inject.js` | il pulsante sceglie la variante e lo dice nell'anteprima | 6 |
| `estensione/manifest.json` | 2.26.0 | 7 |

---

### Task 1: `chiusuraCheCopre` — il soggiorno tocca una chiusura?

**Files:**
- Modify: `supabase/functions/richieste/dayspa-disponibilita.ts` (dopo `aHotelChiuso`, riga 36)
- Test: `supabase/functions/richieste/dayspa-disponibilita.test.ts` (in coda)

**Interfaces:**
- Consumes: `type Stagione = { chiusura: string; riapertura: string }` (già esportato).
- Produces: `chiusuraCheCopre(check_in: string, check_out: string, stagioni: Stagione[]): Stagione | null`.

- [ ] **Step 1: la prova che fallisce**

```ts
import { chiusuraCheCopre } from './dayspa-disponibilita.ts';

const INVERNO = [{ chiusura: '2026-11-29', riapertura: '2027-02-13' }];

Deno.test('un soggiorno tocca la chiusura se ha almeno una notte dentro', () => {
  assertEquals(chiusuraCheCopre('2026-12-14', '2026-12-18', INVERNO), INVERNO[0], 'tutto dentro');
  assertEquals(chiusuraCheCopre('2026-11-25', '2026-12-02', INVERNO), INVERNO[0], 'a cavallo dell inizio');
  assertEquals(chiusuraCheCopre('2027-02-10', '2027-02-15', INVERNO), INVERNO[0], 'a cavallo della fine');
});

Deno.test('fuori dalla chiusura non tocca niente, e i bordi contano come si dorme', () => {
  assertEquals(chiusuraCheCopre('2026-11-20', '2026-11-29', INVERNO), null, 'parte il giorno di chiusura: ultima notte il 28');
  assertEquals(chiusuraCheCopre('2027-02-13', '2027-02-20', INVERNO), null, 'arriva il giorno di riapertura');
  assertEquals(chiusuraCheCopre('2026-10-01', '2026-10-05', []), null, 'senza stagioni');
  assertEquals(chiusuraCheCopre('x', '2026-12-18', INVERNO), null, 'una data rotta non tocca niente');
});
```

- [ ] **Step 2: rosso** — Run: `deno test --allow-read --allow-env supabase/functions/richieste/dayspa-disponibilita.test.ts` — Expected: FAIL, `chiusuraCheCopre` non esportata.

- [ ] **Step 3: il codice**, dopo `aHotelChiuso`:

```ts
/* LA STAGIONE CHE UN SOGGIORNO TOCCA: almeno una notte dentro, cioe'
   `check_in < riapertura && check_out > chiusura`. Il giorno di riapertura e'
   un arrivo buono; il giorno di chiusura e' una partenza buona (ultima notte
   la sera prima). Null se nessuna, o se le date non sono date. */
export function chiusuraCheCopre(check_in: string, check_out: string, stagioni: Stagione[]): Stagione | null {
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  if (!iso.test(check_in) || !iso.test(check_out)) return null;
  return stagioni.find((s) => check_in < s.riapertura && check_out > s.chiusura) ?? null;
}
```

- [ ] **Step 4: verde** — stesso comando, PASS.
- [ ] **Step 5: commit** — `git add supabase/functions/richieste/dayspa-disponibilita.ts supabase/functions/richieste/dayspa-disponibilita.test.ts && git commit -m "Una regola pura: il soggiorno tocca una chiusura"`

---

### Task 2: la funzione risponde `chiuso` e espone la stagione

**Files:**
- Modify: `supabase/functions/richieste/index.ts` — import a riga 30, dopo `const azione = …` (riga 222), dentro `a=disponibilita` dopo `const lingua = …` (riga 594)
- Test: `supabase/functions/richieste/disponibilita-azione.test.ts` (in coda)

**Interfaces:**
- Consumes: `chiusuraCheCopre` (Task 1), `leggiStagioni()` (già in index.ts), `risposta()`.
- Produces: `GET ?a=stagione` → `{ esito:'ok', stagione: {chiusura, riapertura} | null }`; `POST ?a=disponibilita` → `{ esito:'ok', proposte: [], chiuso: {chiusura, riapertura} }` quando tocca.

- [ ] **Step 1: la prova che fallisce** (sul sorgente: index.ts chiama `Deno.serve` in cima e non si importa)

```ts
const INDICE = Deno.readTextFileSync(new URL('index.ts', import.meta.url));

Deno.test('la stagione di chiusura si legge dalla tabella, non dal codice, e si espone alla pagina', () => {
  const m = INDICE.match(/if \(azione === 'stagione'\) \{([\s\S]*?)\n  \}/);
  assert(m, 'manca l azione stagione');
  assert(/leggiStagioni\(\)/.test(m![1]), 'non legge la tabella');
  assert(/s\.riapertura > oggi/.test(m![1]), 'non sceglie la stagione in corso o prossima');
  assert(/stagione: null|\?\? null/.test(m![1]), 'senza stagione deve rispondere null, non un errore');
});

Deno.test('con un soggiorno dentro la chiusura si risponde chiuso, senza chiamare il motore', () => {
  const m = INDICE.match(/if \(azione === 'disponibilita'\) \{([\s\S]*?)\n  \}/);
  assert(m, 'manca l azione disponibilita');
  const dove = m![1].indexOf('chiusuraCheCopre(');
  const fetchAMonte = m![1].indexOf("'/functions/v1/check-availability'");
  assert(dove > 0, 'non guarda le stagioni');
  assert(fetchAMonte > 0 && dove < fetchAMonte, 'guarda le stagioni DOPO aver chiamato il motore');
  assert(/proposte: \[\], chiuso/.test(m![1]), 'la risposta chiusa non porta la stagione');
});
```

- [ ] **Step 2: rosso** — Run: `deno test --allow-read --allow-env supabase/functions/richieste/disponibilita-azione.test.ts`

- [ ] **Step 3: il codice**

Riga 30, l'import da `./dayspa-disponibilita.ts` aggiunge `chiusuraCheCopre`. Dopo `const azione = url.searchParams.get('a') || '';`:

```ts
  /* ---------- pubblico: la stagione di chiusura in corso o prossima ----------
     La pagina Prenota la chiede per dire «siamo chiusi fino al…» invece di
     «nessuna camera». Solo chiusura e riapertura: i giorni dell'ufficio stanno
     nei testi della pagina. Tabella non leggibile: null, non un errore. */
  if (azione === 'stagione') {
    const oggi = new Date().toISOString().slice(0, 10);
    const stagione = (await leggiStagioni()).find((s) => s.riapertura > oggi) ?? null;
    return risposta({ esito: 'ok', stagione });
  }
```

Dentro `a=disponibilita`, dopo `const lingua = …;`:

```ts
    /* SIAMO CHIUSI IN QUELLE DATE: si dice, senza chiamare il motore — che
       risponderebbe «nessuna camera», ed e' un'altra cosa. La regola e' in
       dayspa-disponibilita.ts, pura e collaudata. */
    const chiuso = chiusuraCheCopre(v.dati.check_in, v.dati.check_out, await leggiStagioni());
    if (chiuso) return risposta({ esito: 'ok', proposte: [], chiuso });
```

- [ ] **Step 4: verde** — stesso comando, PASS; poi `deno test --allow-read --allow-env supabase/functions/richieste/` tutta verde.
- [ ] **Step 5: commit** — `git add supabase/functions/richieste/index.ts supabase/functions/richieste/disponibilita-azione.test.ts && git commit -m "La funzione dice «chiuso» invece di «nessuna camera», e espone la stagione alla pagina"`

---

### Task 3: `pagine/prenota/chiusura.js` — testi e regole della pagina

**Files:**
- Create: `pagine/prenota/chiusura.js`
- Test: `pagine/prenota/chiusura.test.ts` (nuovo)

**Interfaces:**
- Produces:
  - `UFFICIO = { dal: '2027-01-08', orari: { it, de, en, fr } }`
  - `dataEstesa(iso, lingua) → string` («29 novembre 2026», «29. November 2026», «29 November 2026», «29 novembre 2026»)
  - `giornoPrima(iso) → iso`
  - `dateDallaRiapertura(riapertura, notti) → { arrivo, partenza }` (notti minimo 1)
  - `stagioneInCorso(stagione, oggiISO) → stagione | null`
  - `TESTI[lingua]`: `chiusi(dal, ultimo, riapre)`, `cerca(riapre)`, `ora(ultimo, ufficio)`, `ufficioDa(da, orari)`, `ufficioOra(orari)`
  - `rigaChiusiOra(stagione, oggiISO, lingua) → string` ('' se non in corso)
  - `messaggioChiuso(chiuso, lingua) → string`

- [ ] **Step 1: la prova che fallisce**

```ts
import { assert, assertEquals } from 'jsr:@std/assert';
import {
  dataEstesa, dateDallaRiapertura, giornoPrima, messaggioChiuso, rigaChiusiOra, stagioneInCorso, TESTI, UFFICIO,
} from './chiusura.js';

const S = { chiusura: '2026-11-29', riapertura: '2027-02-13' };

Deno.test('le date si scrivono per esteso nella lingua', () => {
  assertEquals(dataEstesa('2026-11-29', 'it'), '29 novembre 2026');
  assertEquals(dataEstesa('2026-11-29', 'de'), '29. November 2026');
  assertEquals(dataEstesa('2027-02-13', 'en'), '13 February 2027');
  assertEquals(dataEstesa('2027-02-13', 'fr'), '13 février 2027');
  assertEquals(giornoPrima('2027-02-13'), '2027-02-12');
  assertEquals(giornoPrima('2027-03-01'), '2027-02-28');
});

Deno.test('«cerca dal 13 febbraio» tiene le stesse notti', () => {
  assertEquals(dateDallaRiapertura('2027-02-13', 4), { arrivo: '2027-02-13', partenza: '2027-02-17' });
  assertEquals(dateDallaRiapertura('2027-02-13', 0), { arrivo: '2027-02-13', partenza: '2027-02-14' }, 'almeno una notte');
});

Deno.test('la stagione e in corso solo fra chiusura e riapertura', () => {
  assertEquals(stagioneInCorso(S, '2026-11-28'), null);
  assertEquals(stagioneInCorso(S, '2026-11-29'), S);
  assertEquals(stagioneInCorso(S, '2027-02-12'), S);
  assertEquals(stagioneInCorso(S, '2027-02-13'), null);
  assertEquals(stagioneInCorso(null, '2026-12-15'), null);
});

Deno.test('la riga in cima: prima dell 8 gennaio dice da quando risponde l ufficio, dopo solo gli orari', () => {
  const prima = rigaChiusiOra(S, '2026-12-15', 'it');
  assert(prima.includes('fino al 12 febbraio 2027'), prima);
  assert(prima.includes("dall'8 gennaio 2027"), prima);
  assert(prima.includes(UFFICIO.orari.it), prima);
  const dopo = rigaChiusiOra(S, '2027-01-20', 'it');
  assert(!dopo.includes('8 gennaio'), dopo);
  assert(dopo.includes(UFFICIO.orari.it), dopo);
  assertEquals(rigaChiusiOra(S, '2026-10-01', 'it'), '', 'aperti: niente riga');
  for (const l of ['de', 'en', 'fr'] as const) assert(rigaChiusiOra(S, '2026-12-15', l).length > 40, l);
});

Deno.test('il messaggio della ricerca dice le date e la riapertura, in quattro lingue', () => {
  assertEquals(messaggioChiuso(S, 'it'), "In quel periodo l'hotel è chiuso, dal 29 novembre 2026 al 12 febbraio 2027. Riapriamo il 13 febbraio 2027.");
  assert(messaggioChiuso(S, 'de').includes('13. Februar 2027'));
  assert(messaggioChiuso(S, 'en').includes('13 February 2027'));
  assert(messaggioChiuso(S, 'fr').includes('13 février 2027'));
  assertEquals(TESTI.it.cerca('13 febbraio 2027'), 'Cerca dal 13 febbraio 2027');
});
```

- [ ] **Step 2: rosso** — Run: `deno test --allow-read --allow-env pagine/prenota/chiusura.test.ts` — Expected: FAIL, modulo mancante.

- [ ] **Step 3: il modulo**

```js
/* chiusura.js — la chiusura invernale come la dice la pagina Prenota.

   PERCHE'. Chi cercava date dentro la chiusura leggeva «non risultano camere
   libere»: non era vero, eravamo chiusi, e non sapeva quando riapriamo. Le
   date della stagione vengono dal server (tabella stagione_chiusura, azione
   a=stagione); qui stanno i testi, gli orari dell'ufficio e le regole pure,
   provate da chiusura.test.ts. */
'use strict';

/** L'ufficio prenotazioni durante la chiusura: da quando, e quando. Non
 *  sta nella tabella, che dice solo chiusura e riapertura. */
export const UFFICIO = {
  dal: '2027-01-08',
  orari: { it: 'lunedì–venerdì 9–17', de: 'Montag–Freitag 9–17 Uhr', en: 'Monday–Friday 9am–5pm', fr: 'lundi–vendredi 9h–17h' },
};

const MESI = {
  it: ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'],
  de: ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  fr: ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'],
};

const pezzi = (iso) => {
  const m = String(iso ?? '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? { a: +m[1], m: +m[2], g: +m[3] } : null;
};

/** «29 novembre 2026», nella lingua; il tedesco vuole il punto dopo il giorno. */
export function dataEstesa(iso, lingua) {
  const p = pezzi(iso);
  if (!p) return String(iso ?? '');
  const l = MESI[lingua] ? lingua : 'it';
  return `${p.g}${l === 'de' ? '.' : ''} ${MESI[l][p.m - 1]} ${p.a}`;
}

const isoDa = (d) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
const piuGiorni = (iso, n) => {
  const p = pezzi(iso);
  if (!p) return iso;
  return isoDa(new Date(Date.UTC(p.a, p.m - 1, p.g + n)));
};

export function giornoPrima(iso) { return piuGiorni(iso, -1); }

/** «Cerca dal 13 febbraio»: stesse notti, dalla riapertura. Almeno una. */
export function dateDallaRiapertura(riapertura, notti) {
  const n = Math.max(1, Number(notti) || 0);
  return { arrivo: riapertura, partenza: piuGiorni(riapertura, n) };
}

/** La stagione, se oggi ci siamo dentro: chiusura ≤ oggi < riapertura. */
export function stagioneInCorso(stagione, oggiISO) {
  if (!stagione || !stagione.chiusura || !stagione.riapertura) return null;
  return oggiISO >= stagione.chiusura && oggiISO < stagione.riapertura ? stagione : null;
}

export const TESTI = {
  it: {
    chiusi: (dal, ultimo, riapre) => `In quel periodo l'hotel è chiuso, dal ${dal} al ${ultimo}. Riapriamo il ${riapre}.`,
    cerca: (riapre) => `Cerca dal ${riapre}`,
    ora: (ultimo, ufficio) => `Siamo chiusi fino al ${ultimo}. Le prenotazioni per la nuova stagione sono aperte: ${ufficio}.`,
    ufficioDa: (da, orari) => `l'ufficio prenotazioni risponde dall'${da}, ${orari}`,
    ufficioOra: (orari) => `l'ufficio prenotazioni risponde ${orari}`,
  },
  de: {
    chiusi: (dal, ultimo, riapre) => `In diesem Zeitraum ist das Hotel geschlossen, vom ${dal} bis ${ultimo}. Wir öffnen am ${riapre} wieder.`,
    cerca: (riapre) => `Ab ${riapre} suchen`,
    ora: (ultimo, ufficio) => `Wir haben bis ${ultimo} geschlossen. Buchungen für die neue Saison sind möglich: ${ufficio}.`,
    ufficioDa: (da, orari) => `das Reservierungsbüro antwortet ab dem ${da}, ${orari}`,
    ufficioOra: (orari) => `das Reservierungsbüro antwortet ${orari}`,
  },
  en: {
    chiusi: (dal, ultimo, riapre) => `The hotel is closed in that period, from ${dal} to ${ultimo}. We reopen on ${riapre}.`,
    cerca: (riapre) => `Search from ${riapre}`,
    ora: (ultimo, ufficio) => `We are closed until ${ultimo}. Bookings for the new season are open: ${ufficio}.`,
    ufficioDa: (da, orari) => `the reservations office replies from ${da}, ${orari}`,
    ufficioOra: (orari) => `the reservations office replies ${orari}`,
  },
  fr: {
    chiusi: (dal, ultimo, riapre) => `L'hôtel est fermé à cette période, du ${dal} au ${ultimo}. Nous rouvrons le ${riapre}.`,
    cerca: (riapre) => `Chercher à partir du ${riapre}`,
    ora: (ultimo, ufficio) => `Nous sommes fermés jusqu'au ${ultimo}. Les réservations pour la nouvelle saison sont ouvertes : ${ufficio}.`,
    ufficioDa: (da, orari) => `le bureau des réservations répond à partir du ${da}, ${orari}`,
    ufficioOra: (orari) => `le bureau des réservations répond ${orari}`,
  },
};

const testi = (lingua) => TESTI[lingua] || TESTI.it;

/** La riga in cima alla pagina mentre siamo chiusi; '' quando siamo aperti. */
export function rigaChiusiOra(stagione, oggiISO, lingua) {
  const s = stagioneInCorso(stagione, oggiISO);
  if (!s) return '';
  const t = testi(lingua), l = TESTI[lingua] ? lingua : 'it';
  const ufficio = oggiISO < UFFICIO.dal
    ? t.ufficioDa(dataEstesa(UFFICIO.dal, l), UFFICIO.orari[l])
    : t.ufficioOra(UFFICIO.orari[l]);
  return t.ora(dataEstesa(giornoPrima(s.riapertura), l), ufficio);
}

/** Il messaggio al posto di «nessuna camera», con le date della stagione toccata. */
export function messaggioChiuso(chiuso, lingua) {
  const t = testi(lingua), l = TESTI[lingua] ? lingua : 'it';
  return t.chiusi(dataEstesa(chiuso.chiusura, l), dataEstesa(giornoPrima(chiuso.riapertura), l), dataEstesa(chiuso.riapertura, l));
}
```

In italiano `ufficioDa` produce «dall'8 gennaio 2027» perché `dataEstesa` dà «8 gennaio 2027» e il testo mette «dall'» davanti: la prova lo pretende letterale.

- [ ] **Step 4: verde** — stesso comando, PASS.
- [ ] **Step 5: commit** — `git add pagine/prenota/chiusura.js pagine/prenota/chiusura.test.ts && git commit -m "Prenota: i testi e le regole della chiusura invernale, in un modulo provato"`

---

### Task 4: la pagina Prenota usa il modulo

**Files:**
- Modify: `pagine/prenota/index.html` — import (dopo riga 365), avvio, riga 976 (`t.sotto`), `cercaDisponibilita` (righe 1108–1115, il ramo `!PROPOSTE.length`)
- Test: `pagine/prenota/chiusura.test.ts` (in coda)

**Interfaces:**
- Consumes: Task 3; la risposta `chiuso` del Task 2; `FUNZIONE`, `$`, `esc`, `T`, `LNG`, `disegna()`, `cercaDisponibilita()` della pagina.
- Produces: `STAGIONE` (globale, `null` finché non letta), `leggiStagione()`, `rigaChiusura()`.

- [ ] **Step 1: la prova che fallisce** (sul sorgente)

```ts
const PAGINA = Deno.readTextFileSync(new URL('index.html', import.meta.url));

Deno.test('la pagina legge la stagione dal server e mostra la riga in cima', () => {
  assert(/from '\/prenota\/chiusura\.js'/.test(PAGINA), 'la pagina non importa chiusura.js');
  assert(/FUNZIONE \+ '\?a=stagione'/.test(PAGINA), 'la pagina non chiede la stagione al server');
  assert(/rigaChiusiOra\(STAGIONE, /.test(PAGINA), 'la riga in cima non si disegna dalla stagione letta');
  const riga = PAGINA.indexOf('rigaChiusura()');
  const guida = PAGINA.indexOf('<div class="avviso">${esc(t.sotto)}</div>');
  assert(riga > 0 && guida > 0 && riga < guida, 'la riga della chiusura non sta sopra la guida');
});

Deno.test('con «chiuso» la ricerca non dice «nessuna camera»: dice le date e offre di cercare dalla riapertura', () => {
  const m = PAGINA.match(/if \(d\.chiuso\) \{([\s\S]*?)\n    \}/);
  assert(m, 'manca il ramo chiuso nella ricerca');
  assert(/messaggioChiuso\(d\.chiuso, LNG\)/.test(m![1]), 'non usa il messaggio del modulo');
  assert(/dateDallaRiapertura\(d\.chiuso\.riapertura, /.test(m![1]), 'il pulsante non riparte dalla riapertura con le stesse notti');
  assert(/cercaDisponibilita\(\)/.test(m![1]), 'il pulsante non rilancia la ricerca');
  const chiuso = PAGINA.indexOf('if (d.chiuso) {');
  const nessuna = PAGINA.indexOf('${esc(t.nessunaCamera)}');
  assert(chiuso < nessuna, 'il ramo chiuso viene dopo «nessuna camera»: non si vedrebbe mai');
});
```

- [ ] **Step 2: rosso** — Run: `deno test --allow-read --allow-env pagine/prenota/chiusura.test.ts`

- [ ] **Step 3: il codice**

Import, dopo la riga 365:

```js
/* la chiusura invernale: testi e regole in un modulo provato, le date dal server */
import { dateDallaRiapertura, messaggioChiuso, rigaChiusiOra } from '/prenota/chiusura.js';
```

Vicino a `let LNG = …` (riga 393):

```js
/* la stagione di chiusura in corso o prossima, letta dal server all'avvio:
   null finche' non arriva, e null se il server non la sa — niente date
   inventate, la pagina resta com'era */
let STAGIONE = null;
async function leggiStagione() {
  try {
    const r = await fetch(FUNZIONE + '?a=stagione');
    const d = await r.json().catch(() => ({}));
    STAGIONE = d && d.stagione && d.stagione.chiusura ? d.stagione : null;
  } catch (e) { STAGIONE = null; }
  if (STAGIONE) disegna();
}
const oggiISOUTC = () => new Date().toISOString().slice(0, 10);
function rigaChiusura() {
  const testo = rigaChiusiOra(STAGIONE, oggiISOUTC(), LNG);
  return testo ? `<div class="avviso" style="border-left-color:#C9A961;background:#FBF6EA;">${esc(testo)}</div>` : '';
}
```

`leggiStagione()` si chiama una volta all'avvio, subito dopo la prima `disegna()` (riga 1124 è la `disegna()` dopo la ricerca: l'avvio è la chiamata in fondo al modulo — cercare `disegna();` fuori da funzioni, e aggiungere `leggiStagione();` sulla riga dopo). Riga 976:

```js
    ${rigaChiusura()}
    <div class="avviso">${esc(t.sotto)}</div>
```

In `cercaDisponibilita`, subito PRIMA di `if (!PROPOSTE.length) {`:

```js
    if (d.chiuso) {
      CERCANDO = false;
      $('bCerca').disabled = false;
      $('bCerca').textContent = t.cerca;
      const nuove = dateDallaRiapertura(d.chiuso.riapertura, notti(arrivo, partenza));
      $('esitoRicerca').innerHTML = `<div class="errore" style="border-left-color:#C9A961;background:#FBF6EA;color:#5C4A1E;">
        ${esc(messaggioChiuso(d.chiuso, LNG))}
        <div style="margin-top:10px;"><button type="button" id="bDallaRiapertura" class="azione">${esc(testoCerca(d.chiuso.riapertura))}</button></div>
      </div>`;
      $('bDallaRiapertura').onclick = () => {
        $('fArrivo').value = nuove.arrivo;
        $('fPartenza').value = nuove.partenza;
        cercaDisponibilita();
      };
      return;
    }
```

dove `notti(arrivo, partenza)` è `Math.round((new Date(partenza) - new Date(arrivo)) / 86400000)` (se la pagina ha già una funzione con questo nome, usare quella) e `testoCerca` è `import { TESTI, dataEstesa }` → `(TESTI[LNG] || TESTI.it).cerca(dataEstesa(riapertura, LNG))`: aggiungere `TESTI, dataEstesa` all'import.

- [ ] **Step 4: verde** — `deno test --allow-read --allow-env pagine/prenota/` tutta verde (comprese `schede.test.ts`-simili che analizzano il copione della pagina).
- [ ] **Step 5: commit** — `git add pagine/prenota/index.html pagine/prenota/chiusura.test.ts && git commit -m "Prenota dice «siamo chiusi, riapriamo il 13 febbraio» e offre di cercare da li'"`

---

### Task 5: l'estensione — date esatte, fasi, testi nuovi

**Files:**
- Modify: `estensione/template.js` (`CHIUSURA` riga 299 e `dentroChiusura`), `estensione/template-extra.js` (`CHIUSURA_T` riga 691, `dateChiusura` 727, `costruisciChiusuraBase` 748)
- Test: `estensione/chiusura.test.ts` (prove aggiornate + nuove)

**Interfaces:**
- Produces in `template.js`: `CHIUSURA = { dal, al, riaperturaVaga:false, ufficioDal, auguriFinoAl }`; `faseChiusura(oggiISO) → 'aperto'|'chiusoPrimaUfficio'|'chiusoUfficioAperto'`; `auguri(oggiISO) → boolean`; `varianteChiusura(arrivoISO|null, oggiISO) → 'periodo'|'chiusoOra'|null`.
- Produces in `template-extra.js`: `costruisciChiusura{IT,DE,EN,FR}(d, o)` con `o.variante` e `o.oggi`; `CHIUSURA_T[l].{orari, ufficio, auguri, h1Ora, introOra}`.

- [ ] **Step 1: le prove** — in `chiusura.test.ts`: (a) la prova «la risposta esce nelle quattro lingue, con le date giuste» cambia le attese: `it: /29 novembre 2026[\s\S]*13 febbraio 2027/`, `de: /29\. November 2026[\s\S]*13\. Februar 2027/`, `en: /29 November 2026[\s\S]*13 February 2027/`, `fr: /29 novembre 2026[\s\S]*13 f&eacute;vrier 2027/`; (b) «la chiusura si aggiorna in un posto solo» cerca `2026-11-29|2027-02-13|2027-01-08` in template-extra.js; (c) il tipo `Modelli` aggiunge `fase`, `auguri`, `variante` e la coda li restituisce; (d) nuove:

```ts
Deno.test('le fasi della chiusura, per data', () => {
  const m = modelli();
  assertEquals(m.fase('2026-11-28'), 'aperto');
  assertEquals(m.fase('2026-11-29'), 'chiusoPrimaUfficio');
  assertEquals(m.fase('2027-01-07'), 'chiusoPrimaUfficio');
  assertEquals(m.fase('2027-01-08'), 'chiusoUfficioAperto');
  assertEquals(m.fase('2027-02-12'), 'chiusoUfficioAperto');
  assertEquals(m.fase('2027-02-13'), 'aperto');
});

Deno.test('gli auguri solo dalla chiusura all Epifania', () => {
  const m = modelli();
  assertEquals(m.auguri('2026-11-28'), false);
  assertEquals(m.auguri('2026-11-29'), true);
  assertEquals(m.auguri('2027-01-06'), true);
  assertEquals(m.auguri('2027-01-07'), false);
});

Deno.test('la variante: date dentro → «in quel periodo»; date dopo o assenti, chiusi e prima dell ufficio → «chiusi ora»; dall 8 gennaio niente', () => {
  const m = modelli();
  assertEquals(m.variante('2026-12-20', '2026-10-01'), 'periodo');
  assertEquals(m.variante('2026-12-20', '2027-01-20'), 'periodo');
  assertEquals(m.variante('2027-03-10', '2026-12-15'), 'chiusoOra');
  assertEquals(m.variante(null, '2026-12-15'), 'chiusoOra');
  assertEquals(m.variante('2027-03-10', '2027-01-20'), null);
  assertEquals(m.variante(null, '2026-10-01'), null);
});

Deno.test('«chiusi ora» dice fino a quando, e da quando risponde l ufficio, in quattro lingue', () => {
  const m = modelli();
  const ATTESE: Record<Lingua, RegExp> = {
    it: /12 febbraio 2027[\s\S]*8 gennaio 2027[\s\S]*luned&igrave;&ndash;venerd&igrave; 9&ndash;17/,
    de: /12\. Februar 2027[\s\S]*8\. Januar 2027[\s\S]*Montag&ndash;Freitag 9&ndash;17 Uhr/,
    en: /12 February 2027[\s\S]*8 January 2027[\s\S]*Monday&ndash;Friday 9am&ndash;5pm/,
    fr: /12 f&eacute;vrier 2027[\s\S]*8 janvier 2027[\s\S]*lundi&ndash;vendredi 9h&ndash;17h/,
  };
  for (const l of LINGUE) {
    const html = m.html[l](D, { ...OPZ, variante: 'chiusoOra', oggi: '2026-12-15' });
    assert(ATTESE[l].test(html), `«chiusi ora» sbagliata in ${l}`);
    assert(!/met&agrave; febbraio|Mitte Februar|mid-February|mi-f&eacute;vrier/.test(html), `«meta' febbraio» ancora in ${l}`);
  }
});

Deno.test('gli auguri stanno in coda quando e il periodo, e non ci stanno altrimenti', () => {
  const m = modelli();
  const AUGURI: Record<Lingua, RegExp> = { it: /buone feste/i, de: /frohe Festtage/i, en: /happy holiday season/i, fr: /bonnes f&ecirc;tes/i };
  for (const l of LINGUE) {
    assert(AUGURI[l].test(m.html[l](D, { ...OPZ, variante: 'periodo', oggi: '2026-12-15' })), `auguri mancanti in ${l}`);
    assert(!AUGURI[l].test(m.html[l](D, { ...OPZ, variante: 'periodo', oggi: '2027-01-20' })), `auguri fuori periodo in ${l}`);
  }
});

Deno.test('«in quel periodo» prima dell 8 gennaio dice anche da quando risponde l ufficio', () => {
  const m = modelli();
  assert(/8 gennaio 2027/.test(m.html.it(D, { ...OPZ, variante: 'periodo', oggi: '2026-12-15' })));
  assert(!/8 gennaio 2027/.test(m.html.it(D, { ...OPZ, variante: 'periodo', oggi: '2027-01-20' })));
});
```

- [ ] **Step 2: rosso** — `deno test --allow-read --allow-env estensione/chiusura.test.ts`

- [ ] **Step 3: il codice**

`template.js`, `CHIUSURA` e le funzioni:

```js
const CHIUSURA = {
  dal: '2026-11-29',          // primo giorno di chiusura
  al:  '2027-02-13',          // riapertura: primo arrivo (esatta, decisa il 3 settembre 2026)
  riaperturaVaga: false,      // la data e' esatta: si scrive il giorno
  ufficioDal: '2027-01-08',   // l'ufficio prenotazioni torna operativo
  auguriFinoAl: '2027-01-06'  // fino all'Epifania i testi augurano buone feste
};

/* la data richiesta cade dentro la chiusura? … (com'e') */
function dentroChiusura(iso) { … invariata … }

/* Dove siamo oggi rispetto alla chiusura: aperti, chiusi con l'ufficio
   ancora fermo, chiusi con l'ufficio che risponde. */
function faseChiusura(oggi) {
  if (!dentroChiusura(oggi)) return 'aperto';
  return (CHIUSURA.ufficioDal && oggi < CHIUSURA.ufficioDal) ? 'chiusoPrimaUfficio' : 'chiusoUfficioAperto';
}

/* gli auguri: dalla chiusura all'Epifania compresa */
function auguri(oggi) {
  return !!CHIUSURA.dal && !!CHIUSURA.auguriFinoAl && oggi >= CHIUSURA.dal && oggi <= CHIUSURA.auguriFinoAl;
}

/* Quale risposta: «periodo» se l'arrivo chiesto cade nella chiusura;
   «chiusoOra» se siamo chiusi, l'ufficio non e' ancora tornato, e la
   richiesta e' per dopo la riapertura o senza date; altrimenti niente —
   dall'8 gennaio a quelle richieste si risponde con l'offerta normale. */
function varianteChiusura(arrivoISO, oggi) {
  if (arrivoISO && dentroChiusura(arrivoISO)) return 'periodo';
  if (faseChiusura(oggi) === 'chiusoPrimaUfficio' && (!arrivoISO || arrivoISO >= CHIUSURA.al)) return 'chiusoOra';
  return null;
}
```

`template-extra.js`: in ogni lingua di `CHIUSURA_T` aggiungere `orari`, `ufficio`, `auguri`, `h1Ora`, `introOra`:

```js
  it: { …com'e'…,
    orari: 'luned&igrave;&ndash;venerd&igrave; 9&ndash;17',
    ufficio: (da, orari) => `L&rsquo;ufficio prenotazioni riapre <strong style="color:#2A2E2B;">l&rsquo;${da}</strong>, ${orari}.`,
    auguri: 'Le auguriamo buone feste.',
    h1Ora: 'In questo momento siamo chiusi',
    introOra: (ultimo, da, orari) => `La ringraziamo per la Sua richiesta. L&rsquo;Hotel Terme Leonardo &egrave; chiuso per la pausa stagionale <strong style="color:#2A2E2B;">fino al ${ultimo}</strong>. L&rsquo;ufficio prenotazioni riapre <strong style="color:#2A2E2B;">l&rsquo;${da}</strong> (${orari}) e Le risponder&agrave; con una proposta per la nuova stagione.`,
  },
  de: { …,
    orari: 'Montag&ndash;Freitag 9&ndash;17 Uhr',
    ufficio: (da, orari) => `Unser Reservierungsb&uuml;ro ist ab dem <strong style="color:#2A2E2B;">${da}</strong> wieder f&uuml;r Sie da, ${orari}.`,
    auguri: 'Wir w&uuml;nschen Ihnen frohe Festtage.',
    h1Ora: 'Zurzeit haben wir geschlossen',
    introOra: (ultimo, da, orari) => `Vielen Dank f&uuml;r Ihre Anfrage. Das Hotel Terme Leonardo macht Betriebsferien <strong style="color:#2A2E2B;">bis zum ${ultimo}</strong>. Unser Reservierungsb&uuml;ro ist ab dem <strong style="color:#2A2E2B;">${da}</strong> (${orari}) wieder f&uuml;r Sie da und meldet sich dann mit einem Angebot f&uuml;r die neue Saison.`,
  },
  en: { …,
    orari: 'Monday&ndash;Friday 9am&ndash;5pm',
    ufficio: (da, orari) => `Our reservations office reopens on <strong style="color:#2A2E2B;">${da}</strong>, ${orari}.`,
    auguri: 'We wish you a happy holiday season.',
    h1Ora: 'We are currently closed',
    introOra: (ultimo, da, orari) => `Thank you for your enquiry. Hotel Terme Leonardo is closed for its seasonal break <strong style="color:#2A2E2B;">until ${ultimo}</strong>. Our reservations office reopens on <strong style="color:#2A2E2B;">${da}</strong> (${orari}) and will get back to you with a proposal for the new season.`,
  },
  fr: { …,
    orari: 'lundi&ndash;vendredi 9h&ndash;17h',
    ufficio: (da, orari) => `Notre bureau des r&eacute;servations rouvre le <strong style="color:#2A2E2B;">${da}</strong>, ${orari}.`,
    auguri: 'Nous vous souhaitons de bonnes f&ecirc;tes.',
    h1Ora: 'Nous sommes actuellement ferm&eacute;s',
    introOra: (ultimo, da, orari) => `Nous vous remercions de votre demande. L&rsquo;Hotel Terme Leonardo est ferm&eacute; pour sa pause saisonni&egrave;re <strong style="color:#2A2E2B;">jusqu&rsquo;au ${ultimo}</strong>. Notre bureau des r&eacute;servations rouvre le <strong style="color:#2A2E2B;">${da}</strong> (${orari}) et vous r&eacute;pondra avec une proposition pour la nouvelle saison.`,
  },
```

`dateChiusura(lingua)` restituisce anche `ultimo` (il giorno prima di `CHIUSURA.al`) e `ufficioDal` formattati:

```js
  const giornoPrima = (iso) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); };
  const u = pezzi(CHIUSURA.ufficioDal), p = b ? pezzi(giornoPrima(CHIUSURA.al)) : null;
  … return { dal, al, ultimo: p ? dataExtra(p.g, p.mese, p.a, lingua) : '', ufficioDal: u ? dataExtra(u.g, u.mese, u.a, lingua) : '' };
```

(attenzione: `dataExtra` con l'italiano dà «8 gennaio 2027»; `ufficio` e `introOra` in italiano mettono «l'» davanti). `costruisciChiusuraBase`:

```js
function costruisciChiusuraBase(d, opzioni, lingua) {
  const o = opzioni || {};
  const t = CHIUSURA_T[lingua] || CHIUSURA_T.it;
  const q = dateChiusura(lingua);
  const oggi = o.oggi || new Date().toISOString().slice(0, 10);
  const variante = o.variante === 'chiusoOra' ? 'chiusoOra' : 'periodo';
  const P = (testo, margine) => `<p style="margin:0 0 ${margine}px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">${testo}</p>`;
  const righe = [];
  if (variante === 'chiusoOra') {
    righe.push(P(t.introOra(q.ultimo, q.ufficioDal, t.orari), 14));
    righe.push(P(t.invito, 12));
  } else {
    righe.push(P(t.intro(q.dal, q.al), 14));
    righe.push(P(t.invito, 12));
    if (CHIUSURA.ufficioDal && oggi < CHIUSURA.ufficioDal) righe.push(P(t.ufficio(q.ufficioDal, t.orari), 12));
    righe.push(P(t.riapre, 12));
  }
  if (auguri(oggi)) righe.push(P(t.auguri, 0));
  const corpo = `
  <tr><td style="padding:16px 36px 0 36px;">
    <p style="margin:0 0 14px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:22px;color:#2A2E2B;">${salutoExtra(d, o, lingua)},</p>
    <h1 style="margin:0 0 10px 0;font-family:Georgia,'Times New Roman',serif;font-size:25px;line-height:31px;font-weight:normal;color:#2A2E2B;">${variante === 'chiusoOra' ? t.h1Ora : t.h1}</h1>
    ${righe.join('\n    ')}
  </td></tr>`;
  return corniceExtra(t.banda, corpo, o, lingua);
}
```

`t.riapre` in italiano diceva «appena il listino della nuova stagione è disponibile»: resta. La coda di `modelli()` nella prova aggiunge `fase: faseChiusura, auguri, variante: varianteChiusura`.

- [ ] **Step 4: verde** — `deno test --allow-read --allow-env estensione/chiusura.test.ts estensione/preventivo.test.ts`; poi `node strumenti/variabili.js` non deve lamentare `auguri`/`faseChiusura` (sono `function` in template.js, caricato prima di template-extra.js in tutti i gruppi).
- [ ] **Step 5: commit** — `git add estensione/template.js estensione/template-extra.js estensione/chiusura.test.ts && git commit -m "Chiusura: riapertura esatta, l'ufficio dall'8 gennaio, gli auguri, la variante «chiusi ora»"`

---

### Task 6: il pulsante di Outlook sceglie la variante

**Files:**
- Modify: `estensione/outlook-inject.js` — `trovaRichiestaChiusura` (riga ~1507) e `mostraPulsanteChiusura`
- Test: `estensione/chiusura.test.ts` (in coda)

**Interfaces:**
- Consumes: `varianteChiusura(arrivoISO|null, oggiISO)`, `costruisciChiusura*` con `o.variante`, `o.oggi`.

- [ ] **Step 1: la prova che fallisce** (sul sorgente)

```ts
Deno.test('il pulsante in Outlook sceglie la variante dalle date e la dichiara nell anteprima', () => {
  const inject = Deno.readTextFileSync(new URL('outlook-inject.js', import.meta.url));
  const trova = inject.match(/function trovaRichiestaChiusura\(\) \{([\s\S]*?)\n  \}/);
  assert(trova, 'trovaRichiestaChiusura non si trova');
  assert(/varianteChiusura\(/.test(trova![1]), 'il riconoscimento non passa da varianteChiusura(): «chiusi ora» non comparirebbe mai');
  const mostra = inject.match(/function mostraPulsanteChiusura\(\) \{([\s\S]*?)\n  \}/);
  assert(mostra, 'mostraPulsanteChiusura non si trova');
  assert(/variante,\s*oggi/.test(mostra![1]) || /variante: variante/.test(mostra![1]), 'la variante non arriva al modello');
  assert(/chiusi ora|in quel periodo/.test(mostra![1]), 'l anteprima non dice quale variante ha scelto');
});
```

- [ ] **Step 2: rosso**

- [ ] **Step 3: il codice**

```js
  /* la richiesta e il perche' del pulsante: {el, variante, arrivo} o null */
  function trovaRichiestaChiusura() {
    if (typeof varianteChiusura !== 'function' || !CHIUSURA || !CHIUSURA.dal) return null;
    const oggi = new Date().toISOString().slice(0, 10);
    let migliore = null;
    for (const e of elementiLettura('div, td, p')) {
      if (!visibile(e)) continue;
      const txt = e.innerText || '';
      if (txt.length < 40 || txt.length > 2500) continue;
      if (!PAROLE_RICHIESTA.test(txt)) continue;
      const date = leggiDate(txt);
      const arrivo = date ? isoDaLetta(date.arrivo) : null;
      const variante = varianteChiusura(arrivo, oggi);
      if (!variante) continue;
      if (!migliore || txt.length < (migliore.el.innerText || '').length) migliore = { el: e, variante, arrivo, oggi };
    }
    return migliore;
  }
```

In `mostraPulsanteChiusura`: `const r = trovaRichiestaChiusura(); if (!r) return;` … nel click `const r = trovaRichiestaChiusura(); if (!r) { avviso(…); return; } const { el, variante, arrivo, oggi } = r;` … anteprima:

```js
      anteprimaRisposta({
        titolo: 'Risposta: chiusura stagionale',
        modello: variante === 'chiusoOra'
          ? 'Chiusi ora: riapriamo il 13 febbraio, l\u2019ufficio prenotazioni risponde dall\u20198 gennaio'
          : 'Siamo chiusi in quel periodo, con invito a scegliere altre date',
        lingua,
        destinatario: nome ? { nome } : { nome: 'nome non letto', generico: true },
        nota: variante === 'chiusoOra'
          ? `Oggi ${dataLeggibile(letta(oggi))}: chiusi, ufficio dall\u20198 gennaio. ${arrivo ? 'Ha chiesto il ' + dataLeggibile(letta(arrivo)) + ', dopo la riapertura.' : 'Nessuna data letta.'}`
          : `Ha chiesto il ${dataLeggibile(letta(arrivo))}, in quel periodo siamo chiusi. Verifica prima di mandare: le date sono la cosa piu' facile da sbagliare.`,
        azione: () => chrome.storage.local.get(['firma'], (ris) => {
          const o = { genere: 'N', firma: (ris && ris.firma) || 'La Reception', variante, oggi };
          …com'e'…
```

dove `letta = (iso) => { const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? { a: +m[1], m: +m[2], g: +m[3] } : null; }` (accanto a `isoDaLetta`). La prova «il pulsante in Outlook guarda le date, non le parole» cercava `dentroChiusura(isoDaLetta(date.arrivo))`: si aggiorna a `varianteChiusura(arrivo, oggi)` con `arrivo = date ? isoDaLetta(date.arrivo) : null`.

- [ ] **Step 4: verde** — `deno test --allow-read --allow-env estensione/chiusura.test.ts estensione/richieste.test.ts`
- [ ] **Step 5: commit** — `git add estensione/outlook-inject.js estensione/chiusura.test.ts && git commit -m "In Outlook il pulsante di chiusura sceglie la risposta dalle date: in quel periodo, o chiusi ora"`

---

### Task 7: rilascio

- [ ] `estensione/manifest.json`: `"version": "2.26.0"`; `node strumenti/estensione.js`.
- [ ] Suite intera verde: `deno test --allow-read --allow-env`.
- [ ] Commit `Offerta Leonardo 2.26.0: la chiusura invernale detta bene` e `git push origin main` (sito su Vercel da solo).
- [ ] Funzione: `SUPABASE_ACCESS_TOKEN=<token> npx --yes supabase functions deploy richieste --project-ref mvuiuwakuseockotlcnp --no-verify-jwt`; poi `curl -s https://mvuiuwakuseockotlcnp.supabase.co/functions/v1/richieste?a=stagione` deve dare `{"esito":"ok","stagione":{"chiusura":"2026-11-29","riapertura":"2027-02-13"}}`. Se la riga in tabella manca o e' diversa, si corregge in Supabase → Table editor → `stagione_chiusura`.
- [ ] Rapporto alla proprietà: ricaricare l'estensione sui PC; il token; cosa dice il sito e cosa Outlook.

## Self-review

- Copertura: date/fonte unica (T5 `CHIUSURA`, T2 tabella); `a=stagione` e `chiuso` (T2); riga in cima e ramo `chiuso` con pulsante (T3–T4); Outlook variante/ufficio/auguri/finestre (T5–T6); casi limite: tabella non leggibile (T2 null, T4 `STAGIONE=null`), a cavallo (T1), dopo la riapertura (T5 `fase`), stagione successiva (prova «non e' vecchia»). Rilascio T7.
- Segnaposto: nessuno («…com'e'…» indica righe esistenti da lasciare, non da inventare).
- Nomi: `chiusuraCheCopre` (T1→T2), `stagione`/`chiuso` (T2→T4), `rigaChiusiOra`/`messaggioChiuso`/`dateDallaRiapertura`/`TESTI`/`dataEstesa` (T3→T4), `faseChiusura`/`auguri`/`varianteChiusura` (T5→T6), `o.variante`/`o.oggi` (T5→T6).
