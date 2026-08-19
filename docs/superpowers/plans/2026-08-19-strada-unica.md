# La strada unica — piano di implementazione

> **Per chi lavora con gli agenti:** REQUIRED SUB-SKILL: usare
> superpowers:subagent-driven-development (consigliato) o
> superpowers:executing-plans per eseguire questo piano compito per
> compito. I passi usano le caselle (`- [ ]`) per il tracciamento.

**Obiettivo:** far nascere dal check-in online delle richieste vere —
`arrivo`, `transfer`, `fattura` — dentro `richiesta_sito`, con numero,
ricevuta, prezzo, conferma e proprietario, invece di una riga che nessuno
legge e un'email scritta a mano.

**Architettura:** non si costruisce un contenitore nuovo. La pagina
d'arrivo smette di scrivere per conto suo e chiama la funzione `richieste`,
che già sa fare tutto il resto. Il legame con la prenotazione è
`arrivo_token`, una colonna che esiste dal primo giorno e che finora
nessuno leggeva. La posta va dove va oggi, più una copia per tipo.

**Tecnologie:** Deno + Supabase Edge Functions (TypeScript), pagine HTML
statiche su Vercel, Resend per le email, `jsr:@std/assert` per le prove.

## Vincoli globali

- **Nessuna regola scritta due volte.** I tipi della spa si leggono da
  `ruoli.ts`; i buoni della spa da `buonoDellaSpa()`; i luoghi da
  `luoghi.ts`. Dove la copia è inevitabile — una pagina HTML non può
  importare un modulo Deno — ci va una prova incrociata che la tiene ferma.
- **Il transfer nato dal check-in passa da `validaDati('transfer', …)`**,
  lo stesso validatore del modulo del sito. Non una copia adattata.
- **Nessuna migrazione di dati e nessuna scrittura sui dati esistenti.**
- **Ogni prova dev'essere capace di fallire.** Prima di asserire su un
  elenco si asserisce che l'elenco non è vuoto.
- **Niente verifiche di invii riusciti in produzione.** Si verificano i
  rifiuti; il resto si prova in locale.
- **Quello che un ruolo non deve vedere non si nasconde: non si spedisce.**
- La suite si lancia sempre così: `deno test --allow-read --allow-env`
  (l'`--allow-env` serve: più funzioni chiamano `Deno.env.get` al
  caricamento del modulo).
- I commenti si scrivono in italiano, senza lettere accentate dentro il
  codice sorgente TypeScript (il repository usa `e'`, `puo'`, `perche'`).
- **`TIPI_PER_RUOLO` non si tocca, e non e' una dimenticanza.** La
  specifica diceva «due righe in `TIPI_PER_RUOLO`»: e' sbagliato, e me ne
  sono accorto scrivendo questo piano. Reception e amministrazione sono
  `'tutto'`, quindi i tipi nuovi le raggiungono da soli; la spa ha un
  elenco chiuso — `['trattamenti', 'dayspa']` — quindi `arrivo`,
  `fattura` e `transfer` le restano fuori senza scrivere niente. Chi
  «sistemasse» quel file aprirebbe alla spa la fatturazione degli ospiti.
- **`TIPI_ATTIVI` non si tocca.** `arrivo` e `fattura` non sono tipi che il
  pubblico può creare da `?a=invia`: esistono solo dentro `validaDati`, per
  `?a=invia-arrivo` e per `?a=conferma`. `TIPI_ATTIVI` è rispecchiata in
  `supabase/functions/chat/prompt.ts`, e allargarla direbbe al chatbot che
  può aprire richieste di fatturazione.

---

## Struttura dei file

**Creati**

| file | responsabilità |
|---|---|
| `pagine/comune/luoghi.js` | l'elenco ATAM per le pagine, unica copia lato browser |
| `pagine/comune/luoghi.test.ts` | tiene la copia ferma contro `luoghi.ts` |
| `supabase/functions/richieste/arrivo-invio.ts` | dal corpo del modulo d'arrivo ai pezzi da salvare. Puro |
| `supabase/functions/richieste/arrivo-invio.test.ts` | le prove del modulo puro |
| `supabase/functions/richieste/ricevuta-arrivo.ts` | la ricevuta unica riepilogativa |
| `supabase/functions/richieste/ricevuta-arrivo.test.ts` | le sue prove |
| `supabase/functions/richieste/copie.test.ts` | posta e schermo devono dire la stessa cosa |

**Modificati**

| file | cosa cambia |
|---|---|
| `supabase/functions/richieste/tipi.ts` | `validaArrivo`, `validaFattura`, due `case` in `validaDati` |
| `supabase/functions/richieste/riepilogo.ts` | etichetta e riepilogo per i due tipi |
| `supabase/functions/richieste/ruoli.ts` | `CASELLA_IN_COPIA` e `casellaInCopia()` |
| `supabase/functions/richieste/email-richiesta.ts` | il `cc` |
| `supabase/functions/richieste/index.ts` | `?a=invia-arrivo`; `?a=stato` rifiuta la chiusura; `?a=arrivi` legge le richieste |
| `supabase/functions/richieste/arrivi.ts` | i campi della spa per la nuova forma |
| `supabase/functions/buoni/email-buono.ts` | copia alla spa quando `buonoDellaSpa()` |
| `supabase/functions/prepara-arrivo/index.ts` | perde il `POST` |
| `pagine/index.html` | transfer come quello del sito, nuova porta, stato «già inviato» |
| `pagine/richieste/transfer/index.html` | importa i luoghi invece di riscriverli |
| `pagine/buoni/index.html` | idem, e la scheda «Arrivi» legge la nuova forma |

---

## Task 1: L'elenco dei luoghi in un modulo solo

**Perché per primo:** senza, la pagina d'arrivo diventerebbe la **quarta**
copia scritta a mano di un elenco di 189 voci che deve combaciare parola per
parola col modulo dei tassisti. Oggi le copie sono tre e nessuna prova le
tiene ferme.

**File:**
- Creare: `pagine/comune/luoghi.js`
- Creare: `pagine/comune/luoghi.test.ts`
- Modificare: `pagine/richieste/transfer/index.html` (i 189 `<option>` scritti a mano)
- Modificare: `pagine/buoni/index.html` (la costante `LUOGHI_ATAM` intorno a riga 990)

**Interfacce:**
- Consuma: `LUOGHI_ATAM` da `supabase/functions/richieste/luoghi.ts` (l'originale, `readonly string[]`)
- Produce: `export const LUOGHI_ATAM` in `pagine/comune/luoghi.js`, un array di stringhe **nello stesso ordine dell'originale**

- [ ] **Passo 1: scrivere la prova che deve fallire**

`pagine/comune/luoghi.test.ts`:

```ts
/* ============================================================
   luoghi.test.ts — l'elenco ATAM, e le sue copie.

   L'ORIGINALE e' supabase/functions/richieste/luoghi.ts, che e' anche
   quello che RIFIUTA un luogo fuori elenco. Le pagine non possono
   importarlo: sono HTML puro, e un modulo Deno non si carica in un
   browser. Quindi la copia e' inevitabile — quello che non e' inevitabile
   e' che diverga.

   E divergeva gia': fino a oggi le copie erano TRE (luoghi.ts, il back
   office, il modulo transfer del sito, che aveva 189 <option> scritti a
   mano) e nessuna prova le confrontava. Una voce corretta in un posto solo
   costringe la reception a cercarla a mano fra 189, che e' esattamente il
   motivo per cui l'elenco era stato copiato parola per parola.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';
import { LUOGHI_ATAM as ORIGINALE } from '../../supabase/functions/richieste/luoghi.ts';

const SORGENTE = Deno.readTextFileSync(new URL('luoghi.js', import.meta.url));

function copia(): string[] {
  const corpo = SORGENTE.replace('export const', 'const') + '\nreturn LUOGHI_ATAM;';
  return new Function(corpo)() as string[];
}

/* senza questa, le due prove sotto potrebbero confrontare due array vuoti */
Deno.test('la copia non e vuota', () => {
  assert(copia().length > 150, `solo ${copia().length} voci: la prova girerebbe a vuoto`);
});

Deno.test('la copia combacia voce per voce, ordine compreso', () => {
  assertEquals(copia(), [...ORIGINALE]);
});

/* I doppi spazi non sono un refuso: "Venezia  aeroporto" e "Terme  Euganee
   FS" li hanno anche sul modulo dei tassisti, e ripulirli romperebbe il
   confronto parola per parola. */
Deno.test('i doppi spazi sopravvivono alla copia', () => {
  const c = copia();
  assert(c.includes('Venezia  aeroporto'), 'il doppio spazio di Venezia e sparito');
  assert(c.includes('Terme  Euganee FS'), 'il doppio spazio di Terme Euganee e sparito');
});

Deno.test('nessuna pagina tiene piu una copia sua', () => {
  const back = Deno.readTextFileSync(new URL('../buoni/index.html', import.meta.url));
  const transfer = Deno.readTextFileSync(new URL('../richieste/transfer/index.html', import.meta.url));

  assert(!/const LUOGHI_ATAM\s*=\s*\[/.test(back),
    'pagine/buoni/index.html ha ancora una copia sua dell elenco');
  assert(!transfer.includes('<option value="Montegrotto"'),
    'pagine/richieste/transfer/index.html ha ancora i luoghi scritti a mano');

  for (const [nome, html] of [['buoni', back], ['transfer', transfer]] as const) {
    assert(html.includes('/comune/luoghi.js'), `la pagina ${nome} non importa il modulo comune`);
  }
});
```

- [ ] **Passo 2: lanciarla e vederla fallire**

```
deno test pagine/comune/luoghi.test.ts --allow-read --allow-env
```

Atteso: FALLISCE, perché `pagine/comune/luoghi.js` non esiste.

- [ ] **Passo 3: creare il modulo**

Generare `pagine/comune/luoghi.js` **dall'originale**, non a mano:

```bash
node -e "
const fs=require('fs');
const s=fs.readFileSync('supabase/functions/richieste/luoghi.ts','utf8');
const m=s.match(/export const LUOGHI_ATAM: readonly string\[\] = \[([\s\S]*?)\];/);
if(!m){console.error('elenco non trovato');process.exit(1);}
const testa=[
'/* L\'elenco delle destinazioni ATAM, per le pagine.',
'',
'   L\'ORIGINALE e\' supabase/functions/richieste/luoghi.ts, che e\' anche',
'   quello che RIFIUTA un luogo fuori elenco. Questa e\' una copia perche\'',
'   una pagina HTML non puo\' importare un modulo Deno.',
'',
'   NON si riordina e NON si ripulisce: le voci devono combaciare parola per',
'   parola col modulo dei tassisti, doppi spazi compresi. La reception',
'   ricopia il valore, e una voce diversa la costringe a cercarla a mano fra',
'   189. Lo tiene fermo pagine/comune/luoghi.test.ts. */',
'export const LUOGHI_ATAM = ['].join('\n');
fs.writeFileSync('pagine/comune/luoghi.js', testa + m[1] + '];\n');
console.log('modulo generato');
"
```

- [ ] **Passo 4: far importare il modulo alle due pagine**

In `pagine/buoni/index.html`: togliere il blocco `const LUOGHI_ATAM = [ … ];`
(e il commento che dichiara la copia, che ora è nel modulo) e aggiungere
l'import accanto agli altri, nella stessa forma già usata dalla pagina:

```js
import { LUOGHI_ATAM } from '/comune/luoghi.js';
```

In `pagine/richieste/transfer/index.html`: togliere i `<option>` scritti a
mano dal `<select>` del luogo e riempirlo da JavaScript. Il raggruppamento
«i più richiesti» resta: cambia solo da dove vengono le voci — sono le
prime otto dell'elenco, che nell'originale stanno in testa apposta.

```js
import { LUOGHI_ATAM } from '/comune/luoghi.js';

/* Le prime otto voci di LUOGHI_ATAM sono le piu' richieste e stanno in
   testa all'elenco apposta (vedi luoghi.ts): il gruppo si taglia da li',
   non si riscrive a mano — una lista a parte diventerebbe la quinta copia. */
const COMUNI = 8;

function riempiLuoghi(sel, t) {
  const opz = (voci) => voci.map((l) =>
    `<option value="${l.replace(/"/g, '&quot;')}">${l}</option>`).join('');
  sel.innerHTML =
    `<option value=""></option>` +
    `<optgroup label="${t.comuni}">${opz(LUOGHI_ATAM.slice(0, COMUNI))}</optgroup>` +
    `<optgroup label="${t.tutte}">${opz(LUOGHI_ATAM.slice(COMUNI))}</optgroup>`;
}
```

> Se nel `<select>` di oggi il raggruppamento non è fatto con
> `<optgroup>` ma con i due pulsanti «un'altra destinazione…» / «torna
> alle più richieste» che la pagina già ha (`altreMete`, `tornaMete`),
> **si tiene quello che c'è**: cambia solo la sorgente delle voci, non il
> modo in cui l'ospite le sceglie. Guardare la pagina prima di riscriverla.

- [ ] **Passo 5: lanciare le prove**

```
deno test pagine/comune/luoghi.test.ts --allow-read --allow-env
deno test --allow-read --allow-env
```

Attesi: tutte verdi. Se `pagine/comune/atam.test.ts` o
`pagine/comune/listino-transfer.test.ts` diventano rosse, è un segnale
reale: significa che l'elenco è cambiato, non che la prova è di troppo.

- [ ] **Passo 6: aprire il modulo transfer nel browser e scegliere un luogo**

Il `<select>` deve avere le stesse voci di prima, nello stesso ordine, con
lo stesso raggruppamento. Una prova automatica non vede un `<select>` vuoto
riempito male.

- [ ] **Passo 7: commit**

```bash
git add pagine/comune/luoghi.js pagine/comune/luoghi.test.ts \
        pagine/richieste/transfer/index.html pagine/buoni/index.html
