/* Test della ricomposizione dello streaming xAI, e del ciclo di conversazione
   che ci gira sopra.

   Niente rete vera qui: si costruiscono a mano gli stessi pezzi di testo che
   arriverebbero dal formato SSE di OpenAI (xAI e' compatibile), spezzati in
   punti scomodi apposta — a meta' riga, a meta' di un frammento di
   `arguments` — perche' e' esattamente li' che una ricomposizione fatta al
   volo dentro il gestore della richiesta si romperebbe senza che nessun test
   se ne accorga. E' gia' successo in questo progetto: da qui la regola di
   tenere questa logica in funzioni pure, fuori da Deno.serve. */
import { assert, assertEquals } from 'jsr:@std/assert';
import {
  accumula,
  chiediAlModelloStreaming,
  eseguiConversazioneStreaming,
  estraiEventiSSE,
  formattaEventoSSE,
  leggiStreamXAI,
  statoIniziale,
  strumentiOrdinati,
  type ChunkXAI,
  type EventoXAI,
} from './streaming.ts';

/* ---------- helper per i test: una ReadableStream costruita a mano da un
   elenco di pezzi di testo, cosi' si sceglie esattamente dove cade il
   confine di rete ---------- */
function streamDaPezzi(pezzi: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let i = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i < pezzi.length) controller.enqueue(encoder.encode(pezzi[i++]));
      else controller.close();
    },
  });
}

/* spezza una stringa ogni `n` caratteri: simula un pezzo di rete che non
   rispetta affatto i confini delle righe SSE */
function inPezziDa(testo: string, n: number): string[] {
  const pezzi: string[] = [];
  for (let i = 0; i < testo.length; i += n) pezzi.push(testo.slice(i, i + n));
  return pezzi;
}

/* ============================================================
   estraiEventiSSE — il livello piu' basso: righe SSE a pezzi di rete
   ============================================================ */

Deno.test('estraiEventiSSE non emette niente finche non arriva un a-capo', () => {
  const primo = estraiEventiSSE('', 'data: {"choices":[{"delta":{"content":"a"');
  assertEquals(primo.eventi, []);
  assert(primo.buffer.length > 0, 'il pezzo incompleto resta in buffer, non si perde');
});

Deno.test('una riga "data:" completata da un secondo pezzo produce un evento', () => {
  const primo = estraiEventiSSE('', 'data: {"choices":[{"delta":{"content":"a"');
  const secondo = estraiEventiSSE(primo.buffer, '}}]}\n\n');
  assertEquals(secondo.eventi.length, 1);
  assertEquals(secondo.eventi[0], { tipo: 'chunk', dati: { choices: [{ delta: { content: 'a' } }] } });
});

Deno.test('"data: [DONE]" produce un evento di fine, distinto da un chunk', () => {
  const r = estraiEventiSSE('', 'data: [DONE]\n\n');
  assertEquals(r.eventi, [{ tipo: 'fine-sse' }]);
});

Deno.test('le righe vuote fra un evento e laltro vengono ignorate, non fanno saltare il parser', () => {
  const r = estraiEventiSSE('', '\n\ndata: {"choices":[]}\n\n\n');
  assertEquals(r.eventi, [{ tipo: 'chunk', dati: { choices: [] } }]);
});

Deno.test('un pezzo JSON illeggibile viene scartato, il resto dello stream continua', () => {
  const r = estraiEventiSSE('', 'data: {rotto\n\ndata: {"choices":[]}\n\n');
  assertEquals(r.eventi, [{ tipo: 'chunk', dati: { choices: [] } }]);
});

Deno.test('spezzare lo stesso testo SSE in punti diversi produce sempre gli stessi eventi', () => {
  const testo = 'data: {"choices":[{"delta":{"content":"ciao"}}]}\n\ndata: [DONE]\n\n';
  for (const n of [1, 2, 3, 5, 11, 200]) {
    let buffer = '';
    const eventi = [];
    for (const pezzo of inPezziDa(testo, n)) {
      const r = estraiEventiSSE(buffer, pezzo);
      buffer = r.buffer;
      eventi.push(...r.eventi);
    }
    assertEquals(eventi, [
      { tipo: 'chunk', dati: { choices: [{ delta: { content: 'ciao' } }] } },
      { tipo: 'fine-sse' },
    ], `fallito con chunk di ${n} caratteri`);
  }
});

