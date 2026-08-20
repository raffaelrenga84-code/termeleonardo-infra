/* ============================================================
   navetta.test.ts — quando offrire la navetta condivisa, e cosa dirle.

   IL DIFETTO CHE PRESIDIA. Il listino dell'hotel:

       navetta condivisa   65 € (1)   95 € (2)   135 € (3)   — (4)
       taxi privato       135 €      135 €      135 €      135 €

   A TRE PASSEGGERI LA NAVETTA COSTA COME IL PRIVATO. Scrivere «costa meno»
   accanto a quel pulsante e' una bugia che costa all'ospite la comodita' di
   un'auto sua in cambio di zero euro. A quattro la navetta non e' nemmeno in
   listino, e il privato li porta tutti allo stesso prezzo.

   E vale solo per Venezia aeroporto: sulle altre undici destinazioni del
   modulo la condivisa non la vendiamo.

   Modulo puro: dati dentro, una risposta fuori. `adesso` si passa da fuori
   proprio perche' una prova non deve dipendere da che ora e'.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';
import { corsaDiRitorno, navetta, ritiroPerVolo } from './navetta.js';

/* il valore della meta e' quello VERO del modulo, con i DUE spazi: deve
   combaciare parola per parola con l'elenco di atam.biz */
const AEROPORTO = 'Venezia  aeroporto';

const ADESSO = new Date('2026-08-18T10:00:00');
const FRA_TRE_GIORNI = '2026-08-21';

const corsa = (extra: Record<string, unknown> = {}) => ({
  luogo: AEROPORTO, pax: 2, quando: FRA_TRE_GIORNI, ora: '15:30', ...extra,
});

/* ---------- quanti passeggeri ---------- */

Deno.test('a una e a due persone la navetta si offre, e costa davvero meno', () => {
  for (const pax of [1, 2]) {
    const n = navetta(corsa({ pax }), ADESSO);
    assert(n, `a ${pax} passeggeri la navetta doveva comparire`);
    assertEquals(n.nota, 'costaMeno', `a ${pax} passeggeri`);
  }
});

/* IL DIFETTO CENTRALE: a tre il prezzo coincide, 135 € e 135 €. Il pulsante
   resta — non si nasconde un'opzione a chi ha diritto di vederla — ma la
   frase deve dire il vero. */
Deno.test('a tre persone la navetta si offre, ma NON dice che costa meno', () => {
  const n = navetta(corsa({ pax: 3 }), ADESSO);
  assert(n, 'a tre persone la navetta doveva comparire lo stesso');
  assertEquals(n.nota, 'stessoPrezzo');
});

Deno.test('a quattro persone la navetta non compare: in listino non c e', () => {
  assertEquals(navetta(corsa({ pax: 4 }), ADESSO), null);
  assertEquals(navetta(corsa({ pax: 8 }), ADESSO), null);
});

/* ---------- dove ---------- */

Deno.test('sulle altre destinazioni la navetta non si vende', () => {
  for (
    const luogo of [
      'Treviso Aeroporto', 'Verona Aeroporto✈️', 'Bologna Aeroporto',
      'Venezia P.le Roma', 'Venezia porto', 'Padova FS', 'Terme  Euganee FS',
      'Mestre fs', 'Golf Valsanzibio 🏌', 'Golf Montecchia🏌',
      'Golf Frassanelle 🏌', 'Abano', 'Padova città',
    ]
  ) {
    assertEquals(navetta(corsa({ luogo }), ADESSO), null, `su ${luogo}`);
  }
});

/* IL TRABOCCHETTO SILENZIOSO. Il valore della meta ha DUE spazi perche' deve
   combaciare con l'elenco di atam.biz. Una regola scritta con uno spazio solo
   non scatterebbe mai, e nessuno saprebbe perche': la navetta semplicemente
   non comparirebbe. Si confrontano normalizzati, come fa atam-booking.js. */
