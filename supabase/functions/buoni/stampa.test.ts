import { assertEquals } from 'jsr:@std/assert';
import { datiStampa } from './stampa.ts';

const ORA = new Date('2026-08-14T10:00:00Z');

/* una riga come la restituirebbe davvero il database: porta anche i campi
   che datiStampa NON deve mai far uscire, cosi' il test qui sotto verifica
   il filtro vero e non solo che la funzione "sembri" corretta guardando
   una riga già ripulita a mano */
const RIGA: Record<string, unknown> = {
  codice: 'LEO-ACDE-FGHJ', tipo: 'servizio', voce_id: 'dayspa_fer',
  descrizione: 'Day Spa infrasettimanale — piscine e grotte', lingua: 'de',
  sottotitolo: null, destinatario: 'Anna', dedica: 'Alles Gute', acquirente: 'Max',
  numero: 'BR-2026-0042', scade_il: '2027-08-14', stato: 'pagato',
  // campi che non devono mai uscire da datiStampa, qualunque sia la scelta
  // di select() in index.ts: se domani qualcuno la allarga a '*' per
  // pigrizia, questo test se ne accorge lo stesso
  acquirente_email: 'max@example.com', acquirente_tel: '+49 170 1234567',
  destinatario_email: 'anna@example.com', pagamento: 'stripe',
  pagamento_rif: 'pi_12345', pagato_da: 'Mario (reception)', creato_da: 'sito',
  riscosso_da: 'Giulia', riscosso_note: 'un ripensamento', note: 'nota interna',
  stripe_sessione: 'cs_test_1',
};

Deno.test('un codice inesistente: solo "non trovato", nient\'altro', () => {
  assertEquals(datiStampa(null, ORA), { valido: false, motivo: 'non trovato' });
});

Deno.test('un buono pagato e non scaduto è stampabile, con solo i campi che servono al foglio', () => {
  const esito = datiStampa(RIGA, ORA);
  assertEquals(esito, {
    valido: true,
    buono: {
      codice: 'LEO-ACDE-FGHJ', tipo: 'servizio', voce_id: 'dayspa_fer',
      descrizione: 'Day Spa infrasettimanale — piscine e grotte', lingua: 'de',
      sottotitolo: null, destinatario: 'Anna', dedica: 'Alles Gute', acquirente: 'Max',
      numero: 'BR-2026-0042', scade_il: '2027-08-14',
      /* RIGA (qui sopra) non porta scade_il_base né prorogato: sono i buoni
         emessi prima di questa modifica. Non si inventa nulla, si ripiega
         su null/false, come fa già il resto della funzione con ?? */
      scade_il_base: null, prorogato: false,
      stato: 'pagato',
    },
  });
});

Deno.test('niente email, telefono, dati di pagamento o note interne — comunque sia la riga del database', () => {
  const testo = JSON.stringify(datiStampa(RIGA, ORA));
  for (const vietato of [
    'max@example.com', '+49 170', 'anna@example.com', 'stripe',
    'pi_12345', 'Mario', 'reception', 'sito', 'Giulia', 'ripensamento',
    'nota interna', 'cs_test_1',
  ]) {
    assertEquals(testo.includes(vietato), false, `"${vietato}" non deve uscire da datiStampa`);
  }
});

Deno.test('in attesa di pagamento: non ha ancora un codice spendibile, non si stampa', () => {
  assertEquals(datiStampa({ ...RIGA, stato: 'attesa' }, ORA), { valido: false, stato: 'attesa' });
});

Deno.test('annullato: non si stampa come se fosse valido', () => {
  assertEquals(datiStampa({ ...RIGA, stato: 'annullato' }, ORA), { valido: false, stato: 'annullato' });
});

Deno.test('già riscosso: non si stampa una seconda volta come se fosse ancora da usare', () => {
  assertEquals(datiStampa({ ...RIGA, stato: 'riscosso' }, ORA), { valido: false, stato: 'riscosso' });
});

Deno.test('pagato ma oltre la scadenza: si dice "scaduto", non "pagato"', () => {
  assertEquals(datiStampa({ ...RIGA, scade_il: '2025-01-01' }, ORA), { valido: false, stato: 'scaduto' });
});

Deno.test('scade lo stesso giorno: valido fino a fine giornata, come fa ?a=verifica', () => {
  const seraStessoGiorno = new Date('2026-08-14T20:00:00Z');
  assertEquals(datiStampa({ ...RIGA, scade_il: '2026-08-14' }, seraStessoGiorno).valido, true);
});

Deno.test('il giorno dopo la scadenza non è più valido', () => {
  const domani = new Date('2026-08-15T00:00:01Z');
  assertEquals(datiStampa({ ...RIGA, scade_il: '2026-08-14' }, domani), { valido: false, stato: 'scaduto' });
});

Deno.test('un buono pagato senza dedica, sottotitolo o destinatario stampa comunque, con quei campi vuoti', () => {
  const esito = datiStampa({ ...RIGA, destinatario: null, dedica: null, sottotitolo: null }, ORA);
  assertEquals(esito.valido, true);
  if (esito.valido) {
    assertEquals(esito.buono.destinatario, null);
    assertEquals(esito.buono.dedica, null);
    assertEquals(esito.buono.sottotitolo, null);
  }
});

Deno.test('un buono monetario (voce_id null) resta stampabile: non è un caso a parte', () => {
  const esito = datiStampa({ ...RIGA, tipo: 'valore', voce_id: null }, ORA);
  assertEquals(esito.valido, true);
  if (esito.valido) assertEquals(esito.buono.voce_id, null);
});

/* Il punto dove questo modulo fallisce in silenzio: la query di ?a=stampa
   in index.ts legge già scade_il_base e prorogato dalla riga (Task 2), ma
   questo file COSTRUISCE la risposta campo per campo — un elenco chiuso di
   cosa esce. Se i due campi non si aggiungono qui apposta, restano fuori
   per sempre e il foglio A4 non può mai scrivere la spiegazione della
   proroga, anche se tutto il resto (email compresa) funziona. */
Deno.test('un buono prorogato porta scade_il_base e prorogato al foglio di stampa', () => {
  const esito = datiStampa({ ...RIGA, scade_il: '2027-03-13', scade_il_base: '2026-11-30', prorogato: true }, ORA);
  assertEquals(esito.valido, true);
  if (esito.valido) {
    assertEquals(esito.buono.scade_il_base, '2026-11-30');
    assertEquals(esito.buono.prorogato, true);
  }
});

Deno.test('un buono non prorogato porta prorogato false e scade_il_base uguale a scade_il', () => {
  const esito = datiStampa({ ...RIGA, scade_il: '2027-08-14', scade_il_base: '2027-08-14', prorogato: false }, ORA);
  assertEquals(esito.valido, true);
  if (esito.valido) {
    assertEquals(esito.buono.scade_il_base, '2027-08-14');
    assertEquals(esito.buono.prorogato, false);
  }
});
