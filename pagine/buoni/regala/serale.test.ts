/* ============================================================
   serale.test.ts — il Day Spa serale non si abbina a un trattamento,
   nemmeno nella tendina della seconda voce.

   IL DIFETTO CHE PRESIDIA. Alle 18.00-22.30 di venerdi' e sabato (l'orario
   del Day Spa serale) il centro benessere non fa trattamenti: un buono
   "Day Spa serale + massaggio" sarebbe un buono che l'ospite non potrebbe
   usare come gli e' stato venduto, e la nota in fondo al buono non
   promette piu' "venga in momenti diversi" (tolta apposta dalla proprieta',
   vedi ETI.nota in buono.js). Il server (normalizzaVoci, acquista.ts)
   rifiuta la combinazione, ma quel rifiuto non basta da solo: se l'ospite
   la scopre solo dopo aver compilato nome, email, dedica e le due spunte,
   ha gia' perso tempo su un buono che non poteva comprare. Qui si presidia
   che la pagina non gliela offra nemmeno: quando una tendina porta il Day
   Spa serale, l'altra non deve poter offrire un trattamento (e viceversa),
   un altro ingresso Day Spa (anche un secondo serale) resta sempre libero.

   COME. regala/index.html non e' eseguibile da Deno (e' HTML con uno
   <script type="module"> inline): si estraggono con una regex le tre
   funzioni pure che decidono l'esclusione — eSerale, eIngressoDaySpa,
   escludiPer — la stessa tecnica di importo.test.ts per arrotondaValore e
   di listino-copie.test.ts per il CATALOGO. Il confronto principale non è
   con una tabella scritta a mano: è con l'esito vero di validaAcquisto
   (acquista.ts) su OGNI coppia possibile del listino del server, cosi' se
   domani il server aggiungesse una voce o cambiasse la regola, questo test
   la seguirebbe da solo invece di restare a confrontare un elenco statico. */
import { assert, assertEquals } from 'jsr:@std/assert';
import { LISTINO, validaAcquisto } from '../../../supabase/functions/buoni/acquista.ts';

const SORGENTE = Deno.readTextFileSync(new URL('index.html', import.meta.url));

function estraiEscludiPer(): (id: string | null) => ((altro: string) => boolean) | null {
  const mSerale = SORGENTE.match(/const eSerale = \(id\) => (.+);/);
  const mIngresso = SORGENTE.match(/const eIngressoDaySpa = \(id\) => (.+);/);
  const mEscludi = SORGENTE.match(/const escludiPer = \(id\) => (.+);/);
  assert(mSerale && mIngresso && mEscludi,
    "eSerale/eIngressoDaySpa/escludiPer non trovate in regala/index.html: " +
    "la pagina e' cambiata, aggiornare questo test");
  const eSerale = new Function('id', `return ${mSerale![1]};`) as (id: string) => boolean;
  const eIngressoDaySpa = new Function('id', `return ${mIngresso![1]};`) as (id: string) => boolean;
  return new Function('eSerale', 'eIngressoDaySpa', `return (id) => ${mEscludi![1]};`)(
    eSerale, eIngressoDaySpa,
  ) as (id: string | null) => ((altro: string) => boolean) | null;
}

const escludiPer = estraiEscludiPer();

const BASE = { tipo: 'servizio', acquirente_email: 'a@b.it',
  condizioni_accettate: true, privacy_presa_atto: true, lingua: 'it' };

/* dayspa_pom non compare mai nella pagina (solo il server lo accetta
   ancora, per chi arriva da una pagina in cache — vedi SOLO_SERVER in
   listino-copie.test.ts): non ha senso chiedere alla pagina di escluderlo
   da una tendina che non lo offre mai. */
const idPagina = Object.keys(LISTINO);

Deno.test('escludiPer concorda con validaAcquisto su ogni coppia possibile del listino del server', () => {
  for (const a of idPagina) {
    for (const b of idPagina) {
      if (a === b) continue;
      const esclusa = escludiPer(a);
      const bEsclusaDallaPagina = esclusa ? esclusa(b) : false;
      const { errore } = validaAcquisto({ ...BASE, voci: [
        { voce_id: a, quantita: 1 }, { voce_id: b, quantita: 1 },
      ]});
      const bRifiutataDalServer = !!errore && /Day Spa serale/.test(errore);
      assertEquals(bEsclusaDallaPagina, bRifiutataDalServer,
        `coppia "${a}" scelta, "${b}" nell'altra tendina: pagina ${bEsclusaDallaPagina ? 'la esclude' : 'la offre'}, ` +
        `server ${bRifiutataDalServer ? 'la rifiuta' : 'la accetta'}`);
    }
  }
});

Deno.test('col serale scelto, un trattamento viene escluso dall altra tendina', () => {
  const esclusa = escludiPer('dayspa_sera');
  assert(esclusa, 'escludiPer("dayspa_sera") non deve essere null');
  assertEquals(esclusa!('antistress45'), true);
  assertEquals(esclusa!('relax25'), true);
});

Deno.test('col serale scelto, un altro ingresso Day Spa (anche un secondo serale) resta offerto', () => {
  const esclusa = escludiPer('dayspa_sera');
  assert(esclusa, 'escludiPer("dayspa_sera") non deve essere null');
  assertEquals(esclusa!('dayspa_fer'), false);
  assertEquals(esclusa!('dayspa_wknd'), false);
  assertEquals(esclusa!('dayspa_sera'), false);
});

Deno.test('con un trattamento scelto, il serale viene escluso dall altra tendina', () => {
  const esclusa = escludiPer('antistress45');
  assert(esclusa, 'escludiPer("antistress45") non deve essere null');
  assertEquals(esclusa!('dayspa_sera'), true);
  assertEquals(esclusa!('dayspa_fer'), false);
  assertEquals(esclusa!('relax25'), false);
});

Deno.test('con il festivo o l infrasettimanale scelti, nessuna esclusione: i trattamenti restano offerti', () => {
  assertEquals(escludiPer('dayspa_wknd'), null);
  assertEquals(escludiPer('dayspa_fer'), null);
});

Deno.test('senza una prima voce scelta (nessun valore), nessuna esclusione', () => {
  assertEquals(escludiPer(null), null);
  assertEquals(escludiPer(''), null);
});

/* la pagina deve USARE davvero escludiPer per filtrare la seconda tendina,
   non solo definirla: senza questo, la funzione potrebbe restare corretta
   e inutilizzata, come il difetto che etichetta.test.ts presidia per
   etichetta() nel back office. */
Deno.test('la pagina usa davvero escludiPer per rigenerare le opzioni della seconda tendina', () => {
  assertEquals(/escludiPer\(\s*\$\('fVoce'\)\.value\s*\)/.test(SORGENTE), true,
    'nessuna chiamata a escludiPer($(\'fVoce\').value) trovata: la tendina non si filtra davvero');
});
