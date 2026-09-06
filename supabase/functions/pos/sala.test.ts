/* ============================================================
   sala.test.ts — zone e tavoli importati dalla piantina di Fidra.

   Fidra chiama «categories» le zone del POS (Interno, Hall, Esterno,
   Terrazza) e mette i tavoli sopra un disegno, ognuno col suo posto. Da
   noi arrivano nome, posti e la posizione in percentuale. I nomi di Fidra
   sono misti — «Tavolo 9» dentro, «Table 21» fuori — e qui diventano uno
   solo, se no la sala del palmare parla due lingue.
   ============================================================ */
import { assertEquals } from 'jsr:@std/assert';
import { chiaveNome, leggiSala, nomeTavolo, numeroTavolo } from './sala.ts';

Deno.test('«Table 21» diventa «Tavolo 21»; gli spazi doppi spariscono; un nome suo resta suo', () => {
  assertEquals(nomeTavolo('Table 21'), 'Tavolo 21');
  assertEquals(nomeTavolo('table  7'), 'Tavolo 7');
  assertEquals(nomeTavolo('  Tavolo   9  '), 'Tavolo 9');
  assertEquals(nomeTavolo('Divano bar'), 'Divano bar');
  assertEquals(nomeTavolo('Tisch 3'), 'Tavolo 3');
});

Deno.test('il numero serve a metterli in fila; chi non ce l ha va in fondo', () => {
  assertEquals(numeroTavolo('Tavolo 21'), 21);
  assertEquals(numeroTavolo('Divano bar'), 9999);
});

Deno.test('la chiave del confronto ignora maiuscole, spazi e la lingua del nome', () => {
  assertEquals(chiaveNome('Table 21'), chiaveNome('tavolo  21'));
  assertEquals(chiaveNome('Divano Bar'), 'divanobar');
});

Deno.test('leggiSala: locale e zona obbligatori, coordinate tenute dentro 0-100, posti sensati', () => {
  const r = leggiSala({
    locale: 'bistrot', zona: ' Interno ', zona_fidra: '16',
    tavoli: [
      { nome: 'Table 21', posti: 4, x: 12.345, y: 80.9 },
      { nome: 'Tavolo 9', posti: 0, x: -5, y: 140 },
      { nome: '', posti: 4, x: 1, y: 1 },
    ],
  });
  if (!r.ok) throw new Error(r.errore);
  assertEquals(r.valore.zona, 'Interno');
  assertEquals(r.valore.zona_fidra, '16');
  assertEquals(r.valore.tavoli, [
    { nome: 'Tavolo 9', posti: 4, x: 0, y: 100 },
    /* interi: la colonna e' integer e «73.1» la faceva rifiutare (6 set 2026) */
    { nome: 'Tavolo 21', posti: 4, x: 12, y: 81 },
  ]);
  const r2 = leggiSala({ locale: 'bistrot', zona: 'Esterno', tavoli: [{ nome: 'Tavolo 22', posti: 4, x: 73.1, y: 21.5 }] });
  if (!r2.ok) throw new Error(r2.errore);
  assertEquals([r2.valore.tavoli[0].x, r2.valore.tavoli[0].y], [73, 22]);
  assertEquals(leggiSala({ zona: 'Interno', tavoli: [] }).ok, false);
  assertEquals(leggiSala({ locale: 'bistrot', tavoli: [{ nome: 'Tavolo 1', x: 1, y: 1 }] }).ok, false);
  assertEquals(leggiSala({ locale: 'bistrot', zona: 'Interno', tavoli: [] }).ok, false);
});
