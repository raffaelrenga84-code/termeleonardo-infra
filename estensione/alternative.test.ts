/* ============================================================
   alternative.test.ts — «l'ospite ne sceglie una».

   LA PRATICA #19196. Due Junior Suite Abano, 25→26 e 26→27 settembre,
   ognuna 2 adulti e 1 bambino di 17 anni, e la nota di portineria che
   dice «richiesta x 2 date». Sono alternative: la signora e' una, con
   marito e figlio. L'offerta usciva con «6 persone», totale 720 € e
   caparra 300 €, cioe' la somma di due soggiorni che non avverranno
   mai insieme.

   NON SI DEDUCE. Per un giorno qui c'e' stata una regola automatica —
   se le camere non si sovrappongono, non sommare — ed era sbagliata
   sul caso piu' comune: il cliente che ha davvero bisogno di due
   camere in due periodi diversi, i genitori una settimana e il
   fratello quella dopo. Quelle persone sono quattro e la caparra e'
   quattro volte 75. Alternative, cambio camera e soggiorni distinti
   hanno in Fidra lo stesso aspetto: cambia l'intenzione di chi ha
   prenotato, e quella la sa una persona sola.

   Percio' la spunta. E percio' questa prova guarda tutte e due le
   strade: con la spunta non si somma niente, senza la spunta si somma
   tutto come e' sempre stato.
   ============================================================ */
import { assert } from 'jsr:@std/assert';

const FILE = [
  'template.js', 'template-conferma.js', 'template-de.js',
  'template-en.js', 'template-fr.js', 'template-extra.js',
];
const SORGENTE = FILE.map((f) => Deno.readTextFileSync(new URL(f, import.meta.url))).join('\n');

const LINGUE = ['it', 'de', 'en', 'fr'] as const;
type Lingua = typeof LINGUE[number];
type Offerta = (d: Record<string, unknown>, o: Record<string, unknown>) => string;

function offerte(): Record<string, Offerta> {
  const coda = `
    return { it: costruisciEmail, de: costruisciEmailDE,
             en: costruisciEmailEN, fr: costruisciEmailFR };`;
  return new Function(SORGENTE + coda)() as Record<string, Offerta>;
}

/* le due camere della pratica vera, con i loro periodi e i loro prezzi */
function camere() {
  return [
    {
      categoria: 'Junior Suite Abano', numero: null, adulti: 2, bambini: 1,
      etaBambini: '17', trattamento: 'MIGLIOR PREZZO BED & BREAKFAST',
      totalePP: 120, totaleCamera: 355, bambiniPrezzi: [115],
      periodo: { g1: 25, g2: 26, mese: 'Sep', notti: 1 },
      soggiornanti: [], checkinFatti: 0,
    },
    {
      categoria: 'Junior Suite Abano', numero: null, adulti: 2, bambini: 1,
      etaBambini: '17', trattamento: 'MIGLIOR PREZZO BED & BREAKFAST',
      totalePP: 125, totaleCamera: 365, bambiniPrezzi: [115],
      periodo: { g1: 26, g2: 27, mese: 'Sep', notti: 1 },
      soggiornanti: [], checkinFatti: 0,
    },
  ];
}

function pratica(alternative: boolean): Record<string, unknown> {
  const cam = camere() as Array<Record<string, unknown>>;
  if (alternative) {
    cam.forEach((c, i) => { c.soluzione = i + 1; c.accontoSoluzione = 150; });
  }
  return {
    ok: true, id: '19196', numeroOfferta: 'O26/19196', linkPagamento: null,
    stato: 'offerta', intestatario: 'Brencila Francesca', email: 'brencila@tiscali.it',
    emailAlternative: [], note: [], mancanti: [], profilo: {}, avvisi: [], extra: [],
    scadenza: '30 Aug 2026',
    anno: 2026, mese: 'Sep', giornoArrivo: 25, giornoPartenza: 27,
    mesePartenza: 'Sep', annoPartenza: 2026,
    notti: 2, nCamere: 2, adulti: 4, bambini: 2,
    camere: cam,
    totale: 720, totaleFmt: '720,00',
    acconto: 300, accontoFmt: '300,00',
    saldo: 420, saldoFmt: '420,00',
    caparraVersata: 0, caparraDovuta: null,
    alternative,
  };
}

