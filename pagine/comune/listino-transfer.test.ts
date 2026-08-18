/* ============================================================
   listino-transfer.test.ts — la cifra da proporre alla reception.

   A COSA SERVE. Oggi chi conferma un transfer scrive il prezzo a mano nel
   messaggio («es. Il prezzo e' di 85 € a tratta, pagamento diretto
   all'autista»). Va cercato ogni volta, e ogni volta si puo' sbagliare.

   Qui il prezzo si PROPONE, non si decide: la reception se lo trova gia'
   scritto e lo conferma o lo corregge. E' quella conferma umana a rendere
   onesta la cifra che poi arriva all'ospite.

   IL DIFETTO CHE PRESIDIA. Proporre una cifra SBAGLIATA e' molto peggio che
   non proporne nessuna: una cifra scritta dal sistema si legge come
   verificata, e chi conferma in fretta la lascia passare. Quindi il listino
   parla solo dove il listino vero dice qualcosa, e tace su tutto il resto.

   Il listino vero, dalla pagina pubblica del sito:

       navetta condivisa (solo Venezia aeroporto)  65 € (1) · 95 € (2) · 135 € (3)
       taxi privato Venezia (aeroporto/citta')     135 €   1-4 passeggeri
       taxi privato Treviso                        150 €   1-4 passeggeri
       taxi privato Padova                          36 €
       stazione Terme Euganee / Abano               18 €
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';
import { prezzoTransfer } from './listino-transfer.js';

const corsa = (extra: Record<string, unknown> = {}) => ({
  luogo: 'Venezia  aeroporto', pax: 2, collettivo: false, ritorno: false, ...extra,
});

/* ---------- il taxi privato ---------- */

Deno.test('Venezia in privato costa 135 euro a tratta, da uno a quattro', () => {
  for (const pax of [1, 2, 3, 4]) {
    const p = prezzoTransfer(corsa({ pax }));
    assert(p, `a ${pax} passeggeri manca la proposta`);
    assertEquals(p.trattaCent, 13500, `a ${pax} passeggeri`);
  }
});

/* «Taxi privato — Venezia (aeroporto/citta')»: il porto e Piazzale Roma sono
   Venezia citta', e il listino li mette insieme all'aeroporto. */
Deno.test('il porto e Piazzale Roma sono Venezia, stesso prezzo', () => {
  for (const luogo of ['Venezia P.le Roma', 'Venezia porto']) {
    assertEquals(prezzoTransfer(corsa({ luogo }))?.trattaCent, 13500, luogo);
  }
});

Deno.test('Treviso, Padova e le stazioni vicine hanno il loro prezzo', () => {
  assertEquals(prezzoTransfer(corsa({ luogo: 'Treviso Aeroporto' }))?.trattaCent, 15000);
  assertEquals(prezzoTransfer(corsa({ luogo: 'Padova FS' }))?.trattaCent, 3600);
  assertEquals(prezzoTransfer(corsa({ luogo: 'Padova città' }))?.trattaCent, 3600);
  assertEquals(prezzoTransfer(corsa({ luogo: 'Terme  Euganee FS' }))?.trattaCent, 1800);
  assertEquals(prezzoTransfer(corsa({ luogo: 'Abano' }))?.trattaCent, 1800);
});

/* IL DIFETTO CENTRALE. Verona, Bologna, Mestre, i tre golf e Montegrotto nel
   listino pubblico non ci sono. Inventare una cifra qui vorrebbe dire
   mandarla all'ospite col nostro logo sopra. Meglio il silenzio: la reception
   la scrive a mano, come fa oggi. */
Deno.test('dove il listino tace, non si propone niente', () => {
  for (
    const luogo of [
      'Verona Aeroporto✈️', 'Bologna Aeroporto', 'Mestre fs', 'Montegrotto',
      'Golf Valsanzibio 🏌', 'Golf Montecchia🏌', 'Golf Frassanelle 🏌',
    ]
  ) {
    assertEquals(prezzoTransfer(corsa({ luogo })), null, `su ${luogo} non doveva proporre`);
  }
});

/* ---------- la navetta condivisa ---------- */

Deno.test('la navetta costa secondo quante persone sono', () => {
  assertEquals(prezzoTransfer(corsa({ collettivo: true, pax: 1 }))?.trattaCent, 6500);
  assertEquals(prezzoTransfer(corsa({ collettivo: true, pax: 2 }))?.trattaCent, 9500);
  assertEquals(prezzoTransfer(corsa({ collettivo: true, pax: 3 }))?.trattaCent, 13500);
});

/* La coincidenza da cui e' nata tutta questa storia, messa nero su bianco:
   a tre persone la reception vede proposta la stessa cifra nei due casi. */
Deno.test('a tre persone navetta e privato propongono la stessa cifra', () => {
  assertEquals(
    prezzoTransfer(corsa({ collettivo: true, pax: 3 }))?.trattaCent,
    prezzoTransfer(corsa({ collettivo: false, pax: 3 }))?.trattaCent,
  );
});

Deno.test('la navetta a quattro non esiste, e non si propone', () => {
  assertEquals(prezzoTransfer(corsa({ collettivo: true, pax: 4 })), null);
});

Deno.test('la navetta esiste solo su Venezia aeroporto', () => {
  assertEquals(prezzoTransfer(corsa({ collettivo: true, luogo: 'Treviso Aeroporto' })), null);
});

/* ---------- andata e ritorno ---------- */

/* Il listino e' A TRATTA — lo dice anche il testo che la reception scriveva a
   mano. Chi ha spuntato «mi serve anche il ritorno» ne fa due, e la cifra che
   deve avere pronta l'autista e' il totale. */
Deno.test('col ritorno le corse sono due e il totale raddoppia', () => {
  const p = prezzoTransfer(corsa({ ritorno: true }));
  assert(p);
  assertEquals(p.trattaCent, 13500);
  assertEquals(p.corse, 2);
  assertEquals(p.totaleCent, 27000);
});

Deno.test('senza ritorno la corsa e una sola e il totale e la tratta', () => {
  const p = prezzoTransfer(corsa());
  assert(p);
  assertEquals(p.corse, 1);
  assertEquals(p.totaleCent, p.trattaCent);
});

/* ---------- come sono scritti i numeri ---------- */

/* Centesimi, come prezzo_cent e caparra_cent nel resto del sistema. E' il
   trabocchetto gia' incontrato in email-richiesta.ts e in differenze.ts:
   13500 sono 135 euro, e nessuno deve leggerli come tredicimila. */
Deno.test('i prezzi sono in centesimi, interi', () => {
  for (const luogo of ['Venezia  aeroporto', 'Treviso Aeroporto', 'Abano']) {
    const p = prezzoTransfer(corsa({ luogo }));
    assert(p);
    assert(Number.isInteger(p.trattaCent), `${luogo}: ${p.trattaCent} non e un intero`);
    assert(p.trattaCent > 1000, `${luogo}: sembrano euro invece che centesimi`);
  }
});

Deno.test('senza luogo, o con dati assenti, non si propone niente', () => {
  assertEquals(prezzoTransfer(corsa({ luogo: '' })), null);
  assertEquals(prezzoTransfer(null), null);
});
