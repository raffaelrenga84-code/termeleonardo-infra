/* ============================================================
   listino.test.ts — il listino Dolce Vita, e il confine fra le stagioni.

   IL DIFETTO CHE HA FATTO NASCERE QUESTA PROVA. Sulla 19242 — soggiorno
   dal 7 al 15 novembre — il pannello diceva «pacchetto a 115,00 € a
   notte (listino Werbesaison)». Il listino cartaceo dà novembre allo
   Spezial: 112. La reception aveva già scritto 112 a mano, e la
   proprietà se n'è accorta guardando i due numeri accanto.

   LA CAUSA NON ERA UNA CIFRA. Il Dolce Vita comincia di sabato e finisce
   di sabato, quindi il giorno in cui una stagione finisce è lo stesso in
   cui comincia l'altra. Con gli estremi tutti e due compresi, quel giorno
   cadeva in due intervalli e vinceva quello dichiarato per primo — sempre
   la Werbesaison, cioè sempre il prezzo più alto.

   Su quattro confini due erano sbagliati, e tutti e due in eccesso.

   PERCHÉ LE PROVE STANNO QUI E NON NEL CODICE. Un prezzo storto non fa
   rumore: l'offerta parte, l'ospite la legge, e la differenza si scopre
   all'arrivo o mai. L'unico posto dove può fermarsi è una prova che
   conosce il listino di carta — quello appeso in ufficio — e lo confronta
   con quello scritto nel codice. Perciò qui sotto la tabella cartacea è
   trascritta com'è, colonne comprese: prezzo al giorno, sette notti,
   Kurpaket, totale Dolce Vita. Se una cifra nel codice cambia e le
   colonne non tornano più, si spacca una prova invece di partire
   un'email.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';

const SORGENTE = Deno.readTextFileSync(new URL('fidra-disponibilita.js', import.meta.url));

type Camera = number | { cent: number; singola?: number };
type Stagione = { etichetta: string; periodi: [string, string][]; camere: Record<string, Camera> };

/* il pannello è una IIFE che vive nel DOM di Fidra: non si esegue fuori
   dal browser. Il listino però è dato puro — si estrae il letterale e si
   valuta quello, così la prova guarda le cifre vere, non una copia. */
function listino(): Record<string, Stagione> {
  const m = SORGENTE.match(/const LISTINO_PACCHETTI = (\{[\s\S]*?\n  \};)/);
  if (!m) throw new Error("nel sorgente non c'è più «const LISTINO_PACCHETTI = {…}»");
  return new Function('return ' + m[1].replace(/;$/, ''))() as Record<string, Stagione>;
}

/* la stessa regola del pannello: chi COMINCIA batte chi finisce, cioè la
   data finale è esclusa — è un giorno di partenza, non di arrivo */
function stagione(L: Record<string, Stagione>, iso: string): string | null {
  for (const [chiave, s] of Object.entries(L)) {
    for (const [da, a] of s.periodi) if (iso >= da && iso < a) return chiave;
  }
  return null;
}

const KURPAKET = 398;

/* IL LISTINO DI CARTA, trascritto dalla foto del 31 agosto 2026.
   [prezzo al giorno, sette notti, totale Dolce Vita] */
const CARTA = {
  werbesaison: {
    'Doppelzimmer Superior': [115, 805, 1203],
    'Einzelzimmer Queen': [130, 910, 1308],
    'Junior Suite': [126, 882, 1280],
    'Suite': [136, 952, 1350],
  },
  spezial: {
    'Doppelzimmer Superior': [112, 784, 1182],
    'Einzelzimmer Queen': [126, 882, 1280],
    'Junior Suite': [122, 854, 1252],
    'Suite': [131, 917, 1315],
  },
} as const;

/* come le righe di carta si chiamano nel codice. «Einzelzimmer Queen» è
   il prezzo in USO SINGOLA: nel codice è `singola`, non `cent`. */