/* ============================================================
   accumula / strumentiOrdinati — la ricomposizione di testo e tool_calls
   ============================================================ */

Deno.test('accumula somma il contenuto pezzo dopo pezzo', () => {
  let stato = statoIniziale();
  stato = accumula(stato, { choices: [{ delta: { content: 'Buon' } }] });
  stato = accumula(stato, { choices: [{ delta: { content: 'giorno' } }] });
  assertEquals(stato.contenuto, 'Buongiorno');
});

/* helper solo-test: costruisce un chunk con un pezzo di delta.tool_calls,
   cosi' i test sotto non annidano quattro livelli di parentesi graffe a
   mano — e' proprio quell'annidamento a mano che ha fatto fallire la
   sintassi la prima volta che questo file e' stato scritto */
function chunkStrumento(pezzi: Array<Record<string, unknown>>): ChunkXAI {
  return { choices: [{ delta: { tool_calls: pezzi as never } }] };
}

Deno.test('un tool_call arriva a pezzi: nome nel primo, argomenti spezzati nei successivi', () => {
  let stato = statoIniziale();
  stato = accumula(stato, chunkStrumento([
    { index: 0, id: 'call_1', type: 'function', function: { name: 'verifica_camere', arguments: '' } },
  ]));
  stato = accumula(stato, chunkStrumento([{ index: 0, function: { arguments: '{"from_date":' } }]));
  stato = accumula(stato, chunkStrumento([{ index: 0, function: { arguments: '"2026-09-10"}' } }]));
  const finali = strumentiOrdinati(stato);
  assertEquals(finali, [{ id: 'call_1', type: 'function', function: { name: 'verifica_camere', arguments: '{"from_date":"2026-09-10"}' } }]);
});

Deno.test('gli argomenti si CONCATENANO, non si sostituiscono: un pezzo vuoto non cancella quanto arrivato prima', () => {
  /* questo e' il test che fallisce se qualcuno scrive fondiStrumenti con
     un `=` al posto di un `+=` sugli argomenti */
  let stato = statoIniziale();
  stato = accumula(stato, chunkStrumento([{ index: 0, function: { arguments: '{"a":1' } }]));
  stato = accumula(stato, chunkStrumento([{ index: 0, function: { arguments: ',"b":2}' } }]));
  assertEquals(strumentiOrdinati(stato)[0].function.arguments, '{"a":1,"b":2}');
});

Deno.test('due tool_calls nella stessa risposta, con pezzi interlacciati, non si mescolano', () => {
  let stato = statoIniziale();
  stato = accumula(stato, chunkStrumento([
    { index: 0, id: 'call_a', type: 'function', function: { name: 'verifica_camere', arguments: '' } },
    { index: 1, id: 'call_b', type: 'function', function: { name: 'invia_richiesta', arguments: '' } },
  ]));
  /* i pezzi di argomenti arrivano intrecciati: prima un po' del secondo, poi un po' del primo */
  stato = accumula(stato, chunkStrumento([{ index: 1, function: { arguments: '{"nome":"Ma' } }]));
  stato = accumula(stato, chunkStrumento([{ index: 0, function: { arguments: '{"adults":2}' } }]));
  stato = accumula(stato, chunkStrumento([{ index: 1, function: { arguments: 'rio"}' } }]));
  const finali = strumentiOrdinati(stato);
  assertEquals(finali.length, 2);
  assertEquals(finali[0].function, { name: 'verifica_camere', arguments: '{"adults":2}' });
  assertEquals(finali[1].function, { name: 'invia_richiesta', arguments: '{"nome":"Mario"}' });
});

Deno.test('il finish_reason arriva sullultimo chunk e resta impresso nello stato', () => {
  let stato = statoIniziale();
  stato = accumula(stato, { choices: [{ delta: { content: 'ok' }, finish_reason: null }] });
  stato = accumula(stato, { choices: [{ delta: {}, finish_reason: 'stop' }] });
  assertEquals(stato.finito, 'stop');
});

Deno.test('i cached_tokens arrivano in un chunk finale SENZA choices (stream_options.include_usage): si catturano comunque', () => {
  let stato = statoIniziale();
  stato = accumula(stato, { choices: [{ delta: { content: 'ok' }, finish_reason: 'stop' }] });
  stato = accumula(stato, { choices: [], usage: { prompt_tokens_details: { cached_tokens: 9216 } } } as ChunkXAI);
  assertEquals(stato.cachedTokens, 9216);
  assertEquals(stato.contenuto, 'ok', 'un chunk senza choices non deve toccare il contenuto gia accumulato');
});

