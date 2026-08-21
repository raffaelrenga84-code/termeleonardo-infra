/* Test del lettore delle richieste di transfer.
   La mail tedesca e' quella vera di Edith Gutbrecht del 20 agosto 2026.
   Esegui:  node test-transfer.js                                        */
const { JSDOM } = require('jsdom');
const fs = require('fs');

const dom = new JSDOM('<body><div role="main"></div></body>',
  { pretendToBeVisual: true, runScripts: 'outside-only' });
const win = dom.window;
win.setInterval = () => 0;          // niente ciclo di sorveglianza nei test
win.eval(fs.readFileSync(__dirname + '/outlook-transfer.js', 'utf8'));
const T = win.__leonardoTransfer;

let falliti = 0;
const ok = (nome, cond, extra) => {
  console.log((cond ? '  \x1b[32mOK\x1b[0m  ' : '  \x1b[31mKO\x1b[0m  ') + nome +
              (!cond && extra !== undefined ? '   → ' + JSON.stringify(extra) : ''));
  if (!cond) falliti++;
};

/* ---------------- la mail vera ---------------- */
const TEDESCA = `Buon Giorno liebe Elena,

 ich möchte Sie bitten,  für den 28.08.26 ein Taxi für 3 Personen mit Gepäck vom Flughafen Venedig Marco Polo
zum Hotel Terme LEONARDO in Monteortone zu organisieren.
Voraussichtliche Ankunft 10:25 Uhr  FLUG: Condor DE 4237
Urlaub vom 28.08.- 06.09.26.
TN:  Edith Gutbrecht, Felix Schneider,,Klara Marquardt
Wir freuen uns auf den Urlaub
Vielen Dank, bis bald.

Mit lieben Grüßen
EDITH GTBRECHT`;

console.log('\n— la mail tedesca di Edith Gutbrecht —');
const r = T.leggiRichiesta(TEDESCA);
ok('riconosce che e\' una richiesta di transfer', !!r);
ok('legge le 3 persone', r.pax === 3, r.pax);
ok('legge l\'ora di arrivo 10:25', r.ora === '10:25', r.ora);
ok('capisce che e\' un arrivo, non una partenza', r.verso === 'arrivo', r.verso);
ok('mappa «Flughafen Venedig Marco Polo» sulla voce dei tassisti',
   r.luogo === 'Venezia  aeroporto', r.luogo);
ok('legge il volo Condor DE 4237', /DE\s*4237/.test(r.volo || ''), r.volo);
ok('legge i tre passeggeri e ripulisce la doppia virgola',
   r.nomi === 'Edith Gutbrecht, Felix Schneider, Klara Marquardt', r.nomi);

console.log('\n— l\'ora: il caso vero del 20 agosto 2026 —');
/* Nel riquadro di lettura di Outlook, prima del corpo della mail c'e'
   l'elenco dei messaggi con i suoi orari. Lo script leggeva 19:13 —
   l'ora di arrivo della posta — al posto di 10:25. */
const CON_ELENCO = `18:54  GUTBRECHT  Angebot 026/187572
19:13  Renga  Re: prenotazione
` + TEDESCA;
ok('ignora gli orari dell\'elenco messaggi',
   T.trovaOra(CON_ELENCO) === '10:25', T.trovaOra(CON_ELENCO));
ok('«Ankunft 10:25» viene letto anche senza Uhr',
   T.trovaOra('Voraussichtliche Ankunft 10.25') === '10:25');
ok('«ore 14:30» in italiano', T.trovaOra('arrivo previsto ore 14:30') === '14:30');
ok('«um 08:05 Uhr» in tedesco', T.trovaOra('Abfahrt um 08:05 Uhr') === '08:05');
ok('un solo orario nudo si accetta', T.trovaOra('taxi il 3/9 verso le 16:40') === '16:40');
ok('due orari nudi e nessuno dichiarato: non sceglie',
   T.trovaOra('fra le 16:40 e le 17:10 va bene') === null,
   T.trovaOra('fra le 16:40 e le 17:10 va bene'));
ok('«28.08.26» resta una data, non le 08:26',
   T.trovaOra('per il 28.08.26 un taxi') === null, T.trovaOra('per il 28.08.26 un taxi'));

console.log('\n— le due date: la trappola —');
ok('trova sia il 28.08 sia il 06.09', r.date.length === 2,
   r.date.map(d => `${d.g}/${d.m}/${d.a}`));
/* Il 06.09 non e' mai stato un candidato: sta dentro «Urlaub vom 28.08.-
   06.09.26», e per quel giorno la mail non da' ne' ora ne' luogo perche'
   il ritorno non lo stanno chiedendo. Un transfer di ritorno sarebbe
   comunque una prenotazione ATAM a parte. */
