# Prenotare con un buono regalo — piano di lavoro

> **Per chi lavora con agenti:** SKILL RICHIESTA — usa
> `superpowers:subagent-driven-development` (consigliata) oppure
> `superpowers:executing-plans` per eseguire questo piano compito per compito.
> I passi usano caselle (`- [ ]`).

**Obiettivo:** chi riceve un buono regalo prenota dal sito, invece di
telefonare o scrivere un'email da zero.

**Impianto:** si riusa il modulo delle richieste che esiste già. Il codice del
buono viaggia nell'indirizzo, la pagina chiede a `?a=verifica` cosa contiene,
preseleziona la voce e mostra la differenza di prezzo. Il Day Spa diventa il
sesto tipo di richiesta. La disponibilità passa da un ponte nostro, perché
l'API del sito precedente non è chiamabile dal browser.

**Tecnologie:** Deno + TypeScript (funzioni Supabase), HTML con moduli ES
(pagine su Vercel), `jsr:@std/assert` per i test.

**Specifica:** `docs/superpowers/specs/2026-08-17-prenotare-col-buono-design.md`

## Vincoli globali

- **Il QR non si tocca**: contiene il codice puro, che il lettore del banco legge.
- **La riscossione resta al banco.** Nessun compito qui scala un buono.
- **`?a=verifica` si usa, non si allarga.** Restituisce già `valido`, `stato`,
  `descrizione`, `valore`, `voci`, `scade_il`, `riscosso_il` e nessun dato
  personale.
- **`amount` (i posti residui) non deve MAI uscire verso il browser.**
- **Oltre sette giorni non si dice mai «esaurito»**: la disponibilità non è
  ancora aperta.
- **Sempre al presente**: «in questo momento risulta disponibilità», mai «c'è posto».
- **Mai indicizzare un oggetto con una chiave che arriva da fuori**:
  `Object.hasOwn` o elenco chiuso.
- **Ogni valore che finisce nel markup passa da `esc()`.**
- Le pagine sono moduli ES dentro HTML: **un errore di sintassi le lascia
  bianche**. Ogni compito che tocca una pagina finisce con il controllo
  `node --check` sugli script estratti.
- Commit in italiano, una riga, stage esplicito. Mai `git add -A`.
- **Non pubblicare**: la pubblicazione la fa il coordinatore.

---

### Compito 1: `differenza.ts` — il conto fra buono e scelta

**File:**
- Creare: `supabase/functions/richieste/differenza-buono.ts`
- Test: `supabase/functions/richieste/differenza-buono.test.ts`

**Interfacce:**
- Consuma: niente.
- Produce: `differenzaBuono(copre: number | null | undefined, scelto: number | null | undefined): EsitoDifferenza`
  dove `EsitoDifferenza = { tipo: 'copre' | 'differenza' | 'residuo' | 'ignoto'; copre: number; scelto: number; differenza: number }`

- [ ] **Passo 1: scrivere il test che fallisce**

```ts
import { assertEquals } from 'jsr:@std/assert';
import { differenzaBuono } from './differenza-buono.ts';

Deno.test('scelta piu cara: la differenza si paga all arrivo', () => {
  const r = differenzaBuono(65, 80);
  assertEquals(r.tipo, 'differenza');
  assertEquals(r.differenza, 15);
});

Deno.test('scelta piu economica: si avvisa del residuo, non si promette un resto', () => {
  const r = differenzaBuono(70, 40);
  assertEquals(r.tipo, 'residuo');
  assertEquals(r.differenza, 30);
});

Deno.test('stesso importo: nessun avviso', () => {
  assertEquals(differenzaBuono(65, 65).tipo, 'copre');
});

/* il prezzo dello scelto puo' mancare (voce senza prezzo, o "da 30 €"):
   non si inventa un conto, si dice che non si sa */
Deno.test('prezzo dello scelto assente: ignoto, nessun numero inventato', () => {
  for (const v of [null, undefined, 0, NaN]) {
    assertEquals(differenzaBuono(65, v as number).tipo, 'ignoto', `scelto ${v}`);
  }
});

Deno.test('valore del buono assente: ignoto', () => {
  assertEquals(differenzaBuono(null, 80).tipo, 'ignoto');
});

/* i centesimi non devono produrre 14.999999999999998 */
Deno.test('gli importi con decimali non producono code di virgola', () => {
  assertEquals(differenzaBuono(65.5, 80.2).differenza, 14.7);
});
```