Deno.test('senza mai un campo cached_tokens, resta null: non si inventa uno zero', () => {
  let stato = statoIniziale();
  stato = accumula(stato, { choices: [{ delta: { content: 'ok' }, finish_reason: 'stop' }] });
  assertEquals(stato.cachedTokens, null);
});

/* ============================================================
   leggiStreamXAI — dallo stream grezzo agli eventi di alto livello
   ============================================================ */

const SSE_TESTO_SEMPLICE =
  'data: {"choices":[{"delta":{"role":"assistant","content":""},"finish_reason":null}]}\n\n' +
  'data: {"choices":[{"delta":{"content":"Buon"},"finish_reason":null}]}\n\n' +
  'data: {"choices":[{"delta":{"content":"giorno."},"finish_reason":null}]}\n\n' +
  'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n' +
  'data: {"choices":[],"usage":{"prompt_tokens":9300,"completion_tokens":4,"prompt_tokens_details":{"cached_tokens":9216}}}\n\n' +
  'data: [DONE]\n\n';

Deno.test('leggiStreamXAI emette il testo pezzo dopo pezzo, mano a mano che arriva', async () => {
  const eventi: EventoXAI[] = [];
  for await (const ev of leggiStreamXAI(streamDaPezzi([SSE_TESTO_SEMPLICE]))) eventi.push(ev);
  const pezziTesto = eventi.filter((e) => e.tipo === 'testo').map((e) => (e as { pezzo: string }).pezzo);
  assertEquals(pezziTesto, ['Buon', 'giorno.']);
  const fine = eventi.at(-1);
  assertEquals(fine, {
    tipo: 'fine', motivo: 'stop', contenuto: 'Buongiorno.', strumenti: [], cachedTokens: 9216,
  });
});

Deno.test('lo stesso stream, spezzato a caratteri diversi, produce lo stesso risultato finale', async () => {
  for (const n of [1, 4, 17, 97]) {
    const eventi: EventoXAI[] = [];
    for await (const ev of leggiStreamXAI(streamDaPezzi(inPezziDa(SSE_TESTO_SEMPLICE, n)))) eventi.push(ev);
    const testoRicomposto = eventi.filter((e) => e.tipo === 'testo').map((e) => (e as { pezzo: string }).pezzo).join('');
    assertEquals(testoRicomposto, 'Buongiorno.', `fallito con chunk di ${n} caratteri`);
    assertEquals(eventi.at(-1), {
      tipo: 'fine', motivo: 'stop', contenuto: 'Buongiorno.', strumenti: [], cachedTokens: 9216,
    }, `fallito con chunk di ${n} caratteri`);
  }
});

const SSE_TOOL_CALL =
  'data: {"choices":[{"delta":{"role":"assistant","content":null,"tool_calls":[{"index":0,"id":"call_1","type":"function","function":{"name":"verifica_camere","arguments":""}}]},"finish_reason":null}]}\n\n' +
  'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\\"adults\\":"}}]},"finish_reason":null}]}\n\n' +
  'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"2}"}}]},"finish_reason":null}]}\n\n' +
  'data: {"choices":[{"delta":{},"finish_reason":"tool_calls"}]}\n\n' +
  'data: [DONE]\n\n';

Deno.test('leggiStreamXAI ricompone un tool_call arrivato a pezzi e lo restituisce completo alla fine', async () => {
  const eventi: EventoXAI[] = [];
  for await (const ev of leggiStreamXAI(streamDaPezzi([SSE_TOOL_CALL]))) eventi.push(ev);
  assertEquals(eventi.filter((e) => e.tipo === 'testo'), [], 'nessun testo: qui il modello chiama solo uno strumento');
  assertEquals(eventi.at(-1), {
    tipo: 'fine', motivo: 'tool_calls', contenuto: '', cachedTokens: null,
    strumenti: [{ id: 'call_1', type: 'function', function: { name: 'verifica_camere', arguments: '{"adults":2}' } }],
  });
});

