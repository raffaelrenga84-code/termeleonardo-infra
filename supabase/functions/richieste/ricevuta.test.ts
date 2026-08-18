/* ============================================================
   ricevuta.test.ts — la ricevuta che l'ospite riceve appena preme invia.

   IL DIFETTO CHE PRESIDIA. Chi manda una richiesta dal sito non riceve
   NULLA. Vede il riferimento sullo schermo e poi silenzio, finche' qualcuno
   in reception non risponde a mano. Se chiude la scheda non gli resta ne'
   il riferimento ne' la prova di aver inviato.

   L'asimmetria e' la spia: chi COMPRA un buono riceve l'email, automatica.
   Chi CHIEDE un trattamento no — ed e' lui quello che sta aspettando una
   risposta.

   IL RISCHIO CENTRALE, e il motivo per cui questa email e' corta. Il
   sistema ripete ovunque «questa e' una richiesta, non una prenotazione»,
   e un'email col nostro logo, il riferimento e i dati del soggiorno SI
   LEGGE COME UNA CONFERMA. L'ospite si presenta convinto. E' lo stesso
   difetto dell'avviso che prometteva «giorno e prezzo» a chi aveva gia'
   pagato col buono, solo piu' caro: ogni riga in piu' e' una riga in piu'
   che puo' essere scambiata per un impegno.
   ============================================================ */
import { assert, assertEquals, assertStringIncludes } from 'jsr:@std/assert';
import { inviaRicevuta, ricevutaHTML } from './ricevuta.ts';

const RICHIESTA = {
  numero: 'RS-2026-0011',
  tipo: 'trattamenti',
  nome: 'Anna Verdi',
  email: 'anna@example.it',
  lingua: 'it',
  dati: { giorno: '2026-09-12', fascia: 'mattina', voci: ['Massaggio rilassante 50’'] },
};

function intercetta() {
  const spedite: Record<string, unknown>[] = [];
  const orig = globalThis.fetch;
  globalThis.fetch = ((_u: unknown, init?: RequestInit) => {
    spedite.push(JSON.parse(String(init?.body ?? '{}')));
    return Promise.resolve(new Response('{"id":"finto"}', { status: 200 }));
  }) as typeof fetch;
  return { spedite, ripristina: () => { globalThis.fetch = orig; } };
}

/* ---------- a chi va ---------- */

/* IL DIFETTO PIU' FACILE IN QUESTO PUNTO DEL CODICE: mandarla a noi due
   volte e all'ospite mai. L'avviso alla reception esiste gia' e parte dallo
   stesso punto; copiarlo e dimenticare di cambiare il destinatario e'
   l'errore naturale. */
Deno.test('la ricevuta va all OSPITE, non all hotel', async () => {
  Deno.env.set('RESEND_API_KEY', 'finta');
  const i = intercetta();
  try {
    assertEquals(await inviaRicevuta(RICHIESTA), true);
    assertEquals(i.spedite.length, 1);
    const m = i.spedite[0] as Record<string, unknown>;
    assertEquals(m.to, 'anna@example.it');
    /* rispondendo deve arrivare in RECEPTION: e' l'opposto dell'avviso,
       dove reply_to punta all'ospite proprio perche' lo legge la reception */
    assertEquals(m.reply_to, 'info@termeleonardo.com');
    assertStringIncludes(String(m.subject), 'RS-2026-0011');
  } finally { i.ripristina(); }
});

/* ---------- non e' una conferma ---------- */

Deno.test('ogni lingua dice a chiare lettere che non e ancora una prenotazione', () => {
  const frasi: Record<string, RegExp> = {
    it: /non è ancora una prenotazione/i,
    de: /noch keine Buchung/i,
    en: /not a booking yet/i,
    fr: /pas encore une réservation/i,
  };
  for (const [lingua, frase] of Object.entries(frasi)) {
    const h = ricevutaHTML({ ...RICHIESTA, lingua });
    assert(frase.test(h), `${lingua}: manca la riga che porta il peso`);
  }
});

/* Il titolo dice RICEVUTA, non CONFERMATA. Una sola parola sbagliata li' e
   l'ospite si presenta convinto di avere un posto. */
Deno.test('in nessuna lingua il titolo dice che la richiesta e confermata', () => {
  for (const lingua of ['it', 'de', 'en', 'fr']) {
    const h = ricevutaHTML({ ...RICHIESTA, lingua });
    const titolo = /<div style="font-size:23px[^"]*"[^>]*>([^<]*)</.exec(h)?.[1] ?? '';
    assert(titolo, `${lingua}: titolo non trovato`);
    assert(
      !/confermat|bestätigt|confirmed|confirmée/i.test(titolo),
      `${lingua}: il titolo si legge come una conferma → ${titolo}`,
    );
  }
});

