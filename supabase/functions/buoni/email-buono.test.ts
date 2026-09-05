/* Test del modulo email: il buono in HTML e le tre spedizioni
   (acquirente, destinatario, amministrazione) via Resend. */
import { assert, assertEquals, assertStringIncludes } from 'jsr:@std/assert';
import { allegatoPdf, avvisaAmministrazione, buonoEmailHTML, destinatariInCopia, inviaBuonoA, inviaBuonoEmesso, linkPrenota, linkQr, linkStampa, moduloDelBuono, nomeFilePdf as nomeFileEmail, ricevutaEmailHTML, statoConsegna } from './email-buono.ts';
/* l'originale, per confrontarci la copia: vedi la prova più sotto */
import { nomeFilePdf as nomeFileFoglio } from './pdf-buono.ts';

const IMG = 'https://arrivo-terme-leonardo.vercel.app/buoni/img';
const FUNZIONE = 'https://mvuiuwakuseockotlcnp.supabase.co/functions/v1/buoni';

const BUONO = {
  numero: 'BR-2026-0042', codice: 'LEO-ACDE-FGHJ',
  tipo: 'valore', descrizione: 'Buono valore di 100,00 €, spendibile in hotel',
  valore: 100, lingua: 'de', scade_il: '2027-08-12',
  acquirente: 'Max Muster', acquirente_email: 'max@example.com',
  destinatario: 'Anna', destinatario_email: 'anna@example.com',
  dedica: 'Alles Gute', pagamento: 'stripe', creato_da: 'sito'
};

Deno.test('il buono HTML neutralizza i tag nei campi liberi', () => {
  const html = buonoEmailHTML({ ...BUONO, dedica: '<script>alert(1)</script>' });
  assertEquals(html.includes('<script>'), false);
  assertStringIncludes(html, '&lt;script&gt;');
});

Deno.test('il buono esce nella lingua giusta, data compresa', () => {
  const html = buonoEmailHTML(BUONO);
  assertStringIncludes(html, 'GUTSCHEINCODE');
  assertStringIncludes(html, 'Gültig bis 12. August 2027');
  assertStringIncludes(html, 'LEO-ACDE-FGHJ');
});

/* ============================================================
   La proroga si vede. Un buono che nasce già con la data prorogata
   stampata sopra e basta non dice al cliente che gli è stato fatto un
   favore: la data grande resta una sola — quella che vale, così alla
   reception non c'è mai dubbio su quale leggere — e sotto compare una
   riga piccola che spiega da dove viene, SOLO quando c'è stata una
   proroga davvero. */
Deno.test('buono prorogato: si vedono tutte e due le date', () => {
  const html = buonoEmailHTML({ ...BUONO, lingua: 'it',
    scade_il: '2027-03-13', scade_il_base: '2026-11-30', prorogato: true });
  assertStringIncludes(html, 'Valido fino al 13 marzo 2027');
  assertStringIncludes(html, '30 novembre 2026');
  assertStringIncludes(html, 'prorogata fino al 13 marzo 2027');
});

Deno.test('buono non prorogato: nessuna spiegazione, solo la data', () => {
  const html = buonoEmailHTML({ ...BUONO, lingua: 'it',
    scade_il: '2027-08-15', scade_il_base: '2027-08-15', prorogato: false });
  assertStringIncludes(html, 'Valido fino al 15 agosto 2027');
  assertEquals(html.includes('sarebbe scaduta'), false);
});

/* Il numero di mesi non si scrive mai: la proroga non aggiunge mesi
   fissi, sposta a una data usabile, e quanti mesi siano dipende da
   quando si è comprato. Un numero scritto sarebbe giusto per un cliente
   e sbagliato per il prossimo. */
Deno.test('la spiegazione non nomina mai un numero di mesi, in nessuna lingua', () => {
  for (const lingua of ['it', 'de', 'en', 'fr']) {
    const html = buonoEmailHTML({ ...BUONO, lingua,
      scade_il: '2027-03-13', scade_il_base: '2026-11-30', prorogato: true });
    /* «due mesi», «zwei Monate», «two months», «deux mois» — e qualunque
       altro numero attaccato alla parola mese */
    assertEquals(/\b(due|zwei|two|deux|\d+)\s+(mesi|monate|months|mois)\b/i.test(html), false,
      `la lingua ${lingua} nomina un numero di mesi`);
  }
});

Deno.test('senza scade_il_base non si inventa niente: si mostra solo la data valida', () => {
  /* i buoni emessi prima di questa modifica non hanno la colonna popolata */
  const html = buonoEmailHTML({ ...BUONO, lingua: 'it',
    scade_il: '2027-08-15', scade_il_base: null, prorogato: true });
  assertStringIncludes(html, 'Valido fino al 15 agosto 2027');
  assertEquals(html.includes('sarebbe scaduta'), false);
});

/* piccolo aiuto: intercetta fetch e raccoglie i destinatari */
type Spedita = {
  to: string[]; subject: string; html: string; cc?: string[];
  attachments?: { filename: string; content: string }[];
};
function conFetchFinto() {
  const spedite: Spedita[] = [];
  const orig = globalThis.fetch;
  globalThis.fetch = ((_url: unknown, init?: RequestInit) => {
    spedite.push(JSON.parse(String(init?.body)));
    return Promise.resolve(new Response('{"id":"em_1"}', { status: 200 }));
  }) as typeof fetch;
  return { spedite, ripristina: () => { globalThis.fetch = orig; } };
}

Deno.test('senza RESEND_API_KEY nessuna chiamata parte, ma non fallisce', async () => {
  Deno.env.delete('RESEND_API_KEY');
  const zitto = console.error; console.error = () => {};
  const { spedite, ripristina } = conFetchFinto();
  try {
    const esiti = await inviaBuonoEmesso(BUONO);
    assertEquals(spedite.length, 0);
    assertEquals(esiti.acquirente, false);
  } finally { ripristina(); console.error = zitto; }
});

Deno.test('con la chiave partono acquirente, destinatario e amministrazione', async () => {
  Deno.env.set('RESEND_API_KEY', 'test');
  Deno.env.set('EMAIL_AMMINISTRAZIONE', 'amministrazione@termeleonardo.com');
  const { spedite, ripristina } = conFetchFinto();
  try {
    const esiti = await inviaBuonoEmesso(BUONO);
    assertEquals(esiti, { acquirente: true, destinatario: true, amministrazione: true });
    assertEquals(spedite.map(s => s.to[0]), [
      'max@example.com', 'anna@example.com', 'amministrazione@termeleonardo.com'
    ]);
    assertStringIncludes(spedite[1].subject, 'Geschenkgutschein');
  } finally {
    ripristina();
    Deno.env.delete('RESEND_API_KEY'); Deno.env.delete('EMAIL_AMMINISTRAZIONE');
  }
});

