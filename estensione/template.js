/* ============================================================
   Offerta Leonardo — costruzione dell'email HTML
   ============================================================ */

const MESI_IT = ['gennaio','febbraio','marzo','aprile','maggio','giugno',
                 'luglio','agosto','settembre','ottobre','novembre','dicembre'];
const MESI_N  = { Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11 };

const IBAN     = 'IT11C0306962321100000006041';
const BIC      = 'BCITITMM';
const BANCA    = 'Intesa Sanpaolo';
const INTESTAT = 'Tria S.r.l. – Hotel Leonardo Terme';


/* ============================================================
   PACCHETTI SPECIALI — didascalia sotto il trattamento
   ------------------------------------------------------------
   Chiave = testo cercato (minuscolo) dentro il nome trattamento di Fidra.
   "descr": cosa comprende, per lingua. Lasciare '' finché la composizione
   ufficiale non è confermata: la riga non viene stampata.
   "prezzoSpeciale": true stampa l'avvertenza bonifico/contanti.
   ============================================================ */
const PACCHETTO_SOMMER = {
  it: 'Mezza pensione con cucina regionale &middot; pacchetto salute con visita medica, 5 fanghi naturali, 5 bagni termali all&rsquo;ozono, 5 massaggi di reazione e 5 inalazioni o aerosol &middot; vini da tavola inclusi a cena &middot; programma settimanale con aperitivo di benvenuto con il padrone di casa, visita a una villa storica con degustazione di vini e Gala-Dinner con pianoforte &middot; serate alle terme fino alle 22:30 il venerd&igrave; e il sabato &middot; accappatoio fango e telo in prestito. A fine soggiorno riceve la fattura separata delle cure.',
  de: 'Halbpension mit regionaler K&uuml;che &middot; Gesundheitspaket mit &auml;rztlicher Untersuchung, 5 Naturfangopackungen, 5 Ozon-Thermalb&auml;dern, 5 Reaktionsmassagen und 5 Inhalationen oder Aerosol &middot; ausgew&auml;hlte Tischweine zum Abendessen inklusive &middot; Wochenprogramm mit Begr&uuml;&szlig;ungsaperitif mit dem Gastgeber, Villa-Besichtigung mit Weinverkostung und Gala-Dinner mit Klaviermusik &middot; lange Thermalabende bis 22:30 Uhr freitags und samstags &middot; Fangobademantel und Badetuch leihweise. Am Ende des Aufenthalts erhalten Sie eine separate Rechnung &uuml;ber die Heilanwendungen.',
  en: 'Half board with regional cuisine &middot; health package with medical examination, 5 natural mud packs, 5 ozone thermal baths, 5 reaction massages and 5 inhalations or aerosol &middot; selected table wines included at dinner &middot; weekly programme with welcome aperitif with your host, historic villa visit with wine tasting and gala dinner with piano music &middot; long spa evenings until 10:30 pm on Fridays and Saturdays &middot; mud bathrobe and towel on loan. A separate invoice for the treatments is issued at the end of your stay.',
  fr: 'Demi-pension avec cuisine r&eacute;gionale &middot; forfait sant&eacute; avec visite m&eacute;dicale, 5 applications de fango naturel, 5 bains thermaux &agrave; l&rsquo;ozone, 5 massages de r&eacute;action et 5 inhalations ou a&eacute;rosols &middot; vins de table inclus au d&icirc;ner &middot; programme hebdomadaire avec ap&eacute;ritif de bienvenue avec votre h&ocirc;te, visite d&rsquo;une villa historique avec d&eacute;gustation de vins et d&icirc;ner de gala au piano &middot; longues soir&eacute;es thermales jusqu&rsquo;&agrave; 22h30 les vendredis et samedis &middot; peignoir fango et serviette pr&ecirc;t&eacute;s. Une facture s&eacute;par&eacute;e des soins vous est remise en fin de s&eacute;jour.',
  prezzoSpeciale: false,
  lingue: ['de', 'en', 'fr']
};

