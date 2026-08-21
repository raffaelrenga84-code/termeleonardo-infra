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
import { TIPI_ATTIVI } from './tipi.ts';
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

/* IL PREZZO C'E', ED E' VOLUTO: e' la cifra che l'ospite ha scelto su
   /prenota, e una ricevuta che non la ripete non serve a niente. Fino al
   21 agosto 2026 questa prova dichiarava «ne prezzi» e restava verde lo
   stesso, perche' la sua finzione non aveva `prezzo_cent`: su una
   richiesta vera esce «Prezzo 260,00 €». Una prova che evita il caso che
   dichiara di presidiare e' peggio di nessuna prova.

   Resta vietato PROMETTERE: nessun orario, nessuna disponibilita'. «Di solito
   entro poche ore» sta sulla pagina, dove lo legge chi ha appena premuto
   invia. In un'email che si rilegge tre giorni dopo diventa un'accusa. */
Deno.test('la ricevuta non promette tempi ne disponibilita', () => {
  const h = ricevutaHTML(RICHIESTA);
  assert(!/entro poche ore|entro \d|24 ore|48 ore/i.test(h), 'promette un tempo');
  assert(!/disponibil/i.test(h), 'promette una disponibilita');
});

/* ---------- cosa ha chiesto ---------- */

/* Il Day Spa arrivo' in reception come «undefined notti · undefined ospiti»:
   un tipo nuovo si dimentica sempre da qualche parte. */
/* Il soggiorno non c'era in questo elenco, e per questo l'email diceva
   «Ecco cosa ci ha chiesto» seguito dal solo riferimento: chi prenotava una
   camera riceveva una promessa e nient'altro. La prova si chiamava «tutti i
   tipi» e ne provava cinque su sei — il nome era piu' largo di quello che
   faceva, ed e' cosi' che il difetto e' passato.
   Ora l'elenco non si scrive a mano: si prende da TIPI_ATTIVI, e un tipo
   aggiunto domani senza il suo caso fa fallire questa prova invece di
   scivolare via. */
const CASI: Record<string, { colonne?: Record<string, unknown>; dati: Record<string, unknown> }> = {
  transfer: { dati: { quando: '2026-09-10', ora: '14:30', pax: 2, verso: 'arrivo', luogo: 'Venezia  aeroporto' } },
  greenfee: { dati: { circolo_nome: 'Golf Montecchia', data: '2026-09-10', ora: '09:30', giocatori: 2 } },
  maestro: { dati: { data: '2026-09-10', ora: '10:00', persone: 2 } },
  dayspa: { dati: { giorno: '2026-09-10', persone: 2 } },
  trattamenti: { dati: { giorno: '2026-09-10', fascia: 'mattina', voci: ['Massaggio'] } },
  soggiorno: {
    colonne: {
      check_in: '2026-09-10', check_out: '2026-09-12',
      tipo_camera: 'Junior Suite Abano', pacchetto: 'Thermal Escape', ospiti: 2,
    },
    dati: {
      tariffa: 'Thermal Escape', trattamento: 'Mezza Pensione',
      prezzo_cent: 66000, adulti: 2, bambini: 0, caparra_cent: 15000,
    },
  },
};

Deno.test('ogni tipo attivo ha un caso di prova, senza eccezioni scritte a mano', () => {
  for (const tipo of TIPI_ATTIVI) {
    assert(CASI[tipo], `il tipo ${tipo} non ha un caso: la prova sotto non lo guarderebbe`);
  }
});

Deno.test('tutti i tipi mostrano un blocco dettagli non vuoto', () => {
  assert(Object.keys(CASI).length >= 6, 'meno di sei casi: la prova gira quasi a vuoto');
  for (const [tipo, caso] of Object.entries(CASI)) {
    const h = ricevutaHTML({ ...RICHIESTA, tipo, ...(caso.colonne ?? {}), dati: caso.dati });
    assertStringIncludes(h, '10/09/2026');
    assert(!h.includes('undefined'), `${tipo}: c e un undefined a video`);
  }
});

/* Il difetto vero, visto in produzione il 20 agosto: la ricevuta di una
   richiesta di camera annunciava il riepilogo e mostrava solo il numero. */
Deno.test('la ricevuta di un soggiorno dice cosa e stato chiesto', () => {
  const c = CASI.soggiorno;
  const h = ricevutaHTML({ ...RICHIESTA, tipo: 'soggiorno', ...c.colonne, dati: c.dati });
  for (const atteso of ['10/09/2026', '12/09/2026', 'Junior Suite Abano', 'Mezza Pensione', '660,00']) {
    assertStringIncludes(h, atteso);
  }
});

