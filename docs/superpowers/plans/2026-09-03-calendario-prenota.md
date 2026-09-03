# Il calendario di Prenota — piano di lavoro

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** su `/prenota` le date si scelgono con un calendario unico a due tocchi, con le notti contate e i giorni chiusi in grigio; sul telefono a tutto schermo, su computer in un riquadro.

**Architecture:** un modulo `pagine/comune/calendario.js` con le regole pure (griglia, stato del giorno, macchina dei due tocchi, riassunto) e il disegno (`apriCalendario`), senza librerie. La pagina Prenota tiene i due campi `fArrivo`/`fPartenza` come campi nascosti con i valori ISO e mostra un campo unico che apre il calendario; alla conferma scrive i valori e lancia `change`, così tutto il resto della pagina non cambia.

**Tech Stack:** moduli ES nel browser, CSS con media query, prove Deno `jsr:@std/assert`.

## Global Constraints

- Specifica: `docs/superpowers/specs/2026-09-03-calendario-prenota-design.md`.
- Nessuna libreria esterna; il modulo non importa altri moduli (in Deno `/comune/date.js` non si risolve): `notti` è ricalcolata dentro, con un commento.
- Percorso assoluto nell'import della pagina: `/comune/calendario.js`.
- I campi `#fArrivo` e `#fPartenza` restano con gli stessi id e valori ISO (`AAAA-MM-GG`).
- Le prove esistenti di `pagine/prenota/` restano verdi.
- Date in UTC a mezzogiorno per l'aritmetica (niente ora legale); «oggi» arriva sempre dall'esterno nelle funzioni pure.
- Commit su `main` con `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

---

## File Structure

| file | responsabilità | task |
|---|---|---|
| `pagine/comune/calendario.js` (nuovo) | regole pure + disegno del calendario + testi in quattro lingue | 1, 2 |
| `pagine/comune/calendario.test.ts` (nuovo) | prove delle regole e del disegno | 1, 2 |
| `pagine/prenota/index.html` | campi nascosti, campo unico, apertura e conferma | 3 |
| `pagine/prenota/calendario-pagina.test.ts` (nuovo) | il cablaggio letto dal sorgente | 3 |

---

### Task 1: le regole pure

**Files:** Create `pagine/comune/calendario.js`; Test `pagine/comune/calendario.test.ts`.

**Interfaces (Produces):**
- `TESTI[lingua]`: `campo`, `scegli`, `scegliArrivo`, `scegliPartenza`, `notti(n)`, `conferma`, `cancella`, `chiusi`, `giorni` (7, da lunedì), `mesiBrevi` (12), `mesiLunghi` (12).
- `griglia(oggiISO, quantiMesi = 14) → [{ anno, mese, giorni: [{ iso, giorno, colonna }] }]`
- `statoGiorno(iso, { oggi, arrivo, partenza, chiusure }) → 'passato'|'chiuso'|'arrivo'|'partenza'|'dentro'|'libero'`
- `tocca(scelta, iso, { oggi, chiusure }) → { arrivo, partenza }`
- `notti(arrivo, partenza) → number`
- `riassunto(scelta, lingua) → string` («sab 13 feb → mer 17 feb · 4 notti», «sab 13 feb → …», '')
- `suggerimento(scelta, lingua) → string` («Scelga il giorno di arrivo», «Ora il giorno di partenza», '')

- [ ] **Step 1: la prova che fallisce** — `pagine/comune/calendario.test.ts`:

```ts
import { assert, assertEquals } from 'jsr:@std/assert';
import { griglia, notti, riassunto, statoGiorno, suggerimento, TESTI, tocca } from './calendario.js';

const OGGI = '2026-09-03';                                   // un giovedì
const CHIUSURE = [{ chiusura: '2026-11-29', riapertura: '2027-02-13' }];
const C = { oggi: OGGI, chiusure: CHIUSURE };

Deno.test('la griglia parte dal mese di oggi, quattordici mesi, settimana da lunedì', () => {
  const g = griglia(OGGI);
  assertEquals(g.length, 14);
  assertEquals([g[0].anno, g[0].mese], [2026, 9]);
  assertEquals([g[13].anno, g[13].mese], [2027, 10]);
  assertEquals(g[0].giorni.length, 30);
  assertEquals(g[0].giorni[0], { iso: '2026-09-01', giorno: 1, colonna: 1 }, 'il 1 settembre 2026 e un martedì: colonna 1');
  assertEquals(g[1].giorni[0].colonna, 3, 'il 1 ottobre 2026 e un giovedì');
  assertEquals(griglia(OGGI, 3).length, 3);
});