Deno.test('se il destinatario ha la stessa email dell’acquirente, una copia sola', async () => {
  Deno.env.set('RESEND_API_KEY', 'test');
  Deno.env.delete('EMAIL_AMMINISTRAZIONE');
  const { spedite, ripristina } = conFetchFinto();
  try {
    const esiti = await inviaBuonoEmesso({ ...BUONO, destinatario_email: 'max@example.com' });
    assertEquals(spedite.length, 1);
    assertEquals(esiti.destinatario, undefined);
  } finally { ripristina(); Deno.env.delete('RESEND_API_KEY'); }
});

/* ============================================================
   NIENTE FOTOGRAFIE NELL'EMAIL. Il buono bello — carta intestata,
   fotografia in cima — adesso e' il PDF in allegato (pdf-buono.ts), e
   l'email e' la lettera che lo accompagna: una colonna sola, il marchio
   in cima e il QR accanto al codice, nient'altro da scaricare.

   Le tre fotografie di prima (dayspa.jpg, valore.jpg, trattamenti.jpg)
   viaggiavano a ogni apertura dell'email, una per tipo di buono, e in
   Outlook uscivano schiacciate appena il file cambiava forma. Questa prova
   conta le immagini: se qualcuno ne rimette una, si vede qui.
   ============================================================ */
Deno.test('l’email non porta nessuna fotografia: le sole immagini sono il marchio e il QR', () => {
  const html = buonoEmailHTML(BUONO);
  const src = [...html.matchAll(/<img[^>]*\ssrc="([^"]*)"/g)].map((m) => m[1]);
  assertEquals(src.length, 2, `immagini nel buono: ${JSON.stringify(src)}`);
  assertEquals(src[0], `${IMG}/logo-nero.png`);
  assertStringIncludes(src[1], 'a=qr');
  for (const vecchia of ['dayspa.jpg', 'valore.jpg', 'trattamenti.jpg']) {
    assertEquals(html.includes(vecchia), false, `l’email nomina ancora ${vecchia}`);
  }
});

/* Gmail e Outlook scartano l'SVG: nel buono spedito il marchio dev'essere
   un'immagine raster, altrimenti al cliente arriva un buco bianco.
   E' logo-nero.png (intestazione(), la stessa delle altre email) e non
   logo.png: quello ha il fondo verde acqua incorporato perche' stava sulla
   colonna colorata di prima — su bianco si vedrebbe il rettangolo. */
Deno.test('nell’email il logo è un PNG, mai un SVG', () => {
  const html = buonoEmailHTML(BUONO);
  assertStringIncludes(html, `${IMG}/logo-nero.png`);
  assertEquals(html.includes('logo.svg'), false);
});

/* Il buono spedito e il foglio stampato devono dire le stesse cose:
   chi compra online non parla con la reception, ed è l'unico che non
   verrebbe mai a sapere che un ingresso vale per una persona.

   La nota non promette più "in momenti diversi, come preferite": la
   proprietà l'ha tolta perché complicava il lavoro alla reception
   (riscossioni parziali, tenere il conto di quante volte un buono a più
   voci è già stato usato). */
Deno.test('l’email porta la nota su persone e prenotazione, nella sua lingua', () => {
  assertStringIncludes(buonoEmailHTML({ ...BUONO, lingua: 'it' }),
    'Ogni ingresso o trattamento vale per una persona. Per prenotare basta chiamarci o scriverci: ci organizziamo insieme.');
  assertStringIncludes(buonoEmailHTML({ ...BUONO, lingua: 'de' }),
    'Jeder Eintritt und jede Anwendung gilt für eine Person. Für die Reservierung rufen Sie uns an oder schreiben Sie uns: wir organisieren alles gemeinsam.');
  assertStringIncludes(buonoEmailHTML({ ...BUONO, lingua: 'en' }),
    'Each admission or treatment is for one person. To book, just call or write to us: we will arrange everything together.');
  assertStringIncludes(buonoEmailHTML({ ...BUONO, lingua: 'fr' }),
    'Chaque entrée ou soin vaut pour une personne. Pour réserver, appelez-nous ou écrivez-nous : nous organisons tout ensemble.');
});

Deno.test('un buono con più voci resta su più righe anche nell’email', () => {
  const html = buonoEmailHTML({ ...BUONO,
    descrizione: 'n. 2 · ingressi Day Spa\nn. 1 · Massaggio antistress (45 min)' });
  assertEquals(html.includes('Day Spa\nn. 1'), false);   // niente riga unica
  assertStringIncludes(html, 'ingressi Day Spa</div>');
  assertStringIncludes(html, 'Massaggio antistress (45 min)</div>');
});

/* Chi compra online riceve solo l'email: se lì non c'è scritto come si
   prenota, non lo saprà mai da nessun'altra parte. */
Deno.test('l’email spiega come prenotare, nella lingua del buono', () => {
  assertStringIncludes(buonoEmailHTML({ ...BUONO, lingua: 'it' }), 'COME PRENOTARE');
  assertStringIncludes(buonoEmailHTML({ ...BUONO, lingua: 'it' }), 'Per prenotare ci chiami o ci scriva');
  assertStringIncludes(buonoEmailHTML({ ...BUONO, lingua: 'de' }), 'SO RESERVIEREN SIE');
  assertStringIncludes(buonoEmailHTML({ ...BUONO, lingua: 'en' }), 'HOW TO BOOK');
  assertStringIncludes(buonoEmailHTML({ ...BUONO, lingua: 'fr' }), 'COMMENT RÉSERVER');
});

/* Il Day Spa è la voce più venduta: sul foglio stampato l'elenco di
   piscine e grotte c'è, nell'email mancava. */
Deno.test('per un Day Spa l’email elenca piscine e grotte', () => {
  const html = buonoEmailHTML({ ...BUONO, tipo: 'servizio', voce_id: 'dayspa_wknd', lingua: 'it' });
  assertStringIncludes(html, 'Biogrotta');
  assertStringIncludes(html, 'Cascata di acqua termale');
  const de = buonoEmailHTML({ ...BUONO, tipo: 'servizio', voce_id: 'dayspa_fer', lingua: 'de' });
  assertStringIncludes(de, 'Biogrotte');
});

Deno.test('per un massaggio l’elenco delle piscine non compare', () => {
  const html = buonoEmailHTML({ ...BUONO, tipo: 'servizio', voce_id: 'relax25', lingua: 'it' });
  assertEquals(html.includes('Biogrotta'), false);
});

/* I buoni emessi in reception (contanti, bancomat, promozionali) non
   passano dal webhook: senza un avviso, un omaggio non lascia traccia
   verso l'amministrazione, ed è proprio quello senza incasso da
   riconciliare. Al cliente però non si spedisce nulla: il buono glielo
   consegna la reception con i suoi pulsanti. */
Deno.test('l’avviso all’amministrazione parte da solo, senza toccare il cliente', async () => {
  Deno.env.set('RESEND_API_KEY', 'test');
  Deno.env.set('EMAIL_AMMINISTRAZIONE', 'amministrazione@termeleonardo.com');
  const { spedite, ripristina } = conFetchFinto();
  try {
    const esito = await avvisaAmministrazione({ ...BUONO, pagamento: 'promozionale' });
    assertEquals(esito, true);
    assertEquals(spedite.length, 1);
    assertEquals(spedite[0].to[0], 'amministrazione@termeleonardo.com');
    assertStringIncludes(spedite[0].subject, 'promozionale');
  } finally {
    ripristina();
    Deno.env.delete('RESEND_API_KEY'); Deno.env.delete('EMAIL_AMMINISTRAZIONE');
  }
});

