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
import { campiObbligatori, mancanti, segnaEtichette, TIPI_MODULO, voloRichiesto , nomiMancanti } from './obbligatori.js';

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
    /* Su quasi tutti i moduli i campi del tipo stanno PRIMA dei contatti,
       e l'elenco deve seguire quell'ordine. Il modulo delle camere e'
       l'eccezione vera: le date e la camera si scelgono nei passi
       precedenti, e la schermata dei dati ha solo i contatti — quindi li
       nomina per primi perche' sono i primi che si vedono. */
    if (campiObbligatori(tipo).length > 3) {
      assert(primoContatto > 0, `${tipo}: i contatti vengono per primi, ma sul modulo stanno dopo`);
    } else {
      assertEquals(primoContatto, 0, `${tipo}: ha solo i contatti e non li mette per primi`);
    }
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
  prenota: '../prenota/index.html',
};

Deno.test('ogni campo obbligatorio esiste sulla pagina che lo disegna', () => {
  for (const tipo of TIPI_MODULO) {
    const dove = PAGINA[tipo as keyof typeof PAGINA];
    assert(dove, `${tipo} non dice su quale pagina vive`);
    const sorgente = Deno.readTextFileSync(new URL(dove, import.meta.url));
    /* anche i campi che diventano obbligatori solo in certe situazioni: il
       volo quando la destinazione ne ha uno, giorno e ora del ritorno quando
       la spunta e' accesa. Se non esistessero sulla pagina, l'asterisco non
       comparirebbe e il controllo cercherebbe un campo che non c'e'. */
    const contesto = tipo === 'transfer'
      ? { luogo: 'Venezia  aeroporto', ritorno: true }
      : {};
    for (const c of campiObbligatori(tipo, contesto)) {
      /* il prefisso e non la stringa intera: un'etichetta puo' avere altri
         attributi (id, class) e resta la stessa etichetta */
      assert(
        sorgente.includes(`<label for="${c.id}">`) || sorgente.includes(`<label for="${c.id}" `),
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

/* ============================================================
   IL VOLO, E IL RITORNO.

   IL VOLO. Era facoltativo: senza, la reception non sa a che ora atterra
   nessuno, e per la navetta collettiva — che parte tre ore prima del volo —
   non c'e' proprio modo di calcolare l'orario del ritiro.

   MA NON OVUNQUE. Chi va a Golf Frassanelle non ha un volo ne' un treno:
   obbligarlo a scriverne uno vorrebbe dire farglielo inventare. Si chiede
   dove un volo o un treno esiste davvero — aeroporti, stazioni, porto.

   IL RITORNO. La spunta «mi serve anche il ritorno» mandava solo un
   booleano: nessun giorno, nessuna ora. La reception doveva telefonare per
   sapere quando.
   ============================================================ */
Deno.test('il volo si chiede dove un volo o un treno esiste', () => {
  for (
    const luogo of [
      'Venezia  aeroporto', 'Treviso Aeroporto', 'Verona Aeroporto✈️',
      'Bologna Aeroporto', 'Venezia P.le Roma', 'Venezia porto',
      'Padova FS', 'Terme  Euganee FS', 'Mestre fs',
    ]
  ) {
    const ids = campiObbligatori('transfer', { luogo }).map((c) => c.id);
    assert(ids.includes('fVolo'), `su ${luogo} il volo doveva essere obbligatorio`);
  }
});

Deno.test('sui golf e sui paesi vicini il volo non si chiede', () => {
  for (const luogo of ['Golf Valsanzibio 🏌', 'Golf Montecchia🏌', 'Golf Frassanelle 🏌', 'Abano', 'Montegrotto', 'Padova città', '']) {
    const ids = campiObbligatori('transfer', { luogo }).map((c) => c.id);
    assert(!ids.includes('fVolo'), `su "${luogo}" il volo non doveva essere obbligatorio`);
  }
});

Deno.test('col ritorno spuntato si chiedono giorno e ora del ritorno', () => {
  const ids = campiObbligatori('transfer', { luogo: 'Abano', ritorno: true }).map((c) => c.id);
  assert(ids.includes('fRitornoQuando'), 'manca il giorno del ritorno');
  assert(ids.includes('fRitornoOra'), 'manca l ora del ritorno');
});

Deno.test('senza la spunta del ritorno non si chiede niente in piu', () => {
  const ids = campiObbligatori('transfer', { luogo: 'Abano' }).map((c) => c.id);
  assert(!ids.includes('fRitornoQuando'));
  assert(!ids.includes('fRitornoOra'));
});

/* Gli altri moduli non hanno un contesto da passare: chiamare senza secondo
   argomento deve continuare a funzionare esattamente come prima. */
Deno.test('senza contesto l elenco resta quello di sempre', () => {
  for (const tipo of ['transfer', 'greenfee', 'maestro', 'trattamenti', 'dayspa']) {
    assert(campiObbligatori(tipo).length > 0, tipo);
  }
  assertEquals(
    campiObbligatori('transfer').map((c) => c.id),
    campiObbligatori('transfer', {}).map((c) => c.id),
  );
});

/* ============================================================
   L'ASTERISCO CHE DEVE ANCHE SPARIRE.

   Con un campo obbligatorio solo in certe situazioni, segnare non basta.
   Se l'ospite sceglie Venezia aeroporto e poi cambia idea per Golf
   Frassanelle, l'asterisco sul volo deve andarsene: restando li' chiederebbe
   un dato che per quella destinazione non esiste, e il messaggio direbbe
   «manca il volo» a chi un volo non ce l'ha.

   Un documento finto, con le due sole cose che segnaEtichette tocca
   davvero: l'attributo aria-required sul campo e l'asterisco
   nell'etichetta.
   ============================================================ */
function docFinto(ids: string[]) {
  const stato: Record<string, { aria: boolean; stella: boolean }> = {};
  for (const id of ids) stato[id] = { aria: false, stella: false };
  return {
    stato,
    getElementById(id: string) {
      if (!stato[id]) return null;
      return {
        setAttribute: () => { stato[id].aria = true; },
        removeAttribute: () => { stato[id].aria = false; },
      };
    },
    querySelector(sel: string) {
      const id = /label\[for="(.+?)"\]/.exec(sel)?.[1] ?? '';
      if (!stato[id]) return null;
      return {
        querySelector: () =>
          stato[id].stella ? { remove: () => { stato[id].stella = false; } } : null,
        insertAdjacentHTML: () => { stato[id].stella = true; },
      };
    },
  };
}

const IDS = ['fLuogo', 'fQuando', 'fOra', 'fVolo', 'fNome', 'fEmail', 'fTel'];

Deno.test('l asterisco compare sul volo quando la destinazione ha un volo', () => {
  const doc = docFinto(IDS);
  segnaEtichette('transfer', doc, { luogo: 'Venezia  aeroporto' });
  assertEquals(doc.stato.fVolo.stella, true);
  assertEquals(doc.stato.fVolo.aria, true);
});

Deno.test('e se ne va quando la destinazione un volo non ce l ha', () => {
  const doc = docFinto(IDS);
  segnaEtichette('transfer', doc, { luogo: 'Venezia  aeroporto' });
  segnaEtichette('transfer', doc, { luogo: 'Golf Frassanelle 🏌' });
  assertEquals(doc.stato.fVolo.stella, false, 'l asterisco non se n e andato');
  assertEquals(doc.stato.fVolo.aria, false, 'aria-required e rimasto acceso');
  /* gli altri non si toccano: restano obbligatori sempre */
  assertEquals(doc.stato.fQuando.stella, true);
});

Deno.test('il controllo prima dell invio guarda lo stesso contesto', () => {
  const valori: Record<string, string> = {
    fLuogo: 'Venezia  aeroporto', fQuando: '2026-09-10', fOra: '14:30',
    fVolo: '', fNome: 'A', fEmail: 'a@b.it', fTel: '333',
  };
  const conVolo = mancanti('transfer', (id: string) => valori[id] ?? '', { luogo: valori.fLuogo });
  assert(conVolo.some((c) => c.id === 'fVolo'), 'il volo mancante doveva essere segnalato');

  const senzaVolo = mancanti('transfer', (id: string) => valori[id] ?? '', { luogo: 'Golf Frassanelle 🏌' });
  assert(!senzaVolo.some((c) => c.id === 'fVolo'), 'sul golf il volo non si chiede');
});


/* ============================================================
   IL MODULO DELLE CAMERE.

   Visto in produzione il 20 agosto 2026: mancava il telefono, e il
   messaggio diceva «Compili nome ed email» — cioe' nominava due campi
   pieni e taceva quello vuoto. Era scritto a mano nella pagina, in quattro
   lingue, e nessuno l'aveva aggiornato quando il telefono e' diventato
   obbligatorio. In piu' compariva in fondo, piccolo, senza portare l'ospite
   sul campo da riempire.

   Il sistema per farlo bene esisteva gia' e lo usa il transfer: l'asterisco
   sulle etichette obbligatorie, l'elenco di cio' che manca DAVVERO, e il
   fuoco sul primo campo vuoto. Questa e' la prova che il modulo delle
   camere ci sta dentro anche lui.
   ============================================================ */
Deno.test('il modulo delle camere e fra i moduli che sanno cosa e obbligatorio', () => {
  assert(TIPI_MODULO.includes('prenota'), 'prenota non e fra i tipi');
});

Deno.test('col telefono vuoto il messaggio nomina il telefono, non nome ed email', () => {
  const pieni: Record<string, string> = { fNome: 'Raffael Renga', fEmail: 'r@esempio.it', fTel: '' };
  const vuoti = mancanti('prenota', (id: string) => pieni[id] ?? '');
  assertEquals(vuoti.map((c) => c.id), ['fTel'], 'non ha visto che manca il telefono');

  const t = { nome: 'Nome e cognome', email: 'Email', tel: 'Telefono' };
  const detto = nomiMancanti(vuoti, t);
  assertEquals(detto, 'Telefono');
  assert(!detto.includes('Email'), 'nomina un campo che e pieno');
});

Deno.test('e se manca tutto li nomina tutti, nell ordine del modulo', () => {
  const vuoti = mancanti('prenota', () => '');
  assertEquals(vuoti.map((c) => c.id), ['fNome', 'fEmail', 'fTel']);
});

/* Il messaggio scritto a mano non deve sopravvivere accanto a quello
   giusto: due messaggi divergono, e il vecchio e' quello sbagliato. */
Deno.test('la pagina non tiene piu un messaggio scritto a mano', () => {
  const sorgente = Deno.readTextFileSync(new URL('../prenota/index.html', import.meta.url));
  assert(!sorgente.includes('mancaDati'), 'la pagina ha ancora il messaggio scritto a mano');
  assert(sorgente.includes("mancanti('prenota'"), 'la pagina non usa il sistema condiviso');
  assert(sorgente.includes("segnaEtichette('prenota'"), 'la pagina non mette gli asterischi');
});
