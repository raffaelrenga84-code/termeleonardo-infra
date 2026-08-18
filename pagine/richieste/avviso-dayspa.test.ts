/* ============================================================
   avviso-dayspa.test.ts — la prima frase che legge un ospite Day Spa.

   IL DIFETTO CHE PRESIDIA. Il riquadro in cima al modulo diceva «Le
   confermiamo giorno, ORA e prezzo» anche sul Day Spa, che un'ora non ce
   l'ha: e' l'ingresso di una giornata (9:00–18:30). E' la prima cosa che
   quell'ospite legge, e prometteva una cosa che il servizio non da'.

   Sono quattro lingue e quattro frasi scritte a mano: la lingua che nessuno
   rilegge e' quella che resta indietro. Qui si guarda la SORGENTE della
   pagina, come fanno gia' regala/serale.test.ts e regala/importo.test.ts —
   il modulo e' un file HTML, non c'e' niente da importare.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';

const SORGENTE = Deno.readTextFileSync(new URL('index.html', import.meta.url));
const LINGUE = 4;

/* le frasi arrivano con gli apici tipografici dentro (’), quindi si prende
   tutto fino all'apice dritto che chiude la stringa JavaScript */
const frasi = (chiave: string): string[] =>
  [...SORGENTE.matchAll(new RegExp(`${chiave}:'([^']*(?:’[^']*)*)'`, 'g'))].map((m) => m[1]);

/* La promessa, come e' scritta nelle quattro lingue. Si guarda la promessa
   intera e non la sola parola «ora»: la frase finisce con «di solito entro
   poche ore», che parla del tempo di risposta dell'hotel e non di un orario
   dato all'ospite. Cercare `\bore\b` avrebbe pescato quella. */
const PROMETTE_UN_ORA = /giorno, ora|Tag, Uhrzeit|day, time|jour, heure/;

Deno.test('tutte e quattro le lingue hanno la frase del Day Spa', () => {
  assertEquals(frasi('avvisoDayspa').length, LINGUE);
  assertEquals(frasi('avviso').length, LINGUE, 'gli altri tipi tengono la loro');
});

Deno.test('la frase del Day Spa non promette un ora, che quel servizio non ha', () => {
  for (const f of frasi('avvisoDayspa')) {
    assert(!PROMETTE_UN_ORA.test(f), `questa frase nomina un orario: ${f}`);
  }
});

Deno.test('la frase del Day Spa nomina comunque il giorno e il prezzo', () => {
  const attese = [/giorno e prezzo/, /Tag und Preis/, /day and price/, /jour et prix/];
  const trovate = frasi('avvisoDayspa');
  for (const attesa of attese) {
    assert(trovate.some((f) => attesa.test(f)), `nessuna frase corrisponde a ${attesa}`);
  }
});

/* la frase degli altri tipi NON cambia: li' l'ora si conferma davvero (un
   transfer, una partenza al campo, un massaggio) */
Deno.test('gli altri tipi continuano a promettere anche l ora', () => {
  for (const f of frasi('avviso')) {
    assert(PROMETTE_UN_ORA.test(f), `questa frase ha perso l orario: ${f}`);
  }
});

Deno.test('e la pagina sceglie davvero la frase del Day Spa sul modulo Day Spa', () => {
  assert(
    /TIPO === 'dayspa' \? t\.avvisoDayspa : t\.avviso/.test(SORGENTE),
    'le frasi ci sono ma nessuno le sceglie: il riquadro le mostrerebbe sempre uguali',
  );
});

/* ============================================================
   E LA PROMESSA A CHI HA GIA' PAGATO.

   IL DIFETTO CHE PRESIDIA. «Le confermiamo giorno e prezzo» lo leggeva
   anche chi arrivava col link del proprio buono regalo — cioè chi il prezzo
   l'ha già pagato, e magari l'ha pagato qualcun altro per regalarglielo.
   Promettere di confermare un prezzo a quella persona è, nel migliore dei
   casi, un dubbio piantato dove non serviva.

   Il denaro, quando c'è un buono valido, lo dice il riquadro del buono:
   copre tutto, copre in parte e la differenza si paga all'arrivo, oppure
   avanza. L'avviso in cima non deve dire una terza cosa.

   Quando il buono NON è valido — scaduto, già riscosso, non trovato — il
   prezzo torna da confermare e la frase resta quella di sempre.
   ============================================================ */
