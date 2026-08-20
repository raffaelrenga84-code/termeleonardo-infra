/* Test di differenze.ts.
   Il confronto va fatto sui VALORI, non sugli oggetti: due elenchi di
   trattamenti con le stesse voci in ordine diverso non sono una modifica,
   e segnalarli farebbe scrivere all'ospite "aveva chiesto X, le confermiamo
   X" — falso. Ogni test qui sotto nomina il cambiamento al codice di
   produzione che lo farebbe fallire. */
import { assert, assertEquals } from 'jsr:@std/assert';
import { differenze, type Differenza } from './differenze.ts';

const transferOriginale = {
  quando: '2026-08-15', ora: '14:30', pax: 2, verso: 'arrivo',
  luogo: 'Venezia  aeroporto', volo: 'FR1234', ritorno: false, note: '',
};

Deno.test('nessuna differenza fra due dati identici', () => {
  const d = differenze(transferOriginale, { ...transferOriginale });
  assertEquals(d, []);
});

/* se qualcuno confrontasse gli oggetti con === invece dei campi, questo
   test fallirebbe anche su dati uguali perche' sono due oggetti diversi */
Deno.test('un solo campo cambiato produce una sola differenza leggibile', () => {
  const corretto = { ...transferOriginale, ora: '15:00' };
  const d = differenze(transferOriginale, corretto);
  assertEquals(d.length, 1);
  assertEquals(d[0], { campo: 'Ora', prima: '14:30', adesso: '15:00' });
});

/* se il confronto ignorasse i campi assenti in un lato invece di trattarli
   come "niente", un volo aggiunto in reception sparirebbe dalla scheda */
Deno.test('un campo aggiunto e una differenza, con il prima vuoto', () => {
  const { volo: _fuori, ...senzaVolo } = transferOriginale;
  const d = differenze(senzaVolo, transferOriginale);
  const riga = d.find((x: Differenza) => x.campo === 'Volo');
  assert(riga, 'la differenza sul volo deve comparire');
  assertEquals(riga, { campo: 'Volo', prima: '', adesso: 'FR1234' });
});

/* scenario reale: un campo introdotto in tipi.ts dopo che alcune richieste
   erano gia' state salvate. L'originale non ce l'ha, il corrente si':
   se il confronto si limitasse alle chiavi dell'originale, questo sparirebbe */
Deno.test('un campo tolto e una differenza, con l adesso vuoto', () => {
  const { volo: _fuori, ...senzaVolo } = transferOriginale;
  const d = differenze(transferOriginale, senzaVolo);
  const riga = d.find((x: Differenza) => x.campo === 'Volo');
  assert(riga, 'la differenza sul volo deve comparire anche quando e tolto');
  assertEquals(riga, { campo: 'Volo', prima: 'FR1234', adesso: '' });
});

/* il cuore del modulo: senza un confronto per valore ordinato, questo
   diventerebbe un falso "aveva chiesto X, ora Y" con X e Y identici */
Deno.test('le stesse voci in ordine diverso non sono una differenza', () => {
  const originali = { voci: ['Massaggio antistress', 'Shiatsu', 'Pindasweda'], giorno: '2026-08-21', fascia: 'mattina' };
  const correnti = { voci: ['Pindasweda', 'Massaggio antistress', 'Shiatsu'], giorno: '2026-08-21', fascia: 'mattina' };
  assertEquals(differenze(originali, correnti), []);
});

/* controprova del test sopra: un elenco DAVVERO diverso deve restare
   segnalato, altrimenti il confronto per valore sarebbe diventato "sempre
   uguali" invece di "uguali solo se stesso contenuto" */
Deno.test('un elenco di voci davvero diverso resta una differenza', () => {
  const originali = { voci: ['Massaggio antistress', 'Shiatsu'] };
  const correnti = { voci: ['Massaggio antistress', 'Riflessologia plantare'] };
  const d = differenze(originali, correnti);
  const riga = d.find((x: Differenza) => x.campo === 'Trattamenti scelti');
  assert(riga);
  assertEquals(riga!.prima, 'Massaggio antistress, Shiatsu');
  assertEquals(riga!.adesso, 'Massaggio antistress, Riflessologia plantare');
});

/* le quattro richieste mai corrette avranno originali=null finche' la
   colonna non viene riempiuta: devono leggersi come "niente da dire", non
   come un elenco di tutti i campi del corrente */
Deno.test('originali a null non produce differenze, non un elenco di tutto', () => {
  const d = differenze(null, { ...transferOriginale, ora: '16:00', pax: 4 });
  assertEquals(d, []);
});

Deno.test('originali undefined si comporta come null', () => {
  assertEquals(differenze(undefined, transferOriginale), []);
});

/* difensivo: un corrente mancante non deve far esplodere Object.keys() ne'
   elencare come "tolto" ogni campo dell'originale */
Deno.test('anche correnti a null non produce differenze ne fa esplodere niente', () => {
  const d = differenze(transferOriginale, null);
  assertEquals(d, []);
});

/* i booleani si leggono "Si"/"No", non "true"/"false": e' quello che finisce
   davanti a un operatore, non a uno sviluppatore */
Deno.test('un campo booleano cambiato si legge Si/No', () => {
  const d = differenze({ ritorno: false }, { ritorno: true });
  assertEquals(d, [{ campo: 'Ritorno incluso', prima: 'No', adesso: 'Sì' }]);
});

