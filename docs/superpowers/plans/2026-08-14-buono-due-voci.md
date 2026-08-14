# Buono regalo con due voci e quantità — piano

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un buono regalo può portare fino a due voci diverse, ognuna in quantità fino a quattro, al prezzo somma del listino.

**Architecture:** Il grosso è server: `validaAcquisto` in `acquista.ts` è già l'unica fonte dei prezzi e resta tale, con le quantità dentro. La descrizione composta continua a viaggiare nella colonna `descrizione` come righe separate da ritorno a capo — che email e stampa già spezzano — quindi la resa non va riscritta. La colonna `voci` jsonb serve solo a ricordare la scelta in forma leggibile da una macchina.

**Tech Stack:** Deno / TypeScript (Supabase Edge Functions), HTML statico multilingua, `deno test`.

## Global Constraints

- **Il prezzo è la somma secca del listino**, nessuno sconto per quantità: `prezzo unitario × quantità`, sommato sulle voci.
- **Massimo due voci diverse, quantità da 1 a 4 ciascuna.** I limiti stanno sul server, non nella pagina.
- **Quando la quantità è uno, il numero non si scrive.** "1 × Massaggio" è il modo in cui un modulo dice a un essere umano che l'ha compilato una macchina.
- **La tabella `buono_regalo` è vuota** (zero righe, verificato il 14 agosto 2026): la struttura si cambia, non si aggirano vincoli per compatibilità con dati che non esistono.
- **La frase in fondo al buono è la stessa in due file** — `supabase/functions/buoni/email-buono.ts` e `pagine/buoni/buono.js` — e un test già esistente verifica che siano identiche. Cambiarne una sola fa fallire quel test: è voluto.
- **La fotografia del buono segue la PRIMA voce.** `fotoBuono()` ne sceglie una sola; con due voci si prende quella della prima, che è la prima che l'ospite ha scelto e la prima che legge.
- Commenti e nomi in italiano.
- Il buono monetario non cambia in nulla.

---

### Task 1: Le voci con quantità, sul server

**Files:**
- Modify: `supabase/functions/buoni/acquista.ts`
- Test: `supabase/functions/buoni/acquista.test.ts`

**Interfaces:**
- Produces: `export type Voce = { voce_id: string; quantita: number }`; `validaAcquisto` accetta ora `b.voci` (array) oltre a `b.voce_id` (una voce sola, forma di prima) e restituisce in più `voci: Voce[]`.

- [ ] **Step 1: Scrivere i test che falliscono**

