/* trattamenti.js — l'unico elenco dei trattamenti del reparto benessere.

   PERCHE' QUESTO MODULO ESISTE. La stessa lista viveva gia' in tre posti
   (il modulo delle richieste, il catalogo dei buoni regalo nel back office,
   quello della pagina d'acquisto) ed erano gia' divergenti: nomi diversi
   per le stesse voci, la reception che riceve una richiesta e deve
   indovinare a quale voce del listino corrisponde. Un quarto elenco scritto
   a mano dentro richieste/index.html avrebbe reso la cosa peggiore, non
   uguale. Questo modulo e' la fonte sola per chi sceglie un trattamento
   fuori dal circuito dei buoni regalo (oggi solo richieste/index.html).

   I DATI vengono da docs/anteprime/2026-08-15-menu-trattamenti.html,
   l'anteprima cliccabile che la proprieta' ha approvato il 15 agosto 2026:
   i 36 trattamenti, i gruppi, i nove segnati col cuore, le spiegazioni
   della ⓘ. Quel testo e' confermato e non va riscritto.

   REGALABILE. Il catalogo dei buoni regalo (supabase/functions/buoni/
   acquista.ts, `LISTINO`) resta la sola fonte per i PREZZI dei buoni: qui
   non si duplica quel calcolo, si registra solo QUALE id del listino buoni
   corrisponde a quale voce di questo elenco, per chi deve confrontare le
   due liste (vedi trattamenti.test.ts). `regalabile: null` vuol dire che
   quella voce non si puo' regalare — non che manca un dato.

   Import ASSOLUTO: `/comune/trattamenti.js`, mai un percorso relativo. Le
   pagine sono servite sotto un indirizzo riscritto (es. /it/trattamenti) e
   un percorso relativo si risolve contro QUELLO, non contro la cartella del
   file — vedi il commento in comune/date.js per il difetto gia' pagato tre
   volte in questo progetto. */

/* Ordine di visualizzazione dei quattro gruppi veri. "I piu' richiesti" non
   e' un quinto gruppo di dati: e' un filtro sul campo `cuore` qui sotto, e
   chi disegna la pagina lo costruisce da solo — cosi' le nove voci con
   cuore non sono scritte due volte in due punti che potrebbero divergere. */
export const ORDINE_GRUPPI = ['programmi', 'massaggi', 'viso', 'corpo'];

/* Ogni voce: nome (SEMPRE in italiano, vedi la nota sotto), durata ('' se
   il trattamento non ne mostra una — i programmi e le voci "da"), prezzo in
   euro, gruppo (uno dei quattro sopra), chiave della spiegazione nella ⓘ
   ('' se quella voce non ne ha una), da (true se il prezzo e' un "da" —
   manicure, pedicure, epilazione: il prezzo dipende da quanto serve),
   cuore (true per le nove piu' richieste, segnate cosi' sul listino
   stampato), regalabile (l'id in LISTINO di acquista.ts, o null). */
