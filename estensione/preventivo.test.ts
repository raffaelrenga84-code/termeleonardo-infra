/* ============================================================
   preventivo.test.ts — il documento che nasce fuori da una
   prenotazione.

   COSA SORVEGLIA. Il preventivo esiste per rispondere a chi chiede un
   prezzo senza avere una pratica in Fidra. Il rischio non e' che non
   esca: e' che esca somigliando a un'offerta. Un cliente che legge un
   numero d'offerta, un acconto o una scadenza capisce «camera tenuta»,
   e nessuno gliel'ha tenuta.

   Il secondo rischio e' un prezzo stimato. Quando c'e' un pacchetto
   settimanale piu' una coda di notti, il 5% che il modale mostra e' una
   stima — sta scritto nel codice: «stima: il conto esatto e' in Notte
   per notte». Una stima dentro un preventivo diventa una promessa. Qui
   il modello si rifiuta di scriverla.

   Il terzo e' il piu' silenzioso: un prezzo senza merce. Il pacchetto
   che non dice cosa comprende, la camera senza metratura, i bambini
   contati invece che quotati. Il modale quei numeri li ha gia' e i
   modelli quei testi li hanno gia': se qui non compaiono, e' perche'
   qualcuno ha smesso di riusarli.
   ============================================================ */
import { assert, assertEquals, assertThrows } from 'jsr:@std/assert';

const FILE = [
  'template.js', 'template-conferma.js', 'template-de.js',
  'template-en.js', 'template-fr.js', 'template-extra.js',
];
const SORGENTE = FILE.map((f) => Deno.readTextFileSync(new URL(f, import.meta.url))).join('\n');

const LINGUE = ['it', 'de', 'en', 'fr'] as const;
type Lingua = typeof LINGUE[number];

type Voce = {
  categoria: string;
  trattamento: string;
  prezzoPP: number;
  totale: number;
  cure: number;
  sconto5: number;
  sconto3: number;
  bambiniPrezzi?: number[];
  stima?: boolean;
};
type Dati = {
  intestatario: string;
  email: string;
  giornoArrivo: number;
  mese: string;
  anno: number;
  giornoPartenza: number;
  mesePartenza: string;
  annoPartenza: number;
  notti: number;
  adulti: number;
  bambini: number;
  etaBambini: number[];
  voci: Voce[];
};
type Opzioni = Record<string, unknown>;

type Modelli = {
  html: Record<string, (d: Dati, o: Opzioni) => string>;
  ogg: Record<string, () => string>;
};

function modelli(): Modelli {
  const coda = `
    return {
      html: { it: costruisciPreventivoIT, de: costruisciPreventivoDE,
              en: costruisciPreventivoEN, fr: costruisciPreventivoFR },
      ogg:  { it: oggettoPreventivoIT, de: oggettoPreventivoDE,
              en: oggettoPreventivoEN, fr: oggettoPreventivoFR }
    };`;
  return new Function(SORGENTE + coda)() as Modelli;
}

const DATI = (): Dati => ({
  intestatario: 'Bianchi Maria',
  email: 'ospite@esempio.it',
  giornoArrivo: 23,
  mese: 'Aug',
  anno: 2026,
  giornoPartenza: 26,
  mesePartenza: 'Aug',
  annoPartenza: 2026,
  notti: 3,
  adulti: 2,
  bambini: 0,
  etaBambini: [],
  voci: [
    {
      categoria: 'DOPPIA',
      trattamento: 'Miglior Prezzo Mezza Pensione',
      prezzoPP: 39000,
      totale: 78000,
      cure: 0,
      sconto5: 0,
      sconto3: 0,
      bambiniPrezzi: [],
      stima: false,
    },
    {
      categoria: 'JUNIOR SUITE COLLI EUGANEI',
      trattamento: 'Miglior Prezzo Bed & Breakfast',
      prezzoPP: 34500,
      totale: 69000,
      cure: 0,
      sconto5: 0,
      sconto3: 0,
      bambiniPrezzi: [],
      stima: false,
    },
  ],
});
const OPZ: Opzioni = { genere: 'F', titolo: '', firma: 'La Reception' };

