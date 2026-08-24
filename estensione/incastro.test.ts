/* ============================================================
   incastro.test.ts — quale camera libera conviene dare.

   L'IDEA VIENE DALLA PROPRIETA'. Una camera libera non vale
   l'altra: se il giorno dell'arrivo qualcuno parte da quella stanza,
   e il giorno della partenza ne arriva un altro, il soggiorno si
   infila fra due prenotazioni senza lasciare notti vuote. E' la
   camera che rende di piu', e finora per saperlo bisognava aprire
   il tableau e guardare a occhio.

   · verde    parte qualcuno all'arrivo E ne arriva uno alla partenza
   · giallo   attacca da un lato solo
   · arancione non attacca da nessuno: apre un buco

   IL DATO C'ERA GIA'. L'API delle camere restituisce le notti
   occupate: basta guardare la notte PRIMA dell'arrivo (chi parte
   quel giorno) e quella DEL giorno di partenza (chi arriva).

   MA LA FINESTRA NO. La chiamata chiedeva le camere sul solo periodo
   richiesto, e quelle due notti restavano fuori. Adesso si chiede un
   giorno in piu' da ogni lato — e le notti VERE del soggiorno si
   calcolano a parte, perche' stay_days comprende ora anche i due
   giorni aggiunti e usarlo direbbe occupata una camera libera.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';

const MODALE = Deno.readTextFileSync(new URL('fidra-disponibilita.js', import.meta.url));

/* le stesse regole del modale, che e' una IIFE sul DOM di Fidra e
   fuori dal browser non si esegue */
function piu(iso: string, q: number): string {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + q);
  return d.toISOString().slice(0, 10);
}
type Camere = { nottePrima: string; nottePartenza: string };
function incastro(occupate: string[], c: Camere): string {
  const occ = new Set(occupate);
  const a = occ.has(c.nottePrima), p = occ.has(c.nottePartenza);
  if (a && p) return 'pieno';
  if (a || p) return 'mezzo';
  return 'isolato';
}

const ARRIVO = '2026-09-25', PARTENZA = '2026-09-27';
const C: Camere = { nottePrima: piu(ARRIVO, -1), nottePartenza: PARTENZA };

Deno.test('la notte da guardare prima dell arrivo e il giorno precedente', () => {
  /* chi occupa la notte del 24 parte la mattina del 25: e' quello che
     libera la camera proprio quando serve */
  assertEquals(C.nottePrima, '2026-09-24');
  /* e la notte del giorno di partenza e' quella del 27: chi la occupa
     arriva il 27, cioe' il giorno in cui il nostro ospite se ne va */
  assertEquals(C.nottePartenza, '2026-09-27');
});

Deno.test('verde: si incastra fra due prenotazioni', () => {
  assertEquals(incastro(['2026-09-24', '2026-09-27'], C), 'pieno');
});

Deno.test('giallo: attacca da un lato solo', () => {
  assertEquals(incastro(['2026-09-24'], C), 'mezzo', 'parte qualcuno il giorno dell arrivo');
  assertEquals(incastro(['2026-09-27'], C), 'mezzo', 'arriva qualcuno il giorno della partenza');
});

Deno.test('arancione: non attacca con niente', () => {
  assertEquals(incastro([], C), 'isolato', 'camera vuota tutt intorno');
  assertEquals(
    incastro(['2026-09-20', '2026-10-05'], C),
    'isolato',
    'occupata lontano dal periodo: non e un incastro',
  );
});

Deno.test('la finestra si allarga di un giorno per lato', () => {
  assert(
    /piuUnGiorno\(arrivo, -1\)/.test(MODALE) && /piuUnGiorno\(partenza, 1\)/.test(MODALE),
    'la richiesta e tornata al solo periodo: le due notti che servono restano fuori',
  );
});

Deno.test('le notti vere del soggiorno non sono piu stay_days', () => {
  /* IL DIFETTO CHE L'ALLARGAMENTO AVREBBE CREATO. stay_days ora
     comprende anche i due giorni aggiunti: usarlo per decidere chi e'
     libero direbbe occupata una camera che invece si puo' vendere. */
  assert(
    /camere\.nottiRichieste \|\| camere\.stay_days/.test(MODALE),
    'libere() guarda di nuovo stay_days: con la finestra allargata scarterebbe camere libere',
  );
  assert(
    /camere\.nottiRichieste = notti/.test(MODALE),
    'le notti vere non si calcolano piu',
  );
});

Deno.test('i tre colori sono nel codice, e la camera della pratica resta rossa', () => {
  assert(/pieno:\s*\{ bordo: '#4A7A2E'/.test(MODALE), 'sparito il verde');
  assert(/mezzo:\s*\{ bordo: '#C9A227'/.test(MODALE), 'sparito il giallo');
  assert(/isolato:\s*\{ bordo: '#D08A3C'/.test(MODALE), 'sparito l arancione');
  assert(
    /camera di questa prenotazione/.test(MODALE),
    'la camera gia assegnata a questa pratica non si distingue piu',
  );
});
