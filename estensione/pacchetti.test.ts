/* ============================================================
   pacchetti.test.ts — le didascalie dei pacchetti sotto il trattamento.

   PERCHE' ESISTE QUESTA PROVA. Il blocco del Dolce Vita Spezial e' stato
   scritto una volta, perso, riscritto e perso di nuovo: nel repo non c'era,
   e ci e' tornato solo perche' la proprieta' aveva conservato una copia del
   pacchetto. Un lavoro che si perde due volte non si perde per sbadataggine:
   si perde perche' niente lo tiene fermo. Adesso lo tiene questa prova.

   NON GUARDA IL TESTO DEL FILE, LO ESEGUE. template.js e' uno script da
   browser e non esporta nulla: lo si valuta dentro una funzione e si prende
   quello che serve. Cosi' la prova verifica il comportamento — «Spezial 10
   cure» scrive dieci — invece di verificare che una certa stringa esista.

   L'ORDINE DELLE CHIAVI E' LOAD-BEARING. notaPacchetto prende la PRIMA
   chiave che compare nel nome della tariffa: 'spezial' deve stare prima di
   'dolce vita', perche' «Dolce Vita Spezial» le contiene tutte e due; e
   'novem'/'feb' stanno prima di 'spezial', percio' «November Spezial»
   continua a prendere il blocco vecchio. Quest'ultima e' una scelta
   commerciale, non un difetto: sta scritta qui perche' chi riordina le
   chiavi sappia cosa sta cambiando.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';

const SORGENTE = Deno.readTextFileSync(new URL('template.js', import.meta.url));

type Modelli = {
  PACCHETTI: Record<string, Record<string, unknown>>;
  notaPacchetto: (trattamento: string, lingua: string) => string;
};

function carica(): Modelli {
  const fabbrica = new Function(`${SORGENTE}\nreturn { PACCHETTI, notaPacchetto };`);
  return fabbrica() as Modelli;
}

Deno.test('template.js si carica: se non si carica, nessuna email esce', () => {
  const m = carica();
  assert(m.PACCHETTI && typeof m.notaPacchetto === 'function');
});

Deno.test('il pacchetto Spezial esiste, in tedesco inglese e francese', () => {
  const { PACCHETTI } = carica();
  const p = PACCHETTI['spezial'];
  assert(p, 'la voce «spezial» non c e: e il blocco che si e gia perso due volte');
  for (const l of ['de', 'en', 'fr']) {
    assert(String(p[l] ?? '').length > 100, `manca il testo in ${l}`);
  }
});

/* «Spezial 5 cure» e «Spezial 10 cure» sono lo stesso pacchetto con il ciclo
   raddoppiato: la descrizione deve dire quante applicazioni, non una frase
   generica buona per entrambi. */
Deno.test('il numero di applicazioni si legge dal nome della tariffa', () => {
  const { notaPacchetto } = carica();
  const dieci = notaPacchetto('Spezial 10 cure', 'de');
  const cinque = notaPacchetto('Spezial 5 cure', 'de');
  assert(/10 Naturfangopackungen/.test(dieci), dieci.slice(0, 200));
  assert(/5 Naturfangopackungen/.test(cinque), cinque.slice(0, 200));
});

/* Senza numero nel nome il segnaposto deve sparire, non restare in vista:
   un «{N} Naturfangopackungen» in un'email e' peggio di una frase generica. */
Deno.test('senza numero nel nome il segnaposto non arriva all ospite', () => {
  const { notaPacchetto } = carica();
  for (const l of ['de', 'en', 'fr']) {
    const t = notaPacchetto('Spezial', l);
    assert(!t.includes('{N}'), `${l}: il segnaposto e rimasto dentro`);
  }
});

/* «Dolce Vita Spezial» contiene le parole di due chiavi. Vince spezial
   perche' viene prima: se qualcuno riordinasse la tabella, l'ospite del
   pacchetto piu' ricco leggerebbe la descrizione di quello base. */
Deno.test('Dolce Vita Spezial prende il blocco Spezial, non quello base', () => {
  const { notaPacchetto } = carica();
  const spezial = notaPacchetto('Dolce Vita Spezial 5 cure', 'de');
  const base = notaPacchetto('Dolce Vita 10 cure', 'de');
  assert(/Wohlf/.test(spezial), 'manca il Wohlfuehlprogramm: ha preso il blocco base');
  assert(!/Wohlf/.test(base), 'il Dolce Vita base non deve avere il Wohlfuehlprogramm');
});

/* Scelta commerciale, non difetto: November e Februar Spezial tengono i
   loro blocchi storici (Gala-Dinner, escursione ai Colli). Se un giorno il
   listino li sostituisce, e' questa riga a diventare rossa e a ricordare
   che era una decisione. */
Deno.test('November e Februar Spezial restano ai loro blocchi di sempre', () => {
  const { notaPacchetto } = carica();
  assert(/Kurwoche/.test(notaPacchetto('November Spezial 5 cure', 'de')));
  assert(/Diner du Patron/.test(notaPacchetto('Februar Spezial 5 cure', 'de')));
});

Deno.test('nell ordine della tabella spezial viene prima di dolce vita', () => {
  const chiavi = Object.keys(carica().PACCHETTI);
  const i = chiavi.indexOf('spezial');
  const j = chiavi.indexOf('dolce vita');
  assert(i >= 0 && j >= 0, 'una delle due chiavi non c e');
  assert(i < j, `spezial e in posizione ${i}, dolce vita in ${j}: vanno invertite`);
});
