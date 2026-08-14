import { assertEquals } from 'jsr:@std/assert';
import {
  azzeraLimiteAcquista, azzeraLimiteQr, azzeraLimiteStampa,
  entroIlLimiteAcquista, entroIlLimiteQr, entroIlLimiteStampa,
  troppiDalSito,
} from './limite.ts';

const ORA = 1_770_000_000_000;   // istante fisso: i test non dipendono dall'orologio

/* ---------- freno dell'acquisto ---------- */

Deno.test('acquisto: i primi passano, poi si chiude', () => {
  azzeraLimiteAcquista();
  for (let i = 0; i < 8; i++) assertEquals(entroIlLimiteAcquista('1.2.3.4', ORA), true, 'tentativo ' + i);
  assertEquals(entroIlLimiteAcquista('1.2.3.4', ORA), false);
});

Deno.test('acquisto: un altro indirizzo non paga per il primo', () => {
  azzeraLimiteAcquista();
  for (let i = 0; i < 8; i++) entroIlLimiteAcquista('1.2.3.4', ORA);
  assertEquals(entroIlLimiteAcquista('5.6.7.8', ORA), true);
});

Deno.test('acquisto: passata la finestra si ricomincia', () => {
  azzeraLimiteAcquista();
  for (let i = 0; i < 8; i++) entroIlLimiteAcquista('1.2.3.4', ORA);
  assertEquals(entroIlLimiteAcquista('1.2.3.4', ORA + 9 * 60 * 1000), false, 'dentro la finestra');
  assertEquals(entroIlLimiteAcquista('1.2.3.4', ORA + 11 * 60 * 1000), true, 'fuori dalla finestra');
});

Deno.test('acquisto: senza indirizzo non si blocca nessuno', () => {
  azzeraLimiteAcquista();
  for (let i = 0; i < 20; i++) assertEquals(entroIlLimiteAcquista('', ORA), true);
});

/* ---------- freno della stampa ---------- */

Deno.test('stampa: i primi passano, poi si chiude', () => {
  azzeraLimiteStampa();
  for (let i = 0; i < 30; i++) assertEquals(entroIlLimiteStampa('1.2.3.4', ORA), true, 'tentativo ' + i);
  assertEquals(entroIlLimiteStampa('1.2.3.4', ORA), false);
});

Deno.test('stampa: un altro indirizzo non paga per il primo', () => {
  azzeraLimiteStampa();
  for (let i = 0; i < 30; i++) entroIlLimiteStampa('1.2.3.4', ORA);
  assertEquals(entroIlLimiteStampa('5.6.7.8', ORA), true);
});

Deno.test('stampa: passata la finestra si ricomincia', () => {
  azzeraLimiteStampa();
  for (let i = 0; i < 30; i++) entroIlLimiteStampa('1.2.3.4', ORA);
  assertEquals(entroIlLimiteStampa('1.2.3.4', ORA + 9 * 60 * 1000), false, 'dentro la finestra');
  assertEquals(entroIlLimiteStampa('1.2.3.4', ORA + 11 * 60 * 1000), true, 'fuori dalla finestra');
});

Deno.test('stampa: senza indirizzo non si blocca nessuno', () => {
  azzeraLimiteStampa();
  for (let i = 0; i < 40; i++) assertEquals(entroIlLimiteStampa('', ORA), true);
});

/* Il tetto della stampa è più largo di quello dell'acquisto: uno scenario
   plausibile — ristampare il proprio buono un po' di volte — non deve
   far scattare lo stesso freno pensato per un ciclo di acquisti. */
Deno.test('stampa: il tetto è più largo di quello dell’acquisto', () => {
  azzeraLimiteStampa();
  for (let i = 0; i < 10; i++) assertEquals(entroIlLimiteStampa('9.9.9.9', ORA + i * 1000), true,
    'dieci ristampe dello stesso buono, in dieci minuti, restano un uso plausibile');
});

/* ---------- freno del QR: complessivo, non per indirizzo ----------
   A differenza dei due freni qui sopra, entroIlLimiteQr non prende un IP:
   un solo tetto per l'intera funzione (vedi il commento in limite.ts per
   lo scenario dietro al numero). Per questo i test qui sotto chiamano
   entroIlLimiteQr(ora) senza indirizzo, e verificano che indirizzi diversi
   NON aprano contatori separati (l'opposto di quanto già provato per
   acquisto e stampa sopra: lì "un altro indirizzo non paga per il primo",
   qui invece deve pagare, perché la chiave è unica di proposito). */

/* il tetto ora è 20 000 (vedi limite.ts per il conto): un ciclo così non è
   più gratis da eseguire, ma resta nell'ordine del secondo — a ogni
   iterazione si conta solo, senza asserire messaggio per messaggio, per
   non appesantire il test con 20 000 stringhe costruite a vuoto */
const TETTO_QR = 20_000;

/* le due proprietà — "i primi passano poi si chiude" e "il tetto è
   condiviso, non per indirizzo" — sono un solo test e non due: la seconda
   è già dimostrata dalla prima, dato che entroIlLimiteQr non prende un
   indirizzo a cui appoggiarsi. Separarle raddoppierebbe un riempimento da
   20 000 chiamate (~2s) per un'asserzione che ridice la stessa cosa. */
