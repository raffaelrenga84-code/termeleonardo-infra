/* ============================================================
   regala/importo.test.ts — l'importo libero mostrato nell'anteprima e sul
   pulsante deve arrotondare come il server, non come faceva parseFloat.

   IL DIFETTO CHE PRESIDIA. La pagina calcolava `valore = parseFloat(...) ||
   0`, il server valida con `Math.round(Number(b.valore) || 0)` dentro
   validaAcquisto (supabase/functions/buoni/acquista.ts). Il valore di un
   <input type="number"> usa sempre il punto come separatore decimale,
   qualunque sia la lingua della pagina: chi scriveva "100.6" vedeva
   "Paga con carta — 100,60 €", e la carta veniva addebitata di 101 €, in
   silenzio — un euro di differenza che il cliente scopriva solo
   sull'estratto conto.

   COME. regala/index.html non e' eseguibile da Deno (e' HTML con uno
   <script type="module"> inline, niente DOM qui dentro): si estrae con una
   regex l'espressione assegnata a `arrotondaValore` — la stessa tecnica di
   listino-copie.test.ts per il CATALOGO — e la si confronta, per lo stesso
   elenco di importi, con l'arrotondamento vero che fa il server dentro
   validaAcquisto (importato da acquista.ts, non riscritto a mano qui: se
   domani il server cambiasse formula, questo test lo prenderebbe da solo,
   senza dover restare sincronizzato a mano con un secondo file). */
import { assert, assertEquals } from 'jsr:@std/assert';
import { validaAcquisto } from '../../../supabase/functions/buoni/acquista.ts';

const SORGENTE = Deno.readTextFileSync(new URL('index.html', import.meta.url));

/* la stessa riga che regala/index.html assegna a arrotondaValore: se la
   formula cambiasse, questo test la rilegge da sola invece di restare a
   confrontare una copia scritta qui a mano */
function estraiArrotondaValore(): (v: unknown) => number {
  const m = SORGENTE.match(/const arrotondaValore = \(v\) => (.+);/);
  assert(m, "arrotondaValore non trovata in regala/index.html: la pagina e' cambiata, aggiornare questo test");
  return new Function('v', `return ${m![1]};`) as (v: unknown) => number;
}

const arrotondaValore = estraiArrotondaValore();

const BASE = { tipo: 'valore', acquirente_email: 'a@b.it',
  condizioni_accettate: true, privacy_presa_atto: true, lingua: 'it' };

Deno.test("la pagina arrotonda l'importo libero come fa il server, non come parseFloat", () => {
  /* "100.6" e' il caso concreto segnalato: il valore del campo con i
     decimali che parseFloat lasciava passare intatto */
  const casi = ['100.6', '24.5', '999.6', '25', '1000', '500.4', '500.5'];
  for (const importo of casi) {
    const { dati } = validaAcquisto({ ...BASE, valore: importo });
    assert(dati, `il server dovrebbe accettare l'importo ${importo}`);
    assertEquals(arrotondaValore(importo), dati!.valore, `arrotondamento di "${importo}"`);
  }
});

Deno.test('il caso segnalato: "100.6" diventa 101, non 100,60 - quanto si vede sul pulsante e quanto si paga combaciano', () => {
  assertEquals(arrotondaValore('100.6'), 101);
});

Deno.test('campo vuoto o non numerico arrotonda a zero, come fa il server', () => {
  for (const importo of ['', 'abc', null, undefined]) {
    assertEquals(arrotondaValore(importo), 0, `importo: ${JSON.stringify(importo)}`);
  }
});
