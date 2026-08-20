/* componi-richiesta.test.ts — presidio della falla del 14 agosto 2026: la
   camera scelta su una richiesta di soggiorno deve finire nella colonna
   jsonb `dati`, non sparire. E chi non sceglie una camera (es. la chat, che
   manda tipo:'soggiorno' senza campo dati) deve continuare a vedersi
   scrivere `dati: null`, non un oggetto vuoto.

   Non importa index.ts: chiama Deno.serve in cima al file e avvierebbe un
   server vero durante il test — vedi la stessa nota in
   disponibilita-azione.test.ts. */
import { assert, assertEquals } from 'jsr:@std/assert';
import { componiRichiesta } from './componi-richiesta.ts';
import { TIPI_ATTIVI } from './tipi.ts';

const CONTATTI_BASE = {
  nome: 'Anna Bianchi', email: 'anna@example.com', telefono: '333 1234567',
  privacy_presa_atto: true, lingua: 'it',
  check_in: '2026-09-16', check_out: '2026-09-17',
};

Deno.test('la camera scelta in una richiesta di soggiorno finisce davvero in dati', () => {
  const r = componiRichiesta({
    tipo: 'soggiorno', ...CONTATTI_BASE,
    dati: { camera_id: 5, variante_id: 12, tariffa: 'BAR', trattamento: 'Bed & Breakfast', prezzo_cent: 31000 },
  });
  assertEquals(r.errore, undefined);
  assertEquals(r.dati?.camera_id, 5);
  assertEquals(r.dati?.variante_id, 12);
  assertEquals(r.dati?.prezzo_cent, 31000);
  assertEquals(r.dati?.valuta, 'centesimi');
});

Deno.test('un soggiorno senza camera scelta produce dati null, non un oggetto vuoto', () => {
  /* questo e' il caso della chat (chat/index.ts, invia_richiesta): manda
     tipo:'soggiorno' e non manda affatto il campo dati */
  const r = componiRichiesta({ tipo: 'soggiorno', ...CONTATTI_BASE });
  assertEquals(r.errore, undefined);
  assertEquals(r.dati, null);
});

Deno.test('un soggiorno con dati:{} esplicito produce comunque null, non {}', () => {
  const r = componiRichiesta({ tipo: 'soggiorno', ...CONTATTI_BASE, dati: {} });
  assertEquals(r.errore, undefined);
  assertEquals(r.dati, null);
});

Deno.test('la validazione della camera non si aggira: una camera inesistente respinge tutta la richiesta', () => {
  const r = componiRichiesta({
    tipo: 'soggiorno', ...CONTATTI_BASE,
    dati: { camera_id: 999 },
  });
  assertEquals(r.errore, 'camera sconosciuta');
});

Deno.test('un prezzo assurdo sulla camera scelta respinge la richiesta, come su tipi.test.ts', () => {
  const r = componiRichiesta({
    tipo: 'soggiorno', ...CONTATTI_BASE,
    dati: { camera_id: 5, prezzo_cent: -1 },
  });
  assertEquals(r.errore, 'prezzo non valido');
});

Deno.test('i tipi diversi dal soggiorno non cambiano comportamento', () => {
  const r = componiRichiesta({
    tipo: 'transfer', nome: 'Anna Bianchi', email: 'anna@example.com', telefono: '333 1234567',
    privacy_presa_atto: true, lingua: 'it',
    dati: { quando: '2026-09-16', ora: '09:00', pax: 2, verso: 'arrivo', luogo: 'Padova FS' },
  });
  assertEquals(r.errore, undefined);
  assertEquals(r.dati?.luogo, 'Padova FS');
});

/* Il telefono obbligatorio della decisione del 15 agosto 2026 vale su TUTTI
   i tipi, non solo il soggiorno: transfer, green fee, maestro, trattamenti.
   Una regola sola, uguale dappertutto. */
Deno.test('senza telefono un transfer e respinto come un soggiorno', () => {
  const r = componiRichiesta({
    tipo: 'transfer', nome: 'Anna Bianchi', email: 'anna@example.com', telefono: '   ',
    privacy_presa_atto: true, lingua: 'it',
    dati: { quando: '2026-09-16', ora: '09:00', pax: 2, verso: 'arrivo', luogo: 'Padova FS' },
  });
  assertEquals(r.errore, 'telefono mancante');
});

Deno.test('senza telefono anche un soggiorno vero e respinto', () => {
  const r = componiRichiesta({ ...CONTATTI_BASE, telefono: '', tipo: 'soggiorno' });
  assertEquals(r.errore, 'telefono mancante');
});

