/* ============================================================
   ora-trattamenti.test.ts — un'ora precisa per i trattamenti.

   Chiesto dalla proprietà: «nei trattamenti dai la possibilità anche di
   mettere l'orario, non solo mattina/pomeriggio». Chi ha un treno alle
   sei o una cura alle dieci non ha una preferenza generica: ha un'ora.

   TRE MODI DI ROMPERSI:

   · l'ora parte con la richiesta e il server la scarta — l'ospite l'ha
     detta e non lo sa nessuno, che è il difetto del buono regalo;
   · un'ora storta fa fallire la richiesta invece di sparire: si perde una
     prenotazione per un campo facoltativo;
   · l'ora arriva e nell'email si legge «pomeriggio», cioè la fascia che
     l'ospite ha lasciato a caso mentre scriveva 15:00.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';
import { validaDati } from './tipi.ts';
import { dettagli, ETICHETTE } from './dettagli-richiesta.ts';
import { richiestaHTML } from './email-richiesta.ts';

const OGGI = new Date('2026-08-23T09:00:00Z');
const BASE = { voci: ['Massaggio relax 50 minuti'], giorno: '2026-09-10' };

const valida = (d: Record<string, unknown>) =>
  validaDati('trattamenti', { ...BASE, ...d }, OGGI);

Deno.test('l ora precisa arriva fino al jsonb', () => {
  const v = valida({ ora: '15:00' });
  assertEquals(v.errore, undefined);
  assertEquals(v.dati!.ora, '15:00');
});

Deno.test('e mezzanotte e mezzogiorno passano come tutte le altre', () => {
  /* i due estremi che una regex scritta a occhio sbaglia */
  assertEquals(valida({ ora: '00:00' }).dati!.ora, '00:00');
  assertEquals(valida({ ora: '23:59' }).dati!.ora, '23:59');
  assertEquals(valida({ ora: '12:00' }).dati!.ora, '12:00');
});

Deno.test('un ora storta sparisce, non fa fallire la richiesta', () => {
  /* fra perdere l ora e perdere la prenotazione, l errore giusto e il
     primo: la fascia resta a dire quando */
  for (const brutta of ['25:00', '9:5', 'pomeriggio', '15.00', '', '  ', 24, null, {}]) {
    const v = valida({ ora: brutta });
    assertEquals(v.errore, undefined, `«${JSON.stringify(brutta)}» ha fatto fallire la richiesta`);
    assertEquals('ora' in v.dati!, false, `«${JSON.stringify(brutta)}» e passata`);
  }
});

Deno.test('e chi non la scrive non porta un campo vuoto', () => {
  const v = valida({});
  assertEquals('ora' in v.dati!, false);
  assertEquals(v.dati!.fascia, 'indifferente');
});

Deno.test('la fascia resta per chi un ora precisa non ce l ha', () => {
  /* la fascia non e un doppione: chi non ha un ora non deve inventarsene
     una per poter mandare la richiesta */
  assertEquals(valida({ fascia: 'mattina' }).dati!.fascia, 'mattina');
});

/* ============ e nelle email si legge una cosa sola ============ */

const conOra = (d: Record<string, unknown>) => ({
  tipo: 'trattamenti', numero: 'RS-2026-0020', nome: 'Mario Rossi',
  email: 'mario@example.com', telefono: '3331234567', lingua: 'it',
  ...valida(d).dati!,
});

Deno.test('nella ricevuta l ora VINCE sulla fascia', () => {
  /* «pomeriggio · 15:00» sono due modi di dire la stessa cosa, e chi legge
     ne vuole uno. Se l ospite ha scritto un ora, quella conta. */
  const html = dettagli('trattamenti', conOra({ fascia: 'pomeriggio', ora: '15:00' }), ETICHETTE.it);
  assert(html.includes('15:00'), 'l ora non si legge');
  assert(!html.includes('pomeriggio'), 'si legge anche la fascia: due orari per la stessa richiesta');
});

Deno.test('e senza ora si legge la fascia, come sempre', () => {
  const html = dettagli('trattamenti', conOra({ fascia: 'mattina' }), ETICHETTE.it);
  assert(html.includes('mattina'), 'sparita anche la fascia');
});

Deno.test('e nell avviso alla reception vale la stessa regola', () => {
  /* l avviso si costruisce le righe per conto suo: e gia successo che una
     delle due restasse indietro */
  const html = richiestaHTML(conOra({ fascia: 'pomeriggio', ora: '15:00' }) as never);
  assert(html.includes('15:00'), 'l ora non arriva in reception');
  assert(!html.includes('pomeriggio'), 'in reception si leggono due orari diversi');
});

Deno.test('e la pagina la chiede, in tutte e quattro le lingue', () => {
  const PAGINA = Deno.readTextFileSync(
    new URL('../../../pagine/richieste/index.html', import.meta.url),
  );
  /* «fOra» ERA GIA PRESO dal green fee e dal maestro, che su questa stessa
     pagina hanno un campo ora da sempre: cercare quello rendeva la prova
     vacua — la trovava comunque. Il campo dei trattamenti si chiama
     fOraTratt, e le mutazioni che glielo tolgono adesso muoiono. */
  assert(PAGINA.includes('id="fOraTratt"'), 'la pagina non chiede piu l ora dei trattamenti');
  assert(PAGINA.includes("ora: v('fOraTratt')"), 'la pagina non manda piu l ora dei trattamenti');
  for (const k of ['oraPrecisa:', 'oraPrecisaNota:']) {
    assertEquals(PAGINA.split(k).length - 1, 4, `«${k}» non c'e' in tutte e quattro le lingue`);
  }
});