/* quante volte compare davvero: match senza /g ne conta sempre una sola,
   e una prova che non sa contare non sorveglia niente */
function quante(html: string, re: RegExp): number {
  return (html.match(new RegExp(re.source, 'gi')) || []).length;
}

Deno.test('il modello si carica in tutte e quattro le lingue', () => {
  const m = modelli();
  for (const l of LINGUE) {
    assert(typeof m.html[l] === 'function', `manca il costruttore ${l}`);
    assert(typeof m.ogg[l] === 'function', `manca l oggetto ${l}`);
  }
});

Deno.test('esce un documento con dentro i prezzi, in tutte e quattro', () => {
  const m = modelli();
  for (const l of LINGUE) {
    const html = m.html[l](DATI(), OPZ);
    assert(html.length > 1000, `il documento ${l} e troppo corto per essere un'email`);
    assert(/390[.,]00/.test(html), `il prezzo a persona non compare in ${l}`);
    assert(/780[.,]00/.test(html), `il totale non compare in ${l}`);
  }
});

Deno.test('non nomina MAI numero d offerta, acconto, scadenza, caparra', () => {
  const m = modelli();
  /* le parole che fanno leggere «camera tenuta» a chi riceve.

     «bonifico» NON e' in questa lista, e non e' una dimenticanza:
     AVVISO_PREZZO_SPECIALE lo nomina legittimamente («valido solo con
     pagamento tramite bonifico prima dell'arrivo o in contanti») ed e'
     una condizione della tariffa, non un invito a pagare una caparra.
     Restano vietate «causale» e «IBAN», che compaiono solo nel blocco
     delle istruzioni di pagamento dell'offerta vera. */
  const VIETATE = [
    /offerta n\./i, /angebot nr/i, /offer no\./i, /offre n[°o]/i,
    /acconto/i, /anzahlung/i, /deposit/i, /acompte/i,
    /caparra/i, /conferma ora/i, /jetzt best/i, /confirm now/i,
    /scade/i, /verf(a|&auml;)llt/i, /expires/i, /expire/i,
    /causale/i, /IBAN/,
  ];
  /* si prova anche su un pacchetto: il suo blocco porta testi che il
     preventivo semplice non ha, ed e' li' che una parola vietata si
     infilerebbe senza che nessuno la veda */
  const conPacchetto = DATI();
  conPacchetto.voci = [{ ...conPacchetto.voci[0], trattamento: 'Dolce Vita Spezial 10 cure' }];
  for (const l of LINGUE) {
    for (const d of [DATI(), conPacchetto]) {
      const html = m.html[l](d, { ...OPZ, cure: true, cane: true });
      for (const re of VIETATE) {
        assert(!re.test(html), `il preventivo ${l} contiene «${re}»: sembra un'offerta`);
      }
    }
  }
});

Deno.test('dice che non blocca la camera, in tutte e quattro', () => {
  const m = modelli();
  const ATTESE: Record<Lingua, RegExp> = {
    it: /non blocca la camera/i,
    de: /kein Zimmer reserviert/i,
    en: /does not hold the room/i,
    fr: /ne bloque pas la chambre/i,
  };
  for (const l of LINGUE) {
    const html = m.html[l](DATI(), OPZ);
    assert(ATTESE[l].test(html), `manca l avviso «non blocca la camera» in ${l}`);
  }
});

Deno.test('con un ospite solo nomina l uso singola, in tutte e quattro', () => {
  const m = modelli();
  const d = DATI();
  d.adulti = 1;
  d.voci = [d.voci[0]];
  const ATTESE: Record<Lingua, RegExp> = {
    it: /uso singola/i,
    de: /Alleinbenutzung/i,
    en: /single use|sole use/i,
    fr: /usage individuel/i,
  };
  for (const l of LINGUE) {
    const html = m.html[l](d, OPZ);
    assert(ATTESE[l].test(html), `con un ospite solo manca l uso singola in ${l}`);
  }
});

Deno.test('una voce con prezzo stimato non si scrive: solleva errore', () => {
  const m = modelli();
  const d = DATI();
  d.voci[0].stima = true;
  for (const l of LINGUE) {
    assertThrows(() => m.html[l](d, OPZ), Error, 'stimato');
  }
});

