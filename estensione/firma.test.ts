/* ============================================================
   firma.test.ts — la firma automatica di Outlook, sotto la nostra.

   IL DIFETTO. «Quando apro offerta o conferma in Outlook, perché non si
   cancella più la firma?» L'email usciva con il nostro piè di pagina —
   nome, indirizzo, telefono, dati societari — e subito sotto la firma
   di Outlook che ripete tutto daccapo.

   LA CAUSA, e non era nostra: l'azienda ha aggiunto due righe alla
   firma, l'informativa di riservatezza in italiano e in inglese. Il
   riconoscimento chiede che OGNI riga sia riconducibile alla firma —
   giustamente, perché il caso da evitare è cancellare una frase scritta
   dall'operatore. Basta una riga sconosciuta perché quel controllo sia
   falso, e allora non si toglie più niente.

   PERCHÉ QUESTA PROVA ESISTE. Un difetto così non si vede: non c'è
   nessun errore, l'email parte, e la ripetizione la nota solo chi
   riapre il messaggio mandato — cioè, in pratica, il destinatario.
   Qui la firma vera sta scritta riga per riga: il giorno che l'azienda
   ne cambia una, si spacca una prova invece di partire un'email.

   E il conteggio delle IMPRONTE resta separato dal riconoscimento delle
   righe: le formule legali allargano quello che si riconosce, non il
   permesso di cancellare. Per cancellare servono sempre due dati che
   solo la firma aziendale contiene.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';

const SORGENTE = Deno.readTextFileSync(new URL('outlook-inject.js', import.meta.url));

type Gancio = {
  IMPRONTE_FIRMA: string[];
  RIGA_DI_FIRMA: RegExp;
  LEGALESE: RegExp;
};

/* NON SI ESEGUE LO SCRIPT, e non è pigrizia. È una IIFE che vive dentro il
   DOM di Outlook: per arrivare in fondo pretende un DOM vero, e un DOM
   finto abbastanza da farla partire sarebbe finto abbastanza da non dire
   più niente di vero.

   Si leggono invece i letterali dal sorgente e si ricostruiscono. Quello
   che si prova sono le regole com'è scritte davvero nel file: se qualcuno
   le cambia, qui cambiano insieme. */
function letterale(nome: string): RegExp {
  const m = SORGENTE.match(new RegExp('const ' + nome + ' = /(.*)/([a-z]*);'));
  if (!m) throw new Error(`nel sorgente non c'è più «const ${nome} = /.../»`);
  return new RegExp(m[1], m[2]);
}

