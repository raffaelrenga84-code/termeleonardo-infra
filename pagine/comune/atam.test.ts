/* ============================================================
   atam.test.ts — il riepilogo per il modulo dei tassisti.

   IL DIFETTO CHE PRESIDIA. Il back office mostrava un blocco solo, con le
   etichette dentro:

       Data: 15 agosto 2026
       Ora: 15:30
       Pax: 2
       ...

   e sopra ci scriveva «Da incollare su atam.biz». Ma il modulo dei tassisti
   ha un campo per ognuna di quelle cose: incollare il blocco intero significa
   scaricarlo tutto in un campo solo. Provato davvero — nel campo della data
   finiva «Data: 15 agosto 2026», la parola «Data:» compresa, il calendario
   non la sapeva leggere, e il resto spariva.

   Il blocco nasceva come aiuto alla LETTURA — perche' il luogo combacia
   parola per parola con l'elenco dei tassisti e non va tradotto — ma
   l'etichetta prometteva un INCOLLAGGIO. Da qui in poi etichetta e valore
   sono due cose separate, e si copia il valore.

   Il testo unito resta identico a prima: c'e' chi lo incolla nelle note, e
   quel modo continua a funzionare.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';
import { riepilogoATAM, vociATAM } from './atam.js';

/* il formattatore di data lo passa la pagina: questo modulo non possiede il
   modo di scrivere una data, e due copie di quella regola divergerebbero */
const dataFinta = (iso: string) => (iso ? `15 agosto 2026 [${iso}]` : '');

const RICHIESTA = {
  nome: 'Raffael Renga',
  dati: {
    quando: '2026-08-15', ora: '15:30', pax: 2, verso: 'arrivo',
    luogo: 'Venezia  aeroporto', volo: 'FR1234', note: 'due valigie grandi',
  },
};

Deno.test('ogni voce tiene separate l etichetta e il valore', () => {
  const voci = vociATAM(RICHIESTA, dataFinta);
  assert(voci.length > 0, 'nessuna voce');
  for (const v of voci) {
    assert(v.eti, 'voce senza etichetta');
    assert(v.val !== undefined, 'voce senza valore');
    /* IL DIFETTO. Se l'etichetta rientrasse nel valore, chi incolla si
       ritroverebbe «Data: 15 agosto 2026» dentro il campo della data. */
    assert(
      !String(v.val).startsWith(v.eti + ':'),
      `l etichetta e finita dentro il valore: ${v.eti} → ${v.val}`,
    );
  }
});

Deno.test('il luogo arriva parola per parola, doppio spazio compreso', () => {
  const luogo = vociATAM(RICHIESTA, dataFinta).find((v) => v.eti === 'Arrivo da');
  assert(luogo, 'il luogo non c e');
  /* i due spazi di «Venezia  aeroporto» sono nell'elenco dei tassisti: una
     voce che non combacia li costringe a cercarla a mano */
  assertEquals(luogo.val, 'Venezia  aeroporto');
});

Deno.test('una partenza si chiama partenza', () => {
  const r = { ...RICHIESTA, dati: { ...RICHIESTA.dati, verso: 'partenza' } };
  const eti = vociATAM(r, dataFinta).map((v) => v.eti);
  assert(eti.includes('Partenza per'), `etichette: ${eti.join(', ')}`);
  assert(!eti.includes('Arrivo da'));
});

Deno.test('le voci facoltative vuote non compaiono', () => {
  const r = { nome: 'Anna Verdi', dati: { quando: '2026-08-15', ora: '9:00', pax: 1, luogo: 'Abano' } };
  const eti = vociATAM(r, dataFinta).map((v) => v.eti);
  for (const assente of ['Dettagli arrivo', 'Note', 'Nota']) {
    assert(!eti.includes(assente), `${assente} non doveva esserci`);
  }
});

/* Il modo vecchio continua a funzionare: c'e' chi il blocco intero lo
   incolla nelle note del modulo dei tassisti, ed e' legittimo. */
Deno.test('il testo unito e ancora quello di prima', () => {
  assertEquals(
    riepilogoATAM(RICHIESTA, dataFinta),
    [
      'Data: 15 agosto 2026 [2026-08-15]',
      'Ora: 15:30',
      'Pax: 2',
      'Arrivo da: Venezia  aeroporto',
      'Nome del cliente: Raffael Renga',
      'Dettagli arrivo: FR1234',
      'Note: due valigie grandi',
    ].join('\n'),
  );
});

Deno.test('il ritorno si segnala come nota, senza valore da copiare', () => {
  const r = { ...RICHIESTA, dati: { ...RICHIESTA.dati, ritorno: true } };
  assert(riepilogoATAM(r, dataFinta).includes('serve anche il ritorno'));
});
