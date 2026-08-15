/* Test di sistema(): che il prompt DAVVERO spedito al modello contenga la
   riga di chiusura stagionale quando le stagioni ci sono. La costruzione
   di quella riga è già provata da sola in chiusura.test.ts; qui si prova
   solo che sistema() la usi e la infili nel prompt finale, invece di
   calcolarla e buttarla via. */
import { assert, assertStringIncludes } from 'jsr:@std/assert';
import { sistema } from './sistema.ts';
import { type Stagione } from './chiusura.ts';

const oggi = (s: string) => new Date(s + 'T12:00:00Z');
const STAGIONE_VERA: Stagione[] = [{ chiusura: '2026-11-29', riapertura: '2027-02-13' }];

Deno.test('con le stagioni presenti, il prompt di sistema contiene la riga di chiusura', () => {
  const prompt = sistema('it', STAGIONE_VERA, oggi('2026-08-15'));
  assertStringIncludes(prompt, '29 novembre 2026');
  assertStringIncludes(prompt, '13 febbraio 2027');
});

Deno.test('senza stagioni (tabella vuota o lettura fallita), il prompt resta quello di sempre: nessuna riga di chiusura', () => {
  /* questo e' il caso "meglio niente che una chiusura inventata": chi
     chiama sistema() con un array vuoto (leggiStagioni() fallita in
     index.ts torna []) non deve trovare nel prompt nessuna menzione di
     date di chiusura */
  const prompt = sistema('it', [], oggi('2026-08-15'));
  assert(!prompt.includes('CHIUSURA STAGIONALE'), 'senza dati non deve comparire la sezione di chiusura');
});

Deno.test('il prompt continua a contenere le regole di canale e la Knowledge Base, come prima', () => {
  /* fallisce se qualcuno, spostando sistema() in questo modulo, perde per
     strada uno dei due pezzi originali (REGOLE_CANALE o KNOWLEDGE_BASE) */
  const prompt = sistema('it', [], oggi('2026-08-15'));
  assertStringIncludes(prompt, 'PROMPT DI SISTEMA — Assistente Chat del sito');
  assertStringIncludes(prompt, 'KNOWLEDGE BASE');
  assertStringIncludes(prompt, 'Oggi è sabato 15 agosto 2026');
});

Deno.test('la dichiarazione che verifica_dayspa non esiste in questo canale resta, con precedenza sul resto', () => {
  /* questa riga (in fondo al prompt) e' l'ultima parola sul fatto che lo
     strumento non esiste: deve sopravvivere allo spostamento di sistema()
     in questo modulo tale e quale */
  const prompt = sistema('it', [], oggi('2026-08-15'));
  assertStringIncludes(prompt, 'NON esiste in questo canale');
});