git commit -m "I 189 luoghi ATAM in un modulo solo, con la prova che li tiene fermi"
```

---

## Task 2: I tipi `arrivo` e `fattura`

**File:**
- Modificare: `supabase/functions/richieste/tipi.ts`
- Modificare: `supabase/functions/richieste/riepilogo.ts`
- Test: `supabase/functions/richieste/tipi.test.ts` (esistente, si aggiunge)
- Test: `supabase/functions/richieste/riepilogo.test.ts` (esistente, si aggiunge)

**Interfacce:**
- Consuma: `Esito = { errore?: string; dati?: Record<string, unknown> }`, e gli aiutanti interni di `tipi.ts` (`testo`, `intero`)
- Produce:
  - `validaDati('arrivo', d)` → `dati: { ora_arrivo, mezzo, attenzioni: string[], fanghi_desiderio: string|null, persone_extra: {nome,eta}[], persone_confermate: boolean, note }`
  - `validaDati('fattura', d)` → `dati: { ragione, indirizzo, piva, cf, sdi, pec }`
  - `riepilogoRichiesta` restituisce etichetta `'Arrivo'` e `'Fattura'`

- [ ] **Passo 1: scrivere le prove che devono fallire**

In coda a `supabase/functions/richieste/tipi.test.ts`:

```ts
/* ============================================================
   I DUE TIPI CHE NASCONO DAL CHECK-IN ONLINE.

   Non stanno in TIPI_ATTIVI apposta: dal modulo pubblico non si possono
   creare. Esistono in validaDati perche' li crea ?a=invia-arrivo, che
   pretende un token valido, e perche' ?a=conferma rivalida con le stesse
   regole — un campo non previsto qui sparirebbe in silenzio fra il
   "conferma" e l'email, che e' il difetto gia' documentato per
   prezzo_cent del transfer.
   ============================================================ */
Deno.test('i due tipi nuovi NON sono creabili dal modulo pubblico', () => {
  assert(!TIPI_ATTIVI.includes('arrivo' as never), 'arrivo e finito in TIPI_ATTIVI');
  assert(!TIPI_ATTIVI.includes('fattura' as never), 'fattura e finito in TIPI_ATTIVI');
});

Deno.test('un arrivo minimo passa', () => {
  const v = validaDati('arrivo', { ora_arrivo: '16:30', mezzo: 'auto' });
  assert(!v.errore, v.errore);
  assertEquals(v.dati?.ora_arrivo, '16:30');
  assertEquals(v.dati?.attenzioni, []);
  assertEquals(v.dati?.fanghi_desiderio, null);
});

/* Le attenzioni arrivano come CHIAVI, non come testo tradotto: la pagina
   parla quattro lingue e "Culla per neonato" in back office andrebbe
   letto da chi ha davanti "Babybett". E' la stessa scelta gia' fatta per
   il desiderio dei fanghi. */
Deno.test('le attenzioni fuori elenco cadono', () => {
  const v = validaDati('arrivo', { attenzioni: ['culla', 'elicottero', 'cane'] });
  assertEquals(v.dati?.attenzioni, ['culla', 'cane']);
});

Deno.test('il desiderio dei fanghi fuori elenco diventa null', () => {
  assertEquals(validaDati('arrivo', { fanghi_desiderio: 'alle 7' }).dati?.fanghi_desiderio, null);
  assertEquals(validaDati('arrivo', { fanghi_desiderio: 'presto' }).dati?.fanghi_desiderio, 'presto');
});

Deno.test('le persone senza nome non contano, e non se ne prendono piu di sei', () => {
  const tante = Array.from({ length: 9 }, (_, i) => ({ nome: `Tizio ${i}`, eta: '30' }));
  assertEquals((validaDati('arrivo', { persone_extra: tante }).dati?.persone_extra as unknown[]).length, 6);
  assertEquals((validaDati('arrivo', { persone_extra: [{ nome: '', eta: '9' }] })
    .dati?.persone_extra as unknown[]).length, 0);
});

/* Il segno che dice "qualcuno ha risposto". Deve sopravvivere alla
   rivalidazione, o ?a=conferma lo perderebbe e la richiesta tornerebbe
   bloccata dopo che il lavoro era stato fatto. */
Deno.test('persone_confermate sopravvive alla rivalidazione', () => {
  assertEquals(validaDati('arrivo', { persone_confermate: true }).dati?.persone_confermate, true);
  assertEquals(validaDati('arrivo', {}).dati?.persone_confermate, false);
});

Deno.test('una fattura senza ragione sociale e rifiutata', () => {
  assert(validaDati('fattura', { piva: 'IT02042330288' }).errore);
});

/* Senza partita IVA ne' codice fiscale non si emette niente: accettarla
   vorrebbe dire mettere in coda all'amministrazione una richiesta che non
   puo' lavorare, e scoprirlo al check-out. */
Deno.test('una fattura senza piva ne codice fiscale e rifiutata', () => {
  assert(validaDati('fattura', { ragione: 'Bianchi S.r.l.' }).errore);
});

Deno.test('una fattura completa passa', () => {
  const v = validaDati('fattura', {
    ragione: 'Bianchi S.r.l.', indirizzo: 'Via Roma 1, Padova',
    piva: 'IT02042330288', cf: 'BNCMRA80A01G224X', sdi: 'M5UXCR1', pec: 'b@pec.it',
  });
  assert(!v.errore, v.errore);
  assertEquals(v.dati?.piva, 'IT02042330288');
});
```

In coda a `supabase/functions/richieste/riepilogo.test.ts`:

```ts
Deno.test('l arrivo si legge in elenco', () => {
  const r = riepilogoRichiesta({ tipo: 'arrivo', dati: {
    ora_arrivo: '16:30', mezzo: 'auto', attenzioni: ['culla'], fanghi_desiderio: 'presto',
  } });
  assertEquals(r.etichetta, 'Arrivo');
  assert(r.riepilogo.includes('16:30'), r.riepilogo);
  assert(r.riepilogo.includes('fanghi'), r.riepilogo);
});

Deno.test('la fattura si legge in elenco senza mostrare tutto', () => {
  const r = riepilogoRichiesta({ tipo: 'fattura', dati: {
    ragione: 'Bianchi S.r.l.', piva: 'IT02042330288', sdi: 'M5UXCR1',
  } });
  assertEquals(r.etichetta, 'Fattura');
  assert(r.riepilogo.includes('Bianchi S.r.l.'), r.riepilogo);
});

/* Una riga d'arrivo senza niente dentro non deve leggersi come un guasto:
   vale la stessa regola gia' in piedi per gli altri tipi. */
Deno.test('un arrivo vuoto lo dice', () => {
  assertEquals(riepilogoRichiesta({ tipo: 'arrivo', dati: {} }).riepilogo, 'nessun dettaglio indicato');
});
```

- [ ] **Passo 2: lanciarle e vederle fallire**

```
deno test supabase/functions/richieste/tipi.test.ts supabase/functions/richieste/riepilogo.test.ts --allow-read --allow-env
```

Atteso: FALLISCONO con «tipo di richiesta sconosciuto» e con etichetta
`Richiesta` invece di `Arrivo`.

- [ ] **Passo 3: scrivere i due validatori**

In `supabase/functions/richieste/tipi.ts`, prima di `validaDati`:

```ts
/* ---------------- arrivo (dal check-in online) ---------------- */
/* Le attenzioni arrivano come CHIAVI e non come testo: la pagina d'arrivo
   parla quattro lingue, e "Culla per neonato" in back office andrebbe
   letto da chi in quel momento aveva davanti "Babybett". E' la stessa
   scelta gia' fatta per il desiderio dei fanghi. */
