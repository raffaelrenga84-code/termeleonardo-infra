/* ============================================================
   giorno-stesso.test.ts — dopo le 14:30 il giorno stesso non si prenota.

   IL DIFETTO CHE PRESIDIA, e non è un difetto di software. Le cameriere
   ai piani finiscono alle 15:30. Una richiesta per il giorno stesso che
   entra dopo non trova nessuno che prepari la camera, e sulle
   sistemazioni con LETTO AGGIUNTO il letto va montato: l'ospite arriva e
   la stanza non è pronta.

   TRE MODI DI SBAGLIARE, e nessuno si vede provando la pagina di mattina:

   · il limite si applica anche a domani — si rifiuterebbero prenotazioni
     buone, e nessuno capirebbe perché;
   · il limite non si applica per niente, che è il difetto di partenza;
   · il limite guarda l'orologio del dispositivo invece di quello
     italiano: allora funziona per chi prenota da Abano e sbaglia per chi
     prenota da Londra.

   Le prove passano un istante preciso: una prova sull'ora corrente
   sarebbe verde di mattina e rossa di pomeriggio.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';
import { adessoARoma } from '../comune/date.js';
import { chiusoPerOggi, LIMITE_MINUTI, oraLimite, PIANI_FINO_A } from './giorno-stesso.js';

const alle = (giorno: string, h: number, m: number) => ({ giorno, minuti: h * 60 + m });

Deno.test('un minuto prima del limite si prenota ancora', () => {
  assertEquals(chiusoPerOggi('2026-08-21', alle('2026-08-21', 14, 29)), false);
});

Deno.test('al limite in punto non si prenota piu', () => {
  assertEquals(chiusoPerOggi('2026-08-21', alle('2026-08-21', 14, 30)), true);
});

Deno.test('e la mattina si prenota tranquillamente', () => {
  assertEquals(chiusoPerOggi('2026-08-21', alle('2026-08-21', 9, 0)), false);
});

Deno.test('il limite vale SOLO per oggi, non per domani', () => {
  /* il danno peggiore in senso opposto: rifiutare prenotazioni buone.
     Alle 23:59 di stasera, per domani e per fra un mese, si prenota. */
  assertEquals(chiusoPerOggi('2026-08-22', alle('2026-08-21', 23, 59)), false);
  assertEquals(chiusoPerOggi('2026-09-30', alle('2026-08-21', 18, 0)), false);
});

Deno.test('ne per una data passata, che il server rifiuta da se', () => {
  assertEquals(chiusoPerOggi('2026-08-20', alle('2026-08-21', 18, 0)), false);
});

Deno.test('si sbaglia aperto: un dato guasto non rifiuta nessuno', () => {
  /* una richiesta che passa finisce comunque sul tavolo della reception,
     che chiama. Una rifiutata per sbaglio e' persa e nessuno lo sa. */
  const adesso = alle('2026-08-21', 18, 0);
  for (const d of ['', 'domani', '21/08/2026', null, undefined, '2026-8-21']) {
    assertEquals(chiusoPerOggi(d as string, adesso), false, `la data «${d}» ha rifiutato`);
  }
  for (const a of [null, undefined, {}, { giorno: '2026-08-21' }, { minuti: 1080 }]) {
    assertEquals(
      chiusoPerOggi('2026-08-21', a as unknown as { giorno: string; minuti: number }),
      false,
      'un orologio guasto ha rifiutato',
    );
  }
});

Deno.test('l ora scritta all ospite e la stessa che decide', () => {
  /* se il testo dicesse «14:30» e il controllo scattasse alle 15:00,
     l'ospite leggerebbe una bugia senza modo di accorgersene */
  assertEquals(oraLimite(), '14:30');
  const [h, m] = oraLimite().split(':').map(Number);
  assertEquals(h * 60 + m, LIMITE_MINUTI);
});

Deno.test('e il limite sta prima dell ora in cui i piani finiscono', () => {
  /* il margine e' il senso della regola: una richiesta che entra alle
     15:29 non e' una camera pronta alle 15:30 */
  const [h, m] = PIANI_FINO_A.split(':').map(Number);
  assert(
    LIMITE_MINUTI < h * 60 + m,
    `il limite (${oraLimite()}) non sta prima delle ${PIANI_FINO_A}: non resta margine`,
  );
});

Deno.test('e l orologio e quello italiano, non quello del telefono', () => {
  /* la prova che lega le due parti: alle 13:00 UTC d'estate in Italia sono
     le 15:00, quindi e' chiuso — anche se il dispositivo di chi guarda
     segna le 13:00 e crederebbe di essere in tempo */
  const adesso = adessoARoma(new Date('2026-08-21T13:00:00Z'));
  assertEquals(adesso.giorno, '2026-08-21');
  assertEquals(chiusoPerOggi('2026-08-21', adesso), true);
});

Deno.test('la pagina si ferma davvero, e lo dice prima del clic', () => {
  const pagina = Deno.readTextFileSync(new URL('index.html', import.meta.url));
  /* la FORMA del controllo dentro la ricerca, non la sola chiamata: la
     chiamata vive anche nell'avviso accanto alle date, quindi cercarla e
     basta resta verde anche quando la ricerca smette di controllare.
     E' successo: la mutazione e sopravvissuta. */
  assert(
    pagina.includes('if (chiusoPerOggi(arrivo, adessoARoma())) {'),
    'la ricerca non si ferma piu sul giorno stesso: partirebbe lo stesso',
  );
  const controlli = pagina.split('chiusoPerOggi(').length - 1;
  assert(
    controlli >= 2,
    'il controllo e rimasto in un posto solo: o l avviso o il blocco, non tutti e due',
  );
  assert(
    pagina.includes("addEventListener('change', avvisoGiornoStesso)"),
    'l avviso non compare piu al cambio della data: si scoprirebbe solo premendo Cerca',
  );
  assert(
    pagina.includes('t.giornoStesso(oraLimite())'),
    'il testo non prende piu l ora dal limite: potrebbero divergere',
  );
});
