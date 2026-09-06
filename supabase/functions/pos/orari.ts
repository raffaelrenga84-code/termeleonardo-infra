/* ============================================================
   orari.ts — gli orari del menù per chi ordina dal QR. Puro.

   Il menù stampato dice: «Piatti disponibili dalle ore 12:15 alle
   14:30. "X" disponibile fino alle ore 17:30, venerdì e sabato fino
   alle ore 20:30». Nel back office si scrive in una riga di testo, per
   categoria o per articolo: «12:15-14:30; ven,sab 12:15-20:30».
   Parti separate da «;», davanti alle ore i giorni (nomi italiani,
   «ven,sab» o «lun-ven»). Vuoto = nessun vincolo proprio: l'articolo
   eredita gli orari della categoria. «sempre» = nessun vincolo E BASTA,
   anche se la categoria ne ha: e' per la focaccia del banco Bistrot messa
   fra le specialita' da condividere, che si ordina tutto il giorno (la
   proprieta', 6 settembre 2026). Una parte scritta male si salta. La fine e' esclusa e la finestra puo' passare
   la mezzanotte, come le fasce di prezzo (fasce.ts).

   Il palmare non guarda gli orari: il cameriere ordina quel che vuole.
   Lo prova orari.test.ts.
   ============================================================ */
import { type Adesso, dentroFinestra, minutiDi } from './fasce.ts';

export type Finestra = { dalle: string; alle: string; giorni: number[] | null };

const GIORNI = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const giornoDi = (s: string): number | null => { const i = GIORNI.indexOf(s.trim().toLowerCase().slice(0, 3)); return i < 0 ? null : i; };

/** «ven,sab» → [5, 6]; «lun-ven» → [1..5]; «» → null (tutti); false se non si capisce. */
function giorniDi(s: string): number[] | null | false {
  const parti = s.split(',').map((p) => p.trim()).filter(Boolean);
  if (!parti.length) return null;
  const out: number[] = [];
  for (const p of parti) {
    const estremi = p.split('-').map(giornoDi);
    if (estremi.length > 2 || estremi.some((g) => g === null)) return false;
    const [da, a] = estremi as number[];
    if (a === undefined) { out.push(da); continue; }
    for (let g = da; ; g = (g + 1) % 7) { out.push(g); if (g === a) break; }
  }
  return out;
}

/** La riga di testo → le finestre. null = niente di proprio (si eredita);
 *  [] = «sempre», nessuna finestra, aperto e basta. */
export function leggiOrari(testo: unknown): Finestra[] | null {
  const s = String(testo ?? '').trim();
  if (!s) return null;
  if (/^sempre$/i.test(s)) return [];
  const out: Finestra[] = [];
  for (const parte of s.split(';')) {
    const m = parte.trim().match(/^(.*?)\s*(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/);
    if (!m) continue;
    const da = minutiDi(m[2]), a = minutiDi(m[3]);
    if (da === null || a === null) continue;
    const giorni = giorniDi(m[1]);
    if (giorni === false) continue;
    out.push({ dalle: hhmm(da), alle: hhmm(a), giorni });
  }
  return out.length ? out : null;
}

/** Si puo' ordinare adesso? Senza finestre, sempre. */
export function apertoOra(finestre: Finestra[] | null | undefined, adesso: Adesso): boolean {
  /* null (niente di proprio) e [] («sempre») aprono tutti e due: e la lista vuota
     di «sempre» che deve vincere sugli orari della categoria */
  return !finestre || !finestre.length || finestre.some((f) => dentroFinestra(f.dalle, f.alle, f.giorni, adesso));
}

/** Le stesse finestre con la fine anticipata di `minuti`: chi ordina dal
    QR si ferma dieci minuti prima, cosi' alle 14:30 in punto la cucina non
    trova un ordine nuovo (la proprieta', 5 settembre 2026). «Tutto il
    giorno» resta com'e'; una finestra piu' corta del margine sparisce. */
export function restringi(finestre: Finestra[] | null | undefined, minuti: number): Finestra[] | null {
  if (!finestre) return null;
  const out: Finestra[] = [];
  for (const f of finestre) {
    const da = minutiDi(f.dalle), a = minutiDi(f.alle);
    if (da === null || a === null) continue;
    if (da === a) { out.push(f); continue; }
    const durata = a > da ? a - da : a + 24 * 60 - da;
    if (durata <= minuti) continue;
    out.push({ ...f, alle: hhmm(((a - minuti) % (24 * 60) + 24 * 60) % (24 * 60)) });
  }
  return out;
}

/** A cucina chiusa il biglietto della cucina esce al bancone: i cuochi
    non ci sono piu' (la proprieta', 5 settembre 2026). Gli orari della
    cucina stanno sul locale (pos_locale.orari_cucina); vuoti = sempre. */
export function stampanteAdesso(stampante: 'cucina' | 'bar', orariCucina: unknown, adesso: Adesso): 'cucina' | 'bar' {
  if (stampante !== 'cucina') return stampante;
  return apertoOra(leggiOrari(orariCucina), adesso) ? 'cucina' : 'bar';
}
