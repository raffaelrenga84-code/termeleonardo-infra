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

/* ============================================================
   IL RITORNO E L'ORA DEL VOLO NELLA CONFERMA.

   IL DIFETTO. La conferma diceva «Ritorno incluso ✓» e basta: l'ospite non
   rileggeva mai il giorno e l'ora che aveva chiesto per la seconda corsa,
   quindi non aveva modo di accorgersi di un errore prima di trovarsi senza
   taxi.

   E con la navetta l'ora della corsa NON e' l'ora del volo: e' tre ore
   prima. Vedersi confermare «11:30» senza vedere il volo delle 14:30
   sembra uno sbaglio nostro.
   ============================================================ */
Deno.test('il ritorno mostra il suo giorno e la sua ora', () => {
  const h = confermaHTML({
    ...transfer,
    lingua: 'it',
    dati: { ...transfer.dati, ritorno: true, ritorno_quando: '2026-09-17', ritorno_ora: '10:00' },
  });
  assertStringIncludes(h, '17/09/2026');
  assertStringIncludes(h, '10:00');
});

/* Una richiesta vecchia ha solo il booleano: deve continuare a dire che il
   ritorno c'e', anche senza saperne il giorno. */
Deno.test('un ritorno senza giorno resta segnalato lo stesso', () => {
  const h = confermaHTML({
    ...transfer, lingua: 'it', dati: { ...transfer.dati, ritorno: true },
  });
  assertStringIncludes(h, 'Ritorno incluso');
});

Deno.test('senza ritorno non compare nessuna riga di ritorno', () => {
  const h = confermaHTML({ ...transfer, lingua: 'it', dati: { ...transfer.dati, ritorno: false } });
  assert(!h.includes('Ritorno incluso'));
});

Deno.test('l ora del volo si vede accanto a quella della corsa', () => {
  const h = confermaHTML({
    ...transfer,
    lingua: 'it',
    dati: { ...transfer.dati, verso: 'partenza', collettivo: true, ora: '11:30', ora_volo: '14:30' },
  });
  assertStringIncludes(h, '11:30');
  assertStringIncludes(h, '14:30');
});

/* ============================================================
   IL CHECK-IN ONLINE E LA FATTURA.

   IL DIFETTO. vociDettagli() restituiva `[]` per tutti e due: l'ospite
   riceveva «Le confermiamo quanto organizzato. Il dettaglio:» seguito dal
   SOLO numero. Ed e' proprio questa l'email con cui la reception risponde
   sulle persone da aggiungere — l'unica cosa che non poteva mancarci.

   E' lo stesso difetto gia' pagato dal tipo `soggiorno`, che annunciava il
   riepilogo e mostrava il riferimento: un tipo nuovo si dimentica sempre
   da qualche parte.
   ============================================================ */
const arrivo = {
  numero: 'C26/19130', tipo: 'arrivo',
  nome: 'Rossi Marco', email: 'marco@example.it', lingua: 'it',
  dati: {
    ora_arrivo: 'Tra le 15:00 e le 18:00', mezzo: 'Auto',
    attenzioni: ['culla', 'cane'], fanghi_desiderio: 'presto',
    persone_extra: [{ nome: 'Rossi Elena', eta: '12' }],
    persone_confermate: false,
    note: 'Siamo intolleranti al lattosio.',
  },
};

/* IL VALORE ACCANTO ALLA SUA ETICHETTA, e non da qualche parte nell'HTML:
   e' lo stesso presidio di valoreDiRiga() in email-richiesta.test.ts, nato
   perche' tre asserzioni «assertStringIncludes(h, 'auto')» restavano verdi
   grazie a `height:auto` nello stile del logo. La forma della riga qui e'
   quella di riga() in dettagli-richiesta.ts, e la cella del valore puo'
   contenere <strong> e la nota del «aveva chiesto»: la si prende intera. */
function valoreDiRiga(h: string, etichetta: string): string | null {
  const re = new RegExp(
    '<td[^>]*>' + etichetta.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
      '</td>\\s*<td[^>]*>([\\s\\S]*?)</td>',
  );
  const m = re.exec(h);
  return m ? m[1].trim() : null;
}

Deno.test('la conferma di un arrivo dice ora, mezzo, attenzioni, fanghi, persone e note', () => {
  const h = confermaHTML(arrivo);
  assertEquals(valoreDiRiga(h, 'Arrivo previsto'), 'Tra le 15:00 e le 18:00');
  assertEquals(valoreDiRiga(h, 'Come arriva'), 'Auto');
  assertEquals(valoreDiRiga(h, 'Piccole attenzioni'), 'Culla · Cane al seguito');
  assertEquals(valoreDiRiga(h, 'Fanghi'), 'Presto');
  assertEquals(valoreDiRiga(h, 'Persone da aggiungere'), 'Rossi Elena (12)');
  assertEquals(valoreDiRiga(h, 'Note'), 'Siamo intolleranti al lattosio.');
});

