import { assert, assertEquals } from 'jsr:@std/assert';
import { buonoUsabileSu, codiceDaUrl, contieneDaySpa, normalizzaCodice, TIPI_COL_BUONO } from './buono-url.js';
import { differenzaBuono as dalServer } from '../../supabase/functions/richieste/differenza-buono.ts';
import { coperturaBuono, differenzaBuono as dallaPagina } from './buono-url.js';
import { TRATTAMENTI } from './trattamenti.js';
import { LISTINO } from '../../supabase/functions/buoni/acquista.ts';

Deno.test('il codice si legge dall indirizzo, ripulito', () => {
  assertEquals(codiceDaUrl('?buono=leo-abc-123'), 'LEO-ABC-123');
  assertEquals(codiceDaUrl('?buono=  LEO-ABC-123  '), 'LEO-ABC-123');
});

Deno.test('quello che non e un codice viene scartato', () => {
  for (const q of ['', '?buono=', '?buono=<script>', '?buono=' + 'A'.repeat(200), '?altro=x']) {
    assertEquals(codiceDaUrl(q), '', q);
  }
});

/* Le due implementazioni del conto devono dire la stessa cosa: una sbaglia
   e l'ospite legge una cifra sulla pagina e ne sente un'altra alla cassa.

   Non sei coppie scelte a mano ma una GRIGLIA: tutti i valori contro tutti.
   Dentro ci sono le forme che una risposta di rete puo' davvero avere e che
   sei coppie di numeri non toccavano mai — lo zero, il negativo, il nulla,
   la stringa vuota, un numero fuori scala.

   LA STRINGA '65' MERITA UNA RIGA A PARTE. Il ramo `typeof v === 'string'`
   di numero() esiste in tutte e due le copie (viene dal bando) ma la
   risposta vera non lo esercita: verificato il 17 agosto 2026, PostgREST
   serializza le colonne `numeric` come NUMERO JSON, non come stringa — la
   forma stringa e' una richiesta di funzionalita' aperta (discussione 2596
   del progetto), non il comportamento di oggi, e `?a=verifica` non fa
   nessun cast a `text`. Il ramo resta comunque una difesa che le due copie
   devono avere UGUALE: se una delle due lo perdesse, divergerebbero
   esattamente li', e questa griglia e' l'unico posto dove si vedrebbe. */
const VALORI: unknown[] = [0, -1, null, undefined, '', '65', 65, 65.5, 80.2, 1e21];
type Conto = (c: unknown, s: unknown) => { tipo: string };
const server = dalServer as unknown as Conto;
const pagina = dallaPagina as Conto;

Deno.test('il conto della pagina combacia con quello del server', () => {
  for (const c of VALORI) {
    for (const s of VALORI) {
      assertEquals(pagina(c, s), server(c, s), `copre ${String(c)}, scelto ${String(s)}`);
    }
  }
});

/* Il presidio deve guardare qualcosa: una griglia che producesse solo
   'ignoto' passerebbe anche se le due copie divergessero su tutto il
   resto. Stessa cautela di listino-copie.test.ts e trattamenti.test.ts. */
Deno.test('la griglia esercita davvero tutti e quattro gli esiti, non solo ignoto', () => {
  const visti = new Set<string>();
  for (const c of VALORI) for (const s of VALORI) visti.add(pagina(c, s).tipo);
  assertEquals([...visti].sort(), ['copre', 'differenza', 'ignoto', 'residuo']);
});

