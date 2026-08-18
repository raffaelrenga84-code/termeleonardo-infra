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

/* ============================================================
   La riga "cosa e' cambiato" — decisione della proprieta' del 15 agosto
   2026: l'operatore sceglie se segnalarlo all'ospite (campo del corpo
   `segnala_modifiche`), e compare SOLO se e' vero E ci sono differenze
   vere. Un'email che dice "aveva chiesto X, confermiamo X" e' peggio di
   niente: fa sembrare che qualcuno abbia sbagliato quando nessuno ha
   sbagliato.
   ============================================================ */

Deno.test('senza dati_originali (mai corretta) nessun riquadro, anche con segnala_modifiche vero', () => {
  const h = confermaHTML({ ...transfer, segnala_modifiche: true, dati_originali: null });
  assert(!/aveva chiesto|angefragt|originally requested|demandé initialement/i.test(h));
});

Deno.test('con differenze vere ma segnala_modifiche falso, nessun riquadro', () => {
  const h = confermaHTML({
    ...transfer,
    segnala_modifiche: false,
    dati_originali: { ...transfer.dati, ora: '09:00' },
    dati: { ...transfer.dati, ora: '15:00' },
  });
  assert(!/aveva chiesto|angefragt|originally requested|demandé initialement/i.test(h));
});

Deno.test('con differenze vere e segnala_modifiche assente (non passato), nessun riquadro', () => {
  const h = confermaHTML({
    ...transfer,
    dati_originali: { ...transfer.dati, ora: '09:00' },
    dati: { ...transfer.dati, ora: '15:00' },
  });
  assert(!/aveva chiesto|angefragt|originally requested|demandé initialement/i.test(h));
});

Deno.test('dati_originali uguale a dati e segnala_modifiche vero: nessun riquadro (niente e cambiato davvero)', () => {
  const h = confermaHTML({
    ...transfer,
    segnala_modifiche: true,
    dati_originali: { ...transfer.dati },
    dati: { ...transfer.dati },
  });
  assert(!/aveva chiesto|angefragt|originally requested|demandé initialement/i.test(h));
});

Deno.test('con differenze vere e segnala_modifiche vero, il riquadro compare in italiano con il campo cambiato', () => {
  const h = confermaHTML({
    ...transfer,
    lingua: 'it',
    segnala_modifiche: true,
    dati_originali: { ...transfer.dati, ora: '09:00' },
    dati: { ...transfer.dati, ora: '15:00' },
  });
  /* Dal 18 agosto 2026 l'ora cambiata NON e' piu' nel riquadro in coda con
     l'etichetta «Ora»: sta accanto al campo che la mostra, cioe' «Quando».
     Le due cose che contano — cosa aveva chiesto e cosa gli confermiamo —
     ci sono tutte e due, e adesso sono dove l'ospite guarda. */
  assertStringIncludes(h, 'Quando');
  assertStringIncludes(h, '09:00');
  assertStringIncludes(h, '15:00');
});

Deno.test('il riquadro delle differenze parla la lingua dell ospite, nelle quattro lingue', () => {
  const base = {
    ...transfer,
    segnala_modifiche: true,
    dati_originali: { ...transfer.dati, ora: '09:00' },
    dati: { ...transfer.dati, ora: '15:00' },
  };
  assertStringIncludes(confermaHTML({ ...base, lingua: 'it' }), 'Aveva chiesto');
  assertStringIncludes(confermaHTML({ ...base, lingua: 'de' }), 'Angefragt');
  assertStringIncludes(confermaHTML({ ...base, lingua: 'en' }), 'Originally requested');
  assertStringIncludes(confermaHTML({ ...base, lingua: 'fr' }), 'Demandé initialement');
});

Deno.test('un valore nella differenza con < dentro esce sfuggito, mai come tag vero', () => {
  const h = confermaHTML({
    ...transfer,
    segnala_modifiche: true,
    dati_originali: { ...transfer.dati, volo: 'FR1234<script>alert(1)</script>' },
    dati: { ...transfer.dati, volo: 'FR9999' },
  });
  assert(!h.includes('<script>'), 'il tag non deve comparire crudo nell HTML');
  assertStringIncludes(h, '&lt;script&gt;');
});

/* ---------------- Day Spa ----------------
   Fino al 17 agosto 2026 `dettagli()` non aveva il ramo `dayspa`: la
   conferma partiva col solo riferimento, cioe' diceva all'ospite «Le
   confermiamo quanto organizzato» senza dire COSA. Un ingresso non ha
   un'ora — si entra dalle 9:00 — quindi le righe sono due: il giorno e
   quante persone. */
const ingresso = {
  numero: 'RIC-2026-0006', tipo: 'dayspa',
  nome: 'Anna Verdi', email: 'anna@example.it', lingua: 'it',
  dati: { giorno: '2026-08-22', persone: 3, note: '' },
};

Deno.test('la conferma di un Day Spa dice il giorno e quante persone', () => {
  const h = confermaHTML(ingresso);
  assertStringIncludes(h, '22/08/2026');
  assertStringIncludes(h, 'Persone');
  assertStringIncludes(h, '>3</td>');
});

Deno.test('la conferma di un Day Spa non contiene la parola undefined', () => {
  assert(!confermaHTML(ingresso).includes('undefined'));
  /* nemmeno quando la reception ha svuotato un campo */
  assert(!confermaHTML({ ...ingresso, dati: {} }).includes('undefined'));
});

