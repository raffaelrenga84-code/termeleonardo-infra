# Prenotazione camere — passo 1: mostra e raccoglie

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Una pagina che mostra le camere davvero disponibili coi prezzi veri, e raccoglie la richiesta senza obbligare l'ospite a registrarsi — senza ancora incassare nulla.

**Architecture:** Nessuna funzione nuova e nessuna migrazione. La richiesta è del tipo `soggiorno`, che esiste già: i campi visibili restano nelle colonne di `richiesta_sito` (così back office ed email funzionano senza modifiche) e la camera scelta finisce in `dati` jsonb. La disponibilità si legge da `check-availability`, che è lo stesso endpoint del motore ufficiale, e si normalizza in un modulo a sé prima di arrivare alla pagina.

**Tech Stack:** Deno / TypeScript (Supabase Edge Functions), HTML statico multilingua su Vercel, `deno test`.

## Global Constraints

- **I prezzi dell'API sono in CENTESIMI.** `15500` significa 155,00 €. Ogni valore che attraversa un confine dichiara la sua unità nel nome (`prezzo_cent`) o nel campo `valuta`. Questa trappola è già costata un difetto nella funzione `chat`.
- **La caparra è 75 € a persona, per adulto: `7500 × adulti` centesimi.** Non a camera. È la regola che la reception applica già (`acconto / adulti` nei modelli).
- **Le condizioni di cancellazione sono diverse per lingua ed è voluto:** italiano 100% da 2 giorni; tedesco, inglese e francese 100% da 7 giorni, solo caparra fino a 7 giorni, 70% da 30 giorni con numero di camera fisso. Non uniformarle.
- **Le camere si abbinano per `room_category_id`, mai per nome.** L'abbinamento per sottostringa dei modelli assegna alla "Singola senza balcone" una descrizione che promette un balcone.
- **Nessuna descrizione inventata:** dove il testo non è confermato, la camera compare senza descrizione. Meglio niente che sbagliato.
- Commenti e nomi in italiano, come nel resto del progetto.
- La pagina non dice mai "prenotazione confermata": in questo passo non incassa e non conferma.

---

### Task 1: Il catalogo delle camere, per identificativo

**Files:**
- Create: `supabase/functions/richieste/camere.ts`
- Test: `supabase/functions/richieste/camere.test.ts`

**Interfaces:**
- Produces: `export type Camera = { id: number; nome: string; descrizione: Record<string,string> }`, `export const CAMERE: Record<number, Camera>`, `export function descrizioneCamera(id: number, lingua: string): string`

Gli identificativi vengono dalla risposta reale di `/api/available/rates` osservata il 14 agosto 2026: 2 Singola senza balcone, 3 Singola Parco, 4 Singola Accessibile, 5 Doppia, 6 Matrimoniale Queen, 7 Junior Suite Colli Euganei, 8 Junior Suite Accessibile, 9 Suite Colli Euganei, 10 Suite Monteortone, 11 Junior Suite Monteortone, 12 Junior Suite Abano.

- [ ] **Step 1: Scrivere il test che fallisce**

```ts
import { assertEquals } from 'jsr:@std/assert';
import { CAMERE, descrizioneCamera } from './camere.ts';

/* Il difetto che questo modulo esiste per evitare: l'abbinamento per
   sottostringa dei modelli della reception non ha una voce per "singola
   senza balcone", ricade su "singola" e le promette un balcone che il nome
   stesso della camera nega. */
Deno.test('la singola senza balcone non promette un balcone', () => {
  for (const l of ['it', 'de', 'en', 'fr']) {
    const d = descrizioneCamera(2, l);
    assertEquals(/balcon|Balkon/i.test(d), false, `lingua ${l}: "${d}"`);
  }
});

Deno.test('una camera senza descrizione confermata resta senza descrizione', () => {
  assertEquals(descrizioneCamera(12, 'it'), '');
});

Deno.test('un identificativo sconosciuto non fa saltare niente', () => {
  assertEquals(descrizioneCamera(999, 'it'), '');
  assertEquals(CAMERE[999], undefined);
});

/* Il catalogo deve coprire tutte le categorie che l'API restituisce: se
   domani ne compare una nuova e nessuno la aggiunge qui, la pagina la
   mostrerebbe senza nome. */
Deno.test('il catalogo copre le undici categorie dell API', () => {
  const id = Object.keys(CAMERE).map(Number).sort((a, b) => a - b);
  assertEquals(id, [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  for (const i of id) assertEquals(CAMERE[i].nome.length > 0, true, `camera ${i} senza nome`);
});

/* Guardia per quando la direzione confermera' gli abbinamenti: una
   descrizione che esiste in una lingua sola farebbe comparire l'italiano a
   un ospite tedesco. Il conteggio delle camere descritte e' asserito, cosi'
   il test non diventa vacuo quando sono tutte vuote. */
Deno.test('una descrizione o e in tutte e quattro le lingue o non c e', () => {
  let descritte = 0;
  for (const [id, c] of Object.entries(CAMERE)) {
    const presenti = ['it', 'de', 'en', 'fr'].filter(
      (l) => typeof c.descrizione[l] === 'string' && c.descrizione[l].length > 0);
    if (!presenti.length) continue;
    descritte++;
    assertEquals(presenti.length, 4, `camera ${id}: descritta in ${presenti.join(',')}`);
  }
  /* oggi nessuna e' confermata: quando la direzione ne conferma una, questo
     numero va alzato di pari passo, ed e' il promemoria che il test esiste */
  assertEquals(descritte, 0);
});
```