- [ ] **Passo 2: eseguirlo e vederlo fallire**

Esegui: `cd supabase/functions/richieste && deno test --allow-env --allow-read differenza-buono.test.ts`
Atteso: FALLISCE — il modulo non esiste.

- [ ] **Passo 3: scrivere il codice minimo**

```ts
/* Il conto fra quanto copre il buono e quanto costa la voce scelta.
   Puro e senza rete: e' la parte dove si sbaglia coi soldi, e un errore
   qui l'ospite lo scopre alla cassa.

   `residuo` non e' un dettaglio: le condizioni stampate sul buono dicono
   che l'importo residuo non e' rimborsabile ne' riutilizzabile. Dirlo al
   momento della scelta evita un reclamo al banco. */
export type EsitoDifferenza = {
  tipo: 'copre' | 'differenza' | 'residuo' | 'ignoto';
  copre: number;
  scelto: number;
  differenza: number;
};

const numero = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : null;
};

/* due decimali: senza questo 80.2 - 65.5 darebbe 14.699999999999999 */
const centesimi = (n: number) => Math.round(n * 100) / 100;

export function differenzaBuono(
  copre: number | null | undefined,
  scelto: number | null | undefined,
): EsitoDifferenza {
  const c = numero(copre);
  const s = numero(scelto);
  if (c === null || s === null) {
    return { tipo: 'ignoto', copre: c ?? 0, scelto: s ?? 0, differenza: 0 };
  }
  if (s > c) return { tipo: 'differenza', copre: c, scelto: s, differenza: centesimi(s - c) };
  if (s < c) return { tipo: 'residuo', copre: c, scelto: s, differenza: centesimi(c - s) };
  return { tipo: 'copre', copre: c, scelto: s, differenza: 0 };
}
```

- [ ] **Passo 4: eseguire e vedere passare**

Esegui: `deno test --allow-env --allow-read differenza-buono.test.ts`
Atteso: PASSA, 6 test.

- [ ] **Passo 5: verifica di mutazione**

Cambia a mano `if (s > c)` in `if (s >= c)`. Riesegui: **almeno un test deve
diventare rosso**. Se restano tutti verdi, i test non provano niente:
aggiungine uno prima di continuare. Poi rimetti il codice buono.

- [ ] **Passo 6: commit**

```bash
git add supabase/functions/richieste/differenza-buono.ts supabase/functions/richieste/differenza-buono.test.ts
git commit -m "Il conto fra quanto copre il buono e quanto costa la scelta"
```

---

### Compito 2: il sesto tipo di richiesta, `dayspa`

**File:**
- Modificare: `supabase/functions/richieste/tipi.ts` (riga 14 `TIPI_ATTIVI`; nuova `validaDayspa`; `validaDati` riga 288)
- Modificare: `supabase/functions/richieste/riepilogo.ts` (lo `switch` da riga 154)
- Test: `supabase/functions/richieste/tipi.test.ts` e `riepilogo.test.ts` (esistono già)

**Interfacce:**
- Consuma: `dataServizio`, `intero`, `testo` — già in `tipi.ts`, usate da `validaMaestro` (riga 154) che è il modello più vicino.
- Produce: `validaDati('dayspa', …)` restituisce `{ dati: { giorno, persone, note } }`;
  `riepilogoRichiesta` con `tipo: 'dayspa'` restituisce `{ etichetta: 'Day Spa', riepilogo: '2 persone · 21 agosto' }`.

- [ ] **Passo 1: scrivere i test che falliscono**

In `tipi.test.ts`:

