# Foto sui buoni + acquisto dal sito nuovo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Il buono regalo mostra una foto vera dell'hotel diversa per tipo (trattamenti / Day Spa / valore) su email, back office e pagina pubblica; il sito nuovo linka la pagina di acquisto.

**Architecture:** Tre foto ritagliate e committate in `pagine/buoni/img/` (servite da arrivo-terme-leonardo.vercel.app). Una regola di scelta unica (`tipo`/`voce_id` → URL foto) replicata nelle tre superfici standalone; nella Edge Function è una funzione esportata coperta da test Deno. Il sito nuovo cambia solo il CTA della sezione regali.

**Tech Stack:** PowerShell System.Drawing (crop), Deno test, HTML email (tabelle), Supabase Management API (redeploy funzione), React/CRA (sito nuovo).

## Global Constraints

- Foto servite SOLO da `https://arrivo-terme-leonardo.vercel.app/buoni/img/…` (mai hotlink a termeleonardo.com — spec: le email vivono 12 mesi).
- Regola foto (verbatim dalla spec): `tipo==='valore'` → panorama; `voce_id` inizia per `dayspa` → piscina; altro servizio → collage fango; fallback (voce_id nullo o "altro") → panorama.
- Logo: NESSUNA modifica, resta tipografico.
- Deno: `C:\Users\admin\AppData\Local\Microsoft\WinGet\Packages\DenoLand.Deno_Microsoft.Winget.Source_8wekyb3d8bbwe\deno.exe` (non in PATH).
- Repo infra: `C:\Users\admin\termeleonardo-infra` (push su main = deploy Vercel pagine).
- La funzione `buoni` NON si autodeploya col push: serve la Management API col token utente.

---

### Task 1: Le tre foto ritagliate nel repo

**Files:**
- Create: `pagine/buoni/img/trattamenti.jpg`, `pagine/buoni/img/dayspa.jpg`, `pagine/buoni/img/valore.jpg`

**Interfaces:**
- Produces: le tre URL `https://arrivo-terme-leonardo.vercel.app/buoni/img/{trattamenti,dayspa,valore}.jpg` usate dai Task 2–4.

- [ ] **Step 1: Scarica gli originali** (se non già in scratchpad)

```bash
cd /c/Users/admin/AppData/Local/Temp/claude/C--Users-admin/8c01527e-7c85-4075-bcf4-8f97ce973702/scratchpad
for f in outdoor-pool-hotel-leonardo-da-vinci-terme.jpg dolce-vita-mud-offer.jpg view-hotel-leonardo-da-vinci-terme.jpg; do
  [ -f "$f" ] || curl -sL -O "https://www.termeleonardo.com/img/$f"; done
```

- [ ] **Step 2: Ritaglia al formato del riquadro (rapporto 1.4533, crop centrato, JPEG q85)** — PowerShell:

```powershell
Add-Type -AssemblyName System.Drawing
function Ritaglia($src, $dst, $ratio = 1.4533) {
  $img = [System.Drawing.Image]::FromFile($src)
  $w = $img.Width; $h = $img.Height
  if ($w / $h -gt $ratio) { $nw = [int]($h * $ratio); $nh = $h } else { $nw = $w; $nh = [int]($w / $ratio) }
  $x = [int](($w - $nw) / 2); $y = [int](($h - $nh) / 2)
  $bmp = New-Object System.Drawing.Bitmap($nw, $nh)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.DrawImage($img, (New-Object System.Drawing.Rectangle(0,0,$nw,$nh)), (New-Object System.Drawing.Rectangle($x,$y,$nw,$nh)), [System.Drawing.GraphicsUnit]::Pixel)
  $enc = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object MimeType -eq 'image/jpeg'
  $p = New-Object System.Drawing.Imaging.EncoderParameters(1)
  $p.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]85)
  $bmp.Save($dst, $enc, $p); $g.Dispose(); $bmp.Dispose(); $img.Dispose()
}
$sc = "C:\Users\admin\AppData\Local\Temp\claude\C--Users-admin\8c01527e-7c85-4075-bcf4-8f97ce973702\scratchpad"
$out = "C:\Users\admin\termeleonardo-infra\pagine\buoni\img"
New-Item -ItemType Directory -Force $out | Out-Null
Ritaglia "$sc\dolce-vita-mud-offer.jpg"                        "$out\trattamenti.jpg"
Ritaglia "$sc\outdoor-pool-hotel-leonardo-da-vinci-terme.jpg"  "$out\dayspa.jpg"
Ritaglia "$sc\view-hotel-leonardo-da-vinci-terme.jpg"          "$out\valore.jpg"
Get-ChildItem $out | Select-Object Name, Length
```