- [ ] **Step 2: Eseguire il test e vederlo fallire**

Run: `cd supabase/functions/richieste && deno test camere.test.ts --allow-read`
Expected: FAIL, "Module not found ./camere.ts"

- [ ] **Step 3: Scrivere il modulo**

```ts
/* camere.ts — il catalogo delle categorie, per identificativo.

   L'abbinamento va per `room_category_id`, che l'API restituisce stabile, e
   MAI per nome: i modelli della reception abbinano per sottostringa e non
   hanno una voce per "singola senza balcone", quindi le assegnano la
   descrizione della "singola" — balcone compreso, su una camera che nel nome
   dichiara di non averlo. Stessa sorte per la "Singola Accessibile".

   Le descrizioni qui sono solo quelle di cui la direzione ha confermato
   l'abbinamento. Dove manca la conferma il campo resta vuoto e la pagina non
   scrive nulla: una descrizione giusta sulla camera sbagliata e' peggio di
   nessuna descrizione. Due discordanze note, da chiarire prima di riempirle:
   l'API dichiara 35 mq per la Junior Suite Abano contro i 28 dei modelli, e
   21 mq per la Doppia contro 18. */

export type Camera = {
  id: number;
  nome: string;
  descrizione: Record<string, string>;
};

export const CAMERE: Record<number, Camera> = {
  2: { id: 2, nome: 'Singola senza balcone', descrizione: {} },
  3: { id: 3, nome: 'Singola Parco', descrizione: {} },
  4: { id: 4, nome: 'Singola Accessibile', descrizione: {} },
  5: { id: 5, nome: 'Doppia', descrizione: {} },
  6: { id: 6, nome: 'Matrimoniale Queen', descrizione: {} },
  7: { id: 7, nome: 'Junior Suite Colli Euganei', descrizione: {} },
  8: { id: 8, nome: 'Junior Suite Accessibile', descrizione: {} },
  9: { id: 9, nome: 'Suite Colli Euganei', descrizione: {} },
  10: { id: 10, nome: 'Suite Monteortone', descrizione: {} },
  11: { id: 11, nome: 'Junior Suite Monteortone', descrizione: {} },
  12: { id: 12, nome: 'Junior Suite Abano', descrizione: {} },
};

export function descrizioneCamera(id: number, lingua: string): string {
  const c = CAMERE[id];
  if (!c) return '';
  return c.descrizione[lingua] || c.descrizione.it || '';
}
```

- [ ] **Step 4: Eseguire il test e vederlo passare**

Run: `cd supabase/functions/richieste && deno test camere.test.ts --allow-read`
Expected: PASS, 5 test

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/richieste/camere.ts supabase/functions/richieste/camere.test.ts
git commit -m "Catalogo camere per identificativo, non per nome"
```

---

### Task 2: Normalizzare la disponibilità, e la caparra

**Files:**
- Create: `supabase/functions/richieste/disponibilita.ts`
- Test: `supabase/functions/richieste/disponibilita.test.ts`

**Interfaces:**
- Consumes: `CAMERE`, `descrizioneCamera(id, lingua)` da `./camere.ts`
- Produces: `export type Proposta = { camera_id: number; nome: string; descrizione: string; max_adulti: number; tariffa_id: number; variante_id: number; tariffa: string; trattamento: string; prezzo_cent: number }`, `export function normalizzaDisponibilita(grezzo: unknown, lingua: string): Proposta[]`, `export function caparraCent(adulti: number): number`

- [ ] **Step 1: Scrivere il test che fallisce**

```ts
import { assertEquals } from 'jsr:@std/assert';
import { caparraCent, normalizzaDisponibilita } from './disponibilita.ts';

/* forma reale osservata il 14 agosto 2026: array di array, prezzi in
   centesimi, le tariffe dentro rate_variations */
const GREZZO = [[{
  room_category_id: 5,
  room_category: { id: 5, name: 'Doppia', max_adults: 2 },
  rates: [{
    id: 1, name: 'Soggiorno breve',
    rate_variations: [{
      id: 1, rate_name: 'Soggiorno breve', name: 'Mezza Pensione',
      full_name: 'Soggiorno breve Mezza Pensione',
      days: [{ for_date: '2026-09-16', price: 15500 }],
      adult_total: 15500, children_total: 0, total: 31000,
    }],
  }],
}]];

Deno.test('il totale resta in centesimi e lo dice il nome del campo', () => {
  const p = normalizzaDisponibilita(GREZZO, 'it');
  assertEquals(p.length, 1);
  assertEquals(p[0].prezzo_cent, 31000);
});

