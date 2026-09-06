# Back office a mattonelle — piano (7 settembre 2026)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (scelta della proprietà). Un file solo: `pagine/buoni/index.html`, più le prove in `pagine/buoni/`.

**Goal:** la home a mattonelle, ogni funzione una pagina con «‹ Home», tabelle a schede e tasti appiccicati sul telefono — senza cambiare le viste.

**Architecture:** `VISTA = 'home'` come stato in più; `apri()`/`popstate` sull'hash; `disegna()` disegna la barra e la vista, o la home; un `MutationObserver` marca le tabelle per il CSS a 700 px.

**Tech Stack:** HTML/CSS/JS della pagina, Deno per le prove.

## Global Constraints

- Le schede, i ruoli e le liste `SCHEDE`, `FAMIGLIE`, `SCHEDE_NASCOSTE`, `ORDINE_SCHEDE` restano come sono (le prove le pinnano).
- `?scheda=dayspaOggi&sportello=1` deve aprire lo sportello come oggi.
- `aggiornaContatore()` deve scrivere su `data-scheda="richieste"` (la prova lo cerca).
- Testi in italiano, commenti che dicono il perché con la data.

---

### Task 1: home, barra, indirizzo

**Files:** modify `pagine/buoni/index.html` (struttura: `disegna`, accesso, avvio; CSS).

- [ ] Prova che fallisce: `pagine/buoni/mattonelle.test.ts` (icone per ogni scheda, `VISTA = schedaDaUrl() || 'home'`, `function apri(`, `popstate`, `class="mattonella"` con `data-scheda`, `tornaHome`).
- [ ] `ICONE`, `titoloBreve`, `vistaDallHash`, `apri`, `mattonelle`, nuovo `disegna()`; accesso e avvio entrano sulla home.
- [ ] CSS: `.casa`, `.mattonelle`, `.mattonella`, `.barra`, `.conta` (via `.famiglie`/`.schede`).
- [ ] Prova verde; suite verde; commit.

### Task 2: sul telefono

**Files:** modify `pagine/buoni/index.html` (CSS `@media (max-width:700px)`, `tabelleInSchede`, osservatore).

- [ ] Prova che fallisce (stessa prova, secondo test): `tabelleInSchede`, `MutationObserver`, `table.aSchede`, `content:attr(data-eti)`, `tr[hidden]{display:none`, `position:sticky;bottom`, `font-size:16px`.
- [ ] Osservatore e CSS.
- [ ] Prova verde; suite verde; commit.

### Task 3: prove vecchie e anteprima

- [ ] `scheda-iniziale.test.ts`: il titolo «si entra sempre sulla prima scheda» diventa «la prima mattonella è la scheda del mestiere» (la funzione non cambia).
- [ ] Anteprima a 390 px e 1280 px con Chrome senza finestra, letta con gli occhi.
- [ ] Suite verde; merge su main; push; verifica su www.
