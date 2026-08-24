/* ============================================================
   numeri-camere.test.ts — assegnare la camera dal riquadro, senza
   aprire la pratica.

   COM'ERA. Cliccando un numero non succedeva niente di buono: erano
   etichette, e il clic scivolava sotto fino alla scheda della
   categoria, che apre il tableau — cioe' proprio la schermata che si
   voleva evitare.

   COSA NON SO, ED E' IL PUNTO. Su /booking la prenotazione non esiste
   ancora: si sceglie la categoria, e il numero di solito si assegna
   dopo, sulla pratica. Se Fidra un campo per il numero non ce l'ha,
   nessun codice puo' inventarselo.

   Percio' non si indovina: si cerca un campo che accetti quel numero
   — una tendina che lo abbia fra le opzioni, o un campo che parli di
   camera — e se non c'e' il numero finisce negli appunti e il
   riquadro lo dice. Fingere di aver assegnato una camera che non e'
   stata assegnata sarebbe il difetto peggiore di tutta l'estensione:
   si scoprirebbe all'arrivo dell'ospite.

   leoCamere() elenca i campi visti, cosi' se un campo c'e' e non l'ho
   riconosciuto si chiude in un colpo — come e' successo con l'id del
   cliente, che era li' e bastava guardarlo.
   ============================================================ */
import { assert } from 'jsr:@std/assert';

const NUMERI = Deno.readTextFileSync(new URL('fidra-numeri-camere.js', import.meta.url));

Deno.test('i numeri sono pulsanti, e il clic non scivola sotto', () => {
  assert(
    /<button type="button" class="num"/.test(NUMERI),
    'i numeri sono tornati etichette: il clic finisce sul tableau',
  );
  assert(
    /ev\.stopPropagation\(\)/.test(NUMERI),
    'il clic scivola di nuovo sulla scheda della categoria, che apre il tableau',
  );
});

Deno.test('si scrive col setter nativo, non con .value', () => {
  /* i componenti di Fidra non si accorgono di un .value assegnato: il
     campo mostrerebbe il numero e il gestionale continuerebbe a non
     saperlo — un valore che si vede ma non c'e' */
  assert(
    /Object\.getOwnPropertyDescriptor\(proto, 'value'\)\?\.set/.test(NUMERI),
    'si torna ad assegnare .value: Fidra non se ne accorgerebbe',
  );
  assert(
    /new Event\('change', \{ bubbles: true \}\)/.test(NUMERI),
    'senza l evento change il componente non rilegge il campo',
  );
});

Deno.test('la tendina si riconosce dalle opzioni, non dal nome', () => {
  /* una tendina che ha proprio quel numero fra le opzioni e' il segnale
     piu' forte che esista: non dipende da come Fidra chiama i campi */
  assert(
    /\(o\.textContent \|\| ''\)\.trim\(\) === n \|\| String\(o\.value\)\.trim\(\) === n/.test(NUMERI),
    'la tendina non si cerca piu fra le opzioni: si torna a indovinare dal nome',
  );
});

Deno.test('non si scrive nel campo del cliente', () => {
  /* «numero» compare anche altrove: scrivere 217 nella ricerca cliente
     sarebbe silenzioso e fastidioso */
  assert(
    /cliente\|cerca cliente/.test(NUMERI),
    'il campo del cliente non e piu escluso: ci finirebbe dentro il numero di camera',
  );
});

Deno.test('se il campo non c e, lo dice E FA VEDERE PERCHE', () => {
  /* IL PRIMO USO HA DATO LA RISPOSTA: «Qui Fidra non ha un campo per il
     numero». Ed e' giusto cosi' — su /booking la prenotazione non esiste
     ancora, e finche' non la si crea non c'e' niente a cui attaccare un
     numero. Ma detto e basta lascia il dubbio che sia l'estensione a non
     saperlo cercare, e quel dubbio costa un giro di versioni.

     Percio' l'elenco dei campi che vedo sta nel riquadro, a un clic, non
     in una console che alla reception nessuno apre. */
  assert(
    /la prenotazione non esiste ancora/.test(NUMERI),
    'non spiega piu perche non si puo assegnare: sembra un difetto invece di un fatto',
  );
  assert(
    /<details/.test(NUMERI) && /campi che vedo/.test(NUMERI),
    'l elenco dei campi e tornato solo in console: dalla reception non lo guardera nessuno',
  );
  assert(
    /clipboard\.writeText\(n\)/.test(NUMERI),
    'il numero non finisce piu negli appunti: il ripiego era quello',
  );
  assert(/leoCamere/.test(NUMERI), 'sparita la diagnostica sui campi');
});

Deno.test('i numeri sono colorati come nel pannello prezzi', () => {
  /* la proprieta' li vuole colorati anche qui — anzi soprattutto qui, che
     e' il momento in cui la camera si sceglie. Le tinte sono le stesse di
     «Disponibilità e prezzi»: due codici diversi per la stessa cosa si
     scollerebbero al primo ritocco. */
  assert(/pieno:\s*\{ bordo: '#4A7A2E'/.test(NUMERI), 'sparito il verde');
  assert(/mezzo:\s*\{ bordo: '#C9A227'/.test(NUMERI), 'sparito il giallo');
  assert(/isolato:\s*\{ bordo: '#D08A3C'/.test(NUMERI), 'sparito l arancione');
  assert(
    /style="cursor:pointer;border:1px solid \$\{ve\.bordo\}/.test(NUMERI),
    'i numeri tornano tutti dello stesso colore: l incastro non si vede piu',
  );
});

Deno.test('la finestra si allarga di un giorno per lato, e le notti vere si contano a parte', () => {
  /* le due notti che dicono l'incastro stanno FUORI dal periodo chiesto:
     senza allargare, ogni camera sembrerebbe isolata. Ma allora stay_days
     comprende anche i giorni aggiunti, e usarlo per decidere chi e' libero
     direbbe occupata una camera vendibilissima. */
  assert(
    /piuUnGiorno\(da, -1\)/.test(NUMERI) && /piuUnGiorno\(a, 1\)/.test(NUMERI),
    'la richiesta e tornata al solo periodo: i numeri sarebbero tutti arancioni',
  );
  assert(
    !/const giorni = j\.stay_days/.test(NUMERI),
    'si torna a stay_days: con la finestra allargata scarterebbe camere libere',
  );
});

Deno.test('non si scrive dentro il nostro stesso riquadro', () => {
  assert(
    /el\.closest\('#' \+ ID\)/.test(NUMERI),
    'i campi del riquadro tornano candidati: scriveremmo dentro noi stessi',
  );
});
