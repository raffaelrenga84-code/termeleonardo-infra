/* ============================================================
   arrivo-invio.ts — da una compilazione del check-in alle richieste.

   Fino a oggi il modulo d'arrivo scriveva in una tabella sua e mandava
   un'email a mano: niente numero, niente ricevuta, niente prezzo, e in
   back office una schermata in sola lettura. Da qui in poi produce
   richieste vere, cioe' le stesse cose che nascono dai moduli del sito.

   UNA COMPILAZIONE, FINO A TRE PEZZI. L'arrivo c'e' sempre; il transfer e
   la fattura solo se spuntati. Le sezioni non spuntate non fanno nascere
   niente — e una sezione spuntata e vuota e' un ERRORE, non una riga
   vuota: una richiesta di transfer senza luogo ne' data manderebbe la
   reception a telefonare per chiedere cosa ha chiesto l'ospite.

   TUTTO O NIENTE. Se un pezzo non passa la validazione non ne nasce
   nessuno: meta' compilazione salvata sarebbe peggio di niente, perche'
   l'ospite crede di aver mandato tutto.

   Modulo puro: dati dentro, dati fuori. Nessuna rete, nessun database.
   ============================================================ */
import { validaDati } from './tipi.ts';

export type Pezzo = {
  tipo: 'arrivo' | 'transfer' | 'fattura';
  dati: Record<string, unknown>;
};

export type Pezzi = { errore?: string; pezzi?: Pezzo[] };

const oggetto = (v: unknown): Record<string, unknown> =>
  (v && typeof v === 'object') ? v as Record<string, unknown> : {};

export function pezziDaArrivo(corpo: Record<string, unknown>, oggi: Date = new Date()): Pezzi {
  const pezzi: Pezzo[] = [];

  /* l'arrivo c'e' sempre: anche chi non spunta niente ha detto qualcosa
     compilando (o non compilando) l'ora, e quella riga e' la scheda
     dell'arrivo */
  /* persone_confermate FORZATO A FALSO qui, prima di validare: quel campo
     esiste in validaArrivo per sopravvivere a ?a=conferma, cioe' per
     essere scritto dalla RECEPTION quando ha davvero risposto. `arrivo`
     non sta in TIPI_ATTIVI: questa azione e' l'UNICA porta pubblica su
     quel campo, quindi un ospite che manda persone_confermate:true insieme
     alle persone da aggiungere disinnescherebbe da solo la garanzia che
     qualcuno le ha viste. Il corpo del browser non decide mai questo
     valore: qui si sovrascrive PRIMA di passare la mano a validaDati, cosi'
     resta falso qualunque cosa arrivi da fuori. */
  const a = validaDati('arrivo', { ...corpo, persone_confermate: false }, oggi);
  if (a.errore || !a.dati) return { errore: a.errore ?? 'arrivo non valido' };
  pezzi.push({ tipo: 'arrivo', dati: a.dati });

  if (corpo.transfer === true) {
    const t = validaDati('transfer', oggetto(corpo.transfer_dati), oggi);
    if (t.errore || !t.dati) return { errore: t.errore ?? 'transfer non valido' };
    pezzi.push({ tipo: 'transfer', dati: t.dati });
  }

  if (corpo.fattura === true) {
    const f = validaDati('fattura', oggetto(corpo.fattura_dati), oggi);
    if (f.errore || !f.dati) return { errore: f.errore ?? 'fattura non valida' };
    pezzi.push({ tipo: 'fattura', dati: f.dati });
  }

  return { pezzi };
}

/* ============================================================
   Dalla validazione all'inserimento: la parte che decide COME SI SCRIVONO
   le righe e COSA ARRIVA nell'avviso e' logica pura come sopra — dati
   dentro, dati fuori, nessun database — e va provata come tale.
   index.ts resta responsabile solo della sequenza che ha davvero bisogno
   della rete: token, "gia' mandato", numerazione, insert.
   ============================================================ */