Deno.test('una connessione che si interrompe PRIMA di un finish_reason produce un evento "troncato", non una fine pulita', async () => {
  /* questo e' il caso che simula xAI tagliato a meta' frase: il test fallisce
     se il codice tratta la chiusura dello stream come se fosse sempre una
     fine regolare */
  const parziale = 'data: {"choices":[{"delta":{"content":"Il totale e di 4"},"finish_reason":null}]}\n\n';
  const eventi: EventoXAI[] = [];
  for await (const ev of leggiStreamXAI(streamDaPezzi([parziale]))) eventi.push(ev);
  const pezziTesto = eventi.filter((e) => e.tipo === 'testo').map((e) => (e as { pezzo: string }).pezzo).join('');
  assertEquals(pezziTesto, 'Il totale e di 4', 'quello che era arrivato prima del taglio resta leggibile');
  assertEquals(eventi.at(-1), { tipo: 'troncato', contenuto: 'Il totale e di 4', strumenti: [], cachedTokens: null });
});

/* ============================================================
   formattaEventoSSE — la cornice degli eventi mandati al browser
   ============================================================ */

Deno.test('formattaEventoSSE produce una riga event e una riga data, terminate da riga vuota', () => {
  assertEquals(formattaEventoSSE('testo', { pezzo: 'ciao' }), 'event: testo\ndata: {"pezzo":"ciao"}\n\n');
});

Deno.test('un a-capo dentro al testo non spezza la cornice: JSON.stringify lo scrive \\n, non un a-capo vero', () => {
  const frame = formattaEventoSSE('testo', { pezzo: 'riga uno\nriga due' });
  /* una sola coppia di a-capo alla fine: se il testo contenesse un a-capo
     VERO, il browser leggerebbe due eventi dove ce n'e' uno solo */
  assertEquals(frame.split('\n\n').length, 2, 'un\'unica cornice, non due');
  assert(frame.includes('riga uno\\nriga due'), 'l\'a-capo interno resta scritto \\n dentro la stringa JSON');
});

/* ============================================================
   chiediAlModelloStreaming — il wrapper attorno a fetch, con fetch finto
   ============================================================ */

function fintoFetchStreaming(testoSSE: string, stato = 200) {
  const orig = globalThis.fetch;
  const chiamate: Record<string, unknown>[] = [];
  globalThis.fetch = ((_url: unknown, init?: RequestInit) => {
    chiamate.push(JSON.parse(String(init?.body ?? '{}')));
    if (stato !== 200) return Promise.resolve(new Response('errore finto', { status: stato }));
    return Promise.resolve(new Response(streamDaPezzi(inPezziDa(testoSSE, 23)), {
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
    }));
  }) as typeof fetch;
  return { chiamate, ripristina: () => { globalThis.fetch = orig; } };
}

Deno.test('chiediAlModelloStreaming chiede stream:true e stream_options.include_usage a xAI', async () => {
  const f = fintoFetchStreaming(SSE_TESTO_SEMPLICE);
  try {
    const eventi: EventoXAI[] = [];
    for await (const ev of chiediAlModelloStreaming('https://finta.test/chat', 'chiave', 'grok-4.6', [{ role: 'user', content: 'ciao' }], [])) {
      eventi.push(ev);
    }
    assertEquals(f.chiamate.length, 1);
    assertEquals(f.chiamate[0].stream, true);
    assertEquals((f.chiamate[0].stream_options as Record<string, unknown>).include_usage, true);
    assertEquals(eventi.at(-1), { tipo: 'fine', motivo: 'stop', contenuto: 'Buongiorno.', strumenti: [], cachedTokens: 9216 });
  } finally { f.ripristina(); }
});

Deno.test('chiediAlModelloStreaming, su una risposta non-ok, lancia un errore invece di restituire uno stream vuoto', async () => {
  const f = fintoFetchStreaming('', 500);
  try {
    let esploso = false;
    try {
      for await (const _ev of chiediAlModelloStreaming('https://finta.test/chat', 'chiave', 'grok-4.6', [], [])) { /* niente */ }
    } catch (e) {
      esploso = true;
      assert(String((e as Error).message).includes('500'));
    }
    assert(esploso, 'una risposta 500 deve far esplodere il generatore, non restituire silenzio');
  } finally { f.ripristina(); }
});

/* ============================================================
   eseguiConversazioneStreaming — il ciclo GIRI_MAX / strumenti, in streaming
   ============================================================ */

/* un "modello finto" che risponde SEMPRE con lo stesso stream di eventi,
   indipendentemente dai messaggi che riceve: basta per verificare il ciclo */