const ATTENZIONI = ['culla', 'seggiolone', 'parcheggio', 'cane'] as const;

/* COPIA di DESIDERI in prepara-arrivo/fanghi.ts: le funzioni si pubblicano
   una cartella per volta e non possono importarsi fra loro. La tiene ferma
   supabase/functions/richieste/copie.test.ts. */
const DESIDERI_FANGHI = ['presto', 'tardi', 'indifferente'] as const;

function validaArrivo(d: Record<string, unknown>): Esito {
  const oraArrivo = testo(d.ora_arrivo);
  if (oraArrivo.length > 30) return { errore: 'ora di arrivo troppo lunga' };

  const mezzo = testo(d.mezzo);
  if (mezzo.length > 20) return { errore: 'mezzo troppo lungo' };

  const attenzioni = Array.isArray(d.attenzioni)
    ? d.attenzioni.map((a) => testo(a))
        .filter((a) => (ATTENZIONI as readonly string[]).includes(a))
    : [];

  const desiderio = testo(d.fanghi_desiderio);
  const fanghi = (DESIDERI_FANGHI as readonly string[]).includes(desiderio) ? desiderio : null;

  const persone = Array.isArray(d.persone_extra)
    ? d.persone_extra.slice(0, 6).map((p) => {
        const o = (p && typeof p === 'object') ? p as Record<string, unknown> : {};
        return { nome: testo(o.nome).slice(0, 80), eta: testo(o.eta).slice(0, 10) };
      }).filter((p) => p.nome)
    : [];

  const note = testo(d.note);
  if (note.length > 2000) return { errore: 'note troppo lunghe' };

  /* IL SEGNO CHE QUALCUNO HA RISPOSTO. Sta qui e non altrove per lo stesso
     motivo di prezzo_cent nel transfer: ?a=conferma rivalida i dati con
     queste regole, e un campo non previsto verrebbe scartato in silenzio —
     la richiesta tornerebbe bloccata dopo che il lavoro era stato fatto. */
  const persone_confermate = d.persone_confermate === true;

  return {
    dati: {
      ora_arrivo: oraArrivo, mezzo, attenzioni,
      fanghi_desiderio: fanghi, persone_extra: persone, persone_confermate, note,
    },
  };
}

/* ---------------- fattura (dal check-in online) ---------------- */
function validaFattura(d: Record<string, unknown>): Esito {
  const ragione = testo(d.ragione);
  if (!ragione) return { errore: 'ragione sociale mancante' };
  if (ragione.length > 160) return { errore: 'ragione sociale troppo lunga' };

  const indirizzo = testo(d.indirizzo);
  if (indirizzo.length > 200) return { errore: 'indirizzo troppo lungo' };

  const piva = testo(d.piva);
  if (piva.length > 20) return { errore: 'partita IVA troppo lunga' };
  const cf = testo(d.cf);
  if (cf.length > 20) return { errore: 'codice fiscale troppo lungo' };

  /* senza uno dei due non si emette niente: accettarla vorrebbe dire
     mettere in coda all'amministrazione una richiesta che non puo'
     lavorare, e scoprirlo al check-out */
  if (!piva && !cf) return { errore: 'serve la partita IVA o il codice fiscale' };

  const sdi = testo(d.sdi);
  if (sdi.length > 10) return { errore: 'codice SDI troppo lungo' };
  const pec = testo(d.pec);
  if (pec.length > 160) return { errore: 'PEC troppo lunga' };

  return { dati: { ragione, indirizzo, piva, cf, sdi, pec } };
}
```

E due `case` in `validaDati`, dopo `case 'dayspa'`:

```ts
    case 'arrivo': return validaArrivo(d || {});
    case 'fattura': return validaFattura(d || {});
```

**`TIPI_ATTIVI` resta com'è.**

- [ ] **Passo 4: scrivere etichetta e riepilogo**

In `supabase/functions/richieste/riepilogo.ts`, due `case` prima di
`case 'soggiorno'`:

```ts
    case 'arrivo': {
      const attenzioni = Array.isArray(d.attenzioni) ? d.attenzioni : [];
      const persone = Array.isArray(d.persone_extra) ? d.persone_extra : [];
      const fanghi = typeof d.fanghi_desiderio === 'string' ? d.fanghi_desiderio : '';
      etichetta = 'Arrivo';
      riepilogo = [
        typeof d.ora_arrivo === 'string' && d.ora_arrivo ? `arrivo ${d.ora_arrivo}` : '',
        typeof d.mezzo === 'string' ? d.mezzo : '',
        attenzioni.length > 0 ? attenzioni.join(', ') : '',
        fanghi ? `fanghi: ${fanghi}` : '',
        /* le persone da aggiungere si dicono SEMPRE, anche in elenco:
           sono la parte che aspetta una risposta */
        persone.length > 0 ? conPlurale(persone.length, 'persona da aggiungere', 'persone da aggiungere') : '',
      ].filter(Boolean).join(' · ');
      break;
    }

    case 'fattura': {
      etichetta = 'Fattura';
      riepilogo = [
        typeof d.ragione === 'string' ? d.ragione : '',
        typeof d.piva === 'string' && d.piva ? `P.IVA ${d.piva}` : '',
      ].filter(Boolean).join(' · ');
      break;
    }
```

- [ ] **Passo 5: lanciare le prove**

```
deno test --allow-read --allow-env
```

Atteso: tutte verdi.

- [ ] **Passo 6: commit**

```bash
git add supabase/functions/richieste/tipi.ts supabase/functions/richieste/tipi.test.ts \
        supabase/functions/richieste/riepilogo.ts supabase/functions/richieste/riepilogo.test.ts
git commit -m "I tipi arrivo e fattura, fuori da TIPI_ATTIVI apposta"
```

---

## Task 3: L'instradamento della posta in copia

**File:**
- Modificare: `supabase/functions/richieste/ruoli.ts`
- Modificare: `supabase/functions/richieste/email-richiesta.ts`
- Creare: `supabase/functions/richieste/copie.test.ts`
- Test: `supabase/functions/richieste/ruoli.test.ts` (esistente, si aggiunge)

**Interfacce:**
- Consuma: `tipiVisibili(ruolo)` da `ruoli.ts`; `DESIDERI` da `prepara-arrivo/fanghi.ts` (solo nella prova incrociata)
- Produce: `casellaInCopia(tipo): 'spa' | 'amministrazione' | null` e `CASELLA_IN_COPIA` da `ruoli.ts`

- [ ] **Passo 1: scrivere le prove che devono fallire**

In coda a `supabase/functions/richieste/ruoli.test.ts`:

```ts
/* ============================================================
   POSTA E SCHERMO DEVONO DIRE LA STESSA COSA.

   Oggi ogni richiesta va alla casella dell'hotel e basta: la divisione per
   ruolo esiste solo nel back office. La spa legge i trattamenti sullo
   schermo e non li riceve; l'amministrazione, col tipo `fattura`, si
   troverebbe i dati fiscali in una casella che non apre.

   La regola sta accanto a quella dei ruoli e non altrove, perche' sono la
   stessa decisione detta due volte: chi puo' leggere una cosa, quella cosa
   deve riceverla.
   ============================================================ */
Deno.test('ogni tipo che la spa legge le arriva anche in copia', () => {
  const suoi = tipiVisibili('spa');
  assert(suoi.length > 0, 'la spa non legge niente: la prova girerebbe a vuoto');
  for (const t of suoi) {
    assertEquals(casellaInCopia(t), 'spa', `"${t}" la spa lo legge sullo schermo e non lo riceve`);
  }
});

Deno.test('e alla spa non arriva niente che non possa leggere', () => {
  for (const [tipo, chi] of Object.entries(CASELLA_IN_COPIA)) {
    if (chi !== 'spa') continue;
    assert(tipiVisibili('spa').includes(tipo),
      `"${tipo}" arriva alla spa e la spa non puo aprirlo in back office`);
  }
});

Deno.test('la fattura va all amministrazione', () => {
  assertEquals(casellaInCopia('fattura'), 'amministrazione');
});

Deno.test('un tipo senza copia non ne ha', () => {
  assertEquals(casellaInCopia('soggiorno'), null);
  assertEquals(casellaInCopia(''), null);
});

/* Una chiave come "toString" esiste su Object.prototype: una lookup
   diretta restituirebbe la funzione ereditata invece di sparire. E' il
   difetto gia' pagato coi circoli del golf in tipi.ts. */
Deno.test('un nome ereditato non diventa una casella', () => {
  assertEquals(casellaInCopia('toString'), null);
  assertEquals(casellaInCopia('constructor'), null);
});
```

`supabase/functions/richieste/copie.test.ts`, nuovo:

```ts
/* ============================================================
   copie.test.ts — le regole scritte due volte perche' non si puo' altrimenti.

   Le funzioni Supabase si pubblicano UNA CARTELLA PER VOLTA
   (strumenti/pubblica.js manda solo i file di quella funzione), quindi
   richieste/ non puo' importare da prepara-arrivo/. Dove la copia e'
   inevitabile, questa prova la tiene ferma.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';
import { DESIDERI } from '../prepara-arrivo/fanghi.ts';

const SORGENTE = Deno.readTextFileSync(new URL('tipi.ts', import.meta.url));

function desideriInTipi(): string[] {
  const m = SORGENTE.match(/const DESIDERI_FANGHI = \[([^\]]*)\]/);
  assert(m, 'DESIDERI_FANGHI non si trova in tipi.ts: aggiornare questa prova');
  return m![1].split(',').map((s) => s.trim().replace(/^'|'$/g, '')).filter(Boolean);
}

Deno.test('le fasce dei fanghi si trovano', () => {
  assertEquals(desideriInTipi().length, DESIDERI.length);
});

Deno.test('le fasce dei fanghi combaciano', () => {
  assertEquals(desideriInTipi(), [...DESIDERI]);
});
```

- [ ] **Passo 2: lanciarle e vederle fallire**

```
deno test supabase/functions/richieste/ruoli.test.ts supabase/functions/richieste/copie.test.ts --allow-read --allow-env
```

Atteso: FALLISCONO — `casellaInCopia` non esiste.

- [ ] **Passo 3: scrivere la regola**

In coda a `supabase/functions/richieste/ruoli.ts`:

```ts
/* ============================================================
   CHI RICEVE COPIA DI COSA.

   Oltre alla casella dell'hotel, che continua a ricevere tutto come oggi.
   Sta qui, accanto a TIPI_PER_RUOLO, perche' e' la stessa decisione detta
   due volte: chi puo' leggere una cosa in back office, quella cosa deve
   anche riceverla. Metterla in email-richiesta.ts vorrebbe dire due
   elenchi che divergono, e a decidere sarebbe il piu' debole.

   Qui ci sono i NOMI dei destinatari, non gli indirizzi: l'indirizzo vero
   sta in una variabile d'ambiente e lo legge chi manda l'email, cosi'
   questo modulo resta puro e collaudabile.
   ============================================================ */
