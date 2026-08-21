/* ============================================================
   piani.test.ts — che cosa comprende un piano tariffario.

   LA DOMANDA CHE HA FATTO NASCERE QUESTO FILE, posta dalla proprietà
   guardando la pagina vera: sulla Matrimoniale Queen uscivano Miglior
   Prezzo 190, Soggiorno breve 260, Soggiorno Smart 384. Le prime due
   adesso si spiegano da sole, perché la riga scrive il trattamento per
   esteso. La terza no: stesso trattamento della seconda, quasi il doppio
   del prezzo, e niente che dicesse perché.

   Perché «Soggiorno Smart» non è un prezzo, è un pacchetto: comprende un
   massaggio di 55 minuti. Lo dicono due fonti di casa che concordano — la
   pagina dell'offerta e la Knowledge Base.

   IL DIFETTO CHE LA CURA POTREBBE INTRODURRE, ed è peggio di quello che
   cura: descrivere un pacchetto che non comprende quella cosa. Il
   riconoscimento va per NOME, perché la risposta del motore non porta
   altro di stabile; quindi va tenuto stretto, e quello che non si
   riconosce deve restare muto.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';
import { massaggioDelPiano, PIANI } from './piani.js';

Deno.test('lo Smart comprende un massaggio di 55 minuti', () => {
  assertEquals(massaggioDelPiano('Soggiorno Smart'), 55);
  assertEquals(massaggioDelPiano('soggiorno smart'), 55);
});

Deno.test('e il Thermal Escape uno di 25', () => {
  assertEquals(massaggioDelPiano('Thermal Escape'), 25);
});

Deno.test('i piani che sono solo un prezzo restano muti', () => {
  /* «Soggiorno breve» e «Miglior Prezzo» si distinguono per il
     trattamento, che la riga scrive gia': una riga in piu' sarebbe rumore */
  for (const t of ['Soggiorno breve', 'Miglior Prezzo', 'Tariffa Base', 'Metaforum']) {
    assertEquals(massaggioDelPiano(t), 0, `«${t}» si e preso una descrizione che non ha`);
  }
});

Deno.test('e il Deluxe resta fuori apposta, finche non si sa', () => {
  /* il titolo della sua pagina dice «massaggi» al plurale, l'elenco dentro
     dice «1 massaggio da 25 minuti». Finche' non si sa quale delle due e'
     giusta non si scrive niente: una riga assente lascia la tariffa come
     stava, una riga sbagliata su una pagina che vende no. */
  assertEquals(massaggioDelPiano('Soggiorno Deluxe'), 0);
  assertEquals(massaggioDelPiano('Deluxe'), 0);
  assertEquals(massaggioDelPiano('7 Giorni di Golf'), 0);
});

Deno.test('un nome assente o guasto non fa esplodere la scheda', () => {
  for (const t of ['', null, undefined, 42, {}]) {
    assertEquals(massaggioDelPiano(t as string), 0, `«${t}»`);
  }
});

Deno.test('ogni piano dichiara minuti veri, non zero', () => {
  /* un piano con 0 minuti non si vedrebbe mai, e chi legge l elenco
     crederebbe che sia coperto */
  assert(PIANI.length > 0, 'nessun piano: la prova non guarda niente');
  for (const p of PIANI) {
    assert(
      Number.isInteger(p.minuti) && p.minuti > 0,
      `il piano «${p.chiave}» dichiara ${p.minuti} minuti`,
    );
  }
});

Deno.test('la pagina lo scrive davvero sotto il trattamento', () => {
  const pagina = Deno.readTextFileSync(new URL('index.html', import.meta.url));
  /* la CONDIZIONE, col dollaro-graffa davanti: la sola chiamata compare
     due volte nella riga — qui e dentro il testo — quindi cercarla e
     basta resta verde anche spegnendo la condizione. E' successo. */
  assert(
    pagina.includes('${massaggioDelPiano(v.tariffa)'),
    'la riga non dice piu che cosa comprende il pacchetto: lo Smart torna a costare ' +
      'quasi il doppio senza una ragione visibile',
  );
  assert(
    pagina.includes('t.pianoMassaggio(massaggioDelPiano(v.tariffa))'),
    'il testo non prende piu i minuti dal piano: potrebbero divergere',
  );
});