Deno.test('nome e identificativo della camera arrivano dal catalogo', () => {
  const p = normalizzaDisponibilita(GREZZO, 'it');
  assertEquals(p[0].camera_id, 5);
  assertEquals(p[0].nome, 'Doppia');
});

Deno.test('tariffa e trattamento restano distinti', () => {
  const p = normalizzaDisponibilita(GREZZO, 'it');
  assertEquals(p[0].tariffa, 'Soggiorno breve');
  assertEquals(p[0].trattamento, 'Mezza Pensione');
  assertEquals(p[0].variante_id, 1);
});

Deno.test('una risposta malformata non fa saltare la pagina', () => {
  assertEquals(normalizzaDisponibilita(null, 'it'), []);
  assertEquals(normalizzaDisponibilita([], 'it'), []);
  assertEquals(normalizzaDisponibilita([[{ room_category_id: 5 }]], 'it'), []);
});

/* 75 euro a PERSONA, non a camera: e' la regola che la reception applica
   gia' oggi. Su una doppia fa 150, non 75. */
Deno.test('la caparra e 75 euro per adulto', () => {
  assertEquals(caparraCent(1), 7500);
  assertEquals(caparraCent(2), 15000);
  assertEquals(caparraCent(4), 30000);
});

Deno.test('la caparra non va sotto un adulto', () => {
  assertEquals(caparraCent(0), 7500);
  assertEquals(caparraCent(-3), 7500);
});
```

- [ ] **Step 2: Eseguire il test e vederlo fallire**

Run: `cd supabase/functions/richieste && deno test disponibilita.test.ts --allow-read`
Expected: FAIL, "Module not found ./disponibilita.ts"

- [ ] **Step 3: Scrivere il modulo**

```ts
/* disponibilita.ts — riduce la risposta di /api/available/rates a quello che
   serve alla pagina.

   ATTENZIONE ALL'UNITA': l'API lavora in CENTESIMI. 15500 sono 155,00 euro.
   Il campo si chiama `prezzo_cent` proprio perche' nessuno debba ricordarselo:
   la stessa trappola ha gia' prodotto un difetto nella funzione `chat`. */

import { CAMERE, descrizioneCamera } from './camere.ts';

export type Proposta = {
  camera_id: number;
  nome: string;
  descrizione: string;
  max_adulti: number;
  tariffa_id: number;
  variante_id: number;
  tariffa: string;
  trattamento: string;
  prezzo_cent: number;
};

const n = (v: unknown): number | null =>
  typeof v === 'number' && isFinite(v) ? v : null;

export function normalizzaDisponibilita(grezzo: unknown, lingua: string): Proposta[] {
  if (!Array.isArray(grezzo)) return [];
  const fuori: Proposta[] = [];
  /* il primo livello e' una camera richiesta, il secondo le categorie */
  for (const gruppo of grezzo) {
    if (!Array.isArray(gruppo)) continue;
    for (const c of gruppo) {
      const id = n(c?.room_category_id);
      if (id === null) continue;
      const cat = CAMERE[id];
      const nome = cat?.nome ?? String(c?.room_category?.name ?? '').trim();
      if (!nome) continue;
      for (const tariffa of (Array.isArray(c?.rates) ? c.rates : [])) {
        for (const v of (Array.isArray(tariffa?.rate_variations) ? tariffa.rate_variations : [])) {
          const tot = n(v?.total);
          if (tot === null) continue;
          fuori.push({
            camera_id: id,
            nome,
            descrizione: descrizioneCamera(id, lingua),
            max_adulti: n(c?.room_category?.max_adults) ?? 0,
            tariffa_id: n(tariffa?.id) ?? 0,
            variante_id: n(v?.id) ?? 0,
            tariffa: String(v?.rate_name ?? tariffa?.name ?? '').trim(),
            trattamento: String(v?.name ?? '').trim(),
            prezzo_cent: tot,
          });
        }
      }
    }
  }
  return fuori;
}

/* 75 euro a persona, per adulto: e' cosi' che la reception calcola l'acconto
   nelle offerte (acconto / adulti). A camera sarebbe la meta' su una doppia,
   e due canali che chiedono cifre diverse per la stessa camera diventano un
   reclamo al check-in. */
export function caparraCent(adulti: number): number {
  const a = Number.isFinite(adulti) && adulti > 0 ? Math.floor(adulti) : 1;
  return 7500 * a;
}
```

- [ ] **Step 4: Eseguire il test e vederlo passare**

Run: `cd supabase/functions/richieste && deno test disponibilita.test.ts --allow-read`
Expected: PASS, 6 test

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/richieste/disponibilita.ts supabase/functions/richieste/disponibilita.test.ts
git commit -m "Disponibilita normalizzata, prezzi in centesimi dichiarati nel nome"
```

---

### Task 3: Le condizioni di cancellazione, diverse per lingua

**Files:**
- Create: `supabase/functions/richieste/condizioni.ts`
- Test: `supabase/functions/richieste/condizioni.test.ts`

