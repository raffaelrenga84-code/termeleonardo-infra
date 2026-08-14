/* Il modello del buono viveva in tre copie: back office, pagina pubblica di
   acquisto ed email. Quella pubblica era rimasta indietro e mostrava al
   cliente meno di quello che avrebbe ricevuto. Questi test presidiano la
   sorgente unica delle due copie web: se il buono perde un pezzo, si vede
   qui invece che in produzione. */
import { assert, assertEquals, assertStringIncludes } from 'jsr:@std/assert';
import { buonoHTML, categoriaBuono, CONDIZIONI } from './buono.js';
import { CONDIZIONI as CONDIZIONI_EMAIL } from '../../supabase/functions/buoni/email-buono.ts';

/* as const: senza, le lingue sono string[] e TypeScript non le accetta come
   chiavi delle condizioni */
const LINGUE = ['it', 'de', 'en', 'fr'] as const;

const dayspa = {
  tipo: 'voce',
  voce_id: 'dayspa_fer',
  descrizione: 'Day Spa infrasettimanale — piscine e grotte, dal lunedì al venerdì, 9.00–18.30',
  lingua: 'it',
  codice: 'ABCD-1234',
  numero: 'BR-2026-0007',
  scade_il: '2027-08-13',
  destinatario: 'Anna',
  acquirente: 'Marco',
};

const valore = {
  tipo: 'valore',
  voce_id: null,
  descrizione: 'Buono di 100 €',
  lingua: 'it',
  codice: 'WXYZ-9876',
  scade_il: '2027-08-13',
};

Deno.test('il buono Day Spa porta il racconto, non solo il titolo', () => {
  const h = buonoHTML(dayspa, false);
  assertStringIncludes(h, 'PISCINE TERMALI');
  assertStringIncludes(h, 'Un momento di pura quiete');
  assertStringIncludes(h, 'Colli Euganei');
});

Deno.test('il buono Day Spa elenca cosa comprende', () => {
  const h = buonoHTML(dayspa, false);
  assertStringIncludes(h, 'Piscine termali interna ed esterna');
  assertStringIncludes(h, 'Biogrotta');
  assertStringIncludes(h, 'Cascata di acqua termale');
});

Deno.test('il buono porta contatti, scadenza e condizioni', () => {
  const h = buonoHTML(dayspa, false);
  assertStringIncludes(h, 'www.termeleonardo.com');
  assertStringIncludes(h, '+39 049 9939200');
  assertStringIncludes(h, '13 agosto 2027');
  assertStringIncludes(h, 'Su prenotazione');
  assertStringIncludes(h, 'da fine novembre a febbraio');
});

Deno.test('il buono monetario non eredita gli inclusi del Day Spa', () => {
  const h = buonoHTML(valore, false);
  assert(!h.includes('Biogrotta'), 'il buono monetario non deve elencare le piscine');
  assertStringIncludes(h, 'valore.jpg');
});

Deno.test('la lingua cambia il racconto e la data', () => {
  const de = buonoHTML({ ...dayspa, lingua: 'de' }, false);
  assertStringIncludes(de, 'THERMALB');
  assertStringIncludes(de, 'Biogrotte');
  assertStringIncludes(de, '13. August 2027');
  const fr = buonoHTML({ ...dayspa, lingua: 'fr' }, false);
  assertStringIncludes(fr, 'PISCINES THERMALES');
  assertStringIncludes(fr, '13 août 2027');
});

Deno.test('in bozza il codice resta coperto', () => {
  const h = buonoHTML(dayspa, true);
  assertStringIncludes(h, 'ANTEPRIMA');
  assert(!h.includes('ABCD-1234'), 'in anteprima il codice non si mostra');
  const vero = buonoHTML(dayspa, false);
  assertStringIncludes(vero, 'ABCD-1234');
});

Deno.test('i nomi con caratteri speciali non rompono il buono', () => {
  const h = buonoHTML({ ...dayspa, destinatario: 'Bar & Co <script>' }, false);
  assertStringIncludes(h, 'Bar &amp; Co &lt;script&gt;');
  assert(!h.includes('<script>'), 'il nome non deve poter iniettare un tag');
});

/* Le condizioni restano in due copie per forza: il buono del sito le prende
   da qui, l'email le ha dentro perche' va costruita a tabelle per Outlook.
   Questo test e' l'unica cosa che impedisce loro di divergere in silenzio —
   ed e' gia' successo una volta, con un refuso nel testo tedesco. */
Deno.test('le condizioni del sito e quelle dell email sono identiche', () => {
  for (const l of LINGUE) assertEquals(CONDIZIONI[l], CONDIZIONI_EMAIL[l], `lingua ${l}`);
});

Deno.test('le condizioni nominano cancellazione, modifica e no show', () => {
  const attese: Record<string, string[]> = {
    it: ['cancellazione', 'modifica', 'no show'],
    de: ['Stornierung', 'nderung', 'No-Show'],
    en: ['cancellation', 'modification', 'no-show'],
    fr: ['annulation', 'modification', 'no-show'],
  };
  for (const l of LINGUE) {
    for (const parola of attese[l]) {
      assertStringIncludes(CONDIZIONI[l].toLowerCase(), parola.toLowerCase(), `lingua ${l}`);
    }
  }
});

Deno.test('la validita decorre dall emissione, non dall acquisto', () => {
  const attese: Record<string, string> = {
    it: 'un anno dalla data di emissione',
    de: 'ein Jahr ab Ausstellungsdatum',
    en: 'one year from the date of issue',
    /* apostrofo tipografico ’, non quello dritto: il testo usa il primo */
    fr: 'un an à compter de la date d’émission',
  };
  for (const l of LINGUE) assertStringIncludes(CONDIZIONI[l], attese[l], `lingua ${l}`);
});

Deno.test('la categoria decide la fotografia', () => {
  assert(categoriaBuono({ tipo: 'valore' }) === 'valore');
  assert(categoriaBuono({ tipo: 'voce', voce_id: 'dayspa_sera' }) === 'dayspa');
  assert(categoriaBuono({ tipo: 'voce', voce_id: 'antistress' }) === 'massaggi');
  assert(categoriaBuono({ tipo: 'voce', voce_id: 'collagene' }) === 'viso');
  assert(categoriaBuono({ tipo: 'voce', voce_id: 'scrub' }) === 'corpo');
});