/* Un buono a due voci porta la descrizione su due righe. In HTML un
   ritorno a capo non si vede: senza <br /> le due voci si leggono di fila
   su una riga sola, e questo avviso e' la sola traccia che l'amministrazione
   ha di cosa e' stato venduto quando il buono non passa dal webhook.
   Stesso difetto gia' visto e gia' risolto in ricevutaEmailHTML. */
Deno.test('l’avviso all’amministrazione tiene le due voci su righe distinte', async () => {
  Deno.env.set('RESEND_API_KEY', 'finta');
  Deno.env.set('EMAIL_AMMINISTRAZIONE', 'amministrazione@termeleonardo.com');
  const { spedite, ripristina } = conFetchFinto();
  try {
    await avvisaAmministrazione({ ...BUONO,
      descrizione: '2 × Day Spa festivo\nMassaggio antistress (45 min)' });
    assertEquals(spedite.length, 1);
    /* il ritorno a capo del dato non arriva mai tale e quale nell'HTML */
    assertEquals(spedite[0].html.includes('Day Spa festivo\nMassaggio'), false);
    assertStringIncludes(spedite[0].html, 'Day Spa festivo<br />Massaggio antistress (45 min)');
  } finally {
    ripristina();
    Deno.env.delete('RESEND_API_KEY'); Deno.env.delete('EMAIL_AMMINISTRAZIONE');
  }
});

Deno.test('senza indirizzo di amministrazione non si spedisce nulla', async () => {
  Deno.env.set('RESEND_API_KEY', 'test');
  Deno.env.delete('EMAIL_AMMINISTRAZIONE');
  const { spedite, ripristina } = conFetchFinto();
  try {
    assertEquals(await avvisaAmministrazione(BUONO), false);
    assertEquals(spedite.length, 0);
  } finally { ripristina(); Deno.env.delete('RESEND_API_KEY'); }
});

/* Ricevuta a un altro indirizzo: serve a chi compra per l'azienda o per
   il commercialista. Non e' una fattura: la knowledge base dice che la
   ricevuta fiscale si chiede in reception. */
Deno.test('con un indirizzo per la ricevuta parte anche il riepilogo', async () => {
  Deno.env.set('RESEND_API_KEY', 'test');
  Deno.env.delete('EMAIL_AMMINISTRAZIONE');
  const { spedite, ripristina } = conFetchFinto();
  try {
    const esiti = await inviaBuonoEmesso({ ...BUONO, ricevuta_email: 'contabilita@ditta.it' });
    assertEquals(esiti.ricevuta, true);
    const ric = spedite.find(s => s.to[0] === 'contabilita@ditta.it')!;
    assertEquals(!!ric, true);
    assertStringIncludes(ric.subject, 'BR-2026-0042');
    assertStringIncludes(ric.html, '100,00');
    /* il riepilogo non e' il buono: niente codice spendibile dentro */
    assertEquals(ric.html.includes('LEO-ACDE-FGHJ'), false);
  } finally { ripristina(); Deno.env.delete('RESEND_API_KEY'); }
});

Deno.test('senza indirizzo per la ricevuta non cambia nulla', async () => {
  Deno.env.set('RESEND_API_KEY', 'test');
  Deno.env.delete('EMAIL_AMMINISTRAZIONE');
  const { spedite, ripristina } = conFetchFinto();
  try {
    const esiti = await inviaBuonoEmesso(BUONO);
    assertEquals(esiti.ricevuta, undefined);
    assertEquals(spedite.length, 2);   // acquirente e destinatario
  } finally { ripristina(); Deno.env.delete('RESEND_API_KEY'); }
});

/* Il marchio stava in un posto solo, dentro il buono: il riepilogo
   d'acquisto e l'avviso all'amministrazione uscivano anonimi, e un'email
   anonima che parla di soldi somiglia parecchio a una truffa. */
Deno.test('il riepilogo d acquisto porta il marchio', () => {
  assertStringIncludes(ricevutaEmailHTML(BUONO), IMG + '/logo-nero.png');
});

Deno.test('anche l avviso all amministrazione porta il marchio', async () => {
  Deno.env.set('RESEND_API_KEY', 'finta');
  Deno.env.set('EMAIL_AMMINISTRAZIONE', 'amministrazione@termeleonardo.com');
  const { spedite, ripristina } = conFetchFinto();
  try {
    await avvisaAmministrazione(BUONO);
    assertEquals(spedite.length, 1);
    assertStringIncludes(spedite[0].html, IMG + '/logo-nero.png');
  } finally { ripristina(); Deno.env.delete('EMAIL_AMMINISTRAZIONE'); }
});

/* Un buono puo' risultare "pagato" e non essere mai arrivato al cliente:
   e' successo davvero, perche' senza dominio verificato Resend rifiuta
   ogni indirizzo che non sia quello del titolare dell'account. Da qui in
   avanti l'esito si registra, cosi' la reception lo vede. */
Deno.test('la consegna e riuscita solo se tutti gli invii al cliente sono andati', () => {
  assertEquals(statoConsegna({ acquirente: true }), 'inviato');
  assertEquals(statoConsegna({ acquirente: true, destinatario: true }), 'inviato');
  assertEquals(statoConsegna({ acquirente: true, destinatario: false }), 'fallito');
  assertEquals(statoConsegna({ acquirente: false }), 'fallito');
});

Deno.test('l avviso all amministrazione non conta come consegna al cliente', () => {
  /* e' posta interna: se arriva solo quello, il cliente e' rimasto senza */
  assertEquals(statoConsegna({ amministrazione: true }), 'senza-indirizzo');
  assertEquals(statoConsegna({}), 'senza-indirizzo');
  assertEquals(statoConsegna({ acquirente: false, amministrazione: true }), 'fallito');
});

Deno.test('il riepilogo a un terzo indirizzo conta come consegna', () => {
  /* chi lo ha chiesto lo aspetta: se non arriva, va saputo */
  assertEquals(statoConsegna({ acquirente: true, ricevuta: false }), 'fallito');
});

/* ============================================================
   Il pulsante «Stampa il tuo buono»: la pagina che stampa il solo foglio A4
   invece di tutta l'email, intestazioni comprese. Deve arrivare a chi
   riceve il buono vero (acquirente e destinatario), non al riepilogo
   d'acquisto né all'avviso interno — quelli non sono "il buono che il
   cliente ha ricevuto" nel senso di stampa.ts, e il codice lì non compare
   nemmeno (ricevutaEmailHTML non lo stampa mai). */
Deno.test('il link punta al dominio dell’hotel, con codice e lingua del buono', () => {
  assertEquals(linkStampa({ codice: 'LEO-ACDE-FGHJ', lingua: 'de' }),
    'https://www.hoteltermeleonardo.com/buoni/stampa?codice=LEO-ACDE-FGHJ&l=de');
});

