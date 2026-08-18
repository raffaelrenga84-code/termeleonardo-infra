/* ============================================================
   navetta.test.ts — quando offrire la navetta condivisa, e cosa dirle.

   IL DIFETTO CHE PRESIDIA. Il listino dell'hotel:

       navetta condivisa   65 € (1)   95 € (2)   135 € (3)   — (4)
       taxi privato       135 €      135 €      135 €      135 €

   A TRE PASSEGGERI LA NAVETTA COSTA COME IL PRIVATO. Scrivere «costa meno»
   accanto a quel pulsante e' una bugia che costa all'ospite la comodita' di
   un'auto sua in cambio di zero euro. A quattro la navetta non e' nemmeno in
   listino, e il privato li porta tutti allo stesso prezzo.

   E vale solo per Venezia aeroporto: sulle altre undici destinazioni del
   modulo la condivisa non la vendiamo.

   Modulo puro: dati dentro, una risposta fuori. `adesso` si passa da fuori
   proprio perche' una prova non deve dipendere da che ora e'.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';
import { navetta } from './navetta.js';

/* il valore della meta e' quello VERO del modulo, con i DUE spazi: deve
   combaciare parola per parola con l'elenco di atam.biz */
const AEROPORTO = 'Venezia  aeroporto';

const ADESSO = new Date('2026-08-18T10:00:00');
const FRA_TRE_GIORNI = '2026-08-21';

const corsa = (extra: Record<string, unknown> = {}) => ({
  luogo: AEROPORTO, pax: 2, quando: FRA_TRE_GIORNI, ora: '15:30', ...extra,
});

/* ---------- quanti passeggeri ---------- */

Deno.test('a una e a due persone la navetta si offre, e costa davvero meno', () => {
  for (const pax of [1, 2]) {
    const n = navetta(corsa({ pax }), ADESSO);
    assert(n, `a ${pax} passeggeri la navetta doveva comparire`);
    assertEquals(n.nota, 'costaMeno', `a ${pax} passeggeri`);
  }
});

/* IL DIFETTO CENTRALE: a tre il prezzo coincide, 135 € e 135 €. Il pulsante
   resta — non si nasconde un'opzione a chi ha diritto di vederla — ma la
   frase deve dire il vero. */
Deno.test('a tre persone la navetta si offre, ma NON dice che costa meno', () => {
  const n = navetta(corsa({ pax: 3 }), ADESSO);
  assert(n, 'a tre persone la navetta doveva comparire lo stesso');
  assertEquals(n.nota, 'stessoPrezzo');
});

Deno.test('a quattro persone la navetta non compare: in listino non c e', () => {
  assertEquals(navetta(corsa({ pax: 4 }), ADESSO), null);
  assertEquals(navetta(corsa({ pax: 8 }), ADESSO), null);
});

/* ---------- dove ---------- */

Deno.test('sulle altre destinazioni la navetta non si vende', () => {
  for (
    const luogo of [
      'Treviso Aeroporto', 'Verona Aeroporto✈️', 'Bologna Aeroporto',
      'Venezia P.le Roma', 'Venezia porto', 'Padova FS', 'Terme  Euganee FS',
      'Mestre fs', 'Golf Valsanzibio 🏌', 'Golf Montecchia🏌',
      'Golf Frassanelle 🏌', 'Abano', 'Padova città',
    ]
  ) {
    assertEquals(navetta(corsa({ luogo }), ADESSO), null, `su ${luogo}`);
  }
});

/* IL TRABOCCHETTO SILENZIOSO. Il valore della meta ha DUE spazi perche' deve
   combaciare con l'elenco di atam.biz. Una regola scritta con uno spazio solo
   non scatterebbe mai, e nessuno saprebbe perche': la navetta semplicemente
   non comparirebbe. Si confrontano normalizzati, come fa atam-booking.js. */
Deno.test('l aeroporto combacia con due spazi e anche con uno solo', () => {
  for (const luogo of ['Venezia  aeroporto', 'Venezia aeroporto', 'VENEZIA  AEROPORTO', ' Venezia  aeroporto ']) {
    assert(navetta(corsa({ luogo }), ADESSO), `doveva combaciare: "${luogo}"`);
  }
});

/* ---------- quanto preavviso ---------- */

Deno.test('sotto le 24 ore la navetta non compare: il listino le chiede', () => {
  /* stasera alle 18: mancano 8 ore */
  assertEquals(navetta(corsa({ quando: '2026-08-18', ora: '18:00' }), ADESSO), null);
  /* domani alle 9: mancano 23 ore, ancora poche */
  assertEquals(navetta(corsa({ quando: '2026-08-19', ora: '09:00' }), ADESSO), null);
});

Deno.test('da 24 ore in su la navetta compare', () => {
  /* domani alle 11: 25 ore */
  assert(navetta(corsa({ quando: '2026-08-19', ora: '11:00' }), ADESSO));
});

/* Senza l'ora non si sa ancora a che ora parte: si giudica sull'inizio del
   giorno, il momento piu' presto possibile. Cosi' la navetta compare solo
   quando e' certo che ci sia, e non sparisce piu' quando l'ospite sceglie
   l'ora — un'opzione che si ritira e' peggio di una che arriva tardi. */
Deno.test('senza l ora si giudica sul momento piu presto del giorno', () => {
  assertEquals(navetta(corsa({ quando: '2026-08-19', ora: '' }), ADESSO), null);
  assert(navetta(corsa({ quando: FRA_TRE_GIORNI, ora: '' }), ADESSO));
});

/* ---------- dati mancanti ---------- */

Deno.test('senza giorno o senza luogo non si offre niente', () => {
  assertEquals(navetta(corsa({ quando: '' }), ADESSO), null);
  assertEquals(navetta(corsa({ luogo: '' }), ADESSO), null);
  assertEquals(navetta(null, ADESSO), null);
});

/* Il modulo parte con «2» gia' scritto nel campo, ma un ospite puo' svuotarlo.
   Un pax vuoto non deve far sparire la navetta come se fossero in quattro. */
Deno.test('un numero di passeggeri vuoto vale come uno', () => {
  const n = navetta(corsa({ pax: '' }), ADESSO);
  assert(n, 'con il campo vuoto la navetta doveva comparire');
  assertEquals(n.nota, 'costaMeno');
});
