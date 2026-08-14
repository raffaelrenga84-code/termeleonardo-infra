import { assertEquals } from 'jsr:@std/assert';
import {
  caparraCent, componiRisposta, corpoDisponibilita, normalizzaDisponibilita,
} from './disponibilita.ts';

/* scorciatoia: qui interessa solo l'esito, non adulti e lingua */
const componiRispostaTest = (grezzo: unknown) => componiRisposta(grezzo, 2, 'it');

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

/* ================= C3: il formato che attraversa il confine =================
   check-availability dichiara `children_ages?: string` e la funzione `chat`,
   in produzione e funzionante, manda "4,9". Un array [4,9] o viene rifiutato
   (502: "non siamo riusciti a controllare la disponibilita") o viene ignorato,
   e allora il motore quota un prezzo che non tiene conto dei bambini — quel
   prezzo poi viene mostrato, scelto e archiviato. */
Deno.test('le eta dei bambini escono come stringa separata da virgole, come dalla chat', () => {
  const c = corpoDisponibilita({
    check_in: '2026-09-16', check_out: '2026-09-18',
    adulti: 2, bambini: 2, eta_bambini: [4, 9],
  });
  assertEquals(typeof c.children_ages, 'string');
  assertEquals(c.children_ages, '4,9');
});

Deno.test('il corpo usa i nomi dell API a monte, non i nostri', () => {
  const c = corpoDisponibilita({
    check_in: '2026-09-16', check_out: '2026-09-18',
    adulti: 3, bambini: 1, eta_bambini: [7],
  });
  assertEquals(c.from_date, '2026-09-16');
  assertEquals(c.to_date, '2026-09-18');
  assertEquals(c.adults, 3);
  assertEquals(c.children, 1);
  assertEquals(c.children_ages, '7');
});

Deno.test('senza bambini non si manda ne il numero ne le eta', () => {
  const c = corpoDisponibilita({
    check_in: '2026-09-16', check_out: '2026-09-18',
    adulti: 2, bambini: 0, eta_bambini: [],
  });
  assertEquals('children' in c, false);
  assertEquals('children_ages' in c, false);
});

/* ================= I6 e I7: non si mostra cio' che non si potra' inviare ====
   disponibilita.ts ripiegava sul nome dell'API per una categoria sconosciuta,
   ma tipi.ts la rifiuta con "camera sconosciuta": l'ospite la vedeva, la
   sceglieva, compilava tutto e leggeva un errore generico che non parla di
   camere. Stesso discorso per prezzi non interi o sopra il tetto. */
const conCategoria = (id: unknown, total: unknown, varianteId: unknown = 1) => [[{
  room_category_id: id,
  room_category: { id, name: 'Camera Nuova', max_adults: 2 },
  rates: [{ id: 1, name: 'Tariffa', rate_variations: [{
    id: varianteId, rate_name: 'Tariffa', name: 'Mezza Pensione', total,
  }] }],
}]];

Deno.test('una categoria che poi non sapremmo accettare non si mostra', () => {
  assertEquals(normalizzaDisponibilita(conCategoria(99, 20000), 'it'), []);
  assertEquals(normalizzaDisponibilita(conCategoria(5.5, 20000), 'it'), []);
});

Deno.test('un prezzo che l invio rifiuterebbe non si mostra', () => {
  assertEquals(normalizzaDisponibilita(conCategoria(5, 30999.5), 'it'), []);
  assertEquals(normalizzaDisponibilita(conCategoria(5, -100), 'it'), []);
  assertEquals(normalizzaDisponibilita(conCategoria(5, 99999999), 'it'), []);
});

Deno.test('una variante che l invio rifiuterebbe non si mostra', () => {
  assertEquals(normalizzaDisponibilita(conCategoria(5, 20000, -1), 'it'), []);
  assertEquals(normalizzaDisponibilita(conCategoria(5, 20000, 1.5), 'it'), []);
});

Deno.test('la camera buona resta, accanto a una che si scarta', () => {
  const misto = [[
    conCategoria(99, 20000)[0][0],
    conCategoria(5, 31000)[0][0],
  ]];
  const p = normalizzaDisponibilita(misto, 'it');
  assertEquals(p.length, 1);
  assertEquals(p[0].camera_id, 5);
});

/* ================= I8: un guasto non e' "albergo pieno" =================
   Con [] e esito 'ok' la pagina scriveva "Non risultano camere libere per
   queste date": l'ospite se ne va invece di telefonare. */
Deno.test('una risposta di forma inattesa non si racconta come albergo pieno', () => {
  assertEquals(componiRispostaTest(null).esito, 'errore');
  assertEquals(componiRispostaTest({ camere: [] }).esito, 'errore');
  assertEquals(componiRispostaTest('nessuna disponibilita').esito, 'errore');
  assertEquals(componiRispostaTest([{ room_category_id: 5 }]).esito, 'errore');
});

Deno.test('nessuna camera libera resta un esito normale', () => {
  assertEquals(componiRispostaTest([]).esito, 'ok');
  assertEquals(componiRispostaTest([[]]).esito, 'ok');
  assertEquals(componiRispostaTest([]).proposte.length, 0);
});

/* se il motore aggiunge una categoria e la scartiamo tutta, l'albergo non e'
   pieno: e' il nostro catalogo a essere indietro. Va detto di telefonare. */
Deno.test('se si scarta tutto non si dice albergo pieno', () => {
  assertEquals(componiRispostaTest(conCategoria(99, 20000)).esito, 'errore');
});

Deno.test('una camera valida resta un esito ok', () => {
  assertEquals(componiRispostaTest(GREZZO).esito, 'ok');
  assertEquals(componiRispostaTest(GREZZO).proposte.length, 1);
});