/* Decisione della proprieta' del 15 agosto 2026: l'esenzione della chat
   (chat/index.ts, invia_richiesta, origine 'assistente del sito') e' chiusa.
   Il telefono e' obbligatorio per tutti i canali, senza casi speciali — la
   chat ora lo chiede prima di registrare (vedi chat/prompt.ts), qui non
   deve piu' passare senza. */
Deno.test('la chat non registra piu senza telefono: origine non e piu una scusa', () => {
  const r = componiRichiesta({
    ...CONTATTI_BASE, telefono: '', origine: 'assistente del sito', tipo: 'soggiorno',
  });
  assertEquals(r.errore, 'telefono mancante');
});

Deno.test('origine qualsiasi, stesso esito: nessun canale e piu esentato', () => {
  const r = componiRichiesta({
    ...CONTATTI_BASE, telefono: '', origine: 'https://www.termeleonardo.com/it/prenota', tipo: 'soggiorno',
  });
  assertEquals(r.errore, 'telefono mancante');
});


/* ============================================================
   IL TIPO ARRIVA DAL BROWSER, E FINORA NESSUNO LO GUARDAVA.

   TIPI_ATTIVI e' l'elenco dei tipi che il pubblico puo' creare, e tutto il
   piano si e' appoggiato a quell'elenco: `arrivo` e `fattura` stanno fuori
   APPOSTA, perche' li crea solo ?a=invia-arrivo, che pretende il token del
   link mandato per email.

   Ma era un invariante ASSERITO, non IMPOSTO: nessuna riga lo controllava a
   tempo di esecuzione. componiRichiesta passava il tipo dritto a validaDati,
   il cui switch conosce anche quei due. E la guardia sul doppio invio guarda
   proprio le righe di tipo `arrivo`: chi avesse il token di un ospite poteva
   crearne una e chiuderlo fuori dal proprio check-in.

   Serve gia' avere quel token — lo stesso segreto con cui si compilerebbe il
   modulo direttamente — quindi per chi attacca non c'e' guadagno. Ma la
   correttezza di quella guardia non deve appoggiarsi a una promessa: qui
   diventa un cancello.
   ============================================================ */
Deno.test('i tipi che il pubblico non puo creare sono rifiutati', () => {
  for (const tipo of ['arrivo', 'fattura']) {
    const c = componiRichiesta({ tipo, nome: 'Rossi Mario', email: 'r@esempio.it', telefono: '+39 333 1234567', lingua: 'it', privacy_presa_atto: true, dati: {}, });
    assert(c.errore, `il tipo ${tipo} e passato dal modulo pubblico`);
    assert(!c.tipo, `il tipo ${tipo} ha prodotto una richiesta`);
  }
});

/* Un nome ereditato da Object.prototype non e' un tipo: e' il difetto gia'
   pagato coi circoli del golf, e la difesa e' includes() su un elenco, non
   una ricerca dentro un oggetto. */
Deno.test('un nome ereditato non e un tipo', () => {
  for (const tipo of ['toString', 'constructor']) {
    const c = componiRichiesta({ tipo, nome: 'Rossi Mario', email: 'r@esempio.it', telefono: '+39 333 1234567', lingua: 'it', privacy_presa_atto: true, dati: {}, });
    assert(c.errore, `il tipo ${tipo} e passato`);
  }
});

/* Senza questa, le due prove sopra passerebbero anche se il cancello
   rifiutasse TUTTO — cioe' se il modulo pubblico smettesse di funzionare.
   Qui non si pretende che la richiesta sia valida: si pretende che a
   fermarla non sia IL CANCELLO. */
Deno.test('i sei tipi pubblici non li ferma il cancello', () => {
  assert(TIPI_ATTIVI.length === 6,
    `i tipi pubblici sono ${TIPI_ATTIVI.length}: aggiornare questa prova`);
  for (const tipo of TIPI_ATTIVI) {
    const c = componiRichiesta({ tipo, nome: 'Rossi Mario', email: 'r@esempio.it', telefono: '+39 333 1234567', lingua: 'it', privacy_presa_atto: true, dati: {}, });
    /* il messaggio ESATTO del cancello: «circolo sconosciuto» di
       validaGreenfee contiene la stessa parola, e con una regex larga
       questa prova falliva su un tipo perfettamente pubblico */
    assert(c.errore !== 'tipo di richiesta sconosciuto',
      `il cancello ferma ${tipo}, che e pubblico`);
  }
});
