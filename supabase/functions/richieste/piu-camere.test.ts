/* ============================================================
   piu-camere.test.ts — una richiesta, più camere.

   IL DIFETTO CHE PRESIDIA. Chi prenotava due camere faceva DUE
   richieste: compilava i contatti due volte e riceveva due ricevute con
   due totali; la reception vedeva due fogli slegati e assegnava due
   camere lontane a persone che viaggiano insieme.

   E LA STRADA OVVIA ERA CHIUSA: mandare N richieste di fila dal browser
   sbatte contro TETTO_PERSONA, che ferma a 3 per mezz'ora. Alla quarta
   camera l'ospite leggeva un rifiuto, e chi ne prenotava tre bruciava la
   propria quota senza poter più correggere niente.

   TRE MODI DI ROMPERSI, e nessuno si vede provando con una camera sola:

   · una camera in più passa senza essere convalidata come la prima — e
     allora le regole del soggiorno valgono solo per quella in cima al
     modulo;
   · i contatti si prendono dalla camera invece che dalla persona: un
     invio solo con due email diverse;
   · l'errore non dice QUALE camera è sbagliata, e l'ospite non sa cosa
     correggere.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';
import { altreCamere, CAMERE_MAX, conIlNumero } from './piu-camere.ts';

/* DATE RELATIVE A OGGI, NON FISSE. Il validatore rifiuta un arrivo nel
   passato (valida.ts: `arrivo < adesso`) e con le date scritte a mano
   queste prove sono diventate rosse da sole il 3 settembre 2026, il giorno
   dopo la data che avevano dentro, senza che nessuno avesse toccato
   niente. Trenta giorni avanti: lontano da oggi, dentro i due anni del
   limite. Le distanze fra le date restano quelle di prima: diciotto notti
   la prima camera, due la seconda. */
const fra = (n: number): string => {
  const o = new Date();
  return new Date(Date.UTC(o.getUTCFullYear(), o.getUTCMonth(), o.getUTCDate() + n))
    .toISOString().slice(0, 10);
};
const ARRIVO = fra(30);            // era '2026-09-02'
const PARTENZA_18 = fra(48);       // era '2026-09-20': diciotto notti
const PARTENZA_2 = fra(32);        // era '2026-09-04': due notti
const PRIMA_DELL_ARRIVO = fra(29); // era '2026-09-01': la partenza precede l'arrivo


const PERSONA = {
  nome: 'Mario Rossi',
  email: 'mario@example.com',
  telefono: '3331234567',
  lingua: 'it',
  privacy_presa_atto: true,
};

const CAMERA_1 = {
  check_in: ARRIVO,
  check_out: PARTENZA_18,
  ospiti: 1,
  tipo_camera: 'Matrimoniale Queen',
  pacchetto: 'Dolce Vita',
  dati: { camera_id: 6, prezzo_cent: 319100 },
};

/* la seconda camera della #18968: due notti invece di diciotto */
const CAMERA_2 = {
  check_in: ARRIVO,
  check_out: PARTENZA_2,
  ospiti: 2,
  tipo_camera: 'Doppia',
  pacchetto: 'Soggiorno breve',
  dati: { camera_id: 5, prezzo_cent: 29000 },
};

Deno.test('senza camere in piu non costa niente', () => {
  assertEquals(altreCamere({ ...PERSONA, ...CAMERA_1 }).camere, []);
  assertEquals(altreCamere({ ...PERSONA, altre: [] }).camere, []);
  assertEquals(altreCamere({ ...PERSONA, altre: null }).camere, []);
});

Deno.test('una seconda camera con date SUE passa e resta sua', () => {
  /* e il caso vero: 18 notti col pacchetto cure, 2 notti in mezza pensione */
  const e = altreCamere({ ...PERSONA, ...CAMERA_1, altre: [CAMERA_2] });
  assertEquals(e.errore, undefined);
  assertEquals(e.camere?.length, 1);
  const c = e.camere![0];
  assertEquals(c.colonne?.check_in, ARRIVO);
  assertEquals(c.colonne?.check_out, PARTENZA_2, 'la seconda camera ha preso le date della prima');
  assertEquals(c.colonne?.tipo_camera, 'Doppia');
  assertEquals(c.dati?.prezzo_cent, 29000);
});

Deno.test('e i contatti vengono dalla PERSONA, non dalla camera', () => {
  /* un invio solo non puo portare due email diverse: chi prenota due
     stanze e una persona sola */
  const e = altreCamere({
    ...PERSONA,
    ...CAMERA_1,
    altre: [{ ...CAMERA_2, email: 'altro@example.com', nome: 'Altro Nome' }],
  });
  assertEquals(e.errore, undefined);
  assertEquals(e.camere![0].contatti?.email, 'mario@example.com');
  assertEquals(e.camere![0].contatti?.nome, 'Mario Rossi');
});

