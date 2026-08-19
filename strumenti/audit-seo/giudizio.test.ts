import { assert, assertEquals } from 'jsr:@std/assert';
import { type Riga, sospetti } from './giudizio.ts';

const SANA: Riga = {
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

/* Senza questa prova una funzione che si lamenta sempre passerebbe tutte
   le altre. */
Deno.test('su una pagina a posto non trova niente', () => {
  assertEquals(sospetti(SANA), []);
});

Deno.test('conta i cinque h1 di cure-termali e golf', () => {
  const r = { ...SANA, h1: ['a', 'b', 'c', 'd', 'e'] };
  assert(sospetti(r).some((s) => /5 h1/.test(s)), sospetti(r).join(' · '));
});

Deno.test('vede la pagina senza h1', () => {
  assert(sospetti({ ...SANA, h1: [] }).some((s) => /nessun h1/.test(s)));
});

Deno.test('vede il canonical che manca su tutto il sito', () => {
  assert(sospetti({ ...SANA, canonical: '' }).some((s) => /canonical/.test(s)));
});

Deno.test('vede l hreflang che manca, con quattro lingue vive', () => {
  assert(sospetti({ ...SANA, hreflang: [] }).some((s) => /hreflang/.test(s)));
});

/* Il doppio spazio dentro «Hotel 4 Stelle  con Cure Termali» e' vero e
   sta nel titolo di /it/cure-termali. */
Deno.test('vede il doppio spazio nel titolo', () => {
  const r = { ...SANA, titolo: 'Cure ad Abano Terme Hotel 4 Stelle  con Cure Termali' };
  assert(sospetti(r).some((s) => /doppio spazio/.test(s)), sospetti(r).join(' · '));
});

Deno.test('vede il titolo troppo lungo e dice quanto', () => {
  const r = { ...SANA, titolo: 'x'.repeat(95) };
  assert(sospetti(r).some((s) => /95/.test(s)), sospetti(r).join(' · '));
});

Deno.test('vede la pagina che non risponde 200', () => {
  assert(sospetti({ ...SANA, stato: 404 }).some((s) => /404/.test(s)));
});

Deno.test('vede le immagini senza alt e dice su quante', () => {
  const r = { ...SANA, immagini: 12, senzaAlt: 5 };
  assert(sospetti(r).some((s) => /5/.test(s) && /12/.test(s)), sospetti(r).join(' · '));
});

Deno.test('vede i meta in una lingua diversa da quella dichiarata', () => {
  const r: Riga = {
    ...SANA,
    url: '/fr',
    lang: 'fr',
    titolo: 'A 4 Star Spa Hotel in Abano Terme | Hotel Terme Leonardo',
    descrizione: 'Book now your vacation in a 4 star hotel in Abano Terme: ' +
      'Hotel Terme Leonardo offers you many spa services such as hot spring, ' +
      'pool and beauty farm.',
  };
  assert(sospetti(r).some((s) => /dichiara/.test(s)), sospetti(r).join(' · '));
});

Deno.test('la pagina senza titolo e senza description lo dice due volte', () => {
  const s = sospetti({ ...SANA, titolo: '', descrizione: '' });
  assert(s.some((x) => /senza titolo/.test(x)));
  assert(s.some((x) => /senza description/.test(x)));
});