Deno.test('l aeroporto combacia con due spazi e anche con uno solo', () => {
  for (const luogo of ['Venezia  aeroporto', 'Venezia aeroporto', 'VENEZIA  AEROPORTO', ' Venezia  aeroporto ']) {
    assert(navetta(corsa({ luogo }), ADESSO), `doveva combaciare: "${luogo}"`);
  }
});

/* ---------- quanto preavviso ---------- */

Deno.test('sotto le 24 ore la navetta non compare: il listino le chiede', () => {
  /* stasera alle 18: mancano 8 ore */
  assertEquals(navetta(corsa({ quando: '2026-08-18', ora: '18:00' }), ADESSO), null);
  /* domani alle 9: mancano 23 ore, ancora poche */
  assertEquals(navetta(corsa({ quando: '2026-08-19', ora: '09:00' }), ADESSO), null);
});

Deno.test('da 24 ore in su la navetta compare', () => {
  /* domani alle 11: 25 ore */
  assert(navetta(corsa({ quando: '2026-08-19', ora: '11:00' }), ADESSO));
});

/* Senza l'ora non si sa ancora a che ora parte: si giudica sull'inizio del
   giorno, il momento piu' presto possibile. Cosi' la navetta compare solo
   quando e' certo che ci sia, e non sparisce piu' quando l'ospite sceglie
   l'ora — un'opzione che si ritira e' peggio di una che arriva tardi. */
Deno.test('senza l ora si giudica sul momento piu presto del giorno', () => {
  assertEquals(navetta(corsa({ quando: '2026-08-19', ora: '' }), ADESSO), null);
  assert(navetta(corsa({ quando: FRA_TRE_GIORNI, ora: '' }), ADESSO));
});

/* ---------- dati mancanti ---------- */

Deno.test('senza giorno o senza luogo non si offre niente', () => {
  assertEquals(navetta(corsa({ quando: '' }), ADESSO), null);
  assertEquals(navetta(corsa({ luogo: '' }), ADESSO), null);
  assertEquals(navetta(null, ADESSO), null);
});

/* Il modulo parte con «2» gia' scritto nel campo, ma un ospite puo' svuotarlo.
   Un pax vuoto non deve far sparire la navetta come se fossero in quattro. */
Deno.test('un numero di passeggeri vuoto vale come uno', () => {
  const n = navetta(corsa({ pax: '' }), ADESSO);
  assert(n, 'con il campo vuoto la navetta doveva comparire');
  assertEquals(n.nota, 'costaMeno');
});

/* ============================================================
   LE TRE ORE PRIMA DEL VOLO.

   Il servizio collettivo dall'hotel all'aeroporto parte TRE ORE prima
   dell'ora del volo: e' la navetta che raccoglie piu' ospiti e fa fermate,
   non un taxi che va dritto.

   IL DIFETTO CHE PRESIDIA. Il modulo, per le partenze, chiede «l'ora a cui
   vuole essere preso in hotel». Ma un ospite conosce l'ORA DEL VOLO, non
   quella del ritiro: il conto delle tre ore lo dovrebbe fare lui, e se
   sbaglia perde l'aereo. Lo facciamo noi.
   ============================================================ */
Deno.test('il ritiro e tre ore prima del volo', () => {
  assertEquals(ritiroPerVolo('14:30'), { ora: '11:30', giornoPrima: false });
  assertEquals(ritiroPerVolo('09:05'), { ora: '06:05', giornoPrima: false });
  assertEquals(ritiroPerVolo('23:59'), { ora: '20:59', giornoPrima: false });
});

/* IL CASO CATTIVO: un volo notturno fa scattare il ritiro al GIORNO PRIMA.
   Senza dirlo, l'ospite legge «22:00» e aspetta la sera sbagliata. */