const PACCHETTI = {
  'sommer': PACCHETTO_SOMMER,
  'estate': PACCHETTO_SOMMER,
  'giugno': PACCHETTO_SOMMER,
  'juni': PACCHETTO_SOMMER,
  'feb': {
    it: 'Mezza pensione, 7 o 14 giorni &middot; pacchetto salute con visita medica, 5 fanghi naturali, 5 bagni termali all&rsquo;ozono, 5 massaggi di reazione e 5 inalazioni o aerosol &middot; aperitivo di benvenuto con Prosecco e Diner du Patron: men&ugrave; di sei portate con vini abbinati, a lume di candela e con pianoforte &middot; vini da tavola liberi con una selezione di grandi etichette italiane &middot; uso libero di biciclette e campo pratica golf &middot; escursione sui Colli Euganei con sosta dal vignaiolo, al raggiungimento del numero minimo &middot; accappatoio fango e telo in prestito. A fine soggiorno riceve la fattura separata delle cure.',
    de: 'Halbpension, 7 oder 14 Tage &middot; Gesundheitspaket mit &auml;rztlicher Untersuchung, 5 Naturfangopackungen, 5 Ozon-Thermalb&auml;dern, 5 Reaktionsmassagen und 5 Inhalationen oder Aerosol &middot; Prosecco-Aperitivempfang und Diner du Patron: 6-Gang-Men&uuml; mit passenden Weinen bei Kerzenschein und Klaviermusik &middot; freie Tischweine mit einer Auswahl italienischer Topweine &middot; freie Nutzung von Fahrr&auml;dern und Driving Range &middot; Ausflug in die Euganeischen H&uuml;gel mit Einkehr beim Winzer, bei Mindestteilnahme &middot; Fangobademantel und Badetuch leihweise. Am Ende des Aufenthalts erhalten Sie eine separate Rechnung &uuml;ber die Heilanwendungen.',
    en: 'Half board, 7 or 14 days &middot; health package with medical examination, 5 natural mud packs, 5 ozone thermal baths, 5 reaction massages and 5 inhalations or aerosol &middot; Prosecco welcome aperitif and Diner du Patron: six-course menu with paired wines, by candlelight with piano music &middot; complimentary table wines including a selection of top Italian labels &middot; free use of bicycles and driving range &middot; excursion to the Euganean Hills with a stop at a winemaker, subject to minimum participation &middot; mud bathrobe and towel on loan. A separate invoice for the treatments is issued at the end of your stay.',
    fr: 'Demi-pension, 7 ou 14 jours &middot; forfait sant&eacute; avec visite m&eacute;dicale, 5 applications de fango naturel, 5 bains thermaux &agrave; l&rsquo;ozone, 5 massages de r&eacute;action et 5 inhalations ou a&eacute;rosols &middot; ap&eacute;ritif de bienvenue au Prosecco et Diner du Patron : menu de six plats avec vins accord&eacute;s, aux chandelles et au piano &middot; vins de table offerts avec une s&eacute;lection de grands vins italiens &middot; libre utilisation des v&eacute;los et du practice &middot; excursion dans les collines Euganéennes avec halte chez un vigneron, sous r&eacute;serve d&rsquo;un nombre minimum de participants &middot; peignoir fango et serviette pr&ecirc;t&eacute;s. Une facture s&eacute;par&eacute;e des soins vous est remise en fin de s&eacute;jour.',
    prezzoSpeciale: false,
    lingue: ['de', 'en', 'fr']
  },
  'novem': {
    it: 'Settimana di cura con 5 fanghi naturali, 5 bagni termali all&rsquo;ozono, 5 massaggi di reazione e 5 inalazioni o aerosol &middot; visita medica inclusa &middot; vini da tavola liberi al ristorante &middot; programma settimanale con aperitivo di benvenuto, uscita culturale con degustazione di vini e Gala-Dinner con pianoforte &middot; accappatoio fango e telo in prestito. A fine soggiorno riceve la fattura separata delle cure.',
    de: 'Kurwoche mit 5 Naturfangopackungen, 5 Ozon-Thermalb&auml;dern, 5 Reaktionsmassagen und 5 Inhalationen oder Aerosol &middot; &auml;rztliche Untersuchung inklusive &middot; freie Tischweine im Restaurant &middot; Wochenprogramm mit Begr&uuml;&szlig;ungsaperitif, kulturellem Ausflug mit Weinverkostung und Gala-Dinner mit Klaviermusik &middot; Fangobademantel und Badetuch leihweise. Am Ende des Aufenthalts erhalten Sie eine separate Rechnung &uuml;ber die Heilanwendungen.',
    en: 'Cure week with 5 natural mud packs, 5 ozone thermal baths, 5 reaction massages and 5 inhalations or aerosol &middot; medical examination included &middot; complimentary table wines at the restaurant &middot; weekly programme with welcome aperitif, cultural outing with wine tasting and gala dinner with piano music &middot; mud bathrobe and towel on loan. A separate invoice for the treatments is issued at the end of your stay.',
    fr: 'Semaine de cure avec 5 applications de fango naturel, 5 bains thermaux &agrave; l&rsquo;ozone, 5 massages de r&eacute;action et 5 inhalations ou a&eacute;rosols &middot; visite m&eacute;dicale incluse &middot; vins de table offerts au restaurant &middot; programme hebdomadaire avec ap&eacute;ritif de bienvenue, sortie culturelle avec d&eacute;gustation de vins et d&icirc;ner de gala au piano &middot; peignoir fango et serviette pr&ecirc;t&eacute;s. Une facture s&eacute;par&eacute;e des soins vous est remise en fin de s&eacute;jour.',
    prezzoSpeciale: false,
    lingue: ['de', 'en', 'fr']
  },
  'dolce vita': {
    it: 'Mezza pensione con cena &middot; pacchetto salute: fango naturale con bagno termale all&rsquo;ozono, massaggio di reazione, inalazione o aerosol &middot; visita medica di ammissione inclusa.',
    de: 'Halbpension mit Abendessen &middot; Gesundheitspaket: Naturfangopackung mit Ozon-Thermalbad, Reaktionsmassage, Inhalation oder Aerosol &middot; &auml;rztliche Anfangsuntersuchung inklusive. Am Ende des Aufenthalts erhalten Sie eine separate Rechnung der Anwendungen zur Vorlage bei Ihrer Krankenkasse.',
    en: 'Half board with dinner &middot; health package: natural mud pack with ozone thermal bath, reaction massage, inhalation or aerosol &middot; medical admission examination included.',
    fr: 'Demi-pension avec d&icirc;ner &middot; forfait sant&eacute; : fango naturel avec bain thermal &agrave; l&rsquo;ozone, massage de r&eacute;action, inhalation ou a&eacute;rosol &middot; visite m&eacute;dicale d&rsquo;admission incluse.',
    prezzoSpeciale: true,
    lingue: ['de', 'en', 'fr']
  },
  'golf': {
    it: 'Mezza pensione con buffet a colazione e a cena &middot; uso libero del campo pratica dell&rsquo;hotel &middot; 1 green fee al Golf Club Frassanelle e 1 al Golf della Montecchia, a dieci minuti d&rsquo;auto.',
    de: 'Halbpension mit Fr&uuml;hst&uuml;cksb&uuml;ffet und abendlichem Kalt-Warm-B&uuml;ffet &middot; freie Nutzung der hoteleigenen Driving Range &middot; je 1 Greenfee in den Golfclubs Frassanelle und Montecchia, zehn Autominuten vom Hotel.',
    en: 'Half board with breakfast and evening buffet &middot; free use of the hotel&rsquo;s own driving range &middot; one green fee each at the Frassanelle and Montecchia golf clubs, ten minutes by car.',
    fr: 'Demi-pension avec buffet au petit d&eacute;jeuner et au d&icirc;ner &middot; libre acc&egrave;s au practice de l&rsquo;h&ocirc;tel &middot; un green fee au Golf Frassanelle et un &agrave; la Montecchia, &agrave; dix minutes en voiture.',
    prezzoSpeciale: false
  },
  'metaforum': {
    it: 'Tariffa riservata ai partecipanti del Metaforum SommerCamp &middot; l&rsquo;hotel &egrave; a soli sette minuti dal centro del SommerCamp &middot; la camera &egrave; a disposizione dalle 15:00 alle 22:00 il giorno di arrivo e dalle 8:00 alle 11:00 il giorno di partenza. Consigliamo di stipulare un&rsquo;assicurazione di annullamento viaggio.',
    de: 'Sondertarif f&uuml;r die Teilnehmer des Metaforum SommerCamps &middot; das Hotel liegt nur sieben Minuten vom Zentrum des SommerCamps entfernt &middot; das Zimmer steht Ihnen am Anreisetag von 15:00 bis 22:00 Uhr und am Abreisetag von 8:00 bis 11:00 Uhr zur Verf&uuml;gung. Wir empfehlen den Abschluss einer Reiser&uuml;cktrittsversicherung.',
    en: 'Rate reserved for Metaforum SommerCamp participants &middot; the hotel is only seven minutes from the SommerCamp venue &middot; the room is available from 3 pm to 10 pm on arrival day and from 8 am to 11 am on departure day. We recommend taking out travel cancellation insurance.',
    fr: 'Tarif r&eacute;serv&eacute; aux participants du Metaforum SommerCamp &middot; l&rsquo;h&ocirc;tel se trouve &agrave; sept minutes seulement du centre du SommerCamp &middot; la chambre est disponible de 15h &agrave; 22h le jour d&rsquo;arriv&eacute;e et de 8h &agrave; 11h le jour du d&eacute;part. Nous recommandons de souscrire une assurance annulation.',
    prezzoSpeciale: false,
    lingue: ['de', 'en', 'fr']
  },
  'smart': {
    it: 'Una notte in mezza pensione con cena a buffet e show cooking dei nostri chef &middot; 1 massaggio relax di 55 minuti a persona &middot; kit SPA con accappatoio e telo piscina per tutto il soggiorno.',
    de: 'Eine &Uuml;bernachtung in Halbpension mit Abendbuffet und Show-Cooking unserer K&uuml;chenchefs &middot; 1 Relax-Massage (55 Min.) pro Person &middot; SPA-Kit mit Bademantel und Badetuch f&uuml;r den gesamten Aufenthalt.',
    en: 'One night with half board, evening buffet and live show cooking &middot; 1 relaxing massage (55 min) per person &middot; SPA kit with bathrobe and pool towel for your whole stay.',
    fr: 'Une nuit en demi-pension avec buffet du soir et show cooking de nos chefs &middot; 1 massage relaxant de 55 minutes par personne &middot; kit SPA avec peignoir et serviette de piscine pour tout le s&eacute;jour.',
    prezzoSpeciale: false,
    lingue: ['it']
  },
  'escape': {
    it: 'Due notti in mezza pensione con cena a buffet e show cooking dei nostri chef &middot; 1 massaggio relax di 25 minuti a persona &middot; kit SPA con accappatoio e telo piscina per tutto il soggiorno.',
    de: 'Zwei &Uuml;bernachtungen in Halbpension mit Abendbuffet und Show-Cooking unserer K&uuml;chenchefs &middot; 1 Relax-Massage (25 Min.) pro Person &middot; SPA-Kit mit Bademantel und Badetuch f&uuml;r den gesamten Aufenthalt.',
    en: 'Two nights with half board, evening buffet and live show cooking &middot; 1 relaxing massage (25 min) per person &middot; SPA kit with bathrobe and pool towel for your whole stay.',
    fr: 'Deux nuits en demi-pension avec buffet du soir et show cooking de nos chefs &middot; 1 massage relaxant de 25 minutes par personne &middot; kit SPA avec peignoir et serviette de piscine pour tout le s&eacute;jour.',
    prezzoSpeciale: false,
    lingue: ['it']
  },
  'deluxe': {
    it: 'Tre notti in mezza pensione con cena a buffet e show cooking dei nostri chef &middot; 1 massaggio relax di 25 minuti a persona &middot; kit SPA con accappatoio e telo piscina per tutto il soggiorno.',
    de: 'Drei &Uuml;bernachtungen in Halbpension mit Abendbuffet und Show-Cooking unserer K&uuml;chenchefs &middot; 1 Relax-Massage (25 Min.) pro Person &middot; SPA-Kit mit Bademantel und Badetuch f&uuml;r den gesamten Aufenthalt.',
    en: 'Three nights with half board, evening buffet and live show cooking &middot; 1 relaxing massage (25 min) per person &middot; SPA kit with bathrobe and pool towel for your whole stay.',
    fr: 'Trois nuits en demi-pension avec buffet du soir et show cooking de nos chefs &middot; 1 massage relaxant de 25 minutes par personne &middot; kit SPA avec peignoir et serviette de piscine pour tout le s&eacute;jour.',
    prezzoSpeciale: false,
    lingue: ['it']
  }
};

const AVVISO_PREZZO_SPECIALE = {
  it: 'Prezzo speciale: valido solo con pagamento tramite bonifico prima dell\'arrivo o in contanti.',
  de: 'Sonderpreis: Nur g&uuml;ltig durch &Uuml;berweisung vor Anreise oder bei Barzahlung.',
  en: 'Special rate: valid only with bank transfer before arrival or cash payment.',
  fr: 'Tarif sp&eacute;cial : valable uniquement par virement avant l\'arriv&eacute;e ou en esp&egrave;ces.'
};


/* ============================================================
   TRATTAMENTI — traduzione del nome arrangiamento di Fidra
   "DOLCE VITA 10 CURE" → "Dolce Vita mit 10 Anwendungen".
   I nomi propri restano; se tutto maiuscolo, viene ricomposto
   in maiuscole/minuscole. Regole per pezzi ricorrenti.
   ============================================================ */
