/* ============================================================
   streaming.ts — ricomporre a pezzi quello che il modello manda a pezzi.

   xAI (come OpenAI) manda la risposta come una sequenza di eventi SSE, uno
   per frammento: il testo arriva lettera per lettera (piu' o meno), e un
   tool_call arriva ANCORA piu' a pezzi — nome e id nel primo frammento,
   poi gli argomenti JSON spezzati arbitrariamente su piu' frammenti, senza
   nessuna garanzia che uno spezzone coincida con una porzione di JSON
   valida. Prima di poter eseguire uno strumento bisogna aver rimesso
   insieme la stringa `arguments` per intero.

   Tutto quello che conta per questa ricomposizione sta qui, in funzioni
   pure: nessuna qui dentro chiama `fetch` o `Deno.serve`. E' cosi' che si
   prova la parte delicata — la ricomposizione — senza mai chiamare xAI
   davvero, e senza il rischio (gia' successo in questo progetto) che un
   pezzo di logica nascosto dentro il gestore della richiesta resti non
   collaudato da nessuno.
   ============================================================ */

/** un modello che continua a chiamare strumenti va fermato comunque */
export const GIRI_MAX = 4;

/* ---------------- i tipi del formato a pezzi di OpenAI/xAI ---------------- */

export type PezzoStrumento = {
  index: number;
  id?: string;
  type?: string;
  function?: { name?: string; arguments?: string };
};

export type SceltaChunk = {
  delta?: { content?: string | null; tool_calls?: PezzoStrumento[] };
  finish_reason?: string | null;
};

export type ChunkXAI = {
  choices?: SceltaChunk[];
  usage?: { prompt_tokens_details?: { cached_tokens?: number } };
};

export type StrumentoAccumulato = {
  id: string;
  type: string;
  function: { name: string; arguments: string };
};

/* ---------------- lo stato accumulato di UNA risposta del modello ---------------- */

export type StatoStream = {
  contenuto: string;
  strumentiPerIndice: Map<number, StrumentoAccumulato>;
  finito: string | null;
  cachedTokens: number | null;
};

export function statoIniziale(): StatoStream {
  return { contenuto: '', strumentiPerIndice: new Map(), finito: null, cachedTokens: null };
}

/* Un Map indicizzata, non un array: i pezzi di tool_calls dichiarano il
   proprio `index`, e niente garantisce che arrivino in ordine (anche se in
   pratica di solito arrivano in ordine). Un array con buchi si comporta
   male con .map/.forEach; una Map no, e all'uso si riordina con
   strumentiOrdinati(). */
export function strumentiOrdinati(stato: StatoStream): StrumentoAccumulato[] {
  return [...stato.strumentiPerIndice.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, v]) => v);
}

/* Riduce UN chunk nello stato accumulato finora. Pura: stesso chunk, stesso
   risultato, sempre — e' quello che la rende testabile senza rete.
   Il chunk finale con l'uso della cache (stream_options.include_usage) non
   ha `choices`: va letto comunque, non solo quando c'e' una scelta. */
export function accumula(stato: StatoStream, chunk: ChunkXAI): StatoStream {
  const cachedTokens = chunk?.usage?.prompt_tokens_details?.cached_tokens ?? stato.cachedTokens;
  const scelta = chunk?.choices?.[0];
  if (!scelta) return { ...stato, cachedTokens };

  const contenuto = stato.contenuto + (scelta.delta?.content ?? '');
  const strumentiPerIndice = scelta.delta?.tool_calls
    ? fondiStrumenti(stato.strumentiPerIndice, scelta.delta.tool_calls)
    : stato.strumentiPerIndice;
  const finito = scelta.finish_reason ?? stato.finito;

  return { contenuto, strumentiPerIndice, finito, cachedTokens };
}