```ts
Deno.test('dayspa: giorno e persone validi', () => {
  const r = validaDati('dayspa', { giorno: '2026-09-20', persone: 2, note: '' }, OGGI);
  assertEquals(r.errore, undefined);
  assertEquals(r.dati!.persone, 2);
  assertEquals(r.dati!.giorno, '2026-09-20');
});

Deno.test('dayspa: un giorno che non esiste viene rifiutato', () => {
  const r = validaDati('dayspa', { giorno: '2026-02-31', persone: 2 }, OGGI);
  assertNotEquals(r.errore, undefined);
});

Deno.test('dayspa: persone fuori scala rifiutate', () => {
  for (const p of [0, 9, 2.5, 'due']) {
    const r = validaDati('dayspa', { giorno: '2026-09-20', persone: p }, OGGI);
    assertNotEquals(r.errore, undefined, `persone ${p}`);
  }
});
```

In `riepilogo.test.ts`:

```ts
Deno.test('dayspa: la riga dice persone e giorno', () => {
  const r = riepilogoRichiesta({ tipo: 'dayspa', dati: { giorno: '2026-09-20', persone: 2 } } as never);
  assertEquals(r.etichetta, 'Day Spa');
  assertEquals(r.riepilogo, '2 persone · 20 settembre');
});

Deno.test('dayspa senza dati: lo dice invece di lasciare la riga vuota', () => {
  const r = riepilogoRichiesta({ tipo: 'dayspa', dati: null } as never);
  assertEquals(r.etichetta, 'Day Spa');
  assertEquals(r.riepilogo, 'nessun dettaglio indicato');
});
```

- [ ] **Passo 2: eseguirli e vederli fallire**

Esegui: `deno test --allow-env --allow-read`
Atteso: i cinque nuovi FALLISCONO (`tipo di richiesta sconosciuto`, etichetta `Richiesta`).

- [ ] **Passo 3: scrivere il codice**

In `tipi.ts`, dopo `validaMaestro`:

```ts
/* ---------------- Day Spa ---------------- */
/* Il Day Spa non era mai stato una richiesta: si prenotava pagando online,
   sul sito precedente. Lo diventa per i BUONI REGALO, che quel sistema non
   sa accettare — vedi la specifica del 17 agosto 2026.

   Il tetto di 8 persone e' preso da `pax` del transfer, NON dedotto da una
   capienza vera del Day Spa: e' una scelta dichiarata. Un gruppo piu'
   numeroso passa comunque dalla reception (regola dei gruppi), quindi non
   blocca niente di legittimo. */
const PERSONE_DAYSPA_MAX = 8;

function validaDayspa(d: Record<string, unknown>, oggi: Date): Esito {
  const giorno = dataServizio(d.giorno, oggi);
  if (giorno.errore) return { errore: giorno.errore };

  const persone = intero(d.persone, 1, PERSONE_DAYSPA_MAX);
  if (persone === null) return { errore: 'persone non valide' };

  const note = testo(d.note);
  if (note.length > 2000) return { errore: 'note troppo lunghe' };

  return { dati: { giorno: giorno.valore, persone, note } };
}
```

Riga 14: `export const TIPI_ATTIVI = ['soggiorno', 'transfer', 'greenfee', 'maestro', 'trattamenti', 'dayspa'] as const;`

In `validaDati`, prima di `default:`: `case 'dayspa': return validaDayspa(d || {}, oggi);`

In `riepilogo.ts`, nello `switch` — **attenzione alla forma: quello switch
ASSEGNA a `etichetta` e `riepilogo` e fa `break`, non `return`.** Segui il
ramo `trattamenti` (riga 154) come modello:

```ts
case 'dayspa': {
  const p = numeroValido(d.persone);
  etichetta = 'Day Spa';
  riepilogo = [
    p !== null ? conPlurale(p, 'persona', 'persone') : '',
    dataLunga(d.giorno),
  ].filter(Boolean).join(' · ');
  break;
}
```

**Usa le funzioni che ci sono già, non riscriverle.** I nomi veri, verificati
in `riepilogo.ts` il 17 agosto 2026:

| Serve | Si chiama | Dove |
|---|---|---|
| la data per esteso («20 settembre») | `dataLunga(v)` | riga 53 |
| singolare/plurale | `conPlurale(n, sing, plur)` | riga 82 |
| un numero valido o `null` | `numeroValido(v)` | riga 76 |
| «nessun dettaglio indicato» | `NESSUN_DETTAGLIO` | riga 142 |