Deno.test('con un buono valido esiste una frase che non promette un prezzo', () => {
  assertEquals(frasi('avvisoBuono').length, LINGUE);
  assertEquals(frasi('avvisoBuonoDayspa').length, LINGUE);
});

Deno.test('le frasi col buono non nominano il prezzo in nessuna lingua', () => {
  const NOMINA_UN_PREZZO = /prezzo|Preis|price|prix/i;
  for (const chiave of ['avvisoBuono', 'avvisoBuonoDayspa']) {
    const trovate = frasi(chiave);
    /* senza questo il ciclo gira a vuoto e la prova passa senza guardare
       niente: e' successo davvero, alla prima stesura */
    assertEquals(trovate.length, LINGUE, chiave);
    for (const f of trovate) {
      assert(!NOMINA_UN_PREZZO.test(f), `${chiave} promette un prezzo: ${f}`);
    }
  }
});

/* la distinzione fra i due tipi resta anche col buono: il Day Spa un'ora
   non ce l'ha nemmeno quando è regalato */
Deno.test('col buono, solo il Day Spa resta senza ora', () => {
  /* Senza il prezzo la frase diventa «giorno e ora», non «giorno, ora e
     prezzo»: PROMETTE_UN_ORA qui non serve. Si guarda la parola intera —
     `\bora\b` e non `ora` — perche' la frase finisce con «di solito entro
     poche ORE», che parla del tempo di risposta dell'hotel. Stessa ragione
     per `\bheure\b` (in francese la coda e' «quelques heureS») e `\btime\b`
     (in inglese e' «a few hourS»). */
  const NOMINA_L_ORA = /\bora\b|Uhrzeit|\btime\b|\bheure\b/;
  const senzaOra = frasi('avvisoBuonoDayspa');
  const conOra = frasi('avvisoBuono');
  assertEquals(senzaOra.length, LINGUE, 'avvisoBuonoDayspa');
  assertEquals(conOra.length, LINGUE, 'avvisoBuono');
  for (const f of senzaOra) {
    assert(!NOMINA_L_ORA.test(f), `questa frase nomina un orario: ${f}`);
  }
  for (const f of conOra) {
    assert(NOMINA_L_ORA.test(f), `questa frase ha perso l orario: ${f}`);
  }
});

Deno.test('e la pagina sceglie la frase giusta solo quando il buono e valido', () => {
  const i = SORGENTE.indexOf('function avvisoInCima');
  assert(i > 0, 'le frasi col buono ci sono ma nessuno le sceglie');
  const corpo = SORGENTE.slice(i, SORGENTE.indexOf('\n}', i));

  /* la scelta deve dipendere da BUONO, che e' la risposta di ?a=verifica e
     vale null quando il buono NON e' valido — scaduto, gia' riscosso, non
     trovato, o verifica che non ha risposto affatto. In quei casi il prezzo
     torna davvero da confermare e la frase deve tornare quella di sempre. */
  assert(/\bBUONO\b/.test(corpo), 'la scelta non guarda BUONO');
  for (const chiave of ['avvisoBuonoDayspa', 'avvisoBuono', 'avvisoDayspa', 'avviso']) {
    assert(corpo.includes(`t.${chiave}`), `avvisoInCima non usa mai t.${chiave}`);
  }

  /* e il riquadro va disegnato dopo, altrimenti la frase rimanda a qualcosa
     che non c'e' ancora sullo schermo */
  assert(
    SORGENTE.indexOf('${avvisoInCima(t)}') < SORGENTE.indexOf('${riquadroBuono(t)}'),
    'l avviso non viene prima del riquadro del buono',
  );
});
