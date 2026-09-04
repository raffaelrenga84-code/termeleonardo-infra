/* ============================================================
   scheda-iniziale.test.ts — chi entra nel back office atterra dove
   lavora.

   IL DIFETTO CHE PRESIDIA. Il back office si apriva sempre su «Emetti un
   buono». Per la reception è giusto; per la spa no, e non per gusto:
   `puoScrivereBuoni()` in supabase/functions/buoni/ruoli.ts dice che la
   spa NON emette buoni — è una decisione della proprietà del 18 agosto
   2026, perché emettere un buono è un gesto sul denaro incassato.

   Quindi la spa apriva la pagina su un modulo che il server le avrebbe
   rifiutato, e le sue richieste — trattamenti e Day Spa, l'unica ragione
   per cui quell'account esiste — stavano tre schede più in là.

   COSA NON FA. Non nasconde nessuna scheda e non toglie nessun permesso:
   il cancello resta dov'era, nel server. Questa è solo la scheda su cui
   si apre.

   PERCHÉ QUI UNA COPIA DELLA TABELLA DEI RUOLI. La pagina è HTML servito
   da Vercel e non può importare un modulo Deno di supabase/functions: la
   copia è inevitabile, come per il listino e per l'indirizzo. Quello che
   non è inevitabile è che le due divergano in silenzio — la prova qui
   sotto le confronta a ogni giro.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';
import { ruoloDi } from '../../supabase/functions/buoni/ruoli.ts';

const SORGENTE = Deno.readTextFileSync(new URL('index.html', import.meta.url));

/** Il testo di una `function nome(...) { ... }`, graffe bilanciate.
 *  Stesso ritaglio di chiusura-arrivo.test.ts: si ESEGUE la funzione vera
 *  della pagina, non una copia scritta qui che potrebbe già divergere. */
function fonteDi(nome: string): string {
  const inizio = SORGENTE.indexOf(`function ${nome}(`);
  assert(
    inizio >= 0,
    `function ${nome}() non si trova in pagine/buoni/index.html: ` +
      'la pagina e cambiata, aggiornare questa prova',
  );
  const apre = SORGENTE.indexOf('{', inizio);
  let livello = 0;
  for (let i = apre; i < SORGENTE.length; i++) {
    if (SORGENTE[i] === '{') livello++;
    else if (SORGENTE[i] === '}') {
      livello--;
      if (livello === 0) return SORGENTE.slice(inizio, i + 1);
    }
  }
  throw new Error(`function ${nome}() non si chiude: sorgente troncato?`);
}

/* La funzione da sola non basta: legge ORDINE_SCHEDE, che e una costante
   e non una funzione. Senza, qui dentro verrebbe «ORDINE_SCHEDE is not
   defined»: la prova fallirebbe per una dipendenza mancante invece che
   per un difetto. Stesso inciampo gia pagato con DESIDERIO_IN_PAGINA in
   chiusura-arrivo.test.ts.

   Dal 3 settembre 2026 l'ordine delle schede e la scheda d'apertura sono
   una tabella sola (ORDINE_SCHEDE): si entra sulla prima. Prima erano due
   — l'ordine fisso e SCHEDA_PER_RUOLO — che dovevano restare d'accordo. */
/* fino a `]);` e non al primo `]`: quello chiude la prima coppia, non
   la Map, e il ritaglio si fermava li lasciando fuori tutto il resto */
const TABELLA = SORGENTE.match(/const ORDINE_SCHEDE = new Map\(\[[\s\S]*?\]\);/);
assert(TABELLA, 'ORDINE_SCHEDE non si trova: la pagina e cambiata');

/* l'elenco delle schede e quello di chi non le vede: due costanti, non
   funzioni, e senza di loro le funzioni ritagliate non girerebbero */
const ELENCO = SORGENTE.match(/const SCHEDE = \[[\s\S]*?\];/);
assert(ELENCO, 'SCHEDE non si trova: la pagina e cambiata');
const NASCOSTE = SORGENTE.match(/const SCHEDE_NASCOSTE = new Map\(\[[\s\S]*?\]\);/);
assert(NASCOSTE, 'SCHEDE_NASCOSTE non si trova: la pagina e cambiata');

