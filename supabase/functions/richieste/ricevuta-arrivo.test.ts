/* ============================================================
   ricevuta-arrivo.test.ts — l'unica email che riceve chi compila.

   PERCHE' UNA SOLA. Una compilazione fa nascere fino a tre richieste. Tre
   ricevute in fila, stesso minuto, stesso ospite, si leggono come un
   guasto. Chi ha compilato UN modulo si aspetta UNA risposta.

   E PERCHE' COI NUMERI DENTRO. Il transfer avra' un orario e un prezzo, la
   fattura sara' pronta al check-out: sono le due cose per cui l'ospite
   potrebbe doverci riscrivere, e senza un riferimento dovrebbe raccontare
   da capo chi e'.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';
import { inviaRicevutaArrivo, ricevutaArrivoHTML } from './ricevuta-arrivo.ts';

const OSPITE = { nome: 'Rossi Mario', email: 'mario@esempio.test', lingua: 'it' };

const RIGHE = [
  { numero: 'C26/19130', tipo: 'arrivo', dati: { ora_arrivo: '16:30', mezzo: 'auto', attenzioni: ['culla'] } },
  { numero: 'C26/19131', tipo: 'transfer', dati: { luogo: 'Venezia  aeroporto', quando: '2026-09-12', ora: '15:30', pax: 3, verso: 'arrivo' } },
  { numero: 'C26/19132', tipo: 'fattura', dati: { ragione: 'Bianchi S.r.l.', piva: 'IT02042330288' } },
];

Deno.test('la ricevuta nomina l ospite e tutte le richieste', () => {
  const h = ricevutaArrivoHTML(OSPITE, RIGHE);
  assert(h.includes('Rossi Mario'), 'manca il nome');
  for (const r of RIGHE) assert(h.includes(r.numero), `manca il numero ${r.numero}`);
});

Deno.test('dice quello che ha scritto, non solo che ha scritto', () => {
  const h = ricevutaArrivoHTML(OSPITE, RIGHE);
  assert(h.includes('16:30'), 'manca l ora di arrivo');
  /* Il riepilogo non si riscrive: passa da riepilogoRichiesta(), che per il
     transfer riduce a uno spazio gli spazi doppi del dato ATAM (vedi
     riepilogo.ts, unoSpazio/direzioneTransfer, e riepilogo.test.ts riga 88
     che prova esattamente questo input). Il dato salvato resta con lo
     spazio doppio: e' questa vetrina a mostrarlo pulito. */
  assert(h.includes('Venezia aeroporto'), 'manca il luogo del transfer');
});

/* La partita IVA nella ricevuta dell'ospite e' un dato suo, e vederselo
   ripetuto e' il modo in cui si accorge di un refuso prima del check-out. */
Deno.test('i dati della fattura si rileggono', () => {
  assert(ricevutaArrivoHTML(OSPITE, RIGHE).includes('IT02042330288'));
});

Deno.test('con una riga sola non parla al plurale di cose che non ci sono', () => {
  const h = ricevutaArrivoHTML(OSPITE, [RIGHE[0]]);
  assert(!h.includes('C26/19131'), 'nomina una richiesta che non e nata');
  assert(!h.includes('fattura'), 'parla di fattura a chi non l ha chiesta');
});

Deno.test('in tedesco non risponde in italiano', () => {
  const h = ricevutaArrivoHTML({ ...OSPITE, lingua: 'de' }, RIGHE);
  assert(!h.includes('Abbiamo ricevuto'), 'la ricevuta tedesca e in italiano');
});

/* Una lookup diretta TESTI[o.lingua] e' il difetto che riepilogo.ts (riga
   151 circa) documenta e schiva con uno switch: un valore ereditato da
   Object.prototype ('toString', 'constructor', 'valueOf'...) e' verita
   per il ||, quindi il ripiego non scatta mai. 'es' prova il caso innocuo
   (una lingua vera ma non supportata), 'toString' il caso pericoloso. In
   nessuno dei due casi deve uscire un errore: deve uscire l'italiano. */
