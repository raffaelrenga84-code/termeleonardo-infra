/* ============================================================
   dayspa-schede.test.ts — le tre schede del Day Spa nel back office.

   «Day Spa oggi» con lo scanner e i presenti, «Disponibilità Day Spa» con
   i posti settimanali, «Prenotazioni Day Spa» con la ricerca e, solo per
   chi tocca il denaro, il rimborso. Prove sul sorgente e, dove si puo',
   eseguendo la funzione vera della pagina (il rimborso: la regola e' una
   copia di dayspa/ruoli.ts e non deve divergere).
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';
import { puoRimborsare, ruoloDi } from '../../supabase/functions/dayspa/ruoli.ts';

const SORGENTE = Deno.readTextFileSync(new URL('index.html', import.meta.url));

/** Il testo di una `function nome(...) { ... }`, graffe bilanciate. */
function fonteDi(nome: string): string {
  const inizio = SORGENTE.indexOf(`function ${nome}(`);
  assert(inizio >= 0, `function ${nome}() non si trova in pagine/buoni/index.html`);
  const apre = SORGENTE.indexOf('{', inizio);
  let prof = 0;
  for (let i = apre; i < SORGENTE.length; i++) {
    if (SORGENTE[i] === '{') prof++;
    else if (SORGENTE[i] === '}' && --prof === 0) return SORGENTE.slice(inizio, i + 1);
  }
  throw new Error(`function ${nome}() non si chiude`);
}

function elencoSchede(): string[] {
  const m = SORGENTE.match(/const SCHEDE = \[[\s\S]*?\];/);
  assert(m, 'const SCHEDE non si trova');
  return [...m![0].matchAll(/\['([a-zA-Z]+)',/g)].map((x) => x[1]);
}

function ordine(email: string): string[] {
  const m = SORGENTE.match(/const ORDINE_SCHEDE = new Map\(\[([\s\S]*?)\]\);/);
  assert(m, 'ORDINE_SCHEDE non si trova');
  const riga = m![1].split('\n').find((r) => r.includes(`'${email}'`));
  assert(riga, `ORDINE_SCHEDE non ha ${email}`);
  /* l'indirizzo ha una chiocciola e non e' catturato: si legge da dopo la
     parentesi che apre l'elenco delle schede */
  const dopo = riga!.slice(riga!.indexOf('[', riga!.indexOf(email) + 1));
  return [...dopo.matchAll(/'([a-zA-Z]+)'/g)].map((x) => x[1]);
}

Deno.test('le tre schede del Day Spa esistono, con la funzione che le disegna', () => {
  const schede = elencoSchede();
  for (const s of ['dayspaOggi', 'dayspaDisponibilita', 'dayspaPrenotazioni']) assert(schede.includes(s), `manca la scheda ${s}`);
  for (const f of ['vistaDayspaOggi', 'vistaDayspaDisponibilita', 'vistaDayspaPrenotazioni']) {
    assert(new RegExp('function[ ]+' + f + '[ ]*[(]').test(SORGENTE), `manca ${f}()`);
  }
  assert(/FUNZIONE_DAYSPA = 'https:\/\/mvuiuwakuseockotlcnp\.supabase\.co\/functions\/v1\/dayspa'/.test(SORGENTE));
});

Deno.test('reception e spa hanno «Day Spa oggi» subito dopo gli arrivi, e le altre due in coda', () => {
  assertEquals(ordine('reception@termeleonardo.com'), ['richieste', 'arrivi', 'dayspaOggi', 'emetti', 'elenco', 'verifica', 'dayspaDisponibilita', 'dayspaPrenotazioni']);
  assertEquals(ordine('spa@termeleonardo.com'), ['richieste', 'arrivi', 'dayspaOggi', 'elenco', 'verifica', 'dayspaDisponibilita', 'dayspaPrenotazioni']);
});

Deno.test('«Day Spa oggi»: il campo dello scanner ha il fuoco e Invio, i presenti si segnano, le ricevute in attesa si vedono', () => {
  const f = fonteDi('vistaDayspaOggi');
  assert(/id="dOggiCod"/.test(f), 'manca il campo del lettore');
  assert(/\$\('dOggiCod'\)\.focus\(\)/.test(f), 'il fuoco deve stare nel campo appena si apre la scheda');
  assert(/\.key (===|!==) 'Enter'/.test(f), 'il lettore preme Invio');
  assert(/a=presenti/.test(f), 'i presenti si segnano con ?a=presenti');
  assert(/a=oggi&giorno=/.test(f));
  assert(/da_battere/.test(f), 'le ricevute in attesa devono vedersi');
});

Deno.test('«Disponibilità»: quattordici giorni, tipo e prezzo proposti dalla regola, salvataggio in un colpo', () => {
  const f = fonteDi('vistaDayspaDisponibilita');
  assert(/a=disponibilita/.test(f));
  assert(/tipoProposto/.test(f), 'il tipo del giorno lo propone il server');
  assert(/\{ righe \}|righe:/.test(f) && /method: ?'POST'/.test(f), 'si salva con un POST di righe');
  assert(/venduti/.test(f), 'i posti gia venduti si vedono accanto ai posti caricati');
  /* «da disponibilita puoi aggiornarla con l API del sito vecchio»: un
     pulsante che riempie le righe da Fidra, e poi si salva come sempre */
  assert(/id="dDispFidra"/.test(f) && /a=fidra/.test(f), 'manca il pulsante che legge i posti da Fidra');
  assert(/liberiFidra/.test(f), 'accanto ai posti va detto quanti sono liberi in Fidra');
});

Deno.test('«Prenotazioni»: ricerca, e il rimborso solo a chi tocca il denaro, con la stessa regola del server', () => {
  const f = fonteDi('vistaDayspaPrenotazioni');
  assert(/a=elenco/.test(f) && /a=rimborsa/.test(f));
  assert(/confirm\(/.test(f), 'il rimborso chiede conferma');
  assert(/puoRimborsareDayspa\(/.test(f), 'il pulsante del rimborso passa dalla regola dei ruoli');
  const regola = fonteDi('puoRimborsareDayspa');
  const inPagina = new Function(regola + '; return puoRimborsareDayspa;')() as (e: string) => boolean;
  for (const e of ['reception@termeleonardo.com', 'spa@termeleonardo.com', 'amministrazione@termeleonardo.com', 'altro@termeleonardo.com', '']) {
    assertEquals(inPagina(e), puoRimborsare(ruoloDi(e)), `la pagina e il server non sono d accordo su ${e || '(vuoto)'}`);
  }
});