export const CASELLA_IN_COPIA: Record<string, 'spa' | 'amministrazione'> = {
  trattamenti: 'spa',
  dayspa: 'spa',
  fattura: 'amministrazione',
};

/** Chi riceve copia di questo tipo, oltre alla casella dell'hotel. */
export function casellaInCopia(tipo: unknown): 'spa' | 'amministrazione' | null {
  const t = String(tipo ?? '');
  /* mai CASELLA_IN_COPIA[t] diretto: "toString" esiste su Object.prototype */
  return Object.hasOwn(CASELLA_IN_COPIA, t) ? CASELLA_IN_COPIA[t] : null;
}
```

- [ ] **Passo 4: mettere il `cc` sull'avviso**

In `supabase/functions/richieste/email-richiesta.ts`, dentro `avvisaHotel`,
dopo la riga che calcola `a`:

```ts
  /* LA COPIA. Non un secondo invio: cosi' la reception VEDE che la spa e'
     in copia. Con due email separate nessuno dei due sa che l'altro l'ha
     ricevuta, e ci si telefona per chiedere "l'hai vista?".
     Se la variabile non c'e' la copia non parte: si scrive nel registro,
     perche' un destinatario mancante in silenzio e' come non averlo
     deciso. */
  const chi = casellaInCopia(r.tipo);
  const copia = chi === 'spa'
    ? Deno.env.get('EMAIL_SPA')
    : chi === 'amministrazione'
    ? Deno.env.get('EMAIL_AMMINISTRAZIONE')
    : undefined;
  if (chi && !copia) console.error(`copia non inviata: manca l'indirizzo per ${chi} ->`, r.numero);
```

e nel corpo della chiamata a Resend, accanto a `to: a`:

```ts
        ...(copia ? { cc: [copia] } : {}),
```

con l'import in cima al file:

```ts
import { casellaInCopia } from './ruoli.ts';
```

- [ ] **Passo 5: lanciare le prove**

```
deno test --allow-read --allow-env
```

Atteso: tutte verdi.

- [ ] **Passo 6: commit**

```bash
git add supabase/functions/richieste/ruoli.ts supabase/functions/richieste/ruoli.test.ts \
        supabase/functions/richieste/email-richiesta.ts supabase/functions/richieste/copie.test.ts
git commit -m "La posta segue i ruoli: copia alla spa e all'amministrazione"
```

---

## Task 4: I buoni con trattamenti in copia alla spa

**File:**
- Modificare: `supabase/functions/buoni/email-buono.ts`
- Test: `supabase/functions/buoni/email-buono.test.ts` (esistente, si aggiunge)

**Interfacce:**
- Consuma: `buonoDellaSpa(b)` da `supabase/functions/buoni/ruoli.ts` — già esistente, **non si riscrive**
- Produce: la funzione `destinatariInCopia(b): string[]`, esportata per poterla provare senza mandare email

- [ ] **Passo 1: scrivere le prove che devono fallire**

In coda a `supabase/functions/buoni/email-buono.test.ts`:

```ts
/* ============================================================
   IL BUONO CON TRATTAMENTI ARRIVA ANCHE ALLA SPA.

   Il predicato esiste gia' e decide una vista del back office:
   buonoDellaSpa() dice che un buono a IMPORTO non e' della spa (e' denaro,
   si spende su tutto), che una voce del listino si', e che un buono
   scritto a mano in reception si' — perche' non si sa classificare, e
   nasconderlo impedirebbe di riscuoterlo al banco della spa.

   Qui lo si RIUSA per la posta. Riscrivere la regola vorrebbe dire due
   risposte diverse alla stessa domanda: chi lo vede sullo schermo e chi lo
   riceve per email.
   ============================================================ */
Deno.test('un buono con un trattamento va in copia alla spa', () => {
  Deno.env.set('EMAIL_SPA', 'spa@esempio.test');
  const c = destinatariInCopia({ tipo: 'servizio', voce_id: 'massaggio_antistress' });
  assert(c.includes('spa@esempio.test'), `copia a: ${JSON.stringify(c)}`);
});

Deno.test('un buono a importo no', () => {
  Deno.env.set('EMAIL_SPA', 'spa@esempio.test');
  assertEquals(destinatariInCopia({ tipo: 'valore', valore: 200 }), []);
});

/* Senza la variabile non si inventa un destinatario: la copia non parte, e
   si scrive nel registro. */
Deno.test('senza EMAIL_SPA non arriva a nessuno', () => {
  Deno.env.delete('EMAIL_SPA');
  assertEquals(destinatariInCopia({ tipo: 'servizio', voce_id: 'massaggio_antistress' }), []);
});
```

> Nota per chi implementa: `voce_id` dev'essere una voce vera del
> `LISTINO` di `supabase/functions/buoni/acquista.ts` appartenente a una
> famiglia della spa. Aprire il file e prenderne una: se si inventa un
> identificativo, `buonoDellaSpa()` risponde `false` e la prova passerebbe
> per il motivo sbagliato.

- [ ] **Passo 2: lanciarle e vederle fallire**

```
deno test supabase/functions/buoni/email-buono.test.ts --allow-read --allow-env
```

Atteso: FALLISCONO — `destinatariInCopia` non esiste.

- [ ] **Passo 3: scrivere la funzione e usarla**

In `supabase/functions/buoni/email-buono.ts`:

```ts
import { buonoDellaSpa } from './ruoli.ts';

/** Chi riceve copia di questo buono, oltre ai destinatari di sempre.
 *  Esportata perche' si possa provare senza mandare niente. */
export function destinatariInCopia(b: Record<string, unknown>): string[] {
  if (!buonoDellaSpa(b)) return [];
  const a = Deno.env.get('EMAIL_SPA');
  if (!a) {
    console.error('copia alla spa non inviata: manca EMAIL_SPA ->', b.numero);
    return [];
  }
  return [a];
}
```

e nella funzione `invia`, aggiungere il parametro facoltativo `cc` e
passarlo a Resend:

```ts
async function invia(a: string, oggetto: string, html: string, cc: string[] = []) {
  // … nel corpo della chiamata, accanto a `to`:
  //   ...(cc.length ? { cc } : {}),
}
```

Nella funzione che manda l'avviso interno (`avvisaAmministrazione`) passare
`destinatariInCopia(b)` come quarto argomento.

- [ ] **Passo 4: lanciare le prove**

```
deno test --allow-read --allow-env
```

- [ ] **Passo 5: commit**

```bash
git add supabase/functions/buoni/email-buono.ts supabase/functions/buoni/email-buono.test.ts
git commit -m "I buoni con trattamenti arrivano anche alla spa, con la regola gia scritta"
```

---

## Task 5: `?a=invia-arrivo` — dal modulo alle richieste

**File:**
- Creare: `supabase/functions/richieste/arrivo-invio.ts`
- Creare: `supabase/functions/richieste/arrivo-invio.test.ts`
- Modificare: `supabase/functions/richieste/index.ts`

**Interfacce:**
- Consuma: `validaDati(tipo, dati, oggi)` da `tipi.ts` (Task 2)
- Produce: `pezziDaArrivo(corpo, oggi): { errore?: string; pezzi?: Pezzo[] }` con
  `type Pezzo = { tipo: 'arrivo' | 'transfer' | 'fattura'; dati: Record<string, unknown> }`

- [ ] **Passo 1: scrivere le prove che devono fallire**

`supabase/functions/richieste/arrivo-invio.test.ts`:

```ts
/* ============================================================
   arrivo-invio.test.ts — da una compilazione del check-in alle richieste.

   PERCHE' UN MODULO PURO. La parte che decide QUANTE righe nascono e con
   quali dati non ha bisogno ne' di rete ne' di database, e provarla
   attraverso una chiamata HTTP vorrebbe dire non provarla mai.

   IL TRANSFER DEV'ESSERE INDISTINGUIBILE da quello del sito: stesso
   validatore, stessi nomi di campo, quindi stesso prezzo, stesso pulsante
   ATAM, stessa conferma. Se qui si scrivesse una forma "simile", il
   listino non la riconoscerebbe e la reception tornerebbe a scrivere i
   prezzi a mano.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';
import { pezziDaArrivo } from './arrivo-invio.ts';

const OGGI = new Date('2026-09-01T12:00:00Z');

const MINIMO = { ora_arrivo: '16:30', mezzo: 'auto' };

const COMPLETO = {
  ...MINIMO,
  attenzioni: ['culla', 'cane'],
  fanghi_desiderio: 'presto',
  persone_extra: [{ nome: 'Bianchi Luca', eta: '12' }],
  note: 'Arriviamo dopo cena se il traffico e brutto',
  transfer: true,
  transfer_dati: {
    verso: 'arrivo', luogo: 'Venezia  aeroporto', quando: '2026-09-12',
    ora: '15:30', pax: 3, volo: 'FR1234', cell: '+39 333 1234567',
  },
  fattura: true,
  fattura_dati: {
    ragione: 'Bianchi S.r.l.', indirizzo: 'Via Roma 1, Padova',
    piva: 'IT02042330288', sdi: 'M5UXCR1',
  },
};

Deno.test('una compilazione minima fa nascere una riga sola', () => {
  const r = pezziDaArrivo(MINIMO, OGGI);
  assert(!r.errore, r.errore);
  assertEquals(r.pezzi!.length, 1);
  assertEquals(r.pezzi![0].tipo, 'arrivo');
});

Deno.test('una compilazione completa ne fa nascere tre, in ordine', () => {
  const r = pezziDaArrivo(COMPLETO, OGGI);
  assert(!r.errore, r.errore);
  assertEquals(r.pezzi!.map((p) => p.tipo), ['arrivo', 'transfer', 'fattura']);
});

/* La spunta senza i dati non fa nascere una riga vuota: una richiesta di
   transfer senza luogo ne' data manderebbe la reception a telefonare per
   chiedere cosa ha chiesto l'ospite. */
