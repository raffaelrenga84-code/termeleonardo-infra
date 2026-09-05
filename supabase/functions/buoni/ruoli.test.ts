/* ============================================================
   ruoli.test.ts — quali buoni vede la spa.

   LA RICHIESTA: `spa@termeleonardo.com` deve vedere «anche i buoni regalo,
   ma solo quelli con trattamenti e massaggi».

   IL FATTO CHE SEMPLIFICA TUTTO: il listino dei buoni e' INTERAMENTE spa —
   programmi, massaggi, viso, corpo e i tre ingressi Day Spa. Non ci sono
   cene, soggiorni o green fee. Quindi «un buono con dei trattamenti» e «un
   buono che non e' denaro» oggi sono la stessa cosa.

   IL DIFETTO CHE QUESTA SEMPLICITA' NASCONDE, e la guardia che serve: il
   giorno che qualcuno aggiunge al listino una cena o un soggiorno, la
   regola «non e' denaro dunque e' della spa» diventa falsa in silenzio, e
   la spa si troverebbe in elenco buoni che non la riguardano senza che
   nessuno l'abbia deciso. Per questo una prova qui sotto passa in rassegna
   TUTTO il listino: se compare una voce che non appartiene a una famiglia
   della spa, diventa rossa e costringe a decidere.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';
import { LISTINO } from './acquista.ts';
import { buonoDellaSpa, FAMIGLIE_SPA, puoScrivereBuoni, riscuotibileDalTotem, ruoloDi, vedeIBuoni } from './ruoli.ts';

/* ---------- la guardia sul listino ---------- */

Deno.test('ogni voce del listino appartiene a una famiglia della spa', () => {
  const ids = Object.keys(LISTINO);
  assert(ids.length > 15, `il listino ha solo ${ids.length} voci: la prova non sta guardando niente`);
  for (const id of ids) {
    assert(
      FAMIGLIE_SPA.some((f) => id.startsWith(f)),
      `«${id}» non appartiene a nessuna famiglia della spa: decidere se la spa deve vederlo`,
    );
  }
});

/* ---------- cosa vede la spa ---------- */

Deno.test('un buono con una voce di listino e della spa', () => {
  for (const voce_id of ['hotstone55', 'dayspa_fer', 'progCoccola', 'scrubmar40']) {
    assert(buonoDellaSpa({ tipo: 'voce', voce_id }), voce_id);
  }
});

/* IL DENARO NON E' UN TRATTAMENTO. Un buono a importo si spende su
   qualunque cosa, e chi lo gestisce e' la reception: alla spa non serve, e
   dentro c'e' un dato che non la riguarda. */
Deno.test('un buono a importo non e della spa', () => {
  assertEquals(buonoDellaSpa({ tipo: 'valore', importo_cent: 10000 }), false);
  /* nemmeno se per qualche ragione porta anche una voce */
  assertEquals(buonoDellaSpa({ tipo: 'valore', voce_id: 'hotstone55' }), false);
});

/* Un buono scritto a mano in reception non ha una voce di listino: non si
   sa classificare. Si mostra. Nasconderlo vorrebbe dire non poterlo
   riscuotere quando l'ospite lo presenta al banco della spa — e fra i due
   errori quello che ferma il lavoro di una persona e' il peggiore. */
Deno.test('un buono scritto in reception senza voce si mostra alla spa', () => {
  assert(buonoDellaSpa({ tipo: 'voce', descrizione: 'Ingresso piscine / Omaggio compleanno' }));
  assert(buonoDellaSpa({ tipo: 'voce', voce_id: '', descrizione: 'Massaggio omaggio' }));
});

/* Una voce che NON e' in listino e non e' vuota: qualcuno ha mandato un id
   che non conosciamo. Non si mostra — un id sconosciuto non e' una prova
   che sia un trattamento. */
Deno.test('una voce sconosciuta non basta a farlo vedere alla spa', () => {
  assertEquals(buonoDellaSpa({ tipo: 'voce', voce_id: 'cena_degustazione' }), false);
  assertEquals(buonoDellaSpa({ tipo: 'voce', voce_id: 'soggiorno_2notti' }), false);
});