**Interfaces:**
- Produces: `export const CANCELLAZIONE: Record<string, string[]>`, `export const NOTA_RECESSO: Record<string, string>`, `export function condizioni(lingua: string): { righe: string[]; recesso: string }`

I testi sono quelli che la reception manda già, presi dai modelli `template.js` (italiano) e `template-de.js` / `template-en.js` / `template-fr.js`.

- [ ] **Step 1: Scrivere il test che fallisce**

```ts
import { assertEquals } from 'jsr:@std/assert';
import { CANCELLAZIONE, condizioni } from './condizioni.ts';

/* La divergenza fra italiano e le altre lingue e' VOLUTA e confermata dalla
   proprieta' il 14 agosto 2026: ogni lingua tiene il testo che la reception
   manda gia' oggi. Questo test esiste perche' nessuno la "aggiusti" domani
   scambiandola per una svista. */
Deno.test('l italiano dice due giorni, le altre lingue sette', () => {
  assertEquals(CANCELLAZIONE.it.join(' ').includes('due giorni'), true);
  assertEquals(CANCELLAZIONE.de.join(' ').includes('7 Tage'), true);
  assertEquals(CANCELLAZIONE.en.join(' ').includes('7 days'), true);
  assertEquals(CANCELLAZIONE.fr.join(' ').includes('7 jours'), true);
});

Deno.test('la scala del 70 per cento sta solo nelle tre lingue estere', () => {
  assertEquals(CANCELLAZIONE.it.join(' ').includes('70'), false);
  for (const l of ['de', 'en', 'fr']) {
    assertEquals(CANCELLAZIONE[l].join(' ').includes('70'), true, `lingua ${l}`);
  }
});

Deno.test('tutte le lingue chiedono la disdetta per iscritto', () => {
  for (const l of ['it', 'de', 'en', 'fr']) {
    assertEquals(CANCELLAZIONE[l].join(' ').includes('info@termeleonardo.com'), true, l);
  }
});

Deno.test('una lingua sconosciuta ricade sull italiano', () => {
  assertEquals(condizioni('zz').righe, CANCELLAZIONE.it);
});

Deno.test('ogni lingua dichiara che non c e diritto di recesso', () => {
  for (const l of ['it', 'de', 'en', 'fr']) {
    assertEquals(condizioni(l).recesso.length > 0, true, l);
  }
});
```

- [ ] **Step 2: Eseguire il test e vederlo fallire**

Run: `cd supabase/functions/richieste && deno test condizioni.test.ts --allow-read`
Expected: FAIL, "Module not found ./condizioni.ts"

- [ ] **Step 3: Scrivere il modulo**

```ts
/* condizioni.ts — le condizioni di cancellazione, come le manda la reception.

   I testi italiani e quelli tedesco/inglese/francese NON dicono la stessa
   cosa: l'italiano addebita il 100% da due giorni prima, gli altri da sette e
   prevedono la scala del 70% a trenta giorni per le camere con numero fisso.
   E' una divergenza VOLUTA, confermata dalla proprieta' il 14 agosto 2026:
   ogni lingua tiene il testo che l'ospite riceve gia' oggi via email.

   Su una pagina web questo significa che il selettore di lingua e' anche un
   selettore di condizioni, cosa che in un'email non succede. Se un giorno
   diventasse un problema, la soluzione e' un testo solo, non un accorgimento
   tecnico. */

export const CANCELLAZIONE: Record<string, string[]> = {
  it: [
    'L’acconto è una caparra confirmatoria: in caso di annullamento viene trattenuto.',
    'Da due giorni prima dell’arrivo, e in caso di mancato arrivo, viene addebitato il 100% delle prestazioni prenotate e non usufruite.',
    'Se parte prima o arriva dopo, il soggiorno resta addebitato per intero.',
    'Gli annullamenti valgono solo per iscritto: una email a info@termeleonardo.com.',
  ],
  de: [
    'Die Kaution wird bei einer Stornierung einbehalten.',
    'Bei einer Stornierung bis 7 Tage vor Reiseantritt wird nur die Kaution einbehalten, danach werden 100 % der gebuchten Leistungen in Rechnung gestellt.',
    'Bei einer Reservierung mit fixer Zimmernummer: ab 30 Tage vor Reiseantritt 70 %, ab 7 Tage 100 %.',
    'Bei vorzeitiger Abreise oder verspäteter Anreise werden auch die nicht in Anspruch genommenen Übernachtungen berechnet.',
    'Stornierungen sind nur in schriftlicher Form gültig: eine E-Mail an info@termeleonardo.com genügt.',
  ],
  en: [
    'The deposit is retained in case of cancellation.',
    'If you cancel up to 7 days before arrival, only the deposit is retained; after that, 100% of the booked services is charged.',
    'For bookings with a fixed room number: 70% from 30 days before arrival, 100% from 7 days.',
    'Late arrival or early departure: unused nights are charged as well.',
    'Cancellations are valid in writing only: an email to info@termeleonardo.com is enough.',
  ],
  fr: [
    'Les arrhes sont conservées en cas d’annulation.',
    'En cas d’annulation jusqu’à 7 jours avant l’arrivée, seules les arrhes sont conservées ; au-delà, 100 % des prestations réservées sont facturées.',
    'Pour les réservations avec numéro de chambre fixe : 70 % à partir de 30 jours avant l’arrivée, 100 % à partir de 7 jours.',
    'Arrivée tardive ou départ anticipé : les nuitées non utilisées sont également facturées.',
    'Les annulations ne sont valables que par écrit : un e-mail à info@termeleonardo.com suffit.',
  ],
};

export const NOTA_RECESSO: Record<string, string> = {
  it: 'Trattandosi di un servizio alberghiero con data stabilita, non è previsto il diritto di recesso.',
  de: 'Da es sich um eine Beherbergungsleistung mit festem Datum handelt, besteht kein Widerrufsrecht.',
  en: 'As this is accommodation for a set date, no right of withdrawal applies.',
  fr: 'S’agissant d’un hébergement à date déterminée, le droit de rétractation ne s’applique pas.',
};

export function condizioni(lingua: string): { righe: string[]; recesso: string } {
  const l = CANCELLAZIONE[lingua] ? lingua : 'it';
  return { righe: CANCELLAZIONE[l], recesso: NOTA_RECESSO[l] };
}
```