Deno.test('la spunta del transfer senza dati e un errore, non una riga vuota', () => {
  const r = pezziDaArrivo({ ...MINIMO, transfer: true, transfer_dati: {} }, OGGI);
  assert(r.errore, 'e passata una richiesta di transfer senza niente dentro');
  assert(!r.pezzi, 'sono nati dei pezzi nonostante l errore');
});

/* LA PROVA CHE TIENE LE DUE STRADE INSIEME: il luogo passa dallo stesso
   elenco chiuso del modulo del sito. */
Deno.test('un luogo fuori elenco e rifiutato come dal sito', () => {
  const r = pezziDaArrivo({
    ...MINIMO, transfer: true,
    transfer_dati: { ...COMPLETO.transfer_dati, luogo: 'aeroporto di venezia' },
  }, OGGI);
  assert(r.errore?.includes('luogo'), `errore ricevuto: ${r.errore}`);
});

Deno.test('il transfer nasce coi nomi di campo del modulo del sito', () => {
  const t = pezziDaArrivo(COMPLETO, OGGI).pezzi!.find((p) => p.tipo === 'transfer')!;
  assertEquals(t.dati.luogo, 'Venezia  aeroporto');
  assertEquals(t.dati.quando, '2026-09-12');
  assertEquals(t.dati.ora, '15:30');
  assertEquals(t.dati.pax, 3);
  assertEquals(t.dati.verso, 'arrivo');
});

Deno.test('se un pezzo e invalido non ne nasce nessuno', () => {
  const r = pezziDaArrivo({ ...MINIMO, fattura: true, fattura_dati: { ragione: 'X' } }, OGGI);
  assert(r.errore, 'una fattura senza piva ne cf e passata');
  assert(!r.pezzi);
});
```

- [ ] **Passo 2: lanciarle e vederle fallire**

```
deno test supabase/functions/richieste/arrivo-invio.test.ts --allow-read --allow-env
```

Atteso: FALLISCE — il modulo non esiste.

- [ ] **Passo 3: scrivere il modulo**

`supabase/functions/richieste/arrivo-invio.ts`:

```ts
/* ============================================================
   arrivo-invio.ts — da una compilazione del check-in alle richieste.

   Fino a oggi il modulo d'arrivo scriveva in una tabella sua e mandava
   un'email a mano: niente numero, niente ricevuta, niente prezzo, e in
   back office una schermata in sola lettura. Da qui in poi produce
   richieste vere, cioe' le stesse cose che nascono dai moduli del sito.

   UNA COMPILAZIONE, FINO A TRE PEZZI. L'arrivo c'e' sempre; il transfer e
   la fattura solo se spuntati. Le sezioni non spuntate non fanno nascere
   niente — e una sezione spuntata e vuota e' un ERRORE, non una riga
   vuota: una richiesta di transfer senza luogo ne' data manderebbe la
   reception a telefonare per chiedere cosa ha chiesto l'ospite.

   TUTTO O NIENTE. Se un pezzo non passa la validazione non ne nasce
   nessuno: meta' compilazione salvata sarebbe peggio di niente, perche'
   l'ospite crede di aver mandato tutto.

   Modulo puro: dati dentro, dati fuori. Nessuna rete, nessun database.
   ============================================================ */
import { validaDati } from './tipi.ts';

export type Pezzo = {
  tipo: 'arrivo' | 'transfer' | 'fattura';
  dati: Record<string, unknown>;
};

export type Pezzi = { errore?: string; pezzi?: Pezzo[] };

const oggetto = (v: unknown): Record<string, unknown> =>
  (v && typeof v === 'object') ? v as Record<string, unknown> : {};

export function pezziDaArrivo(corpo: Record<string, unknown>, oggi: Date = new Date()): Pezzi {
  const pezzi: Pezzo[] = [];

  /* l'arrivo c'e' sempre: anche chi non spunta niente ha detto qualcosa
     compilando (o non compilando) l'ora, e quella riga e' la scheda
     dell'arrivo */
  const a = validaDati('arrivo', corpo, oggi);
  if (a.errore || !a.dati) return { errore: a.errore ?? 'arrivo non valido' };
  pezzi.push({ tipo: 'arrivo', dati: a.dati });

  if (corpo.transfer === true) {
    const t = validaDati('transfer', oggetto(corpo.transfer_dati), oggi);
    if (t.errore || !t.dati) return { errore: t.errore ?? 'transfer non valido' };
    pezzi.push({ tipo: 'transfer', dati: t.dati });
  }

  if (corpo.fattura === true) {
    const f = validaDati('fattura', oggetto(corpo.fattura_dati), oggi);
    if (f.errore || !f.dati) return { errore: f.errore ?? 'fattura non valida' };
    pezzi.push({ tipo: 'fattura', dati: f.dati });
  }

  return { pezzi };
}
```

- [ ] **Passo 4: lanciare le prove del modulo**

```
deno test supabase/functions/richieste/arrivo-invio.test.ts --allow-read --allow-env
```

Atteso: 7 verdi.

- [ ] **Passo 5: scrivere l'azione**

In `supabase/functions/richieste/index.ts`, **dopo** il blocco
`if (azione === 'precompila')` — è pubblica come quella, e come quella si
autentica col token e non con un ruolo:

```ts
  /* ---------- pubblico: il check-in online ----------
     LA PORTA E' QUESTA E NON PIU' prepara-arrivo. Quella funzione parla con
     l'ospite e sa aprire il suo link; questa sa fare le richieste — numero,
     ricevuta, prezzo, conferma, ruoli. Mettere la creazione delle richieste
     anche la' vorrebbe dire due implementazioni della stessa cosa.

     L'AUTENTICAZIONE E' IL TOKEN, come in ?a=precompila: chi ha il link
     dell'arrivo l'ha ricevuto in una nostra email. */
  if (azione === 'invia-arrivo') {
    if (req.method !== 'POST') return risposta({ errore: 'metodo non ammesso' }, 405);
    const corpo = await req.json().catch(() => ({})) as Record<string, unknown>;
    const t = testo(corpo.token);
    if (!t) return risposta({ errore: 'token mancante' }, 400);

    const { data: link } = await db.from('arrivo_link')
      .select('token, numero_pratica, intestatario, email, lingua, data_arrivo, scade_il')
      .eq('token', t).maybeSingle();
    if (!link) return risposta({ errore: 'link non valido' }, 404);
    if (link.scade_il && new Date(link.scade_il).getTime() < Date.now()) {
      return risposta({ errore: 'scaduto' }, 410);
    }

    /* GIA' MANDATO. Senza questo controllo, chi ricarica la pagina e
       rimanda crea tre richieste nuove con tre numeri nuovi e riceve una
       seconda ricevuta per cose gia' in lavorazione — peggio di prima, non
       meglio. Per cambiare qualcosa si scrive, e la correzione la fa la
       reception sulla richiesta con ?a=conferma. */
    const { data: gia } = await db.from('richiesta_sito')
      .select('numero, tipo').eq('arrivo_token', t);
    if (gia && gia.length > 0) {
      return risposta({ errore: 'gia inviato', richieste: gia }, 409);
    }

    const { errore, pezzi } = pezziDaArrivo(corpo, new Date());
    if (errore || !pezzi) return risposta({ errore }, 400);

    /* un numero per pezzo, chiesti PRIMA: se poi l'inserimento fallisce
       restano numeri saltati, che e' innocuo. Una riga orfana no. */
    const numeri: { anno: number; progressivo: number; numero: string }[] = [];
    for (let i = 0; i < pezzi.length; i++) {
      const { data: n, error: eN } = await db.rpc('prossimo_numero_richiesta');
      if (eN || !n?.[0]) {
        console.error('numerazione fallita:', eN);
        return risposta({ errore: 'salvataggio non riuscito' }, 500);
      }
      numeri.push(n[0]);
    }

    const adesso = new Date().toISOString();
    const righe = pezzi.map((p, i) => ({
      anno: numeri[i].anno, progressivo: numeri[i].progressivo, numero: numeri[i].numero,
      tipo: p.tipo,
      nome: link.intestatario, email: link.email,
      telefono: testo(corpo.telefono).slice(0, 40) || null,
      lingua: link.lingua || 'it',
      dati: p.dati,
      dati_originali: p.dati,
      arrivo_token: t,
      origine: 'check-in online',
      ip: indirizzo(req),
      privacy_il: adesso,
    }));

    /* UN SOLO insert, con tutte le righe: e' una sola istruzione, quindi
       non puo' restarne mezza */
    const { error: eIns } = await db.from('richiesta_sito').insert(righe);
    if (eIns) {
      console.error('inserimento fallito:', eIns);
      return risposta({ errore: 'salvataggio non riuscito' }, 500);
    }

    /* un avviso per richiesta — ognuno col suo numero e col "rispondi a"
       dell'ospite — e UNA sola ricevuta, perche' l'ospite ha compilato un
       modulo solo */
    const ospite = {
      nome: link.intestatario as string,
      email: link.email as string,
      lingua: (link.lingua as string) || 'it',
    };
    await Promise.all([
      /* un avviso per richiesta: ognuno porta il suo numero e il
         "rispondi a" dell'ospite, ed e' quello che oggi manca */
      ...righe.map((r) => avvisaHotel({
        numero: r.numero, tipo: r.tipo, nome: r.nome,
        email: r.email, telefono: r.telefono, lingua: r.lingua, dati: r.dati,
      })),
      inviaRicevutaArrivo(ospite, righe.map((r) => ({
        numero: r.numero, tipo: r.tipo, dati: r.dati,
      }))),
    ]);

    return risposta({ ok: true, numeri: numeri.map((n) => n.numero) });
  }
```

con gli import in cima:

```ts
import { pezziDaArrivo } from './arrivo-invio.ts';
import { inviaRicevutaArrivo } from './ricevuta-arrivo.ts';
```

> `inviaRicevutaArrivo` arriva col Task 6. Per far compilare questo passo
> subito, crearla come funzione che restituisce `false` e non manda niente,
> e riempirla nel Task 6.

- [ ] **Passo 6: controllare i tipi e lanciare tutto**

```
deno check supabase/functions/richieste/index.ts
deno test --allow-read --allow-env
```

- [ ] **Passo 7: commit**

```bash
git add supabase/functions/richieste/arrivo-invio.ts \
        supabase/functions/richieste/arrivo-invio.test.ts \
        supabase/functions/richieste/index.ts \
        supabase/functions/richieste/ricevuta-arrivo.ts