- [ ] **Step 3: Verifica visiva** — Read dei 3 jpg: soggetto integro dopo il crop (collage non decapitato, piscina e panorama riconoscibili), peso < 200 KB l'uno.

- [ ] **Step 4: Commit e push** (le pagine Vercel si aggiornano da sole)

```bash
cd /c/Users/admin/termeleonardo-infra
git add pagine/buoni/img/ && git commit -m "Buoni: le tre foto del buono (trattamenti, dayspa, valore)" && git push origin main
```

- [ ] **Step 5: Verifica che Vercel le serva** (attendere ~1 min dopo il push)

```bash
for n in trattamenti dayspa valore; do curl -sI "https://arrivo-terme-leonardo.vercel.app/buoni/img/$n.jpg" | head -1; done
```
Expected: tre `HTTP/2 200`.

---

### Task 2: `fotoBuono()` nella Edge Function (TDD) + foto nell'email

**Files:**
- Modify: `supabase/functions/buoni/email-buono.ts`
- Test: `supabase/functions/buoni/email-buono.test.ts`

**Interfaces:**
- Produces: `export function fotoBuono(b: { tipo?: string; voce_id?: string | null }): string` — ritorna l'URL assoluto della foto; usata da `buonoEmailHTML`.

- [ ] **Step 1: Scrivi i test che falliscono** — aggiungi in fondo a `email-buono.test.ts`:

```ts
import { fotoBuono } from './email-buono.ts';

const IMG = 'https://arrivo-terme-leonardo.vercel.app/buoni/img';

Deno.test('la foto segue il tipo di buono', () => {
  assertEquals(fotoBuono({ tipo: 'valore' }), `${IMG}/valore.jpg`);
  assertEquals(fotoBuono({ tipo: 'servizio', voce_id: 'dayspa_fer' }), `${IMG}/dayspa.jpg`);
  assertEquals(fotoBuono({ tipo: 'servizio', voce_id: 'dayspa_pom' }), `${IMG}/dayspa.jpg`);
  assertEquals(fotoBuono({ tipo: 'servizio', voce_id: 'relax25' }), `${IMG}/trattamenti.jpg`);
  assertEquals(fotoBuono({ tipo: 'servizio', voce_id: null }), `${IMG}/valore.jpg`);
  assertEquals(fotoBuono({ tipo: 'servizio', voce_id: 'altro' }), `${IMG}/valore.jpg`);
});

Deno.test('il buono HTML contiene la foto del suo tipo', () => {
  const html = buonoEmailHTML({ ...BUONO, tipo: 'servizio', voce_id: 'dayspa_fer' });
  assertStringIncludes(html, `${IMG}/dayspa.jpg`);
  const html2 = buonoEmailHTML(BUONO);   // BUONO è tipo 'valore'
  assertStringIncludes(html2, `${IMG}/valore.jpg`);
});
```