/* ============================================================
   LA BARRA FINALE — il difetto vivo trovato il 17 agosto 2026.

   `linkStampa` componeva '/buoni/stampa/?codice=…', con la barra. La
   riscrittura '/buoni/:percorso*' di vercel.json confronta `source` alla
   lettera e NON aggancia il percorso con la barra: la richiesta scivolava
   oltre tutte le regole e la serviva il sito vetrina, che per qualunque
   percorso sconosciuto risponde 200 con la propria home. Risultato: il
   pulsante «Stampa il tuo buono» di ogni email portava alla home dell'hotel
   invece che al buono — e siccome è un 200 e non un 404, non se ne accorgeva
   nessun controllo automatico. Nessun ospite ci è sbattuto solo perché non
   era ancora stato venduto un buono.

   Questi test esistono perché la barra NON torni «per simmetria» con
   /buoni/regala/ o con le destinazioni scritte in vercel.json, che la barra
   ce l'hanno per un'altra ragione (sono destinazioni, non sorgenti).
   Il ragionamento completo, con le misure vere, è sopra linkStampa.
   ============================================================ */
Deno.test('nessun indirizzo verso una pagina riscritta ha la barra prima della query: la barra rompe la riscrittura', () => {
  const CASI = [
    linkStampa({ codice: 'LEO-ACDE-FGHJ', lingua: 'it' }),
    linkStampa({ codice: 'LEO-ACDE-FGHJ', lingua: 'de' }),
    linkPrenota({ ...BUONO, lingua: 'it' }),
    linkPrenota({ ...BUONO, tipo: 'servizio', voce_id: 'dayspa_fer',
      descrizione: 'Day Spa infrasettimanale — piscine e grotte', lingua: 'fr' }),
  ];
  for (const u of CASI) {
    const percorso = u.slice(0, u.indexOf('?'));
    assertEquals(percorso.endsWith('/'), false,
      `«${u}» ha la barra finale: con la barra la riscrittura non aggancia e risponde il sito vetrina`);
  }
});

Deno.test('il link di stampa è esattamente il percorso che la riscrittura aggancia, in tutte e quattro le lingue', () => {
  for (const lingua of ['it', 'de', 'en', 'fr']) {
    assertEquals(linkStampa({ codice: 'LEO-ACDE-FGHJ', lingua }),
      `https://www.hoteltermeleonardo.com/buoni/stampa?codice=LEO-ACDE-FGHJ&l=${lingua}`);
  }
  /* e la forma vecchia, quella rotta, non deve più uscire da nessuna lingua */
  for (const lingua of ['it', 'de', 'en', 'fr']) {
    assertEquals(linkStampa({ codice: 'LEO-ACDE-FGHJ', lingua }).includes('/buoni/stampa/'), false);
  }
});

Deno.test('una lingua non riconosciuta ricade sull’italiano, come ovunque nel progetto', () => {
  assertStringIncludes(linkStampa({ codice: 'LEO-ACDE-FGHJ', lingua: 'xx' }), '&l=it');
});

Deno.test('il pulsante arriva sia all’acquirente sia al destinatario, con lo stesso link', async () => {
  Deno.env.set('RESEND_API_KEY', 'test');
  Deno.env.delete('EMAIL_AMMINISTRAZIONE');
  const { spedite, ripristina } = conFetchFinto();
  try {
    await inviaBuonoEmesso(BUONO);
    assertEquals(spedite.length, 2);
    // l'href esce con l'HTML escapato da esc(): '&' diventa '&amp;'
    const linkEscapato = linkStampa(BUONO).replace(/&/g, '&amp;');
    for (const s of spedite) assertStringIncludes(s.html, `href="${linkEscapato}"`);
  } finally { ripristina(); Deno.env.delete('RESEND_API_KEY'); }
});

Deno.test('il pulsante è nella lingua del buono, lingua per lingua, dentro l’email vera', async () => {
  Deno.env.set('RESEND_API_KEY', 'test');
  Deno.env.delete('EMAIL_AMMINISTRAZIONE');
  const TESTI: Record<string, string> = {
    it: 'Stampa il tuo buono', de: 'Gutschein ausdrucken',
    en: 'Print your voucher', fr: 'Imprimer votre bon',
  };
  const ALTRI: Record<string, string[]> = {
    it: ['Gutschein ausdrucken', 'Print your voucher', 'Imprimer votre bon'],
    de: ['Stampa il tuo buono', 'Print your voucher', 'Imprimer votre bon'],
    en: ['Stampa il tuo buono', 'Gutschein ausdrucken', 'Imprimer votre bon'],
    fr: ['Stampa il tuo buono', 'Gutschein ausdrucken', 'Print your voucher'],
  };
  for (const lingua of ['it', 'de', 'en', 'fr']) {
    const { spedite, ripristina } = conFetchFinto();
    try {
      await inviaBuonoEmesso({ ...BUONO, lingua, destinatario_email: 'anna@example.com' });
      assertStringIncludes(spedite[0].html, TESTI[lingua]);
      for (const estraneo of ALTRI[lingua]) {
        assertEquals(spedite[0].html.includes(estraneo), false,
          `l’email in ${lingua} non deve contenere il testo del pulsante in un’altra lingua ("${estraneo}")`);
      }
    } finally { ripristina(); }
  }
  Deno.env.delete('RESEND_API_KEY');
});

Deno.test('il riepilogo d’acquisto non porta il pulsante di stampa: non è il buono, e non ha il codice', () => {
  const html = ricevutaEmailHTML(BUONO);
  assertEquals(html.includes(linkStampa(BUONO)), false);
  assertEquals(html.includes('/buoni/stampa/'), false);
});

Deno.test('l’avviso all’amministrazione non porta il pulsante di stampa', async () => {
  Deno.env.set('RESEND_API_KEY', 'test');
  Deno.env.set('EMAIL_AMMINISTRAZIONE', 'amministrazione@termeleonardo.com');
  const { spedite, ripristina } = conFetchFinto();
  try {
    await avvisaAmministrazione(BUONO);
    assertEquals(spedite.length, 1);
    assertEquals(spedite[0].html.includes(linkStampa(BUONO)), false);
  } finally { ripristina(); Deno.env.delete('RESEND_API_KEY'); Deno.env.delete('EMAIL_AMMINISTRAZIONE'); }
});

/* ============================================================
   Il QR accanto al codice. In portineria c'è un lettore di codici QR, ma
   chi si presenta al banco tipicamente ha solo il telefono con l'email,
   non il foglio stampato — senza un QR anche nell'email la reception
   finisce comunque a digitare il codice a mano. L'immagine viene da
   ?a=qr (vedi index.ts e qr.js): qui si presidia solo che l'email la
   richiami all'indirizzo giusto, accanto al codice in chiaro (che resta,
   non lo sostituisce), con una riga che spiega a cosa serve — e MAI su
   una bozza, che non ha ancora un codice da far leggere. */

Deno.test('linkQr costruisce l’indirizzo dell’immagine QR con il codice codificato nell’URL', () => {
  assertEquals(linkQr('LEO-ACDE-FGHJ'), `${FUNZIONE}?a=qr&codice=LEO-ACDE-FGHJ`);
});