Deno.test('un volo di notte porta il ritiro al giorno prima', () => {
  assertEquals(ritiroPerVolo('01:00'), { ora: '22:00', giornoPrima: true });
  assertEquals(ritiroPerVolo('02:59'), { ora: '23:59', giornoPrima: true });
  /* le 03:00 in punto sono il confine: ritiro a mezzanotte, stesso giorno */
  assertEquals(ritiroPerVolo('03:00'), { ora: '00:00', giornoPrima: false });
});

Deno.test('un orario che non e un orario non produce un ritiro', () => {
  for (const v of ['', 'mattina', '25:00', '12:60', null, undefined]) {
    assertEquals(ritiroPerVolo(v as string), null, `doveva essere null: ${v}`);
  }
});

/* ============================================================
   LA FASCIA ORARIA: la navetta va dalle 8:00 alle 20:00.

   Confermato dalla proprieta' il 18 agosto 2026. La fascia vale sulla
   CORSA, non sul volo — e siccome per le partenze la corsa parte tre ore
   prima, di fatto restano i voli fra le 11:00 e le 23:00.

   IL DIFETTO CHE PRESIDIA. Senza questa regola il modulo offrirebbe la
   navetta a chi ha un volo alle 6 del mattino, che vorrebbe dire un ritiro
   alle 3 di notte: un impegno che il servizio non puo' mantenere, preso in
   automatico e scoperto solo dalla reception, a richiesta gia' inviata.
   ============================================================ */
const inFascia = (extra: Record<string, unknown>) => navetta(corsa(extra), ADESSO);

Deno.test('in arrivo la navetta va dalle 9 alle 18, estremi compresi', () => {
  assert(inFascia({ verso: 'arrivo', ora: '09:00' }), 'le 9:00 in punto sono dentro');
  assert(inFascia({ verso: 'arrivo', ora: '18:00' }), 'le 18:00 in punto sono dentro');
  assert(inFascia({ verso: 'arrivo', ora: '13:00' }));
});

Deno.test('fuori fascia in arrivo la navetta non si offre', () => {
  assertEquals(inFascia({ verso: 'arrivo', ora: '08:59' }), null);
  assertEquals(inFascia({ verso: 'arrivo', ora: '18:01' }), null);
  assertEquals(inFascia({ verso: 'arrivo', ora: '23:30' }), null);
  assertEquals(inFascia({ verso: 'arrivo', ora: '05:00' }), null);
});

/* In PARTENZA il campo dell'ora contiene l'ora del VOLO: la corsa parte tre
   ore prima, ed e' quella che deve stare in fascia. */
Deno.test('in partenza la fascia si misura sulla corsa, non sul volo', () => {
  /* volo alle 14:30 → ritiro alle 11:30: dentro */
  assert(inFascia({ verso: 'partenza', ora: '14:30' }));
  /* volo alle 11:00 → ritiro alle 8:00 in punto: dentro */
  assert(inFascia({ verso: 'partenza', ora: '11:00' }));
  /* volo alle 20:00 → ritiro alle 17:00 in punto: dentro, e' l'ultimo */
  assert(inFascia({ verso: 'partenza', ora: '20:00' }));
  /* e mezz'ora dopo no: il ritiro sarebbe alle 17:30, il servizio ha chiuso */
  assertEquals(inFascia({ verso: 'partenza', ora: '20:30' }), null);
});

Deno.test('un volo troppo presto o troppo tardi resta senza navetta', () => {
  /* volo alle 10:00 → ritiro alle 7:00: il servizio non e' ancora partito */
  assertEquals(inFascia({ verso: 'partenza', ora: '10:00' }), null);
  /* volo alle 6:00 → ritiro alle 3 di notte */
  assertEquals(inFascia({ verso: 'partenza', ora: '06:00' }), null);
  /* volo alle 23:30 → ritiro alle 20:30: il servizio ha gia' chiuso */
  assertEquals(inFascia({ verso: 'partenza', ora: '23:30' }), null);
});

/* Il volo di notte: ritiro alle 22:00 del giorno prima, fuori fascia due
   volte. Prima di questa regola la navetta gli sarebbe stata offerta. */
