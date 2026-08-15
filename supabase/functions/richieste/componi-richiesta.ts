/* componi-richiesta.ts — decide cosa si valida e cosa finisce dove per una
   nuova richiesta dal sito: contatti, colonne della tabella, e la parte
   jsonb `dati`. Prima viveva dentro Deno.serve in index.ts, quindi non era
   collaudabile — e infatti nessun test si era accorto che la camera scelta
   su una richiesta di soggiorno non arrivava mai in colonna `dati`.
   Modulo puro: dati dentro, dati fuori. Nessuna rete, nessun database.
   Presidiato da componi-richiesta.test.ts. */

import { validaContatti, validaRichiesta } from './valida.ts';
import { validaDati } from './tipi.ts';

const testo = (v: unknown) => String(v ?? '').trim();

/* La chat (chat/index.ts, invia_richiesta) registra richieste per conto
   dell'ospite e manda sempre questo valore in `origine`. Non sempre ha un
   telefono: lo chiede ma non lo pretende, e oggi manda un segnaposto per
   l'email quando manca lei, non il telefono. Il telefono obbligatorio qui
   sotto e' una decisione nuova, presa per il modulo del sito (15 agosto
   2026): se debba valere anche per la chat — farla chiedere sempre il
   numero prima di registrare, o lasciarla come e' — non e' ancora deciso.
   Nel frattempo si riconosce il canale da questo segnale, gia' mandato
   oggi, cosi' la chat non smette di poter registrare richieste mentre la
   decisione si aspetta. ATTENZIONE: `origine` e' testo che arriva dal
   chiamante, non una credenziale — chi lo imposta allo stesso valore
   ottiene la stessa esenzione. Non e' un problema di sicurezza (il
   telefono e' una questione di qualita' del dato, non un controllo
   antifrode) ma va saputo, non dimenticato. */
const ORIGINE_CHAT = 'assistente del sito';

export type Contatti = { nome: string; email: string; telefono: string; lingua: string };

export type Composta = {
  errore?: string;
  tipo?: string;
  contatti?: Contatti;
  colonne?: Record<string, unknown>;
  /* la parte jsonb: null quando la richiesta non porta niente di proprio
     (es. il soggiorno senza camera scelta), MAI un oggetto vuoto — back
     office ed email leggono questa colonna e non devono vedere le due
     situazioni confuse */
  dati?: Record<string, unknown> | null;
};

export function componiRichiesta(corpo: Record<string, unknown>): Composta {
  const tipo = testo(corpo.tipo) || 'soggiorno';
  const opzioni = { telefonoObbligatorio: testo(corpo.origine) !== ORIGINE_CHAT };

  if (tipo === 'soggiorno') {
    const { errore, dati } = validaRichiesta(corpo, undefined, opzioni);
    if (errore || !dati) return { errore };
    const contatti: Contatti = { nome: dati.nome, email: dati.email, telefono: dati.telefono, lingua: dati.lingua };

    /* la camera e' facoltativa: la pagina di prenotazione la manda sempre,
       ma la chat (chat/index.ts, invia_richiesta) manda tipo:'soggiorno'
       senza campo dati, e deve continuare a produrre `dati: null` come
       faceva prima — mai un oggetto vuoto al suo posto, perche' back office
       ed email leggono quella colonna per distinguere le due situazioni.
       La validazione resta quella di sempre, validaDati('soggiorno', ...)
       da tipi.ts: respinge camere inesistenti, prezzi non interi, varianti
       negative — qui non si riscrive e non si aggira. */
    const grezzo = (corpo.dati && typeof corpo.dati === 'object')
      ? corpo.dati as Record<string, unknown> : {};
    const v = validaDati('soggiorno', grezzo);
    if (v.errore) return { errore: v.errore };
    const jsonb = v.dati && Object.keys(v.dati).length > 0 ? v.dati : null;

    return { tipo, contatti, colonne: dati, dati: jsonb };
  }

  const c = validaContatti(corpo, opzioni);
  if (c.errore || !c.dati) return { errore: c.errore };
  const d = validaDati(tipo, (corpo.dati || {}) as Record<string, unknown>);
  if (d.errore || !d.dati) return { errore: d.errore };
  return { tipo, contatti: c.dati, colonne: { ...c.dati }, dati: d.dati };
}
