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

/* ============================================================
   «COSA COMPRENDE LA TARIFFA» — il pezzo che mancava.

   «L'offerta che costruisci con disponibilità e prezzi non corrisponde
   alle offerte che mandiamo via mail: manca cosa comprende la tariffa,
   gli orari delle piscine, eccetera.» Il preventivo dava un prezzo e
   basta, e un prezzo senza la merce si legge come caro.

   IL RISCHIO ADESSO E' UN ALTRO, e queste prove sorvegliano quello: che
   di quei testi ne nascano DUE. Sono in quattro lingue e sono stati
   riletti da chi in hotel ci lavora; averne due copie vuol dire
   correggere l'orario delle piscine in una e non nell'altra, e
   accorgersene quando un ospite arriva alle 19:00 e trova chiuso.
   ============================================================ */
function offerteQui(): Record<string, (d: Record<string, unknown>, o: Opzioni) => string> {
  const coda = `
    return { it: costruisciEmail, de: costruisciEmailDE,
             en: costruisciEmailEN, fr: costruisciEmailFR };`;
  return new Function(SORGENTE + coda)() as Record<
    string,
    (d: Record<string, unknown>, o: Opzioni) => string
  >;
}

/* la pratica minima che serve a far uscire un'offerta intera */
function pratica(): Record<string, unknown> {
  return {
    ok: true, id: '19999', numeroOfferta: 'O26/19999', linkPagamento: null,
    stato: 'offerta', intestatario: 'Bianchi Maria', email: 'ospite@esempio.it',
    emailAlternative: [], note: [], mancanti: [], profilo: {}, avvisi: [], extra: [],
    scadenza: '30 Aug 2026',
    anno: 2026, mese: 'Aug', giornoArrivo: 23, giornoPartenza: 26,
    mesePartenza: 'Aug', annoPartenza: 2026,
    notti: 3, nCamere: 1, adulti: 2, bambini: 0, etaBambini: [],
    camere: [{
      categoria: 'Doppia', numero: null, adulti: 2, bambini: 0, etaBambini: '',
      trattamento: 'MIGLIOR PREZZO MEZZA PENSIONE',
      totalePP: 390, totaleCamera: 780, bambiniPrezzi: [],
      periodo: { g1: 23, g2: 26, mese: 'Aug', notti: 3 },
      soggiornanti: [], checkinFatti: 0,
    }],
    totale: 780, totaleFmt: '780,00', acconto: 150, accontoFmt: '150,00',
    saldo: 630, saldoFmt: '630,00', caparraVersata: 0, caparraDovuta: null,
  };
}

const SEZIONI: Record<Lingua, { compreso: RegExp; sapere: RegExp }> = {
  it: { compreso: /Compreso nella tariffa/, sapere: /Da sapere/ },
  de: { compreso: /Im Preis enthalten/, sapere: /Gut zu wissen/ },
  en: { compreso: /Included in the rate/, sapere: /Good to know/ },
  fr: { compreso: /Compris dans le tarif/, sapere: /Bon &agrave; savoir|Bon à savoir/ },
};

Deno.test('il preventivo dice cosa comprende la tariffa, in tutte e quattro le lingue', () => {
  const m = modelli();
  for (const l of LINGUE) {
    const html = m.html[l](DATI(), OPZ);
    assert(SEZIONI[l].compreso.test(html), `manca «compreso nella tariffa» in ${l}`);
    assert(SEZIONI[l].sapere.test(html), `manca «da sapere» in ${l}`);
  }
});

Deno.test('gli orari delle piscine ci sono, ed e la cosa che chiedono di piu', () => {
  const m = modelli();
  for (const l of LINGUE) {
    const html = m.html[l](DATI(), OPZ);
    assert(/8:00|8.00 ?am|8h/.test(html), `mancano gli orari delle piscine in ${l}`);
    assert(/22:30|10.30 ?pm|22h30/.test(html), `manca l apertura serale in ${l}`);
  }
});

