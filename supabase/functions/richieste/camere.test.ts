import { assertEquals } from 'jsr:@std/assert';
import { CAMERE, descrizioneCamera } from './camere.ts';

/* Il difetto che questo modulo esiste per evitare: l'abbinamento per
   sottostringa dei modelli della reception non ha una voce per "singola
   senza balcone", ricade su "singola" e le promette un balcone che il nome
   stesso della camera nega. */
Deno.test('la singola senza balcone non promette un balcone', () => {
  for (const l of ['it', 'de', 'en', 'fr']) {
    const d = descrizioneCamera(2, l);
    assertEquals(/balcon|Balkon/i.test(d), false, `lingua ${l}: "${d}"`);
  }
});

Deno.test('una camera senza descrizione confermata resta senza descrizione', () => {
  assertEquals(descrizioneCamera(12, 'it'), '');
});

Deno.test('un identificativo sconosciuto non fa saltare niente', () => {
  assertEquals(descrizioneCamera(999, 'it'), '');
  assertEquals(CAMERE[999], undefined);
});

/* Il catalogo deve coprire tutte le categorie che l'API restituisce: se
   domani ne compare una nuova e nessuno la aggiunge qui, la pagina la
   mostrerebbe senza nome. */
Deno.test('il catalogo copre le undici categorie dell API', () => {
  const id = Object.keys(CAMERE).map(Number).sort((a, b) => a - b);
  assertEquals(id, [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  for (const i of id) assertEquals(CAMERE[i].nome.length > 0, true, `camera ${i} senza nome`);
});

/* Guardia per quando la direzione confermera' gli abbinamenti: una
   descrizione che esiste in una lingua sola farebbe comparire l'italiano a
   un ospite tedesco. Il conteggio delle camere descritte e' asserito, cosi'
   il test non diventa vacuo quando sono tutte vuote. */
Deno.test('una descrizione o e in tutte e quattro le lingue o non c e', () => {
  let descritte = 0;
  for (const [id, c] of Object.entries(CAMERE)) {
    const presenti = ['it', 'de', 'en', 'fr'].filter(
      (l) => typeof c.descrizione[l] === 'string' && c.descrizione[l].length > 0);
    if (!presenti.length) continue;
    descritte++;
    assertEquals(presenti.length, 4, `camera ${id}: descritta in ${presenti.join(',')}`);
  }
  /* oggi nessuna e' confermata: quando la direzione ne conferma una, questo
     numero va alzato di pari passo, ed e' il promemoria che il test esiste */
  assertEquals(descritte, 0);
});