/* Il primo pezzo di un tool_call porta id/type/function.name; quelli dopo
   portano SOLO un frammento nuovo di `arguments`, da concatenare — mai da
   sostituire, altrimenti si perde tutto quello arrivato prima. Un indice
   mai visto apre una voce nuova; indici diversi restano sempre separati,
   anche se i loro pezzi arrivano intrecciati (il modello puo' chiamare piu'
   di uno strumento nella stessa risposta). */
function fondiStrumenti(
  esistenti: Map<number, StrumentoAccumulato>,
  pezzi: PezzoStrumento[],
): Map<number, StrumentoAccumulato> {
  const copia = new Map(esistenti);
  for (const p of pezzi) {
    const attuale = copia.get(p.index) ?? { id: '', type: 'function', function: { name: '', arguments: '' } };
    copia.set(p.index, {
      id: p.id ?? attuale.id,
      type: p.type ?? attuale.type,
      function: {
        name: p.function?.name ?? attuale.function.name,
        arguments: attuale.function.arguments + (p.function?.arguments ?? ''),
      },
    });
  }
  return copia;
}

/* ---------------- il livello SSE: righe a pezzi di rete ---------------- */

export type EventoSSE = { tipo: 'chunk'; dati: ChunkXAI } | { tipo: 'fine-sse' };

/* Pura: bufferizza per RIGA, non per pezzo di rete. Un pezzo TCP puo'
   spezzare una riga "data: {...}" in un punto qualunque — questa funzione
   non decide mai che una riga e' completa finche' non vede l'a-capo che la
   chiude; quello che resta senza a-capo torna nel buffer e aspetta la
   prossima chiamata. E' questo — non un parser piu' furbo — che rende la
   ricomposizione indifferente a DOVE cade il confine fra due pezzi di rete. */
export function estraiEventiSSE(bufferPrecedente: string, pezzo: string): { eventi: EventoSSE[]; buffer: string } {
  let buffer = bufferPrecedente + pezzo;
  const eventi: EventoSSE[] = [];
  let pos: number;
  while ((pos = buffer.indexOf('\n')) !== -1) {
    const riga = buffer.slice(0, pos).replace(/\r$/, '');
    buffer = buffer.slice(pos + 1);
    if (!riga.startsWith('data:')) continue; // riga vuota o altro campo SSE: non riguarda xAI
    const valore = riga.slice(5).trim();
    if (!valore) continue;
    if (valore === '[DONE]') { eventi.push({ tipo: 'fine-sse' }); continue; }
    try {
      eventi.push({ tipo: 'chunk', dati: JSON.parse(valore) });
    } catch {
      /* un evento illeggibile si scarta: meglio perdere un frammento che far
         cadere l'intera conversazione per una riga corrotta in transito */
    }
  }
  return { eventi, buffer };
}

/* ---------------- dal corpo dello stream agli eventi di alto livello ---------------- */

export type EventoXAI =
  | { tipo: 'testo'; pezzo: string }
  | { tipo: 'fine'; motivo: string; contenuto: string; strumenti: StrumentoAccumulato[]; cachedTokens: number | null }
  | { tipo: 'troncato'; contenuto: string; strumenti: StrumentoAccumulato[]; cachedTokens: number | null };

/* Legge il body HTTP fino in fondo, un pezzo di rete alla volta, e lo
   trasforma negli eventi che contano per chi chiama: un 'testo' per ogni
   frammento nuovo di contenuto (per poterlo ritrasmettere subito al
   browser), e un evento finale — 'fine' se e' arrivato un finish_reason
   vero, 'troncato' se lo stream si e' chiuso PRIMA. Quest'ultimo caso e'
   la connessione che si interrompe a meta' frase: senza distinguerlo da una
   fine pulita, un pezzo di risposta a meta' verrebbe spacciato per completo. */
