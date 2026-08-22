/* ============================================================
   pulsanti-pila.test.ts — i pulsanti flottanti non si sovrappongono.

   IL DIFETTO, visto dalla reception il 22 agosto 2026: sotto «Prepara
   transfer ATAM» e sotto «Rispondi: Info Day Spa» spuntava il bordo di
   un altro pulsante. Le posizioni erano scritte a mano:

     Buoni regalo    bottom: 174px
     Day Spa         bottom: 122px   ← quattro pixel di distanza
     transfer ATAM   bottom: 118px   ←
     bozza in Fidra  bottom:  70px

   E NON POTEVA FUNZIONARE. I pulsanti stanno in DUE file diversi
   (outlook-inject.js e outlook-transfer.js), compaiono in combinazioni
   che dipendono dall'email aperta, e chi ne aggiunge uno non ha modo di
   sapere quali altri saranno lì in quel momento. Un numero scritto a
   mano regge finché non ne arriva un altro — e infatti ne è arrivato un
   altro.

   Adesso si impilano da soli. Questa prova esiste perché il prossimo
   pulsante non ricada nella stessa trappola: se qualcuno ne aggiunge uno
   con una posizione a mano, o si dimentica di marcarlo, diventa rossa.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';

const FILE = ['outlook-inject.js', 'outlook-transfer.js'] as const;
const testo = (f: string) => Deno.readTextFileSync(new URL(f, import.meta.url));

/* la firma di un pulsante flottante: quella misura di padding la usano
   tutti e quattro e nessun altro elemento */
const FIRMA = 'padding:12px 20px;border:0;border-radius:8px;cursor:pointer;';

function pulsanti(src: string): string[] {
  return src.split(FIRMA).slice(0, -1).map((p) => p.slice(-260));
}

Deno.test('nessun pulsante flottante si scrive la posizione a mano', () => {
  /* e il difetto di partenza: quattro numeri decisi in due file diversi,
     e due che finiscono a quattro pixel di distanza */
  const colpevoli: string[] = [];
  for (const f of FILE) {
    for (const p of pulsanti(testo(f))) {
      const m = p.match(/bottom:\s*\d+px/);
      if (m) colpevoli.push(`${f}: ${m[0]}`);
    }
  }
  assertEquals(
    colpevoli,
    [],
    'pulsanti con la posizione scritta a mano: prima o poi due finiranno nello stesso punto',
  );
});

Deno.test('e ogni pulsante flottante si marca, o la pila non lo vede', () => {
  let quanti = 0;
  let marcati = 0;
  for (const f of FILE) {
    const src = testo(f);
    quanti += pulsanti(src).length;
    marcati += src.split('.dataset.leoPulsante').length - 1;
  }
  assert(quanti >= 4, `trovati solo ${quanti} pulsanti: la prova non guarda niente`);
  assertEquals(
    marcati,
    quanti,
    `${quanti} pulsanti ma ${marcati} marcati: quello non marcato resta dove capita`,
  );
});

Deno.test('e la pila e definita in tutti e due i file, con lo stesso passo', () => {
  /* la funzione e ripetuta apposta: lavora sul DOM e non tiene stato,
     quindi due copie fanno lo stesso lavoro e l ultima che gira sistema
     anche i pulsanti dell altra. Ma il PASSO deve essere lo stesso, o i
     due file si contendono le posizioni. */
  const passi = new Set<string>();
  const basi = new Set<string>();
  for (const f of FILE) {
    const src = testo(f);
    assert(
      src.includes('function impilaPulsanti()'),
      `${f} non sa impilare: i suoi pulsanti resterebbero dove capita`,
    );
    const passo = src.match(/const PULSANTE_PASSO = (\d+);/);
    const base = src.match(/const PULSANTE_BASSO = (\d+);/);
    assert(passo && base, `${f}: passo o base non dichiarati`);
    passi.add(passo![1]);
    basi.add(base![1]);
  }
  assertEquals([...passi].length, 1, `i due file usano passi diversi: ${[...passi].join(', ')}`);
  assertEquals([...basi].length, 1, `i due file partono da altezze diverse: ${[...basi].join(', ')}`);
});

Deno.test('e chi aggiunge un pulsante rimette tutti in fila', () => {
  /* marcarlo non basta: se nessuno chiama la pila dopo averlo messo nella
     pagina, quello nuovo resta senza posizione e finisce in fondo a destra */
  for (const f of FILE) {
    const src = testo(f);
    const aggiunte = src.split('document.body.appendChild(b').length - 1;
    const chiamate = src.split('impilaPulsanti();').length - 1;
    assert(
      chiamate >= 1,
      `${f}: nessuno rimette i pulsanti in fila dopo averli aggiunti`,
    );
    assert(aggiunte >= chiamate, `${f}: piu chiamate che aggiunte, qualcosa non torna`);
  }
});
