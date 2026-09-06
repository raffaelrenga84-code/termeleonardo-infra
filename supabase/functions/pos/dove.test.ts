/* ============================================================
   dove.test.ts — dove si prepara, e dove va portato.
   ============================================================ */
import { assertEquals } from 'jsr:@std/assert';
import { localeChePrepara, portareA, siStampa } from './dove.ts';

const nomi: Record<string, string> = { bistrot: 'Bistrot', ristorante: 'Ristorante' };
const nomeDelLocale = (id: string) => nomi[id] ?? null;

Deno.test('di regola si prepara dove si mangia', () => {
  assertEquals(localeChePrepara({ tavolo: 'ristorante' }), 'ristorante');
  assertEquals(localeChePrepara({ riga: null, articolo: null, categoria: '  ', tavolo: 'bistrot' }), 'bistrot');
});

Deno.test('vince la scelta piu precisa: riga, poi articolo, poi categoria', () => {
  assertEquals(localeChePrepara({ categoria: 'bistrot', tavolo: 'ristorante' }), 'bistrot');
  assertEquals(localeChePrepara({ articolo: 'ristorante', categoria: 'bistrot', tavolo: 'ristorante' }), 'ristorante');
  assertEquals(localeChePrepara({ riga: 'bistrot', articolo: 'ristorante', categoria: 'ristorante', tavolo: 'ristorante' }), 'bistrot');
});

Deno.test('sul biglietto che esce altrove c e scritto dove portarlo', () => {
  /* il barman del Bistrot deve sapere che si mangia al Ristorante */
  assertEquals(portareA({ preparaIn: 'bistrot', tavoloIn: 'ristorante', nomeDelLocale }), 'Ristorante');
  assertEquals(portareA({ preparaIn: 'bistrot', tavoloIn: 'bistrot', nomeDelLocale }), null, 'si serve li: niente da dire');
  /* un locale che non conosciamo: si stampa il suo codice, non niente */
  assertEquals(portareA({ preparaIn: 'bistrot', tavoloIn: 'piscina', nomeDelLocale }), 'piscina');
});

Deno.test('dove non c e stampante non si stampa', () => {
  /* «la cucina del ristorante non ha stampante e neppure il ristorante»
     (la proprieta', 4 settembre 2026): un biglietto per il ristorante
     resterebbe in coda per sempre */
  const bistrot = { stampante_cucina: '192.168.0.192:9100', stampante_bar: '192.168.0.191:9100' };
  const ristorante = { stampante_cucina: null, stampante_bar: '' };
  assertEquals(siStampa({ stampante: 'bar', locale: bistrot }), true);
  assertEquals(siStampa({ stampante: 'cucina', locale: bistrot }), true);
  assertEquals(siStampa({ stampante: 'cucina', locale: ristorante }), false);
  assertEquals(siStampa({ stampante: 'bar', locale: ristorante }), false, 'una stringa vuota non e una stampante');
  assertEquals(siStampa({ stampante: 'bar', locale: null }), false);
  assertEquals(siStampa({ stampante: 'bar', locale: undefined }), false);
});

Deno.test('con uno schermo si stampa anche dove non c e la stampante', () => {
  /* il ristorante non ha stampanti, ma un giorno puo' avere un monitor
     (la proprieta', 6 settembre 2026): il biglietto nasce lo stesso */
  const ristorante = { stampante_cucina: null, stampante_bar: '' };
  assertEquals(siStampa({ stampante: 'cucina', locale: ristorante, postazione: { schermo: true } }), true);
  assertEquals(siStampa({ stampante: 'cucina', locale: ristorante, postazione: { schermo: 1 } }), true, 'da SQLite');
  assertEquals(siStampa({ stampante: 'cucina', locale: ristorante, postazione: { schermo: false } }), false);
  assertEquals(siStampa({ stampante: 'cucina', locale: ristorante, postazione: null }), false);
  assertEquals(siStampa({ stampante: 'cucina', locale: null, postazione: { schermo: true } }), true, 'lo schermo basta anche senza locale');
});
