/* disponibilita.ts — riduce la risposta di /api/available/rates a quello che
   serve alla pagina.

   ATTENZIONE ALL'UNITA': l'API lavora in CENTESIMI. 15500 sono 155,00 euro.
   Il campo si chiama `prezzo_cent` proprio perche' nessuno debba ricordarselo:
   la stessa trappola ha gia' prodotto un difetto nella funzione `chat`. */

import { CAMERE, descrizioneCamera } from './camere.ts';
import { condizioni } from './condizioni.ts';
import { PREZZO_MAX_CENT } from './tipi.ts';
import type { ParametriDisponibilita } from './valida.ts';

/* ---------------------------------------------------------------
   Il corpo per check-availability. Sta qui, in un modulo puro, perche' e' un
   valore che attraversa un confine: i nomi sono quelli dell'API a monte
   (from_date, adults...), non i nostri, e `children_ages` e' una STRINGA con
   le eta' separate da virgola — "4,9" — che e' il formato dichiarato da
   check-availability (`children_ages?: string`) e quello che la funzione
   `chat` manda gia' oggi in produzione. Un array [4, 9] o veniva rifiutato
   (e l'ospite leggeva che non siamo riusciti a controllare la disponibilita')
   o veniva ignorato, e allora il motore quotava un prezzo senza i bambini:
   il caso peggiore, perche' quel prezzo poi si mostra, si sceglie e si
   archivia. Presidiato da disponibilita.test.ts. */
export function corpoDisponibilita(p: ParametriDisponibilita): Record<string, unknown> {
  return {
    from_date: p.check_in,
    to_date: p.check_out,
    adults: p.adulti,
    ...(p.bambini > 0
      ? { children: p.bambini, children_ages: p.eta_bambini.join(',') }
      : {}),
  };
}

export type Proposta = {
  camera_id: number;
  nome: string;
  descrizione: string;
  max_adulti: number;
  tariffa_id: number;
  variante_id: number;
  tariffa: string;
  trattamento: string;
  prezzo_cent: number;
};

const n = (v: unknown): number | null =>
  typeof v === 'number' && isFinite(v) ? v : null;

/* Quello che si e' capito della risposta: le proposte mostrabili, quante ne
   sono state scartate, e se la risposta aveva la forma attesa. Serve a
   distinguere due situazioni che non vanno raccontate allo stesso modo:
   "non ci sono camere libere" e "non abbiamo capito la risposta". */
export type Lettura = {
  proposte: Proposta[];
  scartate: number;
  forma: 'attesa' | 'inattesa';
};

/* Non si mostra cio' che poi non si potrebbe inviare.
   La pagina propone, tipi.ts dispone: se una proposta passa di qui ma
   validaSoggiorno la rifiuterebbe, l'ospite la vede, la sceglie, compila
   tutto, preme invia e legge un errore generico che non parla di camere.
   Gli stessi criteri, quindi, e nello stesso ordine:
   - la categoria deve stare nel catalogo (tipi.ts: 'camera sconosciuta');
   - il prezzo dev'essere intero, non negativo, sotto il tetto ('prezzo non
     valido') — i centesimi sono interi per definizione;
   - la variante dev'essere un intero non negativo ('variante non valida'). */
function mostrabile(camera_id: number, prezzo_cent: number, variante_id: number): boolean {
  if (!Number.isInteger(camera_id) || !CAMERE[camera_id]) return false;
  if (!Number.isInteger(prezzo_cent) || prezzo_cent < 0 || prezzo_cent > PREZZO_MAX_CENT) return false;
  if (!Number.isInteger(variante_id) || variante_id < 0) return false;
  return true;
}