Deno.test('lo stato di ogni giorno', () => {
  const s = (iso, scelta = {}) => statoGiorno(iso, { ...C, ...scelta });
  assertEquals(s('2026-09-02'), 'passato');
  assertEquals(s('2026-09-03'), 'libero', 'oggi e libero: decide dopo chiusoPerOggi');
  assertEquals(s('2026-12-15'), 'chiuso');
  assertEquals(s('2026-11-29'), 'chiuso', 'il primo giorno di chiusura');
  assertEquals(s('2027-02-13'), 'libero', 'il giorno di riapertura e libero');
  assertEquals(s('2026-10-10', { arrivo: '2026-10-10', partenza: '2026-10-14' }), 'arrivo');
  assertEquals(s('2026-10-14', { arrivo: '2026-10-10', partenza: '2026-10-14' }), 'partenza');
  assertEquals(s('2026-10-12', { arrivo: '2026-10-10', partenza: '2026-10-14' }), 'dentro');
  assertEquals(s('2026-10-20', { arrivo: '2026-10-10', partenza: '2026-10-14' }), 'libero');
});

Deno.test('due tocchi: arrivo, poi partenza; un terzo ricomincia', () => {
  let sc = tocca({ arrivo: '', partenza: '' }, '2026-10-10', C);
  assertEquals(sc, { arrivo: '2026-10-10', partenza: '' });
  sc = tocca(sc, '2026-10-14', C);
  assertEquals(sc, { arrivo: '2026-10-10', partenza: '2026-10-14' });
  sc = tocca(sc, '2026-10-20', C);
  assertEquals(sc, { arrivo: '2026-10-20', partenza: '' }, 'con tutte e due scelte si ricomincia');
});

Deno.test('un tocco prima dell arrivo, o sull arrivo, diventa il nuovo arrivo', () => {
  assertEquals(tocca({ arrivo: '2026-10-10', partenza: '' }, '2026-10-05', C), { arrivo: '2026-10-05', partenza: '' });
  assertEquals(tocca({ arrivo: '2026-10-10', partenza: '' }, '2026-10-10', C), { arrivo: '2026-10-10', partenza: '' });
});

Deno.test('passato e chiuso non si toccano; un intervallo sopra la chiusura non si accetta', () => {
  const sc = { arrivo: '2026-10-10', partenza: '' };
  assertEquals(tocca(sc, '2026-09-01', C), sc, 'passato');
  assertEquals(tocca(sc, '2026-12-15', C), sc, 'chiuso');
  assertEquals(tocca({ arrivo: '2026-11-25', partenza: '' }, '2027-02-15', C), { arrivo: '2027-02-15', partenza: '' },
    'la partenza dopo la riapertura con l arrivo prima della chiusura: si riparte da quel giorno');
});