/* il trabocchetto gia' noto in questo progetto (vedi email-richiesta.ts):
   prezzo_cent e caparra_cent sono centesimi, e nessuno deve leggere "31000"
   in una scheda pensando che siano euro */
Deno.test('i campi in centesimi si leggono in euro, non come numero grezzo', () => {
  const d = differenze({ prezzo_cent: 31000 }, { prezzo_cent: 35000 });
  assertEquals(d, [{ campo: 'Prezzo', prima: '310,00 €', adesso: '350,00 €' }]);
});

/* le date si leggono come le legge una persona, non in formato ISO */
Deno.test('le date cambiate si leggono per esteso, con l anno', () => {
  const d = differenze({ quando: '2026-08-21' }, { quando: '2026-08-22' });
  assertEquals(d, [{ campo: 'Data', prima: '21 agosto 2026', adesso: '22 agosto 2026' }]);
});

/* l'esempio letterale della specifica: 'fascia' deve leggersi "Fascia
   oraria", non il nome tecnico del campo */
Deno.test('il campo fascia si legge "Fascia oraria"', () => {
  const d = differenze({ fascia: 'mattina' }, { fascia: 'pomeriggio' });
  assertEquals(d, [{ campo: 'Fascia oraria', prima: 'mattina', adesso: 'pomeriggio' }]);
});

/* un campo non previsto nella tabella delle etichette non deve far esplodere
   niente, nemmeno se si chiama come un metodo ereditato da Object.prototype:
   una lookup con OGGETTO[chiave] senza guardia tornerebbe la funzione vera */
Deno.test('un campo sconosciuto, anche chiamato come un metodo ereditato, non fa esplodere niente', () => {
  const d = differenze({}, { toString: 'qualcosa' });
  assertEquals(d.length, 1);
  assertEquals(typeof d[0].campo, 'string');
  assert(!d[0].campo.includes('function'));
  assertEquals(d[0].adesso, 'qualcosa');
});

/* ============================================================
   LE PERSONE DA AGGIUNGERE SONO OGGETTI, NON STRINGHE.

   `persone_extra` (check-in online) e' un elenco di { nome, eta }. Con
   String() ogni voce diventa «[object Object]»: il valore stampato era
   illeggibile, e — peggio — due elenchi DIVERSI della stessa lunghezza
   risultavano UGUALI, quindi una correzione della reception spariva senza
   lasciare traccia ne' in back office ne' nell'email dell'ospite. E'
   l'«undefined» di questa colonna, vestito da nome di classe.
   ============================================================ */
Deno.test('le persone da aggiungere si leggono col nome, non come [object Object]', () => {
  const d = differenze(
    { persone_extra: [{ nome: 'Rossi Elena', eta: '12' }] },
    { persone_extra: [{ nome: 'Rossi Elena', eta: '12' }, { nome: 'Rossi Marco' }] },
  );
  assertEquals(d.length, 1);
  assertEquals(d[0].campo, 'Persone da aggiungere');
  assertEquals(d[0].prima, 'Rossi Elena (12)');
  assertEquals(d[0].adesso, 'Rossi Elena (12), Rossi Marco');
});

Deno.test('due elenchi di persone diversi non si scambiano per uguali', () => {
  const d = differenze(
    { persone_extra: [{ nome: 'Rossi Elena', eta: '12' }] },
    { persone_extra: [{ nome: 'Bianchi Marco', eta: '40' }] },
  );
  assertEquals(d.length, 1, 'due persone diverse sono passate per la stessa persona');
  assertEquals(d[0].prima, 'Rossi Elena (12)');
  assertEquals(d[0].adesso, 'Bianchi Marco (40)');
});

/* Lo stesso elenco in ordine diverso resta «uguale», come per le voci dei
   trattamenti: e' un dettaglio di come Postgres le ha restituite, non una
   modifica dell'ospite. */
Deno.test('le stesse persone in ordine diverso non sono una modifica', () => {
  const d = differenze(
    { persone_extra: [{ nome: 'Rossi Elena', eta: '12' }, { nome: 'Rossi Marco' }] },
    { persone_extra: [{ nome: 'Rossi Marco' }, { nome: 'Rossi Elena', eta: '12' }] },
  );
  assertEquals(d, []);
});

/* I campi del check-in e della fattura hanno un nome leggibile: senza,
   l'operatore leggeva «Ora_arrivo» e «Piva» — e l'ospite pure, dentro il
   riquadro «cosa e' cambiato». */
Deno.test('i campi di un arrivo e di una fattura hanno un nome da leggere', () => {
  const attesi: Record<string, string> = {
    ora_arrivo: 'Arrivo previsto', mezzo: 'Mezzo', attenzioni: 'Piccole attenzioni',
    fanghi_desiderio: 'Desiderio fanghi', persone_extra: 'Persone da aggiungere',
    persone_confermate: 'Persone da aggiungere confermate',
    ragione: 'Ragione sociale', indirizzo: 'Indirizzo', piva: 'Partita IVA',
    cf: 'Codice fiscale', sdi: 'Codice SDI', pec: 'PEC',
  };
  for (const [chiave, atteso] of Object.entries(attesi)) {
    const d = differenze({ [chiave]: 'prima' }, { [chiave]: 'dopo' });
    assertEquals(d.length, 1, `${chiave}: nessuna differenza rilevata`);
    assertEquals(d[0].campo, atteso, `${chiave} si legge ancora col nome tecnico`);
  }
});
