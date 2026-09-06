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

Deno.test('«Day Spa oggi» legge il QR anche con la fotocamera: un tablet basta, senza PC', () => {
  /* «che hardware possiamo prevedere per obliterare gli ingressi, per non
     occupare un PC costantemente aperto?» (la proprieta', 3 settembre
     2026): la fotocamera del tablet o del telefono, dalla stessa pagina */
  const f = fonteDi('vistaDayspaOggi');
  assert(/id="dOggiCam"/.test(f), 'manca il pulsante della fotocamera');
  assert(/getUserMedia\(/.test(f), 'la fotocamera si apre con getUserMedia');
  assert(/BarcodeDetector/.test(f), 'dove c e, si usa il lettore del browser');
  assert(/\/comune\/jsqr\.js/.test(f), 'dove non c e (iPhone), si carica jsQR');
  assert(/wakeLock/.test(f), 'lo schermo del tablet non deve spegnersi mentre si scansiona');
  assert(/facingMode/.test(f), 'la fotocamera posteriore, non quella per i selfie');
  let esiste = false;
  try { esiste = Deno.statSync(new URL('../comune/jsqr.js', import.meta.url)).isFile; } catch { /* manca */ }
  assert(esiste, 'manca pagine/comune/jsqr.js: la copia locale della libreria, senza dipendere da un CDN');
  /* il tablet allo sportello apre direttamente la scheda giusta: ?scheda=dayspaOggi */
  const url = fonteDi('schedaDaUrl');
  assert(/\.get\('scheda'\)/.test(url) && /SCHEDE\.some\(/.test(url), 'schedaDaUrl deve accettare solo una scheda che esiste');
  assert((SORGENTE.match(/schedaDaUrl\(\) \|\| vistaDallHash\(\) \|\| 'home'/g) ?? []).length >= 1, 'all apertura la scheda dall indirizzo vince sulla home (7 settembre 2026)');
});

Deno.test('modalita sportello: solo «Day Spa oggi», senza le altre schede ne esci, e la pagina si installa come app', () => {
  /* «devo creargli una app dedicata per far in modo che per sbaglio non
     tocchino o escano?» (la proprieta', 3 settembre 2026): no. Con
     ?sportello=1 la pagina mostra solo la scheda dello sportello, senza
     la barra delle schede e senza «esci»; il manifest la fa installare
     sul tablet come un'app a tutto schermo, e il blocco su app di Android
     fa il resto. */
  const s = fonteDi('sportello');
  assert(/\.get\('sportello'\)/.test(s), 'la modalita sportello si accende dall indirizzo');
  const d = fonteDi('disegna');
  assert(/sportello\(\)/.test(d), 'disegna() deve sapere della modalita sportello');
  assert(/class="barra"/.test(d), 'la barra della pagina (Home, titolo) resta per tutti gli altri');
  assert(/<link rel="manifest" href="\/buoni\/manifest\.webmanifest"/.test(SORGENTE), 'manca il manifest');
  const m = JSON.parse(Deno.readTextFileSync(new URL('manifest.webmanifest', import.meta.url))) as Record<string, unknown>;
  assertEquals(m.display, 'standalone');
  assert(String(m.start_url).includes('scheda=dayspaOggi') && String(m.start_url).includes('sportello=1'));
  assert(Array.isArray(m.icons) && (m.icons as unknown[]).length >= 1);
  /* «e l operatore come fa a controllare?»: dopo la scansione un riquadro
     grande, verde o rosso, con nome, persone, presenti e giorno */
  const f = fonteDi('vistaDayspaOggi');
  assert(/esitoGrande ok/.test(f) && /esitoGrande no/.test(f), 'l esito della scansione deve essere grande e colorato');
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
