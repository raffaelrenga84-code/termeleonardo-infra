/* componi-richiesta.ts — decide cosa si valida e cosa finisce dove per una
   nuova richiesta dal sito: contatti, colonne della tabella, e la parte
   jsonb `dati`. Prima viveva dentro Deno.serve in index.ts, quindi non era
   collaudabile — e infatti nessun test si era accorto che la camera scelta
   su una richiesta di soggiorno non arrivava mai in colonna `dati`.
   Modulo puro: dati dentro, dati fuori. Nessuna rete, nessun database.
   Presidiato da componi-richiesta.test.ts. */

import { validaContatti, validaRichiesta } from './valida.ts';
import { TIPI_ATTIVI, validaDati } from './tipi.ts';

const testo = (v: unknown) => String(v ?? '').trim();

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

/* Il telefono e' obbligatorio per ogni richiesta, chat compresa: fino al 15
   agosto 2026 la chat (chat/index.ts, invia_richiesta, origine 'assistente
   del sito') era l'unica esentata, in attesa di una decisione della
   proprieta'. La decisione e' arrivata — niente piu' eccezioni — e la chat
   ora chiede il numero prima di provare a registrare (vedi chat/prompt.ts):
   qui non serve piu' riconoscere il canale, ne' passargli opzioni diverse
   da chiunque altro. */
export function componiRichiesta(corpo: Record<string, unknown>): Composta {
  const tipo = testo(corpo.tipo) || 'soggiorno';

  /* IL TIPO ARRIVA DAL BROWSER, E QUI DIVENTA UN CANCELLO.

     TIPI_ATTIVI e' l'elenco dei tipi che il pubblico puo' creare. `arrivo` e
     `fattura` ne stanno fuori APPOSTA: li crea solo ?a=invia-arrivo, che
     pretende il token del link mandato per email.

     Ma finche' nessuno lo controllava era un invariante ASSERITO, non
     imposto: il tipo passava dritto a validaDati, il cui switch conosce
     anche quei due. E la guardia sul doppio invio del check-in guarda
     proprio le righe di tipo `arrivo` — chi avesse avuto il token di un
     ospite poteva crearne una dal modulo pubblico e chiuderlo fuori dal
     proprio check-in.

     Serve gia' avere quel token, che e' lo stesso segreto con cui si
     compilerebbe il modulo direttamente: per chi attacca non c'e' guadagno.
     Ma una guardia non deve appoggiarsi a una promessa scritta altrove.

     includes() su un elenco e non una ricerca dentro un oggetto: una chiave
     come "toString" esiste su Object.prototype, ed e' il difetto gia' pagato
     coi circoli del golf in tipi.ts. */
  if (!(TIPI_ATTIVI as readonly string[]).includes(tipo)) {
    return { errore: 'tipo di richiesta sconosciuto' };
  }

  if (tipo === 'soggiorno') {
    const { errore, dati } = validaRichiesta(corpo);
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

  const c = validaContatti(corpo);
  if (c.errore || !c.dati) return { errore: c.errore };
  const d = validaDati(tipo, (corpo.dati || {}) as Record<string, unknown>);
  if (d.errore || !d.dati) return { errore: d.errore };
  return { tipo, contatti: c.dati, colonne: { ...c.dati }, dati: d.dati };
}