Deno.test('una camera in piu si convalida come la prima', () => {
  /* stessa porta: se un domani cambia una regola sul soggiorno, cambia
     per tutte e non solo per quella in cima al modulo */
  const e = altreCamere({
    ...PERSONA,
    ...CAMERA_1,
    altre: [{ ...CAMERA_2, check_out: PRIMA_DELL_ARRIVO }],
  });
  assert(e.errore, 'una partenza prima dell arrivo e passata');
});

Deno.test('e l errore dice QUALE camera', () => {
  /* senza il numero l ospite non sa quale correggere */
  const e = altreCamere({
    ...PERSONA,
    ...CAMERA_1,
    altre: [CAMERA_2, { ...CAMERA_2, check_in: 'domani' }],
  });
  assert(e.errore?.includes('camera 3'), `l errore non dice quale camera: «${e.errore}»`);
});

Deno.test('un tetto: cinque camere in tutto, non una comitiva intera', () => {
  const troppe = Array.from({ length: CAMERE_MAX }, () => CAMERA_2);
  const e = altreCamere({ ...PERSONA, ...CAMERA_1, altre: troppe });
  assert(e.errore, 'nessun tetto sulle camere');
  const giuste = Array.from({ length: CAMERE_MAX - 1 }, () => CAMERA_2);
  assertEquals(altreCamere({ ...PERSONA, ...CAMERA_1, altre: giuste }).errore, undefined);
});

Deno.test('e quello che non e una lista non passa per una lista vuota', () => {
  for (const v of ['due', 42, { camera: 1 }, true]) {
    assert(
      altreCamere({ ...PERSONA, altre: v }).errore,
      `«${JSON.stringify(v)}» e passato come nessuna camera`,
    );
  }
});

Deno.test('il filo che le tiene insieme e un CAMPO, non una frase nelle note', () => {
  /* una frase la si legge, un campo lo si cerca: il back office deve
     poterle raggruppare */
  assertEquals(conIlNumero({ camera_id: 5 }, 'S-2026-0001'), {
    camera_id: 5,
    insieme: 'S-2026-0001',
  });
  assertEquals(conIlNumero(null, 'S-2026-0001'), { insieme: 'S-2026-0001' });
});

/* ============================================================
   IL FRENO. TETTO_PERSONA ferma a 3 richieste per mezz'ora contando le
   righe di richiesta_sito. Con il carrello un invio solo ne salva fino a
   cinque: contandole tutte, chi prenota per una comitiva si brucia da
   solo la quota, e la schermata finale gli offre «aggiungi un'altra
   camera» verso un rifiuto sicuro. Si contano gli INVII, e le camere in
   piu' si riconoscono da `insieme` nel jsonb.
   ============================================================ */
const INDEX = Deno.readTextFileSync(new URL('index.ts', import.meta.url))
  .split('\r\n').join('\n');

Deno.test('il tetto per persona conta gli invii, non le camere', () => {
  const da = INDEX.indexOf('const { count: sue }');
  assert(da > 0, 'il conteggio per persona e sparito da index.ts');
  const query = INDEX.slice(da, INDEX.indexOf('  }', da));
  assert(
    query.includes("dati->>insieme"),
    'il conteggio per persona non esclude piu le camere di un carrello: ' +
      'chi ne prenota tre in un colpo si brucia da solo la quota',
  );
  assert(
    query.includes("email.eq."),
    'il filtro sta su una query che non e quella per persona',
  );
});

Deno.test('e il tetto TOTALE continua a contare le righe', () => {
  /* li' il rischio e' la tabella che si riempie, e una riga e' una riga:
     escludere qualcosa da quel conteggio aprirebbe una strada per
     riempirla in pace */
  const da = INDEX.indexOf('const { count: totale }');
  assert(da > 0, 'il conteggio totale e sparito da index.ts');
  const query = INDEX.slice(da, INDEX.indexOf(';', da));
  assert(
    !query.includes("insieme"),
    'anche il tetto totale ha smesso di contare le righe',
  );
});

Deno.test('e nessun altro scrive `insieme` nel jsonb', () => {
  /* se lo scrivesse anche la pagina, o un altro punto del server, una
     richiesta qualunque potrebbe farsi passare per «camera in piu» e
     sfilarsi dal conteggio del freno */
  const QUI = Deno.readTextFileSync(new URL('piu-camere.ts', import.meta.url));
  assertEquals(QUI.split('insieme:').length - 1, 1);
  assertEquals(INDEX.split('insieme:').length - 1, 0);
});