ok('sceglie il 28 agosto', r.data && r.data.g === 28 && r.data.m === 8, r.data);
ok('il 6 settembre e\' etichettato come soggiorno',
   r.dateSoggiorno.length === 1 && r.dateSoggiorno[0].g === 6, r.dateSoggiorno);
ok('resta una sola data in gara: niente scelta da fare',
   r.dateInGara.length === 1, r.dateInGara.map(d => d.g));
ok('la data di soggiorno non ha un\'ora accanto', T.haOraVicina(r.dateSoggiorno[0]) === false);

/* ma se il testo non aiuta a distinguere, non si inventa niente */
const ambigua = T.leggiRichiesta(
  'Serve un taxi il 10/09/2026 e un altro taxi il 15/09/2026, ' +
  'dall\'aeroporto di Venezia. Grazie');
ok('con due date entrambe accanto a «taxi» non sceglie',
   ambigua.data === null && ambigua.dateInGara.length === 2, ambigua.data);

/* fra due candidate senza parola risolutiva, vince quella con un'ora */
const conOra = T.leggiRichiesta(
  'Transfer dall\'aeroporto di Venezia. Prenotazione confermata il 02/09/2026. ' +
  'Vi aspettiamo il 12/09/2026 alle 15:20.');
ok('a parita\' di indizi vince la data con l\'ora accanto',
   conOra.data && conOra.data.g === 12, conOra.data);

/* il soggiorno in italiano */
const ita = T.leggiRichiesta(
  'Buongiorno, vorremmo un taxi il 03/10/2026 alle 11:00 dall\'aeroporto di Venezia. ' +
  'Il nostro soggiorno va dal 03/10/2026 al 10/10/2026.');
ok('«soggiorno dal … al …» riconosciuto anche in italiano',
   ita.dateSoggiorno.length === 1 && ita.dateSoggiorno[0].g === 10, ita.dateSoggiorno);
ok('e la corsa resta il 3 ottobre', ita.data && ita.data.g === 3, ita.data);
ok('mostra il contesto di ogni data, per far scegliere',
   r.date.every(d => d.contesto && d.contesto.length > 5),
   r.date.map(d => d.contesto));
ok('la prima data e\' il 28 agosto 2026',
   r.date[0].g === 28 && r.date[0].m === 8 && r.date[0].a === 2026, r.date[0]);
ok('la seconda e\' il 6 settembre 2026',
   r.date[1].g === 6 && r.date[1].m === 9 && r.date[1].a === 2026, r.date[1]);

console.log('\n— con una data sola, la sceglie —');
const unaSola = T.leggiRichiesta(
  'Buongiorno, servirebbe un taxi il 12/09/2026 alle 14:30 per 2 persone ' +
  'dall\'hotel all\'aeroporto di Venezia. Grazie');
ok('sceglie l\'unica data disponibile', unaSola.data && unaSola.data.g === 12, unaSola.data);
ok('capisce che e\' una partenza', unaSola.verso === 'partenza', unaSola.verso);
ok('legge l\'ora dopo «alle»', unaSola.ora === '14:30', unaSola.ora);

console.log('\n— i luoghi: doppi spazi, emoji, lingue —');
ok('«Venezia  aeroporto» ha il doppio spazio della voce vera',
   T.riconosciLuogo('marco polo').voce === 'Venezia  aeroporto');
ok('la voce con emoji resta identica all\'originale',
   T.riconosciLuogo('flughafen verona').voce === 'Verona Aeroporto✈️');
ok('inglese: «venice airport»', T.riconosciLuogo('venice airport').voce === 'Venezia  aeroporto');
ok('stazione di Padova', T.riconosciLuogo('bahnhof padua').voce === 'Padova FS');
ok('«Terme  Euganee FS» col doppio spazio',
   T.riconosciLuogo('stazione montegrotto').voce === 'Terme  Euganee FS');
ok('sceglie il sinonimo piu\' lungo, non il primo che capita',
   T.riconosciLuogo('aeroporto di bologna').voce === 'Bologna Aeroporto');
ok('quello che non e\' in elenco resta non riconosciuto',
   T.riconosciLuogo('stazione di Chiasso vecchia') === null);

console.log('\n— quando non c\'e\' abbastanza, il pulsante non compare —');
ok('una mail senza date ne\' luoghi non produce niente',
   T.leggiRichiesta('Vi scrivo per sapere se il taxi lo prenotate voi. Grazie') === null);
ok('una mail che non parla di transfer viene ignorata',
   T.leggiRichiesta('Vorrei prenotare una camera doppia dal 12/09/2026') === null);