/* ---------------- quanto copre il buono, sul modulo dei trattamenti ----------------

   IL DIFETTO CHE PRESIDIA. `valore` e' la somma di tutto il buono (prezzo x
   quantita', fino a due voci — vedi sommaVoci in buoni/acquista.ts), e non
   e' affatto detto che sia spendibile nei trattamenti di questo modulo: un
   ingresso Day Spa non e' un trattamento da spuntare, e una quantita' di
   due non si puo' rappresentare con una casella sola. Usare `valore` come
   "quanto copre" fa dire alla pagina un numero sbagliato SUI SOLDI —
   all'ospite del buono "Day Spa + massaggio" diceva che stava perdendo 35 €
   di residuo che invece si tiene in tasca.
   La regola qui: quando il modulo non puo' rappresentare fedelmente quello
   che il buono contiene, `copre` torna null e la pagina TACE. Meglio non
   dire niente che dire una cifra falsa. */
const indiceDi = (id: string) => TRATTAMENTI.findIndex((t) => t.regalabile === id);
const prezzoDi = (id: string) => LISTINO[id][1];

Deno.test('un buono di un solo trattamento: copre il prezzo di listino, e la voce si preseleziona', () => {
  const c = coperturaBuono({ voci: [{ voce_id: 'hotstone55', quantita: 1 }], valore: 65 }, TRATTAMENTI);
  assertEquals(c.copre, prezzoDi('hotstone55'));
  assertEquals(c.indici, [indiceDi('hotstone55')]);
  assertEquals(c.ignorate, []);
});

Deno.test('Day Spa piu massaggio: il massaggio si preseleziona, ma la differenza si tace', () => {
  const c = coperturaBuono({
    voci: [{ voce_id: 'dayspa_fer', quantita: 1 }, { voce_id: 'hotstone55', quantita: 1 }],
    valore: 100,
  }, TRATTAMENTI);
  /* i 35 € dell'ingresso Day Spa NON sono un residuo che l'ospite perde:
     sono un ingresso che si tiene. Dirgli «residuo non rimborsabile»
     sarebbe falso, quindi non si dice niente. */
  assertEquals(c.copre, null);
  assertEquals(c.indici, [indiceDi('hotstone55')]);
  assertEquals(c.ignorate, ['dayspa_fer']);
});

Deno.test('due volte lo stesso trattamento: una casella sola non lo sa dire, e si tace', () => {
  const c = coperturaBuono({ voci: [{ voce_id: 'hotstone55', quantita: 2 }], valore: 130 }, TRATTAMENTI);
  assertEquals(c.copre, null);
  /* la casella si spunta lo stesso, una volta: e' il massimo che il modulo
     sa rappresentare, e il riquadro scrive comunque «2 ×» */
  assertEquals(c.indici, [indiceDi('hotstone55')]);
  /* e la quantita' va DETTA, perche' la richiesta che parte da qui parla di
     un massaggio solo: senza questo in reception preparerebbero un turno
     invece di due, e nessuno se ne accorgerebbe prima dell'arrivo */
  assertEquals(c.ripetute, ['hotstone55']);
});

Deno.test('senza quantita ripetute non c e niente da segnalare', () => {
  for (const voci of [
    [{ voce_id: 'hotstone55', quantita: 1 }],
    [{ voce_id: 'dayspa_fer', quantita: 1 }, { voce_id: 'hotstone55', quantita: 1 }],
    null,
  ]) {
    assertEquals(coperturaBuono({ voci, valore: 65 }, TRATTAMENTI).ripetute, [],
      `voci ${JSON.stringify(voci)}`);
  }
});

/* anche un ingresso Day Spa preso due volte va detto: qui non ha una
   casella, ma la reception deve sapere che gli ingressi sono due */
Deno.test('la quantita si segnala anche su una voce che il modulo non sa spuntare', () => {
  const c = coperturaBuono({ voci: [{ voce_id: 'dayspa_fer', quantita: 2 }], valore: 65 }, TRATTAMENTI);
  assertEquals(c.copre, null);
  assertEquals(c.indici, []);
  assertEquals(c.ripetute, ['dayspa_fer']);
});