function traduciTrattamento(nome, lingua) {
  let out = String(nome || '').trim();
  if (!out || lingua === 'it') return out;
  // da TUTTO MAIUSCOLO a Iniziali Maiuscole
  if (out === out.toUpperCase() && /[A-Z]/.test(out)) {
    out = out.toLowerCase().replace(/(^|[\s&(\/-])([a-zà-ù])/g, (m, p, c) => p + c.toUpperCase());
  }
  const regole = {
    de: [[/\bMiglior\s*Prezzo\b/i, 'Bestpreis'], [/\b(\d+)\s*Cure\b/i, 'mit $1 Anwendungen'], [/\bMezza\s*Pensione\b/i, 'Halbpension'],
         [/\bSoggiorno\s*Breve\b/i, 'Kurzaufenthalt'], [/\bPernottamento\s*e\s*Colazione\b/i, '&Uuml;bernachtung mit Fr&uuml;hst&uuml;ck']],
    en: [[/\bMiglior\s*Prezzo\b/i, 'Best rate'], [/\b(\d+)\s*Cure\b/i, 'with $1 treatments'], [/\bMezza\s*Pensione\b/i, 'Half board'],
         [/\bSoggiorno\s*Breve\b/i, 'Short stay'], [/\bPernottamento\s*e\s*Colazione\b/i, 'Bed &amp; breakfast']],
    fr: [[/\bMiglior\s*Prezzo\b/i, 'Meilleur tarif'], [/\b(\d+)\s*Cure\b/i, 'avec $1 soins'], [/\bMezza\s*Pensione\b/i, 'Demi-pension'],
         [/\bSoggiorno\s*Breve\b/i, 'Court s&eacute;jour'], [/\bPernottamento\s*e\s*Colazione\b/i, 'Nuit et petit d&eacute;jeuner']]
  };
  for (const [re, sost] of (regole[lingua] || [])) out = out.replace(re, sost);
  return out;
}

const TITOLO_PACCHETTO = {
  it: 'IL PACCHETTO COMPRENDE',
  de: 'IM PAKET ENTHALTEN',
  en: 'YOUR PACKAGE INCLUDES',
  fr: 'LE FORFAIT COMPREND'
};




/* Riga con il periodo proprio della camera: compare solo quando le date
   della camera differiscono da quelle della prenotazione. */
const MESI_LUNGHI = {
  Jan: {it:'gennaio',de:'Januar',en:'January',fr:'janvier'}, Feb: {it:'febbraio',de:'Februar',en:'February',fr:'f&eacute;vrier'},
  Mar: {it:'marzo',de:'M&auml;rz',en:'March',fr:'mars'}, Apr: {it:'aprile',de:'April',en:'April',fr:'avril'},
  May: {it:'maggio',de:'Mai',en:'May',fr:'mai'}, Jun: {it:'giugno',de:'Juni',en:'June',fr:'juin'},
  Jul: {it:'luglio',de:'Juli',en:'July',fr:'juillet'}, Aug: {it:'agosto',de:'August',en:'August',fr:'ao&ucirc;t'},
  Sep: {it:'settembre',de:'September',en:'September',fr:'septembre'}, Oct: {it:'ottobre',de:'Oktober',en:'October',fr:'octobre'},
  Nov: {it:'novembre',de:'November',en:'November',fr:'novembre'}, Dec: {it:'dicembre',de:'Dezember',en:'December',fr:'d&eacute;cembre'}
};

function periodoCamera(c, lingua) {
  const p = c && c.periodo;
  if (!p || !p.g1 || !p.g2) return '';
  const mese = (MESI_LUNGHI[p.mese] || {})[lingua] || p.mese;
  const frasi = {
    it: `dal ${p.g1} al ${p.g2} ${mese}` + (p.notti ? ` &middot; ${p.notti} notti` : ''),
    de: `vom ${p.g1}. bis ${p.g2}. ${mese}` + (p.notti ? ` &middot; ${p.notti} N&auml;chte` : ''),
    en: `from ${p.g1} to ${p.g2} ${mese}` + (p.notti ? ` &middot; ${p.notti} nights` : ''),
    fr: `du ${p.g1} au ${p.g2} ${mese}` + (p.notti ? ` &middot; ${p.notti} nuits` : '')
  };
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:19px;color:#0F5C64;padding-top:4px;"><strong>${frasi[lingua] || frasi.it}</strong></div>`;
}

/* periodo di una camera in parole: quello proprio se c'è, altrimenti quello
   globale del soggiorno. Serve quando le camere hanno date diverse: lasciarne
   una senza periodo farebbe pensare a una dimenticanza. */
function testoPeriodo(c, d, lingua) {
  const p = (c && c.periodo) || null;
  const g1 = p ? p.g1 : (d && d.giornoArrivo);
  const g2 = p ? p.g2 : (d && d.giornoPartenza);
  const mese = p ? p.mese : (d && d.mese);
  const mese2 = (p ? (p.mesePartenza || p.mese) : ((d && d.mesePartenza) || (d && d.mese)));
  if (!g1 || !g2 || !mese) return '';
  const nome = (MESI_LUNGHI[mese] || {})[lingua] || mese;
  const nome2 = (MESI_LUNGHI[mese2] || {})[lingua] || mese2;
  /* a cavallo di due mesi il mese va ripetuto su entrambe le date */
  const doppio = mese2 && mese2 !== mese;
  const frasi = {
    it: doppio ? `dal ${g1} ${nome} al ${g2} ${nome2}` : `dal ${g1} al ${g2} ${nome}`,
    de: doppio ? `vom ${g1}. ${nome} bis ${g2}. ${nome2}` : `vom ${g1}. bis ${g2}. ${nome}`,
    en: doppio ? `from ${g1} ${nome} to ${g2} ${nome2}` : `from ${g1} to ${g2} ${nome}`,
    fr: doppio ? `du ${g1} ${nome} au ${g2} ${nome2}` : `du ${g1} au ${g2} ${nome}`
  };
  return frasi[lingua] || frasi.it;
}

/* titolo della camera: "1 Doppia" oppure, quando i periodi differiscono,
   "1 Doppia per 2 persone dal 2 al 4 settembre" */
function intestazioneCamera(c, d, lingua, nomeCategoria) {
  const nOsp = (c.adulti || 0) + (c.bambini || 0);
  const PERS = {
    it: (n) => `${n} ${n === 1 ? 'persona' : 'persone'}`,
    de: (n) => `${n} ${n === 1 ? 'Person' : 'Personen'}`,
    en: (n) => `${n} ${n === 1 ? 'person' : 'people'}`,
    fr: (n) => `${n} ${n === 1 ? 'personne' : 'personnes'}`
  };
  const PER = { it: 'per', de: 'f&uuml;r', en: 'for', fr: 'pour' };
  const q = c.quantita || 1;
  const base = `${q} ${nomeCategoria}`;
  if (!periodiDiversi(d)) return base;
  const per = testoPeriodo(c, d, lingua);
  return `${base} ${PER[lingua] || PER.it} ${(PERS[lingua] || PERS.it)(nOsp)}${per ? ' ' + per : ''}`;
}

/* ============================================================
   v1.7.4 — MARCHI DI CERTIFICAZIONE (GSTC + ente certificatore)
   ------------------------------------------------------------
   PER ATTIVARLI: incollare qui i due indirizzi delle immagini,
   caricate sul sito (cartella /img). Finché restano vuoti non
   viene stampato nulla: nessun riquadro rotto nelle email.

   Perché URL e non file incorporati: Outlook e Gmail scartano
   le immagini incorporate (data:) nelle email; devono stare su
   un indirizzo pubblico https.

   Vincoli GSTC rispettati qui sotto e da non alterare:
   · i due marchi hanno la STESSA altezza (proporzionalmente uguali)
   · zona di rispetto del 33% dell'altezza del logo GSTC tutt'intorno
   · il logo GSTC non compare mai da solo, sempre con l'ente
   · il marchio va usato intero, con il suo codice identificativo,
     senza ritagli né cambi di colore
   Se la certificazione venisse sospesa o non rinnovata, svuotare
   queste due righe: i marchi spariscono da ogni email.
   ============================================================ */
const MARCHIO_GSTC  = '';   // es. 'https://www.termeleonardo.com/img/gstc-certified.png'
const MARCHIO_ENTE  = '';   // es. 'https://www.termeleonardo.com/img/vireo.png'
const MARCHI_ALTEZZA = 54;  // px, uguale per entrambi

function bloccoCertificazioni() {
  if (!MARCHIO_GSTC || !MARCHIO_ENTE) return '';
  const h = MARCHI_ALTEZZA;
  const rispetto = Math.round(h * 0.33);   // zona di esclusione richiesta
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;">
      <tr>
        <td style="padding:${rispetto}px ${rispetto}px ${rispetto}px 0;">
          <img src="${MARCHIO_GSTC}" alt="GSTC-Certified" height="${h}" style="height:${h}px;display:block;border:0;" /></td>
        <td style="padding:${rispetto}px 0 ${rispetto}px ${rispetto}px;">
          <img src="${MARCHIO_ENTE}" alt="Vireo" height="${h}" style="height:${h}px;display:block;border:0;" /></td>
      </tr>
    </table>`;
}

/* v1.6.5: la mezza pensione comprende la cena a buffet al ristorante.
   La riga "A tavola" delle offerte lo dice quando almeno una camera NON è
   in solo pernottamento e colazione (tutti i trattamenti e i pacchetti
   dell'hotel, tranne il B&B, comprendono la cena). */
function includeCena(d) {
  const camere = (d && d.camere) || [];
  if (!camere.length) return false;
  const soloBB = (t) => /pernottamento\s*e\s*colazione|bed\s*&?\s*breakfast|b\s*&\s*b|&uuml;bernachtung\s*mit|übernachtung\s*mit/i.test(t || '');
  return camere.some(c => c.trattamento && !soloBB(c.trattamento));
}

function rigaATavola(d, lingua) {
  const COLAZIONE = {
    it: 'Ricca colazione a buffet, con alternative senza glutine, senza lattosio e vegetali',
    de: 'Reichhaltiges Fr&uuml;hst&uuml;cksbuffet, mit glutenfreien, laktosefreien und pflanzlichen Alternativen',
    en: 'Generous breakfast buffet, with gluten-free, lactose-free and plant-based options',
    fr: 'Copieux petit-d&eacute;jeuner buffet, avec options sans gluten, sans lactose et v&eacute;g&eacute;tales'
  };
  const CENA = {
    it: ' &middot; nella mezza pensione &egrave; compresa la <strong style="color:#2A2E2B;">cena a buffet al ristorante</strong>, dalle 19:30 (ultimo ingresso alle 20:20)',
    de: ' &middot; in der Halbpension ist das <strong style="color:#2A2E2B;">Abendbuffet im Restaurant</strong> inbegriffen, ab 19:30 Uhr (letzter Einlass 20:20 Uhr)',
    en: ' &middot; half board includes the <strong style="color:#2A2E2B;">evening buffet at the restaurant</strong>, from 7:30 pm (last entry 8:20 pm)',
    fr: ' &middot; la demi-pension comprend le <strong style="color:#2A2E2B;">d&icirc;ner buffet au restaurant</strong>, d&egrave;s 19 h 30 (dernier acc&egrave;s &agrave; 20 h 20)'
  };
  return (COLAZIONE[lingua] || COLAZIONE.it) + (includeCena(d) ? (CENA[lingua] || CENA.it) : '');
}

/* ============================================================
   v1.8.3 — PULSANTI PER I MODULI DEL SITO
   ------------------------------------------------------------
   Ogni servizio ha la sua pagina su hoteltermeleonardo.com. Il
   pulsante ci porta l'ospite con i suoi dati già in coda
   all'indirizzo, così il modulo può compilarsi da solo.

   PARAMETRI INVIATI (da leggere sul sito, una riga di JS:
   new URLSearchParams(location.search).get('nome') ecc.):
     rif       numero dell'offerta o conferma  (es. O26/19130)
     nome      intestatario
     email     indirizzo dell'ospite
     tel       telefono, se presente in Fidra
     arrivo    data ISO  (2026-08-17)
     partenza  data ISO  (2026-08-19)
     adulti    numero
     lang      it | de | en | fr
   Nessun dato sensibile: sono gli stessi che l'ospite scriverebbe.
   ============================================================ */
const MODULI = {
  trattamenti: 'https://www.hoteltermeleonardo.com/it/trattamenti',
  transfer:    'https://www.hoteltermeleonardo.com/it/transfer',
  /* v2.0.3: i buoni hanno una pagina per lingua. Meglio l'indirizzo giusto
     che aggiungere lang= a quello italiano: l'ospite tedesco atterra su una
     pagina tedesca invece di veder passare per un attimo quella italiana. */
  buoni:       { it: 'https://www.hoteltermeleonardo.com/it/buoni-regalo',
                 de: 'https://www.hoteltermeleonardo.com/de/gutscheine',
                 en: 'https://www.hoteltermeleonardo.com/en/gift-vouchers',
                 fr: 'https://www.hoteltermeleonardo.com/fr/cheques-cadeaux' },
  greenfee:    'https://www.hoteltermeleonardo.com/it/green-fee',
  golf:        'https://www.hoteltermeleonardo.com/it/maestro-di-golf'
};

function isoData(g, mese, anno) {
  const i = MESI_N[mese];          // MESI_N è 0-based
  if (!g || i == null || !anno) return '';
  return `${anno}-${String(i + 1).padStart(2, '0')}-${String(g).padStart(2, '0')}`;
}

function linkModulo(chiave, d, lingua) {
  const voce = MODULI[chiave];
  const base = (voce && typeof voce === 'object') ? (voce[lingua] || voce.it) : voce;
  if (!base) return '';
  const p = new URLSearchParams();
  if (d.numeroOfferta) p.set('rif', d.numeroOfferta);
  if (d.intestatario)  p.set('nome', d.intestatario);
  if (d.email)         p.set('email', d.email);
  if (d.telefono)      p.set('tel', d.telefono);
  const a = isoData(d.giornoArrivo, d.mese, d.anno);
  const b = isoData(d.giornoPartenza, d.mesePartenza || d.mese, d.annoPartenza || d.anno);
  if (a) p.set('arrivo', a);
  if (b) p.set('partenza', b);
  if (d.adulti)        p.set('adulti', String(d.adulti));
  p.set('lang', lingua || 'it');
  return base + '?' + p.toString();
}

/* pulsante piccolo, in tabella perché Outlook non regge i bottoni CSS */
function pulsanteModulo(chiave, testo, d, lingua) {
  const url = linkModulo(chiave, d, lingua);
  if (!url) return '';
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:8px;"><tr>
      <td bgcolor="#0F5C64" style="border-radius:4px;">
        <a href="${url}" target="_blank" style="display:inline-block;padding:7px 15px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#FFFFFF;text-decoration:none;line-height:16px;"><span style="color:#FFFFFF;text-decoration:none;">${testo}</span></a>
      </td></tr></table>`;
}

const TESTI_MODULI = {
  trattamenti: { it: 'Richiedi trattamenti e massaggi', de: 'Behandlungen und Massagen anfragen',
                 en: 'Request treatments and massages', fr: 'Demander soins et massages' },
  transfer:    { it: 'Richiedi il transfer',  de: 'Transfer anfragen',
                 en: 'Request the transfer',  fr: 'Demander le transfert' },
  buoni:       { it: 'Regala un buono',       de: 'Gutschein verschenken',
                 en: 'Give a gift voucher',   fr: 'Offrir un bon cadeau' },
  greenfee:    { it: 'Richiedi il green fee', de: 'Greenfee anfragen',
                 en: 'Request the green fee', fr: 'Demander le green fee' },
  golf:        { it: 'Richiedi il maestro di golf', de: 'Golflehrer anfragen',
                 en: 'Request the golf pro',        fr: 'Demander le moniteur de golf' }
};

function bottoneServizio(chiave, d, lingua) {
  const t = TESTI_MODULI[chiave];
  return pulsanteModulo(chiave, (t && (t[lingua] || t.it)) || '', d, lingua);
}

/* almeno una camera ha un periodo proprio (date diverse dal soggiorno globale)? */
function periodiDiversi(d) {
  return ((d && d.camere) || []).some(c => c && c.periodo);
}

/* ============================================================
   v1.6 — SOGGIORNANTI CON PREZZI O DATE DIVERSI NELLA STESSA CAMERA
   Quando l'estrattore ha letto dall'API il dettaglio per ospite
   (c.soggiornanti), la camera non si descrive più con un solo
   "X € a persona": ogni ospite ha la sua riga, e il totale camera
   è la SOMMA dei prezzi, non una moltiplicazione.
   ============================================================ */

/* Regola della casa: i nomi degli ospiti non compaiono mai nelle email.
   Con false si scrive "1° ospite / 2° ospite"; mettere true per i nomi. */
const EMAIL_MOSTRA_NOMI_OSPITI = false;

function cameraMista(c) {
  return !!(c && c.soggiornanti && c.soggiornanti.length > 1 &&
            (c.prezziDiversi || c.periodiOspitiDiversi));
}

function soggiorniMisti(d) {
  return ((d && d.camere) || []).some(cameraMista);
}

/* totale della camera: somma per ospite se disponibile, altrimenti p.p. × persone */
function prezzoCamera(c) {
  if (c && c.totaleCamera != null) return c.totaleCamera;
  if (c && c.totalePP != null) {
    const n = (c.adulti || 0) + (c.bambini || 0);
    return c.totalePP * (n || 1);   // fallback di pagina: bambini a prezzo pieno (come prima)
  }
  return null;
}

function etichettaOspite(i, lingua, nome) {
  if (EMAIL_MOSTRA_NOMI_OSPITI && nome) return nome;
  const ORD = {
    it: (n) => `${n}\u00B0 ospite`,
    de: (n) => `${n}. Gast`,
    en: (n) => `Guest ${n}`,
    fr: (n) => `${n}${n === 1 ? 're' : 'e'} personne`
  };
  return (ORD[lingua] || ORD.it)(i + 1);
}

/* "dal 13 al 18 agosto" per un singolo soggiornante (date lette dall'API) */
function testoPeriodoOspite(sg, lingua) {
  const a = sg && sg.arrivo, p = sg && sg.partenza;
  if (!a || !p || !a.g || !p.g || !a.mese || !p.mese) return '';
  const n1 = (MESI_LUNGHI[a.mese] || {})[lingua] || a.mese;
  const n2 = (MESI_LUNGHI[p.mese] || {})[lingua] || p.mese;
  const doppio = a.mese !== p.mese;
  const frasi = {
    it: doppio ? `dal ${a.g} ${n1} al ${p.g} ${n2}` : `dal ${a.g} al ${p.g} ${n1}`,
    de: doppio ? `vom ${a.g}. ${n1} bis ${p.g}. ${n2}` : `vom ${a.g}. bis ${p.g}. ${n1}`,
    en: doppio ? `from ${a.g} ${n1} to ${p.g} ${n2}` : `from ${a.g} to ${p.g} ${n1}`,
    fr: doppio ? `du ${a.g} ${n1} au ${p.g} ${n2}` : `du ${a.g} au ${p.g} ${n1}`
  };
  return frasi[lingua] || frasi.it;
}

function nottiOspite(sg, lingua) {
  if (!sg || !sg.notti) return '';
  const N = { it: ['notte','notti'], de: ['Nacht','N\u00E4chte'],
              en: ['night','nights'], fr: ['nuit','nuits'] };
  const p = N[lingua] || N.it;
  return `${sg.notti} ${sg.notti === 1 ? p[0] : p[1]}`;
}

function importoLingua(n, lingua) {
  if (lingua === 'de') return (n || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' \u20AC';
  if (lingua === 'en') return '\u20AC' + (n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (lingua === 'fr') return (n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' \u20AC';
  return (n || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' \u20AC';
}

/* v1.6.4: riga con la quota dei bambini, quando l'API la espone.
   Es.: "1 bambino (12 anni) · 90,00 €". Con più bambini e prezzi
   individuali, un elenco; altrimenti la somma. */
function rigaBambini(c, lingua) {
  const prezzi = (c && c.bambiniPrezzi) || [];
  if (!prezzi.length) return '';
  const n = prezzi.length;
  const NOME = { it: ['bambino', 'bambini'], de: ['Kind', 'Kinder'],
                 en: ['child', 'children'], fr: ['enfant', 'enfants'] };
  const ANNI = { it: 'anni', de: 'Jahre', en: 'years', fr: 'ans' };
  const eta = (String(c.etaBambini || '').match(/\d+/g) || []);
  const nome = NOME[lingua] || NOME.it;
  let testo;
  if (n === 1) {
    const e = eta.length === 1 ? ` (${eta[0]} ${ANNI[lingua] || ANNI.it})` : '';
    testo = `1 ${nome[0]}${e} &middot; <strong style="color:#0F5C64;">${importoLingua(prezzi[0], lingua)}</strong>`;
  } else if (eta.length === n) {
    /* v1.7: l'ordine dei prezzi nell'API non segue l'ordine delle età in
       pagina, e accoppiarli per posizione li invertiva (5 anni → 30 €,
       2 anni → 50 €). Il listino della casa cresce con l'età (2 anni 30 €,
       6 anni 50 €, 10 anni 80 €): si abbinano quindi per rango, età
       crescente con prezzo crescente, mantenendo in email l'ordine dei
       bambini com'è in Fidra. */
    const prezziOrdinati = [...prezzi].sort((a, b) => a - b);
    const rango = eta.map((e, i) => ({ e: +e, i }))
      .sort((a, b) => a.e - b.e || a.i - b.i);
    const perIndice = [];
    rango.forEach((r, k) => { perIndice[r.i] = prezziOrdinati[k]; });
    testo = eta.map((e, i) =>
      `1 ${nome[0]} (${e} ${ANNI[lingua] || ANNI.it}) &middot; <strong style="color:#0F5C64;">${importoLingua(perIndice[i], lingua)}</strong>`
    ).join('<br />');
  } else {
    const tot = prezzi.reduce((a, b) => a + b, 0);
    testo = `${n} ${nome[1]} &middot; <strong style="color:#0F5C64;">${importoLingua(tot, lingua)}</strong>`;
  }
  return `<br /><span style="color:#7B756A;font-size:13px;">${testo}</span>`;
}

/* v1.6.7: gli extra della camera, sotto il prezzo. Es.:
   "Camera d'appoggio · 60,00 € (1 camera × 1 notte)". Le voci che non si
   sanno moltiplicare compaiono col solo prezzo unitario e la sua unità,
   così l'ospite vede la voce e in reception si completa il conto. */
function rigaExtraCamera(c, lingua) {
  const voci = (c && c.extraCalcolati) || [];
  if (!voci.length) return '';
  const righe = voci.map(e => {
    const val = e.totale != null ? e.totale : e.unitario;
    const negativo = val < 0;   // v1.7.7: gli sconti si scrivono col meno
    const importo = (negativo ? '\u2212 ' : '') + importoLingua(Math.abs(val), lingua);
    const nota = e.totale != null
      ? (e.spiega ? ` <span style="color:#8C8578;">(${e.spiega})</span>` : '')
      : (e.unita ? ` <span style="color:#8C8578;">(${e.unita.toLowerCase()})</span>` : '');
    return `${e.nome} &middot; <strong style="color:${negativo ? '#7A8450' : '#0F5C64'};">${importo}</strong>${nota}`;
  }).join('<br />');
  return `<br /><span style="color:#7B756A;font-size:13px;">${righe}</span>`;
}

/* v2.1.4: con piu' camere, sotto ognuna il suo totale: senza, l'ospite
   vede solo prezzi a persona e un totale complessivo, e i conti in mezzo
   deve farli lui. Con una camera sola non serve: il totale e' gia' sotto. */
function totaleCameraRiga(c, d, lingua) {
  const camere = (d && d.camere) || [];
  if (camere.length < 2) return '';
  const q = c.quantita || 1;
  const uno = prezzoCamera(c);
  if (uno == null) return '';
  const tot = uno * q;
  const ETI = { it: q > 1 ? 'Totale camere' : 'Totale camera',
                de: q > 1 ? 'Zimmer gesamt' : 'Zimmer gesamt',
                en: q > 1 ? 'Rooms total' : 'Room total',
                fr: q > 1 ? 'Total chambres' : 'Total chambre' };
  return `<div style="padding-top:6px;margin-top:6px;border-top:1px solid #E9E2D5;
    font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#2A2E2B;">
    ${ETI[lingua] || ETI.it} <strong>${importoLingua(tot, lingua)}</strong>${
      q > 1 ? ` <span style="color:#8C8578;">(${q} &times; ${importoLingua(uno, lingua)})</span>` : ''}</div>`;
}

/* con la quota bambini esposta, il prezzo p.p. vale per i soli adulti */
function etichettaPrezzoAdulti(c, lingua, normale) {
  if (!((c && c.bambiniPrezzi) || []).length) return normale;
  const PA = { it: 'per adulto', de: 'pro Erwachsenem', en: 'per adult', fr: 'par adulte' };
  return PA[lingua] || PA.it;
}

/* Le righe per ospite, una sotto l'altra, più il totale camera.
   Il trattamento del singolo compare solo se differisce tra gli ospiti. */
function righeSoggiornanti(c, lingua) {
  if (!cameraMista(c)) return '';
  const tratt = [...new Set(c.soggiornanti.map(s => (s.trattamento || '').trim()).filter(Boolean))];
  const trattDiversi = tratt.length > 1;
  const TOT = { it: 'Totale camera', de: 'Zimmer gesamt', en: 'Room total', fr: 'Total chambre' };
  const righe = c.soggiornanti.map((s, i) => {
    const pezzi = [etichettaOspite(i, lingua, s.nome)];
    const periodo = testoPeriodoOspite(s, lingua);
    if (periodo) pezzi.push(periodo);
    const nt = nottiOspite(s, lingua);
    if (nt) pezzi.push(nt);
    if (trattDiversi && s.trattamento) {
      pezzi.push(typeof traduciTrattamento === 'function'
        ? traduciTrattamento(s.trattamento, lingua) : s.trattamento);
    }
    if (s.prezzo != null) pezzi.push(`<strong style="color:#0F5C64;">${importoLingua(s.prezzo, lingua)}</strong>`);
    return `<div style="padding-top:3px;">${pezzi.join(' &middot; ')}</div>`;
  }).join('');
  const totale = prezzoCamera(c);
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:19px;color:#55524B;padding-top:6px;">
    ${righe}${rigaBambini(c, lingua)}
    ${totale != null ? `<div style="padding-top:5px;border-top:1px solid #E9E2D5;margin-top:6px;color:#2A2E2B;">${TOT[lingua] || TOT.it} <strong>${importoLingua(totale, lingua)}</strong></div>` : ''}
  </div>`;
}

/* le camere con pacchetto vanno in fondo: la descrizione del pacchetto è lunga
   e seppellirebbe le informazioni delle altre camere */
/* ============================================================
   v2.0.2 — CAMERE IDENTICHE RAGGRUPPATE
   Con quattro Queen uguali l'email ripeteva quattro volte lo stesso
   riquadro, descrizione compresa. Camere identiche in tutto — categoria,
   trattamento, occupazione, prezzo, periodo — diventano una riga sola
   con la quantita' davanti. Basta una differenza (un ospite in piu', un
   prezzo diverso, date proprie) e restano separate, perche' quella
   differenza l'ospite deve vederla.
   ============================================================ */
function raggruppaCamere(camere) {
  const fuori = [];
  const gruppi = new Map();
  for (const c of camere || []) {
    /* le camere con dettaglio per ospite o extra propri non si accorpano:
       hanno righe che valgono solo per loro */
    if ((c.soggiornanti && c.soggiornanti.length) || (c.extraCalcolati || []).length) {
      fuori.push(Object.assign({}, c, { quantita: 1 }));
      continue;
    }
    const p = c.periodo || {};
    const chiave = [c.categoria, c.trattamento, c.adulti, c.bambini, c.etaBambini || '',
                    c.totalePP, (c.bambiniPrezzi || []).join('/'),
                    p.g1 || '', p.g2 || '', p.mese || '', p.mesePartenza || ''].join('|');
    const g = gruppi.get(chiave);
    if (g) g.quantita++;
    else gruppi.set(chiave, Object.assign({}, c, { quantita: 1 }));
  }
  return [...gruppi.values(), ...fuori];
}

function ordinaCamere(camere) {
  const haPacchetto = (c) =>
    Object.keys(PACCHETTI).some(k => (c.trattamento || '').toLowerCase().includes(k)) ? 1 : 0;
  return [...(camere || [])].sort((a, b) => haPacchetto(a) - haPacchetto(b));
}

function notaPacchetto(trattamento, lingua) {
  const chiave = Object.keys(PACCHETTI).find(k => (trattamento || '').toLowerCase().includes(k));
  if (!chiave) return '';
  const p = PACCHETTI[chiave];
  // pacchetti riservati ad alcune lingue: fuori da quelle, nessuna didascalia
  if (Array.isArray(p.lingue) && !p.lingue.includes(lingua)) return '';
  const testo = p[lingua];
  if (!testo && !p.prezzoSpeciale) return '';
  let righe = '';
  if (testo) {
    // il testo usa &middot; come separatore: ogni voce diventa una riga con pallino
    righe = testo.split('&middot;').map(v => v.trim()).filter(Boolean).map(v =>
      `<tr><td valign="top" width="12" style="padding:0 6px 5px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#7A8450;">&bull;</td>` +
      `<td style="padding:0 0 5px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:19px;color:#55524B;">${v.charAt(0).toUpperCase() + v.slice(1)}</td></tr>`
    ).join('');
  }
  const avviso = p.prezzoSpeciale
    ? `<tr><td colspan="2" style="padding:7px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:#8A5A2B;"><strong>${AVVISO_PREZZO_SPECIALE[lingua] || AVVISO_PREZZO_SPECIALE.it}</strong></td></tr>`
    : '';
  return `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:10px;background-color:#FFFFFF;border:1px solid #E7E1D4;">
        <tr><td style="padding:10px 14px 8px 14px;">
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:1.5px;color:#7A8450;padding-bottom:7px;">${TITOLO_PACCHETTO[lingua] || TITOLO_PACCHETTO.it}</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${righe}${avviso}</table>
        </td></tr>
      </table>`;
}

function dataIT(giorno, meseAbbr, anno) {
  return `${giorno} ${MESI_IT[MESI_N[meseAbbr]]} ${anno}`;
}

function scadenzaIT(s) {
  const m = (s || '').match(/(\d{1,2})\s+([A-Za-z]{3})\s+(20\d\d)/);
  return m ? dataIT(+m[1], m[2], +m[3]) : s;
}

/* saluto: il gestionale non espone il genere, quindi lo sceglie l'operatore */
function saluto(nomeCompleto, genere) {
  const p = (nomeCompleto || '').trim().split(/\s+/);
  const cognome = p[0] || '';
  /* v2.0.5: il nome puo' mancare — per Day Spa e buoni regalo spesso si
     risponde a un indirizzo senza firma. Senza cognome si usa la forma
     completa ("Gentile Signora", non "Gentile Signora " con lo spazio in
     fondo) e, se non si sa nemmeno il genere, "Gentile Ospite". */
  if (!cognome) {
    if (genere === 'F') return 'Gentile Signora';
    if (genere === 'M') return 'Gentile Signore';
    return 'Gentile Ospite';
  }
  if (genere === 'F') return `Gentile Signora ${cognome}`;
  if (genere === 'M') return `Gentile Signor ${cognome}`;
  return `Gentile ${nomeCompleto}`;
}

/* v1.8.9: "10 persone, di cui 2 bambini" quando gli adulti erano 10 e i
   bambini 2: il totale deve comprenderli, sono 12 persone di cui 2 bambini. */
function descrizioneOspiti(adulti, bambini) {
  const tot = (adulti || 0) + (bambini || 0);
  const a = tot === 1 ? '1 persona' : `${tot} persone`;
  if (!bambini) return a;
  return `${a}, di cui ${bambini === 1 ? '1 bambino' : bambini + ' bambini'}`;
}

/* descrizioni camere — solo dati verificati; categoria sconosciuta = nessuna riga */
/* ⚠ ABBINAMENTO DA VERIFICARE CON LA DIREZIONE
   I nomi Fidra (Abano / Monteortone / Colli Euganei) non coincidono con quelli
   pubblicati su Booking (Familiare / Deluxe / con Balcone). Metrature e dotazioni
   sono verificate; l'attribuzione a ciascun nome è una deduzione. */
const CAMERE_IT = {
  'queen': '16 m², letto matrimoniale queen da 1,60 m, balcone con vista sul giardino, insonorizzata',
  'doppia': '18 m², letti singoli accostabili, balcone, insonorizzata',
  'singola': '16 m², letto alla francese da 1,40 m, balcone con vista sul giardino e sulle piscine',
  'junior suite abano': '28 m², fino a 3 persone: camera e soggiorno separati con divano letto, terrazza e cabina armadio',
  'junior suite monteortone': '28 m², fino a 4 persone: letto matrimoniale e due divani letto, terrazza con vista sul giardino',
  'junior suite colli': '24 m² per 2 persone, area salotto e cabina armadio, terrazza con vista sul giardino e sulle piscine',
  'junior suite accessibile': 'Al primo piano, attrezzata per ospiti con disabilità, senza balcone, bagno privato con doccia',
  'suite monteortone': '48 m², fino a 4 persone: letto matrimoniale e due divani letto, bagno con doppio lavabo e terrazza. La nostra sistemazione più ampia',
  'suite colli': '41 m² per 2 persone, terrazza con vista sul giardino e sulle piscine, cabina armadio e bagno con doppio lavabo'
};

const DOTAZIONE_IT = 'Tutte le camere hanno aria condizionata, TV a schermo piatto con servizi di streaming, telefono, cassaforte, minibar, Wi-Fi in fibra, bagno privato con doccia, accappatoio e asciugacapelli, pavimento in parquet.';

function descrizioneCamera(categoria, dizionario) {
  const c = (categoria || '').toLowerCase();
  let best = '';
  for (const chiave in dizionario) {
    if (c.includes(chiave) && chiave.length > best.length) best = chiave;
  }
  return best ? dizionario[best] : '';
}

function bloccoCamere(camere, d) {
  return raggruppaCamere(camere).map(c => {
    const nOsp = (c.adulti || 0) + (c.bambini || 0);
    const chi  = `${nOsp} ${nOsp === 1 ? 'ospite' : 'ospiti'}` +
                 ((c.quantita || 1) > 1 ? ' per camera' : '');
    const desc = descrizioneCamera(c.categoria, CAMERE_IT);
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:10px;background-color:#FAF8F4;">
      <tr>
        <td width="4" style="background-color:#1E7F88;font-size:0;line-height:0;">&nbsp;</td>
        <td style="padding:15px 18px;">
          <div style="font-family:Georgia,'Times New Roman',serif;font-size:18px;line-height:24px;color:#2A2E2B;">${intestazioneCamera(c, d, 'it', c.categoria)}</div>
          ${desc ? `<div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#7B756A;padding-top:3px;">${desc}</div>` : ''}
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:10px;border-top:1px solid #E9E2D5;">
            <tr><td style="padding-top:9px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:21px;color:#55524B;">
              ${periodiDiversi(d) ? '' : `${chi}<br />`}
              ${cameraMista(c)
                ? `${(c.trattamento || '').toLowerCase()}${righeSoggiornanti(c, 'it')}`
                : `${(c.trattamento || '').toLowerCase()} &middot;
              <strong style="color:#0F5C64;">${c.totalePP.toLocaleString('it-IT',{minimumFractionDigits:2})} &euro; ${((c.adulti||0)+(c.bambini||0)) === 1 ? "per l'intero soggiorno" : etichettaPrezzoAdulti(c, 'it', 'a persona')}</strong>${rigaBambini(c, 'it')}${rigaExtraCamera(c, 'it')}
              ${periodiDiversi(d) ? '' : periodoCamera(c, 'it')}`}${totaleCameraRiga(c, d, 'it')}${notaPacchetto(c.trattamento, 'it')}
            </td></tr>
          </table>
        </td>
      </tr>
    </table>`;
  }).join('') + `<div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:19px;color:#A79E8F;padding:2px 0 4px 0;">${DOTAZIONE_IT}</div>`;
}

/* v2.1.4: con piu' camere il dettaglio veniva stampato in fondo e sembrava
   riferito all'ultima. Il titolo porta ora il nome della camera a cui
   appartiene — lo sa il riquadro "Notte per notte" che l'ha prodotto. */
function dettaglioSoggiorno(testo, titolo, camera) {
  if (camera) titolo = `${titolo} \u00b7 ${camera}`;
  if (!testo || !testo.trim()) return '';
  const righe = testo.split('\n').map(r => r.trim()).filter(Boolean);
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:6px;background-color:#FAF8F4;">
    <tr><td style="padding:14px 18px;">
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#8C8578;padding-bottom:8px;">${titolo}</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
        ${righe.map(r => {
          /* v1.9.8: se la riga finisce con un importo ("… · 565,00 €") lo si
             stacca a destra, cosi' il dettaglio si legge come una distinta e
             i conti si seguono a colpo d'occhio. Le righe di sconto in verde. */
          const m = r.match(/^(.*?)\s*[·:]\s*(&minus;\s*|-\s*|\u2212\s*)?([\d.]+,\d{2}\s*(?:&euro;|€))\s*$/);
          if (!m) return `<tr><td valign="top" width="14" style="padding:0 8px 5px 0;color:#B0A897;">&bull;</td><td valign="top" colspan="2" style="padding:0 0 5px 0;">${r}</td></tr>`;
          const meno = !!m[2], totale = /totale|gesamt|summe|total/i.test(m[1]);
          return `<tr>
            <td valign="top" width="14" style="padding:0 8px 5px 0;color:#B0A897;">${totale ? '' : '&bull;'}</td>
            <td valign="top" style="padding:0 0 5px 0;${totale ? 'padding-top:6px;border-top:1px solid #E9E2D5;color:#2A2E2B;' : ''}">${totale ? `<strong>${m[1]}</strong>` : m[1]}</td>
            <td valign="top" align="right" style="padding:0 0 5px 12px;white-space:nowrap;${totale ? 'padding-top:6px;border-top:1px solid #E9E2D5;' : ''}color:${meno ? '#5A7A3E' : '#2A2E2B'};"><strong>${meno ? '&minus;&nbsp;' : ''}${m[3]}</strong></td>
          </tr>`;
        }).join('')}
      </table>
    </td></tr></table>`;
}

function costruisciEmail(d, opzioni) {
  const o = opzioni || {};
  const arrivo    = dataIT(d.giornoArrivo, d.mese, d.anno);
  const partenza  = dataIT(d.giornoPartenza, d.mesePartenza || d.mese, d.annoPartenza || d.anno);
  const scad      = scadenzaIT(d.scadenza);
  const notti     = d.notti === 1 ? '1 notte' : `${d.notti} notti`;
  const ospiti    = descrizioneOspiti(d.adulti, d.bambini);
  const accPP     = Math.round(d.acconto / d.adulti);

  const blocchi = [];

  if (o.cure) blocchi.push(`
  <tr><td style="padding:22px 36px 0 36px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#E3F0F1;">
      <tr><td style="padding:18px 20px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:23px;color:#3C6266;">
        <strong style="color:#0F5C64;font-size:15px;">Le cure termali</strong><br />
        Con l'impegnativa del suo medico, il ticket di <strong style="color:#0F5C64;">55 &euro;</strong> copre visita medica, dodici fanghi e dodici bagni terapeutici.
        I turni sono al mattino, dalle 5:50 alle 10:30. La visita di ammissione si fa di norma la domenica pomeriggio.
      </td></tr>
    </table>
  </td></tr>`);

  if (o.fedelta) blocchi.push(`
  <tr><td style="padding:20px 36px 0 36px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F1F4EA;">
      <tr>
        <td width="6" style="background-color:#7A8450;font-size:0;line-height:0;">&nbsp;</td>
        <td style="padding:16px 20px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
          <strong style="color:#2A2E2B;">Siamo felici di rivederla</strong><br />
          Sul prezzo di pensione abbiamo applicato uno <strong style="color:#2A2E2B;">sconto del 5%</strong>.
          &Egrave; gi&agrave; conteggiato nel totale.
        </td>
      </tr>
    </table>
  </td></tr>`);

  if (o.promo) blocchi.push(`
  <tr><td style="padding:20px 36px 0 36px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#FDF3E7;">
      <tr>
        <td width="6" style="background-color:#E8751A;font-size:0;line-height:0;">&nbsp;</td>
        <td style="padding:16px 20px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
          <strong style="color:#2A2E2B;">3% per chi prenota e paga in anticipo il 2027</strong><br />
          Durante la chiusura invernale portiamo avanti i lavori dell'hotel anche grazie a chi
          sceglie di prenotare in anticipo. Per questo, se prenota un soggiorno del
          <strong style="color:#2A2E2B;">2027</strong> e ci fa pervenire l'intero importo con bonifico
          <strong style="color:#2A2E2B;">entro il 31 gennaio 2027</strong>, alla partenza le riconosciamo il
          <strong style="color:#2A2E2B;">3% sul prezzo di pensione</strong>.
          <br /><br />
          Fa fede la data di accredito sul nostro conto. L'importo
          <strong style="color:#2A2E2B;">non &egrave; compreso nel totale qui sopra</strong>: glielo consegniamo
          alla partenza, ed &egrave; calcolato sulla sola pensione &mdash; non su cure, trattamenti ed extra.
        </td>
      </tr>
    </table>
  </td></tr>`);

  if (o.cane) blocchi.push(`
  <tr><td style="padding:16px 36px 0 36px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F4F1E9;">
      <tr><td style="padding:16px 22px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
        &#128054; <strong style="color:#2A2E2B;">Anche il suo cane &egrave; il benvenuto</strong> &middot; 13 &euro; al giorno, da saldare in hotel; il cibo non &egrave; compreso.
        &Egrave; a suo agio in camera, nella hall e al Bistrot La Piazza &mdash; nelle aree comuni al guinzaglio. Non pu&ograve; invece accedere a piscine, parco e ristorante.
      </td></tr>
    </table>
  </td></tr>`);

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#EDE7DC;">
<tr><td align="center" style="padding:24px 12px 40px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background-color:#FFFFFF;">

  <tr><td align="center" style="padding:26px 36px 18px 36px;">
    <a href="https://www.hoteltermeleonardo.com" target="_blank" style="text-decoration:none;"><img src="https://www.termeleonardo.com/img/logo.png" alt="LEONARDO — TERME HOTEL ****" width="247" height="64" style="display:block;margin:0 auto;border:0;" /></a>
  </td></tr>

  <tr><td style="padding:0 36px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td width="46%" height="3" style="background-color:#1E7F88;font-size:0;line-height:0;">&nbsp;</td>
      <td width="4%" style="font-size:0;line-height:0;">&nbsp;</td>
      <td width="30%" height="3" style="background-color:#1E7F88;font-size:0;line-height:0;">&nbsp;</td>
      <td width="4%" style="font-size:0;line-height:0;">&nbsp;</td>
      <td width="16%" height="3" style="background-color:#8FC5C9;font-size:0;line-height:0;">&nbsp;</td>
    </tr></table>
  </td></tr>
  <tr><td align="right" style="padding:14px 36px 0 36px;">
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:1.5px;color:#A79E8F;">OFFERTA N. <strong style="color:#7B756A;">${d.numeroOfferta}</strong></div>
  </td></tr>

  <tr><td style="padding:16px 36px 0 36px;">
    <p style="margin:0 0 14px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:22px;color:#2A2E2B;">${saluto(d.intestatario, o.genere)},</p>
    <h1 style="margin:0 0 10px 0;font-family:Georgia,'Times New Roman',serif;font-size:25px;line-height:31px;font-weight:normal;color:#2A2E2B;">
      ${d.camere.length > 1 ? 'Le sue camere la aspettano' : 'La sua camera la aspetta'}${periodiDiversi(d) ? '' : `<br />dal ${arrivo} al ${partenza}`}
    </h1>
    <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
      ${periodiDiversi(d) ? `${ospiti} in ${d.camere.length} camere, con periodi diversi: li trova qui sotto accanto a ogni sistemazione. Le tratteniamo la disponibilit&agrave; fino al <strong style="color:#2A2E2B;">${scad}</strong>.` : `${notti} per ${ospiti}${d.camere.length > 1 ? ` in ${d.camere.length} camere` : ''}. Le tratteniamo la disponibilit&agrave; fino al <strong style="color:#2A2E2B;">${scad}</strong>.`}
    </p>
  </td></tr>

  <tr><td style="padding:16px 36px 0 36px;">
    ${bloccoCamere(ordinaCamere(d.camere), d)}
    ${dettaglioSoggiorno(o.dettaglio, 'Come si articola il suo soggiorno', o.dettaglioCamera)}
  </td></tr>

${blocchi.join('')}
  <tr><td style="padding:14px 36px 0 36px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#E3F0F1;">
      <tr>
        <td width="6" style="background-color:#1E7F88;font-size:0;line-height:0;">&nbsp;</td>
        <td style="padding:18px 20px 22px 22px;">
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#1E7F88;padding-bottom:6px;">Totale soggiorno</div>
          <div style="font-family:Georgia,'Times New Roman',serif;font-size:38px;line-height:44px;color:#0F5C64;">${d.totaleFmt} &euro;</div>
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:21px;color:#4A6E72;padding-top:4px;">
            per ${ospiti}${periodiDiversi(d) ? '' : `, ${notti}`} &middot; tassa di soggiorno esclusa
          </div>
${d.linkPagamento ? `          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:18px;"><tr>
            <td align="center" bgcolor="#E8751A" style="border-radius:4px;">
              <a href="${d.linkPagamento}" style="display:inline-block;padding:11px 26px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:#FFFFFF;text-decoration:none;line-height:18px;"><span style="color:#FFFFFF;text-decoration:none;">Conferma Ora</span></a>
            </td>
          </tr></table>
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:19px;color:#5C7F83;padding-top:12px;">
            Paga con carta in trenta secondi. Preferisce il bonifico? Trova l'IBAN qui sotto.
          </div>` : ``}
        </td>
      </tr>
    </table>
  </td></tr>

  <tr><td style="padding:22px 36px 0 36px;">
    <h2 style="margin:0 0 8px 0;font-family:Georgia,'Times New Roman',serif;font-size:17px;line-height:24px;font-weight:normal;color:#2A2E2B;">Come si conferma</h2>
    <p style="margin:0 0 12px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
      Serve un acconto di <strong style="color:#2A2E2B;">${d.accontoFmt} &euro;</strong> (${accPP} &euro; a persona).
      <strong style="color:#2A2E2B;">Viene detratto dal totale</strong>: non &egrave; un costo in pi&ugrave;, alla partenza pagher&agrave; ${d.saldoFmt} &euro;.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-left:2px solid #C8BFAE;"><tr><td style="padding:2px 0 2px 16px;">
${d.linkPagamento ? `      <p style="margin:0 0 9px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
        <strong style="color:#2A2E2B;">Con carta</strong>: usi il pulsante qui sopra. La conferma le arriva subito.
      </p>` : ``}
      <p style="margin:0 0 9px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
        <strong style="color:#2A2E2B;">Con bonifico</strong>: scelga il <strong style="color:#2A2E2B;">bonifico istantaneo</strong>, non quello ordinario: arriva in pochi secondi e le confermiamo la camera in giornata.
      </p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 12px 0;background-color:#F4F1E9;"><tr>
        <td style="padding:12px 16px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:21px;color:#55524B;">
          <span style="color:#8C8578;">Intestato a</span> ${INTESTAT}<br />
          <span style="color:#8C8578;">Banca</span> ${BANCA}<br />
          <span style="color:#8C8578;">IBAN</span> <strong style="color:#2A2E2B;">${IBAN}</strong><br />
          <span style="color:#8C8578;">BIC</span> ${BIC}<br />
          <span style="color:#8C8578;">Causale</span> ${d.numeroOfferta}
        </td>
      </tr></table>
      <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
        <strong style="color:#2A2E2B;">Entro il ${scad}</strong>: dopo quella data la camera torna disponibile.
      </p>
    </td></tr></table>
  </td></tr>

  <tr><td style="padding:20px 36px 0 36px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F4F1E9;"><tr><td style="padding:16px 20px;">
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#8C8578;padding-bottom:10px;">Se cambia programma</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:21px;color:#55524B;">
        <tr><td valign="top" width="14" style="padding:0 8px 8px 0;color:#B0A897;">&bull;</td><td valign="top" style="padding:0 0 8px 0;">L'acconto &egrave; una <strong style="color:#2A2E2B;">caparra confirmatoria</strong>: in caso di annullamento viene trattenuto.</td></tr>
        <tr><td valign="top" style="padding:0 8px 8px 0;color:#B0A897;">&bull;</td><td valign="top" style="padding:0 0 8px 0;">Da <strong style="color:#2A2E2B;">due giorni prima dell'arrivo</strong>, e in caso di <strong style="color:#2A2E2B;">mancato arrivo</strong>, viene addebitato il 100% delle prestazioni prenotate e non usufruite.</td></tr>
        <tr><td valign="top" style="padding:0 8px 8px 0;color:#B0A897;">&bull;</td><td valign="top" style="padding:0 0 8px 0;">Se parte prima o arriva dopo, il soggiorno resta addebitato per intero.</td></tr>
        <tr><td valign="top" style="padding:0 8px 0 0;color:#B0A897;">&bull;</td><td valign="top" style="padding:0;">Gli annullamenti valgono <strong style="color:#2A2E2B;">solo per iscritto</strong>: una email a info@termeleonardo.com.</td></tr>
      </table>
      <p style="margin:14px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:19px;color:#8C8578;">
        Con il versamento dell'acconto accetta queste condizioni. Trattandosi di un servizio alberghiero con data stabilita, non &egrave; previsto il diritto di recesso.
      </p>
    </td></tr></table>
  </td></tr>

  <tr><td style="padding:22px 36px 0 36px;">
    <h2 style="margin:0 0 12px 0;font-family:Georgia,'Times New Roman',serif;font-size:17px;line-height:24px;font-weight:normal;color:#2A2E2B;">Compreso nella tariffa</h2>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
      <tr>
        <td width="30" valign="top" style="padding:0 6px 12px 0;font-size:17px;line-height:22px;">&#9832;</td>
        <td valign="top" style="padding:0 0 12px 0;">
          <strong style="color:#2A2E2B;">Terme</strong><br />
          Le tre piscine termali, interna ed esterna, collegate tra loro &middot; una piscina con acqua termale fresca &middot; grotte con biosauna e bagno turco &middot; zona relax riservata agli adulti
        </td>
      </tr>
      <tr>
        <td valign="top" style="padding:0 6px 12px 0;font-size:17px;line-height:22px;">&#9749;</td>
        <td valign="top" style="padding:0 0 12px 0;">
          <strong style="color:#2A2E2B;">A tavola</strong><br />
          ${rigaATavola(d, 'it')}
        </td>
      </tr>
      <tr>
        <td valign="top" style="padding:0 6px 12px 0;font-size:17px;line-height:22px;">&#128716;</td>
        <td valign="top" style="padding:0 0 12px 0;">
          <strong style="color:#2A2E2B;">In camera</strong><br />
          Accappatoio e telo a persona &middot; Wi-Fi in fibra &middot; balcone
        </td>
      </tr>
      <tr>
        <td valign="top" style="padding:0 6px 0 0;font-size:17px;line-height:22px;">&#127939;</td>
        <td valign="top" style="padding:0;">
          <strong style="color:#2A2E2B;">Attivit&agrave;</strong><br />
          Palestra &middot; parco con vista sui Colli &middot; parcheggio gratuito &middot; green fee agevolato
        </td>
      </tr>
    </table>

    <p style="margin:14px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#8C8578;">
      Non inclusi: pranzo al Bistrot, bevande, trattamenti benessere, cure termali e transfer.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:16px;background-color:#E3F0F1;">
      <tr>
        <td width="6" style="background-color:#1E7F88;font-size:0;line-height:0;">&nbsp;</td>
        <td style="padding:14px 18px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:23px;color:#3C6266;">
          <strong style="color:#0F5C64;">Faccia il check-in online prima dell'arrivo.</strong>
          Le piscine sono sue gi&agrave; <strong style="color:#0F5C64;">dalle 11:30</strong>, senza aspettare le 15:00 della camera.
        </td>
      </tr>
    </table>
  </td></tr>

  <tr><td style="padding:22px 36px 0 36px;">
    <h2 style="margin:0 0 6px 0;font-family:Georgia,'Times New Roman',serif;font-size:17px;line-height:24px;font-weight:normal;color:#2A2E2B;">Vuole aggiungere qualcosa?</h2>
    <p style="margin:0 0 12px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#7B756A;">Ce lo scriva rispondendo a questa email.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td style="padding:12px 16px;background-color:#FAF8F4;border-left:3px solid #7A8450;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
        <strong style="color:#2A2E2B;">Massaggio antistress</strong> &middot; 55 &euro; (45 minuti)<br /><span style="color:#7B756A;font-size:13px;">Il pi&ugrave; richiesto. Gli orari si esauriscono presto</span><br /><a href="https://www.termeleonardo.com/pdf/listino-spa-trattamenti-e-massaggi-hotel-leonardo-da-vinci-terme.pdf" target="_blank" style="color:#0F5C64;font-size:13px;text-decoration:underline;">Scarichi il listino completo di trattamenti e massaggi (PDF)</a>${bottoneServizio('trattamenti', d, 'it')}
      </td></tr>
      <tr><td height="8" style="font-size:0;line-height:0;">&nbsp;</td></tr>
      <tr><td style="padding:12px 16px;background-color:#FAF8F4;border-left:3px solid #7A8450;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
        <strong style="color:#2A2E2B;">Transfer dall'aeroporto</strong> &middot; Venezia, navetta da 65 &euro;<br /><span style="color:#7B756A;font-size:13px;">Va prenotato almeno 24 ore prima. Ci dica volo e orario</span>${bottoneServizio('transfer', d, 'it')}
      </td></tr>
      <tr><td height="8" style="font-size:0;line-height:0;">&nbsp;</td></tr>
      <tr><td style="padding:12px 16px;background-color:#FAF8F4;border-left:3px solid #7A8450;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
        <strong style="color:#2A2E2B;">Si goda le terme fino all'ultimo</strong> &middot; piscine anche il giorno della partenza, fino alle 18:30 &middot; <span style="color:#7B756A;font-size:13px;">30 &euro; a persona, tariffa riservata ai nostri ospiti. Spogliatoi inclusi</span>
      </td></tr>
    </table>
  </td></tr>
  <tr><td style="padding:22px 36px 0 36px;">
    <h2 style="margin:0 0 10px 0;font-family:Georgia,'Times New Roman',serif;font-size:17px;line-height:24px;font-weight:normal;color:#2A2E2B;">Da sapere</h2>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">
      <tr><td width="130" valign="top" style="padding:0 12px 10px 0;color:#8C8578;">Check-in</td><td valign="top" style="padding:0 0 10px 0;">Dalle 15:00 &middot; check-out entro le 11:00</td></tr>
      <tr><td valign="top" style="padding:0 12px 10px 0;color:#8C8578;">Tassa di soggiorno</td><td valign="top" style="padding:0 0 10px 0;">1,50 &euro; a persona al giorno, per un massimo di 7 notti. Si salda in hotel. Esenti i bambini fino a 13 anni e le persone con disabilit&agrave;</td></tr>
      <tr><td valign="top" style="padding:0 12px 0 0;color:#8C8578;">Piscine</td><td valign="top" style="padding:0;">Aperte dalle 8:00 alle 19:30, il venerd&igrave; e il sabato fino alle 22:30 &middot; cuffia obbligatoria, in vendita in Reception a 3 &euro;</td></tr>
      <tr><td valign="top" style="padding:8px 12px 0 0;color:#8C8578;">Fumo</td><td valign="top" style="padding:8px 0 0 0;">Hotel per non fumatori: in camera non si fuma, sul balcone s&igrave;</td></tr>
    </table>
  </td></tr>

  <tr><td style="padding:22px 36px 0 36px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td height="1" style="background-color:#E4DED2;font-size:0;line-height:0;">&nbsp;</td></tr></table>
    <p style="margin:16px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">Per qualsiasi cosa risponda pure a questa email, oppure ci chiami: siamo qui tutti i giorni.</p>
    <p style="margin:16px 0 0 0;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:24px;color:#2A2E2B;">
      ${o.firma || 'La Reception'}<br />
      <span style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#8C8578;">Ufficio prenotazioni</span>
    </p>
    <p style="margin:14px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:23px;color:#55524B;">
      +39 049 9939 200 &nbsp;&middot;&nbsp; info@termeleonardo.com
    </p>
  </td></tr>

  <tr><td align="center" style="padding:20px 36px 0 36px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="padding:9px 16px;background-color:#F1F4EA;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:19px;color:#5F6B44;">${typeof bloccoCertificazioni === 'function' ? bloccoCertificazioni() : ''}
        <strong style="color:#4A5636;">Primo hotel termale in Europa</strong> certificato <strong style="color:#4A5636;">GSTC Hotel Standard</strong> per la sostenibilit&agrave; &middot; ente certificatore Vireo Srl
      </td>
    </tr></table>
  </td></tr>

  <tr><td align="center" style="padding:20px 36px 26px 36px;">
    <div style="font-family:Georgia,'Times New Roman',serif;font-size:15px;letter-spacing:5px;color:#2A2E2B;">TERME LEONARDO</div>
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:20px;color:#8C8578;padding-top:10px;">
      Via Monteortone 46 &middot; 35037 Monteortone di Teolo (PD) &middot; <a href="https://www.hoteltermeleonardo.com" target="_blank" style="color:#8C8578;text-decoration:underline;">hoteltermeleonardo.com</a>
    </div>
  </td></tr>

</table>
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;">
  <tr><td align="center" style="padding:14px 36px 0 36px;font-family:Arial,Helvetica,sans-serif;font-size:10px;line-height:17px;color:#A79E8F;">
    Tria S.r.l. &middot; P.IVA IT 02042330288 &middot; CIN IT028089A18QYO48ED
  </td></tr>
</table>
</td></tr>
</table>`;
}

function oggetto(d) {
  const arrivo = dataIT(d.giornoArrivo, d.mese, d.anno);
  return `La sua proposta di soggiorno dal ${arrivo} — Hotel Terme Leonardo`;
}