```ts
import { assertEquals } from 'jsr:@std/assert';
import { LISTINO, validaAcquisto } from './acquista.ts';

const base = {
  tipo: 'servizio', lingua: 'it', destinatario: 'Anna',
  acquirente: 'Mario', acquirente_email: 'mario@email.it',
  condizioni_accettate: true, privacy_presa_atto: true,
};

Deno.test('due voci con quantita fanno la somma secca del listino', () => {
  const { errore, dati } = validaAcquisto({ ...base, voci: [
    { voce_id: 'dayspa_wknd', quantita: 4 },
    { voce_id: 'antistress45', quantita: 4 },
  ]});
  assertEquals(errore, undefined);
  const atteso = LISTINO['dayspa_wknd'][1] * 4 + LISTINO['antistress45'][1] * 4;
  assertEquals(dati!.valore, atteso);
  assertEquals(dati!.voci.length, 2);
});

/* il prezzo arriva dal cliente e non fa testo: vale il listino del server */
Deno.test('un prezzo mandato dal cliente viene ignorato', () => {
  const { dati } = validaAcquisto({ ...base, valore: 1,
    voci: [{ voce_id: 'dayspa_wknd', quantita: 1 }] });
  assertEquals(dati!.valore, LISTINO['dayspa_wknd'][1]);
});

Deno.test('una voce sola senza quantita continua a funzionare come prima', () => {
  const { errore, dati } = validaAcquisto({ ...base, voce_id: 'dayspa_wknd' });
  assertEquals(errore, undefined);
  assertEquals(dati!.valore, LISTINO['dayspa_wknd'][1]);
  assertEquals(dati!.voci.length, 1);
  assertEquals(dati!.voci[0].quantita, 1);
});

Deno.test('tre voci vengono rifiutate', () => {
  assertEquals(validaAcquisto({ ...base, voci: [
    { voce_id: 'dayspa_wknd', quantita: 1 },
    { voce_id: 'antistress45', quantita: 1 },
    { voce_id: 'relax25', quantita: 1 },
  ]}).errore, 'al massimo due voci');
});

/* chi sceglie due volte la stessa voce sta dicendo una quantita', non due
   voci: si sommano, altrimenti il tetto di quattro si aggira scegliendo la
   stessa voce due volte */
Deno.test('la stessa voce due volte si somma in una riga', () => {
  const { errore, dati } = validaAcquisto({ ...base, voci: [
    { voce_id: 'relax25', quantita: 2 },
    { voce_id: 'relax25', quantita: 2 },
  ]});
  assertEquals(errore, undefined);
  assertEquals(dati!.voci.length, 1);
  assertEquals(dati!.voci[0].quantita, 4);
  assertEquals(dati!.valore, LISTINO['relax25'][1] * 4);
});

Deno.test('la stessa voce due volte non aggira il tetto di quattro', () => {
  assertEquals(validaAcquisto({ ...base, voci: [
    { voce_id: 'relax25', quantita: 3 },
    { voce_id: 'relax25', quantita: 3 },
  ]}).errore, 'quantita fuori dai limiti (1-4)');
});

Deno.test('quantita fuori dai limiti o non intere vengono rifiutate', () => {
  for (const q of [0, -1, 5, 2.5, NaN]) {
    assertEquals(validaAcquisto({ ...base,
      voci: [{ voce_id: 'relax25', quantita: q }] }).errore,
      'quantita fuori dai limiti (1-4)', `quantita ${q}`);
  }
});

Deno.test('una quantita scritta come testo viene letta, non rifiutata a caso', () => {
  const { errore, dati } = validaAcquisto({ ...base,
    voci: [{ voce_id: 'relax25', quantita: '3' }] });
  assertEquals(errore, undefined);
  assertEquals(dati!.voci[0].quantita, 3);
});

Deno.test('una voce inesistente viene rifiutata', () => {
  assertEquals(validaAcquisto({ ...base,
    voci: [{ voce_id: 'inventata', quantita: 1 }] }).errore, 'voce di listino sconosciuta');
});

Deno.test('un elenco vuoto viene rifiutato', () => {
  assertEquals(validaAcquisto({ ...base, voci: [] }).errore, 'voce di listino sconosciuta');
});

/* il buono monetario non deve cambiare in niente */
Deno.test('il buono monetario resta com era', () => {
  const { errore, dati } = validaAcquisto({ ...base, tipo: 'valore', valore: 100 });
  assertEquals(errore, undefined);
  assertEquals(dati!.valore, 100);
  assertEquals(dati!.voci.length, 0);
});
```

- [ ] **Step 2: Eseguire i test e vederli fallire**

Run: `cd supabase/functions/buoni && deno test acquista.test.ts --allow-read --allow-env`
Expected: FAIL — `dati.voci` è `undefined`

- [ ] **Step 3: Scrivere il codice**

In `acquista.ts`, accanto agli altri tipi:

```ts
export type Voce = { voce_id: string; quantita: number };

/* Due voci al massimo: sotto le voci, sul foglio del buono, c'e' la
   descrizione di cosa comprendono, e con tre quel testo non ci sta piu'.
   Quattro come quantita' copre la famiglia o il gruppo di amici senza
   trasformare un regalo in un ordine all'ingrosso. */
const VOCI_MAX = 2;
const QUANTITA_MAX = 4;

/* Le voci arrivano dal cliente: si normalizzano prima di toccare il listino.
   Chi sceglie due volte la stessa voce sta dicendo una quantita', non due
   voci — e se non si sommassero, il tetto di quattro si aggirerebbe
   scegliendo la stessa voce due volte. */
function normalizzaVoci(grezze: unknown, voceSingola: unknown):
  { errore?: string; voci?: Voce[] } {
  let elenco: Array<Record<string, unknown>> = [];
  if (Array.isArray(grezze) && grezze.length) {
    elenco = grezze as Array<Record<string, unknown>>;
  } else if (voceSingola) {
    elenco = [{ voce_id: voceSingola, quantita: 1 }];
  }
  if (!elenco.length) return { errore: 'voce di listino sconosciuta' };

  const somma = new Map<string, number>();
  for (const v of elenco) {
    const id = String(v?.voce_id ?? '');
    if (!LISTINO[id]) return { errore: 'voce di listino sconosciuta' };
    const q = Number(v?.quantita ?? 1);
    if (!Number.isInteger(q) || q < 1 || q > QUANTITA_MAX) {
      return { errore: `quantita fuori dai limiti (1-${QUANTITA_MAX})` };
    }
    somma.set(id, (somma.get(id) ?? 0) + q);
  }
  if (somma.size > VOCI_MAX) return { errore: `al massimo ${VOCI_MAX === 2 ? 'due' : VOCI_MAX} voci` };
  for (const [, q] of somma) {
    if (q > QUANTITA_MAX) return { errore: `quantita fuori dai limiti (1-${QUANTITA_MAX})` };
  }
  return { voci: [...somma].map(([voce_id, quantita]) => ({ voce_id, quantita })) };
}

/* "4 x Day Spa festivo", e senza numero quando e' uno: "1 x Massaggio" e' il
   modo in cui un modulo dice a un essere umano che l'ha compilato una
   macchina. Una riga per voce: email e stampa spezzano gia' la descrizione
   sui ritorni a capo. */
export function componiDescrizione(voci: Voce[]): string {
  return voci.map((v) => {
    const nome = LISTINO[v.voce_id][0];
    return v.quantita > 1 ? `${v.quantita} × ${nome}` : nome;
  }).join('\n');
}

export function sommaVoci(voci: Voce[]): number {
  return voci.reduce((t, v) => t + LISTINO[v.voce_id][1] * v.quantita, 0);
}
```