Deno.test('linkQr con un codice assente non esplode: produce comunque un indirizzo valido, con codice vuoto', () => {
  assertEquals(linkQr(null), `${FUNZIONE}?a=qr&codice=`);
  assertEquals(linkQr(undefined), `${FUNZIONE}?a=qr&codice=`);
});

Deno.test('il buono HTML porta il QR accanto al codice, con l’indirizzo giusto (escapato come attributo HTML)', () => {
  const html = buonoEmailHTML(BUONO);
  // l'href/src esce con l'HTML escapato da esc(): '&' diventa '&amp;', come già per linkStampa
  const linkEscapato = linkQr(BUONO.codice).replace(/&/g, '&amp;');
  assertStringIncludes(html, `<img src="${linkEscapato}"`);
  // il codice in chiaro resta, il QR si aggiunge e non lo sostituisce
  assertStringIncludes(html, 'LEO-ACDE-FGHJ');
});

Deno.test('senza codice (bozza) il buono HTML non porta nessun QR: non c’è ancora niente da far leggere', () => {
  const html = buonoEmailHTML({ ...BUONO, codice: null });
  assertEquals(html.includes('a=qr'), false);
  assertEquals(html.includes('<img src="' + FUNZIONE), false);
});

Deno.test('la riga che spiega il QR è nella lingua del buono, lingua per lingua, e non in un’altra', () => {
  const TESTI: Record<string, string> = {
    it: 'Mostri questo codice in reception.', de: 'Zeigen Sie diesen Code an der Rezeption.',
    en: 'Show this code at reception.', fr: 'Présentez ce code à la réception.',
  };
  const ALTRI: Record<string, string[]> = {
    it: ['Zeigen Sie diesen Code', 'Show this code', 'Présentez ce code'],
    de: ['Mostri questo codice', 'Show this code', 'Présentez ce code'],
    en: ['Mostri questo codice', 'Zeigen Sie diesen Code', 'Présentez ce code'],
    fr: ['Mostri questo codice', 'Zeigen Sie diesen Code', 'Show this code'],
  };
  for (const lingua of ['it', 'de', 'en', 'fr']) {
    const html = buonoEmailHTML({ ...BUONO, lingua });
    assertStringIncludes(html, TESTI[lingua]);
    for (const estraneo of ALTRI[lingua]) {
      assertEquals(html.includes(estraneo), false,
        `l’email in ${lingua} non deve contenere la riga del QR di un’altra lingua ("${estraneo}")`);
    }
  }
});

Deno.test('il QR arriva sia all’acquirente sia al destinatario, con lo stesso indirizzo, dentro l’email vera', async () => {
  Deno.env.set('RESEND_API_KEY', 'test');
  Deno.env.delete('EMAIL_AMMINISTRAZIONE');
  const { spedite, ripristina } = conFetchFinto();
  try {
    await inviaBuonoEmesso(BUONO);
    assertEquals(spedite.length, 2);
    const linkEscapato = linkQr(BUONO.codice).replace(/&/g, '&amp;');
    for (const s of spedite) assertStringIncludes(s.html, `<img src="${linkEscapato}"`);
  } finally { ripristina(); Deno.env.delete('RESEND_API_KEY'); }
});

Deno.test('il riepilogo d’acquisto non porta il QR: non è il buono, e non ha il codice spendibile', () => {
  const html = ricevutaEmailHTML(BUONO);
  assertEquals(html.includes('a=qr'), false);
});

Deno.test('l’avviso all’amministrazione non porta il QR: e-mail interna, non quella che riceve il cliente', async () => {
  Deno.env.set('RESEND_API_KEY', 'test');
  Deno.env.set('EMAIL_AMMINISTRAZIONE', 'amministrazione@termeleonardo.com');
  const { spedite, ripristina } = conFetchFinto();
  try {
    await avvisaAmministrazione(BUONO);
    assertEquals(spedite.length, 1);
    assertEquals(spedite[0].html.includes('a=qr'), false);
  } finally { ripristina(); Deno.env.delete('RESEND_API_KEY'); Deno.env.delete('EMAIL_AMMINISTRAZIONE'); }
});

/* ============================================================
   Il pulsante «Prenota online», dentro il buono, sotto «ci chiami o ci
   scriva». Porta al modulo che la specifica §4-bis indica, col codice già
   nell'indirizzo. La REGOLA che sceglie il modulo è in due copie (qui e in
   pagine/buoni/buono.js, per il foglio A4): a confrontarle caso per caso è
   buono.test.ts, che le importa tutte e due — qui si prova quello che
   dipende dall'email, cioè che il pulsante ci sia, sia una tabella e non
   sostituisca il telefono. */
Deno.test('il link porta al modulo giusto, nella lingua del buono, col codice dentro', () => {
  /* BUONO è un buono a importo: si spende su qualunque trattamento */
  assertEquals(linkPrenota(BUONO),
    'https://www.hoteltermeleonardo.com/de/behandlungen?buono=LEO-ACDE-FGHJ');
  assertEquals(linkPrenota({ ...BUONO, tipo: 'servizio', voce_id: 'dayspa_fer',
    descrizione: 'Day Spa infrasettimanale — piscine e grotte', lingua: 'fr' }),
    'https://www.hoteltermeleonardo.com/fr/day-spa?buono=LEO-ACDE-FGHJ');
  assertEquals(linkPrenota({ ...BUONO, tipo: 'servizio', voce_id: 'shiatsu50',
    descrizione: 'Massaggio Shiatsu (50 min)', lingua: 'it' }),
    'https://www.hoteltermeleonardo.com/it/trattamenti?buono=LEO-ACDE-FGHJ');
});

Deno.test('§4-bis nell’email: Day Spa più un massaggio aprono i trattamenti, una richiesta sola', () => {
  const b = { ...BUONO, tipo: 'servizio', voce_id: 'dayspa_fer', lingua: 'it',
    descrizione: '1 × Day Spa infrasettimanale — piscine e grotte\n1 × Massaggio Shiatsu (50 min)' };
  assertEquals(moduloDelBuono(b), 'trattamenti');
  assertStringIncludes(buonoEmailHTML(b), 'https://www.hoteltermeleonardo.com/it/trattamenti?buono=LEO-ACDE-FGHJ');
});

/* I buoni emessi in reception (?a=nuovo) hanno una `descrizione` scritta a
   mano e nessuna `voci`: da due righe in su la regola si fidava del solo
   testo e mandava un ingresso Day Spa sul modulo dei trattamenti. Ora il
   testo decide solo quando l'ha composto il server. Il confronto fra le due
   copie della regola sta in pagine/buoni/buono.test.ts; qui si prova che
   l'email vera porti l'indirizzo giusto. */
