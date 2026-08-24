/* ============================================================
   occupazione.test.ts — quante persone ci sono davvero.

   IL CASO, pratica #19196 del 24 agosto 2026. Fidra scrive in testa:

     «2 Camere prenotate con in totale 4 Adulti e 2 Bambini»

   Le camere sono Junior Suite Abano 25→26 settembre e Junior Suite
   Abano 26→27 settembre, ognuna 2 adulti e 1 bambino di 17 anni. La
   nota di portineria dice «richiesta x 2 date»: sono due alternative,
   e la signora e' una sola con marito e figlio.

   L'email usciva con «6 persone, di cui 2 bambini» e una caparra di
   300 € (75 × 4 adulti che non esistono). La reception ha continuato a
   mandare le offerte col modello vecchio di Fidra, e aveva ragione.

   NON E' UN DIFETTO DELLE ALTERNATIVE. E' dei periodi diversi: una
   famiglia di tre che a meta' soggiorno cambia stanza riceveva la
   stessa email con sei persone. Due camere che non si sovrappongono
   non possono ospitare persone diverse — in ogni istante ne e'
   occupata una sola.

   Percio' qui non si distingue fra alternativa e cambio camera: per
   contare le persone non serve saperlo. Serve invece per il prezzo, e
   quella e' un'altra domanda con un'altra risposta.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';

const SORGENTE = Deno.readTextFileSync(new URL('extractor.js', import.meta.url));

type Camera = {
  adulti: number;
  bambini: number;
  periodo?: { g1: number; g2: number; mese: string; mesePartenza?: string };
};
type Soggiorno = {
  camere: Camera[];
  giornoArrivo: number;
  giornoPartenza: number;
  mese: string;
  mesePartenza?: string;
};
type Occupazione = { adulti: number; bambini: number } | null;

function occupazione(): (s: Soggiorno, a: number, p: number) => Occupazione {
  const nulla = () => {};
  const chrome = { runtime: { onMessage: { addListener: nulla } } };
  const fabbrica = new Function(
    'chrome', 'document', 'window', 'location',
    SORGENTE + '\nreturn occupazioneMassima;',
  );
  return fabbrica(
    chrome,
    { querySelectorAll: () => [], querySelector: () => null, body: { innerText: '' } },
    { addEventListener: nulla },
    { pathname: '/customers/118532/reservations/19196' },
  ) as (s: Soggiorno, a: number, p: number) => Occupazione;
}

const DUE_DATE: Soggiorno = {
  giornoArrivo: 25,
  giornoPartenza: 27,
  mese: 'Sep',
  camere: [
    { adulti: 2, bambini: 1, periodo: { g1: 25, g2: 26, mese: 'Sep' } },
    { adulti: 2, bambini: 1, periodo: { g1: 26, g2: 27, mese: 'Sep' } },
  ],
};

Deno.test('la pratica #19196: tre persone, non sei', () => {
  const f = occupazione();
  const o = f(DUE_DATE, 2026, 2026);
  assert(o, 'nessuna correzione: l email direbbe ancora «6 persone»');
  assertEquals(o!.adulti, 2, 'gli adulti');
  assertEquals(o!.bambini, 1, 'i bambini');
});

Deno.test('due camere prenotate insieme si sommano, come sempre', () => {
  /* il caso normale non deve cambiare di una virgola: quando i periodi
     si sovrappongono il massimo simultaneo E' la somma */
  const f = occupazione();
  const insieme: Soggiorno = {
    giornoArrivo: 25, giornoPartenza: 27, mese: 'Sep',
    camere: [
      { adulti: 2, bambini: 1, periodo: { g1: 25, g2: 27, mese: 'Sep' } },
      { adulti: 2, bambini: 1, periodo: { g1: 25, g2: 27, mese: 'Sep' } },
    ],
  };
  assertEquals(f(insieme, 2026, 2026), null, 'ha corretto un conto che era gia giusto');
});

Deno.test('basta una notte in comune perche si sommino', () => {
  /* 25→27 e 26→28: la notte del 26 le camere sono occupate tutte e due,
     e in quella notte le persone sono davvero sei */
  const f = occupazione();
  const accavallate: Soggiorno = {
    giornoArrivo: 25, giornoPartenza: 28, mese: 'Sep',
    camere: [
      { adulti: 2, bambini: 1, periodo: { g1: 25, g2: 27, mese: 'Sep' } },
      { adulti: 2, bambini: 1, periodo: { g1: 26, g2: 28, mese: 'Sep' } },
    ],
  };
  assertEquals(f(accavallate, 2026, 2026), null, 'la notte in comune non e stata vista');
});

Deno.test('camere di dimensioni diverse: vince la notte piu affollata', () => {
  const f = occupazione();
  const miste: Soggiorno = {
    giornoArrivo: 25, giornoPartenza: 28, mese: 'Sep',
    camere: [
      { adulti: 2, bambini: 0, periodo: { g1: 25, g2: 26, mese: 'Sep' } },
      { adulti: 4, bambini: 2, periodo: { g1: 26, g2: 28, mese: 'Sep' } },
    ],
  };
  const o = f(miste, 2026, 2026);
  assert(o, 'nessuna correzione su due camere che non si sovrappongono');
  assertEquals(o!.adulti, 4);
  assertEquals(o!.bambini, 2);
});

Deno.test('una camera sola non si corregge', () => {
  const f = occupazione();
  const una: Soggiorno = {
    giornoArrivo: 25, giornoPartenza: 27, mese: 'Sep',
    camere: [{ adulti: 2, bambini: 1, periodo: { g1: 25, g2: 27, mese: 'Sep' } }],
  };
  assertEquals(f(una, 2026, 2026), null);
});

Deno.test('camere senza periodo proprio: si sovrappongono per definizione', () => {
  /* senza c.periodo la camera dura quanto la prenotazione: e' il caso di
     gran lunga piu' comune, e non deve toccarsi */
  const f = occupazione();
  const senzaPeriodo: Soggiorno = {
    giornoArrivo: 25, giornoPartenza: 27, mese: 'Sep',
    camere: [{ adulti: 2, bambini: 0 }, { adulti: 2, bambini: 0 }],
  };
  assertEquals(f(senzaPeriodo, 2026, 2026), null);
});

Deno.test('date illeggibili: si lascia stare invece di inventare', () => {
  const f = occupazione();
  const rotte: Soggiorno = {
    giornoArrivo: 25, giornoPartenza: 27, mese: 'Sep',
    camere: [
      { adulti: 2, bambini: 1, periodo: { g1: 25, g2: 26, mese: 'Xxx' } },
      { adulti: 2, bambini: 1, periodo: { g1: 26, g2: 27, mese: 'Sep' } },
    ],
  };
  assertEquals(f(rotte, 2026, 2026), null, 'ha inventato un numero su una data che non sa leggere');
});

Deno.test('soggiorno a cavallo di due mesi', () => {
  const f = occupazione();
  const aCavallo: Soggiorno = {
    giornoArrivo: 30, giornoPartenza: 2, mese: 'Oct', mesePartenza: 'Nov',
    camere: [
      { adulti: 2, bambini: 0, periodo: { g1: 30, g2: 31, mese: 'Oct' } },
      { adulti: 2, bambini: 0, periodo: { g1: 31, g2: 2, mese: 'Oct', mesePartenza: 'Nov' } },
    ],
  };
  const o = f(aCavallo, 2026, 2026);
  assert(o, 'a cavallo di due mesi non ha corretto niente');
  assertEquals(o!.adulti, 2);
});
