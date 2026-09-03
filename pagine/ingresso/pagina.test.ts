/* ============================================================
   pagina.test.ts — la pagina dello sportello del Day Spa, letta dal
   sorgente (il DOM in Deno non c'e').

   «Magari conviene fare una pagina dedicata per l'ingresso?» (la
   proprieta', 3 settembre 2026). Si': una pagina sola, per il tablet allo
   sportello, con tre cose e basta — il lettore (a tastiera o fotocamera),
   l'esito grande, gli arrivi del giorno. Stesso accesso del back office,
   stesse azioni del server (?a=oggi, ?a=presenti): niente regole nuove.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';

const P = Deno.readTextFileSync(new URL('./index.html', import.meta.url));
const modulo = () => (P.match(/<script type="module">([\s\S]*?)<\/script>/) ?? ['', ''])[1];

Deno.test('e riservata: noindex, accesso con l utente dell hotel, manifest per installarla come app', () => {
  assert(/<meta name="robots" content="noindex, nofollow"/.test(P));
  assert(/createClient\(/.test(modulo()) && /signInWithPassword\(/.test(modulo()) && /getSession\(/.test(modulo()),
    'l accesso e quello del back office: utente e password dell hotel, sessione che resta');
  assert(/<link rel="manifest" href="\/ingresso\/manifest\.webmanifest"/.test(P));
  const m = JSON.parse(Deno.readTextFileSync(new URL('./manifest.webmanifest', import.meta.url))) as Record<string, unknown>;
  assertEquals(m.display, 'standalone');
  assertEquals(m.start_url, '/ingresso/');
});

Deno.test('parla solo con la funzione dayspa: oggi e presenti, con il token', () => {
  const m = modulo();
  assert(/functions\/v1\/dayspa/.test(m));
  assert(/a=oggi&giorno=/.test(m) && /a=presenti/.test(m));
  assert(/authorization: 'Bearer ' \+ TOKEN/.test(m), 'ogni chiamata porta il token della sessione');
  assert(!/a=rimborsa|a=disponibilita|a=elenco/.test(m), 'allo sportello non si rimborsa e non si caricano posti');
});

Deno.test('il lettore: campo col fuoco e Invio, fotocamera con BarcodeDetector o jsQR, schermo acceso', () => {
  const m = modulo();
  assert(P.includes('id="codice"') && /\$\('codice'\)\.focus\(\)/.test(m));
  assert(/\.key (===|!==) 'Enter'/.test(m));
  assert(/getUserMedia\(/.test(m) && /BarcodeDetector/.test(m) && /\/comune\/jsqr\.js/.test(m) && /facingMode/.test(m));
  assert(/wakeLock/.test(m));
});

Deno.test('l esito e grande, verde o rosso, e l elenco del giorno permette di segnare i presenti a mano', () => {
  const m = modulo();
  /* la classe e' composta da mostra(classe, …): verde con 'ok', rosso con 'no' */
  assert(/esitoGrande \$\{classe\}/.test(m) && /mostra\('ok'/.test(m) && /mostra\('no'/.test(m));
  assert(/presenti \$\{p\.presenti\} su \$\{p\.persone\}/.test(m), 'l esito dice presenti su persone');
  assert(/non per oggi/.test(m), 'una prenotazione di un altro giorno si vede in rosso');
  assert(/data-segna=/.test(m), 'dall elenco si segnano i presenti a mano, per chi non ha il QR');
  assert(/setInterval\(/.test(m), 'l elenco si aggiorna da solo: due tablet o il PC vedono la stessa cosa');
});

Deno.test('niente da toccare per sbaglio: nessuna barra di schede, nessun link fuori, esci solo con conferma', () => {
  assert(!/class="schede"/.test(P), 'niente schede');
  assert(!/<a href="http/.test(P), 'niente link verso fuori');
  assert(/confirm\(/.test(modulo()), 'uscire chiede conferma');
});
