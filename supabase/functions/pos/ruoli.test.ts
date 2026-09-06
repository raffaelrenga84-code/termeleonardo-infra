/* ============================================================
   ruoli.test.ts — chi entra nel POS dal back office.

   «Si può creare un account bistrot@termeleonardo.com» (la proprieta', 6
   settembre 2026): un accesso per il PC del Bistrot che tocca prezzi e
   prodotti senza vedere buoni, richieste, Day Spa, incassi e PIN. Il
   cancello sta nel server: la pagina nasconde le schede, ma e' questa
   tabella che rifiuta.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';
import { puoDalBackOffice, ruoloDi, tabelleNascoste } from './ruoli.ts';

Deno.test('i quattro indirizzi hanno il loro ruolo, gli altri no', () => {
  assertEquals(ruoloDi('reception@termeleonardo.com'), 'reception');
  assertEquals(ruoloDi('spa@termeleonardo.com'), 'spa');
  assertEquals(ruoloDi('amministrazione@termeleonardo.com'), 'amministrazione');
  assertEquals(ruoloDi(' Bistrot@TermeLeonardo.com '), 'bistrot');
  assertEquals(ruoloDi('bistro@termeleonardo.com'), 'bistrot', 'senza la t, come l utente creato in Supabase');
  assertEquals(ruoloDi('bistrot@termeleonardo.com.evil.net'), null);
  assertEquals(ruoloDi('cucina@termeleonardo.com'), null, 'un indirizzo dell hotel non previsto non ha ruolo');
});

Deno.test('reception e amministrazione fanno tutto dal back office, la spa niente', () => {
  const tutte = ['allinea-giu', 'menu-salva', 'tavoli-salva', 'personale-salva', 'addebiti', 'addebito-segna', 'giornata', 'fasce-salva', 'tavoli-qr', 'ospite-ordini', 'ospite-rimborsa', 'ospite-annulla-addebito', 'ospite-ristampa', 'ospite-nota'];
  for (const a of tutte) {
    assert(puoDalBackOffice('reception', a), 'reception ' + a);
    assert(puoDalBackOffice('amministrazione', a), 'amministrazione ' + a);
    assertEquals(puoDalBackOffice('spa', a), false, 'spa ' + a);
    assertEquals(puoDalBackOffice(null, a), false, 'senza ruolo ' + a);
  }
});

Deno.test('il bistrot tocca menu, tavoli, fasce e ordini dal QR; non personale, incassi, addebiti e rimborsi', () => {
  for (const a of ['allinea-giu', 'menu-salva', 'tavoli-salva', 'fasce-salva', 'tavoli-qr', 'ospite-ordini', 'ospite-ristampa', 'ospite-nota', 'postazioni-salva']) {
    assert(puoDalBackOffice('bistrot', a), 'bistrot ' + a);
  }
  for (const a of ['personale-salva', 'addebiti', 'addebito-segna', 'giornata', 'ospite-rimborsa', 'ospite-annulla-addebito', 'sconosciuta']) {
    assertEquals(puoDalBackOffice('bistrot', a), false, 'bistrot ' + a);
  }
});

Deno.test('al bistrot non scendono camerieri e palmari; agli altri scende tutto', () => {
  assertEquals(tabelleNascoste('bistrot'), ['pos_cameriere', 'pos_dispositivo']);
  assertEquals(tabelleNascoste('reception'), []);
  assertEquals(tabelleNascoste('amministrazione'), []);
  assertEquals(tabelleNascoste(null), []);
});
