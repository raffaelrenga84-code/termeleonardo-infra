/* Test del modulo email: il buono in HTML e le tre spedizioni
   (acquirente, destinatario, amministrazione) via Resend. */
import { assertEquals, assertStringIncludes } from 'jsr:@std/assert';
import { avvisaAmministrazione, buonoEmailHTML, fotoBuono, inviaBuonoEmesso, ricevutaEmailHTML, statoConsegna } from './email-buono.ts';

const IMG = 'https://arrivo-terme-leonardo.vercel.app/buoni/img';

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

/* piccolo aiuto: intercetta fetch e raccoglie i destinatari */
function conFetchFinto() {
  const spedite: { to: string[]; subject: string; html: string }[] = [];
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

Deno.test('la foto segue il tipo di buono', () => {
  assertEquals(fotoBuono({ tipo: 'valore' }), `${IMG}/valore.jpg`);
  assertEquals(fotoBuono({ tipo: 'servizio', voce_id: 'dayspa_fer' }), `${IMG}/dayspa.jpg`);
  assertEquals(fotoBuono({ tipo: 'servizio', voce_id: 'dayspa_pom' }), `${IMG}/dayspa.jpg`);
  assertEquals(fotoBuono({ tipo: 'servizio', voce_id: 'relax25' }), `${IMG}/trattamenti.jpg`);
  assertEquals(fotoBuono({ tipo: 'servizio', voce_id: null }), `${IMG}/valore.jpg`);
  assertEquals(fotoBuono({ tipo: 'servizio', voce_id: 'altro' }), `${IMG}/valore.jpg`);
});

Deno.test('il buono HTML contiene la foto del suo tipo', () => {
  const html = buonoEmailHTML({ ...BUONO, tipo: 'servizio', voce_id: 'dayspa_fer' });
  assertStringIncludes(html, `${IMG}/dayspa.jpg`);
  const html2 = buonoEmailHTML(BUONO);            // BUONO è tipo 'valore'
  assertStringIncludes(html2, `${IMG}/valore.jpg`);
});

/* le categorie sono quelle del back office (categoriaBuono): l'email e
   la stampa devono mostrare la stessa foto per lo stesso buono */
Deno.test('viso e corpo sono trattamenti; una voce sconosciuta ricade sul panorama', () => {
  assertEquals(fotoBuono({ tipo: 'servizio', voce_id: 'visofango25' }), `${IMG}/trattamenti.jpg`);
  assertEquals(fotoBuono({ tipo: 'servizio', voce_id: 'scrubmar40' }), `${IMG}/trattamenti.jpg`);
  assertEquals(fotoBuono({ tipo: 'servizio', voce_id: 'progCoccola' }), `${IMG}/trattamenti.jpg`);
  assertEquals(fotoBuono({ tipo: 'servizio', voce_id: 'xyz123' }), `${IMG}/valore.jpg`);
});

/* Gmail e Outlook scartano l'SVG: nel buono spedito il logo dev'essere
   un'immagine raster, altrimenti al cliente arriva un buco bianco */
Deno.test('nell’email il logo è un PNG, mai un SVG', () => {
  const html = buonoEmailHTML(BUONO);
  assertStringIncludes(html, `${IMG}/logo.png`);
  assertEquals(html.includes('logo.svg'), false);
});

/* Il buono spedito e il foglio stampato devono dire le stesse cose:
   chi compra online non parla con la reception, ed è l'unico che non
   verrebbe mai a sapere che un ingresso vale per una persona. */
Deno.test('l’email porta la nota su persone e prenotazione, nella sua lingua', () => {
  assertStringIncludes(buonoEmailHTML({ ...BUONO, lingua: 'it' }),
    'Ogni ingresso o trattamento vale per una persona: potete venire insieme o in momenti diversi, come preferite');
  assertStringIncludes(buonoEmailHTML({ ...BUONO, lingua: 'de' }),
    'Jeder Eintritt und jede Anwendung gilt für eine Person: Sie können gemeinsam kommen oder zu verschiedenen Zeiten, ganz wie Sie möchten');
  assertStringIncludes(buonoEmailHTML({ ...BUONO, lingua: 'en' }),
    'Each admission or treatment is for one person: you can come together or at different times, as you prefer');
  assertStringIncludes(buonoEmailHTML({ ...BUONO, lingua: 'fr' }),
    'Chaque entrée ou soin vaut pour une personne : vous pouvez venir ensemble ou à des moments différents, comme vous préférez');
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
