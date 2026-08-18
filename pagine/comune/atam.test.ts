/* ============================================================
   atam.test.ts — il riepilogo per il modulo dei tassisti.

   IL DIFETTO CHE PRESIDIA. Il back office mostrava un blocco solo, con le
   etichette dentro:

       Data: 15 agosto 2026
       Ora: 15:30
       Pax: 2
       ...

   e sopra ci scriveva «Da incollare su atam.biz». Ma il modulo dei tassisti
   ha un campo per ognuna di quelle cose: incollare il blocco intero significa
   scaricarlo tutto in un campo solo. Provato davvero — nel campo della data
   finiva «Data: 15 agosto 2026», la parola «Data:» compresa, il calendario
   non la sapeva leggere, e il resto spariva.

   Il blocco nasceva come aiuto alla LETTURA — perche' il luogo combacia
   parola per parola con l'elenco dei tassisti e non va tradotto — ma
   l'etichetta prometteva un INCOLLAGGIO. Da qui in poi etichetta e valore
   sono due cose separate, e si copia il valore.

   Il testo unito resta identico a prima: c'e' chi lo incolla nelle note, e
   quel modo continua a funzionare.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';
import {
  datiATAM, datiATAMRitorno, indirizzoATAM, indirizzoATAMRitorno, riepilogoATAM, vociATAM,
} from './atam.js';

/* il formattatore di data lo passa la pagina: questo modulo non possiede il
   modo di scrivere una data, e due copie di quella regola divergerebbero */
const dataFinta = (iso: string) => (iso ? `15 agosto 2026 [${iso}]` : '');

const RICHIESTA = {
  nome: 'Raffael Renga',
  dati: {
    quando: '2026-08-15', ora: '15:30', pax: 2, verso: 'arrivo',
    luogo: 'Venezia  aeroporto', volo: 'FR1234', note: 'due valigie grandi',
  },
};

Deno.test('ogni voce tiene separate l etichetta e il valore', () => {
  const voci = vociATAM(RICHIESTA, dataFinta);
  assert(voci.length > 0, 'nessuna voce');
  for (const v of voci) {
    assert(v.eti, 'voce senza etichetta');
    assert(v.val !== undefined, 'voce senza valore');
    /* IL DIFETTO. Se l'etichetta rientrasse nel valore, chi incolla si
       ritroverebbe «Data: 15 agosto 2026» dentro il campo della data. */
    assert(
      !String(v.val).startsWith(v.eti + ':'),
      `l etichetta e finita dentro il valore: ${v.eti} → ${v.val}`,
    );
  }
});

Deno.test('il luogo arriva parola per parola, doppio spazio compreso', () => {
  const luogo = vociATAM(RICHIESTA, dataFinta).find((v) => v.eti === 'Arrivo da');
  assert(luogo, 'il luogo non c e');
  /* i due spazi di «Venezia  aeroporto» sono nell'elenco dei tassisti: una
     voce che non combacia li costringe a cercarla a mano */
  assertEquals(luogo.val, 'Venezia  aeroporto');
});

Deno.test('una partenza si chiama partenza', () => {
  const r = { ...RICHIESTA, dati: { ...RICHIESTA.dati, verso: 'partenza' } };
  const eti = vociATAM(r, dataFinta).map((v) => v.eti);
  assert(eti.includes('Partenza per'), `etichette: ${eti.join(', ')}`);
  assert(!eti.includes('Arrivo da'));
});

Deno.test('le voci facoltative vuote non compaiono', () => {
  const r = { nome: 'Anna Verdi', dati: { quando: '2026-08-15', ora: '9:00', pax: 1, luogo: 'Abano' } };
  const eti = vociATAM(r, dataFinta).map((v) => v.eti);
  for (const assente of ['Dettagli arrivo', 'Note', 'Nota']) {
    assert(!eti.includes(assente), `${assente} non doveva esserci`);
  }
});

/* Il modo vecchio continua a funzionare: c'e' chi il blocco intero lo
   incolla nelle note del modulo dei tassisti, ed e' legittimo. */
Deno.test('il testo unito e ancora quello di prima', () => {
  assertEquals(
    riepilogoATAM(RICHIESTA, dataFinta),
    [
      'Data: 15 agosto 2026 [2026-08-15]',
      'Ora: 15:30',
      'Pax: 2',
      /* riga nuova dal 18 agosto 2026: chi incolla il blocco nelle note deve
         vedere anche se la corsa e' privata o condivisa */
      'Servizio: Auto privata (individuale)',
      'Arrivo da: Venezia  aeroporto',
      'Nome del cliente: Raffael Renga',
      'Dettagli arrivo: FR1234',
      'Note: due valigie grandi',
    ].join('\n'),
  );
});

