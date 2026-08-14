import { assertEquals } from 'jsr:@std/assert';
import { CANCELLAZIONE, condizioni } from './condizioni.ts';

/* La divergenza fra italiano e le altre lingue e' VOLUTA e confermata dalla
   proprieta' il 14 agosto 2026: ogni lingua tiene il testo che la reception
   manda gia' oggi. Questo test esiste perche' nessuno la "aggiusti" domani
   scambiandola per una svista. */
Deno.test('l italiano dice due giorni, le altre lingue sette', () => {
  assertEquals(CANCELLAZIONE.it.join(' ').includes('due giorni'), true);
  assertEquals(CANCELLAZIONE.de.join(' ').includes('7 Tage'), true);
  assertEquals(CANCELLAZIONE.en.join(' ').includes('7 days'), true);
  assertEquals(CANCELLAZIONE.fr.join(' ').includes('7 jours'), true);
});

Deno.test('la scala del 70 per cento sta solo nelle tre lingue estere', () => {
  assertEquals(CANCELLAZIONE.it.join(' ').includes('70'), false);
  for (const l of ['de', 'en', 'fr']) {
    assertEquals(CANCELLAZIONE[l].join(' ').includes('70'), true, `lingua ${l}`);
  }
});

Deno.test('tutte le lingue chiedono la disdetta per iscritto', () => {
  for (const l of ['it', 'de', 'en', 'fr']) {
    assertEquals(CANCELLAZIONE[l].join(' ').includes('info@termeleonardo.com'), true, l);
  }
});

Deno.test('una lingua sconosciuta ricade sull italiano', () => {
  assertEquals(condizioni('zz').righe, CANCELLAZIONE.it);
});

Deno.test('ogni lingua dichiara che non c e diritto di recesso', () => {
  for (const l of ['it', 'de', 'en', 'fr']) {
    assertEquals(condizioni(l).recesso.length > 0, true, l);
  }
});
