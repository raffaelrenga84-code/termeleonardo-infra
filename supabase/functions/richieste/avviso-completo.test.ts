/* ============================================================
   avviso-completo.test.ts — nell'avviso alla reception si legge TUTTO
   quello che l'ospite ha mandato.

   IL DIFETTO, segnalato dalla proprietà: «sulla mail per la reception non
   appare la nota della culla e del cane». Guardando, ne mancavano
   quattro: il cane, la culla, il buono regalo e le spunte di trattamenti
   e transfer. Il cane esisteva dal 21 agosto e in reception non è mai
   arrivato.

   PERCHÉ È SUCCESSO. Le righe della ricevuta all'ospite le costruisce
   dettagli-richiesta.ts, ed è lì che ogni campo nuovo veniva aggiunto.
   L'avviso alla reception invece si costruisce le righe per conto suo, in
   italiano, perché lo legge la casa: due elenchi, e uno è rimasto
   indietro.

   QUESTA PROVA NON GUARDA QUELLE QUATTRO RIGHE. Guarda tutti i campi che
   validaDati() accetta da una richiesta di soggiorno, e pretende che per
   ognuno ci sia una risposta a una domanda sola: «dove si legge?». Chi
   aggiunge un campo nuovo o lo mostra, o lo dichiara interno qui sotto —
   e in tutti e due i casi ci ha pensato. Il prossimo non può più
   scivolare in silenzio. */
import { assert, assertEquals } from 'jsr:@std/assert';
import { validaDati } from './tipi.ts';
import { richiestaHTML } from './email-richiesta.ts';

const OGGI = new Date('2026-08-23T09:00:00Z');

/* una richiesta con DENTRO TUTTO quello che si puo' mandare */
const TUTTO = {
  camera_id: 12,
  variante_id: 3,
  tariffa: 'Miglior Prezzo',
  trattamento: 'Bed & Breakfast',
  prezzo_cent: 46000,
  caparra_cent: 15000,
  adulti: 2,
  bambini: 1,
  cane: true,
  culla: true,
  buono: 'LEO-2026-ABCD',
  interessi: ['trattamenti', 'transfer', 'greenfee', 'maestro'],
  collegata_a: 'RS-2026-0007',
};

/* CAMPI INTERNI: non si stampano, e la ragione sta scritta accanto. Non e'
   un elenco di comodo — togliere una riga da qui vuol dire spiegare
   perche' la reception non deve leggerla. */
const INTERNI: Record<string, string> = {
  camera_id: 'identificativo del catalogo: la reception legge il NOME della camera',
  variante_id: 'identificativo della tariffa nel motore, non un fatto della richiesta',
  nome_camera: 'lo stesso nome gia stampato dalla riga «Camera»',
  valuta: 'sono sempre centesimi di euro: stamparlo sarebbe rumore',
};

/* DOVE SI LEGGE ogni campo che invece si stampa. La chiave e' quella del
   jsonb, il valore e' un pezzo di testo che DEVE comparire nell'avviso. */
const DOVE_SI_LEGGE: Record<string, string> = {
  tariffa: 'Miglior Prezzo',
  /* senza la «&»: nel markup è scritta &amp;, e qui si guarda che il
     trattamento si legga, non come si scrive un'entità HTML */
  trattamento: 'Breakfast',
  prezzo_cent: '460,00',
  caparra_cent: '150,00',
  adulti: '2 adulti',
  bambini: '1 bambino',
  cane: 'Cane al seguito',
  culla: 'Culla',
  buono: 'LEO-2026-ABCD',
  interessi: 'Trattamenti alla spa',
  collegata_a: 'RS-2026-0007',
};

const avviso = () => {
  const v = validaDati('soggiorno', TUTTO, OGGI);
  assertEquals(v.errore, undefined, 'il campione non passa piu la convalida');
  return {
    dati: v.dati!,
    html: richiestaHTML({
      tipo: 'soggiorno', numero: 'RS-2026-0011', nome: 'Mario Rossi',
      email: 'mario@example.com', telefono: '3331234567', lingua: 'it',
      check_in: '2026-08-26', check_out: '2026-08-28', notti: 2, ospiti: 3,
      tipo_camera: 'Junior Suite Abano', pacchetto: 'Miglior Prezzo',
      ...v.dati!,
    } as never),
  };
};

Deno.test('ogni campo mandabile o si legge nell avviso, o e dichiarato interno', () => {
  /* la prova che avrebbe fermato il cane, la culla, il buono e le spunte */
  const { dati } = avviso();
  const senzaRisposta = Object.keys(dati).filter(
    (k) => !(k in DOVE_SI_LEGGE) && !(k in INTERNI),
  );
  assertEquals(
    senzaRisposta,
    [],
    'campi che l ospite puo mandare e per cui nessuno ha detto dove si leggono: ' +
      'o si stampano nell avviso alla reception, o si dichiarano interni in questa prova',
  );
});

Deno.test('e quelli che si leggono si leggono davvero', () => {
  const { html } = avviso();
  for (const [campo, pezzo] of Object.entries(DOVE_SI_LEGGE)) {
    assert(
      html.includes(pezzo),
      `«${campo}» non compare nell avviso alla reception: cercavo «${pezzo}»`,
    );
  }
});

Deno.test('e le quattro righe che mancavano ci sono, con le parole giuste', () => {
  /* le quattro trovate dalla proprieta': cane, culla, buono, spunte. Qui si
     pretende anche il valore, non solo l etichetta — una riga «Cane al
     seguito» vuota non dice niente */
  const { html } = avviso();
  for (const pezzo of ['Cane al seguito', 'Buono regalo', 'Da richiamare per',
    'Trattamenti alla spa', 'Transfer aeroporto', 'Green fee', 'Maestro di golf']) {
    assert(html.includes(pezzo), `manca «${pezzo}»`);
  }
  /* LA CULLA HA DUE RIGHE e servono tutte e due: «Culla — Sì» e' un fatto
     operativo (ai piani devono metterla in camera), «Culla — 30,00 €» e' un
     prezzo. Cercare la sola parola le confondeva, e togliere la prima
     lasciava la prova verde grazie alla seconda. */
  assert(
    /&gt;Culla&lt;\/td&gt;[\s\S]{0,200}?Sì/.test(html.replace(/</g, '&lt;').replace(/>/g, '&gt;')),
    'manca la riga «Culla: Si», quella che dice ai piani di metterla in camera',
  );
  assert(html.includes('Culla'), 'manca del tutto la culla');
});

Deno.test('e chi non ha chiesto niente non legge righe vuote', () => {
  /* una riga «Culla:» senza valore si legge come un dato raccolto, e la
     reception si chiede che cosa voglia dire */
  const v = validaDati('soggiorno', { camera_id: 5, prezzo_cent: 20000 }, OGGI);
  const html = richiestaHTML({
    tipo: 'soggiorno', numero: 'RS-2026-0012', nome: 'Anna Bianchi',
    email: 'anna@example.com', telefono: '3339999999', lingua: 'it',
    check_in: '2026-08-26', check_out: '2026-08-28', notti: 2, ospiti: 2,
    tipo_camera: 'Doppia', ...v.dati!,
  } as never);
  for (const pezzo of ['Cane al seguito', 'Culla', 'Buono regalo', 'Da richiamare per',
    'Si aggiunge alla richiesta']) {
    assert(!html.includes(pezzo), `«${pezzo}» esce anche a chi non ha chiesto niente`);
  }
});
