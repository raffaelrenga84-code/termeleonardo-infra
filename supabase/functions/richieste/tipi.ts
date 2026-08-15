/* ============================================================
   tipi.ts — validazione dei dati propri di ogni tipo di richiesta.

   Modulo puro: dati dentro, dati validati fuori. Nessuna rete, nessun
   database, cosi' si prova per intero senza toccare la produzione.

   I tipi si aggiungono qui e basta: la tabella tiene i campi propri in
   jsonb, quindi un tipo nuovo non richiede una migrazione.
   ============================================================ */

import { CIRCOLI_GOLF, luogoValido } from './luoghi.ts';
import { CAMERE } from './camere.ts';

export const TIPI_ATTIVI = ['soggiorno', 'transfer', 'greenfee', 'maestro', 'trattamenti'] as const;

type Esito = { errore?: string; dati?: Record<string, unknown> };

const testo = (v: unknown) => String(v ?? '').trim();
const GIORNO_MS = 86400000;
const ANNI_AVANTI = 2;

/* la data deve esistere davvero: new Date('2026-02-31') non protesta,
   scivola al 3 marzo. Il confronto con la stringa di partenza lo scopre. */
function giorno(s: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(s + 'T12:00:00Z');
  if (isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) return null;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/* comune a tutti i tipi: una data di servizio non nel passato e non oltre
   due anni. Oggi stesso e' legittimo — chi atterra fra tre ore ha diritto
   di chiedere un taxi. */
function dataServizio(v: unknown, oggi: Date): { errore?: string; valore?: string } {
  const s = testo(v);
  if (!s) return { errore: 'data mancante' };
  const g = giorno(s);
  if (g === null) return { errore: 'data non valida' };
  const adesso = Date.UTC(oggi.getUTCFullYear(), oggi.getUTCMonth(), oggi.getUTCDate());
  if (g < adesso) return { errore: 'data nel passato' };
  const limite = new Date(adesso);
  limite.setUTCFullYear(limite.getUTCFullYear() + ANNI_AVANTI);
  if (g > limite.getTime()) return { errore: 'data troppo lontana' };
  return { valore: s };
}

function ora(v: unknown): { errore?: string; valore?: string } {
  const s = testo(v);
  if (!s) return { errore: 'ora mancante' };
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(s)) return { errore: 'ora non valida' };
  return { valore: s };
}

function intero(v: unknown, min: number, max: number): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}

/* ---------------- transfer ---------------- */
/* Il modulo ATAM chiede data, ora, passeggeri, arrivo o partenza e un luogo
   dal suo elenco chiuso. Il pagamento non si chiede all'ospite: sul loro
   modulo lo sceglie la reception fra diretto, hotel e fattura, ed e' una
   decisione loro. */
function validaTransfer(d: Record<string, unknown>, oggi: Date): Esito {
  const data = dataServizio(d.quando, oggi);
  if (data.errore) return { errore: data.errore };

  const o = ora(d.ora);
  if (o.errore) return { errore: o.errore };

  const pax = intero(d.pax, 1, 8);
  if (pax === null) return { errore: 'passeggeri non validi' };

  const verso = testo(d.verso);
  if (verso !== 'arrivo' && verso !== 'partenza') {
    return { errore: 'indicare arrivo o partenza' };
  }

  /* deve combaciare parola per parola con l'elenco ATAM: il valore finisce
     ricopiato nel loro modulo, e uno che non corrisponde costringe a
     cercarlo a mano fra 189 voci */
  if (!luogoValido(d.luogo)) return { errore: 'luogo non in elenco' };

  const volo = testo(d.volo);
  if (volo.length > 40) return { errore: 'volo troppo lungo' };
  const note = testo(d.note);
  if (note.length > 2000) return { errore: 'note troppo lunghe' };

  return {
    dati: {
      quando: data.valore, ora: o.valore, pax, verso,
      luogo: testo(d.luogo), volo, ritorno: d.ritorno === true, note,
    },
  };
}

/* ---------------- green fee ---------------- */
/* La partenza la prende la reception su OpenGolf o Chronogolf, e il taxi al
   campo su ATAM: e' una richiesta sola perche' chi va a giocare deve anche
   arrivarci. Il luogo del taxi NON si chiede: si deduce dal circolo, che e'
   gia' una destinazione del loro elenco. Chiederlo due volte sarebbe un
   modo per farli divergere. */