const OPZ = { genere: 'F', titolo: '', firma: 'La Reception' };

/* quante volte compare un importo: match senza /g ne conta sempre una sola */
function quante(html: string, testo: string): number {
  return html.split(testo).length - 1;
}

/* l'inglese scrive «€355.00» col punto e le altre «355,00 €» con la
   virgola: si conta il numero, non la sua punteggiatura */
function quanteVolteImporto(html: string, intero: string): number {
  return (html.match(new RegExp(intero + '[.,]00', 'g')) || []).length;
}

Deno.test('senza spunta si somma tutto, come e sempre stato', () => {
  /* IL CASO CHE HA SMONTATO L'AUTOMATISMO: due camere in due periodi per
     persone diverse. Qui il totale e la caparra sommati sono giusti, e
     guai a toccarli. */
  const off = offerte();
  const html = off.it(pratica(false), OPZ);
  assert(quante(html, '720,00') > 0, 'sparito il totale sommato: le due camere servono davvero');
  assert(quante(html, '300,00') > 0, 'sparita la caparra sommata');
  assert(!/Soluzione 1/.test(html), 'compaiono le soluzioni senza che nessuno le abbia chieste');
});

Deno.test('con la spunta il totale non si somma, in tutte e quattro', () => {
  const off = offerte();
  for (const l of LINGUE) {
    const html = off[l](pratica(true), OPZ);
    assert(
      quanteVolteImporto(html, '720') === 0,
      `il totale sommato 720 e ancora nell'offerta ${l}: sono due soggiorni alternativi`,
    );
    assert(quanteVolteImporto(html, '355') > 0, `manca il totale della prima soluzione in ${l}`);
    assert(quanteVolteImporto(html, '365') > 0, `manca il totale della seconda soluzione in ${l}`);
  }
});

Deno.test('con la spunta la caparra e per soluzione, non sommata', () => {
  const off = offerte();
  for (const l of LINGUE) {
    const html = off[l](pratica(true), OPZ);
    assert(
      quanteVolteImporto(html, '300') === 0,
      `la caparra sommata 300 e ancora nell'offerta ${l}: si chiederebbe il doppio`,
    );
    assert(
      quanteVolteImporto(html, '150') > 0,
      `manca la caparra della singola soluzione in ${l}`,
    );
  }
});

Deno.test('con la spunta le soluzioni sono numerate, in tutte e quattro', () => {
  const off = offerte();
  const ATTESE: Record<Lingua, RegExp> = {
    it: /Soluzione 1[\s\S]*Soluzione 2/,
    de: /M&ouml;glichkeit 1[\s\S]*M&ouml;glichkeit 2/,
    en: /Option 1[\s\S]*Option 2/,
    fr: /Solution 1[\s\S]*Solution 2/,
  };
  for (const l of LINGUE) {
    const html = off[l](pratica(true), OPZ);
    assert(ATTESE[l].test(html), `le soluzioni non sono numerate in ${l}`);
  }
});

Deno.test('con la spunta l offerta dice che si sceglie, non che si somma', () => {
  const off = offerte();
  const SCEGLIERE: Record<Lingua, RegExp> = {
    it: /ne scelga una/i,
    de: /w&auml;hlen Sie eine/i,
    en: /choose one/i,
    fr: /choisissez-en une/i,
  };
  for (const l of LINGUE) {
    const html = off[l](pratica(true), OPZ);
    assert(SCEGLIERE[l].test(html), `l'offerta ${l} non dice all'ospite di scegliere`);
  }
});

Deno.test('cambio camera: le notti si pagano tutte, le persone no', () => {
  /* IL CASO CHE LA RECEPTION HA PORTATO: prima una doppia con il partner,
     poi una Queen in uso singola perche' lui riparte prima. Le stesse
     persone si spostano, quindi il totale si somma (le notti si pagano
     tutte) ma gli ospiti non sono la somma delle due camere. */
  const off = offerte();
  const d = pratica(false);
  d.cambioCamera = true;
  d.adulti = 2; d.bambini = 1;              // corretti da preparaCamere
  d.acconto = 150; d.accontoFmt = '150,00';
  d.saldo = 570; d.saldoFmt = '570,00';
  const CAMBIO: Record<Lingua, RegExp> = {
    it: /cambio di camera/i, de: /Zimmerwechsel/i,
    en: /room change/i, fr: /changement de chambre/i,
  };
  for (const l of LINGUE) {
    const html = off[l](d, OPZ);
    assert(CAMBIO[l].test(html), `l'offerta ${l} non dice che si cambia camera`);
    assert(quanteVolteImporto(html, '720') > 0, `il totale non si somma piu in ${l}: le notti si pagano tutte`);
    assert(quanteVolteImporto(html, '150') > 0, `manca la caparra sulle persone vere in ${l}`);
    assert(!/Soluzione 1|Option 1|Solution 1|M&ouml;glichkeit 1/.test(html),
      `compaiono le soluzioni su un cambio camera in ${l}`);
  }
});