Deno.test('qr: i primi passano, poi si chiude — un tetto UNICO condiviso da chiunque chiami, non per indirizzo', () => {
  azzeraLimiteQr();
  let tutteOk = true;
  for (let i = 0; i < TETTO_QR; i++) tutteOk = tutteOk && entroIlLimiteQr(ORA);
  assertEquals(tutteOk, true, `le prime ${TETTO_QR} chiamate devono passare tutte`);
  // la richiesta successiva, chiunque la faccia, trova il tetto già pieno:
  // non c'è un indirizzo da passare, quindi non c'è "un altro chiamante"
  // con un budget suo — a differenza di acquisto e stampa qui sopra
  assertEquals(entroIlLimiteQr(ORA), false, `la ${TETTO_QR + 1}-esima deve trovare il tetto pieno`);
});

Deno.test('qr: passata la finestra di 10 minuti si ricomincia', () => {
  azzeraLimiteQr();
  for (let i = 0; i < TETTO_QR; i++) entroIlLimiteQr(ORA);
  assertEquals(entroIlLimiteQr(ORA + 9 * 60 * 1000), false, 'dentro la finestra');
  assertEquals(entroIlLimiteQr(ORA + 11 * 60 * 1000), true, 'fuori dalla finestra');
});

/* lo scenario di traffico legittimo più affollato che il commento in
   limite.ts immagina (campagna promozionale riuscita: 25 buoni concentrati
   in 10 minuti, fino a due email ciascuno, fino a due precaricamenti
   automatici più le riletture vere) resta ben sotto il tetto — è proprio
   il punto della revisione: il numero deve essere irraggiungibile da
   traffico vero, non solo "largo" */
Deno.test('qr: lo scenario di traffico legittimo più affollato immaginato (~600 richieste) resta ben sotto il tetto', () => {
  azzeraLimiteQr();
  const RICHIESTE_SCENARIO_PROMOZIONE = 25 /* buoni concentrati */ * 2 /* email */ *
    (2 /* precaricamenti automatici: Apple MPP + un filtro aziendale */ + 5 * 2 /* riletture vere */);
  assertEquals(RICHIESTE_SCENARIO_PROMOZIONE, 600);
  for (let i = 0; i < RICHIESTE_SCENARIO_PROMOZIONE; i++) {
    assertEquals(entroIlLimiteQr(ORA), true, `richiesta ${i} dello scenario, ben sotto il tetto di ${TETTO_QR}`);
  }
});

Deno.test('qr: il suo freno non condivide stato con quello di acquisto o di stampa', () => {
  azzeraLimiteQr(); azzeraLimiteAcquista(); azzeraLimiteStampa();
  for (let i = 0; i < TETTO_QR; i++) entroIlLimiteQr(ORA);
  assertEquals(entroIlLimiteQr(ORA), false, 'il tetto del QR è pieno');
  // acquisto e stampa, nello stesso istante, restano del tutto intatti
  assertEquals(entroIlLimiteAcquista('9.9.9.9', ORA), true);
  assertEquals(entroIlLimiteStampa('9.9.9.9', ORA), true);
});

/* ---------- il punto della revisione: due contatori separati ---------- */

Deno.test('stampare tante volte non intacca il budget di chi sta per comprare', () => {
  azzeraLimiteAcquista();
  azzeraLimiteStampa();
  const ip = '10.0.0.1';
  for (let i = 0; i < 30; i++) entroIlLimiteStampa(ip, ORA + i * 100);
  assertEquals(entroIlLimiteStampa(ip, ORA + 3000), false, 'la stampa per questo indirizzo è esaurita');
  // ma l'acquisto, dallo stesso indirizzo, è un contatore tutto suo
  for (let i = 0; i < 8; i++) assertEquals(entroIlLimiteAcquista(ip, ORA + i * 100), true, 'acquisto ' + i);
});

Deno.test('comprare (fino al tetto) non intacca il budget di chi vuole stampare', () => {
  azzeraLimiteAcquista();
  azzeraLimiteStampa();
  const ip = '10.0.0.2';
  for (let i = 0; i < 8; i++) entroIlLimiteAcquista(ip, ORA + i * 100);
  assertEquals(entroIlLimiteAcquista(ip, ORA + 900), false, 'l’acquisto per questo indirizzo è esaurito');
  // la stampa, dallo stesso indirizzo, non ne risente
  for (let i = 0; i < 30; i++) assertEquals(entroIlLimiteStampa(ip, ORA + i * 100), true, 'stampa ' + i);
});

/* ---------- il tetto che regge fra istanze diverse (solo acquisto) ---------- */

/* un finto client che risponde quello che vogliamo */
const dbFinto = (count: number | null, error?: { message: string }) => ({
  from: () => ({ select: () => ({ eq: () => ({ gte: () => Promise.resolve({ count, error }) }) }) })
});

Deno.test('sotto il tetto si vende', async () => {
  assertEquals(await troppiDalSito(dbFinto(0)), false);
  assertEquals(await troppiDalSito(dbFinto(29)), false);
});

Deno.test('raggiunto il tetto si chiude', async () => {
  assertEquals(await troppiDalSito(dbFinto(30)), true);
  assertEquals(await troppiDalSito(dbFinto(120)), true);
});

Deno.test('se il conteggio fallisce non si blocca la vendita', async () => {
  const zitto = console.error; console.error = () => {};
  try { assertEquals(await troppiDalSito(dbFinto(null, { message: 'giù' })), false); }
  finally { console.error = zitto; }
});
