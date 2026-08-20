/* ============================================================
   tolti.test.ts — i trattamenti che non si fanno più non si offrono più.

   IL DIFETTO CHE PRESIDIA. Un trattamento tolto dal listino sopravvive in
   cinque posti diversi, ognuno con la sua copia: l'elenco maestro dei
   trattamenti, il listino dei buoni regalo, i due cataloghi delle pagine,
   la base di conoscenza del chatbot e i modelli dell'estensione. Toglierlo
   da uno solo non basta e non si vede: il modulo delle richieste smette di
   offrirlo mentre il chatbot continua a consigliarlo, oppure il buono
   regalo si può ancora comprare per un trattamento che il reparto non fa
   più. Il cliente paga, e la reception scopre il problema quando l'ospite
   si presenta.

   È già successo con «Shiatsu» e «californiano»: il changelog del prompt
   dichiarava il californiano tolto mentre il listino dentro lo stesso
   prompt lo elencava ancora — se ne è accorto un test, non una persona.

   COSA NON PRESIDIA, E PERCHÉ. Le espressioni regolari che classificano
   un buono già emesso — buono.js, email-buono.ts, ruoli.ts — devono
   continuare a nominare `shiatsu`: servono a smistare un buono venduto
   PRIMA della decisione, non a venderne di nuovi. L'ultima prova qui sotto
   le difende, così nessuno le cancella scambiandole per un residuo.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';
import { LISTINO, validaAcquisto } from '../../supabase/functions/buoni/acquista.ts';
import { buonoDellaSpa } from '../../supabase/functions/buoni/ruoli.ts';
import { TRATTAMENTI } from './trattamenti.js';

/* I trattamenti tolti, con la data e chi l'ha deciso. Aggiungere una riga
   qui è il modo di togliere un trattamento: le prove sotto dicono da sole
   dove va tolto. */
const TOLTI = [
  {
    che: 'massaggio californiano',
    quando: '15 agosto 2026',
    /* il nome compare in tutte le lingue con la stessa radice */
    segno: /californian/i,
  },
  {
    che: 'massaggio Shiatsu',
    quando: '20 agosto 2026',
    /* «Shiatzu» è la grafia sbagliata che girava sul listino stampato:
       si cerca anche quella, o resterebbe viva proprio dove è più facile
       che sopravviva */
    segno: /shiat[sz]u/i,
  },
];

const testo = (p: string) => Deno.readTextFileSync(new URL(p, import.meta.url));

Deno.test('l elenco maestro dei trattamenti non offre piu cio che e stato tolto', () => {
  for (const t of TOLTI) {
    const trovate = TRATTAMENTI.filter((v: { nome: string; chiave: string }) =>
      t.segno.test(v.nome) || t.segno.test(v.chiave)
    );
    assertEquals(
      trovate.map((v: { nome: string }) => v.nome),
      [],
      `${t.che} è stato tolto il ${t.quando}, ma trattamenti.js lo offre ancora: ` +
        'comparirebbe nel modulo delle richieste e, se ha il ♥, fra i più richiesti',
    );
  }
});

Deno.test('il listino dei buoni regalo non vende piu cio che e stato tolto', () => {
  for (const t of TOLTI) {
    const vendute = Object.entries(LISTINO).filter(([id, [nome]]) =>
      t.segno.test(id) || t.segno.test(nome)
    );
    assertEquals(
      vendute.map(([id]) => id),
      [],
      `${t.che} è stato tolto il ${t.quando}, ma acquista.ts lo vende ancora: ` +
        'un cliente pagherebbe un trattamento che il reparto non fa più',
    );
  }
});

/* I due cataloghi delle pagine sono già tenuti uguali a LISTINO da
   pagine/buoni/listino-copie.test.ts. Qui si guarda quello che quel
   presidio non guarda: il testo che l'assistente legge e quello che
   l'estensione incolla nelle offerte. */
const VOCI_ALTRUI = [
  {
    file: '../../supabase/functions/chat/kb.ts',
    cosa: 'la base di conoscenza dell assistente: continuerebbe a consigliarlo',
  },
  {
    file: '../../estensione/template-extra.js',
    cosa: 'i modelli dell estensione: finirebbe nelle offerte mandate agli ospiti',
  },
  {
    file: '../../docs/agente-vocale/prompt.txt',
    cosa: 'il prompt dell agente vocale: lo direbbe al telefono, ed e la sola ' +
      'copia che una persona deve ricopiare a mano su x.ai',
  },
];

