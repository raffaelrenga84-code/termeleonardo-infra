/* ============================================================
   chiusura.test.ts — «in quel periodo siamo chiusi».

   PERCHE'. Nella sola settimana del 22 agosto 2026 questa risposta e'
   stata scritta a mano almeno due volte, sempre uguale: a Matteo
   Tonucci il 22 e a Borrometi Piscine il 23. E' il tipo di email che
   non ha bisogno di nessuno.

   IL RICONOSCIMENTO GUARDA LE DATE, NON LE PAROLE. Cercare «dicembre»
   nel testo avrebbe pescato anche chi scrive a dicembre per agosto:
   si legge la data di arrivo con lo stesso leggiDate() dell'anteprima
   e si guarda se cade dentro CHIUSURA.

   LA COSA PIU' PERICOLOSA QUI E' UNA STAGIONE VECCHIA. Se nessuno
   aggiorna CHIUSURA, l'estensione dira' a un ospite che siamo chiusi
   in un periodo in cui siamo aperti — e lo dira' con sicurezza. Per
   questo c'e' una prova che guarda il calendario.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';

const FILE = [
  'template.js', 'template-conferma.js', 'template-de.js',
  'template-en.js', 'template-fr.js', 'template-extra.js',
];
const SORGENTE = FILE.map((f) => Deno.readTextFileSync(new URL(f, import.meta.url))).join('\n');

const LINGUE = ['it', 'de', 'en', 'fr'] as const;
type Lingua = typeof LINGUE[number];

type Modelli = {
  html: Record<string, (d: Record<string, unknown>, o: Record<string, unknown>) => string>;
  ogg: Record<string, () => string>;
  dentro: (iso: string) => boolean;
  chiusura: { dal: string; al: string; riaperturaVaga: boolean };
};

function modelli(): Modelli {
  const coda = `
    return {
      html: { it: costruisciChiusuraIT, de: costruisciChiusuraDE,
              en: costruisciChiusuraEN, fr: costruisciChiusuraFR },
      ogg:  { it: oggettoChiusuraIT, de: oggettoChiusuraDE,
              en: oggettoChiusuraEN, fr: oggettoChiusuraFR },
      dentro: dentroChiusura, chiusura: CHIUSURA
    };`;
  return new Function(SORGENTE + coda)() as Modelli;
}

const OPZ = { genere: 'M', titolo: '', firma: 'La Reception' };
const D = { intestatario: 'Tonucci Matteo' };

Deno.test('le date dentro la chiusura si riconoscono, quelle fuori no', () => {
  const m = modelli();
  assert(m.dentro('2026-12-15'), 'il 15 dicembre 2026 dovrebbe essere dentro la chiusura');
  assert(m.dentro(m.chiusura.dal), 'il primo giorno di chiusura e dentro');
  assertEquals(m.dentro('2026-11-01'), false, 'il primo novembre siamo aperti');
  assertEquals(m.dentro(m.chiusura.al), false, 'il giorno di riapertura siamo aperti');
  assertEquals(m.dentro(''), false, 'una data vuota non e dentro niente');
});

Deno.test('la risposta esce nelle quattro lingue, con le date giuste', () => {
  const m = modelli();
  const ATTESE: Record<Lingua, RegExp> = {
    it: /29 novembre 2026[\s\S]*met&agrave; febbraio 2027/,
    de: /29\. November 2026[\s\S]*Mitte Februar 2027/,
    en: /29 November 2026[\s\S]*mid-February 2027/,
    fr: /29 novembre 2026[\s\S]*mi-f&eacute;vrier 2027/,
  };
  for (const l of LINGUE) {
    const html = m.html[l](D, OPZ);
    assert(html.length > 800, `la risposta ${l} e troppo corta per essere un'email`);
    assert(ATTESE[l].test(html), `date di chiusura sbagliate o mancanti in ${l}`);
  }
});

Deno.test('non e un no secco: invita a scegliere altre date', () => {
  /* chi scrive per dicembre spesso viene lo stesso in un'altra data:
     chiudere la porta e basta e' una prenotazione persa */
  const m = modelli();
  const INVITO: Record<Lingua, RegExp> = {
    it: /altro periodo/i,
    de: /anderen Zeitpunkt/i,
    en: /another time/i,
    fr: /autre p&eacute;riode/i,
  };
  for (const l of LINGUE) {
    assert(INVITO[l].test(m.html[l](D, OPZ)), `manca l invito ad altre date in ${l}`);
  }
});

Deno.test('la chiusura si aggiorna in un posto solo', () => {
  /* se le date fossero ricopiate nei quattro testi, alla stagione
     prossima se ne aggiornerebbero tre su quattro */
  const extra = Deno.readTextFileSync(new URL('template-extra.js', import.meta.url));
  assert(
    !/2026-11-29|2027-02-15/.test(extra),
    'le date della chiusura sono ricopiate in template-extra.js: vanno solo in CHIUSURA',
  );
  const base = Deno.readTextFileSync(new URL('template.js', import.meta.url));
  assertEquals(
    (base.match(/2026-11-29/g) || []).length,
    1,
    'la data di chiusura compare piu di una volta anche in template.js',
  );
});

Deno.test('LA STAGIONE NON E VECCHIA', () => {
  /* IL RISCHIO VERO. Con una stagione passata l'estensione direbbe a un
     ospite «siamo chiusi» in un periodo in cui siamo aperti, e lo direbbe
     con sicurezza. Quando questa prova diventa rossa non e' un difetto
     del codice: e' che qualcuno deve aggiornare CHIUSURA in template.js,
     oppure svuotare `dal` finche' le date della nuova stagione non ci
     sono. */
  const m = modelli();
  if (!m.chiusura.dal) return; // svuotata di proposito: niente da controllare
  const oggi = new Date().toISOString().slice(0, 10);
  assert(
    m.chiusura.al > oggi,
    `la riapertura e' fissata al ${m.chiusura.al}, che e' gia' passata: ` +
      'aggiorna CHIUSURA in template.js o svuota «dal»',
  );
});

Deno.test('il pulsante in Outlook guarda le date, non le parole', () => {
  const inject = Deno.readTextFileSync(new URL('outlook-inject.js', import.meta.url));
  assert(/trovaRichiestaChiusura/.test(inject), 'sparito il riconoscimento della chiusura');
  assert(
    /dentroChiusura\(isoDaLetta\(date\.arrivo\)\)/.test(inject),
    'il riconoscimento non passa piu dalle date lette: cercare «dicembre» nel testo ' +
      'pescherebbe anche chi scrive a dicembre per agosto',
  );
  assert(
    /leonardo-chiusura-btn/.test(inject),
    'il pulsante non ha piu un suo identificativo: comparirebbe due volte',
  );
});