Deno.test('buono di reception a più righe: comanda l’id di listino, non il testo scritto a mano', () => {
  const b = { ...BUONO, tipo: 'servizio', voce_id: 'dayspa_fer', lingua: 'de',
    descrizione: 'Ingresso piscine\nOmaggio compleanno' };
  assertEquals(moduloDelBuono(b), 'dayspa');
  assertStringIncludes(buonoEmailHTML(b), 'https://www.hoteltermeleonardo.com/de/day-spa?buono=LEO-ACDE-FGHJ');
  assertEquals(buonoEmailHTML(b).includes('/de/behandlungen'), false);
});

Deno.test('il codice finisce nell’indirizzo passato per encodeURIComponent, non incollato così com’è', () => {
  assertStringIncludes(linkPrenota({ ...BUONO, codice: 'LEO A/B' }), '?buono=LEO%20A%2FB');
});

Deno.test('il pulsante è una tabella, non un <a> con padding: Outlook non regge i bottoni', () => {
  const html = buonoEmailHTML({ ...BUONO, lingua: 'it' });
  /* l'indirizzo non contiene & né virgolette: esc() lo lascia com'è */
  const i = html.indexOf(linkPrenota({ ...BUONO, lingua: 'it' }));
  assert(i > 0, 'il link del pulsante non compare nel buono');
  /* la cella colorata che fa da bottone sta appena sopra il link */
  assertStringIncludes(html.slice(Math.max(0, i - 400), i), '<table');
  assertStringIncludes(html.slice(Math.max(0, i - 400), i), 'background:#1B4D4A');
});

Deno.test('il testo «ci chiami o ci scriva» resta accanto al pulsante, in tutte e quattro le lingue', () => {
  const COME: Record<string, string> = {
    it: 'ci chiami o ci scriva', de: 'Rufen Sie uns an oder schreiben Sie uns',
    en: 'call or write to us', fr: 'appelez-nous ou écrivez-nous',
  };
  for (const lingua of ['it', 'de', 'en', 'fr']) {
    const html = buonoEmailHTML({ ...BUONO, lingua });
    assertStringIncludes(html, COME[lingua], `chi preferisce il telefono non lo trova più in ${lingua}`);
    assertStringIncludes(html, linkPrenota({ ...BUONO, lingua }).split('?')[0]);
  }
});

Deno.test('il pulsante di prenotazione è nella lingua del buono e non porta testo di un’altra lingua', () => {
  const TESTI: Record<string, string> = {
    it: 'Prenota online', de: 'Online reservieren',
    en: 'Book online', fr: 'Réserver en ligne',
  };
  for (const lingua of ['it', 'de', 'en', 'fr']) {
    const html = buonoEmailHTML({ ...BUONO, lingua });
    assertStringIncludes(html, TESTI[lingua]);
    for (const altra of ['it', 'de', 'en', 'fr']) {
      if (altra === lingua) continue;
      assertEquals(html.includes(TESTI[altra]), false,
        `il buono in ${lingua} non deve contenere il pulsante in ${altra} ("${TESTI[altra]}")`);
    }
  }
});

Deno.test('senza codice non c’è pulsante: una bozza aprirebbe un ?buono= vuoto, cioè il modulo semplice', () => {
  const html = buonoEmailHTML({ ...BUONO, codice: null });
  assertEquals(html.includes('Prenota online'), false);
  assertEquals(html.includes('?buono='), false);
});

Deno.test('il pulsante di prenotazione arriva sia all’acquirente sia al destinatario', async () => {
  Deno.env.set('RESEND_API_KEY', 'test');
  Deno.env.delete('EMAIL_AMMINISTRAZIONE');
  const { spedite, ripristina } = conFetchFinto();
  try {
    await inviaBuonoEmesso(BUONO);
    assertEquals(spedite.length, 2);
    const linkEscapato = linkPrenota(BUONO).replace(/&/g, '&amp;');
    for (const s of spedite) assertStringIncludes(s.html, `href="${linkEscapato}"`);
  } finally { ripristina(); Deno.env.delete('RESEND_API_KEY'); }
});

Deno.test('il riepilogo d’acquisto non porta il pulsante di prenotazione: non è il buono', () => {
  const html = ricevutaEmailHTML(BUONO);
  assertEquals(html.includes('?buono='), false);
  assertEquals(html.includes('Online reservieren'), false);
});

/* ============================================================
   IL BUONO CON TRATTAMENTI ARRIVA ANCHE ALLA SPA.

   Il predicato esiste gia' e decide una vista del back office:
   buonoDellaSpa() dice che un buono a IMPORTO non e' della spa (e' denaro,
   si spende su tutto), che una voce del listino si', e che un buono
   scritto a mano in reception si' — perche' non si sa classificare, e
   nasconderlo impedirebbe di riscuoterlo al banco della spa.

   Qui lo si RIUSA per la posta. Riscrivere la regola vorrebbe dire due
   risposte diverse alla stessa domanda: chi lo vede sullo schermo e chi lo
   riceve per email.

   voce_id qui sotto e' 'antistress45', una voce vera del LISTINO
   (supabase/functions/buoni/acquista.ts) della famiglia 'antistress': un
   identificativo inventato farebbe rispondere false a buonoDellaSpa() e la
   prova passerebbe per il motivo sbagliato — cioe' non proverebbe niente.
   ============================================================ */

/* piccolo aiuto: imposta EMAIL_SPA e restituisce come rimetterla esattamente
   com'era, non solo come cancellarla — cosi' la prova non presume di essere
   la sola a interessarsi di questa variabile nel processo. `valore` null
   vale "assente": cancella invece di settare. */
function conEmailSpa(valore: string | null) {
  const precedente = Deno.env.get('EMAIL_SPA');
  if (valore === null) Deno.env.delete('EMAIL_SPA'); else Deno.env.set('EMAIL_SPA', valore);
  return () => {
    if (precedente === undefined) Deno.env.delete('EMAIL_SPA'); else Deno.env.set('EMAIL_SPA', precedente);
  };
}

Deno.test('un buono con un trattamento va in copia alla spa', () => {
  const ripristina = conEmailSpa('spa@esempio.test');
  try {
    const c = destinatariInCopia({ tipo: 'servizio', voce_id: 'antistress45' });
    assert(c.includes('spa@esempio.test'), `copia a: ${JSON.stringify(c)}`);
  } finally { ripristina(); }
});

Deno.test('un buono a importo no', () => {
  const ripristina = conEmailSpa('spa@esempio.test');
  try {
    assertEquals(destinatariInCopia({ tipo: 'valore', valore: 200 }), []);
  } finally { ripristina(); }
});

/* Senza la variabile non si inventa un destinatario: la copia non parte, e
   si scrive nel registro. */
Deno.test('senza EMAIL_SPA non arriva a nessuno', () => {
  const ripristina = conEmailSpa(null);
  try {
    assertEquals(destinatariInCopia({ tipo: 'servizio', voce_id: 'antistress45' }), []);
  } finally { ripristina(); }
});

/* La copia e' un cc sullo STESSO invio, non un secondo invio: con due email
   separate ne' l'amministrazione ne' la spa saprebbero che l'altra l'ha
   ricevuta. Si prova sull'invio vero (avvisaAmministrazione), non solo
   sulla funzione pura qui sopra: e' la sola prova che la funzione sia
   davvero collegata a `invia`. */
