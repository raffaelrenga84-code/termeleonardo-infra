/* ============================================================
   comunicanti.test.ts — «le due camere sono comunicanti».

   IL CASO. Il 23 agosto 2026, su un'offerta a Emma Cersosimo gia'
   mandata, la reception ha dovuto scrivere una seconda email con
   una riga sola: «Le 2 matrimoniali sono comunicanti». Chi viaggia
   con figli lo chiede spesso, ed e' la riga che fa scegliere.

   LE COPPIE, NON LA CATEGORIA. La proprieta' le ha date il 24
   agosto: dodici camere, sei coppie, tutte Queen al terzo piano.
   Sapere che una camera PUO' comunicare non basta — la 319
   comunica con la 320 e con nessun'altra. Con la sola regola
   «Queen al terzo piano» si sarebbero promesse comunicanti due
   camere che non lo sono, e una promessa cosi' l'ospite la scopre
   all'arrivo, con i bambini in corridoio.

   PERCIO' QUESTA PROVA GUARDA SOPRATTUTTO I FALSI POSITIVI: che
   due Queen del terzo piano che non sono una coppia NON vengano
   dichiarate comunicanti.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';

const FILE = [
  'template.js', 'template-conferma.js', 'template-de.js',
  'template-en.js', 'template-fr.js', 'template-extra.js',
];
const SORGENTE = FILE.map((f) => Deno.readTextFileSync(new URL(f, import.meta.url))).join('\n');

const LINGUE = ['it', 'de', 'en', 'fr'] as const;
type Lingua = typeof LINGUE[number];

type Api = {
  comunicano: (a: string, b: string) => boolean;
  comunicanteDi: (n: string) => string | null;
  haComunicante: (n: string) => boolean;
  coppie: (camere: Array<{ numero: string | null }>) => string[][];
  riga: (camere: Array<{ numero: string | null }>, lingua: string) => string;
  elenco: string[][];
};

function api(): Api {
  const coda = `
    return { comunicano, comunicanteDi, haComunicante,
             coppie: coppieComunicanti, riga: rigaComunicanti, elenco: COMUNICANTI };`;
  return new Function(SORGENTE + coda)() as Api;
}

const cam = (...numeri: Array<string | null>) => numeri.map((numero) => ({ numero }));

Deno.test('le sei coppie sono quelle date dalla proprieta', () => {
  const a = api();
  assertEquals(a.elenco.length, 6, 'le coppie non sono piu sei');
  assertEquals(
    a.elenco.flat().sort(),
    ['319', '320', '321', '322', '323', '324', '325', '326', '327', '328', '329', '330'],
    'le camere comunicanti non sono piu le dodici indicate',
  );
});

Deno.test('319 comunica con 320, e con nessun altra', () => {
  const a = api();
  assert(a.comunicano('319', '320'), '319 e 320 sono una coppia');
  assert(a.comunicano('320', '319'), 'la coppia vale nei due versi');
  assertEquals(a.comunicanteDi('319'), '320');
  assertEquals(a.comunicanteDi('331'), null, 'una camera fuori elenco non comunica con niente');
});

Deno.test('IL FALSO POSITIVO: due Queen del terzo piano che non sono una coppia', () => {
  /* la trappola della regola «Queen al terzo piano»: 320 e 321 sono
     tutte e due comunicanti, ma NON fra loro — la 320 con la 319 e la
     321 con la 322. Prometterle comunicanti si scopre all'arrivo. */
  const a = api();
  assert(a.haComunicante('320') && a.haComunicante('321'), 'entrambe hanno una comunicante');
  assertEquals(a.comunicano('320', '321'), false, '320 e 321 NON comunicano fra loro');
  assertEquals(a.coppie(cam('320', '321')).length, 0, 'ha visto una coppia che non c e');
  assertEquals(a.riga(cam('320', '321'), 'it'), '', 'ha scritto «comunicanti» su due camere che non lo sono');
});

Deno.test('senza numero non si promette niente', () => {
  /* nelle offerte la camera spesso non ha ancora un numero: meglio non
     dirlo che dirlo a caso */
  const a = api();
  assertEquals(a.coppie(cam(null, null)).length, 0);
  assertEquals(a.riga(cam(null, null), 'it'), '');
  assertEquals(a.riga(cam('319', null), 'it'), '', 'una sola camera numerata non fa una coppia');
});

Deno.test('quando comunicano davvero, l email lo dice in tutte e quattro', () => {
  const a = api();
  const ATTESE: Record<Lingua, RegExp> = {
    it: /comunicanti/i,
    de: /Verbindungszimmer/i,
    en: /connecting/i,
    fr: /communicantes/i,
  };
  for (const l of LINGUE) {
    const html = a.riga(cam('319', '320'), l);
    assert(html.length > 50, `la riga manca in ${l}`);
    assert(ATTESE[l].test(html), `il testo non nomina le comunicanti in ${l}`);
  }
});

Deno.test('due coppie insieme si dicono al plurale', () => {
  const a = api();
  assertEquals(a.coppie(cam('319', '320', '321', '322')).length, 2);
  const html = a.riga(cam('319', '320', '321', '322'), 'it');
  assert(/a due a due/i.test(html), 'con due coppie il testo resta al singolare');
});

Deno.test('il pannello avvisa anche quando NON comunicano', () => {
  const pannello = Deno.readTextFileSync(new URL('popup.js', import.meta.url));
  assert(
    /coppieComunicanti\(d\.camere\)/.test(pannello),
    'il pannello non guarda piu le coppie',
  );
  assert(
    /Queen del terzo piano, ma non una coppia/.test(pannello),
    'sparito l avviso sul caso pericoloso: due comunicanti che non lo sono fra loro',
  );
});

Deno.test('il riquadro disponibilita mostra le coppie libere', () => {
  const modale = Deno.readTextFileSync(new URL('fidra-disponibilita.js', import.meta.url));
  assert(
    /libere\.has\(a\) && libere\.has\(b\)/.test(modale),
    'non controlla piu che siano libere TUTTE E DUE: sapere che la 319 e libera ' +
      'non serve se la 320 e occupata',
  );
});