function validaGreenfee(d: Record<string, unknown>, oggi: Date): Esito {
  /* Object.hasOwn e non `CIRCOLI_GOLF[circolo]`: la stringa arriva dal corpo
     della richiesta, e un oggetto non risponde `undefined` solo alle chiavi
     che non ha — risponde con quello che eredita da Object.prototype.
     `toString` e `constructor` sono funzioni, quindi truthy, e un `if (!c)`
     le lascerebbe passare: la richiesta finirebbe registrata e spedita alla
     reception con un circolo che non esiste e il luogo del taxi vuoto. */
  const circolo = testo(d.circolo);
  if (!Object.hasOwn(CIRCOLI_GOLF, circolo)) return { errore: 'circolo sconosciuto' };
  const c = CIRCOLI_GOLF[circolo];

  const data = dataServizio(d.data, oggi);
  if (data.errore) return { errore: data.errore };
  const o = ora(d.ora);
  if (o.errore) return { errore: o.errore };

  const giocatori = intero(d.giocatori, 1, 4);
  if (giocatori === null) return { errore: 'giocatori non validi' };

  const percorso = testo(d.percorso);
  if (percorso.length > 40) return { errore: 'percorso troppo lungo' };
  const tessera = testo(d.tessera);
  if (tessera.length > 40) return { errore: 'tessera troppo lunga' };
  const note = testo(d.note);
  if (note.length > 2000) return { errore: 'note troppo lunghe' };

  const taxi = d.taxi === true;
  let taxi_ora = '';
  if (taxi) {
    const t = ora(d.taxi_ora);
    if (t.errore) return { errore: 'ora del taxi mancante' };
    taxi_ora = t.valore!;
  }

  return {
    dati: {
      circolo, circolo_nome: c.nome,
      data: data.valore, ora: o.valore, giocatori, percorso,
      golfcar: d.golfcar === true, carrello: d.carrello === true,
      carrello_elettrico: d.carrello_elettrico === true, sacca: d.sacca === true,
      tessera, note,
      taxi, taxi_ora, taxi_ritorno: taxi && d.taxi_ritorno === true,
      /* gia' scritto come nell'elenco ATAM, pronto da incollare */
      taxi_luogo: taxi ? c.luogo : '',
    },
  };
}

/* ---------------- lezione col maestro ---------------- */
const LIVELLI = ['principiante', 'intermedio', 'esperto'];

function validaMaestro(d: Record<string, unknown>, oggi: Date): Esito {
  const data = dataServizio(d.data, oggi);
  if (data.errore) return { errore: data.errore };
  const o = ora(d.ora);
  if (o.errore) return { errore: o.errore };

  const persone = intero(d.persone, 1, 4);
  if (persone === null) return { errore: 'persone non valide' };

  /* "non so" e' una risposta legittima: chi non ha mai giocato non sa
     collocarsi, e rifiutarlo perderebbe proprio il principiante */
  const l = testo(d.livello);
  if (l && !LIVELLI.includes(l)) return { errore: 'livello sconosciuto' };
  const livello = l || 'non so';

  const note = testo(d.note);
  if (note.length > 2000) return { errore: 'note troppo lunghe' };

  return { dati: { data: data.valore, ora: o.valore, persone, livello, note } };
}

/* ---------------- trattamenti ---------------- */
/* Le voci arrivano come testo e non come codici di listino: il listino vero
   vive nella funzione dei buoni, e duplicarlo qui vorrebbe dire tenerne due
   allineati. Nessun prezzo viene promesso — lo conferma la reception —
   quindi il testo basta. */
const VOCI_MAX = 8;
const FASCE = ['mattina', 'pomeriggio', 'indifferente'];

function validaTrattamenti(d: Record<string, unknown>, oggi: Date): Esito {
  const voci = Array.isArray(d.voci)
    ? d.voci.map((v) => testo(v)).filter(Boolean).map((v) => v.slice(0, 80))
    : [];
  if (!voci.length) return { errore: 'nessun trattamento scelto' };
  if (voci.length > VOCI_MAX) return { errore: 'troppi trattamenti in una richiesta' };

  const data = dataServizio(d.giorno, oggi);
  if (data.errore) return { errore: data.errore };

  const f = testo(d.fascia);
  const fascia = FASCE.includes(f) ? f : 'indifferente';

  const note = testo(d.note);
  if (note.length > 2000) return { errore: 'note troppo lunghe' };

  return { dati: { voci, giorno: data.valore, fascia, note } };
}

/* ---------------- soggiorno ---------------- */
/* I campi del soggiorno stanno nelle colonne della tabella e li controlla
   valida.ts. La camera scelta sulla pagina di prenotazione e' invece nuova e
   va in `dati` jsonb, che esiste gia': nessuna migrazione.

   Il prezzo arriva dal cliente e non fa testo: serve solo a mostrare in email
   e in back office quello che l'ospite aveva davanti quando ha scelto. Si
   ferma comunque un numero assurdo, che in una email farebbe brutta figura.
   Esportato perche' disponibilita.ts filtra con lo stesso tetto: non ha senso
   mostrare all'ospite una proposta che poi l'invio rifiuta. */
