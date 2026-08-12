/* Test del modulo email: il buono in HTML e le tre spedizioni
   (acquirente, destinatario, amministrazione) via Resend. */
import { assertEquals, assertStringIncludes } from 'jsr:@std/assert';
import { buonoEmailHTML, inviaBuonoEmesso } from './email-buono.ts';

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
