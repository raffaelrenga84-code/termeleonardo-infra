/* ============================================================
   calendario-moduli.test.ts — i moduli che chiedono un giorno solo usano il
   calendario, con i giorni chiusi in grigio.

   «Quei calendari sono anche in trattamenti, transfer, green fee, maestro di
   golf; e attenzione che alcuni dati vengono precaricati dai link delle
   offerte» (la proprieta', 3 settembre 2026). Il campo data resta nel
   modulo, nascosto, con lo stesso id, lo stesso valore ISO e gli stessi min
   e max: la precompilazione dai link e le regole di ogni modulo (il
   soggiorno dell'ospite, il preavviso dei trattamenti, il ritorno dopo
   l'andata) non cambiano. Prove sul sorgente: il DOM in Deno non c'e'.
   ============================================================ */
import { assert } from 'jsr:@std/assert';

const RICHIESTE = Deno.readTextFileSync(new URL('index.html', import.meta.url));
const TRANSFER = Deno.readTextFileSync(new URL('transfer/index.html', import.meta.url));

for (const [nome, pagina, campi] of [
  ['richieste', RICHIESTE, ['fData', 'fGiorno']],
  ['transfer', TRANSFER, ['fQuando', 'fRitornoQuando']],
] as const) {
  Deno.test(`${nome}: importa il calendario, legge le chiusure dal server, innesta i campi del giorno`, () => {
    assert(/from '\/comune\/calendario\.js'/.test(pagina), 'la pagina non importa il calendario');
    assert(/leggiChiusure\(FUNZIONE\)/.test(pagina), 'la pagina non legge le chiusure dal server');
    assert(/chiusure: \(\) => CHIUSURE/.test(pagina), 'il calendario non riceve le chiusure lette dopo');
    for (const id of campi) {
      assert(pagina.includes(`'${id}'`) && /innestaGiorno\(\{ campo: \$\(id\)/.test(pagina), `${id} non viene innestato`);
      assert(new RegExp(`<input type="date" id="${id}"`).test(pagina), `${id} deve restare un campo data nel modulo: e' il calendario a nasconderlo`);
    }
    const attiva = pagina.indexOf('attivaDate();');
    const innesto = pagina.indexOf('innestaGiorno({ campo: $(id)');
    assert(attiva > 0 && innesto > attiva, 'l innesto deve venire dopo attivaDate(), a ogni disegno del modulo');
  });
}