const RIGA: Record<string, { camera: string; campo: 'cent' | 'singola' }> = {
  'Doppelzimmer Superior': { camera: 'Doppia', campo: 'cent' },
  'Einzelzimmer Queen': { camera: 'Matrimoniale Queen', campo: 'singola' },
  'Junior Suite': { camera: 'Junior Suite', campo: 'cent' },
  'Suite': { camera: 'Suite', campo: 'cent' },
};

function euro(v: Camera, campo: 'cent' | 'singola'): number {
  const c = typeof v === 'number' ? (campo === 'cent' ? v : NaN) : v[campo];
  return Number(c) / 100;
}

Deno.test('il listino del codice e quello di carta dicono gli stessi prezzi', () => {
  const L = listino();
  for (const [chiave, righe] of Object.entries(CARTA)) {
    for (const [nomeCarta, [alGiorno]] of Object.entries(righe)) {
      const { camera, campo } = RIGA[nomeCarta];
      assertEquals(
        euro(L[chiave].camere[camera], campo),
        alGiorno,
        `${chiave} · ${nomeCarta}: il codice non dice piu ${alGiorno} € al giorno`,
      );
    }
  }
});

Deno.test('le colonne del listino di carta tornano fra loro', () => {
  /* se una delle tre cifre fosse stata trascritta male, le altre due la
     smentirebbero: sette notti = prezzo x 7, e Dolce Vita = sette notti
     piu' il Kurpaket. E' il controllo che la carta stessa si porta
     dietro, e qui serve a non fidarsi di una foto. */
  for (const [chiave, righe] of Object.entries(CARTA)) {
    for (const [nome, [alGiorno, sette, dolceVita]] of Object.entries(righe)) {
      assertEquals(alGiorno * 7, sette, `${chiave} · ${nome}: ${alGiorno} x 7 non fa ${sette}`);
      assertEquals(sette + KURPAKET, dolceVita, `${chiave} · ${nome}: ${sette} + ${KURPAKET} non fa ${dolceVita}`);
    }
  }
});

Deno.test('sul confine vince la stagione che COMINCIA, non quella che finisce', () => {
  /* IL DIFETTO VERO. Il Dolce Vita comincia di sabato e finisce di
     sabato: il giorno in cui una stagione si chiude e' lo stesso in cui
     si apre l'altra, e va all'arrivo — cioe' a quella che comincia. */
  const L = listino();
  const attesi: Record<string, string> = {
    '2026-03-07': 'werbesaison',   // lo Spezial di febbraio finisce qui
    '2026-06-13': 'spezial',       // <- sbagliava: dava werbesaison
    '2026-06-27': 'werbesaison',   // lo Spezial di giugno finisce qui
    '2026-11-07': 'spezial',       // <- sbagliava: e' il caso della 19242
  };
  for (const [giorno, atteso] of Object.entries(attesi)) {
    assertEquals(stagione(L, giorno), atteso, `il ${giorno} non e piu ${atteso}`);
  }
});

Deno.test('il 7 novembre la Doppia costa 112, non 115', () => {
  /* IL CASO SEGNALATO, tenuto per nome: soggiorno dal 7 al 15 novembre,
     il pannello diceva 115 e la reception aveva scritto 112. Sono 21 € a
     persona su una settimana, dentro un'offerta gia' mandata. */
  const L = listino();
  const st = stagione(L, '2026-11-07');
  assertEquals(st, 'spezial', 'il 7 novembre e tornato Werbesaison');
  assertEquals(euro(L[st!].camere['Doppia'], 'cent'), 112, 'la Doppia del 7 novembre non costa piu 112');
});

