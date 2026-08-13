# Promozionali, stampa bozza e logo vero — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** La reception può emettere buoni promozionali (omaggio, nessun incasso) e stampare l'anteprima marcata BOZZA prima del pagamento; tutte le superfici del buono usano il logo vero dell'hotel al posto della riproduzione tipografica.

**Architecture:** Tre interventi indipendenti sullo stesso back office più una riga nella Edge Function. Il logo diventa un asset condiviso (`pagine/buoni/img/logo.svg` per web e stampa, `logo.png` per le email, perché Gmail e Outlook scartano l'SVG). La regola "quali pagamenti nascono già pagati" viene estratta in una funzione pura testata.

**Tech Stack:** HTML/JS statico (back office e pagina pubblica), Deno + test (Edge Function), sharp per generare il PNG dal SVG.

## Global Constraints

- Il logo nero (`_G`) va su fondi chiari, il bianco (`_W`) su fondi scuri: è l'uso previsto dal kit dell'hotel. **Nessuna ricolorazione** del marchio.
- Nelle email solo PNG: `https://arrivo-terme-leonardo.vercel.app/buoni/img/logo.png`, larghezza di resa 150px (il file è 450px per la nitidezza su schermi retina).
- Il buono promozionale è **solo** back office: `a=acquista` forza `pagamento:'stripe'` e `a=crea` richiede autenticazione. Non toccare questa proprietà.
- Chi riceve il buono non deve vedere che è un omaggio: sul buono stampato e spedito nulla cambia.
- Scadenza dei promozionali: 12 mesi, come tutti gli altri.
- Deno: `C:\Users\admin\AppData\Local\Microsoft\WinGet\Packages\DenoLand.Deno_Microsoft.Winget.Source_8wekyb3d8bbwe\deno.exe` (non in PATH).
- La funzione `buoni` non si autodeploya col push: serve la Management API col token dell'utente.

---

### Task 1: Asset del logo nel repo

**Files:**
- Create: `pagine/buoni/img/logo.svg` (nero, ritagliato al contenuto), `pagine/buoni/img/logo-bianco.svg`, `pagine/buoni/img/logo-quadrato.svg` (originale intatto), `pagine/buoni/img/logo.png` (450px, per le email)

**Interfaces:**
- Produces: `…/buoni/img/logo.svg` e `…/buoni/img/logo.png`, usati dai Task 2 e 3.

- [x] **Step 1: SVG ritagliato** — l'originale è un quadrato 283×283 con il marchio nella sola fascia centrale; il viewBox va portato al contenuto (`33 111 216.5 61`), altrimenti nel buono il logo esce minuscolo.

- [x] **Step 2: PNG per le email** a 450px di larghezza, da SVG a densità 900.

- [x] **Step 3: Controllo visivo** a 150px sul fondo `#E4F0EA` del buono: marchio leggibile, "TERME HOTEL" e le quattro stelle distinguibili.

- [ ] **Step 4: Commit**

```bash
cd /c/Users/admin/termeleonardo-infra
git add pagine/buoni/img/ && git commit -m "Logo dell'hotel: SVG ritagliato per web e stampa, PNG per le email"
```

---

### Task 2: Il logo vero al posto della riproduzione tipografica

Cinque punti usano `LE<strong>ONARDO</strong>` seguito da `TERME HOTEL ★★★★`. La riproduzione è infedele: nel logo vero le lettere hanno tutte lo stesso peso, "TERME HOTEL" sta su una riga sotto e le stelle su una terza, il tutto centrato.

**Files:**
- Modify: `supabase/functions/buoni/email-buono.ts` (~riga 96, email)
- Modify: `pagine/buoni/index.html` (~848 anteprima email, ~966 stampa A4 `.marchio-s`, ~114 testata del back office)
- Modify: `pagine/buoni/regala/index.html` (~68 testata della pagina, ~250 anteprima)

**Interfaces:**
- Consumes: gli asset del Task 1.

- [ ] **Step 1: Email** (`email-buono.ts`) — sostituire il blocco marchio + stelle con:

```html
<img src="https://arrivo-terme-leonardo.vercel.app/buoni/img/logo.png" width="150" alt="Hotel Terme Leonardo" style="display:block;width:150px;height:auto;border:0;" />
```

- [ ] **Step 2: Anteprima email nel back office** (`index.html` ~848) — stesso `<img>` del passo 1, così l'anteprima mostra esattamente quello che riceverà il cliente.

- [ ] **Step 3: Stampa A4** (`index.html` ~966) — l'SVG, che in stampa resta nitido:

```html
<img class="marchio-s" src="img/logo.svg" alt="Hotel Terme Leonardo" />
```
con la regola CSS `#stampa .marchio-s{display:block;width:46mm;height:auto;}` al posto di quella tipografica esistente.

- [ ] **Step 4: Anteprima della pagina pubblica** (`regala/index.html` ~250) — `<img src="../img/logo.svg" style="display:block;width:150px;height:auto;" />` (attenzione al percorso relativo: la pagina sta in `/buoni/regala/`).

- [ ] **Step 5: Testate delle due pagine** — back office (`index.html` ~114) e pagina pubblica (`regala/index.html` ~68): il logo al posto del testo, dimensionato per la testata.

- [ ] **Step 6: Verifica** — nessun `LE<strong>ONARDO</strong>` residuo:

```bash
grep -n "LE<strong>ONARDO" pagine/buoni/index.html pagine/buoni/regala/index.html supabase/functions/buoni/email-buono.ts
```
Expected: nessun risultato. Poi controllo visivo delle pagine aperte nel browser.

- [ ] **Step 7: Commit**

---

### Task 3: Buoni promozionali — la funzione (TDD)

**Files:**
- Create: `supabase/functions/buoni/pagamenti.ts`
- Create: `supabase/functions/buoni/pagamenti.test.ts`
- Modify: `supabase/functions/buoni/index.ts` (riga con `const subito = [...]`)

**Interfaces:**
- Produces: `export function nasceGiaPagato(pagamento: unknown): boolean` — vero per i pagamenti senza attesa (contanti, bancomat, pos, promozionale).

- [ ] **Step 1: Test che falliscono** (`pagamenti.test.ts`)

```ts
import { assertEquals } from 'jsr:@std/assert';
import { nasceGiaPagato } from './pagamenti.ts';

Deno.test('i pagamenti incassati in reception emettono subito il codice', () => {
  for (const p of ['contanti', 'bancomat', 'pos']) assertEquals(nasceGiaPagato(p), true, p);
});

Deno.test('il promozionale nasce già valido: è un omaggio, non c\u2019è nulla da incassare', () => {
  assertEquals(nasceGiaPagato('promozionale'), true);
});

Deno.test('bonifico e link restano in attesa del pagamento', () => {
  for (const p of ['bonifico', 'stripe']) assertEquals(nasceGiaPagato(p), false, p);
});

Deno.test('un pagamento mancante o sconosciuto non emette nulla', () => {
  for (const p of [null, undefined, '', 'chissà']) assertEquals(nasceGiaPagato(p), false, String(p));
});
```

- [ ] **Step 2: Verifica che falliscano**

```bash
DENO="/c/Users/admin/AppData/Local/Microsoft/WinGet/Packages/DenoLand.Deno_Microsoft.Winget.Source_8wekyb3d8bbwe/deno.exe"
cd /c/Users/admin/termeleonardo-infra/supabase/functions/buoni && "$DENO" test --allow-env pagamenti.test.ts
```
Expected: FAIL — modulo inesistente.

- [ ] **Step 3: Implementa** (`pagamenti.ts`)

```ts
/* Quali pagamenti fanno nascere il buono già valido, col suo codice.
   'promozionale' è l'omaggio deciso in reception: non c'è incasso da
   attendere, quindi il buono è spendibile da subito. */
const SENZA_ATTESA = ['contanti', 'bancomat', 'pos', 'promozionale'];
export function nasceGiaPagato(pagamento: unknown): boolean {
  return SENZA_ATTESA.includes(String(pagamento ?? ''));
}
```

- [ ] **Step 4: Verifica verde** (stesso comando dello Step 2, poi tutta la cartella)

- [ ] **Step 5: Usala in `index.ts`** — importare `nasceGiaPagato` da `./pagamenti.ts` e sostituire

```ts
const subito = ['contanti', 'bancomat', 'pos'].includes(String(b.pagamento || ''));
```
con
```ts
const subito = nasceGiaPagato(b.pagamento);
```

- [ ] **Step 6: `deno check index.ts`** — Expected: nessun errore.

- [ ] **Step 7: Commit**

---

### Task 4: Buoni promozionali — il back office

**Files:**
- Modify: `pagine/buoni/index.html` (select `#fPag` ~324, `aggPag()` ~422, riga dell'elenco ~1030, CSS)

**Interfaces:**
- Consumes: il valore `promozionale` accettato dalla funzione (Task 3).

- [ ] **Step 1: La voce nel menu** — gruppo a sé, perché non è un incasso:

```html
<optgroup label="Omaggio (nessun incasso)">
  <option value="promozionale">Promozionale</option>
</optgroup>
```
da inserire fra il gruppo "Incassato adesso in reception" e "Da pagare".

- [ ] **Step 2: La nota sotto il menu** — `aggPag()` distingue tre casi invece di due:

```js
const aggPag = () => {
  const v = $('fPag').value;
  const daPagare = ['bonifico', 'stripe'].includes(v);
  $('notaPag').innerHTML = daPagare
    ? 'Il buono nasce <strong>in attesa di pagamento</strong>: si genera l\u2019anteprima da mandare al cliente, ' +
      'e il codice spendibile esce solo quando registri l\u2019incasso.'
    : v === 'promozionale'
      ? 'Omaggio: <strong>nessun incasso</strong>. Il buono viene emesso subito ed \u00e8 spendibile come tutti gli altri; ' +
        'nell\u2019elenco resta segnato come promozionale.'
      : 'Incasso immediato: il buono viene <strong>emesso subito</strong>, pronto da stampare o inviare.';
  $('fCrea').textContent = daPagare ? 'Prepara il buono (in attesa)' : 'Emetti il buono';
};
```

- [ ] **Step 3: L'etichetta nell'elenco** — nella cella del valore, al posto di `<div class="mini">${esc(b.pagamento || '')}</div>`:

```js
<div class="mini">${b.pagamento === 'promozionale'
  ? '<span class="omaggio">promozionale</span>' : esc(b.pagamento || '')}</div>
```
con il CSS accanto alle altre classi di stato:

```css
.omaggio{display:inline-block;padding:1px 7px;border-radius:9px;background:#FBF3DF;
color:#8A6D1F;border:1px solid #E4CE93;font-size:11px;letter-spacing:.3px;}
```

- [ ] **Step 4: Verifica** — aprire la pagina: scegliendo Promozionale la nota cambia e il pulsante resta "Emetti il buono"; nell'elenco un buono promozionale mostra l'etichetta oro.

- [ ] **Step 5: Commit**

---

### Task 5: Stampa dell'anteprima marcata BOZZA

Oggi `bStampa` esiste solo per i buoni già pagati (`index.html` ~588); `buonoStampaHTML(b, bozza)` accetta già il parametro ma viene sempre chiamata senza.

**Files:**
- Modify: `pagine/buoni/index.html` (CSS di stampa, `buonoStampaHTML`, pannello anteprima ~352, azioni del buono in attesa ~569)

- [ ] **Step 1: La fascia BOZZA nel foglio** — dentro `buonoStampaHTML`, quando `bozza` è vero, una banda ben visibile sopra il buono:

```js
${bozza ? `<div class="bozza-avviso">BOZZA &middot; NON VALIDO &middot; il codice viene assegnato al pagamento</div>` : ''}
```
con il CSS:

```css
#stampa .bozza-avviso{position:absolute;top:0;left:0;right:0;z-index:2;
background:#8A6D1F;color:#FFFFFF;text-align:center;
font:9px/1 Arial,Helvetica,sans-serif;letter-spacing:3px;padding:3mm 0;}
```

- [ ] **Step 2: Il pulsante accanto all'anteprima dal vivo** — nell'intestazione del pannello (~352):

```html
<button type="button" class="mini-azione" id="antStampa">Stampa anteprima</button>
```
e il gestore, accanto a `aggiornaAnteprima`:

```js
$('antStampa').onclick = () => {
  $('stampa').innerHTML = buonoStampaHTML(buonoProvvisorio(), true);
  window.print();
};
```

- [ ] **Step 3: Il pulsante sul buono in attesa** — nel ramo che oggi mostra solo link Stripe, copia-email e "Ho ricevuto il pagamento" (~569), aggiungere un pulsante `bStampaBozza`:

```js
$('bStampaBozza').onclick = () => { $('stampa').innerHTML = buonoStampaHTML(b, true); window.print(); };
```
(il markup del pulsante va accanto agli altri di quel ramo)

- [ ] **Step 4: Verifica** — anteprima di stampa (Ctrl+P) dalla pagina: la bozza mostra la fascia BOZZA e il codice a trattini; il buono già pagato stampa **senza** la fascia e col codice vero.

- [ ] **Step 5: Commit e push**

---

### Task 6: Pubblicazione

- [ ] **Step 1: Test e controlli** — `deno test --allow-env .` verde; `grep` del logo tipografico senza risultati; sintassi JS delle due pagine valida (estrarre lo `<script>` e `node --check`).

- [ ] **Step 2: Push** del repo infra (Vercel ricostruisce le pagine da solo).

- [ ] **Step 3: Redeploy della funzione** — chiedere all'utente un token Supabase nuovo, poi:

```bash
cd /c/Users/admin/termeleonardo-infra/supabase/functions/buoni
curl -sS -w "\nHTTP %{http_code}\n" -X POST "https://api.supabase.com/v1/projects/mvuiuwakuseockotlcnp/functions/deploy?slug=buoni" \
  -H "Authorization: Bearer <TOKEN>" \
  -F 'metadata={"name":"buoni","entrypoint_path":"index.ts","verify_jwt":false};type=application/json' \
  -F 'file=@index.ts;type=application/typescript' \
  -F 'file=@acquista.ts;type=application/typescript' \
  -F 'file=@email-buono.ts;type=application/typescript' \
  -F 'file=@pagamenti.ts;type=application/typescript' \
  -F 'file=@deno.json;type=application/json'
```
⚠️ `pagamenti.ts` è un file nuovo: dimenticarlo nel deploy fa fallire l'import e la funzione va giù.

- [ ] **Step 4: Smoke test** — `a=verifica`, `a=acquista` con valore 5, webhook senza firma: rispettivamente 404/400/400. Foto e logo serviti con 200.

- [ ] **Step 5: Ricordare all'utente di revocare il token.**

## Self-Review

- **Copertura**: promozionali (Task 3 funzione + Task 4 interfaccia), stampa bozza (Task 5), logo ovunque (Task 1+2), pubblicazione (Task 6). Scadenza 12 mesi: nessuna modifica, è già il default di `a=crea`. ✔
- **Placeholder**: solo `<TOKEN>`, che arriva dall'utente. ✔
- **Coerenza**: `nasceGiaPagato` unica firma, usata in un punto solo; il PNG del logo per le email e l'SVG per web/stampa non si sovrappongono. ✔
- **Rischio segnalato**: il file nuovo `pagamenti.ts` deve entrare nel deploy (Task 6 Step 3). ✔