Deno.test('il testo e LO STESSO dell offerta, non una seconda copia', () => {
  /* si prende il blocco dall'offerta e lo si cerca, uguale, nel
     preventivo: se qualcuno ne riscrive uno dei due, qui si spacca */
  const m = modelli(), off = offerteQui();
  for (const l of LINGUE) {
    const a = off[l](pratica(), OPZ);
    const b = m.html[l](DATI(), OPZ);
    const inizio = a.search(SEZIONI[l].compreso);
    assert(inizio > 0, `non trovo il blocco nell offerta ${l}`);
    /* un pezzo ampio ma sicuro: dal titolo in avanti, dentro lo stesso
       blocco, senza arrivare a quello che dipende dai dati */
    const pezzo = a.slice(inizio, inizio + 700);
    assert(
      b.includes(pezzo),
      `il blocco «compreso» del preventivo ${l} non e piu quello dell offerta: sono diventati due testi`,
    );
  }
});

Deno.test('la cena compare anche nel preventivo, che chiama «voci» le sue camere', () => {
  /* includeCena guardava solo d.camere. Il preventivo le sue sistemazioni
     le chiama «voci»: senza guardare anche quelle, in un preventivo in
     mezza pensione la riga della cena non compariva mai — e la cena e'
     meta' del prezzo. */
  const m = modelli();
  const d = DATI();
  d.voci = [d.voci[0]];   // solo la mezza pensione
  /* NON si cerca «19:30»: quell orario compare anche negli orari delle
     piscine, e la prova passerebbe anche senza la cena */
  assert(/cena a buffet/.test(m.html.it(d, OPZ)), 'la cena non compare nel preventivo in mezza pensione');
  /* LA REGOLA E' CAMBIATA, ed e' giusto che sia cambiata. Questa prova
     pretendeva che in un preventivo di sola colazione della cena non si
     parlasse affatto: era il comportamento di allora, non una regola. Ma
     tacere costava due volte — all'ospite, che si perdeva una cosa che
     voleva, e all'albergo, che aveva il posto a tavola e non l'ha
     venduto. Adesso si dice che si puo' aggiungere, e quanto costa.
     Quello che NON deve succedere e' scritto due prove piu' giu': che la
     si offra a chi ce l'ha gia' compresa. */
  const soloBB = DATI();
  soloBB.voci = [soloBB.voci[1]];   // solo bed & breakfast
  const htmlBB = m.html.it(soloBB, OPZ);
  assert(
    !/&egrave; compresa la <strong[^>]*>cena a buffet/.test(htmlBB),
    'in un preventivo di sola colazione si dice che la cena e compresa',
  );
  assert(
    /si pu&ograve; aggiungere a <strong[^>]*>(35|25) &euro; a persona a notte/.test(htmlBB),
    'in un preventivo di sola colazione non si dice che la cena si puo aggiungere',
  );
});

Deno.test('i due titoli non si chiamano tutti e due «Da sapere»', () => {
  /* il preventivo aveva gia' un suo «Da sapere» — quello che avverte che
     i prezzi cambiano e che la camera non e' bloccata. Con l'arrivo del
     «Da sapere» dell'offerta (check-in, tassa, piscine) sarebbero
     diventati due sezioni con lo stesso nome nella stessa email. */
  const m = modelli();
  const html = m.html.it(DATI(), OPZ);
  assert(
    /Sul prezzo e sulla disponibilit/.test(html),
    'l avviso sui prezzi ha di nuovo lo stesso titolo della sezione informativa',
  );
  assertEquals(quante(html, /&gt;Da sapere&lt;|>Da sapere</), 1, 'due sezioni si chiamano «Da sapere»');
});