*(Il ripiego su `NESSUN_DETTAGLIO` quando la riga esce vuota è già gestito in
fondo alla funzione per tutti i tipi: non rifarlo dentro il `case`.)*

- [ ] **Passo 4: eseguire e vedere passare**

Esegui: `deno test --allow-env --allow-read`
Atteso: **198 + 5 = 203 verdi, zero rossi.**

- [ ] **Passo 5: commit**

```bash
git add supabase/functions/richieste/tipi.ts supabase/functions/richieste/tipi.test.ts supabase/functions/richieste/riepilogo.ts supabase/functions/richieste/riepilogo.test.ts
git commit -m "Il Day Spa diventa il sesto tipo di richiesta"
```

---

### Compito 3: `?a=dayspa` — il ponte sulla disponibilità

**File:**
- Creare: `supabase/functions/richieste/disponibilita.ts`
- Creare: `supabase/functions/richieste/disponibilita.test.ts`
- Modificare: `supabase/functions/richieste/index.ts` (nuova azione, **fuori** dal cancello della chiave hotel: la chiama il browser di un ospite)

**Interfacce:**
- Consuma: niente dai compiti precedenti.
- Produce: `esitoDisponibilita(risposta: unknown, giorni: number, chiuso: boolean): Esito`
  dove `Esito = { stato: 'chiuso' | 'non-aperte' | 'disponibile' | 'esaurito' | 'ignoto' }`

**Perché un ponte e non una chiamata diretta.** L'API
`https://www.termeleonardo.com/it/api/1/availability` **non manda intestazioni
CORS** (verificato il 17 agosto 2026: zero `access-control-allow-origin`): il
browser bloccherebbe la chiamata. E la sua risposta contiene `amount` — i
posti residui — che non deve mai arrivare al cliente.

- [ ] **Passo 1: scrivere il test che fallisce**

```ts
import { assertEquals } from 'jsr:@std/assert';
import { esitoDisponibilita } from './disponibilita.ts';

const RISPOSTA_VERA = [{
  id: 2100, date: '2026-08-18', amount: 42, title: 'Giornaliero h.9-18:30',
  sale_price: 3500, available: true,
}];

Deno.test('entro sette giorni con posti: disponibile', () => {
  assertEquals(esitoDisponibilita(RISPOSTA_VERA, 3, false).stato, 'disponibile');
});

Deno.test('entro sette giorni, elenco vuoto: esaurito', () => {
  assertEquals(esitoDisponibilita([], 3, false).stato, 'esaurito');
});

/* la regola che vale piu' di tutte: oltre la settimana la disponibilita'
   non e' ancora stata aperta. Dire «esaurito» manderebbe via un ospite che
   potrebbe venire benissimo. */
Deno.test('oltre sette giorni: non-aperte, mai esaurito', () => {
  assertEquals(esitoDisponibilita([], 8, false).stato, 'non-aperte');
  assertEquals(esitoDisponibilita(RISPOSTA_VERA, 30, false).stato, 'non-aperte');
});

Deno.test('il settimo giorno e ancora dentro, l ottavo no', () => {
  assertEquals(esitoDisponibilita([], 7, false).stato, 'esaurito');
  assertEquals(esitoDisponibilita([], 8, false).stato, 'non-aperte');
});

Deno.test('hotel chiuso: vince su tutto', () => {
  assertEquals(esitoDisponibilita(RISPOSTA_VERA, 3, true).stato, 'chiuso');
});

Deno.test('risposta illeggibile: ignoto, non esaurito', () => {
  for (const v of [null, undefined, 'errore', { errore: 1 }]) {
    assertEquals(esitoDisponibilita(v, 3, false).stato, 'ignoto', String(v));
  }
});

/* IL TEST PIU' IMPORTANTE DI QUESTO FILE.
   `amount` sono i posti residui. Il prompt dell'agente vocale ha una regola
   esplicita: non dirlo mai, in nessuna forma. Se qualcuno «semplificasse»
   rigirando la risposta intera, quel numero finirebbe negli strumenti del
   browser di chiunque — e nessuno se ne accorgerebbe finche' un cliente non
   commenta «ma allora c'erano ancora quaranta posti». */
Deno.test('l esito non contiene MAI i posti residui', () => {
  const e = esitoDisponibilita(RISPOSTA_VERA, 3, false);
  const serializzato = JSON.stringify(e);
  assertEquals(serializzato.includes('42'), false, 'i posti residui sono usciti');
  assertEquals(serializzato.includes('amount'), false, 'il campo amount e uscito');
  assertEquals(Object.keys(e), ['stato'], 'l esito deve avere SOLO stato');
});
```

