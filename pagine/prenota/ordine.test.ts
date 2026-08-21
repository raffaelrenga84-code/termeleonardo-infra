/* ============================================================
   ordine.test.ts — con quale ordine escono le categorie di camera.

   IL DIFETTO CHE PRESIDIA. L'ordine con cui il motore restituisce le
   proposte non è quello con cui la reception le venderebbe, e non è un
   dettaglio estetico: è la prima cosa che vede chi sta per prenotare. Chi
   cercava per due persone trovava davanti le suite, e la Doppia e la Queen
   dopo mezza pagina di scorrimento.

   E LE ACCESSIBILI USCIVANO IN MEZZO ALLE ALTRE, mentre il resto della
   casa ha la regola opposta: il chatbot non deve proporne a chi non ha
   dichiarato un'esigenza di accessibilità, e il listino interno le dà
   «solo su richiesta espressa». Qui vanno in fondo — la disponibilità non
   si nasconde, ma non si mette davanti a chi non l'ha chiesta.

   TRE MODI DI ROMPERSI, e nessuno si vede aprendo la pagina in un giorno
   in cui il motore restituisce già le camere nell'ordine giusto:

   · una categoria sparisce nel riordino, o esce due volte — chi cercava
     quella camera non la trova più e prenota altrove;
   · l'elenco nomina un identificativo che il catalogo non ha (rinumerato,
     tolto): la regola non si applica e nessuno se ne accorge;
   · nasce una terza categoria accessibile e finisce in mezzo alle altre
     perché l'elenco IN_FONDO non la conosce.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';
import { CAMERE } from '../../supabase/functions/richieste/camere.ts';
import { IN_FONDO, ordinaGruppi, PRIMA_PER_ADULTI } from './ordine.js';

type Gruppo = { camera_id: number };
const gruppi = (...id: number[]): Gruppo[] => id.map((camera_id) => ({ camera_id }));
const id = (g: Gruppo[]) => g.map((x) => x.camera_id);

/* l'ordine in cui il motore le ha restituite davvero il 21 agosto 2026:
   suite e junior suite davanti, le due che si vendono in mezzo */
const DAL_MOTORE = gruppi(9, 4, 12, 5, 8, 6, 3);

Deno.test('per due persone escono prima la Queen e la Doppia', () => {
  assertEquals(id(ordinaGruppi(DAL_MOTORE, 2)).slice(0, 2), [6, 5]);
});

Deno.test('per una persona escono prima la Singola Parco e la Queen', () => {
  assertEquals(id(ordinaGruppi(DAL_MOTORE, 1)).slice(0, 2), [3, 6]);
});

Deno.test('le accessibili vanno in fondo, comunque sia la ricerca', () => {
  /* anche per un numero di adulti che nessun elenco copre, e anche quando
     il numero non arriva proprio: è la regola che non ha eccezioni */
  for (const adulti of [1, 2, 3, 4, undefined, null, 'due']) {
    const fuori = id(ordinaGruppi(DAL_MOTORE, adulti as number));
    const ultime = fuori.slice(-IN_FONDO.length).sort();
    assertEquals(
      ultime,
      [...IN_FONDO].sort(),
      `con adulti=${adulti} le accessibili non sono in fondo: ${fuori.join(' ')}`,
    );
  }
});

Deno.test('nel riordino non si perde e non si duplica niente', () => {
  /* il danno peggiore: una categoria che sparisce. Chi cercava quella
     camera non la trova e prenota da un'altra parte. */
  for (const adulti of [1, 2, 5]) {
    const fuori = ordinaGruppi(DAL_MOTORE, adulti);
    assertEquals(fuori.length, DAL_MOTORE.length, `con adulti=${adulti} cambia il numero`);
    assertEquals(id(fuori).sort(), id(DAL_MOTORE).sort(), `con adulti=${adulti} cambia l'insieme`);
  }
});

Deno.test('e chi non è in nessun elenco tiene l ordine del motore', () => {
  /* 9, 12 e 3 non sono nominate per due adulti: devono uscire fra loro
     nell'ordine in cui sono arrivate, non riordinate a caso */
  const fuori = id(ordinaGruppi(DAL_MOTORE, 2)).filter((n) => [9, 12, 3].includes(n));
  assertEquals(fuori, [9, 12, 3]);
});

Deno.test('non tocca l array che riceve', () => {
  const prima = id(DAL_MOTORE).join(' ');
  ordinaGruppi(DAL_MOTORE, 2);
  assertEquals(id(DAL_MOTORE).join(' '), prima, 'ordinaGruppi ha riordinato l array del chiamante');
});

Deno.test('un elenco vuoto o assente non fa esplodere la pagina', () => {
  assertEquals(ordinaGruppi([], 2), []);
  assertEquals(ordinaGruppi(undefined as unknown as Gruppo[], 2), []);
});

Deno.test('ogni identificativo nominato esiste nel catalogo', () => {
  /* una categoria rinumerata o tolta lascerebbe qui un numero che non
     corrisponde a niente: la regola smetterebbe di applicarsi in silenzio */
  const nominati = [...IN_FONDO, ...[...PRIMA_PER_ADULTI.values()].flat()];
  const fantasmi = nominati.filter((n) => !Object.hasOwn(CAMERE, n));
  assertEquals(fantasmi, [], 'identificativi che il catalogo non ha');
});

Deno.test('e ogni categoria accessibile del catalogo è fra quelle in fondo', () => {
  /* se un domani nasce una terza camera attrezzata, finirebbe in mezzo
     alle altre e nessuno se ne accorgerebbe */
  const accessibili = Object.values(CAMERE)
    .filter((c) => /accessibil/i.test(c.nome))
    .map((c) => c.id);
  assert(accessibili.length > 0, 'nessuna categoria accessibile: la prova non guarda niente');
  const scoperte = accessibili.filter((n) => !IN_FONDO.includes(n));
  assertEquals(
    scoperte,
    [],
    'categorie accessibili che il riordino non manda in fondo: ' +
      'uscirebbero in mezzo alle altre a chi non le ha chieste',
  );
});

Deno.test('la pagina riordina davvero, e il pulsante sta nella barra', () => {
  /* le prove qui sopra valgono solo se la pagina chiama la funzione: una
     regola giusta in un modulo che nessuno usa non arriva a nessuno */
  const pagina = Deno.readTextFileSync(new URL('index.html', import.meta.url));
  assert(
    pagina.includes('ordinaGruppi(gruppi, RICERCA && RICERCA.adulti)'),
    'la schermata non chiama piu ordinaGruppi: torna l ordine del motore',
  );
  assert(
    pagina.includes('${inOrdine.map(g =>'),
    'la schermata disegna ancora `gruppi`, non quelli riordinati',
  );
  assert(
    /\.barraScelta\{[^}]*position:sticky/.test(pagina),
    'la barra non e piu appiccicata al fondo: il pulsante torna in fondo all elenco',
  );
  assert(
    pagina.includes('<div class="barraScelta">'),
    'la barra non c e piu nel markup',
  );
});