Deno.test('un volo di notte non ha navetta, e nemmeno il giorno prima', () => {
  assertEquals(inFascia({ verso: 'partenza', ora: '01:00' }), null);
  assertEquals(inFascia({ verso: 'partenza', ora: '02:30' }), null);
});

/* ============================================================
   IL RITORNO E' UNA SECONDA CORSA, NEL VERSO OPPOSTO.

   IL DIFETTO CHE PRESIDIA. Chi sceglie la navetta per l'andata da' per
   scontato che valga anche al ritorno. Ma il ritorno e' un'altra corsa, a
   un'altra ora, e spesso nel verso opposto: chi arriva dall'aeroporto alle
   14 torna in aeroporto, e se torna alle 22 la navetta non e' in servizio.

   Il modulo deve dirlo PRIMA, non lasciarlo scoprire alla reception.
   ============================================================ */
Deno.test('il ritorno di un arrivo e una partenza, e viceversa', () => {
  assertEquals(corsaDiRitorno({ verso: 'arrivo', luogo: AEROPORTO, pax: 2, ritorno_quando: '2026-08-21', ritorno_ora: '10:00' })?.verso, 'partenza');
  assertEquals(corsaDiRitorno({ verso: 'partenza', luogo: AEROPORTO, pax: 2, ritorno_quando: '2026-08-21', ritorno_ora: '10:00' })?.verso, 'arrivo');
});

Deno.test('il ritorno tiene luogo e passeggeri dell andata', () => {
  const r = corsaDiRitorno({ verso: 'arrivo', luogo: AEROPORTO, pax: 3, ritorno_quando: '2026-08-21', ritorno_ora: '10:00' });
  assertEquals(r?.luogo, AEROPORTO);
  assertEquals(r?.pax, 3);
  assertEquals(r?.quando, '2026-08-21');
  assertEquals(r?.ora, '10:00');
});

/* IL CASO DELLA SCHERMATA: ritorno alle 22:00. Il ritorno di un arrivo e'
   una partenza, quindi le 22:00 sono l'ora del volo e il ritiro cadrebbe
   alle 19:00.

   Con la fascia unica 8-20 ci stava, e questa prova lo pretendeva. Con le
   due fasce vere non ci sta piu': in partenza il servizio chiude alle
   17:00. Il caso resta interessante — e' quello che aveva fatto scrivere
   la prova — ma l'esito si ribalta, e la ragione va scritta o il prossimo
   che la legge pensera' a una regressione. */
Deno.test('un ritorno alle 22 non ha navetta: il ritiro sarebbe alle 19', () => {
  const r = corsaDiRitorno({ verso: 'arrivo', luogo: AEROPORTO, pax: 2, ritorno_quando: FRA_TRE_GIORNI, ritorno_ora: '22:00' });
  assert(r, 'la corsa di ritorno non e stata costruita');
  assertEquals(navetta(r!, ADESSO), null, 'ritiro alle 19:00: il servizio ha chiuso alle 17:00');
});

/* E il ritorno che invece ci sta: volo alle 19:00, ritiro alle 16:00. */
Deno.test('un ritorno alle 19 ha la navetta: il ritiro e alle 16', () => {
  const r = corsaDiRitorno({ verso: 'arrivo', luogo: AEROPORTO, pax: 2, ritorno_quando: FRA_TRE_GIORNI, ritorno_ora: '19:00' });
  assert(r && navetta(r, ADESSO), 'volo alle 19, ritiro alle 16: doveva starci');
});

Deno.test('un ritorno che riporta in hotel alle 22 non ha navetta', () => {
  const r = corsaDiRitorno({ verso: 'partenza', luogo: AEROPORTO, pax: 2, ritorno_quando: FRA_TRE_GIORNI, ritorno_ora: '22:00' });
  assertEquals(r && navetta(r, ADESSO), null);
});

Deno.test('senza giorno del ritorno non c e nessuna corsa di ritorno', () => {
  assertEquals(corsaDiRitorno({ verso: 'arrivo', luogo: AEROPORTO, pax: 2 }), null);
});