const contesto = [
  TABELLA![0], ELENCO![0], NASCOSTE![0],
  fonteDi('schedaIniziale'), fonteDi('schedeNascoste'), fonteDi('schedeDi'), fonteDi('ordineDi'),
].join('\n');

const schedaIniziale = new Function(
  contesto + '\nreturn schedaIniziale;',
)() as (email: unknown) => string;

/** Le schede che questo indirizzo vede, nell'ordine della pagina. */
const schedeDi = new Function(
  contesto + '\nreturn schedeDi;',
)() as (email: unknown) => [string, string][];

/* Le schede che la pagina disegna davvero, lette dai suoi pulsanti: se
   `schedaIniziale` restituisse un nome che non esiste, il back office si
   aprirebbe su una pagina vuota — e nessuno saprebbe perché. */
function schedeDellaPagina(): string[] {
  return [...ELENCO![0].matchAll(/\['([a-zA-Z]+)',/g)].map((m) => m[1]);
}

Deno.test('la spa si apre sulle richieste, non sui buoni che non puo emettere', () => {
  assertEquals(schedaIniziale('spa@termeleonardo.com'), 'richieste');
});

Deno.test('la reception e l amministrazione si aprono dove lavorano', () => {
  /* «Per la reception: le richieste dal sito come prima cosa» (3 settembre
     2026). L'amministrazione lavora sui buoni e resta dov'era. */
  assertEquals(schedaIniziale('reception@termeleonardo.com'), 'richieste');
  assertEquals(schedaIniziale('amministrazione@termeleonardo.com'), 'emetti');
});

/* ---------- l'ordine delle schede, per chi entra ---------- */

Deno.test('la reception vede prima le richieste, poi gli arrivi, poi i buoni', () => {
  assertEquals(
    schedeDi('reception@termeleonardo.com').map(([v]) => v),
    /* «Day Spa oggi» subito dopo gli arrivi (3 settembre 2026): e' la
       scheda dello sportello; posti e prenotazioni in coda, si guardano
       una volta a settimana */
    /* le schede del POS (4 settembre 2026) in coda: sono dell'amministrazione, il server rifiuta gli altri */
    ['richieste', 'arrivi', 'dayspaOggi', 'emetti', 'elenco', 'verifica', 'dayspaDisponibilita', 'dayspaPrenotazioni', 'posMenu', 'posTavoli', 'posPersonale'],
  );
});

Deno.test('l amministrazione tiene l ordine di sempre, con i buoni davanti', () => {
  assertEquals(
    schedeDi('amministrazione@termeleonardo.com').map(([v]) => v),
    schedeDellaPagina(),
  );
  assertEquals(schedeDi('sconosciuto@termeleonardo.com').map(([v]) => v), schedeDellaPagina());
});

Deno.test('la spa vede prima le richieste e gli arrivi, senza la scheda che il server le rifiuta', () => {
  assertEquals(
    schedeDi('spa@termeleonardo.com').map(([v]) => v),
    ['richieste', 'arrivi', 'dayspaOggi', 'elenco', 'verifica', 'dayspaDisponibilita', 'dayspaPrenotazioni', 'posMenu', 'posTavoli', 'posPersonale'],
  );
});

Deno.test('riordinare non perde e non raddoppia nessuna scheda', () => {
  /* «senza fare danni»: cambiare l'ordine non puo' far sparire una scheda
     ne' disegnarla due volte, per nessuno */
  for (const email of [
    'reception@termeleonardo.com', 'spa@termeleonardo.com',
    'amministrazione@termeleonardo.com', 'sconosciuto@termeleonardo.com', '',
  ]) {
    const viste = schedeDi(email).map(([v]) => v);
    const attese = schedeDellaPagina().filter((v) => !(email === 'spa@termeleonardo.com' && v === 'emetti'));
    assertEquals([...viste].sort(), [...attese].sort(), `${email || '(vuoto)'}: le schede non sono le stesse`);
    assertEquals(new Set(viste).size, viste.length, `${email || '(vuoto)'}: una scheda compare due volte`);
  }
});

Deno.test('si entra sempre sulla prima scheda che si vede', () => {
  /* una tabella sola: se un domani l'ordine cambiasse, la scheda
     d'apertura lo seguirebbe da sola */
  for (const email of ['reception@termeleonardo.com', 'spa@termeleonardo.com', 'amministrazione@termeleonardo.com', '']) {
    assertEquals(schedaIniziale(email), schedeDi(email)[0][0], email || '(vuoto)');
  }
});

Deno.test('maiuscole e spazi non cambiano la scheda', () => {
  /* chi digita l'indirizzo a mano scrive quello che gli pare: la scheda
     non può dipendere dal tasto delle maiuscole */
  for (const scritto of ['SPA@TERMELEONARDO.COM', '  Spa@TermeLeonardo.com  ']) {
    assertEquals(schedaIniziale(scritto), 'richieste', `«${scritto}»`);
  }
});

Deno.test('un indirizzo che non si conosce non fa sparire la pagina', () => {
  /* «toString» esiste su Object.prototype: con una lookup diretta invece
     di una Map tornerebbe una funzione, e la pagina si aprirebbe su una
     scheda inesistente. Lo stesso difetto già pagato altrove. */
  for (const strano of ['toString', 'constructor', '__proto__', '', null, undefined, 42]) {
    const s = schedaIniziale(strano as unknown);
    assert(
      schedeDellaPagina().includes(s),
      `«${String(strano)}» porta alla scheda «${s}», che nella pagina non esiste`,
    );
  }
});

Deno.test('qualunque scheda scelga, esiste', () => {
  const schede = schedeDellaPagina();
  assert(schede.length >= 4, `trovate solo ${schede.length} schede: il ritaglio non guarda piu niente`);
  for (const email of [
    'spa@termeleonardo.com',
    'reception@termeleonardo.com',
    'amministrazione@termeleonardo.com',
    'sconosciuto@termeleonardo.com',
  ]) {
    const s = schedaIniziale(email);
    assert(schede.includes(s), `${email} porta a «${s}», che non e una scheda della pagina`);
  }
});

/* ---------- il presidio contro la divergenza ---------- */

Deno.test('ogni ruolo che il server conosce ha una scheda decisa qui', () => {
  /* gli indirizzi non si possono leggere dalla Map di ruoli.ts (non è
     esportata), ma ruoloDi() sì: si prova ogni indirizzo che la pagina
     dichiara di conoscere e si pretende che il server lo conosca a sua
     volta. Un ruolo nuovo aggiunto solo di là non è coperto — ed è
     esattamente quello che la riga sotto costringe a notare. */
  const noti = [...SORGENTE.matchAll(/'([a-z]+)@termeleonardo\.com'/g)].map((m) => m[1] + '@termeleonardo.com');
  const dichiarati = [...new Set(noti)];
  assert(
    dichiarati.length > 0,
    'la pagina non nomina nessun indirizzo: schedaIniziale non distingue piu i ruoli',
  );
  for (const email of dichiarati) {
    assert(
      ruoloDi(email) !== null,
      `la pagina decide una scheda per «${email}», ma ruoli.ts non lo conosce: ` +
        'una delle due copie e rimasta indietro',
    );
  }
});

/* ---------- e la funzione viene davvero usata ---------- */

Deno.test('l ingresso imposta la scheda dall indirizzo di chi entra', () => {
  /* Una funzione giusta che nessuno chiama vale zero. Qui non si può
     eseguire l'ingresso — vorrebbe un client Supabase vero — quindi si
     guarda il cablaggio: che l'ingresso la chiami, e che VISTA non nasca
     già inchiodata a una scheda, perché la sovrascriverebbe. */
  assert(
    /VISTA\s*=\s*schedaIniziale\(/.test(SORGENTE),
    'nessuno chiama schedaIniziale(): la pagina si aprira sempre sulla stessa scheda',
  );
  const nascita = SORGENTE.match(/let VISTA\s*=\s*([^;]*);/);
  assert(nascita, 'la variabile VISTA non si trova piu');
  assertEquals(
    nascita![1].trim(),
    "''",
    'VISTA nasce gia con una scheda dentro: quella di schedaIniziale non si vedrebbe mai',
  );
});

/* ---------- le schede che non servono non si mostrano ---------- */

Deno.test('la spa non vede la scheda che il server le rifiuta', () => {
  const viste = schedeDi('spa@termeleonardo.com').map(([v]) => v);
  assertEquals(
    viste.includes('emetti'),
    false,
    'la spa vede «Emetti un buono»: un modulo che puoScrivereBuoni() rifiuta, e lo scoprirebbe premendo Invia',
  );
  /* e le altre le vede tutte: nascondere una scheda non e' togliere un ruolo */
  for (const c of ['elenco', 'verifica', 'richieste', 'arrivi']) {
    assert(viste.includes(c), `alla spa manca anche «${c}», che invece le serve`);
  }
});

Deno.test('chi i buoni li emette le vede tutte', () => {
  for (const email of ['reception@termeleonardo.com', 'amministrazione@termeleonardo.com']) {
    assertEquals(
      schedeDi(email).length,
      schedeDellaPagina().length,
      `a ${email} manca una scheda`,
    );
  }
});

Deno.test('la scheda d apertura e sempre fra quelle che si vedono', () => {
  /* l'invariante che tiene insieme le due tabelle: se un domani si
     nascondesse proprio la scheda su cui quel ruolo si apre, il back
     office si aprirebbe su una scheda senza pulsante — e chi la chiude
     non saprebbe come tornarci. */
  for (const email of [
    'spa@termeleonardo.com',
    'reception@termeleonardo.com',
    'amministrazione@termeleonardo.com',
    'sconosciuto@termeleonardo.com',
    '',
  ]) {
    const viste = schedeDi(email).map(([v]) => v);
    assert(
      viste.includes(schedaIniziale(email)),
      `${email || "(vuoto)"} si apre su «${schedaIniziale(email)}», che non e fra le sue schede`,
    );
  }
});

Deno.test('ogni scheda ha un nome da mostrare', () => {
  for (const [v, t] of schedeDi('reception@termeleonardo.com')) {
    assert(t && t.trim().length > 3, `la scheda «${v}» non ha un'etichetta`);
  }
});

Deno.test('e la striscia dei pulsanti si disegna da quell elenco', () => {
  /* una funzione giusta che nessuno chiama vale zero: qui si guarda che
     disegna() prenda le schede da schedeDi() e non le abbia di nuovo
     scritte a mano nel markup. */
  assert(
    /schedeDi\(/.test(SORGENTE),
    'disegna() non chiama schedeDi(): la scheda nascosta comparirebbe lo stesso',
  );
  assertEquals(
    /data-v="[a-z]+"/.test(SORGENTE),
    false,
    'ci sono ancora pulsanti scritti a mano nel markup: quelli non si nascondono',
  );
});

/* ---------- anche con la sessione gia' aperta ---------- */

Deno.test('la sessione gia aperta imposta indirizzo e scheda come l accesso', () => {
  /* Visto in reception il 3 settembre 2026: intestazione nuova, ordine
     vecchio. La pagina con la sessione gia' aperta non passa dall'accesso,
     e EMAIL restava vuoto: schedeDi('') e schedaIniziale('') danno i
     default, per chiunque avesse la sessione aperta — la reception, sempre. */
  const ripristino = SORGENTE.match(/const \{ data \} = await SB\.auth\.getSession\(\);([\s\S]*?)chiediAccesso\(''\);/);
  assert(ripristino, 'il ripristino della sessione non si trova');
  assert(/EMAIL = data\.session\.user\.email/.test(ripristino![1]),
    'con la sessione gia aperta EMAIL resta vuoto: ordine e scheda d apertura tornano ai default');
  /* dal 3 settembre 2026 la scheda chiesta nell'indirizzo (?scheda=, il
     tablet allo sportello) vince su quella iniziale: schedaDaUrl() prima */
  assert(/VISTA = schedaDaUrl\(\) \|\| schedaIniziale\(EMAIL\)/.test(ripristino![1]),
    'con la sessione gia aperta la scheda d apertura non si decide dall indirizzo');
  assert(ripristino![1].search(/VISTA = schedaDaUrl\(\) \|\| schedaIniziale\(EMAIL\)/) < ripristino![1].indexOf('disegna()'),
    'la scheda si decide dopo aver gia disegnato');
});