Deno.test('il ritorno si segnala come nota, senza valore da copiare', () => {
  const r = { ...RICHIESTA, dati: { ...RICHIESTA.dati, ritorno: true } };
  assert(riepilogoATAM(r, dataFinta).includes('serve anche il ritorno'));
});

/* ============================================================
   I VALORI GREZZI PER IL MODULO DEI TASSISTI.

   Le voci qui sopra servono agli occhi; questi servono all'estensione,
   che li scrive nei campi di atam.biz. Il difetto da presidiare e' che
   qualcuno, un domani, faccia scrivere all'estensione le ETICHETTE —
   «Data: 15 agosto 2026» dentro il campo della data — che e' esattamente
   il guasto da cui e' nato tutto questo lavoro.
   ============================================================ */
Deno.test('i valori grezzi non contengono etichette ne date scritte a parole', () => {
  const g = datiATAM(RICHIESTA);
  assertEquals(g.data, '2026-08-15');       // ISO, non «15 agosto 2026»
  assertEquals(g.ora, '15:30');
  assertEquals(g.pax, '2');
  assertEquals(g.verso, 'arrivo');
  assertEquals(g.luogo, 'Venezia  aeroporto');   // doppio spazio conservato
  assertEquals(g.nome, 'Raffael Renga');
  for (const [k, v] of Object.entries(g)) {
    assert(!/^(Data|Ora|Pax|Nome del cliente|Arrivo da|Note):/i.test(String(v)),
      `${k} porta dentro la sua etichetta: ${v}`);
  }
});

Deno.test('una partenza si dice partenza anche nei valori grezzi', () => {
  const r = { ...RICHIESTA, dati: { ...RICHIESTA.dati, verso: 'partenza' } };
  assertEquals(datiATAM(r).verso, 'partenza');
});

/* Su atam.biz il ritorno e' una seconda corsa e non ha un campo: se non
   finisse nelle note, sparirebbe fra la richiesta e la prenotazione. */
Deno.test('il ritorno finisce nelle note, perche altrove non c e posto', () => {
  const r = { ...RICHIESTA, dati: { ...RICHIESTA.dati, ritorno: true } };
  const g = datiATAM(r);
  assert(g.note.includes('ritorno'), `note: ${g.note}`);
  assert(g.note.includes('due valigie grandi'), 'le note dell ospite non devono sparire');
});

/* Il frammento — tutto cio' che sta dopo il # — non viene mai mandato al
   server. Se un domani questi dati finissero nella QUERY, i nomi degli
   ospiti arriverebbero nei log di atam.biz. */
Deno.test('i dati viaggiano nel frammento, mai nella query', () => {
  const u = indirizzoATAM(RICHIESTA);
  assert(u.startsWith('https://www.atam.biz/prenotazioni/#leo='), u.slice(0, 60));
  assert(!u.slice(0, u.indexOf('#')).includes('?'), 'c e una query: i dati uscirebbero');
  const dentro = JSON.parse(decodeURIComponent(u.split('#leo=')[1]));
  assertEquals(dentro.nome, 'Raffael Renga');
});

/* ============================================================
   INDIVIDUALE O COLLETTIVO.

   Sul modulo dei tassisti sono due pallini (`is_collettivo`), e finora li
   lasciavamo in bianco perche' la richiesta non lo diceva. Adesso lo dice.

   IL DIFETTO DA PRESIDIARE e' che il valore si perda per strada: la
   richiesta porta «navetta condivisa», l'estensione riempie tutto il
   resto, e l'ospite si trova un'auto privata a 135 € invece che una
   navetta a 95. Il dato deve arrivare fino in fondo, e deve essere
   distinguibile da «non lo so».
   ============================================================ */
Deno.test('il collettivo arriva nei valori grezzi come booleano', () => {
  const r = { ...RICHIESTA, dati: { ...RICHIESTA.dati, collettivo: true } };
  assertEquals(datiATAM(r).collettivo, true);
});

Deno.test('senza collettivo il valore e falso, non indefinito', () => {
  /* l'estensione sceglie fra due pallini: `undefined` la lascerebbe a
     indovinare, ed e' esattamente cio' che facevamo prima */
  assertEquals(datiATAM(RICHIESTA).collettivo, false);
});

Deno.test('il collettivo si legge anche nelle voci, a parole', () => {
  const r = { ...RICHIESTA, dati: { ...RICHIESTA.dati, collettivo: true } };
  const v = vociATAM(r, dataFinta).find((x) => x.eti === 'Servizio');
  assert(v, 'la voce Servizio non c e');
  assert(/navetta|condivis/i.test(String(v.val)), `dice: ${v.val}`);
});