function modelloCheDiceloSubito(testo: string): (m: unknown[]) => AsyncGenerator<EventoXAI> {
  return async function* () {
    for (const c of testo) yield { tipo: 'testo', pezzo: c } as EventoXAI;
    yield { tipo: 'fine', motivo: 'stop', contenuto: testo, strumenti: [], cachedTokens: 42 } as EventoXAI;
  };
}

Deno.test('senza strumenti: il testo esce mano a mano, e la fine porta la risposta intera', async () => {
  const eventi = [];
  for await (const ev of eseguiConversazioneStreaming(
    [{ role: 'user', content: 'ciao' }], 4, modelloCheDiceloSubito('Buongiorno.'),
    async () => ({ risultato: {} }),
  )) eventi.push(ev);

  const pezziTesto = eventi.filter((e) => e.tipo === 'testo').map((e: any) => e.pezzo).join('');
  assertEquals(pezziTesto, 'Buongiorno.');
  assertEquals(eventi.at(-1), { tipo: 'fine', ok: true, risposta: 'Buongiorno.', riferimento: null, strumenti: [], cachedTokens: 42 });
});

Deno.test('un giro con tool_calls manda levento "strumento" PRIMA di eseguirlo, poi il giro successivo risponde', async () => {
  let giro = 0;
  const eseguiti: string[] = [];
  const chiamaModello = async function* (): AsyncGenerator<EventoXAI> {
    giro++;
    if (giro === 1) {
      yield {
        tipo: 'fine', motivo: 'tool_calls', contenuto: '', cachedTokens: null,
        strumenti: [{ id: 'call_1', type: 'function', function: { name: 'verifica_camere', arguments: '{"adults":2}' } }],
      };
    } else {
      for (const c of 'Due opzioni disponibili.') yield { tipo: 'testo', pezzo: c };
      yield { tipo: 'fine', motivo: 'stop', contenuto: 'Due opzioni disponibili.', strumenti: [], cachedTokens: 100 };
    }
  };
  const eventi = [];
  for await (const ev of eseguiConversazioneStreaming(
    [{ role: 'user', content: 'due adulti dal 10 al 12 settembre' }], 4, chiamaModello,
    async (nome, args) => { eseguiti.push(nome); assertEquals(args, { adults: 2 }); return { risultato: { esito: 'ok' } }; },
  )) eventi.push(ev);

  /* l'evento "strumento" deve arrivare PRIMA che compaia il testo del giro
     successivo: e' quello che permette al widget di mostrare "sto
     verificando le camere..." e poi farlo sparire quando arriva la risposta */
  const indiceStrumento = eventi.findIndex((e) => e.tipo === 'strumento');
  const indicePrimoTesto = eventi.findIndex((e) => e.tipo === 'testo');
  assert(indiceStrumento !== -1 && indiceStrumento < indicePrimoTesto);
  assertEquals(eventi[indiceStrumento], { tipo: 'strumento', nome: 'verifica_camere' });
  assertEquals(eseguiti, ['verifica_camere']);
  const fine = eventi.at(-1) as any;
  assertEquals(fine.tipo, 'fine');
  assertEquals(fine.strumenti, ['verifica_camere']);
  assertEquals(fine.risposta, 'Due opzioni disponibili.');
});

Deno.test('invia_richiesta riuscita: il riferimento restituito dallo strumento arriva nellevento finale', async () => {
  let giro = 0;
  const chiamaModello = async function* (): AsyncGenerator<EventoXAI> {
    giro++;
    if (giro === 1) {
      yield {
        tipo: 'fine', motivo: 'tool_calls', contenuto: '', cachedTokens: null,
        strumenti: [{ id: 'call_9', type: 'function', function: { name: 'invia_richiesta', arguments: '{"tipo":"soggiorno","nome":"Mario","note":"x"}' } }],
      };
    } else {
      yield { tipo: 'testo', pezzo: 'Registrato.' };
      yield { tipo: 'fine', motivo: 'stop', contenuto: 'Registrato.', strumenti: [], cachedTokens: null };
    }
  };
  const eventi = [];
  for await (const ev of eseguiConversazioneStreaming(
    [{ role: 'user', content: 'x' }], 4, chiamaModello,
    async () => ({ risultato: { stato: 'registrata', riferimento: 'RS-2026-0099' }, riferimento: 'RS-2026-0099' }),
  )) eventi.push(ev);
  assertEquals((eventi.at(-1) as any).riferimento, 'RS-2026-0099');
});