git commit -m "Il check-in online fa nascere richieste vere, tutte o nessuna"
```

---

## Task 6: La ricevuta riepilogativa

**File:**
- Riempire: `supabase/functions/richieste/ricevuta-arrivo.ts`
- Creare: `supabase/functions/richieste/ricevuta-arrivo.test.ts`

**Interfacce:**
- Consuma: `riepilogoRichiesta` da `riepilogo.ts` (Task 2), per non riscrivere come si legge una richiesta
- Produce:
  - `ricevutaArrivoHTML(ospite, righe): string`
  - `inviaRicevutaArrivo(ospite, righe): Promise<boolean>`
  - `type Ospite = { nome: string; email: string; lingua: string }`

- [ ] **Passo 1: scrivere le prove che devono fallire**

```ts
/* ============================================================
   ricevuta-arrivo.test.ts — l'unica email che riceve chi compila.

   PERCHE' UNA SOLA. Una compilazione fa nascere fino a tre richieste. Tre
   ricevute in fila, stesso minuto, stesso ospite, si leggono come un
   guasto. Chi ha compilato UN modulo si aspetta UNA risposta.

   E PERCHE' COI NUMERI DENTRO. Il transfer avra' un orario e un prezzo, la
   fattura sara' pronta al check-out: sono le due cose per cui l'ospite
   potrebbe doverci riscrivere, e senza un riferimento dovrebbe raccontare
   da capo chi e'.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';
import { ricevutaArrivoHTML } from './ricevuta-arrivo.ts';

const OSPITE = { nome: 'Rossi Mario', email: 'mario@esempio.test', lingua: 'it' };

const RIGHE = [
  { numero: 'C26/19130', tipo: 'arrivo', dati: { ora_arrivo: '16:30', mezzo: 'auto', attenzioni: ['culla'] } },
  { numero: 'C26/19131', tipo: 'transfer', dati: { luogo: 'Venezia  aeroporto', quando: '2026-09-12', ora: '15:30', pax: 3, verso: 'arrivo' } },
  { numero: 'C26/19132', tipo: 'fattura', dati: { ragione: 'Bianchi S.r.l.', piva: 'IT02042330288' } },
];

Deno.test('la ricevuta nomina l ospite e tutte le richieste', () => {
  const h = ricevutaArrivoHTML(OSPITE, RIGHE);
  assert(h.includes('Rossi Mario'), 'manca il nome');
  for (const r of RIGHE) assert(h.includes(r.numero), `manca il numero ${r.numero}`);
});

Deno.test('dice quello che ha scritto, non solo che ha scritto', () => {
  const h = ricevutaArrivoHTML(OSPITE, RIGHE);
  assert(h.includes('16:30'), 'manca l ora di arrivo');
  assert(h.includes('Venezia  aeroporto'), 'manca il luogo del transfer');
});

/* La partita IVA nella ricevuta dell'ospite e' un dato suo, e vederselo
   ripetuto e' il modo in cui si accorge di un refuso prima del check-out. */
Deno.test('i dati della fattura si rileggono', () => {
  assert(ricevutaArrivoHTML(OSPITE, RIGHE).includes('IT02042330288'));
});

Deno.test('con una riga sola non parla al plurale di cose che non ci sono', () => {
  const h = ricevutaArrivoHTML(OSPITE, [RIGHE[0]]);
  assert(!h.includes('C26/19131'), 'nomina una richiesta che non e nata');
  assert(!h.includes('fattura'), 'parla di fattura a chi non l ha chiesta');
});

Deno.test('in tedesco non risponde in italiano', () => {
  const h = ricevutaArrivoHTML({ ...OSPITE, lingua: 'de' }, RIGHE);
  assert(!h.includes('Abbiamo ricevuto'), 'la ricevuta tedesca e in italiano');
});

/* Il nome arriva da una prenotazione, ma niente vieta che contenga un
   apostrofo o un segno di minore: la stessa cura di ogni altra email. */
Deno.test('il nome non puo iniettare markup', () => {
  const h = ricevutaArrivoHTML({ ...OSPITE, nome: '<script>x</script>' }, RIGHE);
  assert(!h.includes('<script>'), 'il nome e finito nella pagina come markup');
});
```

- [ ] **Passo 2: lanciarle e vederle fallire**

```
deno test supabase/functions/richieste/ricevuta-arrivo.test.ts --allow-read --allow-env
```

- [ ] **Passo 3: scrivere il modulo**

Aprire `supabase/functions/richieste/ricevuta.ts` e riusarne la struttura
(intestazione col logo, piede, `esc()`, la chiamata a Resend). Qui sotto la
parte che cambia; il resto si copia da lì con gli stessi stili.

```ts
/* ============================================================
   ricevuta-arrivo.ts — l'unica email che riceve chi compila il check-in.

   Una compilazione fa nascere fino a tre richieste. Tre ricevute in fila,
   stesso minuto, stesso ospite, si leggono come un guasto: chi ha
   compilato UN modulo si aspetta UNA risposta.

   IL RIEPILOGO NON SI RISCRIVE. riepilogoRichiesta() lo sa gia' fare, ed e'
   la stessa frase che legge la reception in back office: due scritture
   divergerebbero, e l'ospite e la reception si troverebbero a parlare di
   due cose diverse con lo stesso numero in mano.
   ============================================================ */
import { riepilogoRichiesta } from './riepilogo.ts';

export type Ospite = { nome: string; email: string; lingua: string };
export type RigaRicevuta = {
  numero: string;
  tipo: string;
  dati: Record<string, unknown> | null;
};

const esc = (v: unknown) =>
  String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* «le abbiamo prese in carico», e nient'altro: nessun orario confermato,
   nessun prezzo. Quelli arrivano con la conferma, quando li abbiamo. */
const TESTI: Record<string, {
  oggetto: string; caro: (n: string) => string; intro: string;
  chiusura: string; saluto: string;
}> = {
  it: {
    oggetto: 'Abbiamo ricevuto i suoi dati per l\u2019arrivo',
    caro: (n) => `Gentile ${n},`,
    intro: 'abbiamo ricevuto quanto segue.',
    chiusura: 'Se qualcosa non torna, risponda a questa email.',
    saluto: 'A presto,<br />Hotel Terme Leonardo',
  },
  de: {
    oggetto: 'Wir haben Ihre Anreisedaten erhalten',
    caro: (n) => `Sehr geehrte(r) ${n},`,
    intro: 'wir haben Folgendes erhalten.',
    chiusura: 'Sollte etwas nicht stimmen, antworten Sie einfach auf diese E-Mail.',
    saluto: 'Bis bald,<br />Hotel Terme Leonardo',
  },
  en: {
    oggetto: 'We have received your arrival details',
    caro: (n) => `Dear ${n},`,
    intro: 'we have received the following.',
    chiusura: 'If anything is not right, just reply to this email.',
    saluto: 'See you soon,<br />Hotel Terme Leonardo',
  },
  fr: {
    oggetto: 'Nous avons bien re\u00e7u vos informations d\u2019arriv\u00e9e',
    caro: (n) => `Cher/Ch\u00e8re ${n},`,
    intro: 'nous avons bien re\u00e7u ce qui suit.',
    chiusura: 'Si quelque chose ne va pas, r\u00e9pondez simplement \u00e0 cet email.',
    saluto: '\u00c0 bient\u00f4t,<br />Hotel Terme Leonardo',
  },
};