Deno.test('il Bistrot si legge in tutte e quattro le lingue, non solo in tedesco', () => {
  /* IL DIFETTO CHE NESSUNO AVREBBE MAI VISTO LEGGENDO UNA SOLA EMAIL.
     La riga del pranzo — «Bistrot La Piazza, tutti i giorni 10:00-23:00,
     alla carta» — c'era SOLO nell'offerta tedesca. Un ospite italiano,
     inglese o francese leggeva «Non inclusi: pranzo al Bistrot» e non
     sapeva nemmeno che il Bistrot esistesse: gli restava un divieto senza
     l'invito.

     I quattro documenti devono dire le stesse cose. Quando divergono non
     lo nota nessuno, perche' nessuno legge quattro lingue di fila. */
  const m = modelli(), off = offerteQui();
  for (const l of LINGUE) {
    for (const [dove, html] of [['offerta', off[l](pratica(), OPZ)],
                                ['preventivo', m.html[l](DATI(), OPZ)]] as const) {
      assert(
        /Bistrot La Piazza/.test(html),
        `il Bistrot non compare nell ${dove} in ${l}`,
      );
      assert(
        /12:30|12h30/.test(html),
        `mancano gli orari del pranzo nell ${dove} in ${l}`,
      );
      assert(
        /17:30|17h30/.test(html),
        `mancano gli spuntini del pomeriggio nell ${dove} in ${l}`,
      );
    }
  }
});