E nel ramo `servizio` di `validaAcquisto`, al posto della lettura della voce singola:

```ts
    const n = normalizzaVoci(b.voci, b.voce_id);
    if (n.errore || !n.voci) return { errore: n.errore };
    voci = n.voci;
    /* voce_id resta valorizzato con la prima voce: la fotografia del buono
       la sceglie fotoBuono() da li', e con due voci si prende quella della
       prima — che e' la prima che l'ospite ha scelto e la prima che legge */
    voce_id = voci[0].voce_id;
    descrizione = componiDescrizione(voci);
    valore = sommaVoci(voci);
```

Dichiarare `let voci: Voce[] = [];` accanto alle altre e aggiungerlo a `DatiAcquisto` e all'oggetto restituito.

- [ ] **Step 4: Eseguire i test e vederli passare**

Run: `cd supabase/functions/buoni && deno test --allow-read --allow-env`
Expected: PASS, compresi i test già esistenti

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/buoni/acquista.ts supabase/functions/buoni/acquista.test.ts
git commit -m "Due voci con quantita sul server, prezzo somma del listino"
```

---

### Task 2: La colonna `voci` e il salvataggio

**Files:**
- Modify: `supabase/functions/buoni/index.ts` (dove si inserisce il buono)
- Create: `supabase/2026-08-14-voci-buono.sql` (accanto a `supabase/tabella-buoni.sql`: non esiste una cartella migrazioni, le si tiene li')

**Interfaces:**
- Consumes: `Voce`, `validaAcquisto(...).voci` dal Task 1

- [ ] **Step 1: Scrivere la migrazione**

```sql
-- La scelta dell'ospite in forma leggibile da una macchina: descrizione e
-- valore continuano a portare il testo composto e il totale, che sono cio'
-- che leggono email, stampa e back office. Questa colonna serve a sapere
-- COSA e' stato scelto senza dover interpretare del testo.
alter table buono_regalo
  add column if not exists voci jsonb;

comment on column buono_regalo.voci is
  'Elenco [{voce_id, quantita}]. Vuoto per i buoni monetari.';
```

- [ ] **Step 2: Applicare la migrazione e verificarla**

Applicare con l'API di gestione Supabase, poi:
```sql
select column_name, data_type from information_schema.columns
where table_name = 'buono_regalo' and column_name = 'voci';
```
Expected: una riga, `jsonb`

- [ ] **Step 3: Salvare le voci all'inserimento**

In `index.ts`, dove si compone la riga da inserire, aggiungere accanto agli altri campi:

```ts
      /* vuoto per i monetari: la colonna resta nulla, non un array vuoto */
      voci: dati.voci.length ? dati.voci : null,
```

- [ ] **Step 4: Provare dal vivo**

Comprare un buono di prova a due voci dal back office e verificare:
```sql
select numero, descrizione, valore, voci from buono_regalo order by creato_il desc limit 1;
```
Expected: `descrizione` su due righe, `valore` uguale alla somma, `voci` con due elementi

- [ ] **Step 5: Commit**

```bash
git add supabase/2026-08-14-voci-buono.sql supabase/functions/buoni/index.ts
git commit -m "La scelta dell ospite si ricorda anche in forma leggibile da una macchina"
```

---

### Task 3: La frase in fondo al buono

**Files:**
- Modify: `supabase/functions/buoni/email-buono.ts` (costante `CONDIZIONI` o la frase equivalente)
- Modify: `pagine/buoni/buono.js` (la stessa frase)
- Test: `pagine/buoni/buono.test.ts` (il test che confronta i due file esiste già)

- [ ] **Step 1: Trovare la frase e il test che la presidia**

La frase attuale, identica nei due file:

> Salvo diversa indicazione, ogni ingresso o trattamento vale per una persona. Ingressi e trattamenti su prenotazione: basta chiamarci o scriverci.

Esiste già un test che verifica che i due file dicano la stessa cosa: cambiarne uno solo lo fa fallire. È voluto — serve a questo.

- [ ] **Step 2: Sostituire in entrambi i file, nelle quattro lingue**

```
it: Ogni ingresso o trattamento vale per una persona: potete venire insieme
    o in momenti diversi, come preferite. Su prenotazione: basta chiamarci o
    scriverci.