- [ ] **Passo 2: eseguirlo e vederlo fallire**

Esegui: `deno test --allow-env --allow-read disponibilita.test.ts`
Atteso: FALLISCE — il modulo non esiste.

- [ ] **Passo 3: scrivere il codice**

```ts
/* Il ponte sulla disponibilita' del Day Spa.
   Traduce la risposta dell'API del sito precedente in UNA parola, e non
   lascia uscire nient'altro. Vedi la specifica del 17 agosto 2026 per il
   perche' del ponte (niente CORS, e `amount` da non mostrare). */

export type Esito = { stato: 'chiuso' | 'non-aperte' | 'disponibile' | 'esaurito' | 'ignoto' };

/* Sette giorni: e' l'orizzonte con cui l'hotel apre le vendite, per tenere
   conto anche del meteo. Oltre, la disponibilita' non esiste ancora — non
   e' esaurita. Confonderli manda via chi potrebbe venire. */
const ORIZZONTE_GIORNI = 7;

export function esitoDisponibilita(risposta: unknown, giorni: number, chiuso: boolean): Esito {
  if (chiuso) return { stato: 'chiuso' };
  if (!Number.isFinite(giorni) || giorni > ORIZZONTE_GIORNI) return { stato: 'non-aperte' };
  if (!Array.isArray(risposta)) return { stato: 'ignoto' };
  return { stato: risposta.length > 0 ? 'disponibile' : 'esaurito' };
}
```

In `index.ts`, l'azione — **fuori dal cancello della chiave hotel**, come
`?a=promemoria`, perché la chiama il browser di un ospite:

```ts
/* ---------- pubblico: disponibilita' Day Spa ----------
   L'API del sito precedente non manda CORS: il browser non puo' chiamarla.
   Passa da qui, e da qui esce solo uno stato — mai i posti residui. */
if (azione === 'dayspa') {
  const giorno = (url.searchParams.get('giorno') || '').trim();
  const persone = (url.searchParams.get('persone') || '1').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(giorno)) {
    return risposta({ errore: 'giorno non valido' }, 400);
  }
  const stagioni = await leggiStagioni(db);
  const chiuso = aHotelChiuso(giorno, stagioni);
  const giorni = Math.round(
    (new Date(giorno + 'T12:00:00Z').getTime() - Date.now()) / 86400000,
  );
  let dati: unknown = null;
  if (!chiuso && giorni <= 7) {
    try {
      const r = await fetch('https://www.termeleonardo.com/it/api/1/availability' +
        `?from_date=${giorno}&to_date=${giorno}&people=${encodeURIComponent(persone)}`);
      dati = r.ok ? await r.json() : null;
    } catch (e) {
      console.error('disponibilita day spa', e);
    }
  }
  return risposta(esitoDisponibilita(dati, giorni, chiuso));
}
```

*(`leggiStagioni` esiste già in `buoni/index.ts`: se in `richieste/index.ts`
non c'è, portala qui con la stessa forma — legge `stagione_chiusura` ordinata
per `chiusura`. `aHotelChiuso` è una funzione nuova di due righe: vero se il
giorno cade fra `chiusura` e `riapertura` esclusa, per una qualsiasi stagione.)*

- [ ] **Passo 4: eseguire e vedere passare**

Esegui: `deno test --allow-env --allow-read` + `deno check index.ts`
Atteso: **verdi, zero rossi.**

- [ ] **Passo 5: verifica di mutazione sul test che conta**