export const TRATTAMENTI = [
  /* ---- Programmi benessere (5) ----
     Il LISTINO dei buoni regalo aggiunge a ogni programma una descrizione
     promozionale dopo una lineetta ("— pulizia viso completa + manicure"):
     e' testo pensato per il buono stampato, non il nome del trattamento.
     trattamenti.test.ts lo sa e lo confronta al netto di quella lineetta. */
  { nome: 'Programma Coccola', durata: '', prezzo: 90, gruppo: 'programmi', chiave: 'progCoccola', da: false, cuore: true, regalabile: 'progCoccola' },
  { nome: 'Programma Viso Termale', durata: '', prezzo: 95, gruppo: 'programmi', chiave: 'progTermale', da: false, cuore: true, regalabile: 'progTermale' },
  { nome: 'Programma Viso Antirughe', durata: '', prezzo: 90, gruppo: 'programmi', chiave: 'progViso', da: false, cuore: true, regalabile: 'progViso' },
  { nome: 'Programma Oriente', durata: '', prezzo: 130, gruppo: 'programmi', chiave: 'progOriente', da: false, cuore: true, regalabile: 'progOriente' },
  { nome: 'Programma Antistress', durata: '', prezzo: 130, gruppo: 'programmi', chiave: 'progAnti', da: false, cuore: true, regalabile: 'progAntistress' },

  /* ---- Massaggi corpo (17) ---- */
  { nome: 'Massaggio Relax (con olio di cacao)', durata: '25 min', prezzo: 40, gruppo: 'massaggi', chiave: 'cacao', da: false, cuore: true, regalabile: 'relax25' },
  { nome: 'Massaggio nutriente al burro', durata: '25 min', prezzo: 40, gruppo: 'massaggi', chiave: 'burro', da: false, cuore: false, regalabile: null },
  { nome: 'Massaggio riflessologia plantare', durata: '25 min', prezzo: 40, gruppo: 'massaggi', chiave: 'plantare', da: false, cuore: false, regalabile: 'plantare25' },
  { nome: 'Linfodrenaggio viso', durata: '25 min', prezzo: 40, gruppo: 'massaggi', chiave: 'linfoviso', da: false, cuore: false, regalabile: null },
  { nome: 'Massaggio tonificante con oli essenziali', durata: '25 min', prezzo: 45, gruppo: 'massaggi', chiave: 'tonificante', da: false, cuore: false, regalabile: null },
  { nome: 'Massaggio Body Candle', durata: '25 min', prezzo: 48, gruppo: 'massaggi', chiave: 'candle', da: false, cuore: false, regalabile: 'candle25' },
  { nome: 'Massaggio antistress', durata: '45 min', prezzo: 55, gruppo: 'massaggi', chiave: 'antistress', da: false, cuore: false, regalabile: 'antistress45' },
  { nome: 'Massaggio anticellulite con fiala', durata: '40 min', prezzo: 60, gruppo: 'massaggi', chiave: 'fiala', da: false, cuore: false, regalabile: null },
  { nome: 'Massaggio californiano', durata: '50 min', prezzo: 60, gruppo: 'massaggi', chiave: 'californiano', da: false, cuore: false, regalabile: 'californiano50' },
  { nome: 'Massaggio Ayurveda', durata: '55 min', prezzo: 65, gruppo: 'massaggi', chiave: 'ayurveda', da: false, cuore: false, regalabile: 'ayurveda55' },
  { nome: 'Massaggio Pindasweda', durata: '55 min', prezzo: 65, gruppo: 'massaggi', chiave: 'pindasweda', da: false, cuore: false, regalabile: 'pindasweda55' },
  { nome: 'Massaggio antistress', durata: '55 min', prezzo: 65, gruppo: 'massaggi', chiave: 'antistress', da: false, cuore: false, regalabile: null },
  { nome: 'Massaggio “Hot Stone”', durata: '55 min', prezzo: 65, gruppo: 'massaggi', chiave: 'hotstone', da: false, cuore: false, regalabile: 'hotstone55' },
  { nome: 'Linfodrenaggio completo', durata: '60 min', prezzo: 65, gruppo: 'massaggi', chiave: 'linfo', da: false, cuore: false, regalabile: 'linfo60' },
  { nome: 'Massaggio anticellulite con fiala', durata: '50 min', prezzo: 70, gruppo: 'massaggi', chiave: 'fiala', da: false, cuore: false, regalabile: null },
  { nome: 'Massaggio Shiatzu', durata: '50 min', prezzo: 70, gruppo: 'massaggi', chiave: 'shiatzu', da: false, cuore: true, regalabile: 'shiatzu50' },
  { nome: 'Linfodrenaggio parziale', durata: '30 min', prezzo: 40, gruppo: 'massaggi', chiave: 'linfo', da: false, cuore: false, regalabile: null },

  /* ---- Trattamenti viso (5) ---- */
  { nome: 'Trattamento viso al fango termale con massaggio', durata: '25 min', prezzo: 44, gruppo: 'viso', chiave: 'visofango', da: false, cuore: false, regalabile: 'visofango25' },
  { nome: 'Pulizia viso completa con peeling e maschera', durata: '55 min', prezzo: 60, gruppo: 'viso', chiave: 'pulizia', da: false, cuore: false, regalabile: 'pulizia55' },
  { nome: 'Trattamento anti-age all’acido ialuronico', durata: '55 min', prezzo: 80, gruppo: 'viso', chiave: 'ialuronico', da: false, cuore: false, regalabile: 'ialuronico55' },
  { nome: 'Trattamento bio-vitaminico alla vitamina C', durata: '55 min', prezzo: 80, gruppo: 'viso', chiave: 'vitaminac', da: false, cuore: false, regalabile: null },
  { nome: 'Trattamento anti-age collagene naturale', durata: '55 min', prezzo: 80, gruppo: 'viso', chiave: 'collagene', da: false, cuore: false, regalabile: 'collagene55' },

  /* ---- Trattamenti corpo (9) ---- */
  { nome: 'Scrub corpo al lime', durata: '40 min', prezzo: 50, gruppo: 'corpo', chiave: 'scrublime', da: false, cuore: false, regalabile: null },
  { nome: 'Scrub corpo ai sali del Mar Morto', durata: '40 min', prezzo: 55, gruppo: 'corpo', chiave: 'scrubmar', da: false, cuore: false, regalabile: 'scrubmar40' },
  { nome: 'Trattamento seno gommage e maschera', durata: '40 min', prezzo: 60, gruppo: 'corpo', chiave: 'seno', da: false, cuore: false, regalabile: null },
  { nome: 'Trattamento anti-age a base di zucchero levigante e massaggio', durata: '55 min', prezzo: 65, gruppo: 'corpo', chiave: 'zucchero', da: false, cuore: false, regalabile: null },
  { nome: 'Trattamento riducente-anticellulite al fango', durata: '55 min', prezzo: 70, gruppo: 'corpo', chiave: 'riducente', da: false, cuore: false, regalabile: 'riducente55' },
  { nome: 'Epilazione parziale (ascelle o inguine)', durata: '', prezzo: 35, gruppo: 'corpo', chiave: '', da: true, cuore: false, regalabile: null },
  { nome: 'Epilazione completa', durata: '', prezzo: 60, gruppo: 'corpo', chiave: '', da: true, cuore: false, regalabile: null },
  { nome: 'Manicure', durata: '', prezzo: 30, gruppo: 'corpo', chiave: '', da: true, cuore: true, regalabile: null },
  { nome: 'Pedicure', durata: '', prezzo: 40, gruppo: 'corpo', chiave: '', da: true, cuore: true, regalabile: null },
];

