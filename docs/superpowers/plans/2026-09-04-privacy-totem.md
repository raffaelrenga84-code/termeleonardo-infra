# Il consenso privacy al totem e sugli iPad — piano

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** l'ospite firma il consenso privacy sul totem o sull'iPad senza scrivere niente; il consenso resta da noi e la reception riceve l'email con la firma.

**Architecture:** nuova funzione `privacy` (azioni della tabella nella spec) con il modulo puro `consenso.ts`; l'estensione manda i dati della prenotazione al check‑in; la pagina del totem ha il percorso e il modo `?privacy=1` per gli iPad; scheda «Privacy» nel back office.

**Tech Stack:** Deno, Supabase Edge Function, Resend con allegati, canvas per la firma, l'estensione Chrome.

## Global Constraints

- Prove prima del codice; import assoluti nelle pagine; niente chiavi nella pagina; niente stampanti fiscali.
- Deploy: `npx --yes supabase functions deploy privacy --project-ref mvuiuwakuseockotlcnp --no-verify-jwt`; SQL via Management API; estensione: `node strumenti/estensione.js`.

---

### Task 1: tabella — `consenso-sql.test.ts` rosso → `2026-09-04-consenso.sql` → eseguito → commit.
### Task 2: `consenso.ts` — `consenso.test.ts` rosso → modulo (testi 4 lingue con versione, `leggiAttesa`, `leggiFirma`, email reception/ospite, `firmaBase64`) → verde → commit.
### Task 3: funzione `privacy` — `azioni.test.ts` rosso (chi può cosa, tessera senza salvare il codice, allegato della firma) → `index.ts`, `ruoli.ts`, `deno.json` → verde, `deno check`, deploy, prove dal vivo con `x-totem-key` dall'IP dell'hotel → commit.
### Task 4: pagina — `privacy-pagina.test.ts` rosso (pulsante nel riposo, `?privacy=1`, `function privacy(`, canvas, `a=firma`, nessun `checked` preimpostato, `FUNZIONE_PRIVACY`) → percorso in `totem()` e modo iPad → verde → commit e push.
### Task 5: estensione 2.28.0 — `privacy.test.ts` rosso → `fidra-privacy.js` + manifest + LEGGIMI‑v2.28 → verde → `node strumenti/estensione.js` → commit.
### Task 6: back office — `privacy-schede.test.ts` rosso → `vistaPrivacy` + scheda + pagina di stampa → verde (compresi `scheda-iniziale.test.ts` con `privacy` in coda) → commit e push.
### Task 7: collaudo con la tessera 1466 sul totem, un consenso dall'iPad; stato nella spec; memoria.