/* «0,00 €» stampato e' una promessa di gratuita': dove la caparra non c'e'
   la riga non deve comparire affatto. */
Deno.test('senza caparra non compare una caparra da zero', () => {
  const c = CASI.soggiorno;
  const senza = { ...c.dati };
  delete senza.caparra_cent;
  const h = ricevutaHTML({ ...RICHIESTA, tipo: 'soggiorno', ...c.colonne, dati: senza });
  /* NON si cerca la stringa "0,00": «660,00» la contiene, e la prova
     fallirebbe sul prezzo invece che sulla caparra — l'ho scoperto
     facendola fallire. Si guarda l'etichetta: dove la caparra non c'e',
     la sua riga non deve esserci affatto. */
  assert(!h.includes('Caparra'), 'la riga della caparra compare senza una caparra');
  assertStringIncludes(h, '660,00');
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

Deno.test('e dove scrive un prezzo dice anche la tassa che non e compresa', () => {
  /* regola della casa, prompt dell'agente vocale punto 9: quando si comunica
     un totale la tassa si dice PER INTERO. Questa e' l'email che l'ospite
     si tiene. */
  const conPrezzo = {
    ...RICHIESTA,
    tipo: 'soggiorno',
    check_in: '2026-09-10',
    check_out: '2026-09-12',
    tipo_camera: 'Matrimoniale Queen',
    dati: { prezzo_cent: 26000, caparra_cent: 15000 },
  };
  for (const lingua of ['it', 'de', 'en', 'fr']) {
    const h = visibile(ricevutaHTML({ ...conPrezzo, lingua }));
    assert(h.includes('260,00'), `${lingua}: il prezzo scelto non compare`);
    assert(
      /tassa di soggiorno|Kurtaxe|tourist tax|taxe de séjour/i.test(h),
      `${lingua}: scrive un prezzo e non dice la tassa di soggiorno`,
    );
    assert(
      /1[.,]50/.test(h),
      `${lingua}: nomina la tassa senza dire quanto e: la versione mozzata che la casa vieta`,
    );
  }
});

/* quello che l'ospite legge davvero: i commenti HTML viaggiano dentro
   l'email ma non si vedono, e uno di essi NOMINA la tassa per spiegare
   perche' il blocco esiste. Senza questo, la prova qui sotto trovava la
   parola anche dove il testo non si stampa. */
function visibile(h: string): string {
  /* niente espressione regolare: tagliare fra <!-- e --> con le sole
     operazioni di stringa e' piu' lungo e non ha modi di sbagliarsi */
  const pezzi = h.split('<!--');
  return pezzi
    .map((p, i) => {
      if (i === 0) return p;
      const fine = p.indexOf('-->');
      return fine < 0 ? p : p.slice(fine + 3);
    })
    .join(' ');
}

Deno.test('ma su un transfer o dei trattamenti la tassa non si nomina', () => {
  /* non hanno tassa di soggiorno: scriverla sarebbe una condizione
     inventata su una richiesta che non la prevede */
  for (const tipo of ['transfer', 'trattamenti', 'dayspa']) {
    const h = visibile(ricevutaHTML({ ...RICHIESTA, tipo }));
    assert(
      !/tassa di soggiorno|Kurtaxe|tourist tax/i.test(h),
      `${tipo}: nomina la tassa su una richiesta che non ne ha`,
    );
  }
});

Deno.test('il cane compare nella ricevuta, e solo se c e', () => {
  /* la reception lo deve sapere PRIMA di assegnare la camera, e chi non ha
     un cane non deve leggere una riga che dice «no» */
  const conCane = {
    ...RICHIESTA,
    tipo: 'soggiorno',
    check_in: '2026-09-10',
    check_out: '2026-09-12',
    tipo_camera: 'Matrimoniale Queen',
    dati: { prezzo_cent: 26000, cane: true },
  };
  for (const lingua of ['it', 'de', 'en', 'fr']) {
    const h = visibile(ricevutaHTML({ ...conCane, lingua }));
    assert(
      /Cane al seguito|Mit Hund|Travelling with a dog|Avec un chien/.test(h),
      `${lingua}: il cane non compare nella ricevuta`,
    );
  }
  const senza = visibile(ricevutaHTML({ ...conCane, dati: { prezzo_cent: 26000 } }));
  assert(
    !/Cane al seguito/.test(senza),
    'la riga del cane compare anche a chi non ne ha uno',
  );
});
