/* Il modello del buono viveva in tre copie: back office, pagina pubblica di
   acquisto ed email. Quella pubblica era rimasta indietro e mostrava al
   cliente meno di quello che avrebbe ricevuto. Questi test presidiano la
   sorgente unica delle due copie web: se il buono perde un pezzo, si vede
   qui invece che in produzione. */
import { assert, assertEquals, assertStringIncludes } from 'jsr:@std/assert';
import { buonoHTML, categoriaBuono, CONDIZIONI, ETI, riepilogoVoci, righeDescrizione } from './buono.js';
import { CONDIZIONI as CONDIZIONI_EMAIL, ETI as ETI_EMAIL } from '../../supabase/functions/buoni/email-buono.ts';
/* lo stesso schema del confronto qui sopra fra sito ed email: riepilogoVoci
   non si confronta con stringhe scritte a mano leggendo acquista.ts, si
   confronta con le funzioni vere del server, importate da qui */
import { componiDescrizione, sommaVoci, validaAcquisto, LISTINO } from '../../supabase/functions/buoni/acquista.ts';

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

/* Il buono vive in due copie per forza: il sito le prende da qui, l'email
   le ha dentro perche' va costruita a tabelle per Outlook. Ogni testo
   presente in entrambe le copie deve restare identico, o il cliente legge
   due versioni diverse dello stesso buono — e' gia' successo una volta,
   con un refuso nel testo tedesco delle condizioni.

   Questo test confronta CONDIZIONI e, dentro ETI, ogni campo che e' una
   stringa in entrambi gli oggetti (etichette, e la nota su persone e
   prenotazione) — non un elenco scritto a mano dei singoli campi, cosi'
   che un domani un nuovo campo condiviso sia coperto da solo, senza doverlo
   aggiungere qui. Prima di questo test la nota non era confrontata da
   nessuna parte: poteva divergere fra le due copie senza che nulla se ne
   accorgesse. */
