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

     v2.11.3 — CAPARRA, IBAN E CAUSALE SONO USCITI DA QUESTA LISTA, e
     vale la pena dire perche'. Li avevo vietati sostenendo che senza
     numero d'offerta il bonifico arriva in banca «senza nulla a cui
     attaccarlo». La proprieta' ha fatto notare che la causale non deve
     essere un numero: COGNOME + DATA DI ARRIVO si riconcilia altrettanto
     bene, e sull'estratto conto si legge meglio di «O26/19196». Aveva
     ragione, e la regola e' cambiata.

     Restano vietati il numero d'offerta, la scadenza dell'opzione e il
     pulsante di pagamento con carta: quest'ultimo ha davvero bisogno
     dell'id della pratica (/deposit-payment?id=...), e senza pratica il
     link non esiste proprio.

     «bonifico» non c'e' mai stato: AVVISO_PREZZO_SPECIALE lo nomina
     legittimamente come condizione di una tariffa. */
  const VIETATE = [
    /offerta n\./i, /angebot nr/i, /offer no\./i, /offre n[°o]/i,
    /conferma ora/i, /jetzt best/i, /confirm now/i, /confirmez maintenant/i,
    /deposit-payment/i,
    /scade/i, /verf(a|&auml;)llt/i, /expires/i,
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

Deno.test('il modale costruisce l email e apre Outlook da solo', () => {
  /* v2.9.1 — IL DIFETTO CHE LA RECEPTION HA VISTO SUBITO. Il modale
     depositava un dato e toccava aprire il pannello laterale, scegliere il
     documento e ribattere nome ed email: due finestre e quattro gesti per
     una cosa sola. Adesso finisce il lavoro qui. */
  assert(
    /costruisciPreventivoIT/.test(MODALE),
    'il modale non costruisce piu l email: e tornato il giro doppio',
  );
  assert(
    /LEONARDO_APRI_OUTLOOK/.test(MODALE),
    'il modale non chiede piu di aprire Outlook',
  );
  assert(
    /leonardo_email_pendente/.test(MODALE),
    'senza email pendente, outlook-inject non ha niente da inserire e la scheda si apre vuota',
  );
  assert(
    MODALE.includes('leonardo_dettaglio'),
    'la strada del dettaglio notte per notte e sparita: non andava toccata',
  );
});

Deno.test('i modelli sono caricati dove il modale gira', () => {
  /* il modale costruisce l'email dentro la pagina di Fidra: se il manifest
     non ci carica i modelli, costruisciPreventivoIT non esiste e il
     pulsante fallisce a ogni clic */
  const manifest = JSON.parse(
    Deno.readTextFileSync(new URL('manifest.json', import.meta.url)),
  ) as { content_scripts: Array<{ matches: string[]; js: string[] }> };
  const fidra = manifest.content_scripts.find((c) =>
    c.matches.includes('https://leonardo.fidra.cloud/*')
  );
  assert(fidra, 'sparito il content script che gira su tutta Fidra');
  for (const f of ['template.js', 'template-de.js', 'template-en.js', 'template-fr.js', 'template-extra.js']) {
    assert(fidra!.js.includes(f), `${f} non e caricato in Fidra: il preventivo non si costruisce`);
  }
  assert(
    fidra!.js.indexOf('template-extra.js') < fidra!.js.indexOf('fidra-disponibilita.js'),
    'i modelli vanno caricati PRIMA del modale che li usa',
  );
});

Deno.test('il service worker apre solo Outlook, non un indirizzo qualunque', () => {
  const bg = Deno.readTextFileSync(new URL('background.js', import.meta.url));
  assert(bg.includes('LEONARDO_APRI_OUTLOOK'), 'il service worker non sa aprire Outlook');
  assert(
    /\^https:\\\/\\\/outlook\\\./.test(bg),
    'manca il controllo sull indirizzo: una pagina di Fidra compromessa aprirebbe qualsiasi cosa',
  );
});

Deno.test('quello che si legge in Outlook arriva al riquadro in Fidra', () => {
  const inject = Deno.readTextFileSync(new URL('outlook-inject.js', import.meta.url));
  assert(
    /leonardo_richiesta/.test(inject),
    'outlook-inject non mette piu da parte la richiesta: nome ed email si ribattono a mano',
  );
  assert(
    /leonardo_richiesta/.test(MODALE),
    'il modale non rilegge la richiesta: i campi restano vuoti',
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

Deno.test('il preventivo NON passa dal pannello: una strada sola', () => {
  /* v2.9.1 — per un giorno ce ne sono state due, e la reception se n'e'
     accorta subito: «sono operazioni doppie, serve una cosa veloce».
     Il preventivo si fa nel riquadro, dove i prezzi sono sotto gli occhi.
     Una voce nel pannello che non puo' mai comparire sarebbe peggio di
     nessuna voce. */
  assert(
    !/value="preventivo"/.test(PANNELLO),
    'e tornata la voce «Preventivo soggiorno» nel pannello: due strade per la stessa cosa',
  );
  assert(
    !/costruisciPreventivo/.test(PANNELLO),
    'il pannello costruisce di nuovo il preventivo: quel lavoro sta nel riquadro',
  );
  assert(
    !/leonardo_preventivo/.test(PANNELLO),
    'il pannello rilegge una chiave che nessuno scrive piu',
  );
});

Deno.test('il modale passa al modello le eta dei bambini', () => {
  assert(
    /etaBambini: etaBambini\.slice\(\)/.test(MODALE),
    'senza le eta, rigaBambini scrive solo la somma invece del prezzo di ognuno',
  );
});

Deno.test('il pulsante finale non e travestito da pulsante secondario', () => {
  /* era un .usa come «Notte per notte»: l'azione che chiude il lavoro
     aveva lo stesso peso visivo di quella che apre un dettaglio, e non la
     trovava nessuno */
  assert(/class="prevVai"/.test(MODALE), 'il pulsante finale non ha piu uno stile suo');
  assert(
    /#leoDisp \.prevVai\{background:#E8751A/.test(MODALE),
    'il pulsante finale non e piu arancione come «Cerca» e «Copia e apri Outlook»',
  );
});

Deno.test('in italiano la camera si chiama «Camera», la suite no', () => {
  /* Fidra scrive «DOPPIA», «MATRIMONIALE QUEEN»: il sostantivo non c'e'.
     Nelle altre tre lingue e' dentro il nome (Doppelzimmer, Double room,
     Chambre double), ed e' per questo che si vedeva solo in italiano. */
  const m = modelli();
  const html = m.html.it(DATI(), OPZ);
  assert(/Camera Doppia/.test(html), 'la doppia si chiama ancora solo «Doppia»');
  assert(!/Camera Junior/.test(html), '«Camera Junior Suite» non lo dice nessuno');
  /* e nelle altre lingue non si aggiunge niente */
  assert(!/Camera /.test(m.html.de(DATI(), OPZ)), 'la parola italiana e finita nel tedesco');
});

Deno.test('piu sistemazioni: il preventivo dice che sono alternative', () => {
  /* LE ELENCAVA E BASTA. Chi riceve tre camere in fila puo' capire che
     sono tutte prenotate: va detto che se ne sceglie una. */
  const m = modelli();
  const html = m.html.it(DATI(), OPZ);
  assert(/ne scelga una/i.test(html), 'non dice che sono alternative');
  assert(!/non si sommano[\s\S]*Totale delle sistemazioni/i.test(html), 'somma e non somma insieme');
});

Deno.test('con «servono insieme» i prezzi si sommano e lo dice', () => {
  const m = modelli();
  const d = DATI();
  (d as unknown as Record<string, unknown>).insieme = true;
  const html = m.html.it(d, OPZ);
  assert(/insieme/i.test(html), 'non dice che le sistemazioni vanno prese insieme');
  /* 780,00 + 690,00 = 1.470,00 — il separatore delle migliaia dipende
     dai dati di localizzazione, quindi si accetta con e senza punto */
  assert(/1\.?470,00/.test(html), 'manca il totale di tutte le sistemazioni');
  assert(!/ne scelga una/i.test(html), 'dice insieme e alternative nello stesso documento');
});

Deno.test('una sistemazione sola non parla ne di scelta ne di insieme', () => {
  const m = modelli();
  const d = DATI();
  d.voci = [d.voci[0]];
  const html = m.html.it(d, OPZ);
  assert(!/ne scelga una/i.test(html), 'chiede di scegliere fra una cosa sola');
  assert(!/Totale delle sistemazioni/i.test(html), 'somma una sistemazione sola');
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

Deno.test('«Notte per notte» non copre il riquadro Prezzi di Fidra', () => {
  /* il riquadro di Fidra si apre al centro: il nostro ci finiva sopra
     proprio mentre si confrontano i due elenchi, che e' l'unico motivo
     per cui e' aperto */
  assert(
    /box\.style\.cssText = 'position:fixed;top:34px;right:16px/.test(MODALE),
    'il riquadro «Notte per notte» e tornato al centro, sopra i Prezzi di Fidra',
  );
});

Deno.test('dopo aver compilato i prezzi si ricarica la pagina', () => {
  /* IL PASSO CHE COSTAVA UN PREZZO SBAGLIATO. Senza il ricaricamento
     l'estrattore rilegge la pagina vecchia e l'offerta esce col prezzo di
     prima — e nessuno se ne accorge, perche' i numeri ci sono e sembrano
     giusti. */
  assert(/offriSalvaERicarica/.test(MODALE), 'sparito il passo del salva e ricarica');
  assert(/location\.reload\(\)/.test(MODALE), 'non ricarica piu la pagina dopo il salvataggio');
  assert(
    /Non trovo il pulsante Salva di Fidra/.test(MODALE),
    'se non trova Salva ricarica lo stesso: si butterebbe via quello che si e appena scritto',
  );
});

Deno.test('la caparra c e, con IBAN e causale fatta di nome e data', () => {
  /* la causale non e' un numero d'offerta — quello non esiste, il
     preventivo non ha una pratica dietro — ma «Bianchi Maria 23/08/2026»,
     che in banca si riconcilia altrettanto bene e si legge meglio */
  const m = modelli();
  for (const l of LINGUE) {
    const html = m.html[l](DATI(), OPZ);
    assert(/IT11C0306962321100000006041/.test(html), `manca l IBAN in ${l}`);
    assert(/Bianchi Maria 23\/08\/2026/.test(html), `la causale non e nome + data in ${l}`);
    assert(/150[.,]00/.test(html), `manca la caparra (75 x 2 adulti) in ${l}`);
  }
});

Deno.test('senza nome la causale spiega cosa scrivere, invece di uscire monca', () => {
  const m = modelli();
  const d = DATI();
  d.intestatario = '';
  const html = m.html.it(d, OPZ);
  assert(/23\/08\/2026/.test(html), 'manca la data nella causale');
  assert(/cognome/i.test(html), 'non dice all ospite di mettere il cognome');
});

Deno.test('nel preventivo non c e il pulsante di pagamento con carta', () => {
  /* quello si' che ha bisogno dell'id della pratica: senza, il link non
     esiste proprio */
  const m = modelli();
  for (const l of LINGUE) {
    const html = m.html[l](DATI(), OPZ);
    assert(!/deposit-payment/i.test(html), `c e il link di pagamento in ${l}`);
  }
});
