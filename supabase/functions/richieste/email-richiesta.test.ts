/* Test dell'avviso che arriva all'hotel quando dal sito entra una richiesta.
   L'email si intercetta sostituendo fetch: nessuna spedizione vera. */
import { assert, assertEquals, assertStringIncludes } from 'jsr:@std/assert';
import { avvisaHotel, richiestaHTML } from './email-richiesta.ts';

const r = {
  numero: 'RS-2026-0007',
  nome: 'Mario Rossi',
  email: 'mario@email.it',
  telefono: '+39 049 1234567',
  check_in: '2026-09-10',
  check_out: '2026-09-14',
  notti: 4,
  ospiti: 2,
  tipo_camera: 'Doppia',
  pacchetto: 'Soggiorno Smart',
  messaggio: 'Vorremmo una camera silenziosa.',
  lingua: 'de',
};

/* intercetta fetch e raccoglie quello che sarebbe partito */
function intercetta() {
  const spedite: Record<string, unknown>[] = [];
  const orig = globalThis.fetch;
  globalThis.fetch = ((_u: unknown, init?: RequestInit) => {
    spedite.push(JSON.parse(String(init?.body ?? '{}')));
    return Promise.resolve(new Response('{"id":"finto"}', { status: 200 }));
  }) as typeof fetch;
  return { spedite, ripristina: () => { globalThis.fetch = orig; } };
}

Deno.test('l avviso riporta tutto quello che serve per richiamare l ospite', () => {
  const h = richiestaHTML(r);
  for (const atteso of ['RS-2026-0007', 'Mario Rossi', 'mario@email.it', '+39 049 1234567',
    '10/09/2026', '14/09/2026', 'Doppia', 'Soggiorno Smart', 'camera silenziosa']) {
    assertStringIncludes(h, atteso);
  }
});

const trasferimento = {
  numero: 'RS-2026-0009', tipo: 'transfer',
  nome: 'Klaus Müller', email: 'klaus@example.de', telefono: '+49 170 1234567',
  lingua: 'de',
  quando: '2026-09-10', ora: '14:30', pax: 3, verso: 'arrivo',
  luogo: 'Venezia  aeroporto', volo: 'FR1234', ritorno: true, note: 'Tre valigie grandi.',
};

Deno.test('l avviso di un transfer racconta il transfer, non un soggiorno', () => {
  const h = richiestaHTML(trasferimento as never);
  assertStringIncludes(h, '10/09/2026');
  assertStringIncludes(h, '14:30');
  assertStringIncludes(h, 'Venezia  aeroporto');
  assertStringIncludes(h, 'FR1234');
  assertStringIncludes(h, 'Tre valigie grandi');
  /* niente righe da soggiorno: qui non ci sono notti da contare */
  assert(!h.includes('notti'), 'un transfer non ha notti');
});

Deno.test('il transfer dice se serve anche il ritorno', () => {
  assertStringIncludes(richiestaHTML(trasferimento as never), 'con ritorno');
  const senza = richiestaHTML({ ...trasferimento, ritorno: false } as never);
  assert(!senza.includes('con ritorno'));
});

Deno.test('l avviso porta il marchio dell hotel', () => {
  /* PNG e non SVG: nelle email l'SVG non si vede */
  assertStringIncludes(richiestaHTML(r),
    'https://arrivo-terme-leonardo.vercel.app/buoni/img/logo-nero.png');
});

Deno.test('quattro notti per due persone si leggono a colpo d occhio', () => {
  const h = richiestaHTML(r);
  assertStringIncludes(h, '4 notti');
  assertStringIncludes(h, '2 ospiti');
});

Deno.test('la lingua dell ospite si vede: si richiama in tedesco, non in italiano', () => {
  assertStringIncludes(richiestaHTML(r), 'Tedesco');
  assertStringIncludes(richiestaHTML({ ...r, lingua: 'it' }), 'Italiano');
});

