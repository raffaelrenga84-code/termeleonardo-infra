/* ============================================================
   tipi.ts — validazione dei dati propri di ogni tipo di richiesta.

   Modulo puro: dati dentro, dati validati fuori. Nessuna rete, nessun
   database, cosi' si prova per intero senza toccare la produzione.

   I tipi si aggiungono qui e basta: la tabella tiene i campi propri in
   jsonb, quindi un tipo nuovo non richiede una migrazione.
   ============================================================ */

import { luogoValido } from './luoghi.ts';

export const TIPI_ATTIVI = ['soggiorno', 'transfer'] as const;

type Esito = { errore?: string; dati?: Record<string, unknown> };

const testo = (v: unknown) => String(v ?? '').trim();
const GIORNO_MS = 86400000;
const ANNI_AVANTI = 2;

/* la data deve esistere davvero: new Date('2026-02-31') non protesta,
   scivola al 3 marzo. Il confronto con la stringa di partenza lo scopre. */
function giorno(s: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(s + 'T12:00:00Z');
  if (isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) return null;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/* comune a tutti i tipi: una data di servizio non nel passato e non oltre
   due anni. Oggi stesso e' legittimo — chi atterra fra tre ore ha diritto
   di chiedere un taxi. */
function dataServizio(v: unknown, oggi: Date): { errore?: string; valore?: string } {
  const s = testo(v);
  if (!s) return { errore: 'data mancante' };
  const g = giorno(s);
  if (g === null) return { errore: 'data non valida' };
  const adesso = Date.UTC(oggi.getUTCFullYear(), oggi.getUTCMonth(), oggi.getUTCDate());
  if (g < adesso) return { errore: 'data nel passato' };
  const limite = new Date(adesso);
  limite.setUTCFullYear(limite.getUTCFullYear() + ANNI_AVANTI);
  if (g > limite.getTime()) return { errore: 'data troppo lontana' };
  return { valore: s };
}

function ora(v: unknown): { errore?: string; valore?: string } {
  const s = testo(v);
  if (!s) return { errore: 'ora mancante' };
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(s)) return { errore: 'ora non valida' };
  return { valore: s };
}

function intero(v: unknown, min: number, max: number): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}

/* ---------------- transfer ---------------- */
/* Il modulo ATAM chiede data, ora, passeggeri, arrivo o partenza e un luogo
   dal suo elenco chiuso. Il pagamento non si chiede all'ospite: sul loro
   modulo lo sceglie la reception fra diretto, hotel e fattura, ed e' una
   decisione loro. */
function validaTransfer(d: Record<string, unknown>, oggi: Date): Esito {
  const data = dataServizio(d.quando, oggi);
  if (data.errore) return { errore: data.errore };

  const o = ora(d.ora);
  if (o.errore) return { errore: o.errore };

  const pax = intero(d.pax, 1, 8);
  if (pax === null) return { errore: 'passeggeri non validi' };

  const verso = testo(d.verso);
  if (verso !== 'arrivo' && verso !== 'partenza') {
    return { errore: 'indicare arrivo o partenza' };
  }

  /* deve combaciare parola per parola con l'elenco ATAM: il valore finisce
     ricopiato nel loro modulo, e uno che non corrisponde costringe a
     cercarlo a mano fra 189 voci */
  if (!luogoValido(d.luogo)) return { errore: 'luogo non in elenco' };

  const volo = testo(d.volo);
  if (volo.length > 40) return { errore: 'volo troppo lungo' };
  const note = testo(d.note);
  if (note.length > 2000) return { errore: 'note troppo lunghe' };

  return {
    dati: {
      quando: data.valore, ora: o.valore, pax, verso,
      luogo: testo(d.luogo), volo, ritorno: d.ritorno === true, note,
    },
  };
}

/* ---------------- soggiorno ---------------- */
/* Il tipo storico: i suoi campi stanno nelle colonne della tabella, non in
   jsonb, e li controlla valida.ts. Qui non c'e' nulla da validare. */
function validaSoggiorno(): Esito {
  return { dati: {} };
}

export function validaDati(
  tipo: string,
  d: Record<string, unknown>,
  oggi: Date = new Date(),
): Esito {
  switch (tipo) {
    case 'soggiorno': return validaSoggiorno();
    case 'transfer': return validaTransfer(d || {}, oggi);
    default: return { errore: 'tipo di richiesta sconosciuto' };
  }
}