Deno.test('senza nessuna sistemazione non esce un documento vuoto', () => {
  const m = modelli();
  const d = DATI();
  d.voci = [];
  assertThrows(() => m.html.it(d, OPZ), Error);
});

Deno.test('il 3% anticipo si nomina ma non si sottrae dal totale', () => {
  /* il codice del modale lo dice gia': «non toglierli dall'offerta».
     Il cliente paga il prezzo pieno e riceve l'importo alla partenza. */
  const m = modelli();
  const d = DATI();
  d.voci = [{ ...d.voci[0], sconto3: 2340 }];
  const html = m.html.it(d, OPZ);
  assert(/780[.,]00/.test(html), 'il totale e stato ridotto dal 3%: non va sottratto');
  assert(/23[.,]40/.test(html), 'il 3% non e nominato');
});

const TITOLI: Record<Lingua, RegExp> = {
  it: /IL PACCHETTO COMPRENDE/,
  de: /IM PAKET ENTHALTEN/,
  en: /YOUR PACKAGE INCLUDES/,
  fr: /LE FORFAIT COMPREND/,
};

function conTrattamento(nome: string): Dati {
  const d = DATI();
  d.voci = [{ ...d.voci[0], trattamento: nome }];
  return d;
}

Deno.test('un pacchetto dice che cosa comprende, nelle lingue in cui e venduto', () => {
  /* «Dolce Vita Spezial 10 cure» senza l'elenco delle applicazioni e' un
     prezzo senza merce: chi legge non sa che dentro ci sono visita
     medica, fanghi, bagni all'ozono, massaggi e inalazioni. notaPacchetto
     lo sa gia' fare per le offerte vere — qui si riusa, non si riscrive.

     Si guarda l'intestazione del blocco e non una parola del listino: il
     testo dei pacchetti e' commerciale e cambia, il blocco no.

     LE LINGUE NON SONO TUTTE E QUATTRO, ED E' VOLUTO. In PACCHETTI,
     'spezial' e 'dolce vita' portano lingue: ['de','en','fr'] e i
     Soggiorni Smart/Escape/Deluxe portano lingue: ['it']. E' una
     divisione di mercato scritta nel codice, non un buco da tappare:
     questa prova la tiene ferma, cosi' chi un giorno «aggiungera'
     l'italiano mancante» sappra' che sta cambiando una scelta
     commerciale, non correggendo un difetto. */
  const m = modelli();

  const spezial = conTrattamento('Dolce Vita Spezial 10 cure');
  for (const l of ['de', 'en', 'fr'] as const) {
    assert(TITOLI[l].test(m.html[l](spezial, OPZ)), `lo Spezial non dice cosa comprende in ${l}`);
  }
  assert(
    !TITOLI.it.test(m.html.it(spezial, OPZ)),
    'lo Spezial e comparso in italiano: PACCHETTI lo pubblica solo in de/en/fr',
  );

  const deluxe = conTrattamento('Soggiorno Deluxe Mezza Pensione');
  assert(TITOLI.it.test(m.html.it(deluxe, OPZ)), 'il Soggiorno Deluxe non dice cosa comprende in italiano');
  for (const l of ['de', 'en', 'fr'] as const) {
    assert(
      !TITOLI[l].test(m.html[l](deluxe, OPZ)),
      `il Soggiorno Deluxe e comparso in ${l}: PACCHETTI lo pubblica solo in italiano`,
    );
  }
});

Deno.test('il numero di applicazioni si legge dal nome, e {N} non arriva mai all ospite', () => {
  const m = modelli();
  const dieci = m.html.de(conTrattamento('Dolce Vita Spezial 10 cure'), OPZ);
  assert(/10 Naturfangopackungen/.test(dieci), 'le dieci applicazioni non compaiono');
  const cinque = m.html.de(conTrattamento('Dolce Vita Spezial 5 cure'), OPZ);
  assert(/5 Naturfangopackungen/.test(cinque), 'le cinque applicazioni non compaiono');
  for (const l of LINGUE) {
    assert(
      !/\{N\}/.test(m.html[l](conTrattamento('Dolce Vita Spezial'), OPZ)),
      `il segnaposto {N} e arrivato nel documento ${l}`,
    );
  }
});