Deno.test('l’avviso all’amministrazione mette la spa in copia quando il buono è un trattamento', async () => {
  Deno.env.set('RESEND_API_KEY', 'test');
  Deno.env.set('EMAIL_AMMINISTRAZIONE', 'amministrazione@termeleonardo.com');
  Deno.env.set('EMAIL_SPA', 'spa@esempio.test');
  const { spedite, ripristina } = conFetchFinto();
  try {
    const esito = await avvisaAmministrazione({ ...BUONO,
      tipo: 'servizio', voce_id: 'antistress45', pagamento: 'stripe' });
    assertEquals(esito, true);
    assertEquals(spedite.length, 1);
    assertEquals(spedite[0].to[0], 'amministrazione@termeleonardo.com');
    assertEquals((spedite[0] as unknown as { cc?: string[] }).cc, ['spa@esempio.test']);
  } finally {
    ripristina();
    Deno.env.delete('RESEND_API_KEY'); Deno.env.delete('EMAIL_AMMINISTRAZIONE');
    Deno.env.delete('EMAIL_SPA');
  }
});

Deno.test('l’avviso all’amministrazione non mette nessuno in copia per un buono a importo', async () => {
  Deno.env.set('RESEND_API_KEY', 'test');
  Deno.env.set('EMAIL_AMMINISTRAZIONE', 'amministrazione@termeleonardo.com');
  Deno.env.set('EMAIL_SPA', 'spa@esempio.test');
  const { spedite, ripristina } = conFetchFinto();
  try {
    await avvisaAmministrazione({ ...BUONO, tipo: 'valore' });
    assertEquals(spedite.length, 1);
    assertEquals((spedite[0] as unknown as { cc?: string[] }).cc, undefined);
  } finally {
    ripristina();
    Deno.env.delete('RESEND_API_KEY'); Deno.env.delete('EMAIL_AMMINISTRAZIONE');
    Deno.env.delete('EMAIL_SPA');
  }
});

/* Chi riceve il buono vero (acquirente e destinatario) non deve MAI vedere
   un indirizzo interno in copia: la spa entra in copia solo sull'avviso
   interno, mai sull'email che arriva all'ospite. */
Deno.test('l’ospite non riceve mai la spa in copia', async () => {
  Deno.env.set('RESEND_API_KEY', 'test');
  Deno.env.set('EMAIL_SPA', 'spa@esempio.test');
  Deno.env.delete('EMAIL_AMMINISTRAZIONE');
  const { spedite, ripristina } = conFetchFinto();
  try {
    await inviaBuonoEmesso({ ...BUONO, tipo: 'servizio', voce_id: 'antistress45' });
    assertEquals(spedite.length, 2);
    for (const s of spedite) {
      assertEquals((s as unknown as { cc?: string[] }).cc, undefined);
    }
  } finally {
    ripristina();
    Deno.env.delete('RESEND_API_KEY'); Deno.env.delete('EMAIL_SPA');
  }
});

/* ============================================================
   IL BUONO IN ALLEGATO, IN PDF.

   «Il buono deve essere un PDF sulla carta intestata» (la proprieta',
   5 settembre 2026). Il foglio lo disegna pdf-buono.ts; qui si presidia
   il trasporto: che l'allegato entri nel corpo che va a Resend, col nome
   giusto, e SOLO nelle due email che portano il buono vero — il riepilogo
   d'acquisto e l'avviso interno non sono il buono e non lo ricevono.

   Il PDF non si genera qui dentro (sarebbe provare pdf-buono.ts una
   seconda volta, e lento): bastano dei byte finti, perche' quello che si
   misura e' la codifica e il punto in cui l'allegato viene attaccato.
   ============================================================ */

const FINTO_PDF = new TextEncoder().encode('%PDF-1.7 finto');

Deno.test('allegatoPdf nomina il file col codice del buono e ne porta il contenuto in base64', () => {
  const a = allegatoPdf(BUONO, new Uint8Array([0x25, 0x50, 0x44, 0x46]));
  assertEquals(a.filename, 'Buono-Regalo-LEO-ACDE-FGHJ.pdf');
  assertEquals(a.content, 'JVBERg==');
});

/* Le due copie di nomeFilePdf — questa e quella di pdf-buono.ts — devono
   dare lo stesso nome allo stesso buono: e' lo stesso file, chiesto per due
   strade (l'allegato dell'email e il download di ?a=pdf), e due nomi
   diversi per lo stesso foglio confonderebbero chi se ne ritrova due nella
   cartella dei download. La copia esiste per forza (il perche' sta sopra
   la funzione, in email-buono.ts): questa prova e' il suo presidio. */
Deno.test('il nome del file è lo stesso dell’originale in pdf-buono.ts, caso per caso', () => {
  const casi: { codice: string | null }[] = [
    { codice: 'LEO-ACDE-FGHJ' }, { codice: null }, { codice: '' },
    { codice: '  LEO-ACDE-FGHJ  ' }, { codice: 'LEO/ACDE FGHJ' },
  ];
  for (const c of casi) {
    for (const bozza of [true, false, undefined]) {
      assertEquals(nomeFileEmail(c, bozza), nomeFileFoglio(c, bozza),
        `codice ${JSON.stringify(c.codice)}, bozza ${bozza}`);
    }
  }
});

Deno.test('allegatoPdf su una bozza non nomina un codice che non c’è', () => {
  assertEquals(allegatoPdf(BUONO, FINTO_PDF, true).filename, 'Buono-Regalo-BOZZA.pdf');
  assertEquals(allegatoPdf({ ...BUONO, codice: null }, FINTO_PDF).filename, 'Buono-Regalo-BOZZA.pdf');
});

/* Un buono vero pesa un centinaio di migliaia di byte: passarli tutti in
   un colpo a String.fromCharCode.apply fa saltare lo stack (RangeError) e
   l'email partirebbe senza allegato, o non partirebbe affatto. Si codifica
   a blocchi: questa prova lo verifica su un byte array piu' lungo di un
   blocco, byte per byte, non sulla sola lunghezza. */
Deno.test('un PDF vero, più lungo di un blocco, si codifica tutto e senza perdere byte', () => {
  const grande = new Uint8Array(200_000);
  for (let i = 0; i < grande.length; i++) grande[i] = i % 256;
  const { content } = allegatoPdf(BUONO, grande);
  const tornati = atob(content);
  assertEquals(tornati.length, grande.length);
  for (const i of [0, 1, 255, 256, 32_767, 32_768, 65_536, 199_999]) {
    assertEquals(tornati.charCodeAt(i), grande[i], `byte ${i}`);
  }
});

Deno.test('il buono emesso parte col PDF in allegato, ad acquirente e destinatario', async () => {
  Deno.env.set('RESEND_API_KEY', 'test');
  Deno.env.delete('EMAIL_AMMINISTRAZIONE');
  const { spedite, ripristina } = conFetchFinto();
  try {
    await inviaBuonoEmesso(BUONO, FINTO_PDF);
    assertEquals(spedite.length, 2);
    for (const s of spedite) {
      assertEquals(s.attachments?.length, 1);
      assertEquals(s.attachments?.[0].filename, 'Buono-Regalo-LEO-ACDE-FGHJ.pdf');
      assert((s.attachments?.[0].content || '').length > 0, 'allegato vuoto');
      assertEquals(atob(s.attachments![0].content), '%PDF-1.7 finto');
    }
  } finally { ripristina(); Deno.env.delete('RESEND_API_KEY'); }
});

