/* Test della conferma che l'hotel manda all'ospite.
   E' l'unica email che l'ospite legge davvero: se sbaglia lingua, orario o
   non dice come disdire, il lavoro fatto prima non serve a niente. */
import { assert, assertEquals, assertStringIncludes } from 'jsr:@std/assert';
import { confermaHTML, inviaConferma } from './conferma.ts';

const transfer = {
  numero: 'RS-2026-0007',
  tipo: 'transfer',
  nome: 'Klaus Müller',
  email: 'klaus@example.de',
  lingua: 'de',
  dati: {
    quando: '2026-09-10', ora: '14:30', pax: 3, verso: 'arrivo',
    luogo: 'Venezia  aeroporto', volo: 'FR1234', ritorno: true,
  },
};

function intercetta() {
  const spedite: Record<string, unknown>[] = [];
  const orig = globalThis.fetch;
  globalThis.fetch = ((_u: unknown, init?: RequestInit) => {
    spedite.push(JSON.parse(String(init?.body ?? '{}')));
    return Promise.resolve(new Response('{"id":"finto"}', { status: 200 }));
  }) as typeof fetch;
  return { spedite, ripristina: () => { globalThis.fetch = orig; } };
}

Deno.test('la conferma parla la lingua dell ospite', () => {
  assertStringIncludes(confermaHTML(transfer), 'bestätigt');
  assertStringIncludes(confermaHTML({ ...transfer, lingua: 'it' }), 'confermat');
  assertStringIncludes(confermaHTML({ ...transfer, lingua: 'en' }), 'confirmed');
  assertStringIncludes(confermaHTML({ ...transfer, lingua: 'fr' }), 'confirm');
});

Deno.test('la conferma ripete i dati definitivi, non quelli chiesti', () => {
  /* la reception puo' aver cambiato l'orario: l'ospite deve leggere quello
     giusto, altrimenti si presenta all'ora sbagliata */
  const corretto = { ...transfer, dati: { ...transfer.dati, ora: '15:00' } };
  const h = confermaHTML(corretto);
  assertStringIncludes(h, '15:00');
  assert(!h.includes('14:30'), 'non deve restare l’orario chiesto in origine');
  assertStringIncludes(h, '10/09/2026');
  assertStringIncludes(h, 'Venezia  aeroporto');
});

Deno.test('la conferma porta il marchio e come raggiungerci', () => {
  const h = confermaHTML(transfer);
  assertStringIncludes(h, 'logo-nero.png');
  assertStringIncludes(h, '+39 049 9939200');
  assertStringIncludes(h, 'info@termeleonardo.com');
});

Deno.test('il messaggio della reception compare, ripulito dai tag', () => {
  const h = confermaHTML({ ...transfer, messaggio: 'Il prezzo è 85 € <b>a tratta</b>.' });
  assertStringIncludes(h, '85 €');
  assertStringIncludes(h, '&lt;b&gt;');
  assert(!h.includes('<b>a tratta</b>'));
});

Deno.test('senza messaggio della reception la conferma resta pulita', () => {
  const h = confermaHTML(transfer);
  assert(!h.includes('undefined'), 'nessun campo assente deve finire a video');
});

Deno.test('la conferma parte all ospite col numero nell oggetto', async () => {
  Deno.env.set('RESEND_API_KEY', 'finta');
  const i = intercetta();
  try {
    assertEquals(await inviaConferma(transfer), true);
    assertEquals(i.spedite.length, 1);
    const m = i.spedite[0] as Record<string, unknown>;
    assertEquals(m.to, 'klaus@example.de');
    assertStringIncludes(String(m.subject), 'RS-2026-0007');
    /* rispondendo, l'ospite scrive all'hotel: e' la sua via per correggere */
    assertEquals(m.reply_to, 'info@termeleonardo.com');
  } finally { i.ripristina(); }
});

Deno.test('senza chiave Resend la conferma non parte ma non esplode', async () => {
  Deno.env.delete('RESEND_API_KEY');
  const i = intercetta();
  try {
    assertEquals(await inviaConferma(transfer), false);
    assertEquals(i.spedite.length, 0);
  } finally { i.ripristina(); }
});