Deno.test('un tool_call con argomenti JSON illeggibili non fa esplodere il ciclo: lo strumento riceve un oggetto vuoto', async () => {
  let giro = 0;
  const chiamaModello = async function* (): AsyncGenerator<EventoXAI> {
    giro++;
    if (giro === 1) {
      yield {
        tipo: 'fine', motivo: 'tool_calls', contenuto: '', cachedTokens: null,
        strumenti: [{ id: 'call_1', type: 'function', function: { name: 'verifica_camere', arguments: '{non e json' } }],
      };
    } else {
      yield { tipo: 'fine', motivo: 'stop', contenuto: 'ok', strumenti: [], cachedTokens: null };
    }
  };
  const argsRicevuti: unknown[] = [];
  const eventi = [];
  for await (const ev of eseguiConversazioneStreaming(
    [{ role: 'user', content: 'x' }], 4, chiamaModello,
    async (_n, args) => { argsRicevuti.push(args); return { risultato: {} }; },
  )) eventi.push(ev);
  assertEquals(argsRicevuti, [{}]);
  assertEquals((eventi.at(-1) as any).ok, true);
});

Deno.test('il modello continua a chiamare strumenti oltre GIRI_MAX: si ferma con la risposta di ripiego, non con un errore tecnico', async () => {
  /* prova esplicitamente il tetto GIRI_MAX in streaming: senza, un modello
     che non smette mai di chiamare strumenti terrebbe la richiesta aperta
     per sempre */
  let giri = 0;
  const chiamaModello = async function* (): AsyncGenerator<EventoXAI> {
    giri++;
    yield {
      tipo: 'fine', motivo: 'tool_calls', contenuto: '', cachedTokens: null,
      strumenti: [{ id: `call_${giri}`, type: 'function', function: { name: 'verifica_camere', arguments: '{}' } }],
    };
  };
  const eventi = [];
  for await (const ev of eseguiConversazioneStreaming(
    [{ role: 'user', content: 'x' }], 3, chiamaModello, async () => ({ risultato: {} }),
  )) eventi.push(ev);
  assertEquals(giri, 3, 'non deve chiamare il modello piu' + ' di GIRI_MAX volte');
  const fine = eventi.at(-1) as any;
  assertEquals(fine.tipo, 'fine');
  assertEquals(fine.ok, true);
  assert(fine.risposta.includes('non riesco a completare'));
});

Deno.test('uno stream troncato a meta produce levento "errore", con la risposta di reception - non la mezza frase arrivata', async () => {
  /* e' la simulazione richiesta esplicitamente: xAI si interrompe dopo aver
     gia' mandato mezza frase, e il chiamante non deve restare con quella
     mezza frase spacciata per la risposta buona */
  const chiamaModello = async function* (): AsyncGenerator<EventoXAI> {
    yield { tipo: 'testo', pezzo: 'Il totale e di 4' };
    yield { tipo: 'troncato', contenuto: 'Il totale e di 4', strumenti: [], cachedTokens: null };
  };
  const eventi = [];
  for await (const ev of eseguiConversazioneStreaming(
    [{ role: 'user', content: 'x' }], 4, chiamaModello, async () => ({ risultato: {} }),
  )) eventi.push(ev);

  /* il pezzo parziale e' comunque uscito (e' quello che il widget ha gia'
     mostrato mentre arrivava)... */
  assertEquals(eventi[0], { tipo: 'testo', pezzo: 'Il totale e di 4' });
  /* ...ma la fine dichiara esplicitamente un errore, con la risposta di
     reception e NON la frase a meta' */
  const fine = eventi.at(-1) as any;
  assertEquals(fine.tipo, 'errore');
  assertEquals(fine.ok, false);
  assert(fine.risposta.includes('049 9939200'));
  assert(fine.risposta.includes('info@termeleonardo.com'));
  assert(!fine.risposta.includes('Il totale e di 4'), 'la risposta finale non deve essere la frase a meta');
});

Deno.test('i cached_tokens dellultimo giro utile arrivano nellevento finale', async () => {
  const chiamaModello = modelloCheDiceloSubito('ok');
  const eventi = [];
  for await (const ev of eseguiConversazioneStreaming([{ role: 'user', content: 'x' }], 4, chiamaModello, async () => ({ risultato: {} }))) {
    eventi.push(ev);
  }
  assertEquals((eventi.at(-1) as any).cachedTokens, 42);
});