Deno.test('un buono di solo Day Spa non copre nessun trattamento', () => {
  const c = coperturaBuono({ voci: [{ voce_id: 'dayspa_fer', quantita: 1 }], valore: 35 }, TRATTAMENTI);
  assertEquals(c.copre, null);
  assertEquals(c.indici, []);
  assertEquals(c.ignorate, ['dayspa_fer']);
});

Deno.test('un buono a importo libero copre il suo valore: li' + "' l'importo e' il buono", () => {
  for (const voci of [null, undefined, []]) {
    const c = coperturaBuono({ voci, valore: 100 }, TRATTAMENTI);
    assertEquals(c.copre, 100, `voci ${JSON.stringify(voci)}`);
    assertEquals(c.indici, []);
  }
});

Deno.test('una voce che questo modulo non conosce viene segnalata, non ignorata in silenzio', () => {
  const c = coperturaBuono({ voci: [{ voce_id: 'inventato99', quantita: 1 }], valore: 50 }, TRATTAMENTI);
  assertEquals(c.copre, null);
  assertEquals(c.indici, []);
  assertEquals(c.ignorate, ['inventato99']);
});

Deno.test('una voce malformata non fa esplodere il conto', () => {
  for (const voci of [[{}], [null], [{ voce_id: '', quantita: 1 }], 'non un elenco']) {
    const c = coperturaBuono({ voci, valore: 50 }, TRATTAMENTI);
    assert(c.copre === null || typeof c.copre === 'number', `voci ${JSON.stringify(voci)}`);
    assertEquals(c.indici, []);
  }
});

/* ---------------- la direzione opposta, che nessun test copriva ----------------
   trattamenti.test.ts verifica che ogni voce REGALABILE di trattamenti.js
   esista nel LISTINO dei buoni. Il contrario no: si poteva aggiungere una
   voce al LISTINO, venderla come buono, e scoprire solo dall'ospite che
   quel buono non preseleziona niente e non dice nessuna differenza.
   Gli ingressi Day Spa sono l'eccezione dichiarata: non sono trattamenti
   del reparto, non hanno una casella da spuntare qui, ed e' proprio per
   loro che `copre` sa tacere. */
const eIngressoDaySpa = (id: string) => id.startsWith('dayspa');
const daPreselezionare = () => Object.keys(LISTINO).filter((id) => !eIngressoDaySpa(id));

Deno.test('ogni voce del LISTINO che non e un ingresso Day Spa si puo preselezionare sul modulo', () => {
  const orfane = daPreselezionare().filter((id) => indiceDi(id) < 0);
  assertEquals(
    orfane,
    [],
    'queste voci si possono comprare come buono ma il modulo delle richieste non le ' +
      'sa preselezionare: chi arriva con quel buono trova il modulo vuoto e nessuna ' +
      'differenza. Aggiungi il `regalabile` corrispondente in trattamenti.js.',
  );
});

Deno.test('il presidio sulla preselezione guarda davvero un listino pieno', () => {
  assert(daPreselezionare().length > 15, `lette solo ${daPreselezionare().length} voci di LISTINO`);
  assert(TRATTAMENTI.length > 30, `letti solo ${TRATTAMENTI.length} trattamenti`);
});

/* ---------------- l'avviso deve gridare solo quando c'e' davvero qualcosa di storto ----------------
   Un normale buono Day Spa a una voce, aperto sul modulo Day Spa, faceva
   scattare `console.warn('voci del buono senza trattamento corrispondente')`
   A OGNI caricamento: `ignorate` contiene l'ingresso, che su quel modulo e'
   il caso NORMALE. Un avviso che suona sempre non si distingue piu' dal caso
   che deve pescare — una voce di listino che nessuno ha collegato, o un id
   tolto dal listino dopo la vendita.
   `sconosciute` e' `ignorate` meno gli ingressi: `ignorate` resta quello che
   e' perche' sul modulo dei trattamenti serve intero (e' da li' che esce la
   nota «il buono comprende anche un ingresso Day Spa»). */
