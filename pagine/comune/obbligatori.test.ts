/* ============================================================
   obbligatori.test.ts — quali campi servono davvero, e chi lo dice.

   IL DIFETTO CHE PRESIDIA. Il modulo controllava con un sì-o-no:

       if (!completo()) mostra('Compili i campi obbligatori.');

   e il messaggio usciva in fondo, accanto al pulsante «Invia». Su un modulo
   da dodici campi — il green fee ne ha tanti — l'ospite leggeva che manca
   qualcosa e non sapeva cosa: nessun asterisco sulle etichette, nessun segno
   sul campo vuoto, e il messaggio a volte fuori schermo rispetto al punto
   dove doveva tornare. Chi non trova l'errore non riprova: se ne va, e la
   richiesta non arriva mai.

   Qui vive UNA lista sola. L'asterisco sull'etichetta e il controllo prima
   dell'invio nascono dallo stesso elenco: e' l'unico modo perche' non
   esista un campo obbligatorio senza asterisco, o un asterisco su un campo
   che poi nessuno controlla. Le due cose erano scritte in due posti
   diversi, ed e' esattamente cosi' che divergono.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';
import { campiObbligatori, mancanti, TIPI_MODULO } from './obbligatori.js';

/* i tipi che il modulo delle richieste sa disegnare (percorso.js), piu' il
   transfer, che ha una pagina sua ma le stesse tre righe di contatto */
const ATTESI = ['greenfee', 'maestro', 'trattamenti', 'dayspa', 'transfer', 'soggiorno'];

Deno.test('ogni tipo di richiesta ha la sua lista', () => {
  for (const tipo of ATTESI) {
    assert(TIPI_MODULO.includes(tipo), `manca il tipo ${tipo}`);
    assert(campiObbligatori(tipo).length > 0, `${tipo} non chiede niente`);
  }
});

/* Nome, email e telefono sono obbligatori su TUTTI: ognuna di queste
   richieste e' un appuntamento che si puo' spostare, e per spostarlo
   bisogna poter chiamare. */
Deno.test('nome, email e telefono servono su ogni modulo', () => {
  for (const tipo of TIPI_MODULO) {
    const campi = campiObbligatori(tipo).map((c) => c.id);
    for (const id of ['fNome', 'fEmail', 'fTel']) {
      assert(campi.includes(id), `${tipo} non chiede ${id}`);
    }
  }
});

Deno.test('il Day Spa chiede il giorno e non un ora, che non ha', () => {
  const campi = campiObbligatori('dayspa').map((c) => c.id);
  assert(campi.includes('fGiorno'));
  assert(!campi.includes('fOra'), 'il Day Spa non ha un orario: si entra dalle 9:00');
});

Deno.test('il green fee e la lezione col maestro chiedono giorno e ora', () => {
  for (const tipo of ['greenfee', 'maestro']) {
    const campi = campiObbligatori(tipo).map((c) => c.id);
    assert(campi.includes('fData'), `${tipo} senza data`);
    assert(campi.includes('fOra'), `${tipo} senza ora`);
  }
});

/* Ogni campo obbligatorio deve sapere anche COME si chiama, altrimenti il
   messaggio non puo' nominarlo e si torna al «Compili i campi obbligatori».
   La chiave e' quella dei testi tradotti della pagina. */
Deno.test('ogni campo obbligatorio porta con se la chiave del proprio nome', () => {
  for (const tipo of TIPI_MODULO) {
    for (const c of campiObbligatori(tipo)) {
      assert(c.id, `${tipo}: campo senza id`);
      assert(c.eti, `${tipo}: ${c.id} non sa come si chiama`);
    }
  }
});

Deno.test('mancanti elenca cio che manca, non un si o un no', () => {
  const valori: Record<string, string> = { fNome: 'Anna Verdi', fEmail: '', fTel: '  ', fGiorno: '2026-09-20' };
  const vuoti = mancanti('dayspa', (id: string) => valori[id] ?? '');
  assertEquals(vuoti.map((c) => c.id), ['fEmail', 'fTel']);
});