export function ricevutaArrivoHTML(o: Ospite, righe: RigaRicevuta[]): string {
  const t = TESTI[o.lingua] || TESTI.it;
  const voci = righe.map((r) => {
    const { etichetta, riepilogo } = riepilogoRichiesta(r as never);
    /* il numero si mostra solo dove serve davvero all'ospite: e' il
       riferimento con cui ci riscrive se qualcosa cambia */
    return `<tr><td style="padding:8px 0;border-bottom:1px solid #EDE9E1;">` +
      `<strong>${esc(etichetta)}</strong> \u00b7 ${esc(riepilogo)}` +
      `<div style="color:#7B756A;font-size:13px;">${esc(r.numero)}</div>` +
      `</td></tr>`;
  }).join('');

  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:620px;">` +
    `<p>${esc(t.caro(o.nome))}</p><p>${t.intro}</p>` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${voci}</table>` +
    `<p style="color:#7B756A;font-size:13px;">${t.chiusura}</p>` +
    `<p>${t.saluto}</p></div>`;
}

export async function inviaRicevutaArrivo(o: Ospite, righe: RigaRicevuta[]): Promise<boolean> {
  const chiave = Deno.env.get('RESEND_API_KEY');
  /* senza chiave la ricevuta non parte, ma le richieste sono salvate e
     hanno il loro numero: meglio una ricevuta mancata che una richiesta
     persa. E' la stessa scelta gia' fatta in ricevuta.ts. */
  if (!chiave || !o.email || righe.length === 0) return false;
  const t = TESTI[o.lingua] || TESTI.it;
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${chiave}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: Deno.env.get('MITTENTE_EMAIL') ||
          'Hotel Terme Leonardo <noreply@hoteltermeleonardo.com>',
        to: o.email,
        reply_to: Deno.env.get('EMAIL_HOTEL') || 'info@termeleonardo.com',
        subject: t.oggetto,
        html: ricevutaArrivoHTML(o, righe),
      }),
    });
    if (!r.ok) console.error('Resend ha risposto', r.status, await r.text());
    return r.ok;
  } catch (e) {
    console.error('ricevuta d\u2019arrivo non inviata:', e instanceof Error ? e.message : String(e));
    return false;
  }
}
```

- [ ] **Passo 4: lanciare tutto**

```
deno test --allow-read --allow-env
```

- [ ] **Passo 5: commit**

```bash
git add supabase/functions/richieste/ricevuta-arrivo.ts supabase/functions/richieste/ricevuta-arrivo.test.ts
git commit -m "Una ricevuta sola per una compilazione sola, coi numeri dentro"
```

---

## Task 7: Le persone da aggiungere bloccano la chiusura

**File:**
- Modificare: `supabase/functions/richieste/index.ts` (azione `stato`)
- Creare/estendere: `supabase/functions/richieste/arrivi.test.ts` con una funzione pura

**Interfacce:**
- Produce: `puoChiudere(riga): { ok: boolean; perche?: string }` in `arrivi.ts`, esportata e provata da sola

- [ ] **Passo 1: scrivere le prove che devono fallire**

```ts
/* ============================================================
   UNA RICHIESTA D'ARRIVO CON GENTE DA AGGIUNGERE NON SI CHIUDE.

   Chi ha scritto "si aggiunge mia figlia" sta aspettando di sapere se c'e'
   posto e quanto costa. Una richiesta d'arrivo si chiude in fretta, perche'
   quasi sempre non c'e' niente da rispondere: e' esattamente il caso in
   cui una riga si perde.

   Il segno che qualcuno ha risposto e' persone_confermate, che
   validaArrivo conserva apposta attraverso ?a=conferma.
   ============================================================ */
Deno.test('un arrivo con persone da aggiungere non si chiude', () => {
  const r = puoChiudere({ tipo: 'arrivo', dati: { persone_extra: [{ nome: 'Bianchi Luca' }] } });
  assert(!r.ok);
  assert(r.perche && r.perche.length > 10, 'rifiuta senza dire perche');
});

Deno.test('ma si chiude quando qualcuno ha risposto', () => {
  assert(puoChiudere({ tipo: 'arrivo', dati: {
    persone_extra: [{ nome: 'Bianchi Luca' }], persone_confermate: true } }).ok);
});

Deno.test('un arrivo senza persone si chiude sempre', () => {
  assert(puoChiudere({ tipo: 'arrivo', dati: { ora_arrivo: '16:30' } }).ok);
  assert(puoChiudere({ tipo: 'arrivo', dati: { persone_extra: [] } }).ok);
});

/* La regola vale per l'arrivo e per nient'altro: un transfer con dentro
   una chiave persone_extra per sbaglio non deve diventare inchiudibile. */
Deno.test('gli altri tipi non sono toccati', () => {
  assert(puoChiudere({ tipo: 'transfer', dati: { persone_extra: [{ nome: 'X' }] } }).ok);
  assert(puoChiudere({ tipo: 'trattamenti', dati: {} }).ok);
});
```

- [ ] **Passo 2: lanciarle e vederle fallire**

```
deno test supabase/functions/richieste/arrivi.test.ts --allow-read --allow-env
```

- [ ] **Passo 3: scrivere la regola**

In `supabase/functions/richieste/arrivi.ts`:

```ts
/** Se questa richiesta si puo' portare allo stato «chiusa». */
export function puoChiudere(riga: Riga): { ok: boolean; perche?: string } {
  if (String(riga?.tipo ?? '') !== 'arrivo') return { ok: true };
  const d = (riga.dati && typeof riga.dati === 'object')
    ? riga.dati as Record<string, unknown> : {};
  const persone = Array.isArray(d.persone_extra) ? d.persone_extra : [];
  if (persone.length === 0 || d.persone_confermate === true) return { ok: true };
  return {
    ok: false,
    perche: 'ci sono persone da aggiungere in attesa di risposta: ' +
      'confermi disponibilita e prezzo prima di chiudere',
  };
}
```

- [ ] **Passo 4: usarla nell'azione `stato`**

In `index.ts`, dentro `if (azione === 'stato')`, cambiare la `select` per
prendere anche `dati` e aggiungere il controllo subito dopo `puoToccare`:

```ts
    const { data: chi } = await db.from('richiesta_sito')
      .select('tipo, dati').eq('numero', numero).maybeSingle();
    // …
    if (nuovo === 'chiusa') {
      const c = puoChiudere(chi);
      if (!c.ok) return risposta({ errore: c.perche }, 409);
    }
```

- [ ] **Passo 5: lanciare tutto e controllare i tipi**

```
deno check supabase/functions/richieste/index.ts
deno test --allow-read --allow-env
```

- [ ] **Passo 6: commit**

```bash
git add supabase/functions/richieste/arrivi.ts supabase/functions/richieste/arrivi.test.ts \
        supabase/functions/richieste/index.ts
git commit -m "Chi aspetta una risposta sulle persone da aggiungere non si perde"
```

---

## Task 8: La pagina d'arrivo cambia porta

**File:**
- Modificare: `pagine/index.html`
- Modificare: `supabase/functions/prepara-arrivo/index.ts` (togliere il `POST`)
- Creare: `pagine/arrivo.test.ts`

**Interfacce:**
- Consuma: `LUOGHI_ATAM` da `/comune/luoghi.js` (Task 1); l'azione `?a=invia-arrivo` (Task 5)
- Produce: il corpo che `pezziDaArrivo` si aspetta — `transfer_dati` e
  `fattura_dati` annidati, `attenzioni` come chiavi

- [ ] **Passo 1: scrivere le prove che devono fallire**

`pagine/arrivo.test.ts`:

```ts
/* ============================================================
   arrivo.test.ts — la pagina del check-in online.

   Non si esegue una pagina intera senza browser, ma tre cose si possono
   provare cosi', e sono le tre che si rompono in silenzio:
   il copione dev'essere leggibile (un apice inverso chiuso male apre la
   pagina bianca), il luogo dev'essere un elenco e non una casella libera,
   e la porta dev'essere quella nuova.
   ============================================================ */
import { assert } from 'jsr:@std/assert';

const SORGENTE = Deno.readTextFileSync(new URL('index.html', import.meta.url));

Deno.test('il copione si legge senza errori di sintassi', () => {
  const m = SORGENTE.match(/<script type="module">([\s\S]*)<\/script>/);
  assert(m, 'lo <script type="module"> non si trova');
  const corpo = m![1].split('\n').filter((r) => !/^\s*import\s/.test(r)).join('\n');
  assert(corpo.length > 5000, `corpo di sole ${corpo.length} lettere: la prova gira a vuoto`);
  new Function(corpo);
});

/* Era una casella di testo da 40 caratteri, e l'ospite ci scriveva
   "Venezia": nessuna delle sue varianti e' una voce ATAM, e la reception
   doveva cercarla a mano fra 189. */
Deno.test('il luogo del transfer e un elenco, non una casella libera', () => {
  assert(SORGENTE.includes('/comune/luoghi.js'), 'la pagina non importa i luoghi');
  assert(!/id="trScalo"[^>]*type="text"/.test(SORGENTE),
    'il luogo e ancora una casella di testo libera');
});

Deno.test('la pagina manda al nuovo indirizzo', () => {
  assert(SORGENTE.includes('a=invia-arrivo'), 'la pagina scrive ancora su prepara-arrivo');
});

/* Le attenzioni si mandano come chiavi: il testo tradotto in back office
   andrebbe letto da chi aveva davanti un'altra lingua. E' la stessa scelta
   gia' presa per il desiderio dei fanghi. */
Deno.test('le attenzioni partono come chiavi, non come testo tradotto', () => {
  assert(/'culla'\s*,\s*'seggiolone'\s*,\s*'parcheggio'\s*,\s*'cane'/.test(SORGENTE),
    'le chiavi delle attenzioni non si trovano nella pagina');
});
```

- [ ] **Passo 2: lanciarle e vederle fallire**

```
deno test pagine/arrivo.test.ts --allow-read --allow-env
```

- [ ] **Passo 3: cambiare la sezione transfer della pagina**

Al posto di `trScalo` (casella libera) e `trQuando` (un solo campo
data-e-ora), i campi del modulo del sito. **`trScalo` sparisce**: il suo
valore non passerebbe `luogoValido()` e la richiesta verrebbe rifiutata.

```html
<label>${t.trLuogo}</label>
<select id="trLuogo"></select>

<label>${t.trQuando}</label>
<input type="date" id="trQuando" />
<label>${t.trOra}</label>
<input type="time" id="trOra" />

<label>${t.trVolo}</label>
<input type="text" id="trVolo" maxlength="40" />
<label>${t.trPax}</label>
<input type="number" id="trPax" min="1" max="8" />
<label>${t.trCell}</label>
<input type="tel" id="trCell" maxlength="30" />
```

e il riempimento del `<select>`, accanto agli altri import:

```js
import { LUOGHI_ATAM } from '/comune/luoghi.js';

/* Le voci NON si traducono e NON si riordinano: la reception le ricopia
   nel modulo dei tassisti, e devono combaciare parola per parola. E'
   anche il motivo per cui questa e' una <select> e non piu' una casella
   di testo: "Venezia", "aeroporto di Venezia" e "VCE" non sono nessuna
   delle 189 voci. */
document.getElementById('trLuogo').innerHTML =
  '<option value=""></option>' + LUOGHI_ATAM.map((l) =>
    `<option value="${l.replace(/"/g, '&quot;')}">${l}</option>`).join('');
```

Le quattro tabelle di testi in cima alla pagina (`T.it`, `T.de`, `T.en`,
`T.fr`) vogliono le etichette nuove — `trLuogo`, `trOra`, `trPax` — e
perdono `trScalo`. Una lingua dimenticata si vede subito: l'etichetta
esce `undefined`.

- [ ] **Passo 4: cambiare l'invio**

```js
const corpo = {
  token: TOKEN,
  ora_arrivo: v('ora'), mezzo: v('mezzo'),
  attenzioni: [...document.querySelectorAll('.extra:checked')]
    .map(c => ['culla','seggiolone','parcheggio','cane'][+c.dataset.i]),
  fanghi_desiderio: (()=>{ const s = document.querySelector('.fanghi:checked');
    return s ? ['presto','tardi','indifferente'][+s.dataset.i] : null; })(),
  persone_extra: [...document.querySelectorAll('.persona')].map(p => ({
    nome: p.children[0].value.trim(), eta: p.children[1].value.trim()
  })).filter(p => p.nome),
  note: v('note'),
  transfer: tr,
  transfer_dati: tr ? {
    verso: v('trTipo'), luogo: v('trLuogo'), quando: v('trQuando'), ora: v('trOra'),
    pax: Number(v('trPax')) || 1, volo: v('trVolo'), cell: v('trCell')
  } : null,
  fattura: fatt,
  fattura_dati: fatt ? {
    ragione: v('fRagione'), indirizzo: v('fIndirizzo'), piva: v('fPiva'),
    cf: v('fCf'), sdi: v('fSdi'), pec: v('fPec')
  } : null
};
const r = await fetch(`${FUNZIONE_RICHIESTE}?a=invia-arrivo`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(corpo)
});
```

Il messaggio d'errore che arriva dal server (`errore`) va **mostrato**: è
lui che dice «luogo non in elenco» o «serve la partita IVA o il codice
fiscale», e nasconderlo lascerebbe l'ospite davanti a un rifiuto muto.

- [ ] **Passo 5: lo stato «già inviato»**

Se il server risponde `409` con `{ errore: 'gia inviato', richieste: [...] }`,
la pagina mostra i numeri già ricevuti e la frase «per cambiare qualcosa ci
scriva», in tutte e quattro le lingue. Non un errore rosso: è una cosa
normale, ed è successo perché l'ospite ha ricaricato.

- [ ] **Passo 6: togliere il `POST` da `prepara-arrivo`**

Cancellare il blocco `if (req.method === 'POST')` (l'insert in
`arrivo_richiesta` e l'email a mano). Restano la lettura del link e
`?action=crea`. Le prove esistenti di quella funzione che riguardano il
`POST` vanno tolte insieme al codice che provavano: una prova che resta
verde perché non prova più niente è peggio di nessuna prova.

- [ ] **Passo 7: lanciare tutto**

```
deno check supabase/functions/prepara-arrivo/index.ts
deno test --allow-read --allow-env
```

- [ ] **Passo 8: commit**

```bash
git add pagine/index.html pagine/arrivo.test.ts supabase/functions/prepara-arrivo/index.ts
git commit -m "Il check-in online passa dalla porta delle richieste"
```

---

## Task 9: La scheda «Arrivi» legge le richieste

**File:**
- Modificare: `supabase/functions/richieste/index.ts` (azione `arrivi`)
- Modificare: `supabase/functions/richieste/arrivi.ts`
- Modificare: `pagine/buoni/index.html` (`vistaArrivi`)
- Test: `supabase/functions/richieste/arrivi.test.ts` (esistente, si aggiunge)

**Interfacce:**
- Consuma: `perRuolo(riga, ruolo, conChiave)` e `CAMPI_SPA` da `arrivi.ts`
  (la scheda piatta dell'arrivo, invariata); `tipiVisibili` e `vedeTutto` da
  `ruoli.ts`
- Produce: `richiestePerRuolo(richieste, ruolo, conChiave): Riga[]` in
  `arrivi.ts`, e la risposta di `?a=arrivi` con, per ogni ospite, la sua
  scheda e le sue richieste

- [ ] **Passo 1: scrivere le prove che devono fallire**

```ts
/* ============================================================
   L'ARRIVO ADESSO E' FATTO DI RICHIESTE.

   Fino a ieri la scheda leggeva arrivo_richiesta. Adesso legge le
   richieste che portano il token della prenotazione — ma le righe gia'
   scritte nella vecchia tabella devono continuare a vedersi finche' quegli
   arrivi non sono passati: non si migra niente, e un ospite che ha
   compilato la settimana scorsa non deve sparire dalla schermata.
   ============================================================ */
