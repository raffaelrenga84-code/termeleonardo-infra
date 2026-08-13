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

Deno.test('l avviso porta il marchio dell hotel', () => {
  /* PNG e non SVG: nelle email l'SVG non si vede */
  assertStringIncludes(richiestaHTML(r),
    'https://arrivo-terme-leonardo.vercel.app/buoni/img/logo.png');
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
