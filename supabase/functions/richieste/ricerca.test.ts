/* ============================================================
   ricerca.test.ts — trovare una richiesta fra tutte.

   IL DIFETTO CHE PRESIDIA. L'elenco del back office aveva un filtro per
   stato e basta, e il server ne restituisce al massimo 200
   (`.limit(200)`). Finche' le richieste sono sei si scorre a occhio; alla
   duecentunesima, quella del signore di tre settimane fa NON SI TROVA PIU',
   e sembra che non esista. E' il caso vero: il tassista sposta la partenza
   dopo che l'ospite ha gia' avuto la conferma, e la reception deve
   ritrovare quella richiesta per correggerla.

   Per questo la ricerca sta SUL SERVER e non nella pagina: filtrare le 200
   gia' caricate darebbe una risposta che sembra completa e non lo e' — il
   modo peggiore di sbagliare.

   La lista dei buoni una ricerca ce l'aveva gia' (filtroRicercaBuoni). Qui
   si fa la stessa cosa per le richieste, con la stessa protezione.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';
import { filtroRicercaRichieste, interpretaData, sfuggiValoreRicerca } from './ricerca.ts';
import { sfuggiValoreRicerca as sfuggiBuoni } from '../buoni/ricerca.ts';

/* ---------- le due copie non devono divergere ----------
   Il copione di pubblicazione manda solo i file della cartella della
   funzione: `richieste/` non PUO' importare da `buoni/`, e la protezione
   e' per forza ricopiata. Il deploy non puo' tenerle insieme; questa
   prova si'. */
Deno.test('la protezione e identica a quella dei buoni, carattere per carattere', () => {
  for (
    const cattivo of [
      `D'Amico`, 'a,b', 'a)b(c', 'a"b', '100%', 'nome_cognome', 'a*b',
      'c:\\temp\\x', 'tutto insieme: %_*",()\\',
    ]
  ) {
    assertEquals(sfuggiValoreRicerca(cattivo), sfuggiBuoni(cattivo), `su: ${cattivo}`);
  }
});

/* ---------- dove cerca ---------- */

Deno.test('cerca nel numero, nel nome, nell email e nel telefono', () => {
  const f = filtroRicercaRichieste('Renga', 2026);
  for (const colonna of ['numero', 'nome', 'email', 'telefono']) {
    assert(f.includes(`${colonna}.ilike.`), `manca la colonna ${colonna}`);
  }
});

Deno.test('il testo cercato compare fra i jolly, sfuggito', () => {
  assert(filtroRicercaRichieste('Renga', 2026).includes('%Renga%'));
});

/* Il campo lo riempie una persona che digita nomi con l'apostrofo e incolla
   email: virgola e parentesi sono la grammatica di or() in PostgREST, e
   senza schermo verrebbero LETTE come sintassi invece che cercate. */
Deno.test('un nome con l apostrofo e le virgole resta testo, non sintassi', () => {
  const f = filtroRicercaRichieste(`D'Amico, (Anna)`, 2026);
  assert(f.includes('nome.ilike.'), 'il filtro si e rotto');
  assert(!/,\s*\(/.test(f.replace(/"[^"]*"/g, '""')), 'sintassi fuori dagli apici');
});

Deno.test('una ricerca vuota non produce filtro', () => {
  assertEquals(filtroRicercaRichieste('', 2026), '');
  assertEquals(filtroRicercaRichieste('   ', 2026), '');
});

/* ---------- il giorno del servizio ----------
   IL DIFETTO: la reception digita «20/08/2026» perche' e' cosi' che si
   scrive una data, ma dentro `dati` il giorno e' ISO. Senza traduzione la
   ricerca per giorno non trova mai niente, e nessuno capisce perche'. */

Deno.test('una data scritta come si scrive diventa ISO', () => {
  assertEquals(interpretaData('20/08/2026', 2026), '2026-08-20');
  assertEquals(interpretaData('20-08-2026', 2026), '2026-08-20');
  assertEquals(interpretaData('20.8.2026', 2026), '2026-08-20');
  assertEquals(interpretaData('2026-08-20', 2026), '2026-08-20');
});

Deno.test('senza anno si assume quello corrente', () => {
  assertEquals(interpretaData('20/08', 2026), '2026-08-20');
});

/* In reception si dice «il venti agosto», non «il venti zero otto». */
Deno.test('il mese scritto a parole si riconosce', () => {
  assertEquals(interpretaData('20 agosto 2026', 2026), '2026-08-20');
  assertEquals(interpretaData('20 agosto', 2026), '2026-08-20');
  assertEquals(interpretaData('3 gennaio 2027', 2026), '2027-01-03');
});

Deno.test('quello che non e una data non diventa una data', () => {
  for (const t of ['Renga', 'raffael@x.it', '', '99/99/2026', '32 agosto', 'RS-2026-0003']) {
    assertEquals(interpretaData(t, 2026), null, `non doveva essere una data: ${t}`);
  }
});

/* I tre nomi che il giorno del servizio ha nei vari tipi di richiesta —
   gli stessi che differenze.ts tratta come CAMPI_DATA. */
Deno.test('cercando una data si guarda dentro i dati, in tutti e tre i campi', () => {
  const f = filtroRicercaRichieste('20/08/2026', 2026);
  for (const campo of ['quando', 'data', 'giorno']) {
    assert(f.includes(`dati->>${campo}`), `manca dati->>${campo}`);
  }
  assert(f.includes('2026-08-20'), 'la data ISO non c e');
});

/* Una data si cerca ANCHE come testo: «RS-2026-0003» non e' una data, ma
   «2026-08-20» potrebbe essere scritto in una nota. E soprattutto un nome
   deve continuare a funzionare come prima. */
Deno.test('cercando un nome non si aggiungono filtri sulle date', () => {
  const f = filtroRicercaRichieste('Renga', 2026);
  assert(!f.includes('dati->>'), 'un nome non deve frugare nelle date');
});
