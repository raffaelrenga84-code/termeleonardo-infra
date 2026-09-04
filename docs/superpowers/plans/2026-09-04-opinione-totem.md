# L'opinione dell'ospite sul totem — piano

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** sul totem in hall l'ospite lascia stelle, temi, commento, anonimo o con la tessera della camera; arriva per email alla direzione.

**Architecture:** modulo puro `opinione.ts` nella funzione `dayspa` (lettura del corpo, email, destinatari) + azione `?a=opinione` (solo totem) + `?a=qr-google`; testi in `lettura.js` (`testiOpinione`); percorso a schermate nella modalità totem di `pagine/ingresso/index.html`.

**Tech Stack:** Deno, Supabase Edge Function `dayspa`, Resend, la pagina del totem esistente.

## Global Constraints

- Prove prima del codice; `deno test <dir> --allow-read --allow-env`.
- Import assoluti nelle pagine (`/ingresso/lettura.js`).
- Nessuna chiave nella pagina; l'azione accetta solo il totem (`eTotem`).
- Niente stampanti fiscali.
- Deploy: `npx --yes supabase functions deploy dayspa --project-ref mvuiuwakuseockotlcnp --no-verify-jwt` con `SUPABASE_ACCESS_TOKEN`; SQL via Management API.

---

### Task 1: la tabella

- [ ] `supabase/opinione-sql.test.ts`: il file `2026-09-04-opinione.sql` crea `opinione` con `stelle between 1 and 5`, `fonte in ('totem', 'qr')`, `lingua in ('it', 'en', 'de', 'fr')`, `temi text[]`, `camera text`, `email_inviata`, solo `create ... if not exists`.
- [ ] Rosso, poi il file SQL della spec, verde, esecuzione sul progetto, commit.

### Task 2: `opinione.ts`

- [ ] `opinione.test.ts`: `leggiOpinione` (stelle fuori da 1–5 → errore; temi sconosciuti scartati e senza doppioni; commento tagliato a 500 e vuoto → null; lingua ignota → it; tessera con lettere → null; stelle "4" testo → 4); `emailOpinione` (oggetto con ★ e camera o «anonima»; corpo con temi in italiano, commento, «tessera non riconosciuta» quando `tesseraFallita`); `destinatariOpinione` (direzione sempre; reception solo con ≤3 stelle e camera).
- [ ] Rosso, poi `opinione.ts` con `TEMI`, `leggiOpinione`, `emailOpinione`, `destinatariOpinione`, `stelleTesto`. Verde. Commit.

### Task 3: la funzione

- [ ] In `azioni.test.ts` (dayspa): il blocco `azione === 'opinione'` richiede `eTotem(req)`, chiama `leggiOpinione(`, `inviaEmail(`, `EMAIL_DIREZIONE`, ha `429`, inserisce in `'opinione'`; `qr-google` sta prima della parte riservata e usa `GOOGLE_RECENSIONE_URL`; `contoFidra(` usata sia da `conto` sia da `opinione`.
- [ ] Rosso, poi: `contoFidra(codice)` estratta dal blocco `conto`; `?a=opinione`; `?a=qr-google`; `EMAIL_DIREZIONE`. Verde, `deno check`, deploy, prova dal vivo con `x-totem-key` dall'IP dell'hotel (questo PC): 200 e email alla direzione; senza intestazione 401.
- [ ] Commit.

### Task 4: i testi

- [ ] `lettura.test.ts`: `testiOpinione('de')` ha le stesse chiavi di `testiOpinione('it')`, per tutte e quattro le lingue; `testiOpinione('xx')` torna l'italiano; `TEMI_OPINIONE` ha sette voci; ogni lingua ha un'etichetta per ogni tema.
- [ ] Rosso, poi `testiOpinione` e `TEMI_OPINIONE` in `lettura.js`. Verde. Commit.

### Task 5: la pagina

- [ ] `pagina.test.ts`: nel totem c'è `id="opinioneApri"` nella schermata di riposo con le quattro lingue; `stopPropagation` sul pulsante; `function opinione(` con le schermate stelle/temi/commento/chi/grazie (`testiOpinione(`), `a=opinione`, `qr-google`, `Resto anonimo` via testi (`t.chiAnonimo`), `document.onclick = null` nel percorso, `timerRiposo = setTimeout(riposo, 60000)` azzerato ai tocchi, `maxlength="500"`.
- [ ] Rosso, poi il percorso in `totem()`. Verde, tutte le prove di `pagine/`. Commit e push (Vercel pubblica).

### Task 6: secret, collaudo, memoria

- [ ] `npx supabase secrets set EMAIL_DIREZIONE=direzione@termeleonardo.com`; `GOOGLE_RECENSIONE_URL` quando la proprietà lo manda.
- [ ] Sul totem: un'opinione anonima e una con la tessera 1466; email arrivate; cartello nuovo.
- [ ] Stato nella spec; memoria `dayspa-online-stato.md` aggiornata; commit.