Deno.test('i campi vuoti non lasciano righe a meta', () => {
  const h = richiestaHTML({ ...r, telefono: '', tipo_camera: '', pacchetto: '', messaggio: '' });
  assert(!h.includes('Soggiorno Smart'));
  assertStringIncludes(h, 'Mario Rossi');
});

Deno.test('un messaggio con tag non puo iniettare nulla nell email', () => {
  const h = richiestaHTML({ ...r, messaggio: '<script>alert(1)</script> & altro' });
  assertStringIncludes(h, '&lt;script&gt;');
  assertStringIncludes(h, '&amp; altro');
  assert(!h.includes('<script>'));
});

Deno.test('l avviso parte verso l hotel e si risponde direttamente all ospite', async () => {
  Deno.env.set('RESEND_API_KEY', 'finta');
  const i = intercetta();
  try {
    const esito = await avvisaHotel(r);
    assertEquals(esito, true);
    assertEquals(i.spedite.length, 1);
    const m = i.spedite[0] as Record<string, any>;
    assertStringIncludes(String(m.subject), 'RS-2026-0007');
    assertStringIncludes(String(m.subject), 'Mario Rossi');
    /* rispondere all'avviso deve scrivere all'ospite, non a se stessi:
       e' la differenza fra rispondere in dieci secondi e ricopiare a mano */
    assertEquals(m.reply_to, 'mario@email.it');
  } finally { i.ripristina(); }
});

Deno.test('senza chiave Resend non si spedisce ma non si esplode', async () => {
  Deno.env.delete('RESEND_API_KEY');
  const i = intercetta();
  try {
    /* la richiesta e' gia' salvata a database: se l'email non parte, la si
       recupera dall'elenco. Meglio nessun avviso che una richiesta persa. */
    assertEquals(await avvisaHotel(r), false);
    assertEquals(i.spedite.length, 0);
  } finally { i.ripristina(); }
});

/* ---------------- C1: il prezzo e il trattamento arrivano a un essere umano ----------------
   I campi di `dati` arrivano qui appiattiti sull'oggetto (index.ts fa
   ...(propri || {})): se nessuna riga li legge, l'ospite sceglie
   "Doppia — Mezza Pensione — 310,00 EUR" e la reception legge "Doppia". */
const scelto = {
  ...r,
  lingua: 'it',
  ospiti: 4,
  camera_id: 5,
  nome_camera: 'Doppia',
  variante_id: 3,
  tariffa: 'Soggiorno breve',
  trattamento: 'Mezza Pensione',
  prezzo_cent: 31000,
  valuta: 'centesimi',
  adulti: 2,
  bambini: 2,
  caparra_cent: 15000,
};

Deno.test('l avviso dice il trattamento scelto, non solo la camera', () => {
  assertStringIncludes(richiestaHTML(scelto), 'Mezza Pensione');
});

Deno.test('il prezzo arriva in euro, non in centesimi in faccia alla reception', () => {
  const h = richiestaHTML(scelto);
  assertStringIncludes(h, '310,00');
  assert(!h.includes('31000'), 'i centesimi grezzi non si mostrano a un essere umano');
});

Deno.test('la caparra promessa all ospite si legge nell avviso', () => {
  assertStringIncludes(richiestaHTML(scelto), '150,00');
});

/* e' il caso che rende il difetto grave: due proposte della stessa camera
   differiscono SOLO per trattamento e prezzo */
Deno.test('due proposte della stessa camera si distinguono nell avviso', () => {
  const mezza = richiestaHTML(scelto);
  const piena = richiestaHTML({ ...scelto, trattamento: 'Pensione Completa', prezzo_cent: 38000 });
  assert(mezza !== piena, 'due trattamenti diversi non possono produrre lo stesso avviso');
  assertStringIncludes(piena, 'Pensione Completa');
  assertStringIncludes(piena, '380,00');
});

/* 2 adulti + 2 bambini: "4 ospiti" farebbe chiedere 300 EUR invece di 150 */
Deno.test('adulti e bambini non si perdono dietro un totale di ospiti', () => {
  const h = richiestaHTML(scelto);
  assertStringIncludes(h, '2 adulti');
  assertStringIncludes(h, '2 bambini');
});