Deno.test('quando non manca niente l elenco e vuoto', () => {
  const pieni: Record<string, string> = { fNome: 'Anna', fEmail: 'a@b.it', fTel: '+39 333', fGiorno: '2026-09-20' };
  assertEquals(mancanti('dayspa', (id: string) => pieni[id] ?? '').length, 0);
});

/* Lo spazio non e' un valore: «   » nel telefono e' un telefono che non c'e'. */
Deno.test('un campo pieno di soli spazi conta come vuoto', () => {
  const vuoti = mancanti('dayspa', (id: string) => (id === 'fNome' ? '   ' : 'x'));
  assertEquals(vuoti.map((c) => c.id), ['fNome']);
});

/* Trovato in un browser vero, non leggendo il codice: col contatto per
   primo, il messaggio diceva «Nome, Email, Telefono, Giorno, Ora» mentre
   sulla pagina il primo campo vuoto era il giorno, in cima al modulo. Il
   fuoco andava sul nome e l'ospite doveva risalire dopo essere stato
   portato in fondo. */
Deno.test('l elenco segue l ordine del modulo: prima il tipo, poi i contatti', () => {
  for (const tipo of TIPI_MODULO) {
    const ids = campiObbligatori(tipo).map((c) => c.id);
    const primoContatto = ids.indexOf('fNome');
    for (const id of ids.slice(0, primoContatto)) {
      assert(
        !['fNome', 'fEmail', 'fTel'].includes(id),
        `${tipo}: un contatto e finito prima dei campi del tipo`,
      );
    }
    assert(primoContatto > 0, `${tipo}: i contatti vengono per primi, ma sul modulo stanno dopo`);
  }
});

/* ============================================================
   E GLI ID DEVONO ESISTERE DAVVERO SULLA PAGINA.

   IL DIFETTO CHE PRESIDIA. Alla prima stesura il transfer aveva qui gli id
   degli altri moduli — `fData` invece di `fQuando` — e gli mancava la
   destinazione. Su quella pagina non avrebbero trovato niente: nessun
   asterisco sarebbe comparso, e il controllo prima dell'invio avrebbe
   lasciato passare un modulo vuoto, tornando a far scoprire il rifiuto solo
   dopo aver premuto «Invia».

   Una lista di id e' una promessa su un'altra pagina, e una promessa che
   nessuno verifica invecchia in silenzio.
   ============================================================ */
const PAGINA = {
  greenfee: '../richieste/index.html',
  maestro: '../richieste/index.html',
  trattamenti: '../richieste/index.html',
  dayspa: '../richieste/index.html',
  soggiorno: '../richieste/index.html',
  transfer: '../richieste/transfer/index.html',
};

Deno.test('ogni campo obbligatorio esiste sulla pagina che lo disegna', () => {
  for (const tipo of TIPI_MODULO) {
    const dove = PAGINA[tipo as keyof typeof PAGINA];
    assert(dove, `${tipo} non dice su quale pagina vive`);
    const sorgente = Deno.readTextFileSync(new URL(dove, import.meta.url));
    for (const c of campiObbligatori(tipo)) {
      assert(
        sorgente.includes(`<label for="${c.id}">`),
        `${tipo}: il campo ${c.id} non esiste in ${dove}`,
      );
      /* se un campo dice di farsi mostrare altrove, quel posto deve
         esistere: altrimenti l'ospite non viene portato da nessuna parte */
      if (c.mostra) {
        assert(
          sorgente.includes(`id="${c.mostra}"`),
          `${tipo}: ${c.id} rimanda a #${c.mostra}, che in ${dove} non c'e'`,
        );
      }
      assert(
        /* String.raw: dentro un template normale `\b` e' il carattere
           backspace, non il confine di parola, e la prova passava sempre */
        new RegExp(String.raw`\bt\.${c.eti}\b`).test(sorgente),
        `${tipo}: il nome tradotto t.${c.eti} non esiste in ${dove}`,
      );
    }
  }
});