Deno.test('le notti e il riassunto nelle quattro lingue', () => {
  assertEquals(notti('2027-02-13', '2027-02-17'), 4);
  const sc = { arrivo: '2027-02-13', partenza: '2027-02-17' };
  assertEquals(riassunto(sc, 'it'), 'sab 13 feb → mer 17 feb · 4 notti');
  assertEquals(riassunto(sc, 'de'), 'Sa 13. Feb → Mi 17. Feb · 4 Nächte');
  assertEquals(riassunto(sc, 'en'), 'Sat 13 Feb → Wed 17 Feb · 4 nights');
  assertEquals(riassunto(sc, 'fr'), 'sam 13 févr → mer 17 févr · 4 nuits');
  assertEquals(riassunto({ arrivo: '2026-10-05', partenza: '2026-10-06' }, 'it'), 'lun 5 ott → mar 6 ott · 1 notte');
  assertEquals(riassunto({ arrivo: '2027-02-13', partenza: '' }, 'it'), 'sab 13 feb → …');
  assertEquals(riassunto({ arrivo: '', partenza: '' }, 'it'), '');
  assertEquals(suggerimento({ arrivo: '', partenza: '' }, 'it'), 'Scelga il giorno di arrivo');
  assertEquals(suggerimento({ arrivo: '2027-02-13', partenza: '' }, 'it'), 'Ora il giorno di partenza');
  assertEquals(suggerimento(sc, 'it'), '');
  for (const l of ['it', 'de', 'en', 'fr']) {
    assertEquals(TESTI[l].giorni.length, 7); assertEquals(TESTI[l].mesiBrevi.length, 12); assertEquals(TESTI[l].mesiLunghi.length, 12);
    assert(TESTI[l].campo && TESTI[l].conferma && TESTI[l].cancella && TESTI[l].chiusi, l);
  }
});
```

- [ ] **Step 2: rosso** — `deno test --allow-read --allow-env pagine/comune/calendario.test.ts` (modulo mancante).
- [ ] **Step 3: il modulo** (regole; il disegno arriva nel Task 2):

```js
'use strict';
export const TESTI = {
  it: { campo: 'Arrivo e partenza', scegli: 'Scelga le date', scegliArrivo: 'Scelga il giorno di arrivo', scegliPartenza: 'Ora il giorno di partenza',
        notti: (n) => n === 1 ? '1 notte' : `${n} notti`, conferma: 'Conferma', cancella: 'Cancella', chiusi: 'chiusi', chiudi: 'Chiudi',
        giorni: ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom'],
        mesiBrevi: ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'],
        mesiLunghi: ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'] },
  de: { campo: 'An- und Abreise', scegli: 'Daten wählen', scegliArrivo: 'Wählen Sie den Anreisetag', scegliPartenza: 'Jetzt den Abreisetag',
        notti: (n) => n === 1 ? '1 Nacht' : `${n} Nächte`, conferma: 'Bestätigen', cancella: 'Löschen', chiusi: 'geschlossen', chiudi: 'Schließen',
        giorni: ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'],
        mesiBrevi: ['Jan', 'Feb', 'März', 'Apr', 'Mai', 'Juni', 'Juli', 'Aug', 'Sept', 'Okt', 'Nov', 'Dez'],
        mesiLunghi: ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'] },
  en: { campo: 'Arrival and departure', scegli: 'Choose your dates', scegliArrivo: 'Choose your arrival day', scegliPartenza: 'Now the departure day',
        notti: (n) => n === 1 ? '1 night' : `${n} nights`, conferma: 'Confirm', cancella: 'Clear', chiusi: 'closed', chiudi: 'Close',
        giorni: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        mesiBrevi: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
        mesiLunghi: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] },
  fr: { campo: 'Arrivée et départ', scegli: 'Choisissez vos dates', scegliArrivo: 'Choisissez le jour d’arrivée', scegliPartenza: 'Puis le jour de départ',
        notti: (n) => n === 1 ? '1 nuit' : `${n} nuits`, conferma: 'Confirmer', cancella: 'Effacer', chiusi: 'fermé', chiudi: 'Fermer',
        giorni: ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'],
        mesiBrevi: ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'],
        mesiLunghi: ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'] },
};
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const pezzi = (iso) => { const m = ISO.exec(String(iso ?? '')); return m ? { a: +m[1], m: +m[2], g: +m[3] } : null; };
const data = (iso) => { const p = pezzi(iso); return p ? new Date(Date.UTC(p.a, p.m - 1, p.g, 12)) : null; };
const isoDi = (d) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
/* stessa regola di nottiFra in /comune/date.js: ricalcolata qui perche' questo modulo non importa niente (in Deno /comune/date.js non si risolve) */
export function notti(arrivo, partenza) { const a = data(arrivo), p = data(partenza); return a && p ? Math.round((p - a) / 86400000) : 0; }
export function griglia(oggiISO, quantiMesi = 14) {
  const o = pezzi(oggiISO); if (!o) return [];
  const mesi = [];
  for (let k = 0; k < quantiMesi; k++) {
    const primo = new Date(Date.UTC(o.a, o.m - 1 + k, 1, 12));
    const anno = primo.getUTCFullYear(), mese = primo.getUTCMonth() + 1;
    const quanti = new Date(Date.UTC(anno, mese, 0, 12)).getUTCDate();
    const giorni = [];
    for (let g = 1; g <= quanti; g++) {
      const d = new Date(Date.UTC(anno, mese - 1, g, 12));
      giorni.push({ iso: isoDi(d), giorno: g, colonna: (d.getUTCDay() + 6) % 7 });
    }
    mesi.push({ anno, mese, giorni });
  }
  return mesi;
}
const chiuso = (iso, chiusure) => (chiusure || []).some((c) => iso >= c.chiusura && iso < c.riapertura);
const attraversa = (arrivo, partenza, chiusure) => (chiusure || []).some((c) => arrivo < c.riapertura && partenza > c.chiusura);
export function statoGiorno(iso, { oggi, arrivo, partenza, chiusure }) {
  if (iso < oggi) return 'passato';
  if (chiuso(iso, chiusure)) return 'chiuso';
  if (arrivo && iso === arrivo) return 'arrivo';
  if (partenza && iso === partenza) return 'partenza';
  if (arrivo && partenza && iso > arrivo && iso < partenza) return 'dentro';
  return 'libero';
}
export function tocca(scelta, iso, { oggi, chiusure }) {
  const s = { arrivo: scelta?.arrivo || '', partenza: scelta?.partenza || '' };
  if (iso < oggi || chiuso(iso, chiusure)) return s;
  if (!s.arrivo || s.partenza) return { arrivo: iso, partenza: '' };
  if (iso <= s.arrivo) return { arrivo: iso, partenza: '' };
  if (attraversa(s.arrivo, iso, chiusure)) return { arrivo: iso, partenza: '' };
  return { arrivo: s.arrivo, partenza: iso };
}
const testi = (l) => TESTI[l] || TESTI.it;
export function giornoBreve(iso, lingua) {
  const d = data(iso); if (!d) return '';
  const t = testi(lingua), l = TESTI[lingua] ? lingua : 'it';
  return `${t.giorni[(d.getUTCDay() + 6) % 7]} ${d.getUTCDate()}${l === 'de' ? '.' : ''} ${t.mesiBrevi[d.getUTCMonth()]}`;
}
export function riassunto(scelta, lingua) {
  const t = testi(lingua);
  if (!scelta?.arrivo) return '';
  if (!scelta.partenza) return `${giornoBreve(scelta.arrivo, lingua)} → …`;
  return `${giornoBreve(scelta.arrivo, lingua)} → ${giornoBreve(scelta.partenza, lingua)} · ${t.notti(notti(scelta.arrivo, scelta.partenza))}`;
}
export function suggerimento(scelta, lingua) {
  const t = testi(lingua);
  if (!scelta?.arrivo) return t.scegliArrivo;
  if (!scelta.partenza) return t.scegliPartenza;
  return '';
}
```

- [ ] **Step 4: verde**, **Step 5: commit** `git add pagine/comune/calendario.js pagine/comune/calendario.test.ts && git commit -m "Un calendario a due tocchi: le regole, pure e provate"`

---

### Task 2: il disegno (`apriCalendario`)

**Files:** Modify `pagine/comune/calendario.js` (in coda); Test `pagine/comune/calendario.test.ts` (in coda).

**Interfaces (Produces):** `apriCalendario({ radice, lingua, oggi, chiusure, arrivo, partenza, onConferma, onChiudi }) → { chiudi }`. Disegna in `radice` (un `<div>` vuoto nella pagina): testa (riassunto + suggerimento + «Chiudi»), mesi con giorni `<button data-iso class="g <stato>">`, barra («Cancella», «Conferma» disabilitato finché mancano le date). Inietta una volta lo stile `#leoCalendarioStile`: `.calFoglio` con `@media (max-width:640px){ position:fixed; inset:0; overflow:auto; }` e su computer `position:absolute` sotto il campo con due mesi affiancati (`.calMesi{display:grid;grid-template-columns:1fr 1fr}` sopra i 640 px, una colonna sotto). Esc chiude; `onChiudi` alla chiusura senza conferma.

- [ ] **Step 1: prova** (sul sorgente del modulo, perche' il DOM non c'e' in Deno):

```ts
const MODULO = Deno.readTextFileSync(new URL('calendario.js', import.meta.url));
Deno.test('il disegno: giorni come pulsanti con lo stato, conferma solo con due date, foglio a tutto schermo sul telefono', () => {
  assert(/export function apriCalendario\(/.test(MODULO));
  assert(/data-iso="\$\{[^}]*\}"/.test(MODULO), 'i giorni non portano la data');
  assert(/class="g \$\{stato\}"/.test(MODULO), 'i giorni non portano lo stato');
  assert(/disabled = !\(scelta\.arrivo && scelta\.partenza\)/.test(MODULO), 'Conferma non e legato alle due date');
  assert(/@media \(max-width:640px\)[\s\S]*position:fixed/.test(MODULO), 'sul telefono non e a tutto schermo');
  assert(/key === 'Escape'/.test(MODULO), 'Esc non chiude');
  assert(/t\.chiusi/.test(MODULO), 'il primo giorno chiuso non dice «chiusi»');
});
```

- [ ] **Step 2: rosso**; **Step 3: il codice** (in coda al modulo):

```js
const STILE = `
.calFoglio{background:#fff;border:1px solid #E5E0D8;border-radius:14px;box-shadow:0 12px 40px rgba(26,54,38,.18);font-family:inherit;color:#2A2E2B;z-index:50;}
.calTesta{position:sticky;top:0;background:#fff;border-bottom:1px solid #EFEAE0;padding:12px 16px;display:flex;align-items:center;gap:10px;}
.calTesta strong{flex:1;font-weight:500;}
.calTesta small{display:block;color:#6B7A72;font-size:12.5px;}
.calX{border:0;background:none;font-size:22px;line-height:1;cursor:pointer;color:#6B7A72;}
.calMesi{display:grid;grid-template-columns:1fr 1fr;gap:18px;padding:14px 16px 90px;}
.calMese h3{font-family:"Cormorant Garamond",Georgia,serif;font-weight:400;font-size:20px;margin:6px 0 8px;color:#1A3626;}
.calSett,.calGiorni{display:grid;grid-template-columns:repeat(7,1fr);gap:2px;}
.calSett span{font-size:11px;color:#8C8578;text-align:center;padding:2px 0;}
.g{border:0;background:none;padding:0;height:42px;border-radius:9px;font:15px inherit;color:#2A2E2B;cursor:pointer;position:relative;}
.g.passato{color:#C9C3B8;cursor:default;}
.g.chiuso{color:#B8B2A6;background:#F1EEE8;cursor:default;}
.g.chiuso small{position:absolute;left:0;right:0;bottom:2px;font-size:9px;line-height:1;color:#9A948A;}
.g.dentro{background:#E6F0EC;border-radius:0;}
.g.arrivo,.g.partenza{background:#1A3626;color:#fff;font-weight:600;}
.g.arrivo{border-radius:9px 0 0 9px;}
.g.partenza{border-radius:0 9px 9px 0;}
.g.arrivo.solo{border-radius:9px;}
.calBarra{position:sticky;bottom:0;background:#fff;border-top:1px solid #EFEAE0;padding:12px 16px;display:flex;gap:10px;justify-content:flex-end;}
.calBarra button{padding:12px 18px;border-radius:9px;font:600 15px inherit;cursor:pointer;}
.calCancella{background:#fff;border:1px solid #DCD6CB;color:#1A3626;}
.calConferma{background:#1A3626;border:0;color:#fff;}
.calConferma:disabled{opacity:.45;cursor:default;}
.calFrecce{display:none;}
@media (max-width:640px){
  .calFoglio{position:fixed;inset:0;border-radius:0;overflow:auto;-webkit-overflow-scrolling:touch;}
  .calMesi{grid-template-columns:1fr;}
}
@media (min-width:641px){
  .calFoglio{position:absolute;left:0;right:0;margin-top:8px;max-height:560px;overflow:auto;}
}`;
function stileUnaVolta() {
  if (document.getElementById('leoCalendarioStile')) return;
  const s = document.createElement('style'); s.id = 'leoCalendarioStile'; s.textContent = STILE;
  document.head.appendChild(s);
}
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export function apriCalendario({ radice, lingua, oggi, chiusure, arrivo, partenza, onConferma, onChiudi }) {
  stileUnaVolta();
  const t = testi(lingua);
  let scelta = { arrivo: arrivo || '', partenza: partenza || '' };
  const ctx = { oggi, chiusure: chiusure || [] };
  const primiChiusi = new Set((chiusure || []).map((c) => c.chiusura));
  const disegna = () => {
    const mesi = griglia(oggi).map((m) => `<div class="calMese"><h3>${esc(t.mesiLunghi[m.mese - 1])} ${m.anno}</h3>
      <div class="calSett">${t.giorni.map((g) => `<span>${esc(g)}</span>`).join('')}</div>
      <div class="calGiorni">${m.giorni.map((d, i) => {
        const stato = statoGiorno(d.iso, { ...ctx, ...scelta });
        const vuoti = i === 0 ? `<span style="grid-column:span ${d.colonna}"></span>` : '';
        const solo = stato === 'arrivo' && !scelta.partenza ? ' solo' : '';
        return `${vuoti}<button type="button" data-iso="${d.iso}" class="g ${stato}${solo}"${stato === 'passato' || stato === 'chiuso' ? ' tabindex="-1"' : ''}>${d.giorno}${
          stato === 'chiuso' && primiChiusi.has(d.iso) ? `<small>${esc(t.chiusi)}</small>` : ''}</button>`;
      }).join('')}</div></div>`).join('');
    radice.innerHTML = `<div class="calFoglio" role="dialog" aria-label="${esc(t.campo)}">
      <div class="calTesta"><strong>${esc(riassunto(scelta, lingua) || t.scegli)}<small>${esc(suggerimento(scelta, lingua))}</small></strong>
        <button type="button" class="calX" aria-label="${esc(t.chiudi)}">&times;</button></div>
      <div class="calMesi">${mesi}</div>
      <div class="calBarra"><button type="button" class="calCancella">${esc(t.cancella)}</button>
        <button type="button" class="calConferma">${esc(t.conferma)}</button></div></div>`;
    radice.querySelector('.calConferma').disabled = !(scelta.arrivo && scelta.partenza);
    radice.querySelectorAll('.g').forEach((b) => b.addEventListener('click', () => {
      const dopo = tocca(scelta, b.dataset.iso, ctx);
      if (dopo.arrivo === scelta.arrivo && dopo.partenza === scelta.partenza) return;
      scelta = dopo; disegna();
    }));
    radice.querySelector('.calCancella').onclick = () => { scelta = { arrivo: '', partenza: '' }; disegna(); };
    radice.querySelector('.calConferma').onclick = () => { chiudi(); if (onConferma) onConferma({ ...scelta }); };
    radice.querySelector('.calX').onclick = () => { chiudi(); if (onChiudi) onChiudi(); };
  };
  const suTasto = (e) => { if (e.key === 'Escape') { chiudi(); if (onChiudi) onChiudi(); } };
  const chiudi = () => { radice.innerHTML = ''; document.removeEventListener('keydown', suTasto); };
  document.addEventListener('keydown', suTasto);
  disegna();
  return { chiudi };
}
```

- [ ] **Step 4: verde**; **Step 5: commit** `… "Il calendario si disegna: foglio sul telefono, riquadro su computer"`

---

### Task 3: la pagina Prenota

**Files:** Modify `pagine/prenota/index.html` (import dopo riga 378; CSS `.campoDate`; righe 1012–1015; dopo la riga 1051); Test `pagine/prenota/calendario-pagina.test.ts` (nuovo).

- [ ] **Step 1: prova** (sorgente):

```ts
import { assert } from 'jsr:@std/assert';
const PAGINA = Deno.readTextFileSync(new URL('index.html', import.meta.url));
Deno.test('Prenota usa il calendario: campi nascosti con gli stessi id, un campo unico che apre, la conferma che scrive e avvisa', () => {
  assert(/from '\/comune\/calendario\.js'/.test(PAGINA), 'la pagina non importa il calendario');
  assert(/<input type="hidden" id="fArrivo" name="arrivo" value="\$\{esc\(r\.arrivo\)\}" \/>/.test(PAGINA), 'fArrivo non e piu un campo nascosto con il valore ISO');
  assert(/<input type="hidden" id="fPartenza" name="partenza" value="\$\{esc\(r\.partenza\)\}" \/>/.test(PAGINA), 'fPartenza non e piu un campo nascosto con il valore ISO');
  assert(!/<input type="date"/.test(PAGINA), 'ci sono ancora campi data nativi');
  assert(/id="bDate"/.test(PAGINA) && /id="calendarioBox"/.test(PAGINA), 'manca il campo unico o il contenitore');
  assert(/apriCalendario\(\{/.test(PAGINA), 'il campo non apre il calendario');
  assert(/chiusure: STAGIONE \? \[STAGIONE\] : \[\]/.test(PAGINA), 'i giorni chiusi non vengono dalla stagione letta');
  assert(/new Event\('change', \{ bubbles: true \}\)/.test(PAGINA), 'la conferma non avvisa chi ascolta i campi');
});
```

- [ ] **Step 2: rosso**; **Step 3: il codice**:

Import: `import { apriCalendario, riassunto, TESTI as TESTI_CAL } from '/comune/calendario.js';`. CSS (vicino a `.due{…}`): `.campoDate{width:100%;margin-top:6px;padding:12px 13px;font:15px inherit;border:1px solid #DCD6CB;border-radius:9px;background:#FCFBF8;color:#2A2E2B;text-align:left;cursor:pointer;} .campoDate:focus{outline:2px solid var(--acqua);border-color:transparent;} .campoDate.vuoto{color:#8C8578;} #calendarioBox{position:relative;}`. Le righe 1011–1016 diventano:

```js
      <label for="bDate">${esc(TESTI_CAL[LNG].campo)}</label>
      <button type="button" id="bDate" class="campoDate${r.arrivo && r.partenza ? '' : ' vuoto'}">${
        esc(riassunto({ arrivo: r.arrivo, partenza: r.partenza }, LNG) || TESTI_CAL[LNG].scegli)}</button>
      <div id="calendarioBox"></div>
      <input type="hidden" id="fArrivo" name="arrivo" value="${esc(r.arrivo)}" />
      <input type="hidden" id="fPartenza" name="partenza" value="${esc(r.partenza)}" />
```

Dopo `$('fArrivo').addEventListener('change', avvisoGiornoStesso);`:

```js
  /* IL CALENDARIO A DUE TOCCHI (3 settembre 2026): un campo solo, i valori
     ISO nei due campi nascosti di sempre, cosi' ricerca e riepilogo non
     cambiano. Alla conferma si lancia `change` sui campi, perche' gli
     avvisi di oggi e il collegamento arrivo/partenza continuino a sentire. */
  $('bDate').onclick = () => apriCalendario({
    radice: $('calendarioBox'), lingua: LNG, oggi: oggiISO(),
    chiusure: STAGIONE ? [STAGIONE] : [],
    arrivo: $('fArrivo').value, partenza: $('fPartenza').value,
    onConferma: ({ arrivo, partenza }) => {
      $('fArrivo').value = arrivo;
      $('fPartenza').value = partenza;
      for (const id of ['fArrivo', 'fPartenza']) $(id).dispatchEvent(new Event('change', { bubbles: true }));
      $('bDate').textContent = riassunto({ arrivo, partenza }, LNG) || TESTI_CAL[LNG].scegli;
      $('bDate').classList.toggle('vuoto', !(arrivo && partenza));
    },
  });
```

`attivaDate()` (riga 2213) resta: non trovando campi `type="date"` non fa niente, e `collegaArrivoPartenza` sui campi nascosti tiene coerenti i valori.

- [ ] **Step 4: verde** — `deno test --allow-read --allow-env pagine/prenota/ pagine/comune/calendario.test.ts`; poi la suite intera.
- [ ] **Step 5: commit e push** — `… "Prenota: le date si scelgono con un calendario a due tocchi"` e `git push origin main`; controllo con `curl` che `/it/prenota` contenga `comune/calendario.js`.

## Self-review

- Copertura: regole (T1), disegno telefono/computer, chiusi in grigio, Esc (T2), pagina con campi nascosti, campo unico, `change`, chiusure da `STAGIONE`, precompilazione dall'indirizzo (T3, `r.arrivo`/`r.partenza`), altri moduli intatti (nessun task li tocca). Casi limite: coperti dalle prove di `tocca` e `statoGiorno`; il ridisegno della pagina svuota `#calendarioBox` con il resto del markup.
- Segnaposto: nessuno. Nomi coerenti: `griglia`, `statoGiorno`, `tocca`, `notti`, `riassunto`, `suggerimento`, `TESTI`, `apriCalendario`, `STAGIONE`, `bDate`, `calendarioBox`.