/* Le note storiche NON sono un'offerta, sono il contrario: «lo Shiatsu non
   si fa più» è proprio la frase che impedisce all'assistente di proporlo, e
   se un ospite lo chiede per nome deve saper rispondere. Si tolgono prima di
   cercare, o questo presidio vieterebbe di scrivere perché una cosa è stata
   tolta — e chi legge il file fra un anno non saprebbe che la decisione è
   stata presa: rimetterebbe il trattamento credendo a una dimenticanza.

   Il segno è quello che kb.ts usa già: un paragrafo in corsivo che comincia
   con una data. Niente espressioni regolari — si guarda l'inizio del
   paragrafo, che è esattamente quello che il segno vuol dire. */
/* Nel prompt le note storiche sono il changelog in cima, dove ogni riga
   comincia con «>». Anche li' dire «lo Shiatsu non si fa più» e' giusto: e'
   il posto dove si scrive che una cosa e cambiata. */
const notaStorica = (par: string) =>
  par.trimStart().startsWith('*Dal ') || par.trimStart().startsWith('*Fino al ') ||
  par.trimStart().startsWith('>');

function senzaNoteStoriche(src: string, file: string) {
  /* i file a fine riga di Windows separano i paragrafi con \r\n\r\n: senza
     normalizzare, il file intero e' un paragrafo solo e non si toglie niente */
  const righe = src.split('\r\n').join('\n');
  const netto = righe.split('\n\n').filter((p) => !notaStorica(p)).join('\n\n');
  assert(
    netto.length > righe.length * 0.8,
    file + ': le note storiche coprono più di un quinto del file. Il ritaglio ' +
      'sta mangiando testo vero e il presidio non guarda quasi niente.',
  );
  return netto;
}

Deno.test('ne l assistente ne l estensione nominano piu cio che e stato tolto', () => {
  for (const v of VOCI_ALTRUI) {
    const src = senzaNoteStoriche(testo(v.file), v.file);
    assert(src.length > 500, `${v.file} non si legge: la prova girerebbe a vuoto`);
    for (const t of TOLTI) {
      const righe = src.split('\n')
        .map((r, i) => [i + 1, r] as const)
        .filter(([, r]) => t.segno.test(r));
      assertEquals(
        righe.map(([n, r]) => n + ': ' + r.trim()),
        [],
        `${t.che} è stato tolto il ${t.quando} — ${v.cosa}`,
      );
    }
  }
});

/* IL ROVESCIO. Un buono venduto PRIMA della decisione esiste ancora, e
   deve continuare a funzionare: arrivare alla spa, che è il reparto che lo
   eseguirà, e non alla sola reception. Ma non deve poter essere comprato
   di nuovo.

   Le due cose passano per lo stesso listino — «lo conosco» e «lo vendo»
   erano la stessa domanda — e togliendo la voce si perdevano tutte e due
   insieme, in silenzio: il buono sarebbe sparito dall'elenco della spa
   senza che nessuno l'avesse deciso. Da qui TOLTI_DAL_LISTINO. */

Deno.test('un buono shiatsu gia emesso arriva ancora alla spa', () => {
  assert(
    buonoDellaSpa({ tipo: 'voce', voce_id: 'shiatsu50' }),
    'un buono shiatsu già venduto non arriva più alla spa: sparisce dal loro ' +
      'elenco e l ospite si presenta senza che nessuno lo aspetti',
  );
});

Deno.test('lo stesso buono non si puo piu comprare', () => {
  const r = validaAcquisto({
    tipo: 'voce', voce_id: 'shiatsu50', lingua: 'it',
    nome: 'Mario Rossi', email: 'mario@example.com', consenso: true,
  });
  assert(
    'errore' in r && r.errore,
    'shiatsu50 si compra ancora: il reparto non fa più quel trattamento',
  );
});

/* E le regole che classificano per prefisso — quelle che non passano dal
   listino — restano al loro posto: se qualcuno le cancella insieme al
   resto, un buono già venduto non si smista più. */
Deno.test('le regole di classificazione conoscono ancora lo shiatsu', () => {
  const regole = [
    { file: '../buoni/buono.js', cosa: 'il modulo che sceglie dove mandare chi prenota col buono' },
    {
      file: '../../supabase/functions/buoni/email-buono.ts',
      cosa: 'la mail del buono, che ne sceglie il testo',
    },
    {
      file: '../../supabase/functions/buoni/ruoli.ts',
      cosa: 'lo smistamento per reparto: senza, il buono non arriva alla spa',
    },
  ];
  for (const r of regole) {
    assert(
      /shiatsu/i.test(testo(r.file)),
      r.file + ' non nomina più shiatsu: ' + r.cosa + '. Le regole di ' +
        'classificazione restano anche dopo che il trattamento esce dal listino, ' +
        'perché smistano quello che è già stato venduto.',
    );
  }
});