Deno.test('nessun giorno appartiene a due stagioni', () => {
  /* era questo a rendere possibile il difetto: finche' due intervalli si
     toccano, quale vince dipende dall'ordine in cui sono scritti — e
     l'ordine di un oggetto non e' una regola commerciale */
  const L = listino();
  const tutti: [string, string, string][] = [];
  for (const [chiave, s] of Object.entries(L)) for (const [da, a] of s.periodi) tutti.push([chiave, da, a]);
  for (let i = 0; i < tutti.length; i++) {
    for (let j = i + 1; j < tutti.length; j++) {
      const [ka, da, a] = tutti[i], [kb, db, b] = tutti[j];
      const sovrapposti = da < b && db < a;
      assert(
        !sovrapposti,
        `${ka} [${da}, ${a}) e ${kb} [${db}, ${b}) si sovrappongono: il prezzo dipenderebbe dall ordine`,
      );
    }
  }
});

Deno.test('la data finale resta esclusa anche nel codice', () => {
  /* la prova qui sopra usa la regola giusta: serve anche che il pannello
     la usi, o le due si scollano e la prova diventa una bugia verde */
  assert(
    /if \(iso >= da && iso < a\) return chiave;/.test(SORGENTE),
    'stagionePacchetto e tornata a comprendere la data finale: i confini si sovrappongono di nuovo',
  );
});

Deno.test('il 29 novembre non e prenotabile: l hotel chiude', () => {
  const L = listino();
  assertEquals(
    stagione(L, '2026-11-29'),
    null,
    'il giorno della chiusura torna a risultare una data di arrivo valida',
  );
});

Deno.test('con questi pacchetti la Queen esiste SOLO in uso singola', () => {
  /* QUESTA PROVA E' NATA SBAGLIATA, ed e' istruttivo che lo sia stata.
     La prima versione pretendeva che la Queen Spezial valesse «101 a
     persona», perche' il listino scrive «Einzelzimmer Queen (101+25)» e
     quel 101 sembra una tariffa. Non lo e': e' il modo in cui il listino
     spiega come si arriva ai 126 dell'uso singola.

     La proprieta' ha chiuso la questione in una riga: «con questi
     pacchetti le queen vengono vendute solo come singola». Ed era la
     terza risposta possibile — non 105, non 115: nessuna delle due,
     perche' quel prodotto non si vende.

     Un prezzo inventato per un prodotto che non esiste e' peggio di un
     prezzo sbagliato: non c'e' nessun listino con cui smentirlo. */
  const L = listino();
  for (const st of ['werbesaison', 'spezial']) {
    const q = L[st].camere['Matrimoniale Queen'] as
      { cent?: number; singola: number; soloSingola?: boolean };
    assert(q.soloSingola === true, `${st}: la Queen e tornata vendibile in due`);
    assertEquals(q.cent, undefined, `${st}: e tornato un prezzo a persona per la Queen, che non esiste`);
  }
  assertEquals(euro(L.werbesaison.camere['Matrimoniale Queen'], 'singola'), 130, 'la Queen Werbesaison non e piu 130');
  assertEquals(euro(L.spezial.camere['Matrimoniale Queen'], 'singola'), 126, 'la Queen Spezial non e piu 126');
});

Deno.test('per la Queen in due il prezzo non si inventa: lo da Fidra, e si dice', () => {
  /* il pannello non deve tacere ne' indovinare. Se il listino conosce la
     camera ma non quel modo di venderla, il prezzo viene da Fidra — che
     sa cosa sta vendendo davvero — e il riquadro scrive da dove viene. */
  assert(
    /if \(dettagliato && v\.soloSingola && adulti !== 1\)/.test(SORGENTE),
    'sparito il controllo: per la Queen in due tornerebbe un prezzo da listino inventato',
  );
  assert(
    /solo in uso singola<\/strong>, e qui gli adulti sono/.test(SORGENTE),
    'il riquadro non spiega piu perche il prezzo non viene dal listino',
  );
  assert(
    /listino && listino\.cent != null/.test(SORGENTE),
    'il chiamante non guarda piu se il listino ha davvero un prezzo: uscirebbe «NaN € a notte»',
  );
});
