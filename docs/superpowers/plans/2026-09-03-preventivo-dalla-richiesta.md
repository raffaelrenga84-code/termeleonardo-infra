# Il preventivo che parte dalla richiesta — piano di lavoro

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** il lettore delle email in Outlook legge date, persone, trattamento, cure, cane e categoria anche nelle forme tedesche e italiane che oggi perde; quello che legge arriva al pannello «Disponibilità e prezzi», che compila i filtri, cerca da solo e pre-spunta la categoria chiesta più un'alternativa.

**Architecture:** tre pezzi nell'ordine in cui i dati scorrono. (1) `estensione/outlook-inject.js`: regole in più dentro `leggiDate()` e `parseLibera()`, una prova ciascuna, eseguite sul file vero caricato con i sostituti di `richieste.test.ts`. (2) `ricordaRichiesta()` nello stesso file salva i campi nuovi in `chrome.storage.local` sotto `leonardo_richiesta`. (3) `estensione/fidra-disponibilita.js`: `compilaDaRichiesta()` riempie i filtri e lancia la ricerca; `proposteDaRichiesta()` è una funzione pura che sceglie fino a due righe; `proponi()` le mette nel preventivo passando dalla stessa funzione dei pulsanti «+ Prev.».

**Tech Stack:** estensione Chrome MV3 (JavaScript senza moduli, IIFE), prove Deno con `jsr:@std/assert`, `new Function(SORGENTE + coda)` per eseguire il codice vero, `node strumenti/variabili.js` come cancello sulle variabili non definite, `node strumenti/estensione.js` per OneDrive.

## Global Constraints

- Specifica: `docs/superpowers/specs/2026-09-03-preventivo-dalla-richiesta-design.md`.
- **Le prove esistenti non si toccano** (`richieste.test.ts`, `preventivo.test.ts`, `chiusura.test.ts`): devono restare verdi com'erano.
- Una forma nuova di data si prova **solo se le precedenti non hanno prodotto una data** (`if (!r.arrivo)`), come già scritto per «dal 25/09 al 3/10».
- Quello che è dedotto e non letto si dichiara: `adultiDedotti`, `trattamentoDedotto`, e da oggi `nottiDedotte`.
- Il pannello non scrive dentro Fidra e non manda niente da solo: «Crea preventivo e apri Outlook» resta dell'operatore.
- Le righe con prezzo stimato (`data-stima`) non si propongono mai.
- Dopo ogni modifica a `estensione/`: `node strumenti/estensione.js` (che rifiuta se `strumenti/variabili.js` trova variabili non definite); `allineata.test.ts` pretende repo == OneDrive.
- Versione finale: `2.25.0` in `estensione/manifest.json`.
- Comandi di prova: `deno test --allow-read --allow-env <file>`; suite intera: `deno test --allow-read --allow-env` dalla radice del repo `C:\Users\admin\termeleonardo-infra`.
- Commit su `main` con in coda `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

---

## File Structure

| file | responsabilità | cambia |
|---|---|---|
| `estensione/outlook-inject.js` | legge l'email aperta in Outlook (`leggiDate`, `parseLibera`, `linguaTesto`), mostra l'anteprima, mette da parte la richiesta (`ricordaRichiesta`) | Task 1–6 |
| `estensione/richieste.test.ts` | esegue il lettore vero su email realistiche | Task 1–6 |
| `estensione/fidra-disponibilita.js` | il pannello dentro Fidra: filtri, ricerca, righe, carrello del preventivo | Task 7–8 |
| `estensione/preventivo.test.ts` | il preventivo e il cablaggio del pannello | Task 7–8 |
| `estensione/manifest.json` | versione | Task 9 |

Le prove del lettore usano il caricatore `lettori()` già in `richieste.test.ts` (righe 44–107): carica `outlook-inject.js` con `window`, `document`, `chrome` finti e restituisce `self.__leonardoInject`. Nel Task 6 il caricatore accetta una spia per `chrome.storage.local.set`.

---

### Task 1: le date etichettate (Anreise/Abreise, Arrivo/partenza, Arrival/departure, Arrivée/départ)

**Files:**
- Modify: `estensione/outlook-inject.js` — `leggiDate()`, righe 358–461 (la costante `GIORNI` a riga 368; il blocco `mNum` a riga 436)
- Test: `estensione/richieste.test.ts` (in coda)

**Interfaces:**
- Consumes: `leggiDate(testo) → { arrivo:{g,m,a}, partenza:{g,m,a}, notti? } | null` (com'è oggi).
- Produces: la stessa firma; in più legge le forme etichettate. `GIORNI` copre anche i giorni inglesi e francesi.

- [ ] **Step 1: la prova che fallisce**

In coda a `estensione/richieste.test.ts`:

```ts
/* ============================================================
   5 — LE FORME CHE IL 3 SETTEMBRE 2026 SFUGGIVANO, in tedesco e in
   italiano. Dieci richieste per lingua, realistiche, fatte leggere al
   lettore vero: sei tedesche e cinque italiane uscivano senza date.
   Ogni prova qui sotto e' una di quelle forme.
   ============================================================ */
type Letta = { arrivo: Giorno; partenza: Giorno; notti?: number; nottiDedotte?: boolean };
const g = (x: Giorno) => `${x.a}-${String(x.m).padStart(2, '0')}-${String(x.g).padStart(2, '0')}`;

Deno.test('5a — le date etichettate: Anreise/Abreise, Arrivo/partenza, Arrival/departure, Arrivée/départ', () => {
  const l = lettori();
  const CASI = [
    ['Guten Tag, Anreise: 05.11.2026, Abreise: 12.11.2026, 2 Erwachsene', '2026-11-05', '2026-11-12'],
    ['Arrivo 05/11/2026 partenza 12/11/2026, 2 adulti', '2026-11-05', '2026-11-12'],
    ['Arrival: 05.11.2026 / Departure: 12.11.2026', '2026-11-05', '2026-11-12'],
    ['Arrivée le 05/11/2026, départ le 12/11/2026', '2026-11-05', '2026-11-12'],
    ['Anreise Sonntag 15.11.2026, Abreise Freitag 20.11.2026', '2026-11-15', '2026-11-20'],
    ['Check-in 24.12.2026, check-out 02.01.2027', '2026-12-24', '2027-01-02'],
  ] as const;
  for (const [testo, a, p] of CASI) {
    const d = l.leggiDate(testo) as Letta | null;
    assert(d, `leggiDate non riconosce «${testo}»`);
    assertEquals(g(d!.arrivo), a, `arrivo sbagliato in «${testo}»`);
    assertEquals(g(d!.partenza), p, `partenza sbagliata in «${testo}»`);
  }
});

Deno.test('5a-bis — etichettate coi mesi a parole e il giorno della settimana in mezzo', () => {
  const l = lettori();
  const d = l.leggiDate('Anreise Sonntag 15. November 2026, Abreise Freitag 20. November 2026') as Letta | null;
  assert(d, 'non letta');
  assertEquals(g(d!.arrivo), '2026-11-15');
  assertEquals(g(d!.partenza), '2026-11-20');
});
```

- [ ] **Step 2: eseguire e vedere il rosso**

Run: `deno test --allow-read --allow-env estensione/richieste.test.ts`
Expected: FAIL su «5a» (`leggiDate non riconosce «Guten Tag, Anreise: 05.11.2026…»`). «5a-bis» può già passare grazie a `dueMesi`: va bene.

- [ ] **Step 3: la regola**

In `leggiDate()`, sostituire la costante `GIORNI` (riga 368–369) con:

```js
    const GIORNI = String.raw`(?:lunedì|martedì|mercoledì|giovedì|venerdì|sabato|domenica|` +
                   String.raw`Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag|` +
                   String.raw`Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|` +
                   String.raw`lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)`;