Deno.test('in privato la voce Servizio dice auto privata', () => {
  const v = vociATAM(RICHIESTA, dataFinta).find((x) => x.eti === 'Servizio');
  assert(v, 'la voce Servizio non c e');
  assert(/privat/i.test(String(v.val)), `dice: ${v.val}`);
});

/* Il frammento porta tutto: se il collettivo restasse fuori di li',
   l'estensione lo saprebbe dal riepilogo a schermo ma non dai dati, e
   riempirebbe i pallini a caso. */
Deno.test('il collettivo viaggia anche nell indirizzo', () => {
  const r = { ...RICHIESTA, dati: { ...RICHIESTA.dati, collettivo: true } };
  const dentro = JSON.parse(decodeURIComponent(indirizzoATAM(r).split('#leo=')[1]));
  assertEquals(dentro.collettivo, true);
});

/* ============================================================
   IL RITORNO E' UNA SECONDA PRENOTAZIONE.

   Su atam.biz non esiste un campo «ritorno»: il ritorno si prenota da capo,
   con la sua data, la sua ora, il suo verso e il suo servizio. Finora la
   richiesta portava solo un booleano e una nota nelle note — la reception
   doveva ricostruire tutto a mano, e il verso lo doveva indovinare.

   IL DIFETTO CHE PRESIDIA: il verso del ritorno e' OPPOSTO a quello
   dell'andata. Chi arriva dall'aeroporto torna in aeroporto. Copiare il
   verso dell'andata manderebbe il tassista dalla parte sbagliata.
   ============================================================ */
const CON_RITORNO = {
  nome: 'Raffael Renga',
  dati: {
    quando: '2026-08-15', ora: '15:30', pax: 2, verso: 'arrivo',
    luogo: 'Venezia  aeroporto', volo: 'FR1234', collettivo: true,
    ritorno: true, ritorno_quando: '2026-08-22', ritorno_ora: '18:00',
    ritorno_volo: 'FR5678', ritorno_collettivo: false, note: 'due valigie grandi',
  },
};

Deno.test('il ritorno ha il verso opposto all andata', () => {
  assertEquals(datiATAMRitorno(CON_RITORNO)?.verso, 'partenza');
  const inPartenza = { ...CON_RITORNO, dati: { ...CON_RITORNO.dati, verso: 'partenza' } };
  assertEquals(datiATAMRitorno(inPartenza)?.verso, 'arrivo');
});

Deno.test('il ritorno porta la sua data, la sua ora e il suo volo', () => {
  const g = datiATAMRitorno(CON_RITORNO);
  assertEquals(g?.data, '2026-08-22');
  assertEquals(g?.ora, '18:00');
  assertEquals(g?.volo, 'FR5678');
});

/* Il servizio del ritorno e' suo: alle 22:00 la navetta non e' in servizio,
   quindi un ritorno puo' essere privato anche se l'andata era condivisa. */
Deno.test('il servizio del ritorno non copia quello dell andata', () => {
  assertEquals(datiATAM(CON_RITORNO).collettivo, true);
  assertEquals(datiATAMRitorno(CON_RITORNO)?.collettivo, false);
});

Deno.test('luogo, passeggeri e nome restano quelli dell andata', () => {
  const g = datiATAMRitorno(CON_RITORNO);
  assertEquals(g?.luogo, 'Venezia  aeroporto');
  assertEquals(g?.pax, '2');
  assertEquals(g?.nome, 'Raffael Renga');
});

Deno.test('senza ritorno non c e niente da prenotare', () => {
  assertEquals(datiATAMRitorno(RICHIESTA), null);
  assertEquals(indirizzoATAMRitorno(RICHIESTA), null);
});

Deno.test('l indirizzo del ritorno usa lo stesso frammento', () => {
  const u = indirizzoATAMRitorno(CON_RITORNO);
  assert(u && u.startsWith('https://www.atam.biz/prenotazioni/#leo='), String(u).slice(0, 60));
  const dentro = JSON.parse(decodeURIComponent(String(u).split('#leo=')[1]));
  assertEquals(dentro.data, '2026-08-22');
  assertEquals(dentro.verso, 'partenza');
});

/* Le note dell'andata parlano dell'andata: «serve anche il ritorno» sulla
   prenotazione DEL ritorno sarebbe un'istruzione a vuoto. */
Deno.test('la nota del ritorno non chiede un altro ritorno', () => {
  assert(!String(datiATAMRitorno(CON_RITORNO)?.note ?? '').toLowerCase().includes('ritorno'));
});