- [ ] **Step 4: Eseguire il test e vederlo passare**

Run: `cd supabase/functions/richieste && deno test condizioni.test.ts --allow-read`
Expected: PASS, 5 test

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/richieste/condizioni.ts supabase/functions/richieste/condizioni.test.ts
git commit -m "Condizioni di cancellazione per lingua, con la divergenza presidiata da un test"
```

---

### Task 4: La camera scelta entra nella richiesta

**Files:**
- Modify: `supabase/functions/richieste/tipi.ts` (funzione `validaSoggiorno`, righe 195-200)
- Modify: `supabase/functions/richieste/tipi.test.ts` (aggiunta in coda)

**Interfaces:**
- Consumes: `CAMERE` da `./camere.ts`
- Produces: `validaDati('soggiorno', d, oggi)` accetta ora `{ camera_id?: number, variante_id?: number, tariffa?: string, trattamento?: string, prezzo_cent?: number }` e li restituisce in `dati`

`validaSoggiorno` oggi non valida nulla e restituisce `{ dati: {} }`, perché i campi del soggiorno stanno nelle colonne della tabella. La scelta della camera invece è nuova e va in `dati` jsonb, che esiste già: nessuna migrazione.

- [ ] **Step 1: Scrivere il test che fallisce**

```ts
/* in coda a tipi.test.ts */
import { CAMERE } from './camere.ts';

Deno.test('un soggiorno senza camera scelta resta valido come prima', () => {
  const { errore, dati } = validaDati('soggiorno', {}, OGGI);
  assertEquals(errore, undefined);
  assertEquals(dati, {});
});

Deno.test('la camera scelta viene registrata', () => {
  const { errore, dati } = validaDati('soggiorno', {
    camera_id: 5, variante_id: 1, tariffa: 'Soggiorno breve',
    trattamento: 'Mezza Pensione', prezzo_cent: 31000,
  }, OGGI);
  assertEquals(errore, undefined);
  assertEquals(dati!.camera_id, 5);
  assertEquals(dati!.prezzo_cent, 31000);
  assertEquals(dati!.nome_camera, CAMERE[5].nome);
});

Deno.test('una camera inesistente viene rifiutata', () => {
  assertEquals(validaDati('soggiorno', { camera_id: 999 }, OGGI).errore,
    'camera sconosciuta');
});

/* il prezzo arriva dal cliente e non ci si fida: serve solo a mostrare cosa
   ha visto l'ospite, e un numero assurdo va fermato prima di finire in email */
Deno.test('un prezzo assurdo viene rifiutato', () => {
  assertEquals(validaDati('soggiorno', { camera_id: 5, prezzo_cent: -1 }, OGGI).errore,
    'prezzo non valido');
  assertEquals(validaDati('soggiorno', { camera_id: 5, prezzo_cent: 99999999 }, OGGI).errore,
    'prezzo non valido');
});
```

- [ ] **Step 2: Eseguire il test e vederlo fallire**

Run: `cd supabase/functions/richieste && deno test tipi.test.ts --allow-read`
Expected: FAIL su "la camera scelta viene registrata" — `dati.camera_id` è `undefined`

- [ ] **Step 3: Sostituire `validaSoggiorno` in `tipi.ts`**

```ts
/* ---------------- soggiorno ---------------- */
/* I campi del soggiorno stanno nelle colonne della tabella e li controlla
   valida.ts. La camera scelta sulla pagina di prenotazione e' invece nuova e
   va in `dati` jsonb, che esiste gia': nessuna migrazione.

   Il prezzo arriva dal cliente e non fa testo: serve solo a mostrare in email
   e in back office quello che l'ospite aveva davanti quando ha scelto. Si
   ferma comunque un numero assurdo, che in una email farebbe brutta figura. */
const PREZZO_MAX_CENT = 5_000_000;   // 50.000 euro