console.log('\n— navetta condivisa o auto privata —');
const C = T.trovaCollettivo;
ok('Sammeltaxi → collettivo', C('bitte ein Sammeltaxi für 2 Personen') === true);
ok('Sammeltransfer → collettivo', C('Wir möchten einen Sammeltransfer buchen') === true);
ok('Sammel-Taxi col trattino → collettivo', C('ein Sammel-Taxi vom Flughafen') === true);
ok('Sammel Taxi staccato → collettivo', C('ein Sammel Taxi vom Flughafen') === true);
ok('navetta condivisa → collettivo', C('vorremmo la navetta condivisa') === true);
ok('shared shuttle → collettivo', C('we would like a shared shuttle') === true);
ok('Privattransfer → individuale', C('bitte einen Privattransfer') === false);
ok('taxi privato → individuale', C('vorremmo un taxi privato') === false);
ok('«ein Taxi» da solo NON vuol dire privato', C('ein Taxi für 3 Personen') === undefined,
   C('ein Taxi für 3 Personen'));
ok('la mail di Edith non lo dice: resta indefinito', r.collettivo === undefined, r.collettivo);
ok('se dice tutte e due, non sceglie',
   C('Sammeltaxi oder Privattransfer, was empfehlen Sie?') === undefined);

console.log('\n— e finisce nel frammento senza essere cancellato —');
const rColl = T.leggiRichiesta(
  'Bitte ein Sammeltaxi am 28.08.26 für 2 Personen vom Flughafen Venedig zum Hotel');
ok('collettivo true arriva ad atam-booking',
   JSON.parse(decodeURIComponent(T.frammento(rColl, rColl.data).split('#leo=')[1])).collettivo === true);
const rPriv = T.leggiRichiesta(
  'Bitte einen Privattransfer am 28.08.26 für 2 Personen vom Flughafen Venedig zum Hotel');
const datiPriv = JSON.parse(decodeURIComponent(T.frammento(rPriv, rPriv.data).split('#leo=')[1]));
ok('collettivo FALSE non viene buttato via con i campi vuoti',
   datiPriv.collettivo === false, datiPriv);

console.log('\n— il frammento per atam-booking.js —');
const url = T.frammento(r, r.date[0]);
const dati = JSON.parse(decodeURIComponent(url.split('#leo=')[1]));
ok('punta al modulo dei tassisti', url.startsWith('https://www.atam.biz/prenotazioni/#leo='));
ok('la data e\' in ISO, come si aspetta il datepicker', dati.data === '2026-08-28', dati.data);
ok('il luogo e\' il testo esatto dell\'opzione', dati.luogo === 'Venezia  aeroporto', dati.luogo);
ok('pax, ora, verso e volo ci sono',
   dati.pax === 3 && dati.ora === '10:25' && dati.verso === 'arrivo' && /4237/.test(dati.volo));
ok('NON manda «collettivo»: i pallini restano come sono',
   !('collettivo' in dati), Object.keys(dati));
ok('NON manda «pagamento»: resta Diretto', !('pagamento' in dati));
ok('i campi vuoti non vengono mandati affatto',
   !Object.values(dati).some(v => v === '' || v === null), dati);

console.log('\n— mail a catena: Irene Rieger, 6 luglio 2026 —');
/* Il caso vero: firma, informativa privacy, il messaggio citato sotto,
   e la richiesta spezzata fra una riga di testo e tre punti elenco.
   Prima veniva letto solo il punto elenco piu' corto: dentro c'era il
   luogo e nient'altro. */
const CATENA = `P. IVA / C.F.: IT02042330288 | SDI: M5UXCR1
+39 049 9939255 | PEC: admin.tria@pec-mail.it

Prima di stampare, pensa all'ambiente. Ogni pagina non stampata consente di risparmiare circa 10 litri d'acqua.
Messaggio riservato ai sensi del D.Lgs. 196/2003.

Da: Irene Rieger <irene.rieger@gmx.at>
Inviato: lunedì 6 luglio 2026 14:14
A: RECEPTION Hotel Terme Leonardo <info@termeleonardo.com>
Oggetto: Frage zur Anreise

Sehr geehrte Damen und Herren,
am 26. Juli 2026 werde ich (laut Plan) um 14:13 Uhr am Bahnhof Venezia Mestre ankommen.

Bieten Sie die Möglichkeit, ein Sammel-Taxi /shared taxi zu buchen? Was kostet das vom Bahnhof Venezia Mestre?
Falls es kein Sammel-Taxi gibt: Was kostet es, wenn Sie mich vom Bahnhof abholen?
Gibt es eine andere Möglichkeit, vom Bahnhof Venezia Mestre zu Ihnen zu kommen?

Vielen Dank im Voraus für Ihre Antwort!
Beste Grüße,
Irene Rieger

Gesendet: Mittwoch, 1. April 2026 um 19:57
Von: "RECEPTION Hotel Terme Leonardo" <info@termeleonardo.com>
An: "Irene Rieger" <irene.rieger@gmx.at>`;