Deno.test('una tariffa che non e un pacchetto non si inventa il blocco', () => {
  const m = modelli();
  for (const l of LINGUE) {
    assert(
      !TITOLI[l].test(m.html[l](DATI(), OPZ)),
      `una mezza pensione qualunque si e presa il blocco di un pacchetto in ${l}`,
    );
  }
});

Deno.test('la camera e descritta, e la dotazione compare una volta sola', () => {
  const m = modelli();
  const DOT: Record<Lingua, RegExp> = {
    it: /aria condizionata/,
    de: /Klimaanlage/,
    en: /air conditioning/,
    fr: /climatisation/,
  };
  for (const l of LINGUE) {
    const html = m.html[l](DATI(), OPZ);
    assert(/16 m|18 m|24 m/.test(html), `manca la descrizione della camera in ${l}`);
    assertEquals(
      quante(html, DOT[l]),
      1,
      `la dotazione compare ${quante(html, DOT[l])} volte in ${l}: va in fondo, non per camera`,
    );
  }
});

Deno.test('i bambini compaiono col loro prezzo, non solo contati', () => {
  /* il modale calcola il prezzo di ogni bambino per eta' (dettaglioB):
     buttarlo via e scrivere «2 bambini» sarebbe far ricopiare a mano
     proprio il numero che si e' fatta la fatica di leggere */
  const m = modelli();
  const d = DATI();
  d.bambini = 2;
  d.etaBambini = [5, 11];
  d.voci = [{ ...d.voci[0], bambiniPrezzi: [3000, 8000] }];
  for (const l of LINGUE) {
    const html = m.html[l](d, OPZ);
    assert(/30[.,]00/.test(html), `manca il prezzo del primo bambino in ${l}`);
    assert(/80[.,]00/.test(html), `manca il prezzo del secondo bambino in ${l}`);
    assert(/\b5\b/.test(html) && /\b11\b/.test(html), `mancano le eta in ${l}`);
  }
});

Deno.test('cure e cane compaiono solo se richiesti', () => {
  const m = modelli();
  const senza = m.html.it(DATI(), OPZ);
  assert(!/impegnativa/i.test(senza), 'le cure compaiono senza che siano state chieste');
  assert(!/cane/i.test(senza), 'il cane compare senza che sia stato chiesto');
  const CURE: Record<Lingua, RegExp> = {
    it: /impegnativa/i,
    de: /&auml;rztlich|Verordnung/i,
    en: /doctor/i,
    fr: /m&eacute;decin/i,
  };
  const CANE: Record<Lingua, RegExp> = {
    it: /cane/i,
    de: /Hund/i,
    en: /dog/i,
    fr: /chien/i,
  };
  for (const l of LINGUE) {
    const html = m.html[l](DATI(), { ...OPZ, cure: true, cane: true });
    assert(CURE[l].test(html), `manca la riga delle cure in ${l}`);
    assert(CANE[l].test(html), `manca la riga del cane in ${l}`);
    assert(/13/.test(html), `manca il prezzo del cane in ${l}`);
  }
});

/* ============================================================
   Il modale non si puo' eseguire in Deno: e' una IIFE che tocca il DOM
   di Fidra. Queste prove leggono il testo — meno di una prova vera, ma
   tengono ferme le cose che, cambiando, romperebbero il preventivo in
   silenzio invece che con un errore.
   ============================================================ */
const MODALE = Deno.readTextFileSync(new URL('fidra-disponibilita.js', import.meta.url));

Deno.test('il modale deposita leonardo_preventivo, e non tocca il dettaglio', () => {
  assert(
    MODALE.includes('leonardo_preventivo'),
    'il modale non scrive piu la chiave che il pannello legge',
  );
  assert(
    MODALE.includes('leonardo_dettaglio'),
    'la strada del dettaglio notte per notte e sparita: non andava toccata',
  );
});