function validaSoggiorno(d: Record<string, unknown>): Esito {
  const id = d?.camera_id;
  if (id === undefined || id === null || id === '') return { dati: {} };

  const n = Number(id);
  if (!Number.isInteger(n) || !CAMERE[n]) return { errore: 'camera sconosciuta' };

  const p = d?.prezzo_cent === undefined ? null : Number(d.prezzo_cent);
  if (p !== null && (!Number.isFinite(p) || p < 0 || p > PREZZO_MAX_CENT)) {
    return { errore: 'prezzo non valido' };
  }

  return {
    dati: {
      camera_id: n,
      nome_camera: CAMERE[n].nome,
      variante_id: Number(d?.variante_id) || 0,
      tariffa: String(d?.tariffa ?? '').trim().slice(0, 60),
      trattamento: String(d?.trattamento ?? '').trim().slice(0, 60),
      ...(p !== null ? { prezzo_cent: p, valuta: 'centesimi' } : {}),
    },
  };
}
```

E in cima al file, accanto agli altri import:

```ts
import { CAMERE } from './camere.ts';
```

E nello `switch` di `validaDati`, passare i dati:

```ts
    case 'soggiorno': return validaSoggiorno(d || {});
```

- [ ] **Step 4: Eseguire tutti i test della cartella**

Run: `cd supabase/functions/richieste && deno test --allow-read --allow-env`
Expected: PASS, compresi i test già esistenti di `valida.test.ts`, `tipi.test.ts`, `conferma.test.ts`, `email-richiesta.test.ts`

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/richieste/tipi.ts supabase/functions/richieste/tipi.test.ts
git commit -m "La camera scelta entra nella richiesta di soggiorno, senza migrazioni"
```

---

### Task 5: L'azione `a=disponibilita`

**Files:**
- Modify: `supabase/functions/richieste/index.ts`
- Modify: `supabase/functions/richieste/disponibilita.ts` (aggiunta di `componiRisposta`)
- Test: `supabase/functions/richieste/disponibilita-azione.test.ts`

**Interfaces:**
- Consumes: `normalizzaDisponibilita(grezzo, lingua)`, `caparraCent(adulti)` da `./disponibilita.ts`; `condizioni(lingua)` da `./condizioni.ts`
- Produces: `GET|POST /richieste?a=disponibilita` con corpo `{ check_in, check_out, adulti, bambini?, eta_bambini?, lingua? }` che risponde `{ esito: 'ok', valuta: 'centesimi', proposte: Proposta[], caparra_cent: number, condizioni: { righe, recesso } }`

La pagina non deve conoscere la chiave del proxy: la funzione `richieste` chiama `check-availability` con `PROXY_KEY` dal proprio ambiente, che è già configurato.

- [ ] **Step 1: Scrivere il test che fallisce**

```ts
/* nuovo file: disponibilita-azione.test.ts
   Non si prova la rete: si prova che la risposta dichiari l'unita' e la
   caparra, che sono le due cose che possono far sbagliare cifre all'ospite. */
import { assertEquals } from 'jsr:@std/assert';
/*  sta in disponibilita.ts e NON in index.ts: index.ts
   chiama Deno.serve in cima al file, quindi importarlo da un test avvierebbe
   un server vero durante . */
import { componiRisposta } from './disponibilita.ts';

const GREZZO = [[{
  room_category_id: 5,
  room_category: { id: 5, name: 'Doppia', max_adults: 2 },
  rates: [{ id: 1, name: 'Soggiorno breve', rate_variations: [{
    id: 1, rate_name: 'Soggiorno breve', name: 'Mezza Pensione',
    adult_total: 15500, children_total: 0, total: 31000,
  }] }],
}]];

Deno.test('la risposta dichiara che i prezzi sono in centesimi', () => {
  const r = componiRisposta(GREZZO, 2, 'it');
  assertEquals(r.valuta, 'centesimi');
  assertEquals(r.proposte[0].prezzo_cent, 31000);
});

Deno.test('la caparra e per adulto e viaggia con la disponibilita', () => {
  assertEquals(componiRisposta(GREZZO, 2, 'it').caparra_cent, 15000);
  assertEquals(componiRisposta(GREZZO, 3, 'it').caparra_cent, 22500);
});

Deno.test('le condizioni seguono la lingua chiesta', () => {
  assertEquals(componiRisposta(GREZZO, 2, 'de').condizioni.righe.join(' ').includes('7 Tage'), true);
  assertEquals(componiRisposta(GREZZO, 2, 'it').condizioni.righe.join(' ').includes('due giorni'), true);
});
```

- [ ] **Step 2: Eseguire il test e vederlo fallire**

Run: `cd supabase/functions/richieste && deno test disponibilita-azione.test.ts --allow-read --allow-env`
Expected: FAIL, `componiRisposta` non è esportata da `disponibilita.ts`

- [ ] **Step 3a: Aggiungere `componiRisposta` in coda a `disponibilita.ts`**

Va qui e non in `index.ts`, che chiama `Deno.serve` in cima al file: un test che importasse `index.ts` avvierebbe un server vero durante `deno test`.

