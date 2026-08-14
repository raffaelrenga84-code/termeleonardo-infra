import { assertEquals } from 'jsr:@std/assert';
import { caparraCent, normalizzaDisponibilita } from './disponibilita.ts';

/* forma reale osservata il 14 agosto 2026: array di array, prezzi in
   centesimi, le tariffe dentro rate_variations */
const GREZZO = [[{
  room_category_id: 5,
  room_category: { id: 5, name: 'Doppia', max_adults: 2 },
  rates: [{
    id: 1, name: 'Soggiorno breve',
    rate_variations: [{
      id: 1, rate_name: 'Soggiorno breve', name: 'Mezza Pensione',
      full_name: 'Soggiorno breve Mezza Pensione',
      days: [{ for_date: '2026-09-16', price: 15500 }],
      adult_total: 15500, children_total: 0, total: 31000,
    }],
  }],
}]];

Deno.test('il totale resta in centesimi e lo dice il nome del campo', () => {
  const p = normalizzaDisponibilita(GREZZO, 'it');
  assertEquals(p.length, 1);
  assertEquals(p[0].prezzo_cent, 31000);
});

Deno.test('nome e identificativo della camera arrivano dal catalogo', () => {
  const p = normalizzaDisponibilita(GREZZO, 'it');
  assertEquals(p[0].camera_id, 5);
  assertEquals(p[0].nome, 'Doppia');
});

Deno.test('tariffa e trattamento restano distinti', () => {
  const p = normalizzaDisponibilita(GREZZO, 'it');
  assertEquals(p[0].tariffa, 'Soggiorno breve');
  assertEquals(p[0].trattamento, 'Mezza Pensione');
  assertEquals(p[0].variante_id, 1);
});

Deno.test('una risposta malformata non fa saltare la pagina', () => {
  assertEquals(normalizzaDisponibilita(null, 'it'), []);
  assertEquals(normalizzaDisponibilita([], 'it'), []);
  assertEquals(normalizzaDisponibilita([[{ room_category_id: 5 }]], 'it'), []);
});

/* 75 euro a PERSONA, non a camera: e' la regola che la reception applica
   gia' oggi. Su una doppia fa 150, non 75. */
Deno.test('la caparra e 75 euro per adulto', () => {
  assertEquals(caparraCent(1), 7500);
  assertEquals(caparraCent(2), 15000);
  assertEquals(caparraCent(4), 30000);
});

Deno.test('la caparra non va sotto un adulto', () => {
  assertEquals(caparraCent(0), 7500);
  assertEquals(caparraCent(-3), 7500);
});