Deno.test('un ingresso Day Spa e ignorato ma non e sconosciuto: niente da gridare', () => {
  const c = coperturaBuono({ voci: [{ voce_id: 'dayspa_fer', quantita: 1 }], valore: 35 }, TRATTAMENTI);
  assertEquals(c.ignorate, ['dayspa_fer'], 'sul modulo dei trattamenti serve ancora saperlo');
  assertEquals(c.sconosciute, [], 'un ingresso senza casella qui e il caso normale, non un difetto');
});

Deno.test('una voce che nessuno ha collegato resta sconosciuta: e quello l avviso vero', () => {
  const c = coperturaBuono({ voci: [{ voce_id: 'inventato99', quantita: 1 }], valore: 50 }, TRATTAMENTI);
  assertEquals(c.sconosciute, ['inventato99']);
});

/* il presidio che conta: con il listino di OGGI nessun buono vendibile deve
   far scattare l'avviso. Se domani ne nasce uno che lo fa, e' un difetto
   vero — ed e' esattamente quello che l'avviso deve pescare. */
Deno.test('nessuna voce del LISTINO di oggi fa scattare l avviso', () => {
  for (const id of Object.keys(LISTINO)) {
    const c = coperturaBuono({ voci: [{ voce_id: id, quantita: 1 }], valore: 1 }, TRATTAMENTI);
    assertEquals(c.sconosciute, [], `${id} farebbe suonare l avviso su un buono normale`);
  }
});

Deno.test('Day Spa piu massaggio: l ingresso resta fra le ignorate, ma niente e sconosciuto', () => {
  const c = coperturaBuono({
    voci: [{ voce_id: 'dayspa_fer', quantita: 1 }, { voce_id: 'hotstone55', quantita: 1 }],
    valore: 100,
  }, TRATTAMENTI);
  assertEquals(c.ignorate, ['dayspa_fer']);
  assertEquals(c.sconosciute, []);
});

/* ============================================================
   IL CODICE SCRITTO A MANO.

   IL DIFETTO CHE PRESIDIA. Il foglio A4 stampa l'indirizzo SENZA il codice
   — di proposito: e' un indirizzo che si digita da un foglio di carta, e
   ogni carattere in piu' e' un carattere in piu' da sbagliare. Il modulo,
   pero', leggeva il codice solo da `?buono=` nell'indirizzo. Le due
   decisioni sono giuste ognuna per conto suo e insieme non lasciavano
   nessuna strada: chi digitava l'indirizzo dal foglio arrivava su un modulo
   che il suo buono non poteva accettarlo, compilava una richiesta normale, e
   in reception non arrivava nessun segno del buono.

   Da qui in poi il codice puo' anche essere scritto a mano, e passa dalla
   STESSA ripulitura di quello che arriva dall'indirizzo: due ripuliture
   diverse vorrebbero dire che un codice accettato per una via viene
   rifiutato per l'altra.
   ============================================================ */
Deno.test('un codice scritto a mano si ripulisce come quello dell indirizzo', () => {
  for (const grezzo of ['leo-abc-123', '  LEO-ABC-123  ', 'Leo-Abc-123']) {
    assertEquals(normalizzaCodice(grezzo), 'LEO-ABC-123', grezzo);
  }
});

Deno.test('a mano si scarta esattamente cio che si scarta dall indirizzo', () => {
  /* la stessa lista dei casi rifiutati piu' sopra, senza il guscio `?buono=` */
  for (const grezzo of ['', '   ', '<script>', 'A'.repeat(41), 'LEO ABC', 'LEO_ABC']) {
    assertEquals(normalizzaCodice(grezzo), '', JSON.stringify(grezzo));
  }
});

Deno.test('le due vie non possono divergere: codiceDaUrl usa la stessa regola', () => {
  for (const grezzo of ['leo-abc-123', 'LEO-ABC-123', '<script>', 'A'.repeat(41), 'LEO_ABC', 'x']) {
    assertEquals(
      codiceDaUrl('?buono=' + encodeURIComponent(grezzo)),
      normalizzaCodice(grezzo),
      grezzo,
    );
  }
});