export const PREZZO_MAX_CENT = 5_000_000;   // 50.000 euro

/* Gli stessi limiti che valida.ts usa per una ricerca: qui non si ricalcola
   niente, si registra quello che l'ospite aveva davanti. */
const ADULTI_MAX = 10;
const BAMBINI_MAX = 6;

/* Come prezzo_cent: null esplicito equivale ad assenza, mai un numero
   inventato. `undefined` come esito vuol dire "il campo non c'era". */
function centesimi(v: unknown, etichetta: string): { errore?: string; valore?: number } {
  if (v === undefined || v === null) return {};
  const p = Number(v);
  if (!Number.isInteger(p) || p < 0 || p > PREZZO_MAX_CENT) return { errore: etichetta };
  return { valore: p };
}

function persone(v: unknown, min: number, max: number, etichetta: string): { errore?: string; valore?: number } {
  if (v === undefined || v === null || String(v).trim() === '') return {};
  const p = Number(v);
  if (!Number.isInteger(p) || p < min || p > max) return { errore: etichetta };
  return { valore: p };
}

function validaSoggiorno(d: Record<string, unknown>): Esito {
  const id = d?.camera_id;
  if (id === undefined || id === null || id === '') return { dati: {} };

  const n = Number(id);
  if (!Number.isInteger(n) || !CAMERE[n]) return { errore: 'camera sconosciuta' };

  /* stesso rigore di camera_id: se c'e', deve essere un intero non negativo */
  const vRaw = d?.variante_id;
  let variante_id = 0;
  if (vRaw !== undefined && vRaw !== null && vRaw !== '') {
    const v = Number(vRaw);
    if (!Number.isInteger(v) || v < 0) return { errore: 'variante non valida' };
    variante_id = v;
  }

  /* null esplicito equivale ad assenza, come camera_id: mai un prezzo
     inventato. I centesimi sono interi per definizione: isInteger scarta
     anche NaN e i valori non finiti, non serve isFinite a parte. */
  const prezzo = centesimi(d?.prezzo_cent, 'prezzo non valido');
  if (prezzo.errore) return { errore: prezzo.errore };

  /* La caparra che l'ospite ha letto sulla pagina. Si registra invece di
     ricalcolarla perche' e' una PROMESSA gia' fatta: se domani cambia la
     regola dei 75 euro a persona, chi guarda una richiesta vecchia deve
     vedere la cifra che era stata promessa, non quella di oggi. */
  const caparra = centesimi(d?.caparra_cent, 'caparra non valida');
  if (caparra.errore) return { errore: caparra.errore };

  /* La colonna `ospiti` porta adulti + bambini e li impasta: su 2 adulti e 2
     bambini dice "4 ospiti", e la reception che calcola la caparra sugli
     ospiti chiede 300 euro dove la pagina ne aveva promessi 150. Il modo di
     rimettere insieme i due numeri e' registrarli. */
  const adulti = persone(d?.adulti, 1, ADULTI_MAX, 'adulti non validi');
  if (adulti.errore) return { errore: adulti.errore };
  const bambini = persone(d?.bambini, 0, BAMBINI_MAX, 'bambini non validi');
  if (bambini.errore) return { errore: bambini.errore };

  return {
    dati: {
      camera_id: n,
      nome_camera: CAMERE[n].nome,
      variante_id,
      tariffa: testo(d?.tariffa).slice(0, 60),
      trattamento: testo(d?.trattamento).slice(0, 60),
      ...(prezzo.valore !== undefined ? { prezzo_cent: prezzo.valore, valuta: 'centesimi' } : {}),
      ...(caparra.valore !== undefined ? { caparra_cent: caparra.valore } : {}),
      ...(adulti.valore !== undefined ? { adulti: adulti.valore } : {}),
      ...(bambini.valore !== undefined ? { bambini: bambini.valore } : {}),
    },
  };
}

export function validaDati(
  tipo: string,
  d: Record<string, unknown>,
  oggi: Date = new Date(),
): Esito {
  switch (tipo) {
    case 'soggiorno': return validaSoggiorno(d || {});
    case 'transfer': return validaTransfer(d || {}, oggi);
    case 'greenfee': return validaGreenfee(d || {}, oggi);
    case 'maestro': return validaMaestro(d || {}, oggi);
    case 'trattamenti': return validaTrattamenti(d || {}, oggi);
    default: return { errore: 'tipo di richiesta sconosciuto' };
  }
}