Deno.test('una tariffa con sconto stimato ha il pulsante spento', () => {
  /* l'unica cosa che impedisce a una stima di diventare una promessa in
     un'email: il modello la rifiuta, ma qui non deve nemmeno partire */
  assert(
    /sconto\s*&&\s*sconto\.stima/.test(MODALE),
    'sparito il controllo su sconto.stima: le stime tornano preventivabili',
  );
  assert(
    /data-stima/.test(MODALE) && /b\.dataset\.stima/.test(MODALE),
    'il pulsante spento per stima non e piu riconoscibile: marcaPulsanti lo riaccenderebbe',
  );
});

Deno.test('il massimo di quattro voci non e scritto a mano', () => {
  const n = (MODALE.match(/MAX_SCELTE/g) || []).length;
  assert(n >= 3, `MAX_SCELTE compare ${n} volte: non e usato dove serve`);
  assert(
    !/SCELTE\.length\s*[<>]=?\s*4\b/.test(MODALE),
    'il numero quattro e scritto a mano invece di MAX_SCELTE',
  );
});

Deno.test('le voci portano i prezzi dei bambini, non solo il conteggio', () => {
  assert(/data-bimbi/.test(MODALE), 'sparito data-bimbi: i bambini tornano solo contati');
  assert(
    /bambiniPrezzi:/.test(MODALE),
    'la voce non porta piu bambiniPrezzi: il modello non potra scrivere il prezzo per eta',
  );
});

/* ============================================================
   Il pannello, come il modale, tocca il DOM e non si esegue qui. Ma la
   cosa che deve restare vera e' testuale, e questa prova la sorveglia
   meglio di quanto potrebbe farlo un click.
   ============================================================ */
const PANNELLO = Deno.readTextFileSync(new URL('popup.js', import.meta.url));

Deno.test('nel pannello non esiste piu nessun campo dove digitare un prezzo', () => {
  /* IL PUNTO DI TUTTA LA FUNZIONE. Se questi id tornano, e tornato anche
     il caso Kreiner: un prezzo scritto a mano, senza uso singola. */
  for (const id of ['rapPrezzo', 'rapAcconto', 'rapScadenza', 'rapRif', 'rapArrivo', 'camRapida']) {
    assert(!PANNELLO.includes(id), `«${id}» e tornato nel pannello: i prezzi si digitano di nuovo`);
  }
  assert(
    !PANNELLO.includes('aggiungiCameraRapida'),
    'aggiungiCameraRapida e tornata: era il modulo manuale',
  );
});

Deno.test('il preventivo e in tutte e due le tabelle MODELLI', () => {
  /* MODELLI e' definito due volte in popup.js, una per «Copia» e una per
     «Copia oggetto». Un documento presente in una sola delle due si
     comporta diversamente secondo il pulsante premuto. */
  const tabelle = (PANNELLO.match(/const MODELLI = \{/g) || []).length;
  const righe = (PANNELLO.match(/preventivo:\s*\{\s*it:\s*\[costruisciPreventivoIT/g) || []).length;
  assertEquals(righe, tabelle, `MODELLI e definito ${tabelle} volte ma il preventivo compare ${righe}`);
});

Deno.test('la voce compare solo con un preventivo fresco di mezz ora', () => {
  assert(/30 \* 60 \* 1000/.test(PANNELLO), 'sparita la soglia della mezz ora');
  assert(
    /\$\{PREVENTIVO \?/.test(PANNELLO),
    'la voce «Preventivo soggiorno» non e piu condizionata alla presenza del dato',
  );
});

Deno.test('il pannello passa al modello le eta dei bambini', () => {
  assert(
    /etaBambini: PREVENTIVO\.etaBambini/.test(PANNELLO),
    'senza le eta, rigaBambini scrive solo la somma invece del prezzo di ognuno',
  );
});

Deno.test('senza nome saluta comunque, senza scrivere «undefined»', () => {
  const m = modelli();
  const d = DATI();
  d.intestatario = '';
  for (const l of LINGUE) {
    const html = m.html[l](d, { genere: 'N', titolo: '', firma: 'La Reception' });
    assert(!/undefined|null/.test(html), `«undefined» nel documento ${l}`);
  }
});