const pulito = T.ripulisci(CATENA);
ok('taglia via il messaggio citato sotto', !/1\. April 2026/.test(pulito));
ok('taglia via il piede con partita IVA e informativa',
   !/P\. IVA/.test(pulito) && !/Messaggio riservato/.test(pulito));

/* il blocco della sola richiesta, come se fosse l'unico elemento */
const soloRichiesta = `Sehr geehrte Damen und Herren,
am 26. Juli 2026 werde ich (laut Plan) um 14:13 Uhr am Bahnhof Venezia Mestre ankommen.

Bieten Sie die Möglichkeit, ein Sammel-Taxi /shared taxi zu buchen? Was kostet das vom Bahnhof Venezia Mestre?
Falls es kein Sammel-Taxi gibt: Was kostet es, wenn Sie mich vom Bahnhof abholen?`;
const ir = T.leggiRichiesta(soloRichiesta);
ok('legge il 26 luglio 2026', ir.data && ir.data.g === 26 && ir.data.m === 7, ir.data);
ok('legge le 14:13 da «14:13 Uhr»', ir.ora === '14:13', ir.ora);
ok('mappa «Bahnhof Venezia Mestre» su Mestre fs', ir.luogo === 'Mestre fs', ir.luogo);
ok('«Sammel-Taxi» col trattino → navetta condivisa', ir.collettivo === true, ir.collettivo);

/* il punto elenco da solo vale meno del paragrafo che contiene tutto */
const soloElenco = 'Bieten Sie die Möglichkeit, ein Sammel-Taxi /shared taxi zu buchen? ' +
  'Was kostet das vom Bahnhof Venezia Mestre?';
ok('il paragrafo completo ha piu\' punti del punto elenco',
   T.punteggio(soloRichiesta) > T.punteggio(soloElenco),
   [T.punteggio(soloRichiesta), T.punteggio(soloElenco)]);
ok('il punto elenco da solo dava solo il luogo',
   T.punteggio(soloElenco) === 1, T.punteggio(soloElenco));

console.log('\n— richiesta a moduli: Sabrina Lux, 6 luglio 2026 —');
/* Il caso che non faceva nemmeno comparire il pulsante: l'intestazione
   «Da: / Inviato: / A: / Oggetto:» sta in CIMA, e la versione di prima
   tagliava tutto da li' in giu' — cioe' la mail intera. */
const MODULO = `Da: Sabrina-Lavinia Lux <s.lavinia.lux@googlemail.com>
Inviato: lunedì 6 luglio 2026 17:05
A: info@hldv.com <info@hldv.com>
Oggetto: Hotel Transfer

Bitte Reservieren Sie ein Flughafen Hotel Transfer - Sammel Taxi

Name: Sabrina Lux
Personen: 1

Ankunft Daten
Flughafen: VCE
Datum: 19.07.26
Uhrzeit: 16.35Uhr
Flugnummer: EN8204`;

const pulitoM = T.ripulisci(MODULO);
ok('la mail NON viene cancellata dall\'intestazione in cima',
   pulitoM.length > 150, pulitoM.length);
ok('ma «Inviato: lunedì 6 luglio 2026» sparisce lo stesso',
   !/6 luglio 2026/.test(pulitoM), pulitoM.slice(0, 80));

const sl = T.leggiRichiesta(pulitoM);
ok('la richiesta viene riconosciuta', !!sl);
ok('legge il 19 luglio 2026', sl.data && sl.data.g === 19 && sl.data.m === 7, sl.data);
ok('la data dell\'intestazione non entra in gara',
   sl.date.length === 1, sl.date.map(d => `${d.g}/${d.m}`));
ok('legge «16.35Uhr» senza spazio', sl.ora === '16:35', sl.ora);
ok('legge «Personen: 1» con l\'etichetta prima', sl.pax === 1, sl.pax);
ok('«Flughafen: VCE» → Venezia aeroporto', sl.luogo === 'Venezia  aeroporto', sl.luogo);
ok('«Flugnummer: EN8204» letto come volo', /EN\s?8204/.test(sl.volo || ''), sl.volo);
ok('«Ankunft Daten» basta a capire che e\' un arrivo', sl.verso === 'arrivo', sl.verso);
ok('«Sammel Taxi» staccato → navetta condivisa', sl.collettivo === true, sl.collettivo);

console.log(falliti === 0
  ? '\n\x1b[32mTutti i test passati.\x1b[0m\n'
  : `\n\x1b[31m${falliti} test falliti.\x1b[0m\n`);
process.exit(falliti === 0 ? 0 : 1);