```ts
import { condizioni } from './condizioni.ts';

/* Compone la risposta dell'azione `a=disponibilita`. Sta qui e non in
   index.ts, che avvia il server al caricamento e non e' importabile da un
   test. */
export function componiRisposta(grezzo: unknown, adulti: number, lingua: string): {
  esito: string; valuta: string; proposte: Proposta[];
  caparra_cent: number; condizioni: { righe: string[]; recesso: string };
} {
  return {
    esito: 'ok',
    /* dichiarata sempre: la stessa unita' non dichiarata ha gia' prodotto un
       difetto nella funzione chat */
    valuta: 'centesimi',
    proposte: normalizzaDisponibilita(grezzo, lingua),
    caparra_cent: caparraCent(adulti),
    condizioni: condizioni(lingua),
  };
}
```

- [ ] **Step 3b: Collegare l'azione in `index.ts`**

In cima, accanto agli altri import:

```ts
import { componiRisposta } from './disponibilita.ts';
```

E dentro il gestore delle azioni, accanto a `a=elenco` e `a=stato`:

```ts
  if (a === 'disponibilita') {
    const b = await req.json().catch(() => ({}));
    const lingua = ['it', 'de', 'en', 'fr'].includes(String(b?.lingua)) ? String(b.lingua) : 'it';
    const adulti = Number(b?.adulti) || 2;
    const r = await fetch(
      Deno.env.get('SUPABASE_URL') + '/functions/v1/check-availability',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-proxy-key': Deno.env.get('PROXY_KEY') ?? '',
        },
        body: JSON.stringify({
          from_date: b?.check_in, to_date: b?.check_out,
          adults: adulti,
          ...(b?.bambini ? { children: Number(b.bambini) } : {}),
          ...(Array.isArray(b?.eta_bambini) ? { children_ages: b.eta_bambini } : {}),
        }),
      },
    );
    if (!r.ok) {
      return risposta({ esito: 'errore', errore: 'disponibilita non raggiungibile' }, 502);
    }
    return risposta(componiRisposta(await r.json(), adulti, lingua));
  }
```

