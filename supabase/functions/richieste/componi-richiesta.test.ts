/* componi-richiesta.test.ts — presidio della falla del 14 agosto 2026: la
   camera scelta su una richiesta di soggiorno deve finire nella colonna
   jsonb `dati`, non sparire. E chi non sceglie una camera (es. la chat, che
   manda tipo:'soggiorno' senza campo dati) deve continuare a vedersi
   scrivere `dati: null`, non un oggetto vuoto.

   Non importa index.ts: chiama Deno.serve in cima al file e avvierebbe un
   server vero durante il test — vedi la stessa nota in
   disponibilita-azione.test.ts. */
import { assertEquals } from 'jsr:@std/assert';
import { componiRichiesta } from './componi-richiesta.ts';

const CONTATTI_BASE = {
  nome: 'Anna Bianchi', email: 'anna@example.com', telefono: '333 1234567',
  privacy_presa_atto: true, lingua: 'it',
  check_in: '2026-09-16', check_out: '2026-09-17',
};

Deno.test('la camera scelta in una richiesta di soggiorno finisce davvero in dati', () => {
  const r = componiRichiesta({
    tipo: 'soggiorno', ...CONTATTI_BASE,
    dati: { camera_id: 5, variante_id: 12, tariffa: 'BAR', trattamento: 'Bed & Breakfast', prezzo_cent: 31000 },
  });
  assertEquals(r.errore, undefined);
  assertEquals(r.dati?.camera_id, 5);
  assertEquals(r.dati?.variante_id, 12);
  assertEquals(r.dati?.prezzo_cent, 31000);
  assertEquals(r.dati?.valuta, 'centesimi');
});

Deno.test('un soggiorno senza camera scelta produce dati null, non un oggetto vuoto', () => {
  /* questo e' il caso della chat (chat/index.ts, invia_richiesta): manda
     tipo:'soggiorno' e non manda affatto il campo dati */
  const r = componiRichiesta({ tipo: 'soggiorno', ...CONTATTI_BASE });
  assertEquals(r.errore, undefined);
  assertEquals(r.dati, null);
});

Deno.test('un soggiorno con dati:{} esplicito produce comunque null, non {}', () => {
  const r = componiRichiesta({ tipo: 'soggiorno', ...CONTATTI_BASE, dati: {} });
  assertEquals(r.errore, undefined);
  assertEquals(r.dati, null);
});

Deno.test('la validazione della camera non si aggira: una camera inesistente respinge tutta la richiesta', () => {
  const r = componiRichiesta({
    tipo: 'soggiorno', ...CONTATTI_BASE,
    dati: { camera_id: 999 },
  });
  assertEquals(r.errore, 'camera sconosciuta');
});

Deno.test('un prezzo assurdo sulla camera scelta respinge la richiesta, come su tipi.test.ts', () => {
  const r = componiRichiesta({
    tipo: 'soggiorno', ...CONTATTI_BASE,
    dati: { camera_id: 5, prezzo_cent: -1 },
  });
  assertEquals(r.errore, 'prezzo non valido');
});

Deno.test('i tipi diversi dal soggiorno non cambiano comportamento', () => {
  const r = componiRichiesta({
    tipo: 'transfer', nome: 'Anna Bianchi', email: 'anna@example.com', telefono: '',
    privacy_presa_atto: true, lingua: 'it',
    dati: { quando: '2026-09-16', ora: '09:00', pax: 2, verso: 'arrivo', luogo: 'Padova FS' },
  });
  assertEquals(r.errore, undefined);
  assertEquals(r.dati?.luogo, 'Padova FS');
});