/* il prezzo non e' un preventivo della casa: e' quello che l'ospite aveva
   davanti quando ha scelto, e la reception lo conferma */
Deno.test('accanto al prezzo sta scritto che va confermato', () => {
  const h = richiestaHTML(scelto);
  assertStringIncludes(h, 'visto dall');
  assertStringIncludes(h, 'confermat');
});

/* la chat manda soggiorni senza camera scelta: nessuna riga di prezzo, e
   soprattutto nessun "0,00 EUR" inventato */
Deno.test('un soggiorno senza camera scelta non inventa un prezzo', () => {
  const h = richiestaHTML(r);
  assert(!h.includes('0,00'), 'senza prezzo non si stampa una cifra finta');
  assert(!h.includes('Trattamento'));
});

/* ---------------- Day Spa ----------------
   Questa email e' il modo in cui la reception SCOPRE che e' arrivata una
   richiesta: la riga di back office puo' anche essere giusta, ma nessuno
   la guarda se l'avviso non dice cosa e' stato chiesto. Fino al 17 agosto
   2026 il ramo `dayspa` non c'era e l'avviso usciva con l'etichetta del
   soggiorno e "undefined notti · undefined ospiti" — il giorno e il numero
   di persone non comparivano da nessuna parte.
   I campi arrivano appiattiti sull'oggetto, come per gli altri tipi
   (index.ts fa ...(propri || {})). */
const ingresso = {
  numero: 'RIC-2026-0006', tipo: 'dayspa',
  nome: 'Anna Verdi', email: 'anna@example.it', telefono: '+39 333 1234567',
  lingua: 'it',
  giorno: '2026-08-22', persone: 2, note: 'Buono regalo: LEO-DUE-VOCI',
};

Deno.test('l avviso di un Day Spa dice il giorno e quante persone', () => {
  const h = richiestaHTML(ingresso as never);
  assertStringIncludes(h, '22/08/2026');
  assertStringIncludes(h, '2 persone');
  /* la nota libera arriva gia' oggi, ma da sola non basta: dice il buono,
     non quando viene e in quanti */
  assertStringIncludes(h, 'LEO-DUE-VOCI');
});

/* il difetto in una riga sola: e' esattamente l'"undefined" contro cui
   mette in guardia il commento sopra ETICHETTA */
Deno.test('l avviso di un Day Spa non contiene la parola undefined', () => {
  const h = richiestaHTML(ingresso as never);
  assert(!h.includes('undefined'), 'un campo assente non deve mai arrivare in reception cosi');
  assert(!h.includes('notti'), 'un ingresso di un giorno non ha notti da contare');
});

Deno.test('l avviso di un Day Spa porta la sua etichetta, non quella del soggiorno', () => {
  const h = richiestaHTML(ingresso as never);
  assertStringIncludes(h, 'DAY SPA');
  assert(!h.includes('RICHIESTA DAL SITO'), 'l etichetta del soggiorno qui e sbagliata');
});

/* una persona sola non e' "1 persone": la reception legge una riga scritta
   da un essere umano, come gia' in riepilogo.ts */
Deno.test('l avviso di un Day Spa per una persona sola si legge in italiano', () => {
  assertStringIncludes(richiestaHTML({ ...ingresso, persone: 1 } as never), '1 persona');
});

/* ============================================================
   POCO PREAVVISO — il riquadro rosso.

   Decisione della proprieta' del 18 agosto 2026: una richiesta di
   trattamenti con meno di 48 ore NON si rifiuta. Bloccare vorrebbe dire
   rifiutare al posto della reception una richiesta che lei accetterebbe, e
   perdere insieme la vendita e l'informazione — chi viene respinto non
   scrive piu'.

   IL DIFETTO CHE PRESIDIA: se l'avviso lo legge solo l'ospite, in reception
   quella richiesta arriva IDENTICA a una per il mese prossimo e finisce in
   fondo alla casella come le altre. Ed e' la piu' urgente che ci sia.
   ============================================================ */