Deno.test('senza spunta il numero delle persone resta quello di Fidra', () => {
  /* la regressione da cui guardarsi: 4 adulti e 2 bambini sono giusti
     quando le due camere servono davvero */
  const off = offerte();
  const html = off.it(pratica(false), OPZ);
  assert(/6 persone/.test(html), 'le persone non sono piu quelle di Fidra');
});

/* ============================================================
   DOVE COMPARE LA DOMANDA SULLE PIU' CAMERE.

   Il pannello e' uno script che vive nel DOM del popup e fuori dal
   browser non si esegue: queste prove leggono il sorgente. Guardano una
   cosa sola, ma e' quella che e' andata storta — QUANDO la domanda si fa.

   IL DIFETTO, segnalato sulla 19238: due camere dal 15 al 25 settembre,
   Junior Suite Colli Euganei e Doppia, due adulti ciascuna, e del
   riquadro nessuna traccia. Si chiedeva solo quando i periodi NON si
   sovrapponevano, mentre il caso piu' frequente e' l'opposto: stesse
   date, due categorie a confronto. «Le mando la Junior Suite e la
   Doppia, scelga lei.» Nei dati e' identico a quattro persone in due
   camere, e sommandolo si scrive un totale doppio e una caparra doppia.

   Nessuna prova sorvegliava quel cancello: e' per questo che si e'
   potuto restringere senza che se ne accorgesse nessuno.
   ============================================================ */
const POPUP = Deno.readTextFileSync(new URL('popup.js', import.meta.url));

Deno.test('la domanda si fa con piu di una camera, non solo con periodi diversi', () => {
  assert(
    /if \(\(d\.camere \|\| \[\]\)\.length > 1\) \{/.test(POPUP),
    'il riquadro e tornato a comparire solo con periodi non sovrapposti: due categorie a confronto sulle stesse date verrebbero sommate',
  );
  assert(
    !/^\s*if \(d\.camereNonSovrapposte\) \{/m.test(POPUP),
    'il cancello e di nuovo camereNonSovrapposte',
  );
});

Deno.test('con una camera sola la domanda non si fa', () => {
  /* «se e' solo una camera di sicuro non serve»: una domanda che ha una
     risposta sola e' rumore, e il rumore si impara a saltare — anche
     quando smette di esserlo */
  assert(
    /\.length > 1\)/.test(POPUP),
    'la domanda comparirebbe anche su una camera sola',
  );
});

Deno.test('il cambio camera si offre solo dove e possibile', () => {
  /* le stesse persone non possono spostarsi da una camera all altra
     restando in tutt e due: con le date sovrapposte quel caso non esiste,
     e offrire una scelta impossibile e un modo di far sbagliare */
  assert(
    /const separate = !!d\.camereNonSovrapposte;/.test(POPUP),
    'sparita la distinzione fra periodi separati e sovrapposti',
  );
  assert(
    /\$\{separate \? `<label><input type="radio" name="camereModo" value="cambio"/.test(POPUP),
    'il cambio camera si offre anche quando i periodi si sovrappongono, dove non puo avvenire',
  );
});

Deno.test('la scelta di partenza resta «servono tutte»', () => {
  /* il caso comune non deve cambiare comportamento per il fatto che ora
     la domanda si vede: chi non tocca niente manda l offerta di prima */
  assert(
    /value="insieme"\s*\n?\s*\$\{spia \? '' : 'checked'\}/.test(POPUP),
    'la scelta di partenza non e piu «servono tutte»: le offerte normali cambierebbero da sole',
  );
});
