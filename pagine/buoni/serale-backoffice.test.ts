/* ============================================================
   serale-backoffice.test.ts — la stessa regola del Day Spa serale, ma nel
   back office: la reception compone un buono a mano in pagine/buoni/index.html
   con un carrello che, a differenza della pagina pubblica di acquisto, non
   ha un tetto di due voci diverse — quindi la stessa combinazione vietata
   (serale + trattamento) era possibile anche li', semplicemente aggiungendo
   le due righe al carrello una dopo l'altra. ?a=crea (index.ts) non manda
   voci strutturate al server come fa ?a=acquista: prende una descrizione
   gia' composta, quindi qui il controllo vero e' solo sulla pagina — ma
   deve trattare la reception con la stessa cortesia della pagina pubblica:
   il divieto si vede componendo il buono, non dopo aver gia' incassato.

   COME. pagine/buoni/index.html non e' eseguibile da Deno: si estrae con
   una regex la funzione pura che decide l'esclusione — escludiPerVoci,
   costruita sopra eSerale/eIngressoDaySpa — la stessa tecnica di
   regala/serale.test.ts. Il confronto principale è con validaAcquisto
   (acquista.ts) sulle coppie del listino vero, non con una tabella scritta
   a mano: se domani la regola del server cambiasse, questo test la
   seguirebbe da solo. */
import { assert, assertEquals } from 'jsr:@std/assert';
import { LISTINO, validaAcquisto } from '../../supabase/functions/buoni/acquista.ts';

const SORGENTE = Deno.readTextFileSync(new URL('index.html', import.meta.url));

function estraiEscludiPerVoci(): (ids: string[]) => ((id: string) => boolean) | null {
  const mSerale = SORGENTE.match(/const eSerale = \(id\) => (.+);/);
  const mIngresso = SORGENTE.match(/const eIngressoDaySpa = \(id\) => (.+);/);
  const mEscludi = SORGENTE.match(/const escludiPerVoci = \(ids\) => (.+);/);
  assert(mSerale && mIngresso && mEscludi,
    "eSerale/eIngressoDaySpa/escludiPerVoci non trovate in pagine/buoni/index.html: " +
    "la pagina e' cambiata, aggiornare questo test");
  const eSerale = new Function('id', `return ${mSerale![1]};`) as (id: string) => boolean;
  const eIngressoDaySpa = new Function('id', `return ${mIngresso![1]};`) as (id: string) => boolean;
  return new Function('eSerale', 'eIngressoDaySpa', `return (ids) => ${mEscludi![1]};`)(
    eSerale, eIngressoDaySpa,
  ) as (ids: string[]) => ((id: string) => boolean) | null;
}

const escludiPerVoci = estraiEscludiPerVoci();

const BASE = { tipo: 'servizio', acquirente_email: 'a@b.it',
  condizioni_accettate: true, privacy_presa_atto: true, lingua: 'it' };

/* dayspa_pom non compare nel catalogo del back office (solo il server lo
   accetta ancora, vedi SOLO_SERVER in listino-copie.test.ts) */
const idPagina = Object.keys(LISTINO);

Deno.test('escludiPerVoci([a]) concorda con validaAcquisto su ogni coppia possibile del listino del server', () => {
  for (const a of idPagina) {
    for (const b of idPagina) {
      if (a === b) continue;
      const esclusa = escludiPerVoci([a]);
      const bEsclusaDalCarrello = esclusa ? esclusa(b) : false;
      const { errore } = validaAcquisto({ ...BASE, voci: [
        { voce_id: a, quantita: 1 }, { voce_id: b, quantita: 1 },
      ]});
      const bRifiutataDalServer = !!errore && /Day Spa serale/.test(errore);
      assertEquals(bEsclusaDalCarrello, bRifiutataDalServer,
        `carrello con "${a}", si prova ad aggiungere "${b}": carrello ${bEsclusaDalCarrello ? 'la esclude' : 'la offre'}, ` +
        `server ${bRifiutataDalServer ? 'la rifiuta' : 'la accetta'}`);
    }
  }
});

Deno.test('carrello vuoto: nessuna esclusione', () => {
  assertEquals(escludiPerVoci([]), null);
});

Deno.test('serale gia nel carrello: un trattamento viene escluso dalla tendina', () => {
  const esclusa = escludiPerVoci(['dayspa_sera']);
  assert(esclusa, 'escludiPerVoci(["dayspa_sera"]) non deve essere null');
  assertEquals(esclusa!('antistress45'), true);
  assertEquals(esclusa!('relax25'), true);
});

Deno.test('serale gia nel carrello: un altro ingresso Day Spa (anche un secondo serale) resta offerto', () => {
  const esclusa = escludiPerVoci(['dayspa_sera']);
  assert(esclusa, 'escludiPerVoci(["dayspa_sera"]) non deve essere null');
  assertEquals(esclusa!('dayspa_fer'), false);
  assertEquals(esclusa!('dayspa_wknd'), false);
  assertEquals(esclusa!('dayspa_sera'), false);
});

Deno.test('un trattamento gia nel carrello: il serale viene escluso dalla tendina', () => {
  const esclusa = escludiPerVoci(['antistress45']);
  assert(esclusa, 'escludiPerVoci(["antistress45"]) non deve essere null');
  assertEquals(esclusa!('dayspa_sera'), true);
  assertEquals(esclusa!('dayspa_fer'), false);
  assertEquals(esclusa!('relax25'), false);
});

Deno.test('festivo o infrasettimanale gia nel carrello: nessuna esclusione', () => {
  assertEquals(escludiPerVoci(['dayspa_wknd']), null);
  assertEquals(escludiPerVoci(['dayspa_fer']), null);
});

Deno.test('due trattamenti gia nel carrello: il serale resta escluso, non solo col primo', () => {
  const esclusa = escludiPerVoci(['relax25', 'antistress45']);
  assert(esclusa, 'escludiPerVoci con due trattamenti non deve essere null');
  assertEquals(esclusa!('dayspa_sera'), true);
});

Deno.test('festivo e un trattamento gia nel carrello: il serale resta escluso (uno dei due e un trattamento)', () => {
  const esclusa = escludiPerVoci(['dayspa_wknd', 'antistress45']);
  assert(esclusa, 'escludiPerVoci con festivo+trattamento non deve essere null');
  assertEquals(esclusa!('dayspa_sera'), true);
});

/* la pagina deve USARE davvero escludiPerVoci per filtrare la tendina e
   per bloccare "+ Aggiungi", non solo definirla — lo stesso presidio di
   etichetta.test.ts per etichetta() e di regala/serale.test.ts per
   escludiPer(). */
Deno.test('la pagina usa davvero escludiPerVoci per rigenerare la tendina e per guardia sull aggiunta', () => {
  assertEquals(/escludiPerVoci\(/.test(SORGENTE), true,
    'nessuna chiamata a escludiPerVoci(...) trovata nella pagina');
  assertEquals(/\$\('fAggiungi'\)\.onclick/.test(SORGENTE), true,
    "il gestore di '+ Aggiungi' non c'e' piu': la pagina e' cambiata, aggiornare questo test");
});