/* ============================================================
   DUE FASCE, NON UNA — confermato dalla proprieta' il 20 agosto 2026.

       partenze   dalle 8:00 alle 17:00
       arrivi     dalle 9:00 alle 18:00

   Prima ce n'era una sola, 8:00-20:00, e valeva per tutti e due i versi.
   Era piu' larga del servizio vero in partenza (di tre ore) e piu' larga di
   un'ora in arrivo: il modulo offriva corse che i tassisti non fanno, e
   l'ospite se lo sentiva dire dalla reception a richiesta gia' mandata.

   E l'agente vocale diceva la cosa giusta mentre il sito ne diceva
   un'altra: e' cosi' che la divergenza e' saltata fuori.

   LA FASCIA VALE SULLA CORSA, non su quello che l'ospite scrive. In
   partenza il campo contiene l'ora del VOLO e la corsa parte tre ore prima,
   quindi restano i voli fra le 11:00 e le 20:00.
   ============================================================ */

Deno.test('in partenza la corsa delle 17 si offre, quella delle 17:30 no', () => {
  /* il campo porta l'ora del volo: la corsa e' tre ore prima */
  const alle17 = navetta(corsa({ verso: 'partenza', ora: '20:00' }), ADESSO);
  const alle1730 = navetta(corsa({ verso: 'partenza', ora: '20:30' }), ADESSO);
  assert(alle17, 'la corsa delle 17:00 e stata negata');
  assertEquals(alle1730, null, 'la corsa delle 17:30 e stata offerta');
});

Deno.test('in partenza la corsa delle 8 si offre, quella delle 7:30 no', () => {
  assert(navetta(corsa({ verso: 'partenza', ora: '11:00' }), ADESSO), 'le 8:00 negate');
  assertEquals(navetta(corsa({ verso: 'partenza', ora: '10:30' }), ADESSO), null,
    'le 7:30 offerte');
});

Deno.test('in arrivo la fascia e piu tarda: fino alle 18, non alle 17', () => {
  assert(navetta(corsa({ verso: 'arrivo', ora: '18:00' }), ADESSO), 'le 18:00 negate');
  assertEquals(navetta(corsa({ verso: 'arrivo', ora: '18:30' }), ADESSO), null,
    'le 18:30 offerte');
});

Deno.test('in arrivo comincia piu tardi: le 9, non le 8', () => {
  assert(navetta(corsa({ verso: 'arrivo', ora: '09:00' }), ADESSO), 'le 9:00 negate');
  assertEquals(navetta(corsa({ verso: 'arrivo', ora: '08:30' }), ADESSO), null,
    'le 8:30 offerte');
});

/* La prova che distingue le due fasce da una sola: c'e' un'ora che va bene
   in un verso e non nell'altro, in tutti e due i sensi. Con una fascia
   unica questa non potrebbe passare. */
Deno.test('la stessa ora vale in un verso e non nell altro', () => {
  /* le 8:30: buone in partenza (dentro 8-17), fuori in arrivo (comincia alle 9) */
  assert(navetta(corsa({ verso: 'partenza', ora: '11:30' }), ADESSO),
    'corsa delle 8:30 in partenza: dovrebbe andare');
  assertEquals(navetta(corsa({ verso: 'arrivo', ora: '08:30' }), ADESSO), null,
    'corsa delle 8:30 in arrivo: non dovrebbe andare');

  /* le 17:30: fuori in partenza (finisce alle 17), buone in arrivo (fino alle 18) */
  assertEquals(navetta(corsa({ verso: 'partenza', ora: '20:30' }), ADESSO), null,
    'corsa delle 17:30 in partenza: non dovrebbe andare');
  assert(navetta(corsa({ verso: 'arrivo', ora: '17:30' }), ADESSO),
    'corsa delle 17:30 in arrivo: dovrebbe andare');
});