/* Il nome cosi' come sta nel listino, pronto da ricopiare in reception:
   nome e basta se non c'e' una durata, altrimenti "nome (durata)". E' la
   stessa regola che usa il LISTINO dei buoni per le voci non-programma —
   ed e' per questo che trattamenti.test.ts puo' confrontarle. */
export function nomeCompleto(voce) {
  return voce.durata ? `${voce.nome} (${voce.durata})` : voce.nome;
}

/* Il prezzo per esteso, col "da" quando il prezzo e' un minimo (manicure,
   pedicure, epilazione: il costo vero dipende da quanto serve davvero). */
export function prezzoTesto(voce) {
  return (voce.da ? 'da ' : '') + voce.prezzo + ' €';
}

/* ============================================================
   LE SPIEGAZIONI DELLA ⓘ — testo confermato dalla proprieta' il 15 agosto
   2026, in italiano nell'anteprima. Le altre tre lingue sono traduzioni di
   questo testo, non spiegazioni nuove: stessa regola dell'originale —
   descrivono cosa succede sul lettino, non cosa promettono di fare, perche'
   un trattamento estetico che promette effetti terapeutici e' una promessa
   che l'hotel non puo' mantenere. Vanno lette dal reparto benessere prima
   di andare online (decisione scritta nella specifica).
   ============================================================ */
