import { assertEquals } from 'jsr:@std/assert';
import { CAMERE, descrizioneCamera } from './camere.ts';

/* Il difetto che questo modulo esiste per evitare: l'abbinamento per
   sottostringa dei modelli della reception non ha una voce per "singola
   senza balcone", ricade su "singola" e le promette un balcone che il nome
   stesso della camera nega. */
/* Prima questa prova vietava la PAROLA «balcone». Va bene finche' la
   descrizione e' vuota; appena si scrive qualcosa diventa un ostacolo,
   perche' il modo migliore di non promettere un balcone e' dire che non
   c'e' — e anche quella frase contiene la parola. Quindi si vieta la
   PROMESSA e si pretende la smentita: e' un controllo piu' stretto di
   prima, non piu' largo. */
Deno.test('la singola senza balcone dice che il balcone non c e', () => {
  const promette = /con balcone|mit Balkon|with a balcony|avec balcon/i;
  const smentisce = /senza balcone|ohne Balkon|without a balcony|sans balcon/i;
  for (const l of ['it', 'de', 'en', 'fr']) {
    const d = descrizioneCamera(2, l);
    assertEquals(promette.test(d), false, `lingua ${l} promette un balcone: "${d}"`);
    assertEquals(smentisce.test(d), true, `lingua ${l} non dice che manca: "${d}"`);
  }
});

/* NIENTE ESPRESSIONI REGOLARI QUI, e la ragione merita di essere scritta:
   la prima stesura usava /\b(35|28|21|18)[ ]*(m2|mq)/i e restava VERDE anche
   iniettando «Circa 35 mq» nella descrizione — provato. Fra la barra
   rovesciata mangiata dalla shell e il carattere del metro quadro, la
   regex che finiva nel file non era quella che pensavo di aver scritto.
   Una prova che non fallisce quando il difetto c'e' e' peggio di nessuna
   prova, e qui il confronto si fa benissimo senza. */
const NUMERI_CONTESTATI = ['35', '28', '21', '18'];
const UNITA = ['mq', 'm2', "m²"];

/** Se questo testo dichiara una superficie con uno di quei numeri. */
function dichiaraMisura(d: string, numeri: string[]): boolean {
  for (const n of numeri) {
    for (const u of UNITA) {
      if (d.includes(n + ' ' + u) || d.includes(n + u)) return true;
    }
  }
  return false;
}

/* Questa prova teneva vuota la Junior Suite Abano finche' la proprieta'
   non confermava. Adesso e' confermata, ma la sua misura NO: l'API dice
   35 mq, i modelli della reception 28, e la Doppia 21 contro 18. Il
   rischio si e' spostato li', e la prova lo segue. */
Deno.test('le misure contestate non si stampano', () => {
  for (const l of ['it', 'de', 'en', 'fr']) {
    for (const id of [12, 5]) {
      const d = descrizioneCamera(id, l);
      assertEquals(dichiaraMisura(d, NUMERI_CONTESTATI), false,
        `camera ${id}, lingua ${l}: dichiara una misura contestata — "${d}"`);
    }
  }
});

/* E la misura che nessuno contesta invece si dice: senza questa, la prova
   sopra passerebbe anche cancellando ogni misura da ogni descrizione. */
Deno.test('la misura non contestata della Queen c e', () => {
  for (const l of ['it', 'de', 'en', 'fr']) {
    const d = descrizioneCamera(6, l);
    assertEquals(dichiaraMisura(d, ['16']), true, `lingua ${l}: "${d}"`);
  }
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
  /* Erano zero, in attesa della conferma della proprieta'. Il 20 agosto
     2026 sono arrivate tutte e undici, dal prompt dell'agente vocale, dove
     i nomi delle categorie sono gli stessi del motore di prenotazione.
     Questo numero resta un promemoria: se domani una descrizione sparisce,
     la prova lo dice invece di lasciar comparire una scheda muta. */
  assertEquals(descritte, 11);
});