(nell'import in testa al file aggiungi `fotoBuono` a quello esistente da `./email-buono.ts`)

- [ ] **Step 2: Verifica che falliscano**

```bash
DENO="/c/Users/admin/AppData/Local/Microsoft/WinGet/Packages/DenoLand.Deno_Microsoft.Winget.Source_8wekyb3d8bbwe/deno.exe"
cd /c/Users/admin/termeleonardo-infra/supabase/functions/buoni && "$DENO" test --allow-env email-buono.test.ts
```
Expected: FAIL — `fotoBuono` non esportata.

- [ ] **Step 3: Implementa** — in `email-buono.ts`, sopra `buonoEmailHTML`:

```ts
/* la foto del buono: una per tipo, servite dal sito delle pagine */
const BASE_IMG = 'https://arrivo-terme-leonardo.vercel.app/buoni/img';
export function fotoBuono(b: { tipo?: string; voce_id?: string | null }): string {
  if (b.tipo === 'valore') return `${BASE_IMG}/valore.jpg`;
  const voce = String(b.voce_id || '');
  if (voce.startsWith('dayspa')) return `${BASE_IMG}/dayspa.jpg`;
  if (!voce || voce.startsWith('altro')) return `${BASE_IMG}/valore.jpg`;
  return `${BASE_IMG}/trattamenti.jpg`;
}
```

e dentro `buonoEmailHTML` sostituisci il div gradiente

```
<div style="height:150px;margin:26px 0 8px;border-radius:2px;background:linear-gradient(160deg,#BEDCD4,#8FC4BC 55%,#5FA8A0);"></div>
```

con

```
<img src="${fotoBuono(b)}" width="218" height="150" alt="" style="display:block;width:218px;height:150px;object-fit:cover;border-radius:2px;margin:26px 0 8px;" />
```

- [ ] **Step 4: Verifica che tutti i test passino** (stesso comando dello Step 2, poi l'intera cartella: `"$DENO" test --allow-env .`)
Expected: 15 passed (13 esistenti + 2 nuovi).

- [ ] **Step 5: Commit**

```bash
cd /c/Users/admin/termeleonardo-infra
git add supabase/functions/buoni/ && git commit -m "Buoni: foto per tipo nel buono email (fotoBuono, TDD)"
```

---

### Task 3: Foto nel back office (anteprima + stampa A4)

**Files:**
- Modify: `pagine/buoni/index.html` (2 occorrenze di `linear-gradient(160deg,#BEDCD4`)

**Interfaces:**
- Consumes: URL foto del Task 1. Il record buono renderizzato ha `tipo` e `voce_id` (stessi campi della funzione).

- [ ] **Step 1: Individua le 2 occorrenze** — `grep -n "linear-gradient(160deg,#BEDCD4" pagine/buoni/index.html` e leggi il contesto di ciascuna (una è l'anteprima a schermo, una la stampa A4).

- [ ] **Step 2: Aggiungi la regola in JS** — nello script della pagina, vicino agli altri helper (`esc`, `eur`):

```js
const BASE_IMG = 'https://arrivo-terme-leonardo.vercel.app/buoni/img';
const fotoBuono = (b) => {
  if (b.tipo === 'valore') return BASE_IMG + '/valore.jpg';
  const voce = String(b.voce_id || '');
  if (voce.startsWith('dayspa')) return BASE_IMG + '/dayspa.jpg';
  if (!voce || voce.startsWith('altro')) return BASE_IMG + '/valore.jpg';
  return BASE_IMG + '/trattamenti.jpg';
};
```

- [ ] **Step 3: Sostituisci i 2 div gradiente** con (adattando altezza/margini a quelli del div sostituito in ciascun punto — la stampa A4 può avere misure proprie):

```html
<img src="${fotoBuono(b)}" alt="" style="display:block;width:100%;height:<ALTEZZA-DEL-DIV-ORIGINALE>;object-fit:cover;border-radius:2px;margin:<MARGINI-DEL-DIV-ORIGINALE>;" />
```

dove `b` è il record del buono disponibile nel template che si sta modificando (verificare il nome della variabile nel contesto: se il template usa un altro nome, usare quello).

- [ ] **Step 4: Verifica locale** — apri il file nel browser (`start pagine/buoni/index.html`): l'anteprima mostra la foto giusta scegliendo Day Spa vs massaggio vs valore; anteprima di stampa (Ctrl+P) con la foto.

- [ ] **Step 5: Commit**

```bash
git add pagine/buoni/index.html && git commit -m "Buoni: foto per tipo nel back office (anteprima e stampa)"
```

---

### Task 4: Foto nell'anteprima della pagina pubblica

**Files:**
- Modify: `pagine/buoni/regala/index.html` (1 occorrenza di `linear-gradient(160deg,#BEDCD4`, dentro `anteprimaHTML`)

**Interfaces:**
- Consumes: URL foto del Task 1; lo `stato()` della pagina già produce `{ tipo, voce_id, ... }`.

- [ ] **Step 1: Aggiungi lo stesso helper `fotoBuono(b)` del Task 3** vicino a `anteprimaHTML`.

- [ ] **Step 2: Sostituisci il div gradiente in `anteprimaHTML`**

```
<div style="height:130px;margin:24px 0 10px;border-radius:2px;
      background:linear-gradient(160deg,#BEDCD4,#8FC4BC 55%,#5FA8A0);"></div>
```

con

```
<img src="${fotoBuono(b)}" alt="" style="display:block;width:100%;height:130px;object-fit:cover;border-radius:2px;margin:24px 0 10px;" />
```

- [ ] **Step 3: Verifica locale** — apri la pagina: cambiando voce (massaggio → Day Spa → importo libero) l'anteprima cambia foto dal vivo.

- [ ] **Step 4: Commit e push (deploy pagine)**

```bash
git add pagine/buoni/regala/index.html && git commit -m "Buoni: foto per tipo nell'anteprima della pagina pubblica" && git push origin main
```

- [ ] **Step 5: Verifica in produzione** — https://arrivo-terme-leonardo.vercel.app/buoni/regala/ mostra le foto (attendere la build ~1 min).

---

### Task 5: Redeploy della funzione `buoni`

**Files:** nessuna modifica — deploy dei file del Task 2.

**Interfaces:**
- Consumes: token Supabase dell'utente (quello precedente andava revocato: **chiederne uno nuovo**).

- [ ] **Step 1: Chiedi il token all'utente** (supabase.com/dashboard/account/tokens), poi:

```bash
cd /c/Users/admin/termeleonardo-infra/supabase/functions/buoni
curl -sS -w "\nHTTP %{http_code}\n" -X POST "https://api.supabase.com/v1/projects/mvuiuwakuseockotlcnp/functions/deploy?slug=buoni" \
  -H "Authorization: Bearer <TOKEN>" \
  -F 'metadata={"name":"buoni","entrypoint_path":"index.ts","verify_jwt":false};type=application/json' \
  -F 'file=@index.ts;type=application/typescript' \
  -F 'file=@acquista.ts;type=application/typescript' \
  -F 'file=@email-buono.ts;type=application/typescript' \
  -F 'file=@deno.json;type=application/json'
```
Expected: HTTP 201, `"status":"ACTIVE"`, version incrementata.

- [ ] **Step 2: Smoke test di regressione**

```bash
curl -sS -w " [%{http_code}]\n" "https://mvuiuwakuseockotlcnp.supabase.co/functions/v1/buoni?a=verifica&codice=LEO-XXXX-XXXX"
curl -sS -w " [%{http_code}]\n" -X POST "https://mvuiuwakuseockotlcnp.supabase.co/functions/v1/buoni?a=acquista" -H 'content-type: application/json' -d '{"tipo":"valore","valore":5,"acquirente_email":"a@b.it"}'
```
Expected: `[404] non trovato` e `[400] importo fuori dai limiti`.

- [ ] **Step 3: Ricorda all'utente di revocare il token.**

---

### Task 6: CTA del sito nuovo → pagina di acquisto

**Files:**
- Clone: `https://github.com/raffaelrenga84-code/termeleonardo` in `C:\Users\admin\termeleonardo`
- Modify: `frontend/src/data.js` (aggiungi `REGALA_URL`), `frontend/src/components/site/GiftVouchers.jsx` (CTA)

**Interfaces:**
- Consumes: `useLang()` da `LanguageContext` — verificare che esponga la lingua attiva (`lang` o simile); se espone solo `t`, aggiungere `lang` al value del provider.

- [ ] **Step 1: Clona e guarda com'è fatto**

```bash
git clone https://github.com/raffaelrenga84-code/termeleonardo.git /c/Users/admin/termeleonardo
grep -n "SHOP_URL" /c/Users/admin/termeleonardo/frontend/src/data.js /c/Users/admin/termeleonardo/frontend/src -r
grep -n "lang" /c/Users/admin/termeleonardo/frontend/src/LanguageContext.js | head
```

- [ ] **Step 2: Aggiungi in `data.js`** (accanto a `SHOP_URL`, che resta per gli altri usi):

```js
export const REGALA_URL = "https://arrivo-terme-leonardo.vercel.app/buoni/regala/";
```

- [ ] **Step 3: In `GiftVouchers.jsx`** — importa `REGALA_URL` al posto di `SHOP_URL`, prendi la lingua dal contesto e cambia il CTA:

```jsx
import { REGALA_URL } from "../../data";
// ...
const { t, lang } = useLang();   // se useLang non espone lang, aggiungerlo al provider
// ...
<a href={`${REGALA_URL}?l=${lang || "it"}`} target="_blank" rel="noopener noreferrer" data-testid="gift-cta" ...>
```

- [ ] **Step 4: Build locale di controllo**

```bash
cd /c/Users/admin/termeleonardo/frontend && npm ci --silent && npm run build 2>&1 | tail -5
```
Expected: build senza errori.

- [ ] **Step 5: Commit e push**

```bash
cd /c/Users/admin/termeleonardo
git add frontend/src/data.js frontend/src/components/site/GiftVouchers.jsx
git commit -m "Regali: il bottone porta alla pagina di acquisto buoni nella lingua attiva" && git push origin main
```

- [ ] **Step 6: Verifica la build Vercel** — col connettore Vercel (`list_deployments` / `get_deployment_build_logs` sul progetto `termeleonardo`): l'ultimo deployment è READY (nota: quello precedente era in Error — se fallisce anche senza le nostre modifiche, segnalare all'utente). Poi sul sito live: il bottone della sezione regali apre `/buoni/regala/?l=de` col tedesco attivo.

---

## Self-Review

- **Spec coverage**: foto+hosting (T1), regola condivisa+email TDD (T2), back office (T3), pagina pubblica (T4), redeploy (T5), sito nuovo (T6), logo = nessun task (per spec). Collaudo della spec distribuito negli step di verifica. ✔
- **Placeholder**: gli unici segnaposto (`<ALTEZZA-DEL-DIV-ORIGINALE>`, `<TOKEN>`) sono valori leggibili dal file in loco o forniti dall'utente, indicati esplicitamente come tali. ✔
- **Type consistency**: `fotoBuono(b)` stessa firma e stessa regola in T2 (TS), T3/T4 (JS); URL base identico ovunque. ✔