Cambia il `return` finale in `return { stato: …, posti: risposta.length } as Esito`.
Riesegui: **il test dei posti residui deve diventare rosso.** Poi rimetti il
codice buono.

- [ ] **Passo 6: commit**

```bash
git add supabase/functions/richieste/disponibilita.ts supabase/functions/richieste/disponibilita.test.ts supabase/functions/richieste/index.ts
git commit -m "La disponibilita del Day Spa passa da noi: esce uno stato, mai i posti residui"
```

---

### Compito 4: il riquadro del buono nella pagina

**File:**
- Creare: `pagine/comune/buono-url.js`
- Creare: `pagine/comune/buono-url.test.ts`
- Modificare: `pagine/richieste/index.html`

**Interfacce:**
- Consuma: `differenzaBuono` — **non importabile** da una pagina (è in
  `supabase/functions/`). Il conto va **riscritto** in `buono-url.js`, e un
  test in `buono-url.test.ts` deve confrontare le due implementazioni sugli
  stessi casi, come fa già `pagine/buoni/listino-copie.test.ts` col listino.
- Produce: `codiceDaUrl(ricerca: string): string` — il codice ripulito, o `''`.

- [ ] **Passo 1: scrivere il test che fallisce**

```ts
import { assertEquals } from 'jsr:@std/assert';
import { codiceDaUrl } from './buono-url.js';
import { differenzaBuono as dalServer } from '../../supabase/functions/richieste/differenza-buono.ts';
import { differenzaBuono as dallaPagina } from './buono-url.js';

Deno.test('il codice si legge dall indirizzo, ripulito', () => {
  assertEquals(codiceDaUrl('?buono=leo-abc-123'), 'LEO-ABC-123');
  assertEquals(codiceDaUrl('?buono=  LEO-ABC-123  '), 'LEO-ABC-123');
});

Deno.test('quello che non e un codice viene scartato', () => {
  for (const q of ['', '?buono=', '?buono=<script>', '?buono=' + 'A'.repeat(200), '?altro=x']) {
    assertEquals(codiceDaUrl(q), '', q);
  }
});

/* Le due implementazioni del conto devono dire la stessa cosa: una sbaglia
   e l'ospite legge una cifra sulla pagina e ne sente un'altra alla cassa. */
Deno.test('il conto della pagina combacia con quello del server', () => {
  for (const [c, s] of [[65, 80], [70, 40], [65, 65], [0, 80], [65, 0], [65.5, 80.2]]) {
    assertEquals(dallaPagina(c, s), dalServer(c, s), `copre ${c}, scelto ${s}`);
  }
});
```

- [ ] **Passo 2: eseguirlo e vederlo fallire**

Esegui: `cd pagine/comune && deno test --allow-env --allow-read buono-url.test.ts`
Atteso: FALLISCE — il modulo non esiste.

- [ ] **Passo 3: scrivere `buono-url.js`**

```js
/* Il codice del buono letto dall'indirizzo, e il conto della differenza.
   ------------------------------------------------------------------
   Il conto e' RISCRITTO qui e non importato: questa pagina gira nel
   browser, quella funzione vive in Deno. Sono due copie della stessa
   regola, ed e' esattamente il difetto che questo progetto ha gia' pagato
   quattro volte coi listini — per questo buono-url.test.ts le confronta
   su ogni caso: se divergono, diventa rosso. */

const CODICE_MAX = 40;

export function codiceDaUrl(ricerca) {
  const v = new URLSearchParams(ricerca || '').get('buono') || '';
  const pulito = v.trim().toUpperCase();
  /* solo lettere, cifre e trattini: il codice non contiene altro, e cosi'
     un tentativo di iniezione non arriva nemmeno al server */
  if (!pulito || pulito.length > CODICE_MAX || !/^[A-Z0-9-]+$/.test(pulito)) return '';
  return pulito;
}

const numero = (v) => {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : null;
};
const centesimi = (n) => Math.round(n * 100) / 100;

export function differenzaBuono(copre, scelto) {
  const c = numero(copre);
  const s = numero(scelto);
  if (c === null || s === null) return { tipo: 'ignoto', copre: c ?? 0, scelto: s ?? 0, differenza: 0 };
  if (s > c) return { tipo: 'differenza', copre: c, scelto: s, differenza: centesimi(s - c) };
  if (s < c) return { tipo: 'residuo', copre: c, scelto: s, differenza: centesimi(c - s) };
  return { tipo: 'copre', copre: c, scelto: s, differenza: 0 };
}
```

