/* ============================================================
   server.test.ts — quale server, e la coda quando nessuno risponde.

   Il palmare prova prima il PC del Bistrot; se non risponde entro un
   secondo usa il cloud; riprova il PC ogni 30 secondi e torna su di lui
   appena risponde («e se non c e connessione al PC usa il cloud», la
   proprieta', 4 settembre 2026). Puro: ping e orologio sono iniettati.
   ============================================================ */
import { assertEquals } from 'jsr:@std/assert';
import { creaCoda, creaServer } from './server.js';

Deno.test('prima il locale; se non risponde entro il timeout, il cloud; dopo 30 s si riprova il locale', async () => {
  let localeVivo = false; let t = 0;
  const s = creaServer({ locale: 'https://192.168.0.50:8443', cloud: 'https://cloud', ping: (u: string) => Promise.resolve(u.includes('192.168') && localeVivo), timeoutMs: 1000, ogniMs: 30000, adesso: () => t });
  assertEquals(await s.base(), 'https://cloud'); assertEquals(s.stato(), 'cloud');
  localeVivo = true; t = 10000;
  assertEquals(await s.base(), 'https://cloud', 'non riprova prima dei 30 s');
  t = 31000;
  assertEquals(await s.base(), 'https://192.168.0.50:8443'); assertEquals(s.stato(), 'locale');
});

Deno.test('un ping che non torna mai conta come fallito, entro il timeout', async () => {
  let t = 0;
  const s = creaServer({ locale: 'https://pc', cloud: 'https://cloud', ping: () => new Promise(() => {}), timeoutMs: 20, ogniMs: 30000, adesso: () => t });
  assertEquals(await s.base(), 'https://cloud');
});

Deno.test('senza indirizzo del locale si va sempre sul cloud', async () => {
  const s = creaServer({ locale: '', cloud: 'https://cloud', ping: () => Promise.resolve(true), timeoutMs: 1000, ogniMs: 30000, adesso: () => 0 });
  assertEquals(await s.base(), 'https://cloud');
});

Deno.test('la coda offline conserva le richieste e le manda in ordine; si ferma al primo errore di rete', async () => {
  let dep: unknown[] = [];
  const coda = creaCoda({ salva: (r: unknown[]) => { dep = r; }, leggi: () => dep });
  coda.metti({ azione: 'righe', corpo: { n: 1 } }); coda.metti({ azione: 'invia', corpo: { n: 2 } }); coda.metti({ azione: 'vai', corpo: { n: 3 } });
  assertEquals(dep.length, 3);
  const mandate: number[] = [];
  const esito = await coda.svuota(async (r: { corpo: { n: number } }) => { if (r.corpo.n === 2) throw new TypeError('Failed to fetch'); mandate.push(r.corpo.n); });
  assertEquals(mandate, [1]); assertEquals(esito.rimaste, 2); assertEquals(dep.length, 2);
});

Deno.test('un errore che non e di rete (il server ha risposto) butta via la richiesta e va avanti', async () => {
  let dep: unknown[] = [];
  const coda = creaCoda({ salva: (r: unknown[]) => { dep = r; }, leggi: () => dep });
  coda.metti({ azione: 'righe', corpo: { n: 1 } }); coda.metti({ azione: 'invia', corpo: { n: 2 } });
  const esito = await coda.svuota(async (r: { corpo: { n: number } }) => { if (r.corpo.n === 1) throw new Error('conto non aperto'); });
  assertEquals(esito.rimaste, 0);
});
