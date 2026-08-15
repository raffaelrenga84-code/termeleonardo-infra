/* ============================================================
   trattamenti.test.ts — il presidio fra l'elenco maestro e il listino dei
   buoni regalo.

   IL DIFETTO CHE PRESIDIA. Questo modulo (trattamenti.js) è la fonte sola
   per il modulo delle richieste; `LISTINO` in supabase/functions/buoni/
   acquista.ts resta la fonte sola dei PREZZI per chi compra un buono
   regalo — vedi il commento in cima ad acquista.ts. Sono due liste diverse
   per due scopi diversi, ma per le 21 voci che si possono sia richiedere
   sia regalare devono raccontare lo stesso nome e lo stesso prezzo: se
   divergono, un ospite legge un prezzo qui e ne trova un altro comprando
   il buono, e la reception riceve una richiesta che non ritrova nel
   gestionale. È lo stesso presidio di pagine/buoni/listino-copie.test.ts,
   esteso all'elenco maestro come chiesto dalla specifica di design
   (docs/superpowers/specs/2026-08-15-trattamenti-scelta-design.md).

   IL PREZZO NON HA ECCEZIONI: ogni voce regalabile deve costare in
   trattamenti.js esattamente quanto costa in LISTINO, sempre. Sul NOME sono
   documentate sotto le uniche differenze note fra le due liste, cosi' come
   sono OGGI — non nascoste, non forzate a coincidere riscrivendo il testo
   approvato dalla proprietà nell'anteprima. */
import { assert, assertEquals } from 'jsr:@std/assert';
import { LISTINO } from '../../supabase/functions/buoni/acquista.ts';
import { nomeCompleto, TRATTAMENTI } from './trattamenti.js';

/* Il LISTINO dei buoni aggiunge, solo ai cinque programmi, una descrizione
   promozionale dopo una lineetta ("Programma Coccola — pulizia viso
   completa + manicure"): è testo pensato per il foglio del buono, non il
   nome del trattamento. Si toglie prima di confrontare — è un no-op per le
   voci che una lineetta non ce l'hanno. */
const senzaDescrizioneBuono = (nome: string) => nome.split(' — ')[0];

/* ECCEZIONI DOCUMENTATE SUL NOME, NON SUL PREZZO. L'anteprima approvata
   dalla proprietà (docs/anteprime/2026-08-15-menu-trattamenti.html) ha
   scritto questi tre nomi copiandoli dal PDF del listino ufficiale del
   reparto — e per la riflessologia plantare lo dice esplicitamente nel suo
   stesso commento: il listino ufficiale scrive «Massaggio riflessologia
   plantare», non «Riflessologia plantare». `LISTINO` in acquista.ts non è
   ancora stato allineato a quel PDF per queste tre voci — non è compito di
   questo modulo toccare acquista.ts (fuori dallo scopo di questo lavoro, e
   il listino dei buoni ha un altro percorso di modifica in corso). Quando
   verrà allineato, questa voce va tolta: se il nome combacia già, il test
   sotto lo scopre da solo (vedi il terzo test). */
const NOME_DA_ALLINEARE_IN_ACQUISTA_TS: Record<string, string> = {
  relax25: 'Massaggio relax con olio di cacao (25 min)',
  plantare25: 'Riflessologia plantare (25 min)',
  hotstone55: 'Massaggio Hot Stone (55 min)',
};

const regalabili = () => TRATTAMENTI.filter((v) => v.regalabile);

Deno.test('ogni voce regalabile costa in trattamenti.js esattamente quanto costa nel LISTINO dei buoni', () => {
  for (const v of regalabili()) {
    assert(
      Object.hasOwn(LISTINO, v.regalabile as string),
      `${v.nome}: regalabile:'${v.regalabile}' non esiste in LISTINO — l'id è sbagliato o la voce è stata tolta dal listino dei buoni`,
    );
    const [, prezzoServer] = LISTINO[v.regalabile as string];
    assertEquals(
      v.prezzo,
      prezzoServer,
      `${v.nome}: trattamenti.js dice ${v.prezzo} €, LISTINO (acquista.ts) dice ${prezzoServer} € — un ospite vedrebbe un prezzo nella richiesta e un altro comprando il buono`,
    );
  }
});

Deno.test('il nome delle voci regalabili combacia col LISTINO dei buoni, salvo le divergenze note e documentate', () => {
  for (const v of regalabili()) {
    const atteso = senzaDescrizioneBuono(LISTINO[v.regalabile as string][0]);
    const eccezione = NOME_DA_ALLINEARE_IN_ACQUISTA_TS[v.regalabile as string];
    if (eccezione !== undefined) {
      /* la divergenza nota deve restare quella scritta sopra: se cambia,
         qualcuno ha toccato uno dei due nomi senza aggiornare l'altro, ed
         è esattamente il tipo di deriva silenziosa che questo file esiste
         per intercettare */
      assertEquals(atteso, eccezione,
        `${v.nome}: la divergenza nota con LISTINO è cambiata rispetto a quella scritta in NOME_DA_ALLINEARE_IN_ACQUISTA_TS — aggiorna quella tabella (o toglila, se ora combaciano)`);
      continue;
    }
    assertEquals(
      nomeCompleto(v),
      atteso,
      `${v.nome}: il nome in trattamenti.js non combacia con LISTINO (acquista.ts). Se è una differenza voluta, documentala in NOME_DA_ALLINEARE_IN_ACQUISTA_TS con lo stesso commento delle altre; se è un refuso, correggi trattamenti.js.`,
    );
  }
});

/* il presidio deve guardare qualcosa di vero: le 21 voci regalabili sono
   note dalla specifica di design (docs/superpowers/specs/2026-08-15-
   trattamenti-scelta-design.md dice 21), e le eccezioni sul nome non
   devono coprire più di quelle tre righe — altrimenti il test qui sopra
   passerebbe senza aver confrontato niente, come temuto in
   listino-copie.test.ts */
Deno.test('il presidio guarda davvero le voci regalabili, non un elenco vuoto o tutto in eccezione', () => {
  const voci = regalabili();
  assertEquals(voci.length, 21, `attese 21 voci regalabili, trovate ${voci.length}`);
  assertEquals(
    Object.keys(NOME_DA_ALLINEARE_IN_ACQUISTA_TS).sort(),
    ['hotstone55', 'plantare25', 'relax25'],
    'le eccezioni sul nome sono cambiate: aggiorna questo test insieme alla tabella qui sopra',
  );
});

/* le voci NON regalabili (manicure, pedicure, epilazione e le altre che il
   listino dei buoni non fa) restano escluse dal confronto — non forzate a
   un id che non esiste */
Deno.test('le voci non regalabili non hanno un id di LISTINO inventato', () => {
  const nonRegalabili = TRATTAMENTI.filter((v) => !v.regalabile);
  assertEquals(nonRegalabili.length, 15, `attese 15 voci non regalabili, trovate ${nonRegalabili.length}`);
  for (const v of nonRegalabili) {
    assertEquals(v.regalabile, null, `${v.nome}: dovrebbe essere null, non un id a metà`);
  }
});
