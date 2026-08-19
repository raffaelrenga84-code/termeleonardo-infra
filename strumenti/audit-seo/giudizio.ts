/* ============================================================
   Da campi a sospetti.

   Sta in un file suo perche' e' la parte che cambiera': i limiti di
   lunghezza sono convenzioni, non leggi, e il giorno che si decide che un
   titolo puo' arrivare a settanta caratteri si tocca questo file e nessun
   altro.

   SOSPETTI, NON ERRORI. Ogni frase e' scritta perche' una persona la legga
   e decida. Nessuna di queste righe va applicata a occhi chiusi.
   ============================================================ */
import type { Campi } from './leggi-pagina.ts';
import { sospettoLingua } from './lingua.ts';

/* Quanto Google mostra, all'incirca: oltre, la coda viene tagliata e la
   promessa che ci avevi messo non si legge. */
export const TITOLO_MAX = 60;
export const DESCRIZIONE_MAX = 160;

export type Riga = Campi & {
  url: string;
  stato: number;
  finale: string;
  byte: number;
  ms: number;
};

export function sospetti(r: Riga): string[] {
  const s: string[] = [];

  if (r.stato !== 200) s.push(`risponde ${r.stato}`);

  if (!r.titolo) {
    s.push('senza titolo');
  } else {
    if (r.titolo.length > TITOLO_MAX) {
      s.push(
        `titolo di ${r.titolo.length} caratteri: Google ne mostra circa ${TITOLO_MAX}`,
      );
    }
    if (/ {2}/.test(r.titolo)) s.push('doppio spazio dentro il titolo');
  }

  if (!r.descrizione) {
    s.push('senza description');
  } else if (r.descrizione.length > DESCRIZIONE_MAX) {
    s.push(
      `description di ${r.descrizione.length} caratteri: Google ne mostra circa ${DESCRIZIONE_MAX}`,
    );
  }

  if (r.h1.length === 0) s.push('nessun h1');
  else if (r.h1.length > 1) s.push(`${r.h1.length} h1 nella stessa pagina`);

  if (!r.canonical) s.push('nessun canonical');
  if (r.hreflang.length === 0) s.push('nessun hreflang, e le lingue sono quattro');

  if (r.senzaAlt > 0) s.push(`${r.senzaAlt} immagini su ${r.immagini} senza alt`);

  const l = sospettoLingua(r.lang, `${r.titolo} ${r.descrizione}`);
  if (l) s.push(l);

  return s;
}