- [ ] **Passo 4: eseguire e vedere passare**

Esegui: `deno test --allow-env --allow-read`
Atteso: **58 + 3 = 61 verdi.**

- [ ] **Passo 5: il riquadro nella pagina**

In `pagine/richieste/index.html`, importa con **percorso assoluto**
(`import { codiceDaUrl, differenzaBuono } from '/comune/buono-url.js';` — un
percorso relativo si risolve contro l'indirizzo riscritto e lascia la pagina
bianca) e aggiungi, prima di disegnare il modulo:

1. leggi il codice; se c'è, chiama
   `https://mvuiuwakuseockotlcnp.supabase.co/functions/v1/buoni?a=verifica&codice=…`;
2. disegna il riquadro con **numero, contenuto, scadenza** — il numero si
   MOSTRA, non si chiede (è sequenziale: chiederlo aggiungerebbe un campo
   senza chiudere nessuna porta — vedi la specifica);
3. preseleziona la voce corrispondente, **lasciandola modificabile**;
4. mostra la differenza mentre l'ospite cambia scelta;
5. metti il codice nelle note, con l'etichetta italiana più la traduzione,
   nella stessa forma già usata per `rifOfferta`.

I quattro casi di errore, ognuno con la sua via d'uscita (testi nella
specifica): non trovato · scaduto · già riscosso · non ancora pagato. E se
`?a=verifica` **non risponde**: nessun riquadro, modulo normale, codice nelle
note — meglio una richiesta senza riquadro che nessuna richiesta.

- [ ] **Passo 6: verificare che la pagina non sia bianca**

Estrai ogni `<script>` in un `.mjs` temporaneo nello scratchpad e passalo a
`node --check`. Atteso: nessun errore.

- [ ] **Passo 7: provarlo in un browser vero**

Con un codice vero, carica la pagina in Edge headless
(`--headless --dump-dom`) e verifica che il riquadro compaia e la voce sia
preselezionata. **È l'unico controllo che conta:** leggere il codice non ha
trovato, nei giorni scorsi, né la barra rovesciata mancante né i trattamenti
che sparivano cambiando gruppo.

- [ ] **Passo 8: commit**

```bash
git add pagine/comune/buono-url.js pagine/comune/buono-url.test.ts pagine/richieste/index.html
git commit -m "Il modulo riconosce il buono, preseleziona la voce e dice la differenza"
```

---

### Compito 5: il blocco Day Spa nella pagina, con la disponibilità

**File:**
- Modificare: `pagine/richieste/index.html`
- Modificare: `C:/Users/admin/termeleonardo/frontend/vercel.json` (riscritture `/it/day-spa`, `/de/day-spa`, `/en/day-spa`, `/fr/day-spa`)

**Interfacce:**
- Consuma: `?a=dayspa` del compito 3, `codiceDaUrl` del compito 4.
- Produce: niente per i compiti successivi.

- [ ] **Passo 1: aggiungere `'dayspa'` a `TIPI` e il blocco di campi**

`const TIPI = ['greenfee','maestro','trattamenti','dayspa'];`

Il blocco: giorno (coi limiti del soggiorno, se noti), quante persone, note.
Testi in quattro lingue nell'oggetto `T`, accanto agli altri tipi.

- [ ] **Passo 2: la disponibilità sotto il campo data**

Al cambio del giorno, chiama `?a=dayspa&giorno=…&persone=…` e mostra una riga:

```
disponibile   «In questo momento risulta disponibilità.»
esaurito      «Quella data risulta esaurita. Ne provi un'altra.»
non-aperte    «Per quella data le prenotazioni non sono ancora aperte:
               apriamo circa una settimana prima, anche per via del meteo.»
chiuso        «In quella data l'hotel è chiuso per la pausa stagionale.»
ignoto        «Al momento non riesco a verificare la disponibilità.»
```