*(`risposta()` è l'aiutante già presente in `index.ts` che aggiunge le intestazioni CORS: usare quello, non costruire una `Response` a mano, altrimenti la pagina viene bloccata dal browser — è già successo durante un collaudo.)*

- [ ] **Step 4: Eseguire i test e il controllo dei tipi**

Run: `cd supabase/functions/richieste && deno test --allow-read --allow-env && deno check index.ts`
Expected: PASS su tutti i test, `deno check` senza errori

- [ ] **Step 5: Pubblicare e provare dal vivo**

```bash
# dalla radice del repo, con il token di gestione gia' in uso in questa sessione
curl -s -X POST "https://mvuiuwakuseockotlcnp.supabase.co/functions/v1/richieste?a=disponibilita" \
  -H "content-type: application/json" \
  -d '{"check_in":"2026-09-16","check_out":"2026-09-17","adulti":2,"lingua":"it"}' \
  | head -c 400
```
Expected: `{"esito":"ok","valuta":"centesimi","proposte":[...],"caparra_cent":15000,...}`

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/richieste/index.ts supabase/functions/richieste/disponibilita.ts supabase/functions/richieste/disponibilita-azione.test.ts
git commit -m "Azione disponibilita: camere vere, caparra e condizioni in una risposta sola"
```

---

### Task 6: La pagina

**Files:**
- Create: `pagine/prenota/index.html`
- Modify: `frontend/src/data.js:23` (aggiunta di `PRENOTA_URL` accanto a `BOOKING_URL`)
- Modify: `frontend/src/components/site/RoomGallery.jsx:67` (il pulsante di ogni camera)
- Modify: `frontend/src/components/site/Hero.jsx:22` (il pulsante grande in cima)
- Modify: `frontend/src/components/site/Navbar.jsx:105` e `:153` (barra e menu del telefono)

`BOOKING_URL` compare in **quattro punti**, non uno: se se ne cambia solo uno, metà del sito manda ancora al motore vecchio e l'altra metà a quello nuovo. Vanno cambiati tutti e quattro nello stesso commit.

**Interfaces:**
- Consumes: `POST /richieste?a=disponibilita` (risposta `{esito, valuta, proposte, caparra_cent, condizioni}`), `POST /richieste` per l'invio della richiesta con `tipo: 'soggiorno'`
- Produces: `export const PRENOTA_URL = (lang = "it") => "https://arrivo-terme-leonardo.vercel.app/prenota/?l=" + lang`

La pagina segue quelle già fatte in `pagine/richieste/` e `pagine/buoni/`: quattro lingue, selettore in alto a destra piccolo con bandiere e tendina, spunta obbligatoria sull'informativa privacy, nessun campo con il numero di camera.

- [ ] **Step 1: Scrivere la pagina**

Struttura, in tre schermate dentro un unico file:

1. **Date e ospiti** — arrivo, partenza, adulti, bambini con le età. Il pulsante «Vedi le camere» chiama `a=disponibilita`.
2. **Le camere** — una scheda per proposta: nome, descrizione (solo se c'è), tariffa e trattamento, prezzo in euro ottenuto **dividendo `prezzo_cent` per 100**. Le proposte della stessa camera si raggruppano; si sceglie una variante.
3. **I dati** — nome, email, telefono, note. Poi le condizioni di cancellazione da `condizioni.righe` e la nota sul recesso, la spunta privacy, e la riga della caparra: «Alla conferma la reception le chiederà una caparra di X €, che si detrae dal totale.»

Il pulsante finale manda a `POST /richieste`:

```js
const corpo = {
  tipo: 'soggiorno',
  privacy_presa_atto: true,
  nome: campo('nome'), email: campo('email'), telefono: campo('telefono'),
  check_in: campo('arrivo'), check_out: campo('partenza'),
  ospiti: adulti + bambini,
  tipo_camera: scelta.nome,          // colonna: quello che leggono email e back office
  pacchetto: scelta.tariffa,
  messaggio: campo('note'),
  lingua: LINGUA,
  dati: {                            // jsonb: i fatti per la macchina
    camera_id: scelta.camera_id,
    variante_id: scelta.variante_id,
    tariffa: scelta.tariffa,
    trattamento: scelta.trattamento,
    prezzo_cent: scelta.prezzo_cent,
  },
};
```

La schermata di chiusura dice, nelle quattro lingue: **«Richiesta inviata. La reception le risponde entro poche ore con la conferma e le indicazioni per la caparra.»** Non dice "prenotata", non dice "confermata": in questo passo non lo è.

- [ ] **Step 2: Provarla in un browser vero**

```bash
cd "$SCRATCH/shot" && node -e "
const p=require('puppeteer-core');const attesa=(ms)=>new Promise(r=>setTimeout(r,ms));
(async()=>{const b=await p.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:'new',args:['--no-sandbox']});
const pg=await b.newPage();await pg.setViewport({width:430,height:920,isMobile:true});
const err=[];pg.on('pageerror',e=>err.push(e.message));
await pg.goto('https://arrivo-terme-leonardo.vercel.app/prenota/?l=it',{waitUntil:'networkidle2'});
await attesa(1500);
await pg.evaluate(()=>{document.querySelector('[name=arrivo]').value='2026-09-16';document.querySelector('[name=partenza]').value='2026-09-17';});
await pg.click('[data-testid=cerca]');await attesa(6000);
console.log('proposte a schermo:', await pg.evaluate(()=>document.querySelectorAll('[data-testid^=proposta-]').length));
console.log('prezzi in euro, non centesimi:', await pg.evaluate(()=>!/\\b\\d{5,}\\s*€/.test(document.body.innerText)));
console.log('errori JS:', err.join(' | ')||'nessuno');
await pg.screenshot({path:'prenota.png'});await b.close();})();"
```
Expected: proposte > 0, prezzi in euro `true`, nessun errore JS

- [ ] **Step 3: Verificare che la richiesta arrivi davvero**

Inviare una richiesta di prova dalla pagina e controllare che sia in tabella con la camera scelta:

```sql
select id, tipo, nome, tipo_camera, pacchetto, dati
from richiesta_sito
where tipo = 'soggiorno'
order by creato_il desc limit 1;
```
Expected: `dati` contiene `camera_id`, `prezzo_cent` e `valuta: 'centesimi'`

- [ ] **Step 4: Collegare il pulsante del sito**

In `frontend/src/data.js`:

```js
/* La prenotazione camere sta nelle pagine statiche come le altre richieste:
   gia' multilingua, nessun router. */
export const PRENOTA_URL = (lang = "it") =>
  `https://arrivo-terme-leonardo.vercel.app/prenota/?l=${lang}`;
```

Poi sostituire `BOOKING_URL` con `PRENOTA_URL(lang)` in tutti e quattro i punti: `RoomGallery.jsx:67`, `Hero.jsx:22`, `Navbar.jsx:105` e `Navbar.jsx:153`. `BOOKING_URL` resta definita in `data.js` finche il motore vecchio serve da riserva.

- [ ] **Step 5: Commit**

```bash
git add pagine/prenota/index.html
git commit -m "Pagina di prenotazione: camere vere, nessuna registrazione"
# nell'altro repo
cd ../termeleonardo && git add frontend/src/data.js frontend/src/components/site/RoomGallery.jsx frontend/src/components/site/Hero.jsx frontend/src/components/site/Navbar.jsx
git commit -m "Il pulsante delle camere porta alla pagina nuova"
```

---

## Cosa resta fuori da questo passo

Il pagamento della caparra (passo 2) e il buono regalo a sconto (passo 3), come previsto dalla specifica.

Restano da chiarire con la direzione, e **bloccano solo il riempimento delle descrizioni**, non il resto:

- L'abbinamento di ogni `room_category_id` alla sua descrizione. Finché non è confermato le camere compaiono col solo nome, che è corretto e viene dall'API.
- Due discordanze già misurate: l'API dichiara **35 mq per la Junior Suite Abano** contro i 28 dei modelli della reception, e **21 mq per la Doppia** contro 18.
