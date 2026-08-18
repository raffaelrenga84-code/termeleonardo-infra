/* ============================================================
   preavviso-pagina.test.ts — l'avviso delle 48 ore, e la piscina sui
   trattamenti.

   DUE DECISIONI DELLA PROPRIETÀ, il 18 agosto 2026.

   1. Le richieste di trattamenti vogliono 48 ore di preavviso, ma chi ne dà
      meno NON viene respinto: si avvisa e si accetta. Bloccare vorrebbe dire
      far rifiutare al modulo una richiesta che la reception accetterebbe, e
      perdere insieme la vendita e l'informazione — chi viene respinto non
      scrive più.

   2. Un buono misto — Day Spa più un massaggio — si prenota dal modulo dei
      TRATTAMENTI, dove i massaggi sono già prescelti, con in più la riga
      della disponibilità piscina. Senza quella riga l'ospite prenoterebbe
      alla cieca sulla piscina, e se la piscina è piena il massaggio da solo
      non lo voleva.

   Si legge la pagina vera: un test su una copia dei testi passerebbe anche
   il giorno che la pagina dice altro — lezione imparata a caro prezzo con la
   pagina d'arrivo, che esisteva in due copie.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';

const PAGINA = Deno.readTextFileSync(new URL('./index.html', import.meta.url));
const LINGUE = 4;

/* la chiave intera, non come pezzo di un'altra: e' l'inciampo che
   avviso-dayspa.test.ts ha appena pagato */
const frasi = (chiave: string): string[] =>
  [...PAGINA.matchAll(new RegExp(`(?<![A-Za-z])${chiave}:'([^']*(?:’[^']*)*)'`, 'g'))]
    .map((m) => m[1]);

Deno.test('la frase del poco preavviso c e in tutte e quattro le lingue', () => {
  assertEquals(frasi('pocoPreavviso').length, LINGUE);
});

/* Nomina le 48 ore: senza il numero l'ospite non sa quanto avrebbe dovuto
   dare, e la frase diventa un rimprovero senza informazione. */
Deno.test('ogni lingua dice quante ore chiediamo', () => {
  const trovate = frasi('pocoPreavviso');
  assertEquals(trovate.length, LINGUE, 'la ricerca non ha visto le quattro lingue');
  for (const f of trovate) assert(/48/.test(f), `manca il numero: ${f}`);
});

/* NON PROMETTE. «Faremo il possibile» è un impegno a provarci, non a
   riuscirci: qualunque parola di garanzia qui diventa una promessa che la
   Segreteria non ha dato. */
Deno.test('in nessuna lingua la frase garantisce qualcosa', () => {
  const vietate =
    /garanti|assicur|confermiamo|certamente|sicuramente|garantier|zugesicher|guarantee|ensure|certainly|garanti|assur/i;
  for (const f of frasi('pocoPreavviso')) {
    assert(!vietate.test(f), `promette invece di provarci: ${f}`);
  }
});

/* E NON RIMANDA ALL'ARRIVO. Per una richiesta normale la reception conferma
   PRIMA, per email o al telefono: dire «glielo diciamo all'arrivo» a chi
   chiede tardi gli darebbe una risposta peggiore di quella che avrebbe
   avuto, e non servirebbe a niente. */
Deno.test('la frase non rimanda la risposta all arrivo', () => {
  for (const f of frasi('pocoPreavviso')) {
    assert(!/all.arrivo|bei der Ankunft|on arrival|à votre arrivée/i.test(f), f);
  }
});

/* IL PUNTO CHE CONTA: la pagina avvisa e lascia mandare. Se comparisse un
   `min` calcolato sul preavviso, il calendario impedirebbe la scelta — cioe'
   il blocco che la proprieta' ha deciso di NON fare. */
Deno.test('il preavviso non diventa un limite sul calendario', () => {
  assert(
    !/min="\$\{[^}]*primoGiornoUtileTrattamenti/.test(PAGINA),
    'il preavviso e finito in un min: il calendario sta bloccando la scelta',
  );
  /* la funzione c'e' comunque: serve a decidere se mostrare l'avviso */
  assert(/primoGiornoUtileTrattamenti\(\)/.test(PAGINA), 'l avviso non calcola piu niente');
});

/* La riga della piscina sui trattamenti esiste SOLO col buono che comprende
   un Day Spa: metterla sempre chiederebbe la disponibilita' della piscina a
   chi ha prenotato un solo massaggio. */
Deno.test('la piscina sui trattamenti e legata al buono che la comprende', () => {
  assert(
    /BUONO && contieneDaySpa\(BUONO\)/.test(PAGINA),
    'la riga della piscina non e condizionata al contenuto del buono',
  );
});