Deno.test('una lingua sconosciuta o ereditata da Object.prototype ricade sull italiano, senza esplodere', () => {
  for (const lingua of ['es', 'toString', 'constructor', 'valueOf']) {
    const h = ricevutaArrivoHTML({ ...OSPITE, lingua }, RIGHE);
    assert(h.includes('Gentile Rossi Mario'), `lingua "${lingua}": non e ricaduta sull italiano`);
  }
});

/* Il nome arriva da una prenotazione, ma niente vieta che contenga un
   apostrofo o un segno di minore: la stessa cura di ogni altra email. */
Deno.test('il nome non puo iniettare markup', () => {
  const h = ricevutaArrivoHTML({ ...OSPITE, nome: '<script>x</script>' }, RIGHE);
  assert(!h.includes('<script>'), 'il nome e finito nella pagina come markup');
});

/* ---------- l'invio vero ----------
   Il brief prova solo ricevutaArrivoHTML(): inviaRicevutaArrivo() e' l'altra
   meta' dell'interfaccia che il prossimo compito consuma, e senza intercettare
   fetch non c e modo di provarla senza spedire per davvero. Stessa forma di
   ricevuta.test.ts e email-buono.test.ts: set/ripristina della chiave in
   try/finally, fetch sostituito e rimesso a posto in finally. */

function intercetta() {
  const spedite: Record<string, unknown>[] = [];
  const orig = globalThis.fetch;
  globalThis.fetch = ((_u: unknown, init?: RequestInit) => {
    spedite.push(JSON.parse(String(init?.body ?? '{}')));
    return Promise.resolve(new Response('{"id":"finto"}', { status: 200 }));
  }) as typeof fetch;
  return { spedite, ripristina: () => { globalThis.fetch = orig; } };
}

Deno.test('con la chiave la ricevuta arriva all ospite, con oggetto in italiano', async () => {
  Deno.env.set('RESEND_API_KEY', 'finta');
  const i = intercetta();
  try {
    assertEquals(await inviaRicevutaArrivo(OSPITE, RIGHE), true);
    assertEquals(i.spedite.length, 1);
    const m = i.spedite[0] as Record<string, unknown>;
    assertEquals(m.to, 'mario@esempio.test');
    assert(String(m.subject).length > 0, 'manca l oggetto');
  } finally { i.ripristina(); Deno.env.delete('RESEND_API_KEY'); }
});

Deno.test('senza chiave Resend la ricevuta non parte ma non esplode', async () => {
  Deno.env.delete('RESEND_API_KEY');
  const i = intercetta();
  try {
    assertEquals(await inviaRicevutaArrivo(OSPITE, RIGHE), false);
    assertEquals(i.spedite.length, 0);
  } finally { i.ripristina(); }
});

Deno.test('senza email dell ospite non si prova nemmeno a mandarla', async () => {
  Deno.env.set('RESEND_API_KEY', 'finta');
  const i = intercetta();
  try {
    assertEquals(await inviaRicevutaArrivo({ ...OSPITE, email: '' }, RIGHE), false);
    assertEquals(i.spedite.length, 0);
  } finally { i.ripristina(); Deno.env.delete('RESEND_API_KEY'); }
});

/* Senza righe non e' nata nessuna richiesta: niente da confermare, quindi
   niente da mandare — coerente con «una compilazione, fino a tre richieste»:
   zero richieste vere non producono un'email vuota. */
Deno.test('senza righe non parte nessuna email', async () => {
  Deno.env.set('RESEND_API_KEY', 'finta');
  const i = intercetta();
  try {
    assertEquals(await inviaRicevutaArrivo(OSPITE, []), false);
    assertEquals(i.spedite.length, 0);
  } finally { i.ripristina(); Deno.env.delete('RESEND_API_KEY'); }
});

Deno.test('se Resend risponde male la ricevuta dice falso, senza lanciare', async () => {
  Deno.env.set('RESEND_API_KEY', 'finta');
  const orig = globalThis.fetch;
  globalThis.fetch = (() => Promise.resolve(new Response('errore', { status: 500 }))) as typeof fetch;
  try {
    assertEquals(await inviaRicevutaArrivo(OSPITE, RIGHE), false);
  } finally { globalThis.fetch = orig; Deno.env.delete('RESEND_API_KEY'); }
});
