/* ============================================================
   ospiti-camera.test.ts — in una camera doppia gli ospiti sono due.

   Fidra scrive i nomi uno sotto l'altro, ma fra l'uno e l'altro infila la
   tessera, il check-out e «Modifica»: la vecchia finestra di sedici righe
   si chiudeva sul primo, e al secondo il consenso privacy non arrivava
   (la proprieta', 4 settembre 2026 — camera 412, Schneider e Marquardt).
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';

const S = Deno.readTextFileSync(new URL('./extractor.js', import.meta.url));

/* La pagina come la vede l'estrattore: una riga per elemento. Sono le
   righe vere della prenotazione 18757, camere 412 (due ospiti) e 429. */
const PAGINA = [
  'Doppia n. 412',
  'Adulti 2 Bambini 0 Eta Bambini',
  'DOLCE VITA 5 CURE',
  'Soggiornanti 2 di 2',
  'Check-in 2 di 2',
  'Totale 1.458,00 € p.p.',
  'Opzioni',
  'SF',
  'Schneider Felix Alexander',
  'vai al Soggiorno',
  '914 B',
  'CHECK-OUT',
  'Modifica',
  'MC',
  'Marquardt Clara',
  'vai al Soggiorno',
  'Mi.Pr. Mezza Pensione',
  '1782 R',
  'CHECK-OUT',
  'Modifica',
  'Extra',
  'Singola Parco n. 429',
  'Adulti 1 Bambini 0 Eta Bambini',
  'MIGLIOR PREZZO MEZZA PENSIONE',
  'Soggiornanti 1 di 1',
  'Check-in 1 di 1',
  'Totale 1.190,00 € p.p.',
  'Opzioni',
  'GE',
  'Gutbrecht Edith',
  'vai al Soggiorno',
  '1815 R',
  'CHECK-OUT',
  'Modifica',
];

/** Rifà, sul testo dell'estrattore, il modo in cui delimita i nomi. */
function ospitiPerCamera(L: string[]): string[][] {
  const fuori: string[][] = [];
  L.forEach((line, i) => {
    const line2 = line.replace(/\s*[^\w\s]*\s*fix\s*$/i, '').trim();
    if (!/^(.+?)\s+n\.\s*(\d*)\s*$/.test(line2)) return;
    if (!/Adulti\s*\d+\s*Bambini\s*\d+/.test(L.slice(i, i + 16).join(' | '))) return;
    let fine = Math.min(L.length, i + 80);
    for (let j = i + 1; j < fine; j++) {
      const l3 = L[j].replace(/\s*[^\w\s]*\s*fix\s*$/i, '').trim();
      if (!/^(.+?)\s+n\.\s*(\d*)\s*$/.test(l3)) continue;
      if (/Adulti\s*\d+\s*Bambini\s*\d+/.test(L.slice(j, j + 16).join(' | '))) { fine = j; break; }
    }
    const blocco = L.slice(i, fine);
    const nomi: string[] = [];
    blocco.forEach((x, j) => { if (x === 'vai al Soggiorno' && blocco[j - 1]) nomi.push(blocco[j - 1]); });
    fuori.push(nomi);
  });
  return fuori;
}

Deno.test('la doppia da due nomi, la singola uno: il secondo ospite non si perde piu', () => {
  const per = ospitiPerCamera(PAGINA);
  assertEquals(per.length, 2, 'due camere');
  assertEquals(per[0], ['Schneider Felix Alexander', 'Marquardt Clara']);
  assertEquals(per[1], ['Gutbrecht Edith']);
});

Deno.test('i nomi di una camera non sconfinano in quella dopo', () => {
  const per = ospitiPerCamera(PAGINA);
  assert(!per[0].includes('Gutbrecht Edith'), 'la finestra si chiude sulla camera successiva');
});

Deno.test('l estrattore guarda oltre le sedici righe, ma solo per i nomi', () => {
  assert(S.includes('const bloccoOspiti = L.slice(i, fine)'), 'una finestra apposta per i nomi');
  assert(S.includes('bloccoOspiti.forEach'), 'i nomi si leggono da li');
  assert(S.includes('const blocco = L.slice(i, i + 16)'), 'totale ed extra restano sulle sedici righe di prima');
});