```

e subito PRIMA di `let m = t.match(/dal\s+…` (riga 370) inserire:

```js
    /* v2.25 — LE DATE ETICHETTATE. «Anreise: 05.11.2026, Abreise: 12.11.2026»,
       «Arrivo 05/11/2026 partenza 12/11/2026», «Arrival … Departure»,
       «Arrivée … départ». Il 3 settembre 2026, su dieci richieste tedesche
       realistiche, questa era la forma piu' comune fra quelle che sfuggivano:
       nessuno dei modi di prima la prendeva perche' cercano tutti un
       separatore fra le due date, e qui in mezzo c'e' una parola. Si prova
       per prima: e' la forma piu' esplicita, e non puo' abboccare per
       sbaglio su un'altra. */
    const ARRIVO_ETI = String.raw`(?:anreise|ankunft|check-?in|arrivo|arrival|arriv[ée]e)`;
    const PARTENZA_ETI = String.raw`(?:abreise|abfahrt|check-?out|partenza|departure|d[ée]part)`;
    const DATA_NUM = String.raw`(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?`;
    const PREPOSIZIONE = String.raw`(?:am\s+|il\s+|on\s+|le\s+|the\s+)?(?:` + GIORNI + String.raw`\s*,?\s*)?`;
    const eti = t.match(new RegExp(
      ARRIVO_ETI + String.raw`\s*:?\s*` + PREPOSIZIONE + DATA_NUM + String.raw`\.?[\s\S]{0,60}?` +
      PARTENZA_ETI + String.raw`\s*:?\s*` + PREPOSIZIONE + DATA_NUM, 'i'));
    if (eti) {
      const g1 = +eti[1], me1 = +eti[2], g2 = +eti[4], me2 = +eti[5];
      const valida = (g, me) => g >= 1 && g <= 31 && me >= 1 && me <= 12;
      if (valida(g1, me1) && valida(g2, me2)) {
        const norm = (v) => v == null ? null : (+v < 100 ? 2000 + +v : +v);
        const a1 = norm(eti[3]) || annoDedotto(me1, g1);
        const a2 = norm(eti[6]) || (me2 < me1 ? a1 + 1 : a1);
        const n = Math.round((new Date(a2, me2 - 1, g2) - new Date(a1, me1 - 1, g1)) / 86400000);
        if (n > 0 && n < 60) {
          r.arrivo = { g: g1, m: me1, a: a1 };
          r.partenza = { g: g2, m: me2, a: a2 };
          r.notti = n;
        }
      }
    }
```

e cambiare la riga `let m = t.match(/dal\s+…` in modo che la catena parta solo senza data già letta:

```js
    let m = r.arrivo ? null : (t.match(/dal\s+(\d{1,2})\s+al\s+(\d{1,2})\s+([a-zà-ù]+)(?:\s+(\d{4}))?/i)
         || …resto della catena com'è…);
```

(la catena resta identica: cambia solo la guardia `r.arrivo ? null :` davanti).

- [ ] **Step 4: verde**

Run: `deno test --allow-read --allow-env estensione/richieste.test.ts`
Expected: PASS, tutte (comprese quelle di prima).

- [ ] **Step 5: commit**

```bash
git add estensione/outlook-inject.js estensione/richieste.test.ts
git commit -m "Il lettore legge le date etichettate: Anreise/Abreise, Arrivo/partenza, in quattro lingue

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: le forme compatte («12.-19.10.2026», «12. bis 19. Oktober», «vom 3. bis zum 10. Oktober», «dal 6 all'8 dicembre»)

**Files:**
- Modify: `estensione/outlook-inject.js` — la catena `m` in `leggiDate()` (righe 370–377 di oggi) e il blocco dopo `mNum`
- Test: `estensione/richieste.test.ts`

**Interfaces:**
- Consumes/Produces: `leggiDate` come nel Task 1.

- [ ] **Step 1: la prova che fallisce**

```ts
Deno.test('5b — le forme compatte tedesche e l apostrofo italiano', () => {
  const l = lettori();
  const CASI = [
    ['Zeitraum 12.-19.10.2026, 2 Personen', '2026-10-12', '2026-10-19'],
    ['wir möchten 12. bis 19. Oktober 2026 kommen', '2026-10-12', '2026-10-19'],
    ['vom 3. bis zum 10. Oktober 2026, Einzelzimmer', '2026-10-03', '2026-10-10'],
    ['vom 3. bis einschließlich 10. Oktober 2026', '2026-10-03', '2026-10-10'],
    ["dal 6 all'8 dicembre 2026 per due coppie", '2026-12-06', '2026-12-08'],
    ["dal 6 all' 8 dicembre 2026", '2026-12-06', '2026-12-08'],
  ] as const;
  for (const [testo, a, p] of CASI) {
    const d = l.leggiDate(testo) as Letta | null;
    assert(d, `leggiDate non riconosce «${testo}»`);
    assertEquals(g(d!.arrivo), a, `arrivo sbagliato in «${testo}»`);
    assertEquals(g(d!.partenza), p, `partenza sbagliata in «${testo}»`);
  }
});
```

- [ ] **Step 2: rosso**

Run: `deno test --allow-read --allow-env estensione/richieste.test.ts`
Expected: FAIL su «5b».

- [ ] **Step 3: le regole**

Nella catena `m`:

1. la prima riga, `dal (\d) al (\d) (mese)`, diventa
   ```js
   t.match(/dal\s+(\d{1,2})\s+(?:al|all['’])\s*(\d{1,2})\s+([a-zà-ù]+)(?:\s+(\d{4}))?/i)
   ```
2. la terza riga, `vom (\d)\.? (bis|-) (\d)\.? (mese)`, diventa
   ```js
   t.match(/(?:vom\s+)?(\d{1,2})\.?\s*(?:bis|[-–])\s*(?:zum\s+|einschließlich\s+|einschl\.\s+)?(\d{1,2})\.?\s+([A-Za-zäöü]+)(?:\s+(\d{4}))?/i)
   ```
   («vom 12. bis 13. August 2026», già provato in 1b, continua a passare).

Dopo il blocco `if (mNum) { … }` (riga 459 di oggi) e prima di `return r.arrivo ? r : null;`:

```js
    /* v2.25 — «12.-19.10.2026»: il primo giorno senza mese, il mese scritto
       una volta sola sul secondo. Tedesco puro, e frequentissimo. Solo se
       niente ha ancora letto una data: «12-13 agosto» ha gia' il suo modo. */
    if (!r.arrivo) {
      const mc = t.match(/(?:vom\s+|ab\s+)?(\d{1,2})\.?\s*[-–]\s*(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?\.?/);
      if (mc) {
        const g1 = +mc[1], g2 = +mc[2], me = +mc[3];
        if (g1 >= 1 && g1 <= 31 && g2 >= 1 && g2 <= 31 && me >= 1 && me <= 12 && g2 > g1) {
          const a = mc[4] ? (+mc[4] < 100 ? 2000 + +mc[4] : +mc[4]) : annoDedotto(me, g1);
          r.arrivo = { g: g1, m: me, a };
          r.partenza = { g: g2, m: me, a };
          r.notti = g2 - g1;
        }
      }
    }
```

- [ ] **Step 4: verde**

Run: `deno test --allow-read --allow-env estensione/richieste.test.ts`
Expected: PASS.

- [ ] **Step 5: commit**

```bash
git add estensione/outlook-inject.js estensione/richieste.test.ts
git commit -m "Il lettore legge «12.-19.10.», «bis zum», «bis einschließlich» e «dal 6 all'8»

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: arrivo più durata, e il giorno senza mese col mese altrove

**Files:**
- Modify: `estensione/outlook-inject.js` — `leggiDate()`, in coda prima del `return`
- Test: `estensione/richieste.test.ts`

**Interfaces:**
- Produces: `leggiDate` restituisce anche `nottiDedotte: true` quando le notti vengono da «Tage/giorni/days/jours».

- [ ] **Step 1: la prova che fallisce**

```ts
Deno.test('5c — arrivo piu durata: Nächte/notti/nights/nuits, settimane, e i giorni come deduzione', () => {
  const l = lettori();
  const CASI = [
    ['Bitte Angebot für 7 Nächte ab 20.09.2026, Doppelzimmer', '2026-09-20', '2026-09-27', 7, false],
    ['Wir möchten für eine Woche ab dem 20. September 2026 kommen', '2026-09-20', '2026-09-27', 7, false],
    ['zwei Wochen ab 20.09.2026', '2026-09-20', '2026-10-04', 14, false],
    ['Disponibilità per 3 notti dal 3 ottobre 2026, doppia uso singola', '2026-10-03', '2026-10-06', 3, false],
    ['una settimana a partire dal 20 settembre 2026, 2 adulti', '2026-09-20', '2026-09-27', 7, false],
    ['5 nights from 12 October 2026, 2 adults', '2026-10-12', '2026-10-17', 5, false],
    ['une semaine à partir du 20 septembre 2026', '2026-09-20', '2026-09-27', 7, false],
    ['Ich möchte für 10 Tage kommen, Anreise 12.10.2026', '2026-10-12', '2026-10-22', 10, true],
  ] as const;
  for (const [testo, a, p, n, dedotte] of CASI) {
    const d = l.leggiDate(testo) as Letta | null;
    assert(d, `leggiDate non riconosce «${testo}»`);
    assertEquals(g(d!.arrivo), a, `arrivo sbagliato in «${testo}»`);
    assertEquals(g(d!.partenza), p, `partenza sbagliata in «${testo}»`);
    assertEquals(d!.notti, n, `notti sbagliate in «${testo}»`);
    assertEquals(!!d!.nottiDedotte, dedotte, `«${testo}»: le notti da «Tage/giorni» sono una deduzione, da «Nächte/notti» no`);
  }
});

Deno.test('5d — il giorno senza mese prende il mese scritto altrove, solo se e uno solo', () => {
  const l = lettori();
  const d = l.leggiDate('4 notti a novembre 2026, arrivo domenica 15, in due, camera superior') as Letta | null;
  assert(d, 'non letta');
  assertEquals(g(d!.arrivo), '2026-11-15');
  assertEquals(g(d!.partenza), '2026-11-19');
  const de = l.leggiDate('Anreise Sonntag 15.11., 5 Nächte, 2 Erwachsene') as Letta | null;
  assert(de, 'non letta la tedesca');
  assertEquals(de!.arrivo.g, 15); assertEquals(de!.arrivo.m, 11); assertEquals(de!.notti, 5);
  /* con due mesi nel testo non si indovina niente */
  assertEquals(l.leggiDate('4 notti fra ottobre e novembre, arrivo domenica 15'), null);
});
```

- [ ] **Step 2: rosso**

Run: `deno test --allow-read --allow-env estensione/richieste.test.ts`
Expected: FAIL su «5c» e «5d».

- [ ] **Step 3: la regola**

Subito dopo il blocco del Task 2 (prima del `return`):

```js
    /* v2.25 — ARRIVO PIU' DURATA. «7 Nächte ab 20.09.», «eine Woche ab dem
       20. September», «3 notti dal 3 ottobre», «5 nights from 12 October».
       Chi scrive cosi' la partenza non la scrive: si calcola. Con «Tage»,
       «giorni», «days», «jours» le notti sono una DEDUZIONE — dieci giorni
       possono essere nove notti — e l'anteprima lo dichiara. */
    if (!r.arrivo) {
      const NUMERI = { una:1, uno:1, un:1, une:1, eine:1, einer:1, one:1, a:1, due:2, zwei:2, two:2, deux:2,
                       tre:3, drei:3, three:3, trois:3, quattro:4, vier:4, four:4, quatre:4 };
      const numero = (s) => /^\d+$/.test(s) ? +s : (NUMERI[s.toLowerCase()] || 0);
      const durata = t.match(/(\d{1,2}|una|uno|un|une|eine|einer|one|a|due|zwei|two|deux|tre|drei|three|trois|quattro|vier|four|quatre)\s*(N[äa]e?chte?|notti|notte|nights?|nuits?|Wochen?|settimane?|weeks?|semaines?|Tage|giorni|days|jours)\b/i);
      if (durata) {
        const n0 = numero(durata[1]);
        const unita = durata[2].toLowerCase();
        const settimane = /^(woche|settiman|week|semaine)/.test(unita);
        const giorni = /^(tage|giorni|days|jours)/.test(unita);
        const notti = settimane ? n0 * 7 : n0;
        const TUTTI_I_MESI = Object.assign({}, MESI_IT,
          { januar:1, februar:2, 'märz':3, april:4, mai:5, juni:6, juli:7, august:8, september:9, oktober:10, november:11, dezember:12,
            january:1, february:2, march:3, may:5, june:6, july:7, october:10, december:12,
            janvier:1, 'février':2, fevrier:2, mars:3, avril:4, juin:6, juillet:7, 'août':8, aout:8, septembre:9, octobre:10, novembre:11, 'décembre':12, decembre:12 });
        const INIZIO = String.raw`(?:ab\s+dem\s+|ab\s+|dal\s+|a\s+partire\s+dal\s+|from\s+|à\s+partir\s+du\s+|du\s+|anreise\s*:?\s*|arrivo\s*:?\s*|arrival\s*:?\s*|arriv[ée]e\s*:?\s*)`;
        let arrivo = null;
        const num = t.match(new RegExp(INIZIO + String.raw`(?:` + GIORNI + String.raw`\s*,?\s*)?(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?`, 'i'));
        if (num) {
          const me = +num[2], gg = +num[1];
          if (gg >= 1 && gg <= 31 && me >= 1 && me <= 12) {
            const a = num[3] ? (+num[3] < 100 ? 2000 + +num[3] : +num[3]) : annoDedotto(me, gg);
            arrivo = { g: gg, m: me, a };
          }
        }
        if (!arrivo) {
          const par = t.match(new RegExp(INIZIO + String.raw`(?:` + GIORNI + String.raw`\s*,?\s*)?(\d{1,2})\.?\s+([a-zà-ùäöü]+)(?:\s+(\d{4}))?`, 'i'));
          const me = par && TUTTI_I_MESI[par[2].toLowerCase()];
          if (par && me) arrivo = { g: +par[1], m: me, a: par[3] ? +par[3] : annoDedotto(me, +par[1]) };
        }
        if (!arrivo) {
          /* il giorno senza mese: «arrivo domenica 15» con «a novembre» piu'
             in la'. Solo se nel testo c'e' UN mese: con due non si indovina */
          const solo = t.match(new RegExp(INIZIO + String.raw`(?:` + GIORNI + String.raw`\s*,?\s*)?(\d{1,2})\b(?![./\d])`, 'i'));
          const mesi = [...new Set([...t.matchAll(/[a-zà-ùäöü]{3,}/gi)].map(x => x[0].toLowerCase()).filter(w => TUTTI_I_MESI[w]))];
          if (solo && mesi.length === 1) {
            const me = TUTTI_I_MESI[mesi[0]];
            const annoScritto = (t.match(/\b(20\d\d)\b/) || [])[1];
            arrivo = { g: +solo[1], m: me, a: annoScritto ? +annoScritto : annoDedotto(me, +solo[1]) };
          }
        }
        if (arrivo && notti > 0 && notti < 60) {
          const d1 = new Date(arrivo.a, arrivo.m - 1, arrivo.g, 12);
          const d2 = new Date(d1.getTime() + notti * 86400000);
          r.arrivo = arrivo;
          r.partenza = { g: d2.getDate(), m: d2.getMonth() + 1, a: d2.getFullYear() };
          r.notti = notti;
          if (giorni) r.nottiDedotte = true;
        }
      }
    }
```

`MESI_IT` esiste già nel file (usato a riga 395). Se `annoDedotto` con anno scritto nel testo dà un anno diverso, vince l'anno scritto: per questo «Ich möchte für 10 Tage kommen, Anreise 12.10.2026» prende 2026 dalla data stessa.

- [ ] **Step 4: verde**

Run: `deno test --allow-read --allow-env estensione/richieste.test.ts`
Expected: PASS.

- [ ] **Step 5: commit**

```bash
git add estensione/outlook-inject.js estensione/richieste.test.ts
git commit -m "Il lettore legge arrivo piu' durata («7 Nächte ab», «3 notti dal») e il giorno col mese altrove

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: le persone («Erw.», «Pers.», «und» somma, «davon» sottrae, «siamo in 2», «N coppie», «due camere matrimoniali», le età in lista)

**Files:**
- Modify: `estensione/outlook-inject.js` — `parseLibera()`, righe 490–561 di oggi
- Test: `estensione/richieste.test.ts`

**Interfaces:**
- Produces: `parseLibera` restituisce `adulti`, `bambini`, `etaBambini` («6 9»), `nCamere`, `adultiDedotti` come oggi, con i casi nuovi giusti.

- [ ] **Step 1: la prova che fallisce**

```ts
Deno.test('6a — «2 Personen und 1 Kind» fa 2 adulti e 1 bambino; «davon» e la parentesi sottraggono', () => {
  const l = lettori();
  const CASI = [
    ['vom 3.10. bis 10.10.2026, für 2 Personen und 1 Kind (8 Jahre)', 2, 1],
    ['dal 3 al 10 ottobre 2026, 2 persone + 2 bambini (6 e 9 anni)', 2, 2],
    ['vom 3.10. bis 10.10.2026, 3 Personen, davon 1 Kind', 2, 1],
    ['from 3 to 10 October 2026, 3 guests (1 child)', 2, 1],
    ['dal 3 al 10 ottobre 2026, 3 persone di cui 1 bambino', 2, 1],
  ] as const;
  for (const [testo, a, b] of CASI) {
    const r = l.parseLibera(testo, null);
    assert(r, `non letta: «${testo}»`);
    assertEquals(r!.adulti, a, `adulti sbagliati in «${testo}»`);
    assertEquals(r!.bambini, b, `bambini sbagliati in «${testo}»`);
  }
});

Deno.test('6b — «Erw.», «Pers.», «siamo in 2», «N coppie», «due camere matrimoniali»', () => {
  const l = lettori();
  const CASI = [
    ['vom 3.10. bis 10.10.2026, 2 Erw., Halbpension', 2, undefined],
    ['Angebot für 7 Nächte ab 20.09.2026, Doppelzimmer HP, 2 Pers.', 2, undefined],
    ['weekend del 10-12 ottobre 2026? siamo in 2', 2, undefined],
    ["dal 6 all'8 dicembre 2026 per due coppie, due camere matrimoniali", 4, 2],
    ['dal 3 al 10 ottobre 2026, 2 persone, per 2 notti', 2, undefined],
  ] as const;
  for (const [testo, a, nCamere] of CASI) {
    const r = l.parseLibera(testo, null);
    assert(r, `non letta: «${testo}»`);
    assertEquals(r!.adulti, a, `adulti sbagliati in «${testo}»`);
    assertEquals(r!.nCamere, nCamere, `camere sbagliate in «${testo}»`);
  }
});

Deno.test('6c — le eta si leggono tutte: «6 und 9 Jahre», «6 e 9 anni», «(6, 9)»', () => {
  const l = lettori();
  const CASI = [
    ['vom 3.10. bis 10.10.2026, 2 Erwachsene und 2 Kinder (6 und 9 Jahre)', '6 9'],
    ['dal 3 al 10 ottobre 2026, 2 adulti e 2 bambini di 6 e 9 anni', '6 9'],
    ['from 3 to 10 October 2026, 2 adults, 2 children (6, 9 years old)', '6 9'],
    ['dal 3 al 10 ottobre 2026, 2 adulti e 1 bambino di 8 anni', '8'],
  ] as const;
  for (const [testo, eta] of CASI) {
    const r = l.parseLibera(testo, null);
    assertEquals(String(r!.etaBambini ?? ''), eta, `eta sbagliate in «${testo}»`);
  }
});
```

- [ ] **Step 2: rosso**

Run: `deno test --allow-read --allow-env estensione/richieste.test.ts`
Expected: FAIL su 6a, 6b, 6c.

- [ ] **Step 3: le regole**

In `parseLibera()`:

1. riga 490: `Erwachsene[rn]?` → `Erwachsene[rn]?|Erw\.?`; riga 493: `Person(?:en)?` → `Person(?:en)?|Pers\.?`.
2. sostituire la riga 497 (`else if (/\bin due\b|\bper due\b|zu zweit/i.test(t)) r.adulti = 2;`) con:

```js
    else if ((() => {
      /* «per due coppie» sono quattro persone: le coppie vincono su «per due» */
      const cop = t.match(/(\d+|due|tre|quattro|zwei|drei|vier|two|three|four|deux|trois|quatre)\s*(?:coppie|coppia|Paare?|couples?)\b/i);
      if (!cop) return false;
      const NUM = { due:2, tre:3, quattro:4, zwei:2, drei:3, vier:4, two:2, three:3, four:4, deux:2, trois:3, quatre:4 };
      const n = /^\d+$/.test(cop[1]) ? +cop[1] : (NUM[cop[1].toLowerCase()] || 1);
      r.adulti = 2 * n; r.adultiDedotti = true; r.tipoCameraLetto = cop[0];
      return true;
    })()) { /* letto dalle coppie */ }
    /* «in due», «siamo in 2», «zu zweit», «for two» — ma non «per 2 notti» ne'
       «for 2 rooms»: quello che segue il numero decide */
    else if (/\bin due\b|\bper due\b|zu zweit|\b(?:siamo\s+in|in|per|für|for|pour)\s+(?:2|due|zwei|two|deux)\b(?!\s*(?:nott|night|n[äa]cht|nuit|camer|room|zimmer|chambre|giorn|day|tag|jour|settim|week|woch|semain|person|pers\b|erw|adult))/i.test(t)) r.adulti = 2;
```

3. sostituire il blocco della sottrazione (righe 548–553) con:

```js
    /* v2.25 — il totale si riduce dei bambini SOLO se il testo lo dice:
       «3 Personen, davon 1 Kind», «3 guests (1 child)», «3 persone di cui 1
       bambino». Con «und», «+», «e», «and» si somma: «2 Personen und 1
       Kind» sono tre persone, e prima usciva un adulto solo. */
    if (r.adultiDaTotale && r.bambini > 0 && a && b && b.index > a.index) {
      const fra = t.slice(a.index + a[0].length, b.index);
      if (/davon|inkl|incl|including|di\s+cui|dont|\(/i.test(fra) && r.adulti > r.bambini) {
        r.adulti -= r.bambini;
        r.adultiDedotti = true;
      }
    }

    /* «due camere matrimoniali» dette dopo un numero generico: due camere e,
       se gli adulti non sono scritti per esteso, quattro persone */
    const mc = t.match(/(\d+|due|tre|quattro|zwei|drei|vier|two|three|four|deux|trois|quatre)\s*(?:camere|Zimmer|rooms|chambres)\s+(?:matrimonial\w*|doppi\w*|Doppel\w*|double\w*|twin)/i);
    if (mc) {
      const NUM = { due:2, tre:3, quattro:4, zwei:2, drei:3, vier:4, two:2, three:3, four:4, deux:2, trois:3, quatre:4 };
      const n = /^\d+$/.test(mc[1]) ? +mc[1] : (NUM[mc[1].toLowerCase()] || 1);
      if (n > 1 && n <= 12) {
        r.nCamere = n;
        const espliciti = /(\d+)\s*(?:adult[oi]|adults?|adultes?|Erwachsene[rn]?|Erw\.?)\b/i.test(t);
        if (!espliciti && (r.adulti || 0) < 2 * n) { r.adulti = 2 * n; r.adultiDedotti = true; r.tipoCameraLetto = mc[0]; }
      }
    }
```

Attenzione: la variabile `b` (riga 545) dev'essere dichiarata con `const b = …` prima di questo blocco: già lo è.

4. sostituire le righe 559–561 (le età) con:

```js
    /* v2.25 — le eta' in lista: «6 und 9 Jahre», «6 e 9 anni», «(6, 9 years
       old)». Prima si prendeva solo il numero attaccato a «Jahre», e il
       primo bambino spariva. */
    const listaEta = t.match(/((?:\d{1,2}\s*(?:,|e|und|and|et|\/|-)\s*)*\d{1,2})\s*(?:anni|anno|Jahren?|ans|years?\s*old)\b/i);
    const eta = listaEta
      ? listaEta[1].split(/\s*(?:,|e|und|and|et|\/|-)\s*/).map(Number).filter(n => n >= 0 && n <= 17)
      : [];
    if (eta.length && (r.bambini || 0) > 0) r.etaBambini = eta.slice(0, r.bambini).join(' ');
```

- [ ] **Step 4: verde**

Run: `deno test --allow-read --allow-env estensione/richieste.test.ts`
Expected: PASS, comprese 2c e 2d di prima («3 guests (2 adults, 1 child)», «3 guests»).

- [ ] **Step 5: commit**

```bash
git add estensione/outlook-inject.js estensione/richieste.test.ts
git commit -m "Il lettore conta le persone come le scrive l'ospite: «und» somma, «davon» sottrae, coppie, camere, eta' in lista

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: trattamento in sigla, cure, cane, Zweibettzimmer, la categoria chiesta, la lingua

**Files:**
- Modify: `estensione/outlook-inject.js` — `parseLibera()` righe 563–612, `linguaTesto()` riga 1136
- Test: `estensione/richieste.test.ts`

**Interfaces:**
- Produces: `parseLibera` restituisce `categoriaChiesta` ∈ {`junior`, `suite`, `superior`, `queen`, `singola`} o niente; la tabella `CATEGORIE_CHIESTE` (regex → chiave) è l'unico posto dove si aggiungono sinonimi e nomi vecchi.

- [ ] **Step 1: la prova che fallisce**

```ts
Deno.test('7a — HP/HB, VP/FB, ÜF/BB come parola intera', () => {
  const l = lettori();
  const p = (t: string) => l.parseLibera(t, null)!;
  assertEquals(p('vom 3.10. bis 10.10.2026, DZ HP, 2 Pers.').trattamento, 'Mezza Pensione');
  assertEquals(p('dal 3 al 10 ottobre 2026, 2 adulti, HB').trattamento, 'Mezza Pensione');
  assert(p('vom 3.10. bis 10.10.2026, 2 Erw., VP').pensioneCompleta, 'VP e pensione completa');
  assertEquals(p('vom 3.10. bis 10.10.2026, DZ mit Frühstück (ÜF)').trattamento, 'Bed & Breakfast');
  assertEquals(p('from 3 to 10 October 2026, 2 adults, BB').trattamento, 'Bed & Breakfast');
  /* «hp» dentro un'altra parola non conta */
  assertEquals(p('dal 3 al 10 ottobre 2026, 2 adulti, vorremmo un chpiaro preventivo').trattamento, undefined);
});

Deno.test('7b — cure e cane in tedesco: Fangokur, Kur, Anwendungen, Hündin, Vierbeiner', () => {
  const l = lettori();
  for (const t of ['vom 3.10. bis 10.10.2026, Fangokur', 'vom 3.10. bis 10.10.2026, Kur mit Fangopackungen',
                   'vom 3.10. bis 10.10.2026, Thermalkur und Anwendungen', 'dal 3 al 10 ottobre 2026, ciclo di fangoterapia']) {
    assert(l.parseLibera(t, null)!.cure, `cure non lette in «${t}»`);
  }
  for (const t of ['vom 3.10. bis 10.10.2026, mit Hündin', 'vom 3.10. bis 10.10.2026, unser Vierbeiner kommt mit']) {
    assert(l.parseLibera(t, null)!.cane, `cane non letto in «${t}»`);
  }
  assert(!l.parseLibera('vom 3.10. bis 10.10.2026, wir kommen aus Kurort Bad Ischl', null)!.cure, '«Kurort» non e una cura');
});

Deno.test('7c — la categoria chiesta, per parole chiave, in quattro lingue', () => {
  const l = lettori();
  const CASI = [
    ['vom 24.12.2026 bis 02.01.2027, Juniorsuite', 'junior'],
    ['dal 3 al 10 ottobre 2026, junior suite se disponibile', 'junior'],
    ['from 3 to 10 October 2026, a suite please', 'suite'],
    ['4 notti a novembre 2026, arrivo domenica 15, camera superior', 'superior'],
    ['vom 3.10. bis 10.10.2026, Doppelzimmer Superior', 'superior'],
    ['dal 3 al 10 ottobre 2026, matrimoniale queen', 'queen'],
    ['vom 3. bis 10. Oktober 2026, Einzelzimmer', 'singola'],
    ['dal 3 al 10 ottobre 2026, camera matrimoniale', undefined],
    ['vom 3.10. bis 10.10.2026, Zweibettzimmer', undefined],
  ] as const;
  for (const [testo, cat] of CASI) {
    assertEquals(l.parseLibera(testo, null)!.categoriaChiesta, cat, `categoria sbagliata in «${testo}»`);
  }
  assertEquals(l.parseLibera('vom 3.10. bis 10.10.2026, Zweibettzimmer', null)!.adulti, 2, 'Zweibettzimmer e una doppia');
});

Deno.test('7d — un email tedesca di due righe e riconosciuta come tedesca', () => {
  const l = lettori();
  assertEquals(l.linguaTesto('Anreise 12.10., Abreise 19.10., Doppelzimmer Halbpension. Angebot bitte.'), 'de');
  assertEquals(l.linguaTesto('Arrivo 12/10, partenza 19/10, doppia mezza pensione. Grazie, un preventivo.'), 'it');
});
```

- [ ] **Step 2: rosso**

Run: `deno test --allow-read --allow-env estensione/richieste.test.ts`
Expected: FAIL su 7a–7d («linguaTesto» non è ancora esposta: 7d fallisce con «not a function»).

- [ ] **Step 3: le regole**

1. Trattamento — sostituire le righe 566–575 con:

```js
    const cena = /\bcen[ae]\b|\bdinner\b|\bAbendessen\b|\bd[îi]ner\b|\bsouper\b/i.test(t);
    const colazione = /colazione|frühstück|fruehstueck|breakfast|petit\s*d[ée]jeuner/i.test(t);
    /* v2.25 — le sigle, solo come parola intera in MAIUSCOLO: HP/HB mezza
       pensione, VP/FB pensione completa, ÜF/BB colazione. «hp» dentro
       un'altra parola non e' niente. */
    const siglaMP = /\b(?:HP|HB)\b/.test(t), siglaPC = /\b(?:VP|FB)\b/.test(t);
    const siglaBB = /\b(?:ÜF|UeF|BB)\b/.test(t) || /Übernachtung\s+mit\s+Frühstück/i.test(t);
    if (/mezza\s*pensione|halbpension|half\s*board|demi[-\s]?pension/i.test(t) || siglaMP) {
      r.trattamento = 'Mezza Pensione';
    } else if (cena && colazione) {
      r.trattamento = 'Mezza Pensione';
      r.trattamentoDedotto = true;
    } else if (colazione || siglaBB || /b\s*&\s*b|bed\s*(?:&|and)\s*breakfast/i.test(t)) {
      r.trattamento = 'Bed & Breakfast';
    }
```

   e nella regola della pensione completa (riga 600) aggiungere la sigla:
   `if (/\bpensione\s+completa\b|\bVollpension\b|\bfull\s*board\b|\bpension\s+compl[èe]te\b/i.test(t) || siglaPC) {`

2. Cure — riga 583 diventa:

```js
    if (/\bcure\s+termali\b|\bfangh?[io]\b|\bfango\w+|\bKur\b|Kuranwendung|Thermalkur|Kuraufenthalt|\bAnwendungen\b|\bthermal\s+(?:cure|treatment)/i.test(t)) {
```

3. Cane — riga 580 diventa:

```js
    if (/\bcan[ei]\b|\bcagnolin\w*|\bHund(?:in)?\b|\bH[üu]ndin\b|\bHunde\b|\bVierbeiner\b|\bdogs?\b|\bchiens?\b/i.test(t)) {
```

4. Zweibettzimmer — nella riga di `DA_CAMERA` per le doppie (riga 514) aggiungere `|\bZweibettzimmer\b` dopo `\bDoppelzimmer\b`.

5. La categoria chiesta — subito dopo il blocco delle alternative (riga 610), prima di `r.note = …`:

```js
    /* v2.25 — LA CATEGORIA CHIESTA, per parole chiave. Non e' un nome: e'
       la parola che poi si cerca nel nome della categoria che il motore
       restituisce. Qui, e solo qui, si aggiungono sinonimi e nomi vecchi
       delle categorie: una riga, una prova. L'ordine conta: «Junior Suite»
       contiene «suite», e va letta come junior. */
    const CATEGORIE_CHIESTE = [
      [/junior[\s-]?suite|juniorsuite/i, 'junior'],
      [/\bsuiten?\b/i, 'suite'],
      [/\bsuperior\w*/i, 'superior'],
      [/\bqueen\b/i, 'queen'],
      [/\bsingol[aei]\b|\bEinzelzimmer\b|\bEZ\b|\bsingle\s*rooms?\b|\bSGL\b|\bchambres?\s+simples?\b/i, 'singola'],
    ];
    for (const [cerca, chiave] of CATEGORIE_CHIESTE) {
      if (cerca.test(t)) { r.categoriaChiesta = chiave; break; }
    }
```

6. Lingua — in `linguaTesto()`, la riga `de:` diventa:

```js
      de: (s.match(/\b(und|ich|wir|bitte|preise?|für|möchten?|guten|sehr|danke|öffnungszeiten|eintritt|kostet|anreise|abreise|zimmer|nächte|übernachtung|doppelzimmer|einzelzimmer|halbpension|angebot|anfrage)\b/g) || []).length,
```

   e la riga `it:` aggiunge `arrivo|partenza|camera|notti|preventivo|adulti`:

```js
      it: (s.match(/\b(buongiorno|buonasera|salve|grazie|vorrei|vorremmo|quanto|costa|orari|ingresso|prezzi|piscine|informazioni|sapere|arrivo|partenza|camera|notti|preventivo|adulti|doppia|matrimoniale)\b/g) || []).length
```

7. Esporre `linguaTesto` per le prove: riga 1483, l'oggetto `__leonardoInject` aggiunge `linguaTesto`.

- [ ] **Step 4: verde**

Run: `deno test --allow-read --allow-env estensione/richieste.test.ts`
Expected: PASS.

- [ ] **Step 5: commit**

```bash
git add estensione/outlook-inject.js estensione/richieste.test.ts
git commit -m "Il lettore capisce HP/VP/ÜF, Fangokur e Kur, Hündin, Zweibettzimmer, e legge la categoria chiesta

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: quello che si mette da parte per il pannello, e l'anteprima che dichiara le notti dedotte

**Files:**
- Modify: `estensione/outlook-inject.js` — `ricordaRichiesta()` righe 959–977, `mostraAnteprima()` riga 873, esportazione riga 1483
- Modify: `estensione/richieste.test.ts` — `lettori()` accetta una spia
- Test: `estensione/richieste.test.ts`

**Interfaces:**
- Produces: `leonardo_richiesta` con in più `arrivo`, `partenza` (ISO), `notti`, `adulti`, `bambini`, `etaBambini`, `trattamento`, `categoriaChiesta`, `nCamere`, `dedotti` (array di stringhe fra `adulti`, `trattamento`, `notti`). Un campo assente nei dati non si scrive. `__leonardoInject` espone anche `ricordaRichiesta` e `isoDaLetta`.

- [ ] **Step 1: la spia nel caricatore e la prova che fallisce**

In `richieste.test.ts`, la firma di `lettori()` diventa `function lettori(set: (o: unknown) => void = () => {}): Lettori` e dentro `chrome.storage.local` la riga `set: nulla,` diventa `set,`. Il tipo `Lettori` aggiunge:

```ts
  ricordaRichiesta: (dati: Record<string, unknown>) => void;
  linguaTesto: (t: string) => string;
```

Poi in coda:

```ts
Deno.test('8 — quello che il lettore ha letto arriva al pannello, in forma ISO', () => {
  let scritto: Record<string, Record<string, unknown>> | null = null;
  const l = lettori((o) => { scritto = o as Record<string, Record<string, unknown>>; });
  const r = l.parseLibera('vom 3.10. bis 10.10.2026, 2 Erwachsene und 1 Kind (8 Jahre), Juniorsuite, Halbpension, mit Hund', null)!;
  l.ricordaRichiesta(r);
  assert(scritto, 'ricordaRichiesta non ha scritto niente');
  const q = scritto!.leonardo_richiesta;
  assertEquals(q.arrivo, '2026-10-03');
  assertEquals(q.partenza, '2026-10-10');
  assertEquals(q.notti, 7);
  assertEquals(q.adulti, 2);
  assertEquals(q.bambini, 1);
  assertEquals(q.etaBambini, '8');
  assertEquals(q.trattamento, 'Mezza Pensione');
  assertEquals(q.categoriaChiesta, 'junior');
  assertEquals(q.cane, true);
  assertEquals(q.dedotti, []);
});

Deno.test('8b — cio che e dedotto viene detto, e cio che manca non si scrive', () => {
  let scritto: Record<string, Record<string, unknown>> | null = null;
  const l = lettori((o) => { scritto = o as Record<string, Record<string, unknown>>; });
  const r = l.parseLibera('Ich möchte für 10 Tage kommen, Anreise 12.10.2026, Einzelzimmer. Abendessen und Frühstück bitte.', null)!;
  l.ricordaRichiesta(r);
  const q = scritto!.leonardo_richiesta;
  assertEquals((q.dedotti as string[]).sort(), ['adulti', 'notti', 'trattamento']);
  assert(!('bambini' in q), 'bambini non letti: non si scrive uno zero inventato');
  assert(!('nCamere' in q), 'camere non lette: non si scrive');
});

Deno.test('8c — l anteprima dichiara le notti dedotte', () => {
  const fonte = SORGENTE.match(/function mostraAnteprima\(dati\) \{[\s\S]*?\n  \}/);
  assert(fonte, 'mostraAnteprima non si trova');
  assert(/nottiDedotte/.test(fonte![0]), 'l anteprima non dice che le notti da «10 Tage» sono una deduzione');
});
```

- [ ] **Step 2: rosso**

Run: `deno test --allow-read --allow-env estensione/richieste.test.ts`
Expected: FAIL su 8, 8b, 8c.

- [ ] **Step 3: il codice**

`ricordaRichiesta` diventa:

```js
  function ricordaRichiesta(dati) {
    try {
      if (!chrome?.storage?.local) return;
      const q = {
        quando: Date.now(),
        ospite: dati.ospite || '',
        email: dati.email || '',
        telefono: dati.telefono || '',
        lingua: linguaTesto(dati.testoOriginale || dati.note || '') || 'it',
        cure: !!dati.cure,
        cane: !!dati.cane,
        oggetto: (dati.testoOriginale || '').slice(0, 80)
      };
      /* v2.25 — QUELLO CHE SERVE AL PANNELLO per compilare i filtri e
         proporre: date in ISO, persone, trattamento, categoria chiesta.
         Un campo che il lettore non ha prodotto NON si scrive: uno zero
         inventato nei bambini sarebbe un dato falso che il pannello
         prenderebbe per buono. */
      const iso = (d) => typeof d === 'string' ? d : isoDaLetta(d);
      if (dati.arrivo && iso(dati.arrivo)) q.arrivo = iso(dati.arrivo);
      if (dati.partenza && iso(dati.partenza)) q.partenza = iso(dati.partenza);
      if (dati.notti != null) q.notti = +dati.notti;
      if (dati.adulti != null) q.adulti = +dati.adulti;
      if (dati.bambini != null) q.bambini = +dati.bambini;
      if (dati.etaBambini) q.etaBambini = String(dati.etaBambini).trim();
      if (dati.trattamento) q.trattamento = dati.trattamento;
      if (dati.categoriaChiesta) q.categoriaChiesta = dati.categoriaChiesta;
      if (dati.nCamere) q.nCamere = +dati.nCamere;
      q.dedotti = [
        dati.adultiDedotti ? 'adulti' : '',
        dati.trattamentoDedotto ? 'trattamento' : '',
        dati.nottiDedotte ? 'notti' : '',
      ].filter(Boolean);
      chrome.storage.local.set({ leonardo_richiesta: q });
    } catch (e) { /* il riquadro si compila a mano, come prima */ }
  }
```

(`isoDaLetta` è definita più sotto nello stesso file, riga 1314: le `function` si vedono ovunque dentro l'IIFE.)

In `mostraAnteprima`, la riga `agg('Periodo', …)` diventa:

```js
    agg('Periodo', a && p ? `dal ${a} al ${p}${dati.notti ? ` &middot; ${dati.notti} ${dati.notti === 1 ? 'notte' : 'notti'}` : ''}${
        dati.nottiDedotte ? ' <span style="color:#8C7A45;">(notti dedotte dai giorni scritti — verifica)</span>' : ''}` : '',
        'date non lette — attenzione, sono la cosa piu\' facile da sbagliare');
```

`parseLibera` deve portare `nottiDedotte` da `leggiDate`: la riga 476 diventa
`if (date) { r.arrivo = date.arrivo; r.partenza = date.partenza; r.notti = date.notti; if (date.nottiDedotte) r.nottiDedotte = true; }`.

Esportazione (riga 1483): `{ parseLibera, leggiDate, PAROLE_RICHIESTA, annoDedotto, ricordaRichiesta, isoDaLetta, linguaTesto, IMPRONTE_FIRMA, RIGA_DI_FIRMA, LEGALESE }`.

- [ ] **Step 4: verde**

Run: `deno test --allow-read --allow-env estensione/richieste.test.ts estensione/preventivo.test.ts estensione/nuovo-cliente.test.ts`
Expected: PASS (nuovo-cliente.test.ts controlla che `leonardo_richiesta` porti ancora `telefono`).

- [ ] **Step 5: commit**

```bash
git add estensione/outlook-inject.js estensione/richieste.test.ts
git commit -m "Quello che il lettore legge arriva al pannello: date ISO, persone, trattamento, categoria, e cosa e' dedotto

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: il pannello compila i filtri dalla richiesta e cerca da solo

**Files:**
- Modify: `estensione/fidra-disponibilita.js` — `apri()` righe 634–745 (la chiamata `esegui();` a riga 744), `riempiDaRichiesta()` riga 1071
- Test: `estensione/preventivo.test.ts` (in coda; `MODALE` è già il sorgente del pannello, riga 381)

**Interfaces:**
- Produces: `async function compilaDaRichiesta()` dentro `apri()`: legge `leonardo_richiesta`, se fresca (< 60 min) e con `arrivo` scrive `dArrivo`, `dPartenza`, `dAdulti`, `dBambini`, le età, mette la nota in `dEsito`, salva la richiesta in `RICHIESTA_LETTA` (variabile di `apri()`, `let RICHIESTA_LETTA = null;`) e restituisce `true`; altrimenti `false`. La prima ricerca parte una volta sola, dopo.

- [ ] **Step 1: la prova che fallisce**

In coda a `preventivo.test.ts`:

```ts
/* ============================================================
   IL PANNELLO COMPILA I FILTRI DALLA RICHIESTA E CERCA DA SOLO (v2.25).
   Date e persone le ribatteva l'operatore. Prove sul sorgente: il pannello
   vive dentro Fidra e fuori dal browser non si esegue.
   ============================================================ */
Deno.test('il pannello compila arrivo, partenza, adulti e bambini dalla richiesta, solo senza prenotazione aperta', () => {
  const f = MODALE.match(/async function compilaDaRichiesta\(\) \{([\s\S]*?)\n    \}/);
  assert(f, 'compilaDaRichiesta() non si trova per intero');
  for (const campo of ['dArrivo', 'dPartenza', 'dAdulti', 'dBambini']) {
    assert(new RegExp("\\$\\('" + campo + "'\\)\\.value = ").test(f![1]), `non scrive ${campo}`);
  }
  assert(/60 \* 60 \* 1000/.test(f![1]), 'una richiesta vecchia verrebbe usata lo stesso');
  assert(/Compilato dalla richiesta/.test(f![1]), 'non dice che i filtri vengono dalla richiesta');
  assert(/persone non lette/.test(f![1]), 'con gli adulti non letti non lo dice');
  assert(/notti dedotte/.test(f![1]), 'con le notti dedotte non lo dice');
  assert(/!pren && await compilaDaRichiesta\(\)/.test(MODALE), 'compila anche con una prenotazione aperta, che invece comanda');
});

Deno.test('la prima ricerca parte una volta sola, dopo aver compilato', () => {
  assert(/const compilato = !pren && await compilaDaRichiesta\(\);\s*esegui\(\);/.test(MODALE),
    'la ricerca parte prima dei filtri compilati, o due volte');
  assertEquals((MODALE.match(/^\s*esegui\(\);\s*$/gm) || []).length, 1, 'esegui() e chiamata piu di una volta all apertura');
});
```

- [ ] **Step 2: rosso**

Run: `deno test --allow-read --allow-env estensione/preventivo.test.ts`
Expected: FAIL sulle due prove nuove.

- [ ] **Step 3: il codice**

In `apri()`, subito dopo `const MAX_SCELTE = 4;` (riga 642):

```js
    /* v2.25 — la richiesta letta in Outlook, se fresca: da qui prendono i
       filtri (compilaDaRichiesta) e le proposte (proponi). Null se non c'e'
       o e' vecchia: allora il pannello lavora come sempre. */
    let RICHIESTA_LETTA = null;
```

Sostituire le righe 743–744 (`$('dCerca').addEventListener('click', esegui);` e `esegui();`) con:

```js
    $('dCerca').addEventListener('click', esegui);

    /* v2.25 — CHI RISPONDE A UN'EMAIL NON RIBATTE LE DATE. Senza una
       prenotazione aperta, i filtri si compilano dalla richiesta letta in
       Outlook e la ricerca parte da sola; con una prenotazione aperta
       comanda la prenotazione, come sempre. La prima ricerca parte UNA
       volta, dopo: prima partiva sui filtri di default e la seconda
       avrebbe sovrascritto la prima. */
    async function compilaDaRichiesta() {
      if (!ESTENSIONE) return false;
      try {
        const r = await chrome.storage.local.get(['leonardo_richiesta']);
        const q = r.leonardo_richiesta;
        if (!q || Date.now() - (q.quando || 0) > 60 * 60 * 1000 || !q.arrivo) return false;
        RICHIESTA_LETTA = q;
        $('dArrivo').value = q.arrivo;
        $('dPartenza').value = q.partenza || piuGiorni(q.arrivo, q.notti || 3);
        const avvisi = [];
        if (q.adulti) $('dAdulti').value = String(Math.min(6, q.adulti));
        else avvisi.push('persone non lette: controlla');
        $('dBambini').value = String(Math.min(4, q.bambini || 0));
        campiEta();
        const eta = String(q.etaBambini || '').trim().split(/\s+/).filter(Boolean);
        [...$('dEta').querySelectorAll('input')].forEach((inp, i) => { if (eta[i] != null) inp.value = eta[i]; });
        if ((q.dedotti || []).includes('notti')) avvisi.push('notti dedotte dai giorni scritti: controlla la partenza');
        if ((q.dedotti || []).includes('adulti')) avvisi.push('adulti dedotti dal tipo di camera: controlla');
        if (!q.partenza && !q.notti) avvisi.push('partenza non letta: messa a tre notti');
        $('dEsito').innerHTML = `<span style="color:#8C7A45;">Compilato dalla richiesta aperta in Outlook${
          q.oggetto ? ' &laquo;' + esc(q.oggetto.slice(0, 60)) + '&raquo;' : ''} &mdash; rileggi prima di mandare${
          avvisi.length ? ' &middot; ' + avvisi.map(esc).join(' &middot; ') : ''}.</span>`;
        return true;
      } catch (e) { return false; }
    }

    (async () => {
      const compilato = !pren && await compilaDaRichiesta();
      esegui();
      if (compilato) { /* l'esito resta a video: esegui() lo pulisce solo se non c'e' una chiusura */ }
    })();
```

Attenzione: `esegui()` scrive `$('dEsito').textContent = 'Chiedo a Fidra…'` e poi lo svuota. Per non perdere la nota, in `esegui()` la riga `$('dEsito').textContent = '';` (riga 767) diventa:

```js
          if (!RICHIESTA_LETTA) $('dEsito').textContent = '';
```

e la riga `$('dEsito').textContent = 'Chiedo a Fidra\u2026';` (riga 755) diventa `if (!RICHIESTA_LETTA) $('dEsito').textContent = 'Chiedo a Fidra\u2026';`. `campiEta()` è definita a riga 700, prima di questo blocco; `piuGiorni` e `ESTENSIONE` esistono già nel file.

- [ ] **Step 4: verde**

Run: `deno test --allow-read --allow-env estensione/preventivo.test.ts`
Expected: PASS.

- [ ] **Step 5: commit**

```bash
git add estensione/fidra-disponibilita.js estensione/preventivo.test.ts
git commit -m "Il pannello compila date e persone dalla richiesta letta in Outlook e cerca da solo

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: le proposte — la categoria chiesta più un'alternativa, pre-spuntate

**Files:**
- Modify: `estensione/fidra-disponibilita.js` — funzione pura a livello dell'IIFE (prima di `function apri()`, riga 634), `disegna()` (righe 777–1011), il gestore dei «+ Prev.» (righe 1096–1119), `aggiornaBarra()`
- Test: `estensione/preventivo.test.ts`

**Interfaces:**
- Produces: `proposteDaRichiesta(righe, richiesta) → [{categoria, trattamento}]` (0–2 elementi), con `righe: [{categoria, trattamento, totale, libere, maxAdulti, stima}]` e `richiesta: {categoriaChiesta?, trattamento?, adulti?, bambini?}`; `togliOMetti(bottone)` (la logica di «+ Prev.», riusata); `proponi(righe)`.

- [ ] **Step 1: la prova che fallisce**

```ts
/* ============================================================
   LE PROPOSTE: la categoria chiesta piu' un'alternativa (v2.25).
   La regola sta in una funzione pura, estratta ed ESEGUITA qui.
   ============================================================ */
type Riga = { categoria: string; trattamento: string; totale: number; libere: number; maxAdulti: number | null; stima?: boolean };
const proposteDaRichiesta = (() => {
  const m = MODALE.match(/\n  function proposteDaRichiesta\([^)]*\) \{[\s\S]*?\n  \}/);
  assert(m, 'proposteDaRichiesta() non si trova per intero');
  return new Function(m[0] + '\nreturn proposteDaRichiesta;')() as
    (righe: Riga[], richiesta: Record<string, unknown>) => { categoria: string; trattamento: string }[];
})();
const RIGHE: Riga[] = [
  { categoria: 'Doppia', trattamento: 'Miglior Prezzo Bed & Breakfast', totale: 50000, libere: 3, maxAdulti: 2 },
  { categoria: 'Doppia', trattamento: 'Miglior Prezzo Mezza Pensione', totale: 70000, libere: 3, maxAdulti: 2 },
  { categoria: 'Doppia Superior', trattamento: 'Miglior Prezzo Bed & Breakfast', totale: 60000, libere: 2, maxAdulti: 2 },
  { categoria: 'Doppia Superior', trattamento: 'Miglior Prezzo Mezza Pensione', totale: 80000, libere: 2, maxAdulti: 2 },
  { categoria: 'Junior Suite', trattamento: 'Miglior Prezzo Mezza Pensione', totale: 100000, libere: 1, maxAdulti: 3 },
  { categoria: 'Suite', trattamento: 'Miglior Prezzo Mezza Pensione', totale: 140000, libere: 1, maxAdulti: 4 },
  { categoria: 'Singola Parco', trattamento: 'Miglior Prezzo Mezza Pensione', totale: 45000, libere: 1, maxAdulti: 1 },
];
const nomi = (p: { categoria: string; trattamento: string }[]) => p.map((x) => x.categoria + ' · ' + x.trattamento);

Deno.test('proposte: la categoria chiesta col trattamento chiesto, piu quella subito piu cara', () => {
  assertEquals(nomi(proposteDaRichiesta(RIGHE, { categoriaChiesta: 'superior', trattamento: 'Mezza Pensione', adulti: 2 })),
    ['Doppia Superior · Miglior Prezzo Mezza Pensione', 'Junior Suite · Miglior Prezzo Mezza Pensione']);
});

Deno.test('proposte: se la chiesta e la piu cara, l alternativa e quella subito sotto', () => {
  assertEquals(nomi(proposteDaRichiesta(RIGHE, { categoriaChiesta: 'suite', trattamento: 'Mezza Pensione', adulti: 2 })),
    ['Suite · Miglior Prezzo Mezza Pensione', 'Junior Suite · Miglior Prezzo Mezza Pensione']);
});

Deno.test('proposte: senza categoria chiesta, le due meno care che tengono le persone', () => {
  assertEquals(nomi(proposteDaRichiesta(RIGHE, { trattamento: 'Mezza Pensione', adulti: 2 })),
    ['Doppia · Miglior Prezzo Mezza Pensione', 'Doppia Superior · Miglior Prezzo Mezza Pensione']);
  /* tre persone: la Doppia non tiene */
  assertEquals(nomi(proposteDaRichiesta(RIGHE, { trattamento: 'Mezza Pensione', adulti: 2, bambini: 1 })),
    ['Junior Suite · Miglior Prezzo Mezza Pensione', 'Suite · Miglior Prezzo Mezza Pensione']);
});

Deno.test('proposte: trattamento non offerto per quella categoria, prima tariffa; categoria chiesta non libera, regola delle due meno care', () => {
  assertEquals(nomi(proposteDaRichiesta(RIGHE, { categoriaChiesta: 'junior', trattamento: 'Bed & Breakfast', adulti: 2 })),
    ['Junior Suite · Miglior Prezzo Mezza Pensione', 'Suite · Miglior Prezzo Mezza Pensione']);
  const senzaQueen = proposteDaRichiesta(RIGHE, { categoriaChiesta: 'queen', trattamento: 'Mezza Pensione', adulti: 2 });
  assertEquals(nomi(senzaQueen), ['Doppia · Miglior Prezzo Mezza Pensione', 'Doppia Superior · Miglior Prezzo Mezza Pensione']);
});

Deno.test('proposte: le stime non si propongono mai, e una categoria sola da una proposta sola', () => {
  const conStima = RIGHE.map((r) => r.categoria === 'Junior Suite' ? { ...r, stima: true } : r);
  assertEquals(nomi(proposteDaRichiesta(conStima, { categoriaChiesta: 'superior', trattamento: 'Mezza Pensione', adulti: 2 })),
    ['Doppia Superior · Miglior Prezzo Mezza Pensione', 'Suite · Miglior Prezzo Mezza Pensione']);
  assertEquals(nomi(proposteDaRichiesta(RIGHE.filter((r) => r.categoria === 'Doppia'), { trattamento: 'Mezza Pensione', adulti: 2 })),
    ['Doppia · Miglior Prezzo Mezza Pensione']);
  assertEquals(proposteDaRichiesta([], { adulti: 2 }), []);
});

Deno.test('le proposte entrano dai pulsanti «+ Prev.», la barra lo dice, e niente parte da solo', () => {
  assert(/function togliOMetti\(b\)/.test(MODALE), 'la logica di «+ Prev.» non e una funzione riusabile');
  assert(/RIGHE\.push\(\{ categoria: nome, trattamento: rv\.full_name \|\| rv\.name, totale: c\.totale/.test(MODALE), 'le righe non si raccolgono per le proposte');
  assert(/if \(RICHIESTA_LETTA && !SCELTE\.length\) proponi\(RIGHE\)/.test(MODALE), 'le proposte non partono dopo i risultati, o partono sopra una scelta gia fatta');
  assert(/proposte dalla richiesta/.test(MODALE), 'la barra non dice che le sistemazioni sono proposte');
  assert(!/creaPreventivo\(\);?\s*\}\)\(\)/.test(MODALE), 'il preventivo parte da solo');
});
```

- [ ] **Step 2: rosso**

Run: `deno test --allow-read --allow-env estensione/preventivo.test.ts`
Expected: FAIL (`proposteDaRichiesta() non si trova per intero`).

- [ ] **Step 3: il codice**

1. La funzione pura, prima di `function apri()` (riga 634), a due spazi di rientro:

```js
  /* v2.25 — LE PROPOSTE. Da una richiesta letta in Outlook e dalle righe
     appena disegnate, al massimo due sistemazioni: la categoria chiesta col
     trattamento chiesto, piu' quella subito piu' cara (o subito meno cara,
     se la chiesta e' gia' la piu' cara); senza categoria chiesta, le due
     meno care che tengono le persone. Le stime non si propongono mai: una
     stima non si manda a un cliente. Funzione pura, senza DOM: le prove la
     estraggono e la eseguono. */
  function proposteDaRichiesta(righe, richiesta) {
    const norm = (x) => String(x || '').toLowerCase().replace(/&/g, ' e ').replace(/[^a-z0-9]+/g, ' ').replace(/\band\b/g, 'e').replace(/\s+/g, ' ').trim();
    const persone = (+richiesta.adulti || 0) + (+richiesta.bambini || 0);
    const buone = righe.filter(r => !r.stima && r.libere > 0 && (r.maxAdulti == null || persone === 0 || r.maxAdulti >= persone));
    const tratt = norm(richiesta.trattamento);
    /* per ogni categoria una riga sola: quella col trattamento chiesto, o la prima */
    const perCat = new Map();
    for (const r of buone) {
      const c = perCat.get(r.categoria);
      const suoTratt = tratt && norm(r.trattamento).includes(tratt);
      if (!c || (suoTratt && !c.suoTratt)) perCat.set(r.categoria, { riga: r, suoTratt });
    }
    const ordinate = [...perCat.values()].map(v => v.riga).sort((a, b) => a.totale - b.totale);
    if (!ordinate.length) return [];
    const CHIAVI = { junior: /junior/, suite: /suite/, superior: /superior/, queen: /queen/, singola: /singol|einzel|single/ };
    const chiave = CHIAVI[richiesta.categoriaChiesta];
    const chiesta = chiave ? ordinate.find(r => chiave.test(norm(r.categoria)) && (richiesta.categoriaChiesta !== 'suite' || !/junior/.test(norm(r.categoria)))) : null;
    const esci = (r) => ({ categoria: r.categoria, trattamento: r.trattamento });
    if (chiesta) {
      const i = ordinate.indexOf(chiesta);
      const alternativa = ordinate[i + 1] || ordinate[i - 1] || null;
      return alternativa ? [esci(chiesta), esci(alternativa)] : [esci(chiesta)];
    }
    return ordinate.slice(0, 2).map(esci);
  }
```

2. In `disegna()`: subito dopo `const nNotti = notti(arrivo, partenza);` (riga 778) aggiungere `const RIGHE = [];`. Dentro il ciclo delle variazioni, subito dopo `const c = calcola(rv, cat, adulti, etaBambini);` (riga 919) — ma DOPO che `sconto` è calcolato: quindi subito prima di `const extra = [];` (riga 954) — aggiungere:

```js
            RIGHE.push({ categoria: nome, trattamento: rv.full_name || rv.name, totale: c.totale,
                         libere: v.libere.length, maxAdulti: cat.max_adults != null ? cat.max_adults : null,
                         stima: !!(sconto && sconto.stima) });
```

3. Il gestore dei «+ Prev.» (righe 1096–1119) diventa una funzione riusata:

```js
      /* v2.25 — la stessa logica per il clic e per le proposte: una via sola */
      function togliOMetti(b) {
        const i = SCELTE.findIndex(v => v.categoria === b.dataset.cat &&
                                        v.trattamento === b.dataset.tratt);
        if (i >= 0) SCELTE.splice(i, 1);
        else if (SCELTE.length < MAX_SCELTE) SCELTE.push({
          categoria:   b.dataset.cat,
          trattamento: b.dataset.tratt,
          prezzoPP: +b.dataset.pp   || 0,
          totale:   +b.dataset.tot  || 0,
          cure:     +b.dataset.cure || 0,
          sconto5:  +b.dataset.sc5  || 0,
          sconto3:  +b.dataset.sc3  || 0,
          bambiniPrezzi: (b.dataset.bimbi || '').split(',').filter(x => x !== '').map(Number),
          stima: false
        });
        marcaPulsanti();
        aggiornaBarra();
      }
      $('dRis').querySelectorAll('.prev').forEach(b => b.addEventListener('click', () => togliOMetti(b)));

      /* v2.25 — LE PROPOSTE, solo se non c'e' gia' una scelta: una selezione
         fatta dall'operatore non si sovrascrive. Passano dagli stessi
         pulsanti, quindi stessi prezzi, sconti e bambini. */
      let PROPOSTE = 0;
      function proponi(righe) {
        const scelte = proposteDaRichiesta(righe, RICHIESTA_LETTA || {});
        for (const s of scelte) {
          const b = [...$('dRis').querySelectorAll('.prev')].find(x => x.dataset.cat === s.categoria && x.dataset.tratt === s.trattamento && !x.disabled);
          if (b) togliOMetti(b);
        }
        PROPOSTE = SCELTE.length;
        if (PROPOSTE && $('dPrevNota')) {
          $('dPrevNota').textContent += ` · ${PROPOSTE} ${PROPOSTE === 1 ? 'proposta' : 'proposte'} dalla richiesta: rileggi, un clic le toglie.`;
        }
      }
      if (RICHIESTA_LETTA && !SCELTE.length) proponi(RIGHE);
```

Il commento e la costante `MESI_ABBR` che seguivano il vecchio gestore restano dove sono. In `aggiornaBarra()`, `$('dPrevNota')` esiste solo dopo il primo disegno della barra: `proponi` chiama `togliOMetti` → `aggiornaBarra()` → la barra esiste → poi scrive la nota. `riempiDaRichiesta()` (chiamata da `aggiornaBarra`) scrive «Compilato dalla richiesta…» nella stessa nota: le due frasi si accodano, ed è voluto.

- [ ] **Step 4: verde**

Run: `deno test --allow-read --allow-env estensione/preventivo.test.ts estensione/alternative.test.ts`
Expected: PASS.

- [ ] **Step 5: commit**

```bash
git add estensione/fidra-disponibilita.js estensione/preventivo.test.ts
git commit -m "Il pannello propone la categoria chiesta piu' un'alternativa, dagli stessi pulsanti del preventivo

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: versione 2.25.0, OneDrive, suite intera

**Files:**
- Modify: `estensione/manifest.json` (`"version": "2.24.0"` → `"2.25.0"`), intestazioni: `estensione/fidra-disponibilita.js` riga 2 (`v1.3` → `v1.4`)

- [ ] **Step 1: versione e intestazioni**

`estensione/manifest.json`: `"version": "2.25.0",`. `fidra-disponibilita.js` riga 2: `Offerta Leonardo — Disponibilità e prezzi (v1.4)`.

- [ ] **Step 2: il cancello delle variabili e OneDrive**

Run: `node strumenti/estensione.js`
Expected: `estensione 2.25.0 portata in C:/Users/admin/OneDrive/...`. Se si ferma su una variabile non definita, correggerla (di solito un nome usato fuori dallo scope in cui è dichiarato).

- [ ] **Step 3: la suite intera**

Run: `deno test --allow-read --allow-env`
Expected: `ok | N passed | 0 failed` con N ≥ 1903 + le prove nuove (circa 25).

- [ ] **Step 4: commit e push**

```bash
git add estensione/manifest.json estensione/fidra-disponibilita.js
git commit -m "Offerta Leonardo 2.25.0: il preventivo parte dalla richiesta

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
git push origin main
```

- [ ] **Step 5: dirlo alla proprietà**

Nel rapporto: versione 2.25.0 su OneDrive, da ricaricare da `chrome://extensions` su ogni PC; il flusso (pulsante in Outlook → «Disponibilità e prezzi» in Fidra senza prenotazione aperta → filtri compilati, ricerca partita, due proposte pre-spuntate → rileggere → «Crea preventivo e apri Outlook»); i nomi vecchi delle categorie si aggiungono a `CATEGORIE_CHIESTE` quando arrivano.

---

## Self-review

- **Copertura della specifica.** Sezione 1: date etichettate (T1), compatte (T2), arrivo più durata e giorno senza mese (T3), persone ed età (T4), trattamento/cure/cane/Zweibettzimmer/categoria/lingua (T5). Sezione 2: T6. Sezione 3: compila e cerca (T7), proposte con le tre regole e le stime (T8), la prenotazione aperta che comanda (T7, `!pren`). Casi limite: senza date (T7 restituisce false, niente ricerca automatica); categoria non libera (T8, quarta prova); trattamento non offerto (T8, quarta prova); richiesta vecchia (T7, 60 min); una categoria sola (T8, quinta prova). Prove: come da sezione «Prove». Rilascio: T9.
- **Segnaposto:** nessuno.
- **Nomi coerenti:** `nottiDedotte` (T3 → T6 → T7 «notti dedotte»), `categoriaChiesta` (T5 → T6 → T8), `RICHIESTA_LETTA` (T7 → T8), `togliOMetti`/`proponi`/`RIGHE` (T8), `dedotti` (T6 → T7).
