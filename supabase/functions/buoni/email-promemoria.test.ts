/* Test del promemoria: solo composizione dell'HTML e scelta della lingua.
   Nessuna rete qui — l'invio vero (Resend) si prova a vuoto dopo la
   pubblicazione, mai durante lo sviluppo: vedi il commento in
   email-promemoria.ts sopra inviaEmailPromemoria. */
import { assertEquals, assertStringIncludes } from 'jsr:@std/assert';
import { emailPromemoriaHTML, inviaEmailPromemoria, oggettoPromemoria } from './email-promemoria.ts';

const BUONO = {
  codice: 'LEO-ABC', descrizione: 'Day Spa festivo',
  valore: 45, scade_il: '2026-09-14', destinatario: 'Silvia',
};

Deno.test('il promemoria dice quanto vale, entro quando, e come si prenota', () => {
  const html = emailPromemoriaHTML(BUONO, 'it');
  assertStringIncludes(html, 'LEO-ABC');
  assertStringIncludes(html, '14 settembre 2026');
  assertStringIncludes(html, '+39 049 9939200');
});

Deno.test('nelle quattro lingue, e mai un oggetto vuoto', () => {
  for (const l of ['it', 'de', 'en', 'fr']) {
    const o = oggettoPromemoria(l);
    assertEquals(o.trim().length > 0, true, `oggetto vuoto per ${l}`);
    assertStringIncludes(emailPromemoriaHTML(BUONO, l), 'LEO-ABC');
  }
});

/* La lingua arriva dalla riga del database: resta un valore ESTERNO, mai
   una chiave con cui indicizzare un oggetto direttamente (TESTI[lingua]).
   'toString' è la prova classica: è una proprietà che esiste già su
   qualunque oggetto JavaScript, quindi TESTI['toString'] non è undefined
   se il controllo manca — è com'è già successo cinque volte in questo
   progetto. Un elenco chiuso con .includes() non ci casca. */
Deno.test('una lingua sconosciuta non rompe niente: si ripiega sull italiano', () => {
  assertEquals(oggettoPromemoria('toString'), oggettoPromemoria('it'));
  assertEquals(oggettoPromemoria('xx'), oggettoPromemoria('it'));
});

/* piccolo aiuto: intercetta fetch e raccoglie cosa sarebbe partito verso
   Resend, come già fa email-buono.test.ts — nessuna chiamata vera parte. */
function conFetchFinto() {
  const spedite: { to: string[]; subject: string; html: string }[] = [];
  const orig = globalThis.fetch;
  globalThis.fetch = ((_url: unknown, init?: RequestInit) => {
    spedite.push(JSON.parse(String(init?.body)));
    return Promise.resolve(new Response('{"id":"em_1"}', { status: 200 }));
  }) as typeof fetch;
  return { spedite, ripristina: () => { globalThis.fetch = orig; } };
}

/* Quando l'indirizzo del destinatario manca, daAvvisare (promemoria.ts)
   fa arrivare l'email a chi ha comprato — vedi il commento sopra
   inviaEmailPromemoria. Chi apre la casella in quel caso è l'acquirente,
   non il destinatario: il saluto deve usare il SUO nome, o "Gentile
   Silvia" arriverebbe nella casella di Marco. */
Deno.test('a chi ha comprato (fallback senza indirizzo del destinatario) si saluta con il suo nome, non quello del destinatario', async () => {
  Deno.env.set('RESEND_API_KEY', 'test');
  const { spedite, ripristina } = conFetchFinto();
  try {
    const ok = await inviaEmailPromemoria({
      codice: 'LEO-XYZ', descrizione: 'Buono valore', valore: 50,
      scade_il: '2026-09-14', lingua: 'it',
      destinatario: 'Silvia', destinatario_email: null,
      acquirente: 'Marco', acquirente_email: 'marco@example.com',
    }, 'marco@example.com');
    assertEquals(ok, true);
    assertStringIncludes(spedite[0].html, 'Gentile Marco');
    assertEquals(spedite[0].html.includes('Gentile Silvia'), false);
  } finally { ripristina(); Deno.env.delete('RESEND_API_KEY'); }
});

Deno.test('al destinatario (indirizzo presente) si saluta con il suo nome', async () => {
  Deno.env.set('RESEND_API_KEY', 'test');
  const { spedite, ripristina } = conFetchFinto();
  try {
    await inviaEmailPromemoria({
      codice: 'LEO-XYZ', descrizione: 'Buono valore', valore: 50,
      scade_il: '2026-09-14', lingua: 'it',
      destinatario: 'Silvia', destinatario_email: 'silvia@example.com',
      acquirente: 'Marco', acquirente_email: 'marco@example.com',
    }, 'silvia@example.com');
    assertStringIncludes(spedite[0].html, 'Gentile Silvia');
    assertEquals(spedite[0].html.includes('Gentile Marco'), false);
  } finally { ripristina(); Deno.env.delete('RESEND_API_KEY'); }
});