de: Jeder Eintritt und jede Anwendung gilt für eine Person: Sie können
    gemeinsam kommen oder zu verschiedenen Zeiten, ganz wie Sie möchten. Auf
    Reservierung: rufen Sie uns an oder schreiben Sie uns.

en: Each admission or treatment is for one person: you can come together or
    at different times, as you prefer. By reservation: just call or write to
    us.

fr: Chaque entrée ou soin vaut pour une personne : vous pouvez venir
    ensemble ou à des moments différents, comme vous préférez. Sur
    réservation : appelez-nous ou écrivez-nous.
```

Il "salvo diversa indicazione" sparisce: era una cautela che non indicava niente. La frase ora risponde alla domanda che si fa chi riceve "4 × Day Spa" — quattro persone o quattro volte? — e la risposta, *come preferite*, è la cosa che rende bello il regalo.

- [ ] **Step 3: Eseguire i test**

Run: `cd pagine/buoni && deno test --allow-read` e `cd supabase/functions/buoni && deno test --allow-read --allow-env`
Expected: PASS entrambi, compreso il confronto fra i due file

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/buoni/email-buono.ts pagine/buoni/buono.js
git commit -m "La frase in fondo risponde alla domanda che si fa chi riceve quattro ingressi"
```

---

### Task 4: Scegliere due voci sulla pagina

**Files:**
- Modify: `pagine/buoni/regala/index.html`

**Interfaces:**
- Consumes: `POST .../buoni?a=acquista` con `voci: [{voce_id, quantita}]` invece di `voce_id`

- [ ] **Step 1: Il modulo**

Al posto della tendina singola: una prima voce con la sua quantità (1–4), e un collegamento **«aggiungi una seconda voce»** che ne apre una seconda, con un modo per toglierla. Mai una terza.

L'anteprima si aggiorna a ogni cambio, come già fa: mostra le righe composte come le comporrà il server — `4 × Day Spa festivo` su una riga, la seconda voce sotto — e il totale.

**Il totale a schermo è un'anticipazione, non un prezzo.** Il prezzo lo fa il server dal listino: se un giorno divergessero, vince il server. Non replicare il listino nella pagina più di quanto già faccia.

- [ ] **Step 2: Provare in un browser vero**

Servire `pagine/` con un server statico e aprire `/buoni/regala/?l=it`. Verificare: si aggiunge e si toglie la seconda voce; le quantità si fermano a 4; l'anteprima mostra le righe con il numero davanti e senza numero quando è uno; il totale corrisponde alla somma del listino; la terza voce non è raggiungibile.

Poi con `?l=de`, `?l=en`, `?l=fr`: nessuna stringa italiana rimasta nel modulo nuovo.

- [ ] **Step 3: Provare l'acquisto intero**

Dal browser, completare un acquisto di prova a due voci e verificare che il buono arrivi per email con le due righe e il totale giusto.

- [ ] **Step 4: Commit**

```bash
git add pagine/buoni/regala/index.html
git commit -m "Si possono regalare due cose insieme"
```

---

### Task 5: Il back office mostra le voci

**Files:**
- Modify: `pagine/buoni/index.html` (elenco e dettaglio del buono)

- [ ] **Step 1: Mostrare le righe**

Nel dettaglio di un buono, dove oggi compare `descrizione`, mostrarla su più righe come la compone il server (è già separata da ritorni a capo: basta non appiattirla). Dove c'è la colonna `voci`, mostrare anche le quantità in chiaro.

Nell'elenco, un buono a due voci deve essere riconoscibile senza aprirlo.

- [ ] **Step 2: Provare in un browser vero**

Aprire il back office con un buono a due voci creato nei task precedenti e verificare che entrambe le righe si leggano, nell'elenco e nel dettaglio.

- [ ] **Step 3: Commit**

```bash
git add pagine/buoni/index.html
git commit -m "In back office si vede cosa contiene un buono a due voci"
```

---

## Cosa resta fuori

Il buono monetario, le condizioni di vendita, la scadenza, il pagamento, il codice, la verifica e il riscatto in reception: nessuno di questi cambia.

Il limite di due voci nasce dallo spazio sul foglio. Se un giorno servissero tre voci, prima va rifatto il foglio — non alzato il numero.
