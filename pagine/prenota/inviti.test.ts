/* ============================================================
   inviti.test.ts — transfer e trattamenti dopo la richiesta di camera.

   LA SCELTA CHE PRESIDIA. Transfer e trattamenti restano richieste loro,
   coi moduli che esistono già: non entrano nel percorso della camera e
   non entrano nella ricevuta. Nel percorso no perché la camera non è
   ancora confermata e ogni passo in più costa richieste; nella ricevuta
   no perché quell'email è già densa — prezzo, caparra, tassa di
   soggiorno, cane — e due inviti commerciali dentro una ricevuta si
   leggono male.

   Stanno sulla schermata finale, dove l'ospite è ancora davanti allo
   schermo e ha appena finito.

   IL DIFETTO CHE PRESIDIA. I contatti si leggono dai campi del modulo, e
   quando la schermata finale si disegna quei campi NON ESISTONO PIÙ: il
   DOM è stato sostituito. Se non si conservano prima, i collegamenti
   escono nudi e l'ospite ridigita tutto — che è esattamente la cosa che
   questi inviti servono a evitare.
   ============================================================ */
import { assert } from 'jsr:@std/assert';

const PAGINA = Deno.readTextFileSync(new URL('index.html', import.meta.url));

Deno.test('la schermata finale offre tutti e due i moduli', () => {
  assert(
    PAGINA.includes("indirizzoModulo('trattamenti', LNG, OSPITE)"),
    'sparito l invito ai trattamenti',
  );
  assert(
    PAGINA.includes("indirizzoModulo('transfer', LNG, OSPITE)"),
    'sparito l invito al transfer',
  );
});

Deno.test('e i contatti si conservano PRIMA che il modulo sparisca', () => {
  /* l ordine e' il presidio: se OSPITE si riempisse dopo STATO='fatta', i
     campi sarebbero gia' spariti dal DOM e i collegamenti uscirebbero nudi */
  const dove = PAGINA.indexOf('OSPITE = {');
  const poi = PAGINA.indexOf("STATO = 'fatta'", dove);
  assert(dove > 0, 'i contatti non si conservano piu');
  assert(poi > dove, 'i contatti si conservano DOPO il cambio di schermata: usciranno vuoti');
});

Deno.test('e senza contatti gli inviti non escono affatto', () => {
  /* un pulsante «i suoi dati sono gia compilati» che apre un modulo vuoto
     e' peggio di nessun pulsante */
  assert(
    PAGINA.includes('${OSPITE ? `'),
    'gli inviti escono anche senza contatti: prometterebbero un modulo gia pieno e ne aprirebbero uno vuoto',
  );
});

Deno.test('e in ogni lingua dicono che i dati sono gia dentro', () => {
  const note = [...PAGINA.matchAll(/invitoNota:'([^']*)'/g)].map((m) => m[1]);
  assert(note.length === 4, `le note degli inviti sono ${note.length}, non 4`);
  for (const [i, n] of note.entries()) {
    assert(n.trim().length > 20, `nota ${i + 1} troppo corta: «${n}»`);
  }
});