export async function* leggiStreamXAI(corpo: ReadableStream<Uint8Array>): AsyncGenerator<EventoXAI> {
  const reader = corpo.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let stato = statoIniziale();

  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      const estratti = estraiEventiSSE(buffer, decoder.decode(value, { stream: true }));
      buffer = estratti.buffer;
      let terminatoDaDone = false;
      for (const ev of estratti.eventi) {
        if (ev.tipo === 'fine-sse') { terminatoDaDone = true; break; }
        const primaLunghezza = stato.contenuto.length;
        stato = accumula(stato, ev.dati);
        const nuovo = stato.contenuto.slice(primaLunghezza);
        if (nuovo) yield { tipo: 'testo', pezzo: nuovo };
      }
      if (terminatoDaDone) break;
    }
  } finally {
    try { reader.releaseLock(); } catch { /* stream gia' chiuso: niente da rilasciare */ }
  }

  if (stato.finito) {
    yield { tipo: 'fine', motivo: stato.finito, contenuto: stato.contenuto, strumenti: strumentiOrdinati(stato), cachedTokens: stato.cachedTokens };
  } else {
    yield { tipo: 'troncato', contenuto: stato.contenuto, strumenti: strumentiOrdinati(stato), cachedTokens: stato.cachedTokens };
  }
}

/* ---------------- il wrapper attorno a fetch ---------------- */

/* L'unica funzione qui dentro che tocca la rete. E' comunque testabile
   sostituendo globalThis.fetch con uno finto che restituisce un body in
   streaming vero (una ReadableStream con dentro testo SSE reale) — mai
   chiamando xAI per davvero. */