Deno.test('col poco preavviso il riquadro compare e dice di guardarla per prima', () => {
  const h = richiestaHTML({ ...r, tipo: 'trattamenti', poco_preavviso: true } as never);
  assertStringIncludes(h, 'Poco preavviso');
  assertStringIncludes(h, 'per prima');
  assertStringIncludes(h, '48 ore');
});

Deno.test('senza poco preavviso il riquadro non c e', () => {
  const h = richiestaHTML({ ...r, tipo: 'trattamenti' } as never);
  assert(!h.includes('Poco preavviso'), 'il riquadro non doveva comparire');
  /* e nemmeno con un valore che non e' esattamente `true` */
  const q = richiestaHTML({ ...r, tipo: 'trattamenti', poco_preavviso: 'si' } as never);
  assert(!q.includes('Poco preavviso'), 'una stringa non e un booleano vero');
});

/* Il riquadro dice alla reception cosa abbiamo promesso all'ospite —
   niente — perche' se poi lei promette altro le due cose divergono davanti
   alla stessa persona. */
Deno.test('il riquadro dichiara che all ospite non abbiamo promesso niente', () => {
  const h = richiestaHTML({ ...r, tipo: 'trattamenti', poco_preavviso: true } as never);
  assertStringIncludes(h, 'nessuna promessa');
});

/* ============================================================
   LA COPIA IN CC — spa e amministrazione.

   Le righe che scelgono il `cc` dentro avvisaHotel (EMAIL_SPA o
   EMAIL_AMMINISTRAZIONE secondo casellaInCopia(r.tipo)) non erano toccate
   da nessuna prova sopra: quelle usano `r`, che non ha `tipo`, quindi
   casellaInCopia rispondeva sempre null e il ramo del cc non veniva mai
   percorso. Un nome di variabile sbagliato, un ternario invertito o un cc
   che non arriva nel corpo passerebbero comunque a prove verdi.
   ============================================================ */
Deno.test('con EMAIL_SPA impostata, un trattamento arriva in copia alla spa', async () => {
  Deno.env.set('RESEND_API_KEY', 'finta');
  Deno.env.set('EMAIL_SPA', 'spa@termeleonardo.com');
  const i = intercetta();
  try {
    const esito = await avvisaHotel({ ...r, tipo: 'trattamenti' } as never);
    assertEquals(esito, true);
    assertEquals(i.spedite.length, 1);
    const m = i.spedite[0] as Record<string, unknown>;
    assertEquals(m.cc, ['spa@termeleonardo.com']);
  } finally {
    i.ripristina();
    Deno.env.delete('RESEND_API_KEY');
    Deno.env.delete('EMAIL_SPA');
  }
});

Deno.test('senza EMAIL_SPA un trattamento non porta nessun cc, e nemmeno uno inventato', async () => {
  Deno.env.set('RESEND_API_KEY', 'finta');
  Deno.env.delete('EMAIL_SPA');
  const zitto = console.error; console.error = () => {};
  const i = intercetta();
  try {
    const esito = await avvisaHotel({ ...r, tipo: 'trattamenti' } as never);
    assertEquals(esito, true);
    assertEquals(i.spedite.length, 1);
    const m = i.spedite[0] as Record<string, unknown>;
    /* sull'assenza della chiave, non solo su un valore diverso: un
       indirizzo di riserva inventato avrebbe comunque una chiave `cc` */
    assertEquals(Object.hasOwn(m, 'cc'), false);
  } finally {
    i.ripristina();
    console.error = zitto;
    Deno.env.delete('RESEND_API_KEY');
  }
});

/* ---------------- check-in online e fattura (Task 5, arrivo-invio.ts) ----------------
   Prima di questo giro di correzione i due tipi non avevano un ramo qui:
   ETICHETTA aveva sei voci, non otto, quindi `arrivo` e `fattura`
   ricadevano sull'etichetta e sulle righe del soggiorno — "RICHIESTA DAL
   SITO | Soggiorno | undefined notti · undefined ospiti", perche' ne'
   l'uno ne' l'altra hanno notti o ospiti. La reception riceveva un
   check-in senza ora ne' mezzo, e una fattura senza ragione sociale ne'
   partita IVA: peggio dell'email scritta a mano che questo compito
   sostituisce. */