export const SPIEGAZIONI = {
  it: {
    antistress: 'Pressioni lente su schiena, collo e spalle, dove la tensione si accumula.',
    cacao: 'Movimenti avvolgenti con olio tiepido al cacao. Il più breve: sta bene dopo le piscine.',
    ayurveda: 'Tecnica indiana con olio caldo e movimenti lunghi e continui, su tutto il corpo.',
    californiano: 'Movimenti ampi, lenti e continui, senza pressioni forti. Il più dolce dei nostri.',
    hotstone: 'Pietre laviche calde appoggiate sulla schiena e fatte scorrere: il calore fa il lavoro.',
    pindasweda: 'Tamponi di erbe caldi, picchiettati e fatti scorrere sul corpo.',
    shiatzu: 'Pressioni con i pollici lungo linee precise. Si riceve vestiti, senza olio.',
    candle: 'Cera di una candela vegetale, sciolta a bassa temperatura e usata come olio.',
    plantare: 'Pressioni su punti precisi della pianta del piede.',
    linfo: 'Movimenti molto leggeri e ritmici, nel verso della circolazione linfatica.',
    linfoviso: 'Lo stesso tocco leggero del linfodrenaggio, sul viso e sul collo.',
    tonificante: 'Manovre più vivaci, con oli essenziali scelti insieme all’operatore.',
    burro: 'Burro vegetale tiepido al posto dell’olio: più denso, per la pelle secca.',
    fiala: 'Manovre di rimodellamento su gambe e fianchi, con una fiala concentrata.',
    visofango: 'Il fango delle nostre vasche, maturato, sul viso, seguito da un massaggio.',
    pulizia: 'Peeling, estrazione e maschera. È la base, prima di qualunque altro viso.',
    ialuronico: 'Trattamento rimpolpante all’acido ialuronico.',
    vitaminac: 'Trattamento illuminante alla vitamina C.',
    collagene: 'Maschera in foglio al collagene naturale.',
    scrublime: 'Esfoliante agli agrumi: leggero e profumato.',
    scrubmar: 'Sali del Mar Morto, granulosi: levigano e preparano la pelle.',
    seno: 'Gommage e maschera specifici per il décolleté.',
    zucchero: 'Zucchero levigante, seguito da massaggio.',
    riducente: 'Fango termale su gambe e addome, con manovre rimodellanti.',
    progCoccola: 'Due trattamenti in una volta: pulizia viso completa e manicure.',
    progViso: 'Pulizia viso completa seguita dal trattamento al collagene.',
    progTermale: 'Pulizia viso e trattamento con il nostro fango termale.',
    progAnti: 'Tre passaggi: scrub ai sali del Mar Morto, massaggio antistress, viso al fango.',
    progOriente: 'Massaggio Ayurveda e trattamento viso alla vitamina C.',
  },
  de: {
    antistress: 'Langsamer Druck auf Rücken, Nacken und Schultern, wo sich Verspannungen ansammeln.',
    cacao: 'Umhüllende Bewegungen mit lauwarmem Kakaoöl. Die kürzeste Anwendung: passt gut nach dem Schwimmen.',
    ayurveda: 'Indische Technik mit warmem Öl und langen, fließenden Bewegungen über den ganzen Körper.',
    californiano: 'Weite, langsame und fließende Bewegungen, ohne starken Druck. Die sanfteste unserer Massagen.',
    hotstone: 'Heiße Lavasteine, auf dem Rücken aufgelegt und geführt: die Wärme übernimmt die Arbeit.',
    pindasweda: 'Warme Kräuterstempel, die geklopft und über den Körper geführt werden.',
    shiatzu: 'Druck mit den Daumen entlang bestimmter Linien. Man bleibt bekleidet, ohne Öl.',
    candle: 'Wachs einer pflanzlichen Kerze, bei niedriger Temperatur geschmolzen und wie Öl verwendet.',
    plantare: 'Druck auf bestimmte Punkte der Fußsohle.',
    linfo: 'Sehr leichte, rhythmische Bewegungen in Richtung des Lymphflusses.',
    linfoviso: 'Dieselbe leichte Berührung wie bei der Lymphdrainage, auf Gesicht und Hals.',
    tonificante: 'Lebhaftere Griffe, mit ätherischen Ölen, die gemeinsam mit der Therapeutin ausgewählt werden.',
    burro: 'Lauwarme pflanzliche Butter statt Öl: dichter, für trockene Haut.',
    fiala: 'Modellierende Griffe an Beinen und Hüften, mit einer konzentrierten Ampulle.',
    visofango: 'Der gereifte Schlamm aus unseren Becken, auf dem Gesicht, gefolgt von einer Massage.',
    pulizia: 'Peeling, Ausreinigung und Maske. Die Basis, vor jeder anderen Gesichtsbehandlung.',
    ialuronico: 'Aufpolsternde Behandlung mit Hyaluronsäure.',
    vitaminac: 'Aufhellende Behandlung mit Vitamin C.',
    collagene: 'Tuchmaske mit natürlichem Kollagen.',
    scrublime: 'Peeling mit Zitrusfrüchten: leicht und duftend.',
    scrubmar: 'Grobkörniges Salz aus dem Toten Meer: glättet und bereitet die Haut vor.',
    seno: 'Gommage und Maske speziell für das Dekolleté.',
    zucchero: 'Glättendes Zucker-Peeling, gefolgt von einer Massage.',
    riducente: 'Thermalschlamm auf Beinen und Bauch, mit formenden Griffen.',
    progCoccola: 'Zwei Anwendungen auf einmal: komplette Gesichtsreinigung und Maniküre.',
    progViso: 'Komplette Gesichtsreinigung gefolgt von der Kollagen-Behandlung.',
    progTermale: 'Gesichtsreinigung und Behandlung mit unserem Thermalschlamm.',
    progAnti: 'Drei Schritte: Peeling mit Salz aus dem Toten Meer, Antistress-Massage, Gesicht mit Schlamm.',
    progOriente: 'Ayurveda-Massage und Gesichtsbehandlung mit Vitamin C.',
  },
  en: {
    antistress: 'Slow pressure on the back, neck and shoulders, where tension builds up.',
    cacao: 'Enveloping movements with warm cocoa oil. Our shortest massage: perfect after the pools.',
    ayurveda: 'Indian technique with warm oil and long, continuous movements over the whole body.',
    californiano: 'Broad, slow, continuous movements, without strong pressure. The gentlest of our massages.',
    hotstone: 'Hot volcanic stones placed on the back and glided over it: the heat does the work.',
    pindasweda: 'Warm herbal pouches, tapped and glided over the body.',
    shiatzu: 'Thumb pressure along precise lines. Received fully clothed, without oil.',
    candle: 'Wax from a plant-based candle, melted at low temperature and used like oil.',
    plantare: 'Pressure on precise points on the sole of the foot.',
    linfo: 'Very light, rhythmic movements, following the direction of lymphatic flow.',
    linfoviso: 'The same light touch as lymphatic drainage, on the face and neck.',
    tonificante: 'Livelier strokes, with essential oils chosen together with the therapist.',
    burro: 'Warm vegetable butter instead of oil: thicker, for dry skin.',
    fiala: 'Reshaping strokes on legs and hips, with a concentrated ampoule.',
    visofango: 'The matured mud from our pools, on the face, followed by a massage.',
    pulizia: 'Peeling, extraction and mask. The foundation, before any other facial.',
    ialuronico: 'Plumping treatment with hyaluronic acid.',
    vitaminac: 'Brightening treatment with vitamin C.',
    collagene: 'Sheet mask with natural collagen.',
    scrublime: 'Citrus scrub: light and fragrant.',
    scrubmar: 'Coarse Dead Sea salts: smooth and prepare the skin.',
    seno: 'Gommage and mask specific to the décolleté.',
    zucchero: 'Smoothing sugar scrub, followed by a massage.',
    riducente: 'Thermal mud on legs and abdomen, with reshaping strokes.',
    progCoccola: 'Two treatments at once: full facial cleansing and a manicure.',
    progViso: 'Full facial cleansing followed by the collagen treatment.',
    progTermale: 'Facial cleansing and treatment with our thermal mud.',
    progAnti: 'Three steps: Dead Sea salt scrub, antistress massage, mud facial.',
    progOriente: 'Ayurvedic massage and vitamin C facial treatment.',
  },
  fr: {
    antistress: 'Pressions lentes sur le dos, la nuque et les épaules, là où les tensions s’accumulent.',
    cacao: 'Mouvements enveloppants à l’huile de cacao tiède. Le plus court : parfait après les piscines.',
    ayurveda: 'Technique indienne à l’huile chaude, mouvements longs et continus sur tout le corps.',
    californiano: 'Mouvements amples, lents et continus, sans pression forte. Le plus doux de nos massages.',
    hotstone: 'Pierres volcaniques chaudes posées sur le dos et glissées : c’est la chaleur qui agit.',
    pindasweda: 'Pochons d’herbes chauds, tamponnés et glissés sur le corps.',
    shiatzu: 'Pressions des pouces le long de lignes précises. Se reçoit habillé, sans huile.',
    candle: 'Cire d’une bougie végétale, fondue à basse température et utilisée comme une huile.',
    plantare: 'Pressions sur des points précis de la plante du pied.',
    linfo: 'Mouvements très légers et rythmés, dans le sens de la circulation lymphatique.',
    linfoviso: 'Le même toucher léger que le drainage lymphatique, sur le visage et le cou.',
    tonificante: 'Manœuvres plus toniques, avec des huiles essentielles choisies avec la praticienne.',
    burro: 'Beurre végétal tiède à la place de l’huile : plus dense, pour les peaux sèches.',
    fiala: 'Manœuvres remodelantes sur les jambes et les hanches, avec une ampoule concentrée.',
    visofango: 'La boue de nos bassins, maturée, sur le visage, suivie d’un massage.',
    pulizia: 'Gommage, extraction et masque. La base, avant tout autre soin du visage.',
    ialuronico: 'Soin repulpant à l’acide hyaluronique.',
    vitaminac: 'Soin illuminateur à la vitamine C.',
    collagene: 'Masque en tissu au collagène naturel.',
    scrublime: 'Gommage aux agrumes : léger et parfumé.',
    scrubmar: 'Sels de la mer Morte, granuleux : lissent et préparent la peau.',
    seno: 'Gommage et masque spécifiques pour le décolleté.',
    zucchero: 'Gommage lissant au sucre, suivi d’un massage.',
    riducente: 'Boue thermale sur les jambes et l’abdomen, avec des manœuvres remodelantes.',
    progCoccola: 'Deux soins en un seul : nettoyage du visage complet et manucure.',
    progViso: 'Nettoyage du visage complet suivi du soin au collagène.',
    progTermale: 'Nettoyage du visage et soin à notre boue thermale.',
    progAnti: 'Trois étapes : gommage aux sels de la mer Morte, massage antistress, visage à la boue.',
    progOriente: 'Massage ayurvédique et soin du visage à la vitamine C.',
  },
};
