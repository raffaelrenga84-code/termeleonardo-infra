import { assert, assertEquals } from 'jsr:@std/assert';
import { type Riga } from './giudizio.ts';
import { dati, tabella } from './rapporto.ts';

const base: Riga = {
  url: '/it/day-spa',
  stato: 200,
  finale: '',
  byte: 50000,
  ms: 300,
  titolo: 'Piscine Termali ad Abano Terme con Ingresso giornaliero',
  descrizione: 'Piscine Termali ad Abano Terme aperte al pubblico con ingresso ' +
    'giornaliero? Entra e scopri tutti i servizi e le tariffe.',
  lang: 'it',
  h1: ['Day Spa'],
  canonical: 'https://www.termeleonardo.com/it/day-spa',
  hreflang: ['it', 'de', 'en', 'fr'],
  robots: '',
  parole: 800,
  immagini: 10,
  senzaAlt: 0,
};

/* Il titolo vero di /it/golf contiene una barra verticale: dentro una
   tabella markdown, non protetta, spezza la riga in due colonne e il
   rapporto diventa illeggibile proprio sulla pagina che vende ai golfisti. */
const CON_BARRA: Riga = {
  ...base,
  url: '/it/golf',
  canonical: '',
  titolo: 'Hotel con Golf ad Abano Terme | Driving Range e Terme Colli Euganei',
};

Deno.test('la tabella nomina ogni indirizzo', () => {
  const t = tabella([base, CON_BARRA], '19 agosto 2026');
  assert(t.includes('/it/day-spa'));
  assert(t.includes('/it/golf'));
});

Deno.test('la barra verticale del titolo non spezza la tabella', () => {
  const t = tabella([CON_BARRA], '19 agosto 2026');
  const righe = t.split('\n').filter((r) => r.startsWith('| /it/golf'));
  assertEquals(righe.length, 1, 'la riga della tabella non c e o e doppia');
  assertEquals(righe[0].includes('\\|'), true, 'la barra non e protetta');
});

Deno.test('i sospetti finiscono in cima, non sepolti nella tabella', () => {
  const t = tabella([base, CON_BARRA], '19 agosto 2026');
  const iProblemi = t.indexOf('Quello che non va');
  const iTabella = t.indexOf('Tutte le pagine');
  assert(iProblemi > 0 && iTabella > iProblemi, 'i problemi non vengono prima');
  assert(t.slice(iProblemi, iTabella).includes('canonical'), 'il difetto non e elencato');
});

Deno.test('la data compare nel rapporto', () => {
  assert(tabella([base], '19 agosto 2026').includes('19 agosto 2026'));
});

Deno.test('dice quanti indirizzi ha letto e quanti hanno qualcosa', () => {
  const t = tabella([base, CON_BARRA], '19 agosto 2026');
  assert(/2 indirizzi letti/.test(t), t.slice(0, 400));
  assert(/1 ha qualcosa da sistemare/.test(t), t.slice(0, 400));
});

/* Con un solo indirizzo la frase deve restare italiana: «1 indirizzi letti.
   1 hanno qualcosa» e' il genere di riga che fa perdere fiducia in tutto il
   resto del rapporto. */
Deno.test('al singolare la frase e scritta in italiano', () => {
  const t = tabella([CON_BARRA], '19 agosto 2026');
  assert(/1 indirizzo letto/.test(t), t.slice(0, 400));
  assert(/1 ha qualcosa da sistemare/.test(t), t.slice(0, 400));
});

/* Il JSON serve a confrontare due passate. Se le chiavi cambiassero
   ordine, il confronto mostrerebbe differenze dove non ce ne sono, e
   nessuno lo guarderebbe piu'. */
/* Le stesse identiche informazioni, con le chiavi inserite in ordine
   rovesciato: e' quello che succede quando qualcuno riordina i campi in un
   modulo, e non deve produrre nemmeno una riga di differenza. */
function chiaviRovesciate(r: Riga): Riga {
  const dentro = r as unknown as Record<string, unknown>;
  const fuori: Record<string, unknown> = {};
  for (const k of Object.keys(dentro).sort().reverse()) fuori[k] = dentro[k];
  return fuori as unknown as Riga;
}

Deno.test('il JSON e stabile: stessi dati, stesso testo', () => {
  const b = chiaviRovesciate(base);
  assertEquals(
    Object.keys(b as unknown as Record<string, unknown>).join(),
    Object.keys(base as unknown as Record<string, unknown>).sort().reverse().join(),
    'la prova non sta davvero rovesciando le chiavi',
  );
  assertEquals(dati([base]), dati([b]));
});

Deno.test('il JSON e ordinato per indirizzo', () => {
  const uno = dati([CON_BARRA, base]);
  const due = dati([base, CON_BARRA]);
  assertEquals(uno, due);
});

Deno.test('il JSON si rilegge', () => {
  const letto = JSON.parse(dati([base]));
  assertEquals(letto.length, 1);
  assertEquals(letto[0].url, '/it/day-spa');
});
