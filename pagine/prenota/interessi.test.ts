/* ============================================================
   interessi.test.ts — quello che gli servirà oltre alla camera,
   chiesto DENTRO il modulo.

   COM'ERA. Trattamenti, transfer, green fee e maestro si potevano
   chiedere solo dalla schermata dopo l'invio, con quattro pulsanti che
   aprono i moduli veri. Chi arriva in fondo li usa; chi legge il numero
   di pratica e chiude la pagina — cioè molti — non li vede mai, e la
   reception non sa che gli serviva un transfer.

   COM'È. Quattro spunte nel modulo. Non sono richieste: giorno, ora e
   numero di volo stanno nei moduli veri, e la pagina lo dice. Sono
   l'informazione che la reception ha in mano quando richiama per
   confermare la camera.

   TRE MODI DI ROMPERSI, e nessuno si vede spuntando una casella e
   guardando la schermata del grazie:

   · la spunta parte col modulo ma il server la scarta, perché il jsonb è
     a elenco chiuso: l'ospite l'ha detto e non lo sa nessuno — è
     esattamente il difetto del buono regalo, già visto in questo
     progetto;
   · arriva al database ma non compare nell'avviso alla reception, che è
     l'unica cosa che qualcuno legge davvero;
   · le chiavi della pagina e quelle del server divergono, e la spunta
     sparisce in silenzio.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';
import { componiCorpo } from './logica.js';
import { validaDati } from '../../supabase/functions/richieste/tipi.ts';
import { dettagli, ETICHETTE, LINGUE } from '../../supabase/functions/richieste/dettagli-richiesta.ts';

const PAGINA = Deno.readTextFileSync(new URL('index.html', import.meta.url))
  .split('\r\n').join('\n');
const TIPI = Deno.readTextFileSync(
  new URL('../../supabase/functions/richieste/tipi.ts', import.meta.url),
);

const OGGI = new Date('2026-08-22T09:00:00Z');
const CAMERA = {
  scelta: { nome: 'Doppia', camera_id: 5, variante_id: 1, tariffa: 'Soggiorno breve', trattamento: 'Mezza Pensione', prezzo_cent: 31000 },
  nome: 'Mario Rossi', email: 'mario@example.com', telefono: '3331234567',
  checkIn: '2026-09-02', checkOut: '2026-09-04', adulti: 2, bambini: 0,
  note: '', lingua: 'it',
};

/* ============ la pagina li manda ============ */

Deno.test('le spunte partono con la richiesta', () => {
  const corpo = componiCorpo({ ...CAMERA, interessi: ['trattamenti', 'transfer'] });
  assertEquals(corpo.dati.interessi, ['trattamenti', 'transfer']);
});

Deno.test('e senza spunte il campo non c e affatto', () => {
  /* un elenco vuoto in back office si legge come «gli e stato chiesto e
     non gli serve niente», che e' un altro fatto */
  for (const i of [[], undefined, null, 'trattamenti']) {
    const corpo = componiCorpo({ ...CAMERA, interessi: i as unknown as string[] });
    assertEquals('interessi' in corpo.dati, false, `«${JSON.stringify(i)}» ha prodotto un campo`);
  }
});

Deno.test('e sono CHIAVI, non le parole che l ospite ha letto', () => {
  /* la pagina parla quattro lingue: «Anwendungen im Spa» in back office
     andrebbe letto da chi in quel momento aveva davanti un'altra parola */
  const corpo = componiCorpo({ ...CAMERA, lingua: 'de', interessi: ['trattamenti'] });
  assertEquals(corpo.dati.interessi, ['trattamenti']);
});

/* ============ il server le tiene ============ */

Deno.test('il server registra le quattro chiavi che conosce', () => {
  const { errore, dati } = validaDati('soggiorno', {
    camera_id: 5, interessi: ['trattamenti', 'transfer', 'greenfee', 'maestro'],
  }, OGGI);
  assertEquals(errore, undefined);
  assertEquals(dati!.interessi, ['trattamenti', 'transfer', 'greenfee', 'maestro']);
});