/* Nessun orario promesso, nessun prezzo, nessuna disponibilita': «di solito
   entro poche ore» sta sulla pagina, dove lo legge chi ha appena premuto
   invia. In un'email che si rilegge tre giorni dopo diventa un'accusa. */
Deno.test('la ricevuta non promette tempi, prezzi ne disponibilita', () => {
  const h = ricevutaHTML(RICHIESTA);
  assert(!/entro poche ore|entro \d|24 ore|48 ore/i.test(h), 'promette un tempo');
  assert(!/€|prezzo|disponibil/i.test(h), 'parla di prezzo o disponibilita');
});

/* ---------- cosa ha chiesto ---------- */

/* Il Day Spa arrivo' in reception come «undefined notti · undefined ospiti»:
   un tipo nuovo si dimentica sempre da qualche parte. */
Deno.test('tutti i tipi mostrano un blocco dettagli non vuoto', () => {
  const casi: Record<string, Record<string, unknown>> = {
    transfer: { quando: '2026-09-10', ora: '14:30', pax: 2, verso: 'arrivo', luogo: 'Venezia  aeroporto' },
    greenfee: { circolo_nome: 'Golf Montecchia', data: '2026-09-10', ora: '09:30', giocatori: 2 },
    maestro: { data: '2026-09-10', ora: '10:00', persone: 2 },
    dayspa: { giorno: '2026-09-10', persone: 2 },
    trattamenti: { giorno: '2026-09-10', fascia: 'mattina', voci: ['Massaggio'] },
  };
  for (const [tipo, dati] of Object.entries(casi)) {
    const h = ricevutaHTML({ ...RICHIESTA, tipo, dati });
    assertStringIncludes(h, '10/09/2026');
    assert(!h.includes('undefined'), `${tipo}: c e un undefined a video`);
  }
});

Deno.test('il riferimento c e sempre, perche e l unica cosa che l ospite puo citare', () => {
  assertStringIncludes(ricevutaHTML(RICHIESTA), 'RS-2026-0011');
});

/* IL BLOCCO NON SI RICOPIA. Due copie divergono, e il giorno che divergono
   l'ospite legge una cosa nella ricevuta e un'altra nella conferma — che e'
   peggio di non avere la ricevuta. */
Deno.test('i dettagli sono importati, non riscritti qui dentro', () => {
  const sorgente = Deno.readTextFileSync(new URL('./ricevuta.ts', import.meta.url));
  assert(
    /import\s*\{[^}]*\bdettagli\b[^}]*\}\s*from\s*'\.\/dettagli-richiesta\.ts'/s.test(sorgente),
    'la ricevuta non importa dettagli() dal modulo condiviso',
  );
  assert(!sorgente.includes('vociDettagli('), 'il blocco e stato ricopiato qui dentro');
});

/* ---------- quando non parte ---------- */

/* Come l'avviso alla reception, che gia' funziona cosi': la richiesta resta
   salvata e la funzione risponde ok. L'ospite ha gia' letto «ricevuta» sullo
   schermo, col riferimento. Un'email che non parte non deve MAI far fallire
   una richiesta. */
Deno.test('senza chiave Resend la ricevuta non parte ma non esplode', async () => {
  Deno.env.delete('RESEND_API_KEY');
  const i = intercetta();
  try {
    assertEquals(await inviaRicevuta(RICHIESTA), false);
    assertEquals(i.spedite.length, 0);
  } finally { i.ripristina(); }
});

Deno.test('se Resend risponde male la ricevuta dice falso, senza lanciare', async () => {
  Deno.env.set('RESEND_API_KEY', 'finta');
  const orig = globalThis.fetch;
  globalThis.fetch = (() => Promise.resolve(new Response('errore', { status: 500 }))) as typeof fetch;
  try {
    assertEquals(await inviaRicevuta(RICHIESTA), false);
  } finally { globalThis.fetch = orig; }
});

Deno.test('senza email dell ospite non si prova nemmeno a mandarla', async () => {
  Deno.env.set('RESEND_API_KEY', 'finta');
  const i = intercetta();
  try {
    assertEquals(await inviaRicevuta({ ...RICHIESTA, email: '' }), false);
    assertEquals(i.spedite.length, 0);
  } finally { i.ripristina(); }
});