Deno.test('senza buono non si vede niente', () => {
  assertEquals(buonoDellaSpa(null), false);
  assertEquals(buonoDellaSpa(undefined), false);
});

/* ---------- i ruoli ---------- */

Deno.test('reception e amministrazione vedono tutti i buoni, la spa no', () => {
  assertEquals(vedeIBuoni(ruoloDi('reception@termeleonardo.com')), 'tutti');
  assertEquals(vedeIBuoni(ruoloDi('amministrazione@termeleonardo.com')), 'tutti');
  assertEquals(vedeIBuoni(ruoloDi('spa@termeleonardo.com')), 'solo spa');
});

/* Le stesse regole di richieste/ruoli.ts: un indirizzo estraneo non entra,
   e un indirizzo dell'hotel non previsto non si aggiunge da solo. */
Deno.test('un estraneo e un indirizzo non previsto non hanno ruolo', () => {
  assertEquals(ruoloDi('chiunque@gmail.com'), null);
  assertEquals(ruoloDi('x@termeleonardo.com.evil.net'), null);
  assertEquals(ruoloDi('direzione@termeleonardo.com'), null);
});

Deno.test('senza ruolo non si vede nessun buono', () => {
  assertEquals(vedeIBuoni(null), 'nessuno');
});

/* ============================================================
   CHI SCRIVE I BUONI.

   Deciso dalla proprieta' il 18 agosto 2026: la spa NON scrive buoni.
   Emetterli, segnarli pagati e rimandare il link sono gesti da reception e
   amministrazione — riguardano il denaro incassato e chi lo ha versato.

   IL DIFETTO CHE PRESIDIA: leggere e scrivere non sono lo stesso permesso.
   La spa deve poter riscuotere un buono che l'ospite le presenta al banco,
   e questo non le da' il diritto di emetterne uno nuovo.
   ============================================================ */
Deno.test('solo reception e amministrazione scrivono buoni', () => {
  assert(puoScrivereBuoni(ruoloDi('reception@termeleonardo.com')));
  assert(puoScrivereBuoni(ruoloDi('amministrazione@termeleonardo.com')));
  assertEquals(puoScrivereBuoni(ruoloDi('spa@termeleonardo.com')), false);
});

Deno.test('senza ruolo non si scrive niente', () => {
  assertEquals(puoScrivereBuoni(null), false);
});

/* La spa LEGGE e RISCUOTE i suoi buoni: chiudere anche quello vorrebbe dire
   non poter servire chi si presenta al banco col buono in mano. */
Deno.test('la spa legge i suoi buoni anche se non li scrive', () => {
  assertEquals(vedeIBuoni(ruoloDi('spa@termeleonardo.com')), 'solo spa');
});

/* ---------- il totem in hall riscuote da solo gli ingressi Day Spa ---------- */

Deno.test('al totem si riscuotono da soli solo gli ingressi Day Spa: trattamenti e importi restano alla reception', () => {
  /* «quando lo riscatto al totem non registra riscattato» (la proprieta',
     5 settembre 2026): chi arriva col buono per il Day Spa lo appoggia al
     lettore ed entra. Un massaggio lo riscuote la spa al suo banco, un
     buono a importo la reception contro un conto. */
  assert(riscuotibileDalTotem({ stato: 'pagato', tipo: 'servizio', voce_id: 'dayspa_serale' }));
  assert(riscuotibileDalTotem({ stato: 'pagato', tipo: 'servizio', voce_id: 'dayspa_feriale' }));
  assert(!riscuotibileDalTotem({ stato: 'pagato', tipo: 'servizio', voce_id: 'relax50' }), 'un massaggio no');
  assert(!riscuotibileDalTotem({ stato: 'pagato', tipo: 'valore', voce_id: null }), 'un importo no');
  assert(!riscuotibileDalTotem({ stato: 'pagato', tipo: 'servizio', voce_id: null }), 'scritto a mano: non si sa cos e, alla reception');
  assert(!riscuotibileDalTotem({ stato: 'riscosso', tipo: 'servizio', voce_id: 'dayspa_serale' }), 'gia usato no');
  assert(!riscuotibileDalTotem({ stato: 'attesa', tipo: 'servizio', voce_id: 'dayspa_serale' }), 'non pagato no');
  assert(!riscuotibileDalTotem(null));
});
