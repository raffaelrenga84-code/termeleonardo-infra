/* ============================================================
   foto.test.ts — le foto delle camere sulla pagina di prenotazione.

   IL DIFETTO CHE PRESIDIA. La foto e la descrizione vivono in due posti
   diversi: la descrizione arriva dal server (supabase/functions/richieste/
   camere.ts), la foto è un file servito da questa pagina. Sono due elenchi
   che parlano delle stesse camere e non si guardano.

   Le cose che possono andare storte sono tre, e nessuna si vede aprendo la
   pagina in un giorno in cui l'hotel è pieno:

   · una categoria nuova entra nel catalogo e resta senza foto — la scheda
     esce muta accanto ad altre illustrate;
   · una foto punta a un file che non c'è — il browser mostra l'icona rotta
     dell'immagine mancante sopra il prezzo di una camera;
   · una foto viene assegnata a una camera che non esiste più, e nessuno se
     ne accorge perché non compare mai.

   SULLE ACCESSIBILI NON VA LA FOTO DELLA CAMERA NORMALE. Usare la stanza
   normale della stessa famiglia per una categoria attrezzata sarebbe una
   promessa falsa proprio a chi ha più bisogno di sapere com'è fatta.

   Dal 21 agosto 2026 la Junior Suite Accessibile una foto ce l'ha: il
   bagno attrezzato della 650, l'unica camera di quella categoria secondo
   il foglio della reception. La Singola Accessibile resta in SENZA_FOTO,
   perché è un'altra stanza. E siccome quella foto è un BAGNO e non una
   camera, nasce qui il terzo presidio: il testo alternativo deve dirlo.
   Un alt che annuncia «Junior Suite Accessibile» davanti a un bagno mente
   a chi si fa leggere la pagina ad alta voce — e su una camera attrezzata
   è proprio il bagno il motivo per cui si guarda la foto.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';
import { CAMERE } from '../../supabase/functions/richieste/camere.ts';
import { altFoto, COSA_MOSTRA, FOTO_CAMERA, SENZA_FOTO, fotoDi } from './foto.js';

const QUI = new URL('.', import.meta.url);

Deno.test('ogni categoria del catalogo ha una foto, o è dichiarata senza', () => {
  const orfane: string[] = [];
  for (const [id, c] of Object.entries(CAMERE)) {
    const n = Number(id);
    if (Object.hasOwn(FOTO_CAMERA, n) || SENZA_FOTO.includes(n)) continue;
    orfane.push(`${n} (${c.nome})`);
  }
  assertEquals(
    orfane,
    [],
    'categorie senza foto e non dichiarate: la scheda esce muta accanto alle altre. ' +
      'Aggiungere la foto in FOTO_CAMERA, oppure scrivere la categoria in SENZA_FOTO col motivo.',
  );
});

Deno.test('nessuna foto e assegnata a una camera che non esiste piu', () => {
  const fantasmi = Object.keys(FOTO_CAMERA)
    .map(Number)
    .filter((n) => !Object.hasOwn(CAMERE, n));
  assertEquals(
    fantasmi,
    [],
    'foto assegnate a categorie che il catalogo non ha più: non si vedranno mai, ' +
      'e chi legge questo elenco crede che siano coperte',
  );
});

Deno.test('ogni file di foto esiste davvero', () => {
  const nomi = new Set(Object.values(FOTO_CAMERA));
  assert(nomi.size > 0, 'nessuna foto: la prova girerebbe a vuoto');
  for (const nome of nomi) {
    const f = new URL('img/' + nome, QUI);
    let misura = 0;
    try {
      misura = Deno.statSync(f).size;
    } catch {
      throw new Error(
        `img/${nome} non esiste: il browser mostrerebbe l'icona dell'immagine rotta ` +
          'sopra il prezzo di una camera',
      );
    }
    /* le altre immagini del progetto stanno fra 49 e 80 KB. Sopra i 120 si
       sta servendo l'originale da fotocamera, che su una scheda da 400px
       non si vede meglio e su rete mobile si sente. */
    assert(
      misura > 3000 && misura < 120_000,
      `img/${nome} pesa ${Math.round(misura / 1024)} KB: fuori dai limiti (3-120 KB)`,
    );
  }
});

Deno.test('le categorie dichiarate senza foto restano senza, e la funzione lo dice', () => {
  /* non è una ripetizione dell'elenco: è la verifica che la funzione che la
     pagina chiama davvero restituisca il vuoto, e non la foto della camera
     normale della stessa famiglia */
  for (const id of SENZA_FOTO) {
    assertEquals(
      fotoDi(id),
      '',
      `la camera ${id} è dichiarata senza foto ma fotoDi() ne restituisce una: ` +
        'a chi cerca una camera accessibile verrebbe mostrata una stanza che non lo è',
    );
  }
  assert(SENZA_FOTO.length > 0, 'SENZA_FOTO è vuoto: la prova non guarda niente');
});

Deno.test('fotoDi restituisce un percorso servibile, non un nome nudo', () => {
  const idConFoto = Number(Object.keys(FOTO_CAMERA)[0]);
  const p = fotoDi(idConFoto);
  assert(p.startsWith('/prenota/img/'), `percorso inatteso: ${p}`);
  /* una camera che non esiste non deve far esplodere la pagina */
  assertEquals(fotoDi(9999), '');
  assertEquals(fotoDi(undefined as unknown as number), '');
});

Deno.test('quando la foto non ritrae la stanza, il testo alternativo lo dice', () => {
  /* il difetto: l'alt di una foto camera è il nome della camera. Va bene
     finché la foto è la stanza; la 8 ha la foto del bagno. Senza questo,
     chi si fa leggere la pagina sente «Junior Suite Accessibile» e crede
     di stare guardando la camera. */
  assertEquals(
    altFoto(8, 'Junior Suite Accessibile'),
    'Junior Suite Accessibile — il bagno attrezzato',
  );
  /* e le altre non cambiano: il nome nudo, come prima */
  assertEquals(altFoto(5, 'Doppia'), 'Doppia');
  assertEquals(altFoto(undefined as unknown as number, 'Doppia'), 'Doppia');
});

Deno.test('ogni avviso nel testo alternativo descrive una foto che esiste', () => {
  /* un avviso su una categoria senza foto non si vedrebbe mai, e chi legge
     questo elenco crederebbe che la 8 sia coperta quando non lo è */
  const vuoti = Object.keys(COSA_MOSTRA)
    .map(Number)
    .filter((n) => !Object.hasOwn(FOTO_CAMERA, n));
  assertEquals(vuoti, [], 'COSA_MOSTRA descrive foto che non ci sono');
  assert(Object.keys(COSA_MOSTRA).length > 0, 'COSA_MOSTRA è vuoto: la prova non guarda niente');
});

Deno.test('la pagina chiama altFoto, non il nome nudo', () => {
  /* la prova sopra vale solo se la pagina la usa davvero: qui si guarda il
     markup, perché un alt corretto in un modulo che nessuno chiama non
     arriva a nessuno */
  const pagina = Deno.readTextFileSync(new URL('index.html', QUI));
  assert(
    pagina.includes('alt="${esc(altFoto(g.camera_id, g.nome))}"'),
    'la foto camera non passa piu da altFoto(): il bagno tornerebbe ad annunciarsi come la stanza',
  );
});