/* ============================================================
   CONTIENE UN DAY SPA?

   Domanda diversa da «dove si prenota». Su un buono MISTO — Day Spa piu' un
   massaggio — moduloDelBuono() risponde `trattamenti`, perche' i massaggi si
   devono poter spuntare; ma la piscina c'e' comunque, e la sua
   disponibilita' va mostrata.

   IL DIFETTO CHE PRESIDIA: senza questa distinzione chi ha un buono misto
   prenota alla cieca sulla piscina. E se la piscina e' piena, il massaggio
   da solo non lo voleva — e' la ragione per cui questa parte esiste.
   ============================================================ */
Deno.test('un buono misto contiene un Day Spa, anche se si prenota sui trattamenti', () => {
  const misto = {
    tipo: 'voce', voce_id: 'dayspa_fer',
    descrizione: '1 × Day Spa infrasettimanale — piscine e grotte\n1 × Massaggio Hot Stone (55 min)',
  };
  assertEquals(contieneDaySpa(misto), true);
});

Deno.test('un buono di soli trattamenti non contiene Day Spa', () => {
  const soloTratt = {
    tipo: 'voce', voce_id: 'hotstone55',
    descrizione: '1 × Massaggio Hot Stone (55 min)\n1 × Pulizia viso completa',
  };
  assertEquals(contieneDaySpa(soloTratt), false);
});

Deno.test('un buono di solo Day Spa lo contiene', () => {
  assertEquals(contieneDaySpa({ tipo: 'voce', voce_id: 'dayspa_sera', descrizione: '1 × Day Spa serale' }), true);
});

/* Un buono scritto in reception non ha voce di listino: comanda il testo. */
Deno.test('anche un buono scritto a mano si riconosce dal testo', () => {
  assertEquals(contieneDaySpa({ tipo: 'voce', descrizione: 'Ingresso Day Spa omaggio' }), true);
  assertEquals(contieneDaySpa({ tipo: 'voce', descrizione: 'Massaggio omaggio compleanno' }), false);
});

Deno.test('un buono a importo non contiene niente di preciso', () => {
  assertEquals(contieneDaySpa({ tipo: 'valore' }), false);
  assertEquals(contieneDaySpa(null), false);
});

/* ============================================================
   SU QUALI MODULI si può usare un buono.

   IL DIFETTO CHE PRESIDIA, e non è cosmetico. Il riquadro del buono
   compariva su tutti e sei i moduli, green fee e maestro e transfer
   compresi. Su quelli un buono non paga niente — il listino è tutto spa —
   ma bastava digitare un codice valido perché `avvisoInCima()` togliesse la
   promessa del prezzo, che è la frase scritta per chi il prezzo l'ha già
   pagato. Su un green fee si legge come «è già a posto», e non lo è.
   ============================================================ */
Deno.test('il buono si usa sui trattamenti e sul Day Spa', () => {
  assert(buonoUsabileSu('trattamenti'));
  assert(buonoUsabileSu('dayspa'));
});

Deno.test('non si usa dove non paga niente', () => {
  for (const tipo of ['greenfee', 'maestro', 'transfer', 'soggiorno', '', null, undefined]) {
    assertEquals(buonoUsabileSu(tipo), false, `${tipo} non doveva accettare un buono`);
  }
});

/* I due moduli ammessi sono quelli che un buono lo sanno RACCONTARE: i
   trattamenti calcolano la copertura, il Day Spa mostra cosa comprende.
   Aggiungerne un terzo senza quel riquadro rifarebbe il difetto. */
Deno.test('i moduli ammessi sono due, e sono quelli', () => {
  assertEquals(TIPI_COL_BUONO, ['trattamenti', 'dayspa']);
});
