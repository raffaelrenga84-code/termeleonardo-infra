/* Test del modulo email: il buono in HTML e le tre spedizioni
   (acquirente, destinatario, amministrazione) via Resend. */
import { assertEquals, assertStringIncludes } from 'jsr:@std/assert';
import { buonoEmailHTML, fotoBuono, inviaBuonoEmesso } from './email-buono.ts';

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
  const spedite: { to: string[]; subject: string }[] = [];
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