/* IL CASO PER CUI QUESTA EMAIL ESISTE: la reception risponde sulle persone
   da aggiungere, e chi legge deve ritrovarci il NOME che aveva scritto. */
Deno.test('il nome di chi si aggiunge arriva all ospite, non solo il conteggio', () => {
  const h = confermaHTML({ ...arrivo, messaggio: 'Per Elena sono 45 € a notte.' });
  assertStringIncludes(h, 'Rossi Elena');
  assertStringIncludes(h, '45 €');
});

Deno.test('la conferma di un arrivo non contiene mai la parola undefined', () => {
  assert(!confermaHTML(arrivo).includes('undefined'));
  /* nemmeno quando i campi facoltativi non ci sono affatto */
  assert(!confermaHTML({ ...arrivo, dati: { ora_arrivo: 'Dopo le 18:00' } }).includes('undefined'));
  assert(!confermaHTML({ ...arrivo, dati: {} }).includes('undefined'));
});

/* Le attenzioni e il desiderio dei fanghi viaggiano come CHIAVI: senza una
   traduzione l'ospite tedesco leggerebbe «culla», e un domani una chiave
   nuova gli farebbe leggere il nome interno del campo. */
Deno.test('la conferma di un arrivo parla le quattro lingue, chiavi comprese', () => {
  const atteso = {
    it: { eti: 'Piccole attenzioni', att: 'Culla · Cane al seguito', fan: 'Presto' },
    de: { eti: 'Kleine Aufmerksamkeiten', att: 'Babybett · Hund dabei', fan: 'Früh' },
    en: { eti: 'Small touches', att: 'Baby cot · Dog coming along', fan: 'Early' },
    fr: { eti: 'Petites attentions', att: 'Lit bébé · Chien accepté', fan: 'Tôt' },
  } as Record<string, { eti: string; att: string; fan: string }>;
  for (const [l, a] of Object.entries(atteso)) {
    const h = confermaHTML({ ...arrivo, lingua: l });
    assertEquals(valoreDiRiga(h, a.eti), a.att, `${l}: le attenzioni non sono tradotte`);
    assertStringIncludes(h, a.fan);
    assert(!h.includes('undefined'), `${l}: c e un undefined a video`);
  }
});

/* Una chiave che questo modulo non conosce (una riga vecchia, o una voce
   aggiunta a tipi.ts e dimenticata qui) SPARISCE: stampare all'ospite il
   nome interno di un campo e' il parente stretto di «undefined». */
Deno.test('una chiave sconosciuta non arriva all ospite come nome tecnico', () => {
  const h = confermaHTML({
    ...arrivo,
    dati: { ...arrivo.dati, attenzioni: ['culla', 'monopattino'], fanghi_desiderio: 'alba' },
  });
  assertEquals(valoreDiRiga(h, 'Piccole attenzioni'), 'Culla');
  assert(!h.includes('monopattino'), 'una chiave sconosciuta e finita nell email dell ospite');
  assert(!h.includes('alba'), 'un desiderio sconosciuto e finito nell email dell ospite');
  assert(!h.includes('Fanghi'), 'la riga dei fanghi compare senza un desiderio da mostrare');
});

const fattura = {
  numero: 'C26/19132', tipo: 'fattura',
  nome: 'Bianchi Mario', email: 'mario@example.it', lingua: 'it',
  dati: {
    ragione: 'Bianchi S.r.l.', indirizzo: 'Via Roma 1, Padova',
    piva: 'IT02042330288', cf: 'BNCMRA80A01G224X', sdi: 'M5UXCR1', pec: 'bianchi@pec.it',
  },
};

/* L'OSPITE E' L'UNICO CHE PUO' ACCORGERSI DI UNA PARTITA IVA SBAGLIATA
   prima che il documento sia emesso: la conferma deve ripetergli quello
   che ci ha dato, non il solo riferimento. */
Deno.test('la conferma di una fattura ripete tutti i dati per fatturare', () => {
  const h = confermaHTML(fattura);
  assertEquals(valoreDiRiga(h, 'Intestazione'), 'Bianchi S.r.l.');
  assertEquals(valoreDiRiga(h, 'Indirizzo'), 'Via Roma 1, Padova');
  assertEquals(valoreDiRiga(h, 'Partita IVA'), 'IT02042330288');
  assertEquals(valoreDiRiga(h, 'Codice fiscale'), 'BNCMRA80A01G224X');
  assertEquals(valoreDiRiga(h, 'Codice SDI'), 'M5UXCR1');
  assertEquals(valoreDiRiga(h, 'PEC'), 'bianchi@pec.it');
});