**Sempre al presente**, e **nessuno di questi blocca l'invio**: la richiesta
si manda comunque, e la reception verifica.

- [ ] **Passo 3: le riscritture**

In `vercel.json`, accanto a quelle di `/it/trattamenti`, aggiungi le quattro
lingue verso `…/richieste/?tipo=dayspa&l=xx`. Usa gli stessi nomi tradotti
degli altri percorsi.

- [ ] **Passo 4: sintassi e browser**

`node --check` sugli script estratti, poi la pagina caricata in Edge headless
su `/it/day-spa` con una data entro sette giorni e una oltre: le due righe
devono essere diverse.

- [ ] **Passo 5: commit**

```bash
git add pagine/richieste/index.html
git commit -m "Il modulo Day Spa, con la disponibilita mostrata al presente"
```

*(il `vercel.json` sta nell'altro repository: commit separato lì)*

---

### Compito 6: i due punti d'ingresso

**File:**
- Modificare: `supabase/functions/buoni/email-buono.ts` (blocco `PRENOTA`, riga ~115)
- Modificare: `pagine/buoni/buono.js` (il foglio A4)

**Interfacce:**
- Consuma: gli indirizzi dei compiti 4 e 5.
- Produce: niente.

- [ ] **Passo 1: il pulsante nell'email, in quattro lingue**

Il blocco `PRENOTA` oggi dice «Per prenotare ci chiami o ci scriva». Aggiungi
sotto un pulsante (tabella, non CSS: Outlook non regge i bottoni) verso il
modulo giusto **secondo cosa contiene il buono**:

> se c'è almeno un trattamento → `/xx/trattamenti?buono=CODICE`
> altrimenti → `/xx/day-spa?buono=CODICE`

*(la regola è nella specifica, sezione 4-bis: un ingresso Day Spa più un
massaggio sono **una visita sola**, quindi una richiesta sola.)*

Il testo «ci chiami o ci scriva» **resta**: chi preferisce il telefono deve
continuare a trovarlo.

- [ ] **Passo 2: l'indirizzo sul foglio A4**

Una riga accanto al codice: `hoteltermeleonardo.com/prenota-il-buono`.

- [ ] **Passo 3: RIMISURARE IL FOGLIO — non saltare questo passo**

Esegui: `node pagine/buoni/misura-foglio.mjs`

Il foglio sta in una pagina **per trentatré pixel** nel caso peggiore. Se la
riga nuova lo fa traboccare, le condizioni tornano a tagliarsi come prima del
15 agosto — e non si vede finché qualcuno non stampa. Se sfora: accorcia la
riga o riduci l'interlinea delle condizioni, e rimisura.

- [ ] **Passo 4: commit**

```bash
git add supabase/functions/buoni/email-buono.ts pagine/buoni/buono.js
git commit -m "Dal buono si prenota: pulsante nell email e indirizzo sul foglio"
```

---

## Ordine e dipendenze

```
1 differenza          indipendente
2 tipo dayspa         indipendente
3 ponte disponibilita indipendente
4 riquadro nella pagina    ← ha bisogno di 1 (confronto delle due copie)
5 blocco Day Spa           ← ha bisogno di 2, 3, 4
6 punti d ingresso         ← ha bisogno di 4 e 5 (gli indirizzi devono esistere)
```

I primi tre si possono fare in qualunque ordine. Il 6 va per ultimo: se il
pulsante arriva prima delle pagine, chi clicca trova un errore.

## Come sapere che è finito

- `deno test` verde in `supabase/functions/richieste`, `pagine/comune`,
  `pagine/buoni`, `supabase/functions/buoni`
- `node --check` pulito su ogni script delle pagine toccate
- un buono vero aperto in un browser vero mostra il riquadro e preseleziona
- `misura-foglio.mjs` conferma che l'A4 sta ancora in una pagina
- `?a=dayspa` non restituisce mai `amount`, verificato dal test **e** da una
  chiamata vera
