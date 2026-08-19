/* ============================================================
   pulsanti.test.ts — i pulsanti dei servizi nelle email di conferma.

   COSA SI ROMPE. La conferma esiste in quattro lingue e in tre file
   diversi: italiano e tedesco in template-conferma.js, inglese in
   template-en.js, francese in template-fr.js. Ogni volta che si aggiunge
   un servizio bisogna ricordarsene quattro volte, e non ce ne si ricorda:
   oggi la conferma inglese e quella francese non offrono ne' il transfer
   ne' il buono regalo, che l'italiana e la tedesca offrono da mesi. Non
   e' una differenza voluta — e' una dimenticanza che nessuno vedeva,
   perche' chi scrive in italiano non legge mai la conferma francese.

   COME. Non si cerca il testo: si ESEGUONO le quattro funzioni e si
   guarda quali pulsanti chiedono davvero, sostituendo bottoneServizio con
   una versione che li annota. Un pulsante che c'e' nel file ma dentro un
   ramo che non scatta non conta come presente, ed e' giusto cosi'.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';

const FILE = [
  'template.js', 'template-conferma.js', 'template-de.js',
  'template-en.js', 'template-fr.js', 'template-extra.js',
];
const SORGENTE = FILE.map((f) => Deno.readTextFileSync(new URL(f, import.meta.url))).join('\n');

type Esito = { html: string; chiavi: string[] };
type Conferma = (d: Record<string, unknown>, o: Record<string, unknown>) => Esito;

function conferme(): Record<string, Conferma> {
  const coda = `
    const REGISTRO = [];
    const _bs = bottoneServizio;
    bottoneServizio = function (chiave, d, lingua) {
      REGISTRO.push(chiave);
      return _bs(chiave, d, lingua);
    };
    const prova = (f) => (d, o) => {
      REGISTRO.length = 0;
      const html = f(d, o);
      return { html: html, chiavi: REGISTRO.slice() };
    };
    return {
      it: prova(costruisciConferma), de: prova(costruisciConfermaDE),
      en: prova(costruisciConfermaEN), fr: prova(costruisciConfermaFR)
    };`;
  return new Function(SORGENTE + coda)() as Record<string, Conferma>;
}

const CONFERME = conferme();
const LINGUE = ['it', 'de', 'en', 'fr'];

function pratica(trattamento: string): Record<string, unknown> {
  return {
    intestatario: 'Rossi Mario', numero: 'C26/19130',
    giornoArrivo: 12, mese: 8, anno: 2026,
    giornoPartenza: 19, mesePartenza: 8, annoPartenza: 2026,
    notti: 7, adulti: 2, bambini: 0,
    camere: [{ trattamento, nome: 'Comfort', prezzo: 1200 }],
    note: [], extra: [], totale: 1400, acconto: 400,
    scadenza: '2026-08-01', paese: 'DE',
    linkArrivo: 'https://esempio.test/arrivo/abc',
  };
}

/* Se le quattro funzioni non girassero, tutte le prove qui sotto
   passerebbero su stringhe vuote. */
Deno.test('le quattro conferme si costruiscono davvero', () => {
  for (const l of LINGUE) {
    const e = CONFERME[l](pratica('DOLCE VITA'), {});
    assert(e.html.length > 3000, `la conferma ${l} e lunga ${e.html.length} lettere`);
  }
});

Deno.test('le quattro conferme offrono gli stessi servizi', () => {
  const base = [...new Set(CONFERME.it(pratica('DOLCE VITA'), {}).chiavi)].sort();
  assert(base.length >= 3, `l italiana offre solo ${base.length} servizi: la prova gira a vuoto`);
  for (const l of LINGUE) {
    const suoi = [...new Set(CONFERME[l](pratica('DOLCE VITA'), {}).chiavi)].sort();
    assertEquals(suoi, base, `la conferma ${l} non offre gli stessi servizi dell italiana`);
  }
});

/* ============================================================
   I PULSANTI CHE COMPAIONO SOLO A CHI SERVONO.

   Il green fee e il maestro non riguardano chi viene per le cure: in fondo
   a un'email gia' lunga, due pulsanti in piu' per tutti valgono meno di
   due pulsanti giusti per chi ha il golf. La condizione la decide il
   pacchetto, che e' scritto nella tariffa della camera — la stessa cosa
   che notaPacchetto() legge gia' per la descrizione.
   ============================================================ */
Deno.test('chi ha il pacchetto golf riceve green fee e maestro', () => {
  for (const l of LINGUE) {
    const c = CONFERME[l](pratica('GOLF SPEZIAL'), {}).chiavi;
    assert(c.includes('greenfee'), `manca il green fee nella conferma ${l}`);
    assert(c.includes('golf'), `manca il maestro nella conferma ${l}`);
  }
});

Deno.test('chi non ha il golf non li riceve', () => {
  for (const l of LINGUE) {
    const c = CONFERME[l](pratica('DOLCE VITA'), {}).chiavi;
    assert(!c.includes('greenfee'), `green fee di troppo nella conferma ${l}`);
    assert(!c.includes('golf'), `maestro di troppo nella conferma ${l}`);
  }
});

/* ============================================================
   LA RIGA IN PIU' PER CHI HA LE CURE.

   Il turno dei fanghi lo assegna la Segreteria Cure dopo la visita medica:
   qui non si promette niente, si dice soltanto che la preferenza si puo'
   dire ORA, dalla pagina d'arrivo. Ed e' li' che finisce, nella colonna
   fanghi_desiderio che la scheda «Arrivi» del back office fa leggere alla
   Segreteria Cure.

   E se la pagina d'arrivo non c'e', la riga non compare: indicare una
   preferenza che l'ospite non ha modo di esprimere e' peggio del silenzio.
   ============================================================ */
const PAROLA_FANGHI: Record<string, string> = {
  it: 'fanghi', de: 'Fango', en: 'mud', fr: 'fango',
};

Deno.test('con le cure la conferma dice che la preferenza si puo dire ora', () => {
  for (const l of LINGUE) {
    const h = CONFERME[l](pratica('DOLCE VITA'), { cure: true }).html;
    assert(h.includes(PAROLA_FANGHI[l]),
      `la conferma ${l} con le cure non nomina i fanghi`);
    assert(h.includes('5:50'), `la conferma ${l} non dice l orario dei turni`);
  }
});

Deno.test('senza cure quella riga non c e', () => {
  for (const l of LINGUE) {
    const h = CONFERME[l](pratica('SMART'), {}).html;
    assert(!h.includes('5:50'), `la conferma ${l} parla dei turni a chi non ha le cure`);
  }
});

Deno.test('senza pagina d arrivo non si chiede una preferenza', () => {
  const senza = { ...pratica('DOLCE VITA'), linkArrivo: '' };
  for (const l of LINGUE) {
    const h = CONFERME[l](senza, { cure: true }).html;
    assert(!h.includes('5:50'),
      `la conferma ${l} chiede una preferenza senza dare il modo di esprimerla`);
  }
});