Deno.test('i testi condivisi fra sito ed email restano identici, lingua per lingua', () => {
  for (const l of LINGUE) {
    assertEquals(CONDIZIONI[l], CONDIZIONI_EMAIL[l], `CONDIZIONI ${l}`);
    const sito = ETI[l] as Record<string, unknown>;
    const email = ETI_EMAIL[l] as Record<string, unknown>;
    for (const chiave of Object.keys(sito)) {
      if (typeof sito[chiave] === 'string' && typeof email[chiave] === 'string') {
        assertEquals(sito[chiave], email[chiave], `ETI.${chiave} ${l}`);
      }
    }
  }
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

/* ============================================================
   riepilogoVoci — l'anteprima nella pagina di acquisto deve dire la
   stessa cosa che comporrà il server. Non un valore atteso scritto a mano
   leggendo acquista.ts (coinciderebbe oggi ma nessun test se ne
   accorgerebbe se domani componiDescrizione cambiasse separatore, ordine
   di fusione o arrotondamento): il confronto è con l'output vero di
   componiDescrizione e sommaVoci, chiamate sugli stessi voce_id e la
   stessa quantità, con nome e prezzo presi dal LISTINO del server — non
   dal catalogo (distinto) della pagina. */

/* costruisce l'ingresso di riepilogoVoci a partire dal listino vero */
const daListino = (voce_id: string, quantita: number) =>
  ({ voce_id, nome: LISTINO[voce_id][0], prezzo: LISTINO[voce_id][1], quantita });

Deno.test('una sola voce con quantita 1 non porta il numero davanti, come componiDescrizione', () => {
  const grezze = [{ voce_id: 'relax25', quantita: 1 }];
  const r = riepilogoVoci([daListino('relax25', 1)]);
  assertEquals(r.descrizione, componiDescrizione(grezze));
  assertEquals(r.valore, sommaVoci(grezze));
  assertEquals(r.voci, grezze);
});

Deno.test('la quantita sopra a uno porta il numero davanti, come componiDescrizione', () => {
  const grezze = [{ voce_id: 'dayspa_wknd', quantita: 4 }];
  const r = riepilogoVoci([daListino('dayspa_wknd', 4)]);
  assertEquals(r.descrizione, componiDescrizione(grezze));
  assertEquals(r.valore, sommaVoci(grezze));
});

Deno.test('due voci diverse stanno su due righe nello stesso ordine di componiDescrizione', () => {
  const grezze = [{ voce_id: 'dayspa_wknd', quantita: 1 }, { voce_id: 'relax25', quantita: 2 }];
  const r = riepilogoVoci([daListino('dayspa_wknd', 1), daListino('relax25', 2)]);
  assertEquals(r.descrizione, componiDescrizione(grezze));
  assertEquals(r.valore, sommaVoci(grezze));
  assertEquals(r.voci, grezze);
});

/* qui il confronto passa da validaAcquisto: componiDescrizione e sommaVoci
   da sole non fondono le voci ripetute, lo fa normalizzaVoci dentro
   validaAcquisto (non esportata, e giustamente: e' un dettaglio interno).
   validaAcquisto e' il punto dove il server esegue davvero, sulle due voci
   grezze cosi' come le manderebbe la pagina, l'intera catena — fusione,
   composizione e totale — quindi il confronto resta vero dalla richiesta
   fino al risultato, non solo sull'ultimo pezzo. */
const BASE_ACQUISTO = { tipo: 'servizio', acquirente_email: 'a@b.it',
  condizioni_accettate: true, privacy_presa_atto: true, lingua: 'it' };

Deno.test('la stessa voce scelta due volte si fonde in una riga sola, come fa validaAcquisto sul server', () => {
  const voci = [{ voce_id: 'relax25', quantita: 2 }, { voce_id: 'relax25', quantita: 2 }];
  const r = riepilogoVoci([daListino('relax25', 2), daListino('relax25', 2)]);
  const { dati } = validaAcquisto({ ...BASE_ACQUISTO, voci });
  assertEquals(r.descrizione, dati!.descrizione);
  assertEquals(r.valore, dati!.valore);
  assertEquals(r.voci, dati!.voci);
});

Deno.test('un elenco vuoto compone un buono senza righe e senza valore, come componiDescrizione', () => {
  const r = riepilogoVoci([]);
  assertEquals(r.descrizione, componiDescrizione([]));
  assertEquals(r.valore, sommaVoci([]));
  assertEquals(r.voci, []);
});

/* ============================================================
   righeDescrizione — nel dettaglio del back office la descrizione si legge
   su più righe, come la compone il server, e dove la colonna `voci`
   combacia riga per riga con quelle righe la quantità si vede in chiaro
   quando supera uno — la STESSA soglia di riepilogoVoci/componiDescrizione,
   che sul buono del cliente non scrivono "1 × Massaggio". Le due viste
   stanno fianco a fianco sulla stessa schermata (dettaglio del back office
   sopra, anteprima del buono sotto): se qui scrivessimo "1 ×" e lì no,
   sarebbero in disaccordo proprio dove serve certezza. Per i buoni
   monetari e per quelli creati a mano dal back office `voci` è null — non
   un array vuoto, vedi colonnaVoci in acquista.ts — e lì non si inventa
   nessun numero: si torna esattamente al comportamento di oggi. */

Deno.test('buono monetario (voci null): una riga sola, nessuna quantità inventata', () => {
  const r = righeDescrizione('Buono di 100 €', null);
  assertEquals(r, [{ testo: 'Buono di 100 €', quantita: null }]);
});

Deno.test('descrizione vuota o assente non produce righe fantasma', () => {
  assertEquals(righeDescrizione('', null), []);
  assertEquals(righeDescrizione(null, null), []);
  assertEquals(righeDescrizione(undefined, null), []);
});

Deno.test('due voci: la quantità si vede in chiaro solo quando supera uno', () => {
  const descrizione = '4 × Day Spa festivo\nMassaggio antistress';
  const voci = [{ voce_id: 'dayspa_wknd', quantita: 4 }, { voce_id: 'antistress45', quantita: 1 }];
  assertEquals(righeDescrizione(descrizione, voci), [
    { testo: 'Day Spa festivo', quantita: 4 },
    { testo: 'Massaggio antistress', quantita: null },
  ]);
});

Deno.test('quantità 1 non si mostra: stessa soglia del buono del cliente, le due viste affiancate non devono contraddirsi', () => {
  const descrizione = 'Massaggio relax con olio di cacao (25 min)';
  const voci = [{ voce_id: 'relax25', quantita: 1 }];
  assertEquals(righeDescrizione(descrizione, voci), [
    { testo: 'Massaggio relax con olio di cacao (25 min)', quantita: null },
  ]);
});

Deno.test('il numero già scritto nel testo non si ripete: si toglie e si rimette dai dati', () => {
  const descrizione = '2 × Massaggio relax\n3 × Riflessologia plantare';
  const voci = [{ voce_id: 'relax25', quantita: 2 }, { voce_id: 'plantare25', quantita: 3 }];
  const r = righeDescrizione(descrizione, voci);
  assertEquals(r[0].testo, 'Massaggio relax');
  assertEquals(r[1].testo, 'Riflessologia plantare');
});

Deno.test('voci che non combaciano col numero di righe: si tace invece di inventare', () => {
  const descrizione = 'Trattamento a scelta';
  const voci = [{ voce_id: 'a', quantita: 1 }, { voce_id: 'b', quantita: 2 }];
  assertEquals(righeDescrizione(descrizione, voci), [{ testo: 'Trattamento a scelta', quantita: null }]);
});

/* Il giro completo, in un test solo: componiDescrizione compone, e
   righeDescrizione riscompone quello che ha composto — non una stringa
   scritta a mano leggendo acquista.ts. Finora le due meta' erano provate
   separatamente e coincidevano per fortuna: se domani componiDescrizione
   cambiasse il separatore (una "x" al posto del "×", o "n. 2 ·" come il
   carrello della reception), il taglio `^\d+\s*×\s*` di righeDescrizione
   non morderebbe piu' e il back office mostrerebbe il numero due volte —
   una nel testo e una nella colonna — senza che nessun test se ne accorga.
   E' la stessa disciplina gia' applicata a riepilogoVoci qui sopra. */
Deno.test('andata e ritorno: quello che componiDescrizione compone, righeDescrizione lo riscompone giusto', () => {
  const voci = [{ voce_id: 'dayspa_wknd', quantita: 4 }, { voce_id: 'antistress45', quantita: 1 }];
  assertEquals(righeDescrizione(componiDescrizione(voci), voci), [
    { testo: LISTINO.dayspa_wknd[0], quantita: 4 },
    { testo: LISTINO.antistress45[0], quantita: null },
  ]);
});

Deno.test('buono creato a mano con più righe ma voci null: le righe si vedono, senza quantità', () => {
  const descrizione = 'n. 2 · Massaggio relax\nDay Spa festivo';
  assertEquals(righeDescrizione(descrizione, null), [
    { testo: 'n. 2 · Massaggio relax', quantita: null },
    { testo: 'Day Spa festivo', quantita: null },
  ]);
});