/* Il foglio si genera dal server e puo' non riuscire (la carta intestata,
   la fotografia, un carattere strano in una dedica): l'email parte lo
   stesso, senza allegato — un buono che arriva senza il PDF e' un buono,
   un buono che non arriva no. */
Deno.test('senza PDF l’email parte comunque, e il campo attachments non c’è proprio', async () => {
  Deno.env.set('RESEND_API_KEY', 'test');
  Deno.env.delete('EMAIL_AMMINISTRAZIONE');
  const { spedite, ripristina } = conFetchFinto();
  try {
    const esiti = await inviaBuonoEmesso(BUONO);
    assertEquals(esiti.acquirente, true);
    assertEquals(spedite.length, 2);
    for (const s of spedite) assertEquals(s.attachments, undefined);
  } finally { ripristina(); Deno.env.delete('RESEND_API_KEY'); }
});

Deno.test('il riepilogo d’acquisto e l’avviso interno non portano l’allegato: non sono il buono', async () => {
  Deno.env.set('RESEND_API_KEY', 'test');
  Deno.env.set('EMAIL_AMMINISTRAZIONE', 'amministrazione@termeleonardo.com');
  const { spedite, ripristina } = conFetchFinto();
  try {
    await inviaBuonoEmesso({ ...BUONO, ricevuta_email: 'studio@example.com' }, FINTO_PDF);
    assertEquals(spedite.map((s) => s.to[0]), ['max@example.com', 'anna@example.com',
      'studio@example.com', 'amministrazione@termeleonardo.com']);
    assertEquals(spedite[2].attachments, undefined, 'il riepilogo d’acquisto');
    assertEquals(spedite[3].attachments, undefined, 'l’avviso all’amministrazione');
  } finally {
    ripristina();
    Deno.env.delete('RESEND_API_KEY'); Deno.env.delete('EMAIL_AMMINISTRAZIONE');
  }
});

/* ============================================================
   MANDARE IL BUONO A UNO SOLO DEI DUE — il pulsante «manda» del back
   office (?a=manda in index.ts). Serve quando l'ospite dice che non gli e'
   arrivato niente, o quando l'indirizzo si corregge dopo l'emissione:
   inviaBuonoEmesso spedirebbe a tutti e due e riscriverebbe anche l'avviso
   all'amministrazione, che qui non c'entra.
   ============================================================ */

Deno.test('inviaBuonoA manda solo all’acquirente, col suo oggetto e il PDF in allegato', async () => {
  Deno.env.set('RESEND_API_KEY', 'test');
  const { spedite, ripristina } = conFetchFinto();
  try {
    const r = await inviaBuonoA(BUONO, 'acquirente', FINTO_PDF);
    assertEquals(r, { ok: true, a: 'max@example.com' });
    assertEquals(spedite.length, 1);
    assertEquals(spedite[0].to, ['max@example.com']);
    assertStringIncludes(spedite[0].subject, 'BR-2026-0042');
    assertStringIncludes(spedite[0].html, 'Max Muster');
    assertStringIncludes(spedite[0].html, 'LEO-ACDE-FGHJ');
    assertEquals(spedite[0].attachments?.[0].filename, 'Buono-Regalo-LEO-ACDE-FGHJ.pdf');
  } finally { ripristina(); Deno.env.delete('RESEND_API_KEY'); }
});

Deno.test('inviaBuonoA al destinatario usa l’altro indirizzo, l’altro oggetto e l’altro corpo', async () => {
  Deno.env.set('RESEND_API_KEY', 'test');
  const { spedite, ripristina } = conFetchFinto();
  try {
    const r = await inviaBuonoA({ ...BUONO, lingua: 'it' }, 'destinatario', null);
    assertEquals(r, { ok: true, a: 'anna@example.com' });
    assertEquals(spedite.length, 1);
    assertEquals(spedite[0].subject, 'Il suo Buono Regalo — Hotel Terme Leonardo');
    assertStringIncludes(spedite[0].html, 'Gentile Anna,');
    assertStringIncludes(spedite[0].html, 'qualcuno ha pensato a lei');
    assertEquals(spedite[0].attachments, undefined);
  } finally { ripristina(); Deno.env.delete('RESEND_API_KEY'); }
});

/* Il back office deve poter dire «non c'e' nessun indirizzo» invece di
   «non e' partita»: sono due guai diversi, e si rimediano in due modi
   diversi (scrivere l'indirizzo, o riprovare). */
Deno.test('inviaBuonoA senza indirizzo non manda niente e lo dice', async () => {
  Deno.env.set('RESEND_API_KEY', 'test');
  const { spedite, ripristina } = conFetchFinto();
  try {
    const r = await inviaBuonoA({ ...BUONO, destinatario_email: null }, 'destinatario', FINTO_PDF);
    assertEquals(r, { ok: false, a: null });
    assertEquals(spedite.length, 0);
  } finally { ripristina(); Deno.env.delete('RESEND_API_KEY'); }
});

/* La riga sotto il pulsante di stampa diceva «un foglio pronto da
   stampare»: adesso il foglio e' in allegato, e chi legge deve sapere che
   ce l'ha gia' — altrimenti clicca per andare a prendere quello che ha
   sotto gli occhi. In tutte e quattro le lingue, come ogni testo qui. */
Deno.test('l’email dice che il buono è in allegato, nella lingua del buono', async () => {
  Deno.env.set('RESEND_API_KEY', 'test');
  Deno.env.delete('EMAIL_AMMINISTRAZIONE');
  const TESTI: Record<string, string> = {
    it: 'Il buono è in allegato a questa email, in PDF: lo apra e lo stampi, o lo inoltri a chi lo riceverà.',
    de: 'Der Gutschein liegt dieser E-Mail als PDF bei: öffnen und ausdrucken, oder an den Beschenkten weiterleiten.',
    en: 'The voucher is attached to this email as a PDF: open and print it, or forward it to the recipient.',
    fr: 'Le bon est joint à cet e-mail en PDF : ouvrez-le et imprimez-le, ou transférez-le à son destinataire.',
  };
  for (const lingua of ['it', 'de', 'en', 'fr']) {
    const { spedite, ripristina } = conFetchFinto();
    try {
      await inviaBuonoEmesso({ ...BUONO, lingua }, FINTO_PDF);
      /* esc() trasforma le virgolette, non le lettere accentate: il testo
         si ritrova tale e quale */
      assertStringIncludes(spedite[0].html, TESTI[lingua]);
      assertEquals(spedite[0].html.includes('Un foglio pronto da stampare'), false,
        'la vecchia riga, quella di quando il foglio non era in allegato');
    } finally { ripristina(); }
  }
  Deno.env.delete('RESEND_API_KEY');
});
