/* ============================================================
   aggiornamento.test.ts — l'estensione si ricarica da sola.

   PERCHE'. L'estensione e' caricata scompattata da una cartella di
   OneDrive: i file arrivano su tutti i computer della reception, ma
   Edge non guarda se sono cambiati. A ogni versione qualcuno doveva
   fare il giro delle postazioni e premere Ricarica, e quando non lo
   faceva un computer mandava le email col codice di due settimane
   prima — senza che nessuno se ne accorgesse. E' il difetto della
   v2.8.8 moltiplicato per il numero di postazioni.

   COSA SORVEGLIA QUESTA PROVA. Il confronto fra versioni, che e'
   l'unica parte che si puo' eseguire fuori dal browser, e le tre
   precauzioni scritte nel codice. Il resto — se Edge rilegge davvero
   il manifest dal disco — si sa solo provandolo su un computer vero,
   e sta scritto nel LEGGIMI.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';

const SORGENTE = Deno.readTextFileSync(new URL('background.js', import.meta.url));

function versioneMaggiore(): (a: string, b: string) => boolean {
  const nulla = () => {};
  const chrome = {
    runtime: {
      onMessage: { addListener: nulla }, onStartup: { addListener: nulla },
      onInstalled: { addListener: nulla }, getManifest: () => ({ version: '0.0.0' }),
      getURL: (p: string) => p, reload: nulla,
    },
    storage: { local: { get: () => Promise.resolve({}), set: nulla }, onChanged: { addListener: nulla } },
    alarms: { create: nulla, onAlarm: { addListener: nulla } },
    action: { setPopup: nulla, setTitle: nulla },
    sidePanel: { setPanelBehavior: nulla, open: nulla },
    commands: { onCommand: { addListener: nulla } },
    scripting: { executeScript: () => Promise.resolve([]) },
    tabs: { create: nulla, query: () => Promise.resolve([]) },
  };
  const f = new Function('chrome', 'self', 'fetch', SORGENTE + '\nreturn versioneMaggiore;');
  return f(chrome, {}, () => Promise.reject(new Error('non serve'))) as (a: string, b: string) => boolean;
}

Deno.test('2.9.7 e piu nuova di 2.9.6, e 2.9.6 non lo e di se stessa', () => {
  const v = versioneMaggiore();
  assert(v('2.9.7', '2.9.6'), '2.9.7 dovrebbe essere piu nuova');
  assertEquals(v('2.9.6', '2.9.6'), false, 'la stessa versione non ricarica');
  assertEquals(v('2.9.5', '2.9.6'), false, 'una versione piu vecchia non ricarica mai');
});

Deno.test('2.9.10 e piu nuova di 2.9.9: si confrontano numeri, non testo', () => {
  /* per il testo «2.9.10» viene prima di «2.9.9», e la reception sarebbe
     rimasta ferma alla 2.9.9 per sempre */
  const v = versioneMaggiore();
  assert(v('2.9.10', '2.9.9'), 'confronto alfabetico invece che numerico');
  assert(v('2.10.0', '2.9.99'), 'confronto alfabetico sul secondo numero');
  assert(v('3.0.0', '2.99.99'), 'confronto alfabetico sul primo numero');
});

Deno.test('un numero piu corto non inganna il confronto', () => {
  const v = versioneMaggiore();
  assert(v('2.9.1', '2.9'), '2.9.1 e piu nuova di 2.9');
  assertEquals(v('2.9', '2.9.1'), false, '2.9 non e piu nuova di 2.9.1');
});

Deno.test('le tre precauzioni sono nel codice', () => {
  /* non si eseguono qui — servono un browser e un disco — ma se
     spariscono, sparisce la ragione per cui questo e' sicuro */
  assert(
    /cache: 'no-store'/.test(SORGENTE),
    'senza no-store il manifest arriva dalla cache e dice per sempre la versione di partenza',
  );
  assert(
    /lavoroInCorso/.test(SORGENTE) && /leonardo_email_pendente/.test(SORGENTE),
    'ricarica anche con un email in attesa: si perde quello che si stava facendo',
  );
  assert(
    /CHIAVE_RICARICA/.test(SORGENTE),
    'non si ricorda per quale versione ha gia ricaricato: se il ricaricamento non prende, ci riprova all infinito',
  );
});

Deno.test('il permesso alarms c e, se no non si sveglia mai', () => {
  const manifest = JSON.parse(
    Deno.readTextFileSync(new URL('manifest.json', import.meta.url)),
  ) as { permissions: string[] };
  assert(
    manifest.permissions.includes('alarms'),
    'senza il permesso alarms il service worker dorme e non controlla niente',
  );
});