Deno.test('le quattro «da sapere» hanno lo stesso numero di righe', () => {
  /* la prova di sopra guarda una riga sola; questa guarda che non se ne
     perda un'altra domani, in una lingua sola, senza che nessuno se ne
     accorga */
  const off = offerteQui();
  const conta = (html: string) => {
    /* si conta DENTRO la tabella, non nei 3000 caratteri successivi:
       il primo taglio approssimato dava all italiano una riga in piu
       perche sconfinava nella sezione dopo — una prova che sbaglia a
       contare fa perdere piu tempo di quanta ne faccia risparmiare */
    const i = html.search(/Da sapere|Gut zu wissen|Good to know|Bon &agrave; savoir|Bon à savoir/);
    const fine = html.indexOf('</table>', i);
    const pezzo = html.slice(i, fine > 0 ? fine : i);
    return (pezzo.match(/color:#8C8578;">/g) || []).length;
  };
  const righe = LINGUE.map((l) => conta(off[l](pratica(), OPZ)));
  assertEquals(
    new Set(righe).size,
    1,
    `le «da sapere» hanno un numero di righe diverso per lingua: ${
      LINGUE.map((l, i) => l + '=' + righe[i]).join(' ')
    }`,
  );
});

/* ============================================================
   LA CENA PER CHI HA PRENOTATO CON LA SOLA COLAZIONE.

   Fino a oggi, quando la cena non era compresa, «A tavola» diceva
   soltanto «ricca colazione a buffet» e finiva lì: del ristorante, del
   buffet della sera e dei suoi orari non c'era traccia. L'ospite lo
   scopriva alla Reception — o non lo scopriva e andava a cena fuori.

   Il silenzio costava due volte: all'ospite, che si perdeva una cosa
   che voleva, e all'albergo, che aveva il posto a tavola e non l'ha
   venduto.

   MA UNA FRASE SBAGLIATA COSTA DI PIÙ DEL SILENZIO, e queste prove
   sorvegliano quello: che «la cena si aggiunge a 35 €» non finisca mai
   sotto gli occhi di chi la cena ce l'ha già pagata.
   ============================================================ */
function voceCon(trattamento: string): Voce {
  return {
    categoria: 'DOPPIA', trattamento, prezzoPP: 39000, totale: 78000,
    cure: 0, sconto5: 0, sconto3: 0, bambiniPrezzi: [], stima: false,
  };
}

Deno.test('in camera e colazione si dice che la cena si può aggiungere, e quanto costa', () => {
  const m = modelli();
  const d = DATI();
  d.voci = [voceCon('Miglior Prezzo Bed & Breakfast')];
  for (const l of LINGUE) {
    const html = m.html[l](d, OPZ);
    assert(/35|25/.test(html), `manca il prezzo della cena in ${l}`);
    assert(
      /19:30|7:30 pm|19 h 30/.test(html),
      `manca l orario della cena in ${l}`,
    );
    assert(
      /20:20|8:20 pm|20 h 20/.test(html),
      `manca l ultimo ingresso in ${l}`,
    );
  }
});

Deno.test('a chi ha la mezza pensione non si chiedono 35 euro per la cena', () => {
  /* LA COSA CHE NON DEVE SUCCEDERE MAI. Un ospite che ha gia' pagato la
     cena dentro la tariffa leggerebbe che deve aggiungerla: telefonerebbe
     in Reception, e avrebbe ragione lui. */
  const m = modelli();
  const d = DATI();
  d.voci = [voceCon('Miglior Prezzo Mezza Pensione')];
  for (const l of LINGUE) {
    const html = m.html[l](d, OPZ);
    assert(
      !/si pu&ograve; aggiungere|dazubuchen|can be added|peut &ecirc;tre ajout/.test(html),
      `si offre di aggiungere la cena a chi ce l ha gia compresa, in ${l}`,
    );
  }
});

Deno.test('«non lo so» torna a tacere, invece di dire «no»', () => {
  /* LA TRAPPOLA DEL CAMBIAMENTO. includeCena rispondeva false anche dove
     non sapeva, e finche' il caso negativo era il SILENZIO andava bene:
     tacere non e' mai sbagliato. Diventato una frase, quel false
     scriverebbe «la cena costa 35 €» su un documento in mezza pensione
     di cui non abbiamo letto i trattamenti. */
  const m = modelli();
  const d = DATI();
  d.voci = [{ categoria: 'DOPPIA', trattamento: '', prezzoPP: 39000, totale: 78000,
              cure: 0, sconto5: 0, sconto3: 0, bambiniPrezzi: [], stima: false }];
  const html = m.html.it(d, OPZ);
  assert(
    !/si pu&ograve; aggiungere/.test(html),
    'senza trattamenti si afferma che la cena non e compresa: non lo sappiamo',
  );
});

Deno.test('nel preventivo ad alternative si dicono tutt e due le cose', () => {
  /* una soluzione in mezza pensione e una in camera e colazione, nella
     stessa email: dire solo «nella mezza pensione la cena e' compresa»
     lascia chi sceglie il B&B a credere che la cena non ci sia proprio */
  const m = modelli();
  const d = DATI();
  d.voci = [voceCon('Miglior Prezzo Mezza Pensione'),
            voceCon('Miglior Prezzo Bed & Breakfast')];
  const html = m.html.it(d, OPZ);
  assert(/&egrave; compresa la/.test(html), 'sparita la frase della mezza pensione');
  assert(/Con la sola colazione si aggiunge a/.test(html),
    'chi sceglie il B&B non sa che la cena si puo aggiungere');
});

Deno.test('la cena aggiunta si prenota in giornata, e lo dice', () => {
  /* «Non serve prenotare in anticipo, si puo' avvisare in giornata.»
     Senza questa mezza riga l'ospite legge un prezzo e presume che vada
     organizzato prima — e magari rinuncia, o prenota altrove per la sera
     stessa. E' la differenza fra un'informazione e un invito. */
  const m = modelli();
  const d = DATI();
  d.voci = [voceCon('Miglior Prezzo Bed & Breakfast')];
  const attese: Record<Lingua, RegExp> = {
    it: /in giornata/,
    de: /am selben Tag/,
    en: /on the day/,
    fr: /le jour m&ecirc;me/,
  };
  for (const l of LINGUE) {
    assert(
      attese[l].test(m.html[l](d, OPZ)),
      `non dice che basta avvisare in giornata, in ${l}`,
    );
  }
});

/* ============================================================
   IL PREZZO DELLA CENA DIPENDE DALLE NOTTI, e la prima versione di
   questa riga non lo sapeva.

   Diceva «35 € a persona», senza «a notte» e senza scaglione. Su un
   soggiorno di tre notti — il piu' comune — avrebbe scritto a un ospite
   un prezzo piu' alto di quello vero, e per giunta scambiando il totale
   con la tariffa di una sera sola. Sul sito dell'hotel, la stessa
   tariffa che vede chi prenota da solo, e' 35 € a persona a notte per
   una o due notti e 25 € dalla terza.

   Un prezzo sbagliato in un preventivo non e' un difetto: e' una
   promessa scritta, e la si scopre quando l'ospite arriva col
   preventivo in mano.
   ============================================================ */
function cena(html: string): string {
  const i = html.indexOf('si pu&ograve; aggiungere a');
  const j = html.indexOf('si aggiunge a');
  const k = i >= 0 ? i : j;
  return k >= 0 ? html.slice(k, k + 260) : '';
}

Deno.test('fino a due notti la cena costa 35 euro a persona a notte', () => {
  const m = modelli();
  for (const notti of [1, 2]) {
    const d = DATI();
    d.notti = notti;
    d.voci = [voceCon('Miglior Prezzo Bed & Breakfast')];
    const t = cena(m.html.it(d, OPZ));
    assert(/35 &euro; a persona a notte/.test(t), `con ${notti} notti non dice 35 € a persona a notte: «${t.slice(0, 90)}»`);
    assert(!/25 &euro;/.test(t), `con ${notti} notti compare anche la tariffa lunga`);
  }
});

Deno.test('dalla terza notte la cena costa 25 euro a persona a notte', () => {
  /* IL CONFINE E' QUI: due notti 35, tre notti 25. Se lo scaglione
     scivola di uno, l'errore vale 10 € a testa a sera e non se ne
     accorge nessuno finche' non arriva il conto. */
  const m = modelli();
  for (const notti of [3, 4, 7, 14]) {
    const d = DATI();
    d.notti = notti;
    d.voci = [voceCon('Miglior Prezzo Bed & Breakfast')];
    const t = cena(m.html.it(d, OPZ));
    assert(/25 &euro; a persona a notte/.test(t), `con ${notti} notti non dice 25 € a persona a notte`);
    assert(!/35 &euro;/.test(t), `con ${notti} notti compare ancora la tariffa breve`);
  }
});

Deno.test('«a notte» non si perde: non e il totale del soggiorno', () => {
  /* la prima versione diceva «35 € a persona» e basta. Un ospite di tre
     notti l'avrebbe letto come il prezzo di tutto il soggiorno. */
  const m = modelli();
  const d = DATI();
  d.voci = [voceCon('Miglior Prezzo Bed & Breakfast')];
  const attese: Record<Lingua, RegExp> = {
    it: /a persona a notte/,
    de: /pro Person und Nacht/,
    en: /per person per night/,
    fr: /par personne et par nuit/,
  };
  for (const l of LINGUE) {
    assert(attese[l].test(m.html[l](d, OPZ)), `manca «a notte» in ${l}: si legge come il totale`);
  }
});

Deno.test('le bevande sono escluse, e si dice', () => {
  const m = modelli();
  const d = DATI();
  d.voci = [voceCon('Miglior Prezzo Bed & Breakfast')];
  const attese: Record<Lingua, RegExp> = {
    it: /bevande escluse/,
    de: /Getr&auml;nke nicht inbegriffen/,
    en: /drinks not included/,
    fr: /boissons non comprises/,
  };
  for (const l of LINGUE) {
    assert(attese[l].test(m.html[l](d, OPZ)), `non dice che le bevande sono escluse, in ${l}`);
  }
});

Deno.test('senza le notti si dicono tutt e due le tariffe, invece di sceglierne una', () => {
  /* scegliere a caso vorrebbe dire sbagliare la meta' delle volte. Dire
     tutt'e due e' sempre vero, e costa mezza riga. */
  const m = modelli();
  const d = DATI();
  d.notti = 0;
  d.voci = [voceCon('Miglior Prezzo Bed & Breakfast')];
  const t = cena(m.html.it(d, OPZ));
  assert(/35 &euro; a persona a notte/.test(t), 'senza le notti sparisce la tariffa breve');
  assert(/25 &euro;/.test(t) && /terza notte/.test(t), 'senza le notti sparisce lo scaglione lungo');
});

Deno.test('il totale della cena e quello del sito, e conta solo gli adulti', () => {
  /* IL CONTO DA CUI SI PARTE. Sul sito dell'hotel, due adulti per tre
     notti leggono «25,00 € a persona a notte · +150,00 € in tutto». Se
     il preventivo dicesse un numero diverso, l'ospite avrebbe due
     prezzi nostri sotto gli occhi e non saprebbe a quale credere.

     E SI CONTANO SOLO GLI ADULTI: nella tariffa dei bambini la cena e'
     gia' compresa, quindi contarli qui vorrebbe dire chiedere due volte
     la stessa cena — e stavolta l'errore sarebbe contro l'ospite. */
  const m = modelli();
  const d = DATI();
  d.notti = 3;
  d.adulti = 2;
  d.bambini = 0;
  d.voci = [voceCon('Miglior Prezzo Bed & Breakfast')];
  assert(/150 &euro; in tutto/.test(m.html.it(d, OPZ)), 'il totale non e 150 €, come sul sito');

  /* con un bambino in piu' il totale NON cambia */
  const conBimbo = DATI();
  conBimbo.notti = 3;
  conBimbo.adulti = 2;
  conBimbo.bambini = 1;
  conBimbo.voci = [voceCon('Miglior Prezzo Bed & Breakfast')];
  const html = m.html.it(conBimbo, OPZ);
  assert(/150 &euro; in tutto/.test(html), 'il bambino finisce nel conto della cena: la pagherebbe due volte');
  assert(
    /per i bambini &egrave; gi&agrave; compresa/.test(html),
    'non si dice che nei bambini la cena e gia compresa: se lo chiederebbero',
  );
});

Deno.test('dei bambini non si parla quando non ce ne sono', () => {
  const m = modelli();
  const d = DATI();
  d.bambini = 0;
  d.voci = [voceCon('Miglior Prezzo Bed & Breakfast')];
  assert(
    !/per i bambini/.test(m.html.it(d, OPZ)),
    'si parla di bambini a chi viaggia senza: una riga in piu da leggere per niente',
  );
});

Deno.test('senza gli adulti il totale non si inventa', () => {
  /* meglio la sola tariffa, che e' sempre vera, di un conto sbagliato */
  const m = modelli();
  const d = DATI();
  d.adulti = 0;
  d.voci = [voceCon('Miglior Prezzo Bed & Breakfast')];
  const t = m.html.it(d, OPZ);
  assert(/25 &euro; a persona a notte/.test(t), 'sparita anche la tariffa');
  assert(!/in tutto/.test(t), 'senza sapere quanti sono si scrive lo stesso un totale');
});

Deno.test('il tedesco non lascia il verbo per strada', () => {
  /* «laesst sich fuer … dazubuchen» tiene il verbo in fondo. Diventato il
     prezzo tre pezzi — tariffa, totale, bambini — quel «dazubuchen»
     finiva dopo il punto e virgola: tedesco rotto, e in reception non se
     ne sarebbe accorto nessuno. */
  const m = modelli();
  const d = DATI();
  d.notti = 3;
  d.adulti = 2;
  d.bambini = 1;
  d.voci = [voceCon('Miglior Prezzo Bed & Breakfast')];
  const html = m.html.de(d, OPZ);
  assert(/kann dazugebucht werden: /.test(html), 'il verbo tedesco e tornato in fondo alla frase');
  assert(!/enthalten dazubuchen/.test(html), 'il verbo e finito dopo la frase sui bambini');
});

/* ============================================================
   IL PANNELLO COMPILA I FILTRI DALLA RICHIESTA E CERCA DA SOLO (v2.25).
   Date e persone le ribatteva l'operatore. Prove sul sorgente: il pannello
   vive dentro Fidra e fuori dal browser non si esegue.
   ============================================================ */
Deno.test('il pannello compila arrivo, partenza, adulti e bambini dalla richiesta, solo senza prenotazione aperta', () => {
  const f = MODALE.match(/async function compilaDaRichiesta\(\) \{([\s\S]*?)\n    \}/);
  assert(f, 'compilaDaRichiesta() non si trova per intero');
  for (const campo of ['dArrivo', 'dPartenza', 'dAdulti', 'dBambini']) {
    assert(f![1].includes("$('" + campo + "').value = "), `non scrive ${campo}`);
  }
  assert(/60 \* 60 \* 1000/.test(f![1]), 'una richiesta vecchia verrebbe usata lo stesso');
  assert(/Compilato dalla richiesta/.test(f![1]), 'non dice che i filtri vengono dalla richiesta');
  assert(/persone non lette/.test(f![1]), 'con gli adulti non letti non lo dice');
  assert(/notti dedotte/.test(f![1]), 'con le notti dedotte non lo dice');
  assert(/!pren && await compilaDaRichiesta\(\)/.test(MODALE), 'compila anche con una prenotazione aperta, che invece comanda');
});

Deno.test('la prima ricerca parte una volta sola, dopo aver compilato', () => {
  assert(/const compilato = !pren && await compilaDaRichiesta\(\);\s*esegui\(\);/.test(MODALE),
    'la ricerca parte prima dei filtri compilati, o due volte');
  assert(!/addEventListener\('click', esegui\);\s*esegui\(\);/.test(MODALE), 'la ricerca parte ancora sui filtri di default, prima di compilarli');
});

/* ============================================================
   LE PROPOSTE: la categoria chiesta piu' un'alternativa (v2.25).
   La regola sta in una funzione pura, estratta ed ESEGUITA qui.
   ============================================================ */
type Riga = { categoria: string; trattamento: string; totale: number; libere: number; maxAdulti: number | null; stima?: boolean };
const proposteDaRichiesta = (() => {
  const m = MODALE.match(/\n  function proposteDaRichiesta\([^)]*\) \{[\s\S]*?\n  \}/);
  if (!m) return null;
  return new Function(m[0] + '\nreturn proposteDaRichiesta;')() as
    (righe: Riga[], richiesta: Record<string, unknown>) => { categoria: string; trattamento: string }[];
})();
const RIGHE_PROVA: Riga[] = [
  { categoria: 'Doppia', trattamento: 'Miglior Prezzo Bed & Breakfast', totale: 50000, libere: 3, maxAdulti: 2 },
  { categoria: 'Doppia', trattamento: 'Miglior Prezzo Mezza Pensione', totale: 70000, libere: 3, maxAdulti: 2 },
  { categoria: 'Doppia Superior', trattamento: 'Miglior Prezzo Bed & Breakfast', totale: 60000, libere: 2, maxAdulti: 2 },
  { categoria: 'Doppia Superior', trattamento: 'Miglior Prezzo Mezza Pensione', totale: 80000, libere: 2, maxAdulti: 2 },
  { categoria: 'Junior Suite', trattamento: 'Miglior Prezzo Mezza Pensione', totale: 100000, libere: 1, maxAdulti: 3 },
  { categoria: 'Suite', trattamento: 'Miglior Prezzo Mezza Pensione', totale: 140000, libere: 1, maxAdulti: 4 },
  { categoria: 'Singola Parco', trattamento: 'Miglior Prezzo Mezza Pensione', totale: 45000, libere: 1, maxAdulti: 1 },
];
const nomiProposte = (p: { categoria: string; trattamento: string }[]) => p.map((x) => x.categoria + ' · ' + x.trattamento);
const proponiProva = (righe: Riga[], richiesta: Record<string, unknown>) => {
  assert(proposteDaRichiesta, 'proposteDaRichiesta() non si trova per intero nel pannello');
  return proposteDaRichiesta!(righe, richiesta);
};

Deno.test('proposte: la categoria chiesta col trattamento chiesto, piu quella subito piu cara', () => {
  assertEquals(nomiProposte(proponiProva(RIGHE_PROVA, { categoriaChiesta: 'superior', trattamento: 'Mezza Pensione', adulti: 2 })),
    ['Doppia Superior · Miglior Prezzo Mezza Pensione', 'Junior Suite · Miglior Prezzo Mezza Pensione']);
});

Deno.test('proposte: se la chiesta e la piu cara, l alternativa e quella subito sotto', () => {
  assertEquals(nomiProposte(proponiProva(RIGHE_PROVA, { categoriaChiesta: 'suite', trattamento: 'Mezza Pensione', adulti: 2 })),
    ['Suite · Miglior Prezzo Mezza Pensione', 'Junior Suite · Miglior Prezzo Mezza Pensione']);
});

Deno.test('proposte: senza categoria chiesta, le due meno care che tengono le persone', () => {
  assertEquals(nomiProposte(proponiProva(RIGHE_PROVA, { trattamento: 'Mezza Pensione', adulti: 2 })),
    ['Doppia · Miglior Prezzo Mezza Pensione', 'Doppia Superior · Miglior Prezzo Mezza Pensione']);
  assertEquals(nomiProposte(proponiProva(RIGHE_PROVA, { trattamento: 'Mezza Pensione', adulti: 2, bambini: 1 })),
    ['Junior Suite · Miglior Prezzo Mezza Pensione', 'Suite · Miglior Prezzo Mezza Pensione']);
});

Deno.test('proposte: trattamento non offerto per quella categoria, prima tariffa; categoria chiesta non libera, regola delle due meno care', () => {
  assertEquals(nomiProposte(proponiProva(RIGHE_PROVA, { categoriaChiesta: 'junior', trattamento: 'Bed & Breakfast', adulti: 2 })),
    ['Junior Suite · Miglior Prezzo Mezza Pensione', 'Suite · Miglior Prezzo Mezza Pensione']);
  assertEquals(nomiProposte(proponiProva(RIGHE_PROVA, { categoriaChiesta: 'queen', trattamento: 'Mezza Pensione', adulti: 2 })),
    ['Doppia · Miglior Prezzo Mezza Pensione', 'Doppia Superior · Miglior Prezzo Mezza Pensione']);
});

Deno.test('proposte: le stime non si propongono mai, e una categoria sola da una proposta sola', () => {
  const conStima = RIGHE_PROVA.map((r) => r.categoria === 'Junior Suite' ? { ...r, stima: true } : r);
  assertEquals(nomiProposte(proponiProva(conStima, { categoriaChiesta: 'superior', trattamento: 'Mezza Pensione', adulti: 2 })),
    ['Doppia Superior · Miglior Prezzo Mezza Pensione', 'Suite · Miglior Prezzo Mezza Pensione']);
  assertEquals(nomiProposte(proponiProva(RIGHE_PROVA.filter((r) => r.categoria === 'Doppia'), { trattamento: 'Mezza Pensione', adulti: 2 })),
    ['Doppia · Miglior Prezzo Mezza Pensione']);
  assertEquals(proponiProva([], { adulti: 2 }), []);
});

Deno.test('le proposte entrano dai pulsanti «+ Prev.», la barra lo dice, e niente parte da solo', () => {
  assert(/function togliOMetti\(b\)/.test(MODALE), 'la logica di «+ Prev.» non e una funzione riusabile');
  assert(/RIGHE\.push\(\{ categoria: nome, trattamento: rv\.full_name \|\| rv\.name, totale: c\.totale/.test(MODALE), 'le righe non si raccolgono per le proposte');
  assert(/if \(RICHIESTA_LETTA && !SCELTE\.length\) proponi\(RIGHE\)/.test(MODALE), 'le proposte non partono dopo i risultati, o partono sopra una scelta gia fatta');
  assert(/proposte dalla richiesta/.test(MODALE), 'la barra non dice che le sistemazioni sono proposte');
  assert(!/creaPreventivo\(\);?\s*\}\)\(\)/.test(MODALE), 'il preventivo parte da solo');
});
