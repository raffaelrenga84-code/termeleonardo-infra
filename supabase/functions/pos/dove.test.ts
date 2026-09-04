/* ============================================================
   dove.test.ts — dove si prepara, e dove va portato.
   ============================================================ */
import { assertEquals } from 'jsr:@std/assert';
import { localeChePrepara, portareA } from './dove.ts';

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