Deno.test('e butta via quello che non e in elenco, senza rifiutare la richiesta', () => {
  /* fra perdere una spunta e perdere una prenotazione, l'errore giusto e'
     il primo: la camera arriva comunque in reception */
  const { errore, dati } = validaDati('soggiorno', {
    camera_id: 5, interessi: ['trattamenti', 'massaggio-gratis', '', 42, null],
  }, OGGI);
  assertEquals(errore, undefined);
  assertEquals(dati!.interessi, ['trattamenti']);
});

Deno.test('e i doppioni non diventano due transfer da organizzare', () => {
  const { dati } = validaDati('soggiorno', {
    camera_id: 5, interessi: ['transfer', 'transfer', 'trattamenti'],
  }, OGGI);
  /* e nell'ordine di casa, non in quello in cui sono arrivate */
  assertEquals(dati!.interessi, ['trattamenti', 'transfer']);
});

Deno.test('e quello che non e una lista non passa per una lista', () => {
  for (const i of ['trattamenti', 42, {}, null]) {
    const { errore, dati } = validaDati('soggiorno', { camera_id: 5, interessi: i }, OGGI);
    assertEquals(errore, undefined);
    assertEquals('interessi' in dati!, false, `«${JSON.stringify(i)}» e passato`);
  }
});

/* ============ la reception le legge ============ */

Deno.test('le spunte compaiono nell avviso alla reception', () => {
  /* il difetto del buono regalo, per intero: il dato arrivava al database
     e non compariva nell'email, cioe' nell'unica cosa che qualcuno legge */
  const html = dettagli('soggiorno', {
    check_in: '2026-09-02', check_out: '2026-09-04', tipo_camera: 'Doppia',
    interessi: ['trattamenti', 'transfer'],
  }, ETICHETTE.it);
  assert(html.includes('Da richiamare per'), 'manca la riga degli interessi');
  assert(html.includes('Trattamenti alla spa'), 'mancano i trattamenti');
  assert(html.includes('Transfer aeroporto'), 'manca il transfer');
});

Deno.test('e si leggono nella lingua di chi legge', () => {
  /* questa email la rilegge anche l ospite, nella SUA lingua */
  const attese: Record<string, string> = {
    it: 'Trattamenti alla spa', de: 'Anwendungen im Spa',
    en: 'Spa treatments', fr: 'Soins au spa',
  };
  for (const l of LINGUE) {
    const html = dettagli('soggiorno', { interessi: ['trattamenti'] }, ETICHETTE[l]);
    assert(html.includes(attese[l]), `in ${l} manca «${attese[l]}»`);
  }
});

Deno.test('e una chiave sconosciuta sparisce invece di stamparsi nuda', () => {
  /* stampare all ospite il nome interno di un campo e il parente stretto
     di «undefined» */
  const html = dettagli('soggiorno', { interessi: ['toString', 'trattamenti'] }, ETICHETTE.it);
  assert(!html.includes('toString'), 'una chiave sconosciuta e finita nell email');
  assert(html.includes('Trattamenti alla spa'), 'sparita anche quella buona');
});

Deno.test('e senza spunte la riga non compare affatto', () => {
  const html = dettagli('soggiorno', { tipo_camera: 'Doppia' }, ETICHETTE.it);
  assert(!html.includes('Da richiamare per'), 'la riga esce vuota a chi non ha spuntato niente');
});

/* ============ le due meta parlano la stessa lingua ============ */

Deno.test('le chiavi della pagina sono quelle del server', () => {
  /* le funzioni si pubblicano separate e non possono importare dalla
     pagina: se divergono, la spunta sparisce senza che nessuno se ne
     accorga — l'ospite l'ha detto e in reception non arriva */
  const dalServer = TIPI.match(/const INTERESSI = \[([^\]]*)\]/);
  assert(dalServer, 'INTERESSI sparito da tipi.ts');
  const chiavi = (s: string) =>
    [...s.matchAll(/'([a-z]+)'/g)].map((m) => m[1]);
  const server = chiavi(dalServer![1]);

  const base = PAGINA.match(/const INTERESSI = \[([^\]]*)\]/);
  const golf = PAGINA.match(/const INTERESSI_GOLF = \[([^\]]*)\]/);
  assert(base && golf, 'gli elenchi sono spariti dalla pagina');
  assertEquals([...chiavi(base![1]), ...chiavi(golf![1])], server);
});

