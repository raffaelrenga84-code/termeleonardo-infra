/* ============================================================
   fanghi-testi.test.ts — le parole della sezione «Cure termali».

   IL DIFETTO CHE PRESIDIA. Il ciclo fanghi ha sei turni al mattino e il
   turno lo assegna la Segreteria Cure DOPO la visita medica di ammissione.
   Qualunque parola che somigli a una prenotazione — «prenotato»,
   «riservato», «confermato», «gebucht» — e' una promessa che il servizio
   non puo' mantenere, e l'ospite si presenta alle 5:50 convinto di avere
   un posto.

   La parola giusta e' quella tedesca da cui e' nata questa sezione:
   VORGEMERKT, «preso nota». Non «gebucht».

   SI LEGGE LA PAGINA CHE VIENE SERVITA, e non e' un dettaglio di stile.
   Fino al 18 agosto 2026 di questa pagina esistevano DUE copie identiche
   byte per byte — `arrivo/index.html` e `pagine/index.html` — e Vercel
   pubblica la seconda. Le modifiche dei fanghi erano finite nella prima:
   tutte le prove verdi, e in linea non era cambiato niente. Se n'e'
   accorta solo la verifica sul sito vero.

   Il doppione e' stato tolto. Questa prova sta qui, accanto al file
   pubblicato, perche' un test che legge una copia non serve a niente.
   ============================================================ */
import { assert } from 'jsr:@std/assert';

const PAGINA = Deno.readTextFileSync(new URL('./arrivo/index.html', import.meta.url));

/* le chiavi che la sezione usa, una per lingua: se una lingua ne perde una,
   l'ospite vede `undefined` dentro una scheda dell'hotel */
const CHIAVI = ['fanghiT', 'fanghiD', 'fanghiOpz', 'fanghiNota', 'fanghiPresoAtto'];
const LINGUE = 4;

Deno.test('ogni chiave della sezione esiste in tutte e quattro le lingue', () => {
  for (const chiave of CHIAVI) {
    const quante = PAGINA.split(`${chiave}:`).length - 1;
    assert(
      quante >= LINGUE,
      `${chiave}: definita ${quante} volte, servono ${LINGUE} lingue`,
    );
  }
});

/* Il testo di ogni lingua, preso dalla pagina vera. */
function testiFanghi(): string[] {
  const trovati: string[] = [];
  for (const chiave of ['fanghiD', 'fanghiOpz', 'fanghiNota', 'fanghiPresoAtto']) {
    const re = new RegExp(`${chiave}:\\s*(\\[[^\\]]*\\]|'[^']*')`, 'g');
    for (const m of PAGINA.matchAll(re)) trovati.push(m[1]);
  }
  return trovati;
}

Deno.test('nessun testo promette un turno, in nessuna lingua', () => {
  /* le parole che trasformano una preferenza in un appuntamento */
  const vietate =
    /prenotat|prenotazione|riservat|confermat|garantit|gebucht|Buchung|reserviert|bestätigt|booked|reserved|confirmed|guaranteed|réservé|confirmé|garanti/i;
  const testi = testiFanghi();
  assert(testi.length >= 4 * 4, `trovati solo ${testi.length} testi: la ricerca non ha visto le quattro lingue`);
  for (const t of testi) {
    assert(!vietate.test(t), `promette un appuntamento: ${t}`);
  }
});

/* La parola tedesca da cui e' nata questa sezione. E' la prova che il tono
   e' quello giusto: «vorgemerkt» dice preso-nota, «gebucht» direbbe
   prenotato. */
Deno.test('il tedesco dice vorgemerkt, non gebucht', () => {
  assert(/vorgemerkt/i.test(PAGINA), 'manca la parola che regge tutta la sezione');
});

/* La sezione compare SOLO a chi ha le cure: a chi viene per due notti di
   relax questa domanda sarebbe rumore. */
Deno.test('la sezione e legata a cure, non disegnata sempre', () => {
  assert(
    /DATI\.cure\s*\?/.test(PAGINA),
    'la sezione fanghi non e condizionata a DATI.cure',
  );
});

/* I tre valori mandati al server sono quelli che il server accetta
   (prepara-arrivo/fanghi.ts, elenco chiuso). Se qui si scrivesse il testo
   tradotto, il server lo scarterebbe e la preferenza sparirebbe in
   silenzio. */
Deno.test('al server si mandano i tre valori previsti, non il testo tradotto', () => {
  assert(
    /\['presto','tardi','indifferente'\]/.test(PAGINA.replace(/\s/g, '')),
    'la pagina non manda i tre valori dell elenco chiuso',
  );
});