export async function* chiediAlModelloStreaming(
  url: string,
  chiave: string,
  modello: string,
  messaggi: unknown[],
  strumenti: unknown[],
): AsyncGenerator<EventoXAI> {
  const r = await fetch(url, {
    method: 'POST',
    headers: { authorization: `Bearer ${chiave}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: modello,
      messages: messaggi,
      tools: strumenti,
      temperature: 0.3,
      stream: true,
      /* senza questo xAI non manda mai il chunk finale con `usage`: e' l'unico
         modo per sapere quanto del prompt (~9.300 token a domanda) viene
         riusato dalla cache invece che pagato e generato da zero */
      stream_options: { include_usage: true },
    }),
  });
  if (!r.ok || !r.body) {
    const corpo = await r.text().catch(() => '');
    throw new Error(`xAI ha risposto ${r.status}: ${corpo.slice(0, 300)}`);
  }
  yield* leggiStreamXAI(r.body);
}

/* ---------------- la cornice SSE verso il browser ---------------- */

/* Gli eventi che il widget riceve non sono il formato di xAI: sono i
   nostri, pensati per il widget (testo pronto da mostrare, il nome dello
   strumento partito, la fine con la stessa forma del JSON non-streaming). */
export function formattaEventoSSE(tipo: string, dati: unknown): string {
  return `event: ${tipo}\ndata: ${JSON.stringify(dati)}\n\n`;
}

/* ---------------- il ciclo GIRI_MAX / strumenti, in streaming ---------------- */

export type EsitoStrumento = { risultato: unknown; riferimento?: string | null };

export type EventoConversazione =
  | { tipo: 'testo'; pezzo: string }
  | { tipo: 'strumento'; nome: string }
  | { tipo: 'fine'; ok: true; risposta: string; riferimento: string | null; strumenti: string[]; cachedTokens: number | null }
  | {
    tipo: 'errore';
    ok: false;
    risposta: string;
    riferimento: string | null;
    strumenti: string[];
    cachedTokens: number | null;
    /** solo per chi chiama (log/registro): non va MAI mandato al browser cosi' com'e' */
    dettaglio: string;
  };

const RISPOSTA_FALLBACK =
  'Mi scusi, non riesco a completare la risposta. Ci scriva a info@termeleonardo.com o chiami la reception allo +39 049 9939200.';
const RISPOSTA_ERRORE =
  'Mi scusi, in questo momento ho un problema tecnico. Ci scriva a info@termeleonardo.com oppure chiami la reception allo +39 049 9939200.';

/* Il cuore del turno: chiama il modello, ritrasmette il testo mano a mano,
   ed esegue gli strumenti che chiede fino a GIRI_MAX. `chiamaModello` ed
   `eseguiStrumento` sono iniettati apposta — in produzione sono
   chiediAlModelloStreaming e le vere verificaCamere/inviaRichiesta, nei
   test sono finti — cosi' tutto il ciclo (compreso "cosa succede se il
   modello continua a chiamare strumenti", "cosa succede se lo stream si
   tronca a meta'") si prova senza rete e senza nascondere niente dentro
   Deno.serve. */
export async function* eseguiConversazioneStreaming(
  messaggiIniziali: Record<string, unknown>[],
  giriMax: number,
  chiamaModello: (messaggi: Record<string, unknown>[]) => AsyncGenerator<EventoXAI>,
  eseguiStrumento: (nome: string, args: Record<string, unknown>) => Promise<EsitoStrumento>,
): AsyncGenerator<EventoConversazione> {
  const messaggi = [...messaggiIniziali];
  const usati: string[] = [];
  let riferimento: string | null = null;
  let cachedTokens: number | null = null;
  let testoRisposta = '';
  let dettaglioErrore: string | null = null;

  try {
    for (let giro = 0; giro < giriMax; giro++) {
      const flusso = chiamaModello(messaggi);
      let esito: EventoXAI | null = null;
      for await (const ev of flusso) {
        if (ev.tipo === 'testo') yield { tipo: 'testo', pezzo: ev.pezzo };
        else esito = ev; // 'fine' o 'troncato': l'ultimo vince, ed e' l'unico che arriva
      }
      if (!esito) throw new Error('il flusso del modello e finito senza un esito');
      if (esito.cachedTokens != null) cachedTokens = esito.cachedTokens;
      if (esito.tipo === 'troncato') throw new Error('il flusso del modello si e interrotto a meta\'');

      const strumentiRichiesti = esito.strumenti;
      /* si rimanda al modello lo stesso messaggio che ha prodotto, con i
         tool_calls ricomposti: e' il turno successivo che ne ha bisogno
         per sapere a quale chiamata risponde ogni risultato di 'tool' */
      messaggi.push({
        role: 'assistant',
        content: esito.contenuto || null,
        ...(strumentiRichiesti.length ? { tool_calls: strumentiRichiesti } : {}),
      });

      if (!strumentiRichiesti.length) { testoRisposta = esito.contenuto; break; }

      for (const s of strumentiRichiesti) {
        /* l'evento parte PRIMA di eseguire lo strumento: e' l'attesa della
           chiamata vera (fino a 20 secondi per verifica_camere) quella che
           il widget deve coprire con una riga di stato, non l'attesa dei
           pochi byte di JSON del tool_call */
        yield { tipo: 'strumento', nome: s.function.name };
        let args: Record<string, unknown> = {};
        try { args = JSON.parse(s.function.arguments || '{}'); } catch { /* argomenti illeggibili: si prova con niente */ }
        usati.push(s.function.name);
        const esitoStrumento = await eseguiStrumento(s.function.name, args);
        if (esitoStrumento.riferimento) riferimento = esitoStrumento.riferimento;
        messaggi.push({ role: 'tool', tool_call_id: s.id, content: JSON.stringify(esitoStrumento.risultato) });
      }
    }
    if (!testoRisposta) testoRisposta = RISPOSTA_FALLBACK;
  } catch (err) {
    dettaglioErrore = err instanceof Error ? err.message : String(err);
    testoRisposta = RISPOSTA_ERRORE;
  }

  if (dettaglioErrore) {
    yield { tipo: 'errore', ok: false, risposta: testoRisposta, riferimento, strumenti: usati, cachedTokens, dettaglio: dettaglioErrore };
  } else {
    yield { tipo: 'fine', ok: true, risposta: testoRisposta, riferimento, strumenti: usati, cachedTokens };
  }
}