const checkin = {
  numero: 'RS-2026-0041', tipo: 'arrivo',
  nome: 'Bianchi Mario', email: 'mario@example.it', telefono: '+39 333 1234567',
  lingua: 'it',
  ora_arrivo: '16:30', mezzo: 'auto', attenzioni: ['culla', 'cane'],
  fanghi_desiderio: 'presto',
  persone_extra: [{ nome: 'Bianchi Luca', eta: '12' }],
  persone_confermate: false, note: 'Arriviamo dopo cena.',
};

Deno.test('il check-in online porta ora, mezzo e attenzioni, non le righe del soggiorno', () => {
  const h = richiestaHTML(checkin as never);
  assertStringIncludes(h, '16:30');
  assertStringIncludes(h, 'auto');
  assertStringIncludes(h, 'culla');
  assertStringIncludes(h, 'cane');
  assertStringIncludes(h, 'presto');
  assertStringIncludes(h, 'Bianchi Luca');
  assert(!h.includes('notti'), 'un check-in non ha notti da contare');
});

/* il difetto in una riga sola: e' esattamente l'"undefined" contro cui
   mette in guardia il commento sopra ETICHETTA */
Deno.test('l avviso di un check-in online non contiene la parola undefined', () => {
  const h = richiestaHTML(checkin as never);
  assert(!h.includes('undefined'), 'un campo assente non deve mai arrivare in reception cosi');
});

Deno.test('il check-in online porta la sua etichetta, non quella del soggiorno', () => {
  const h = richiestaHTML(checkin as never);
  assertStringIncludes(h, 'CHECK-IN ONLINE');
  assert(!h.includes('RICHIESTA DAL SITO'), 'l etichetta del soggiorno qui e sbagliata');
});

const fattura = {
  numero: 'RS-2026-0043', tipo: 'fattura',
  nome: 'Bianchi Mario', email: 'mario@example.it', telefono: '+39 333 1234567',
  lingua: 'it',
  ragione: 'Bianchi S.r.l.', indirizzo: 'Via Roma 1, Padova',
  piva: 'IT02042330288', cf: '', sdi: 'M5UXCR1', pec: '',
};

Deno.test('la fattura porta ragione sociale, indirizzo e partita IVA', () => {
  const h = richiestaHTML(fattura as never);
  assertStringIncludes(h, 'Bianchi S.r.l.');
  assertStringIncludes(h, 'Via Roma 1, Padova');
  assertStringIncludes(h, 'IT02042330288');
  assertStringIncludes(h, 'M5UXCR1');
});

Deno.test('l avviso di una fattura non contiene la parola undefined', () => {
  const h = richiestaHTML(fattura as never);
  assert(!h.includes('undefined'), 'un campo assente non deve mai arrivare in reception cosi');
});

Deno.test('la fattura porta la sua etichetta, non quella del soggiorno', () => {
  const h = richiestaHTML(fattura as never);
  assertStringIncludes(h, 'RICHIESTA FATTURA');
  assert(!h.includes('RICHIESTA DAL SITO'), 'l etichetta del soggiorno qui e sbagliata');
});

Deno.test('una fattura arriva in copia all amministrazione', async () => {
  Deno.env.set('RESEND_API_KEY', 'finta');
  Deno.env.set('EMAIL_AMMINISTRAZIONE', 'amministrazione@termeleonardo.com');
  const i = intercetta();
  try {
    const esito = await avvisaHotel({ ...r, tipo: 'fattura' } as never);
    assertEquals(esito, true);
    assertEquals(i.spedite.length, 1);
    const m = i.spedite[0] as Record<string, unknown>;
    assertEquals(m.cc, ['amministrazione@termeleonardo.com']);
  } finally {
    i.ripristina();
    Deno.env.delete('RESEND_API_KEY');
    Deno.env.delete('EMAIL_AMMINISTRAZIONE');
  }
});