Deno.test('la conferma di una fattura non contiene mai la parola undefined', () => {
  assert(!confermaHTML(fattura).includes('undefined'));
  /* senza codice fiscale ne PEC: sono facoltativi, e la riga non compare */
  const h = confermaHTML({ ...fattura, dati: { ragione: 'Bianchi S.r.l.', piva: 'IT02042330288' } });
  assert(!h.includes('undefined'));
  assert(!h.includes('Codice fiscale'), 'compare la riga di un codice fiscale che non c e');
});

Deno.test('la conferma di una fattura parla le quattro lingue', () => {
  const etichette: Record<string, string> = {
    it: 'Partita IVA', de: 'USt-IdNr.', en: 'VAT number', fr: 'N° TVA',
  };
  for (const [l, eti] of Object.entries(etichette)) {
    const h = confermaHTML({ ...fattura, lingua: l });
    assertEquals(valoreDiRiga(h, eti), 'IT02042330288', `${l}: la partita IVA non si trova`);
  }
});

/* IL PRESIDIO CHE VALE PER TUTTI I TIPI, non uno per volta. `soggiorno`
   mancava e nessuno se n'era accorto finche' un ospite non ha ricevuto
   un'email vuota; poi e' toccato ad `arrivo` e a `fattura`. Un tipo
   aggiunto domani senza il suo ramo in vociDettagli() fa fallire QUESTA,
   invece di scivolare via fino alla casella di un ospite. */
const CASI_DETTAGLI: Record<string, Record<string, unknown>> = {
  transfer: { quando: '2026-09-10', ora: '14:30', pax: 2, verso: 'arrivo', luogo: 'Venezia  aeroporto' },
  greenfee: { circolo_nome: 'Golf Montecchia', data: '2026-09-10', ora: '09:30', giocatori: 2 },
  maestro: { data: '2026-09-10', ora: '10:00', persone: 2 },
  dayspa: { giorno: '2026-09-10', persone: 2 },
  trattamenti: { giorno: '2026-09-10', fascia: 'mattina', voci: ['Massaggio'] },
  soggiorno: { tipo_camera: 'Junior Suite', trattamento: 'Mezza Pensione', prezzo_cent: 66000 },
  arrivo: arrivo.dati,
  fattura: fattura.dati,
};

Deno.test('nessun tipo riceve una conferma col solo riferimento dentro', () => {
  for (const [tipo, dati] of Object.entries(CASI_DETTAGLI)) {
    const h = confermaHTML({ ...transfer, tipo, dati, lingua: 'it' });
    /* la tabella dei dettagli e' quella che finisce con la riga del
       riferimento: se il tipo non disegna niente, li' dentro c'e' UNA
       riga sola, ed e' esattamente l'email vuota che questo presidio
       impedisce */
    const righe = (h.match(/<tr>\s*<td style="padding:7px 16px 7px 0;/g) || []).length;
    assert(righe >= 2, `il tipo ${tipo} manda una conferma col solo riferimento (${righe} riga)`);
    assert(!h.includes('undefined'), `${tipo}: c e un undefined a video`);
  }
});

Deno.test('la conferma arriva anche alla reception, in copia nascosta', async () => {
  /* IL DIFETTO, segnalato dalla reception: «quando ho avvisato e
     confermato modifiche all'ospite, la reception non ha ricevuto la
     mail». Questa email partiva SOLO all'ospite, e in casa non restava
     traccia di cosa gli fosse stato scritto — l'orario spostato, il
     prezzo confermato, il messaggio libero. Chi risponde al telefono il
     giorno dopo non aveva modo di sapere cosa l'ospite ha in mano.

     COPIA, non secondo invio: e' la stessa email, con lo stesso testo e
     lo stesso numero, quindi non ci sono due versioni che divergono.

     NASCOSTA: all'ospite l'indirizzo interno non serve, e vedersi in
     copia lo farebbe rispondere a tutti. */
  Deno.env.set('RESEND_API_KEY', 'finta');
  const i = intercetta();
  try {
    assertEquals(await inviaConferma(transfer), true);
    assertEquals(i.spedite.length, 1, 'due invii invece di uno: i testi possono divergere');
    const m = i.spedite[0] as Record<string, unknown>;
    assertEquals(m.to, 'klaus@example.de', 'l ospite non e piu il destinatario');
    assertEquals(m.bcc, ['info@termeleonardo.com'], 'la reception non riceve piu la copia');
    assertEquals(m.cc, undefined, 'la copia e visibile all ospite: risponderebbe a tutti');
  } finally { i.ripristina(); }
});