/* la scelta delle spunte si ESEGUE: guardare il testo della pagina
   diceva che il Golf era nominato, non che cambiava qualcosa */
function pezzo(re: RegExp, come: string): string {
  const m = PAGINA.match(re);
  assert(m, `${come} non si trova nella pagina: se e stato rinominato questa prova va aggiornata, non cancellata`);
  return m![0];
}

function quali(tariffe: string[]): string[] {
  /* i TRE pezzi e solo quelli: una fetta dalla prima costante fino alla
     funzione si porterebbe dietro mezza pagina */
  const sorgente = [
    pezzo(/const INTERESSI = \[[^\]]*\];/, 'INTERESSI'),
    pezzo(/const INTERESSI_GOLF = \[[^\]]*\];/, 'INTERESSI_GOLF'),
    pezzo(/function interessiDaMostrare\(\) \{[\s\S]*?\n\}/, 'interessiDaMostrare'),
  ].join('\n');
  const f = new Function('tutteLeCamere', sorgente + '; return interessiDaMostrare;');
  return f(() => tariffe.map((tf) => ({ scelta: { tariffa: tf } })))();
}

Deno.test('green fee e maestro si chiedono solo a chi ha scelto il Golf', () => {
  /* a tutti gli altri sarebbero due righe che non vogliono dire niente */
  assertEquals(quali(['Miglior Prezzo']), ['trattamenti', 'transfer']);
  assertEquals(quali(['Offerta Golf']), ['trattamenti', 'transfer', 'greenfee', 'maestro']);
});

Deno.test('e basta che il Golf stia in UNA delle camere', () => {
  /* chi lo prende per se e una camera normale per la suocera gioca lo
     stesso: guardare solo l ultima camera scelta lo lascerebbe fuori */
  assertEquals(quali(['Golf', 'Miglior Prezzo']).length, 4);
  assertEquals(quali(['Miglior Prezzo', 'Golf']).length, 4);
  assertEquals(quali([]).length, 2);
});

Deno.test('le spunte stanno nel modulo, prima del pulsante invia', () => {
  /* si guarda dove sta il RIQUADRO, non dove sta il nome di una classe:
     un riquadro sotto il pulsante invia non lo legge nessuno */
  const spunte = PAGINA.indexOf('interessiDaMostrare().map((k)');
  const invia = PAGINA.indexOf('id="bInvia"');
  assert(spunte > 0, 'le spunte non si disegnano piu nel modulo');
  assert(spunte < invia, 'le spunte stanno dopo il pulsante invia: nessuno le vedrebbe');
});

Deno.test('e quello che l ospite ha spuntato non sparisce al ridisegno', () => {
  /* cambiare tariffa ridisegna il modulo: era gia' successo con nome ed
     email, ed e' il difetto che datiScritti() esiste per evitare */
  assert(
    PAGINA.includes("interessi: interessiDaMostrare().filter((k) => b('f_' + k)),"),
    'le spunte non si conservano piu fra un ridisegno e l altro',
  );
  assert(
    PAGINA.includes("(gia.interessi || []).includes(k) ? ' checked' : ''"),
    'il modulo non si ridisegna piu con le spunte di prima',
  );
});

Deno.test('e la pagina non le chiama prenotazioni', () => {
  /* «Prenoti i trattamenti» accanto a una casella prometterebbe una
     prenotazione che non c'e': i moduli veri vogliono giorno e ora */
  const guide = [...PAGINA.matchAll(/serveGuida:'([^']*)'/g)].map((m) => m[1]);
  assertEquals(guide.length, 4, `le guide sono ${guide.length}, non 4`);
  for (const [i, g] of guide.entries()) {
    assert(g.length > 40, `guida ${i + 1} troppo corta: «${g}»`);
  }
  /* e le voci ci sono in tutte e quattro le lingue */
  assertEquals(PAGINA.split('serveVoce:').length - 1, 4);
  assertEquals(PAGINA.split('serveTit:').length - 1, 4);
});