const RICHIESTE = [
  { numero: 'C26/19130', tipo: 'arrivo', dati: { ora_arrivo: '16:30' } },
  { numero: 'C26/19131', tipo: 'transfer', dati: { luogo: 'Venezia  aeroporto' } },
  { numero: 'C26/19132', tipo: 'fattura', dati: { ragione: 'Bianchi S.r.l.', piva: 'IT02042330288' } },
  { numero: 'C26/19133', tipo: 'trattamenti', dati: { voci: ['Massaggio antistress'] } },
];

Deno.test('l elenco di prova non e vuoto', () => {
  assert(RICHIESTE.length >= 4, 'la prova girerebbe a vuoto');
});

Deno.test('la reception vede tutte le richieste di un arrivo', () => {
  assertEquals(richiestePerRuolo(RICHIESTE, 'reception', false).length, RICHIESTE.length);
  assertEquals(richiestePerRuolo(RICHIESTE, null, true).length, RICHIESTE.length);
});

/* La spa vede quello che vede gia' nell'elenco delle richieste, e non altro:
   la regola e' quella di ruoli.ts, non una seconda scritta qui. */
Deno.test('la spa vede solo le sue', () => {
  const suoi = richiestePerRuolo(RICHIESTE, 'spa', false);
  assertEquals(suoi.map((r) => r.tipo), ['trattamenti']);
});

/* Il controllo forte, come quello di ieri: non «manca il campo», ma quella
   stringa non compare da nessuna parte in quello che parte. */
Deno.test('alla spa la fatturazione non arriva in nessuna forma', () => {
  const tutto = JSON.stringify(richiestePerRuolo(RICHIESTE, 'spa', false));
  assert(!tutto.includes('IT02042330288'), 'la partita IVA e nella risposta');
  assert(!tutto.includes('Venezia'), 'il transfer di un altro reparto e nella risposta');
});

/* E il desiderio dei fanghi continua ad arrivarle dalla SCHEDA dell'arrivo,
   che e' piatta e passa da CAMPI_SPA: e' il dato che le serve, senza la
   fatturazione che gli sta accanto. */
Deno.test('ma la scheda dell arrivo le porta ancora i fanghi', () => {
  const r = perRuolo({
    intestatario: 'Bianchi Maria', data_arrivo: '2026-09-12',
    ora_arrivo: '16:30', fanghi_desiderio: 'presto',
  }, 'spa', false);
  assert(r);
  assertEquals(r.fanghi_desiderio, 'presto');
});
```

- [ ] **Passo 2: lanciarle e vederle fallire**

```
deno test supabase/functions/richieste/arrivi.test.ts --allow-read --allow-env
```

- [ ] **Passo 3: adattare `perRuolo` alla forma nuova**

`CAMPI_SPA` filtra i campi di una riga piatta e resta com'è per i dati
della **prenotazione** (intestatario, date, adulti, bambini, cure). Quello
che si aggiunge è la regola per le **richieste**, che non sono piatte: il
contenuto sta in `dati`, e a decidere è il tipo.

```ts
/* ============================================================
   QUALI RICHIESTE DI UN ARRIVO PUO' VEDERE CHI GUARDA.

   Una riga piatta si filtra campo per campo (CAMPI_SPA). Una richiesta no:
   o la si vede o non la si vede, e a deciderlo e' il tipo — che e'
   esattamente la domanda a cui ruoli.ts risponde gia' per l'elenco delle
   richieste. Qui non si riscrive: si chiama.

   Percio' la spa vede la richiesta `arrivo`? NO. Vede solo trattamenti e
   Day Spa, come sullo schermo delle richieste. Il desiderio dei fanghi le
   arriva dalla SCHEDA dell'arrivo (CAMPI_SPA, che lo contiene), non dalla
   richiesta: e' il dato che le serve, senza la fatturazione che le sta
   accanto.
   ============================================================ */
export function richiestePerRuolo(
  richieste: Riga[],
  ruolo: Ruolo | null,
  conChiave: boolean,
): Riga[] {
  if (conChiave || vedeTutto(ruolo)) return richieste;
  const suoi = tipiVisibili(ruolo);
  return richieste.filter((r) => suoi.includes(String(r.tipo ?? '')));
}
```

e in `CAMPI_SPA` il desiderio dei fanghi c'è già: la scheda dell'arrivo lo
porta come oggi. Cambia solo dove il server lo prende — dalla richiesta
`arrivo` invece che da `arrivo_richiesta` — e questo succede nel passo 4.

- [ ] **Passo 4: cambiare l'azione `arrivi`**

Al posto della lettura di `arrivo_richiesta`, leggere le richieste con quel
token:

```ts
      const { data: ric } = await db.from('richiesta_sito')
        .select('*').in('arrivo_token', token);
```

e **tenere** la lettura della vecchia tabella, con un commento che dice
perché e fino a quando:

```ts
      /* LE RIGHE VECCHIE. Chi ha compilato prima del cambio ha i suoi dati
         in arrivo_richiesta e non in una richiesta: non si migra niente —
         inventare numeri a posteriori sarebbe rischio in cambio di niente —
         ma finche' quegli arrivi non sono passati devono vedersi. Quando la
         data d'arrivo piu' lontana fra quelle righe e' alle spalle, questa
         lettura si puo' togliere. */
```

- [ ] **Passo 5: cambiare la scheda in `pagine/buoni/index.html`**

Nella riga di ogni ospite, sotto la scheda dell'arrivo, le sue richieste.
Etichetta e riepilogo **arrivano già pronti dal server**
(`arricchisciElenco`): la pagina non li ricalcola, o sarebbero due
scritture della stessa regola.

```js
/* Le richieste di questo ospite, col numero: e' quello che si cerca
   nella scheda «Richieste dal sito» per rispondere. Qui non si
   risponde e non si chiude: questa schermata e' in sola lettura. */
const righeRichieste = (a) => !a.richieste?.length ? '' :
  `<div class="mini" style="padding-top:6px;">` + a.richieste.map((r) =>
    `<div><span class="badge-tipo">${esc(r.etichetta)}</span> <span class="cod">${esc(r.numero)}</span> ${esc(r.riepilogo || '')}` +
    `${r.stato && r.stato !== 'chiusa' ? '' : ' \u00b7 chiusa'}</div>`
  ).join('') + `</div>`;
```

e la si chiama dentro la cella «Altro» della tabella già esistente,
accanto alle note. **Il pulsante per rispondere non ci va**: si risponde
dalla scheda «Richieste dal sito», che è dove la conferma e il prezzo
vivono già. Due posti dove rispondere sarebbero due macchine da tenere
allineate.

- [ ] **Passo 6: lanciare tutto**

```
deno check supabase/functions/richieste/index.ts
deno test --allow-read --allow-env
```

- [ ] **Passo 7: commit**

```bash
git add supabase/functions/richieste/index.ts supabase/functions/richieste/arrivi.ts \
        supabase/functions/richieste/arrivi.test.ts pagine/buoni/index.html
git commit -m "La scheda Arrivi legge le richieste, e le righe vecchie finche ci sono"
```

---

## Prima di pubblicare

- [ ] **Creare `EMAIL_SPA`** nelle variabili del progetto, con
      `spa@termeleonardo.com`. Senza, la copia alla spa non parte: il codice
      lo scrive nel registro, ma nessuno guarda il registro.
- [ ] `spa@termeleonardo.com` **conferma la sua email**, altrimenti non può
      entrare in back office a vedere quello che riceve.
- [ ] Pubblicare le funzioni:
      `node strumenti/pubblica.js richieste` e
      `node strumenti/pubblica.js prepara-arrivo`
      (serve un token valido in `C:\Users\admin\token-supabase.txt`).
- [ ] `git push origin main` per le pagine.
- [ ] **Una prova vera con un arrivo finto**: creare un link d'arrivo con
      un intestatario che dice di essere una prova, compilarlo, controllare
      che nascano le richieste giuste, che arrivi **una** ricevuta e che la
      scheda «Arrivi» le mostri. Poi cancellare le righe. **Mai su un
      ospite vero.**

## Cosa questo piano non fa, apposta

- Nessuna migrazione dello storico.
- Nessun tipo nuovo per le persone da aggiungere.
- Nessuna modifica ai moduli del sito, oltre a far loro importare l'elenco
  dei luoghi invece di riscriverlo.
- I pulsanti fuori dalle email di offerta: lavoro separato e indipendente.