Deno.test('la conferma di un Day Spa parla le quattro lingue, come gli altri tipi', () => {
  assertStringIncludes(confermaHTML({ ...ingresso, lingua: 'it' }), 'Quando');
  assertStringIncludes(confermaHTML({ ...ingresso, lingua: 'de' }), 'Wann');
  assertStringIncludes(confermaHTML({ ...ingresso, lingua: 'en' }), 'When');
  assertStringIncludes(confermaHTML({ ...ingresso, lingua: 'fr' }), 'Quand');
  assertStringIncludes(confermaHTML({ ...ingresso, lingua: 'de' }), 'Personen');
  assertStringIncludes(confermaHTML({ ...ingresso, lingua: 'en' }), 'People');
  assertStringIncludes(confermaHTML({ ...ingresso, lingua: 'fr' }), 'Personnes');
  /* il giorno resta lo stesso in tutte e quattro: e' un dato, non un testo */
  for (const l of ['it', 'de', 'en', 'fr']) {
    assertStringIncludes(confermaHTML({ ...ingresso, lingua: l }), '22/08/2026');
  }
});

/* la reception puo' aver spostato il giorno o cambiato il numero: vale qui
   come per il transfer, l'ospite deve leggere il dato DEFINITIVO */
Deno.test('la conferma di un Day Spa ripete il giorno definitivo, non quello chiesto', () => {
  const h = confermaHTML({ ...ingresso, dati: { giorno: '2026-08-23', persone: 3 } });
  assertStringIncludes(h, '23/08/2026');
  assert(!h.includes('22/08/2026'), 'non deve restare il giorno chiesto in origine');
});

/* ============================================================
   LA MODIFICA DOVE L'OSPITE GUARDA.

   IL DIFETTO. Fino al 18 agosto 2026 la differenza stava SOLO in coda
   all'email, sotto una didascalia da 12,5 px in grigio chiaro — il testo
   piu' piccolo e piu' pallido della pagina — mentre la tabella dei
   dettagli, piu' in alto, mostrava gia' il valore NUOVO in carattere
   normale. Chi scorreva i dettagli e si fermava li' aveva letto le 15:00 e
   non sapeva di aver chiesto le 9:00.

   Il back office lo faceva gia' bene per l'operatore (avevaChiesto). Il
   trattamento buono ce l'aveva chi modifica; a chi subisce la modifica
   toccava la nota a pie' di pagina.
   ============================================================ */
const cambiata = {
  ...transfer,
  lingua: 'it',
  segnala_modifiche: true,
  dati_originali: { ...transfer.dati, ora: '09:00' },
  dati: { ...transfer.dati, ora: '15:00' },
};

Deno.test('la differenza si vede ACCANTO al campo, non solo in coda', () => {
  const h = confermaHTML(cambiata);
  const riga = h.split('<tr>').find((x) => x.includes('15:00'));
  assert(riga, 'nessuna riga col valore nuovo');
  assert(riga.includes('09:00'), 'il valore vecchio non e accanto a quello nuovo');
});

/* Sbarrato PIU' la parola. Certi programmi di posta buttano via gli stili, e
   c'e' chi i colori li legge male: se cade la linea il testo deve restare
   comprensibile da solo. */
Deno.test('il vecchio valore e sbarrato, e resta chiaro anche senza stili', () => {
  const riga = confermaHTML(cambiata).split('<tr>').find((x) => x.includes('15:00'))!;
  assert(/line-through/.test(riga), 'il vecchio valore non e sbarrato');
  assert(/Aveva chiesto/i.test(riga), 'senza gli stili non si capirebbe piu niente');
});

/* Una differenza su un campo che quel tipo non disegna non ha un posto dove
   stare: senza il riquadro in coda sparirebbe del tutto. */
Deno.test('una differenza su un campo non disegnato finisce nel riquadro in coda', () => {
  const h = confermaHTML({
    ...transfer,
    lingua: 'it',
    segnala_modifiche: true,
    dati_originali: { ...transfer.dati, note: 'due valigie' },
    dati: { ...transfer.dati, note: 'tre valigie' },
  });
  assertStringIncludes(h, 'due valigie');
  assertStringIncludes(h, 'Note');
});

Deno.test('senza la spunta niente compare, nemmeno accanto al campo', () => {
  const h = confermaHTML({ ...cambiata, segnala_modifiche: false });
  assert(!h.includes('09:00'), 'il valore vecchio non doveva comparire');
  assert(!/line-through/.test(h));
});

/* ============================================================
   IL PREZZO DA DARE ALL'AUTISTA.

   Lo conferma la reception, che se lo trova proposto dal listino. Prima
   veniva scritto a mano dentro il messaggio libero, e chi si dimenticava
   mandava una conferma senza prezzo.
   ============================================================ */
Deno.test('il prezzo confermato arriva all ospite, in euro', () => {
  const h = confermaHTML({ ...transfer, lingua: 'it', dati: { ...transfer.dati, prezzo_cent: 13500 } });
  assertStringIncludes(h, '135,00');
  assert(!h.includes('13500'), 'i centesimi non devono uscire cosi come sono');
});

Deno.test('il prezzo dice che si paga all autista, nelle quattro lingue', () => {
  const con = (lingua: string) =>
    confermaHTML({ ...transfer, lingua, dati: { ...transfer.dati, prezzo_cent: 13500 } });
  assert(/autista/i.test(con('it')), 'it');
  assert(/Fahrer/i.test(con('de')), 'de');
  assert(/driver/i.test(con('en')), 'en');
  assert(/chauffeur/i.test(con('fr')), 'fr');
});

/* Senza prezzo non si inventa una riga: «non c'e' un prezzo» e «e' gratis»
   sono due cose diverse. */
Deno.test('senza prezzo non compare nessuna riga di prezzo', () => {
  const h = confermaHTML({ ...transfer, lingua: 'it' });
  assert(!/autista/i.test(h), 'non doveva esserci nessuna riga di prezzo');
});