function gancio(): Gancio {
  const blocco = SORGENTE.match(/const IMPRONTE_FIRMA = \[([\s\S]*?)\];/);
  if (!blocco) throw new Error("nel sorgente non c'è più «const IMPRONTE_FIRMA = [...]»");
  const IMPRONTE_FIRMA = [...blocco[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
  return { IMPRONTE_FIRMA, RIGA_DI_FIRMA: letterale('RIGA_DI_FIRMA'), LEGALESE: letterale('LEGALESE') };
}

/* LA FIRMA VERA, come si legge in fondo a un'offerta mandata il
   24 agosto 2026. Se cambia, si cambia qui — e si vede subito cosa
   smette di essere riconosciuto. */
const FIRMA = [
  'Cordiali saluti,',
  'LA RECEPTION',
  'Hotel Terme Leonardo',
  'Via Monteortone, 46 35037 Monteortone di Teolo (PD)',
  '+39 049 9939200 | https://www.termeleonardo.com | info@termeleonardo.com',
  'Società: Tria S.r.l.',
  'P. IVA / C.F.: IT02042330288 | SDI: M5UXCR1',
  '+39 049 9939255 | PEC: admin.tria@pec-mail.it',
  "Prima di stampare, pensa all'ambiente. Ogni pagina non stampata consente di risparmiare circa 10 litri dacqua, 5 g di CO, 15 g di legno e 0.5 Wh di energia.",
  'Think before you print. Each page you dont print saves about 10 liters of water, 5 g of CO, 15 g of wood, and 0.5 Wh of energy.',
  'Messaggio riservato ai sensi del D.Lgs. 196/2003. Se non siete il destinatario, vi preghiamo di cancellarlo e avvisarci.',
  'This message is confidential under Italian law (D.Lgs. 196/2003). If you are not the intended recipient, please delete it and notify us.',
];

function riconosciuta(g: Gancio, riga: string): boolean {
  const t = riga.trim();
  return !t || g.IMPRONTE_FIRMA.some((x) => t.includes(x)) ||
    g.RIGA_DI_FIRMA.test(t) || g.LEGALESE.test(t);
}

Deno.test('lo script espone le regole della firma', () => {
  const g = gancio();
  assert(Array.isArray(g.IMPRONTE_FIRMA), 'sparito l elenco delle impronte');
  assert(g.RIGA_DI_FIRMA instanceof RegExp, 'sparito il riconoscimento delle righe');
  assert(g.LEGALESE instanceof RegExp, 'sparita la regola sulle formule legali');
});

Deno.test('OGNI riga della firma vera viene riconosciuta', () => {
  /* basta che una sola non lo sia e non si toglie piu' niente: e' esattamente
     quello che e' successo con le due righe dell informativa */
  const g = gancio();
  const orfane = FIRMA.filter((r) => !riconosciuta(g, r));
  assertEquals(
    orfane,
    [],
    'la firma e cambiata e queste righe non si riconoscono piu: finche non lo sono, la firma resta sotto ogni offerta',
  );
});

Deno.test('le due righe dell informativa erano quelle che mancavano', () => {
  /* la prova del difetto vero, tenuta a parte: se qualcuno le togliesse
     dall elenco tornerebbe esattamente il guaio del 24 agosto */
  const g = gancio();
  assert(
    riconosciuta(g, 'Messaggio riservato ai sensi del D.Lgs. 196/2003. Se non siete il destinatario, vi preghiamo di cancellarlo e avvisarci.'),
    'l informativa italiana non si riconosce di nuovo',
  );
  assert(
    riconosciuta(g, 'This message is confidential under Italian law (D.Lgs. 196/2003). If you are not the intended recipient, please delete it and notify us.'),
    'l informativa inglese non si riconosce di nuovo',
  );
});

Deno.test('la firma porta abbastanza impronte da poterla cancellare', () => {
  /* riconoscere le righe non basta: per svuotare servono DUE dati che
     solo la firma aziendale contiene. E' la difesa contro il caso
     peggiore — cancellare una frase scritta dall operatore. */
  const g = gancio();
  const testo = FIRMA.join('\n');
  const quante = g.IMPRONTE_FIRMA.filter((x) => testo.includes(x)).length;
  assert(quante >= 2, `la firma porta solo ${quante} impronte: non verrebbe tolta`);
});

Deno.test('le formule legali da sole non bastano a cancellare niente', () => {
  /* LEGALESE allarga quello che si RICONOSCE, non il permesso di
     cancellare: un messaggio che parla di privacy non deve sparire */
  const g = gancio();
  const innocuo = 'Le confermiamo che i suoi dati sono trattati nel rispetto della privacy.';
  const quante = g.IMPRONTE_FIRMA.filter((x) => innocuo.includes(x)).length;
  assertEquals(quante, 0, 'una frase sulla privacy porta un impronta: verrebbe cancellata');
});

Deno.test('una frase scritta dall operatore non si riconosce come firma', () => {
  /* il caso da evitare, che e' il motivo per cui il controllo pretende
     che OGNI riga sia riconducibile alla firma */
  const g = gancio();
  for (
    const scritta of [
      'Gentile signora, le confermo la camera con vista sulle colline.',
      'Le tengo la doppia fino a venerdi, poi devo liberarla.',
      'Il transfer da Venezia glielo prenotiamo noi, mi dica volo e orario.',
    ]
  ) {
    assert(
      !riconosciuta(g, scritta),
      `una frase scritta a mano passa per firma e verrebbe cancellata: «${scritta}»`,
    );
  }
});
