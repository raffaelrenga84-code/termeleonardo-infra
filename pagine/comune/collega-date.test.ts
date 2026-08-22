/* ============================================================
   collega-date.test.ts — i due campi data si parlano.

   IL DIFETTO, provato dalla proprietà su iPhone il 22 agosto 2026:

   · scegliendo l'arrivo il pannello del calendario NON SI CHIUDE. Chi
     crede di stare scegliendo la partenza continua a spostare l'arrivo,
     e non se ne accorge finché non guarda i due campi;
   · la partenza accettava una data PRECEDENTE all'arrivo — visto dal
     vivo: arrivo 26 agosto, partenza 22. Il collegamento ascoltava solo
     l'arrivo, quindi una partenza sbagliata scelta a mano non la
     correggeva nessuno, e restava a schermo un soggiorno che il server
     rifiuta dopo aver fatto compilare tutto il resto.

   COME SI PROVA SENZA UN TELEFONO. Con due campi finti che si comportano
   come quelli veri: tengono un valore, un `min`, e chiamano i gestori
   quando si dice loro che qualcosa è cambiato. È lo stesso mestiere del
   browser, ridotto a quello che serve.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';
import { collegaArrivoPartenza } from './date.js';

type Campo = {
  value: string;
  min: string;
  gestori: Record<string, (() => void)[]>;
  addEventListener: (ev: string, f: () => void) => void;
  scatta: (ev: string) => void;
  blur: () => void;
  focus: () => void;
  chiuso: boolean;
  aperto: boolean;
};

function campo(valore = ''): Campo {
  const c: Campo = {
    value: valore,
    min: '',
    gestori: {},
    chiuso: false,
    aperto: false,
    addEventListener(ev, f) {
      (c.gestori[ev] ||= []).push(f);
    },
    scatta(ev) {
      for (const f of c.gestori[ev] || []) f();
    },
    blur() {
      c.chiuso = true;
    },
    focus() {
      c.aperto = true;
    },
  };
  return c;
}

Deno.test('scelto l arrivo, la partenza non puo essere prima', () => {
  const a = campo();
  const p = campo();
  collegaArrivoPartenza(a, p);
  a.value = '2026-08-26';
  a.scatta('change');
  assertEquals(p.min, '2026-08-27', 'la partenza accetta ancora giorni prima dell arrivo');
});

Deno.test('e una partenza sbagliata scelta a mano viene buttata', () => {
  /* IL DIFETTO VISTO SU IPHONE: arrivo 26 agosto, partenza 22. Il
     collegamento ascoltava il solo arrivo, quindi nessuno correggeva. */
  const a = campo('2026-08-26');
  const p = campo();
  collegaArrivoPartenza(a, p);
  p.value = '2026-08-22';
  p.scatta('change');
  assertEquals(p.value, '', 'una partenza precedente all arrivo resta a schermo');
});

Deno.test('e succede anche mentre si sceglie, non solo alla fine', () => {
  /* sul calendario di iOS il valore cambia col pannello ancora aperto:
     aspettare `change` lascia il minimo indietro di un passo */
  const a = campo();
  const p = campo();
  collegaArrivoPartenza(a, p);
  a.value = '2026-09-10';
  a.scatta('input');
  assertEquals(p.min, '2026-09-11');
});

Deno.test('scelto l arrivo si chiude il suo calendario e si apre l altro', () => {
  /* su iPhone il pannello non si chiude da solo: chi ha appena scelto
     l arrivo crede di stare scegliendo la partenza */
  const a = campo();
  const p = campo();
  collegaArrivoPartenza(a, p);
  a.value = '2026-08-22';
  a.scatta('change');
  assert(a.chiuso, 'il calendario dell arrivo resta aperto');
  assert(p.aperto, 'il calendario della partenza non si apre');
});

Deno.test('ma non ruba il fuoco a chi sta solo correggendo l arrivo', () => {
  /* con una partenza gia scelta e coerente, spostare l arrivo indietro
     non deve far saltare il fuoco altrove: l ospite sta lavorando li */
  const a = campo('2026-08-26');
  const p = campo('2026-09-02');
  collegaArrivoPartenza(a, p);
  a.value = '2026-08-25';
  a.scatta('change');
  assertEquals(p.value, '2026-09-02', 'una partenza buona e stata buttata');
  assertEquals(p.aperto, false, 'ha rubato il fuoco mentre l ospite correggeva l arrivo');
});

Deno.test('e un arrivo a meta non fa saltare niente', () => {
  /* chi scrive la data a tastiera passa per valori incompleti: interromperlo
     a meta parola e peggio che non aiutarlo */
  const a = campo();
  const p = campo();
  collegaArrivoPartenza(a, p);
  for (const v of ['2', '20', '2026-0', 'domani', '']) {
    a.value = v;
    a.scatta('change');
    assertEquals(p.aperto, false, `il valore «${v}» ha aperto il calendario della partenza`);
  }
});

Deno.test('e senza uno dei due campi non esplode niente', () => {
  collegaArrivoPartenza(null as unknown as Campo, campo());
  collegaArrivoPartenza(campo(), null as unknown as Campo);
});