export function leggiDisponibilita(grezzo: unknown, lingua: string): Lettura {
  if (!Array.isArray(grezzo)) return { proposte: [], scartate: 0, forma: 'inattesa' };
  const fuori: Proposta[] = [];
  let scartate = 0;
  let forma: 'attesa' | 'inattesa' = 'attesa';
  /* il primo livello e' una camera richiesta, il secondo le categorie */
  for (const gruppo of grezzo) {
    /* un array di qualcosa che non sono gruppi non e' la forma che
       conosciamo: meglio dirlo che far finta di essere pieni */
    if (!Array.isArray(gruppo)) { forma = 'inattesa'; continue; }
    for (const c of gruppo) {
      const id = n(c?.room_category_id);
      if (id === null) { scartate++; continue; }
      /* il nome viene dal catalogo e solo da li': ripiegare sul nome
         dell'API faceva comparire categorie che l'invio poi rifiuta */
      const cat = CAMERE[id];
      for (const tariffa of (Array.isArray(c?.rates) ? c.rates : [])) {
        for (const v of (Array.isArray(tariffa?.rate_variations) ? tariffa.rate_variations : [])) {
          const tot = n(v?.total);
          const variante = n(v?.id) ?? 0;
          if (tot === null || !cat || !mostrabile(id, tot, variante)) { scartate++; continue; }
          fuori.push({
            camera_id: id,
            nome: cat.nome,
            descrizione: descrizioneCamera(id, lingua),
            max_adulti: n(c?.room_category?.max_adults) ?? 0,
            tariffa_id: n(tariffa?.id) ?? 0,
            variante_id: variante,
            tariffa: String(v?.rate_name ?? tariffa?.name ?? '').trim(),
            trattamento: String(v?.name ?? '').trim(),
            prezzo_cent: tot,
          });
        }
      }
    }
  }
  return { proposte: fuori, scartate, forma };
}

export function normalizzaDisponibilita(grezzo: unknown, lingua: string): Proposta[] {
  return leggiDisponibilita(grezzo, lingua).proposte;
}

/* 75 euro a persona, per adulto: e' cosi' che la reception calcola l'acconto
   nelle offerte (acconto / adulti). A camera sarebbe la meta' su una doppia,
   e due canali che chiedono cifre diverse per la stessa camera diventano un
   reclamo al check-in. */
export function caparraCent(adulti: number): number {
  const a = Number.isFinite(adulti) && adulti > 0 ? Math.floor(adulti) : 1;
  return 7500 * a;
}

/* Compone la risposta dell'azione `a=disponibilita`. Sta qui e non in
   index.ts, che avvia il server al caricamento e non e' importabile da un
   test. */
export function componiRisposta(grezzo: unknown, adulti: number, lingua: string): {
  esito: string; valuta: string; proposte: Proposta[];
  caparra_cent: number; condizioni: { righe: string[]; recesso: string };
} {
  const l = leggiDisponibilita(grezzo, lingua);
  /* Un guasto non si racconta come "albergo pieno". Prima qualunque JSON di
     forma inattesa dava proposte: [] con esito 'ok', e la pagina scriveva
     "Non risultano camere libere per queste date": l'ospite se ne andava
     invece di telefonare. Sono due cose diverse e adesso si distinguono:
     - forma inattesa: non abbiamo capito la risposta;
     - tutto scartato: il motore proponeva qualcosa che noi non sappiamo
       trattare (una categoria nuova, un prezzo fuori scala) — il nostro
       catalogo e' indietro, l'albergo non e' pieno.
     Un array vuoto, o gruppi vuoti, restano invece "ok" con zero proposte:
     quello e' davvero il caso in cui non c'e' posto. */
  const guasto = l.forma === 'inattesa' || (l.proposte.length === 0 && l.scartate > 0);
  return {
    esito: guasto ? 'errore' : 'ok',
    /* dichiarata sempre: la stessa unita' non dichiarata ha gia' prodotto un
       difetto nella funzione chat */
    valuta: 'centesimi',
    proposte: l.proposte,
    caparra_cent: caparraCent(adulti),
    condizioni: condizioni(lingua),
  };
}
