/* ============================================================
   arrivo-invio.ts — da una compilazione del check-in alle richieste.

   Fino a oggi il modulo d'arrivo scriveva in una tabella sua e mandava
   un'email a mano: niente numero, niente ricevuta, niente prezzo, e in
   back office una schermata in sola lettura. Da qui in poi produce
   richieste vere, cioe' le stesse cose che nascono dai moduli del sito.

   UNA COMPILAZIONE, FINO A TRE PEZZI. L'arrivo c'e' sempre; il transfer e
   la fattura solo se spuntati. Le sezioni non spuntate non fanno nascere
   niente — e una sezione spuntata e vuota e' un ERRORE, non una riga
   vuota: una richiesta di transfer senza luogo ne' data manderebbe la
   reception a telefonare per chiedere cosa ha chiesto l'ospite.

   TUTTO O NIENTE. Se un pezzo non passa la validazione non ne nasce
   nessuno: meta' compilazione salvata sarebbe peggio di niente, perche'
   l'ospite crede di aver mandato tutto.

   Modulo puro: dati dentro, dati fuori. Nessuna rete, nessun database.
   ============================================================ */
import { validaDati } from './tipi.ts';

export type Pezzo = {
  tipo: 'arrivo' | 'transfer' | 'fattura';
  dati: Record<string, unknown>;
};

export type Pezzi = { errore?: string; pezzi?: Pezzo[] };

const oggetto = (v: unknown): Record<string, unknown> =>
  (v && typeof v === 'object') ? v as Record<string, unknown> : {};

export function pezziDaArrivo(corpo: Record<string, unknown>, oggi: Date = new Date()): Pezzi {
  const pezzi: Pezzo[] = [];

  /* l'arrivo c'e' sempre: anche chi non spunta niente ha detto qualcosa
     compilando (o non compilando) l'ora, e quella riga e' la scheda
     dell'arrivo */
  const a = validaDati('arrivo', corpo, oggi);
  if (a.errore || !a.dati) return { errore: a.errore ?? 'arrivo non valido' };
  pezzi.push({ tipo: 'arrivo', dati: a.dati });

  if (corpo.transfer === true) {
    const t = validaDati('transfer', oggetto(corpo.transfer_dati), oggi);
    if (t.errore || !t.dati) return { errore: t.errore ?? 'transfer non valido' };
    pezzi.push({ tipo: 'transfer', dati: t.dati });
  }

  if (corpo.fattura === true) {
    const f = validaDati('fattura', oggetto(corpo.fattura_dati), oggi);
    if (f.errore || !f.dati) return { errore: f.errore ?? 'fattura non valida' };
    pezzi.push({ tipo: 'fattura', dati: f.dati });
  }

  return { pezzi };
}