export type LinkArrivo = { intestatario: string; email: string; lingua: string | null };
export type NumeroRichiesta = { anno: number; progressivo: number; numero: string };
export type ContestoInvio = { token: string; telefono: string; ip: string };

export type RigaRichiesta = {
  anno: number; progressivo: number; numero: string;
  tipo: Pezzo['tipo'];
  nome: string; email: string; telefono: string | null; lingua: string;
  dati: Record<string, unknown>; dati_originali: Record<string, unknown>;
  arrivo_token: string; origine: string; ip: string; privacy_il: string | null;
};

/* Una riga per pezzo, pronta per un solo `insert`. `numeri[i]` e' chiesto
   PRIMA a database (index.ts) e passato qui gia' pronto: questa funzione
   non parla con niente, si limita a ricopiare. I dati restano ANNIDATI
   sotto `dati`: e' la forma della colonna jsonb, ed e' anche quella che si
   aspetta inviaRicevutaArrivo() (Task 6) via riepilogoRichiesta().

   privacy_il RESTA SEMPRE NULLO: decisione del proprietario (giro di
   correzione 2). Il check-in online non chiede nessun consenso nuovo —
   l'ospite ha gia' prenotato, e il consenso che ha dato allora resta
   registrato dov'e' stato raccolto, non qui. Scrivere una data in questa
   colonna direbbe che ha prestato consenso in un momento preciso
   ATTRAVERSO QUESTO MODULO, e non sarebbe vero: consenso.ts esiste apposta
   per impedirlo ("una data scritta senza un vero consenso e' una prova
   FALSA, peggio di nessuna prova"). Una colonna vuota e' la verita': da
   qui non e' stato raccolto niente.

   QUESTO E' L'OPPOSTO del modulo pubblico del sito (index.ts, blocco
   `!azione`), che quella data la scrive con dataConsenso(): non e' una
   dimenticanza da "sistemare" — li' la casella di consenso c'e' davvero e
   l'ospite la spunta, qui la casella non esiste. */
export function righeDaArrivo(
  link: LinkArrivo,
  pezzi: Pezzo[],
  numeri: NumeroRichiesta[],
  contesto: ContestoInvio,
): RigaRichiesta[] {
  return pezzi.map((p, i) => ({
    anno: numeri[i].anno, progressivo: numeri[i].progressivo, numero: numeri[i].numero,
    tipo: p.tipo,
    nome: link.intestatario, email: link.email,
    telefono: contesto.telefono.slice(0, 40) || null,
    lingua: link.lingua || 'it',
    dati: p.dati,
    dati_originali: p.dati,
    arrivo_token: contesto.token,
    origine: 'check-in online',
    ip: contesto.ip,
    privacy_il: null,
  }));
}

/* Il carico per avvisaHotel(): STESO, non annidato. richiestaHTML() in
   email-richiesta.ts legge i campi propri del tipo — luogo, quando,
   ragione, ora_arrivo... — direttamente sull'oggetto, esattamente come fa
   il percorso pubblico del sito (componiRichiesta produce
   {...contatti, ...colonne, ...propri} in index.ts). Passare `dati: r.dati`
   annidato qui sarebbe il difetto opposto e silenzioso di righeDaArrivo:
   l'avviso arriverebbe in reception con ogni campo proprio a "undefined". */
export function carichiAvviso(
  righe: RigaRichiesta[],
): (Record<string, unknown> & { numero: string; nome: string; email: string })[] {
  return righe.map((r) => ({
    ...r.dati,
    tipo: r.tipo,
    numero: r.numero,
    nome: r.nome,
    email: r.email,
    /* r.telefono e' `string | null` (la colonna lo ammette assente);
       avvisaHotel lo vuole `string | undefined` — null diventa undefined,
       e non cambia niente per l'email, che una riga vuota la salta */
    telefono: r.telefono ?? undefined,
    lingua: r.lingua,
  }));
}
