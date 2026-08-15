/* ============================================================
   valida.ts — controllo delle richieste di preventivo dal sito.

   Modulo puro: dati dentro, dati validati fuori. Nessuna rete, nessun
   database, cosi' si prova per intero senza toccare la produzione.

   Il controllo sta qui e non nel browser perche' il browser si aggira:
   basta una richiesta costruita a mano. Quello nel form serve solo a dare
   all'ospite un messaggio gentile prima di premere invia.
   ============================================================ */

export type Richiesta = {
  nome: string;
  email: string;
  telefono: string;
  check_in: string;
  check_out: string;
  notti: number;
  ospiti: number;
  tipo_camera: string;
  pacchetto: string;
  messaggio: string;
  lingua: string;
};

const LIMITI = {
  nome: 80,
  email: 120,
  telefono: 40,
  tipo_camera: 60,
  pacchetto: 60,
  messaggio: 2000,
};

/* un soggiorno oltre il mese o un arrivo oltre i due anni non e' una
   richiesta di preventivo: e' un errore di digitazione o un disturbatore */
const NOTTI_MAX = 30;
const ANNI_AVANTI = 2;
const OSPITI_MAX = 10;

const testo = (v: unknown) => String(v ?? '').trim();

/* la data deve esistere davvero: new Date('2026-02-31') non protesta,
   scivola al 3 marzo. Il confronto con la stringa di partenza lo scopre. */
function giorno(s: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(s + 'T12:00:00Z');
  if (isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) return null;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

const GIORNO_MS = 86400000;

export type Contatti = {
  nome: string;
  email: string;
  telefono: string;
  lingua: string;
};

export type OpzioniContatti = {
  /* Obbligatorio di default, senza eccezioni: ogni richiesta e' un
     appuntamento che si puo' spostare (il taxi per un volo in ritardo, la
     partenza al campo, il lettino del massaggio), e per spostarlo bisogna
     poter chiamare. Fino al 15 agosto 2026 la chat se ne serviva per
     esentarsi (vedi componi-richiesta.ts): quella scelta e' chiusa. Il
     parametro resta come leva esplicita nel codice, non come comportamento
     diverso deciso di nascosto. */
  telefonoObbligatorio?: boolean;
};

/* Chi chiede e come lo si richiama: uguale per tutti i tipi di richiesta.
   Un transfer o un green fee non hanno un periodo di soggiorno, ma hanno
   sempre una persona dietro. */
export function validaContatti(
  b: Record<string, unknown>,
  opzioni: OpzioniContatti = {},
): { errore?: string; dati?: Contatti } {
  /* Anche una richiesta raccoglie nome, email e telefono. Il consenso e' un
     campo a se' e non si deduce dal fatto che qualcuno abbia premuto invia:
     dedurlo vorrebbe dire non averlo. */
  if (b.privacy_presa_atto !== true) return { errore: 'informativa privacy non accettata' };

  const nome = testo(b.nome);
  if (!nome) return { errore: 'nome mancante' };
  if (nome.length > LIMITI.nome) return { errore: 'nome troppo lungo' };

  const email = testo(b.email);
  if (email.length > LIMITI.email) return { errore: 'email troppo lunga' };
  if (!/.+@.+\..+/.test(email)) return { errore: 'email non valida' };

  const telefono = testo(b.telefono);
  if (telefono.length > LIMITI.telefono) return { errore: 'telefono troppo lungo' };
  /* niente controlli sulla FORMA — prefissi, cifre, spazi: un numero
     austriaco, uno con l'interno, uno scritto coi punti sono tutti numeri
     veri. Si pretende che ci sia, non che assomigli a un'idea di numero:
     rifiutare un numero valido e' peggio che accettarne uno storto. */
  if ((opzioni.telefonoObbligatorio ?? true) && !telefono) {
    return { errore: 'telefono mancante' };
  }

  const lingua = ['it', 'de', 'en', 'fr'].includes(testo(b.lingua)) ? testo(b.lingua) : 'it';
  return { dati: { nome, email, telefono, lingua } };
}

export function validaRichiesta(
  b: Record<string, unknown>,
  oggi: Date = new Date(),
  opzioni: OpzioniContatti = {},
): { errore?: string; dati?: Richiesta } {
  const c = validaContatti(b, opzioni);
  if (c.errore || !c.dati) return { errore: c.errore };
  const { nome, email, telefono, lingua } = c.dati;

  const ci = testo(b.check_in), co = testo(b.check_out);
  if (!ci || !co) return { errore: 'date mancanti' };
  const arrivo = giorno(ci), partenza = giorno(co);
  if (arrivo === null || partenza === null) return { errore: 'date non valide' };
  if (partenza <= arrivo) return { errore: 'la partenza precede l’arrivo' };

  const adesso = Date.UTC(oggi.getUTCFullYear(), oggi.getUTCMonth(), oggi.getUTCDate());
  if (arrivo < adesso) return { errore: 'arrivo nel passato' };
  const limite = new Date(adesso);
  limite.setUTCFullYear(limite.getUTCFullYear() + ANNI_AVANTI);
  if (arrivo > limite.getTime()) return { errore: 'arrivo troppo lontano' };

  const notti = Math.round((partenza - arrivo) / GIORNO_MS);
  if (notti > NOTTI_MAX) return { errore: 'soggiorno troppo lungo' };

  /* assente vuol dire due, il caso normale; presente ma assurdo e' un errore
     da segnalare, non da correggere di nascosto */
  let ospiti = 2;
  if (b.ospiti !== undefined && b.ospiti !== null && testo(b.ospiti) !== '') {
    ospiti = Number(b.ospiti);
    if (!Number.isInteger(ospiti) || ospiti < 1 || ospiti > OSPITI_MAX) {
      return { errore: 'numero di ospiti non valido' };
    }
  }

  const tipo_camera = testo(b.tipo_camera);
  if (tipo_camera.length > LIMITI.tipo_camera) return { errore: 'camera troppo lunga' };
  const pacchetto = testo(b.pacchetto);
  if (pacchetto.length > LIMITI.pacchetto) return { errore: 'pacchetto troppo lungo' };
  const messaggio = testo(b.messaggio);
  if (messaggio.length > LIMITI.messaggio) return { errore: 'messaggio troppo lungo' };

  return {
    dati: {
      nome, email, telefono,
      check_in: ci, check_out: co, notti,
      ospiti, tipo_camera, pacchetto, messaggio, lingua,
    },
  };
}

export type ParametriDisponibilita = {
  check_in: string;
  check_out: string;
  adulti: number;
  bambini: number;
  eta_bambini: number[];
};

/* Quanti bambini si possono mettere in una ricerca, e che eta' e' un'eta' da
   bambino. Il tetto sui bambini serve prima ancora della plausibilita': senza,
   `eta_bambini` poteva essere un array di diecimila elementi qualsiasi,
   inoltrato cosi' com'era al sito vero dell'hotel. */
const BAMBINI_MAX = 6;
const ETA_BAMBINO_MAX = 17;

/* Convalida gli argomenti dell'azione a=disponibilita con gli STESSI limiti
   della casa gia' usati sopra per una richiesta di soggiorno vera (date che
   esistono, partenza dopo l'arrivo, non nel passato, non troppo lontane ne'
   troppo lunghe, un tetto sugli ospiti): qui pero' non c'e' ancora un
   ospite identificato, solo una ricerca, quindi niente contatti da
   convalidare. Chiamata PRIMA di interrogare check-availability: una data
   assurda respinta qui e' anche una chiamata in meno al servizio a monte. */
export function validaParametriDisponibilita(
  b: Record<string, unknown>,
  oggi: Date = new Date(),
): { errore?: string; dati?: ParametriDisponibilita } {
  const ci = testo(b.check_in), co = testo(b.check_out);
  if (!ci || !co) return { errore: 'date mancanti' };
  const arrivo = giorno(ci), partenza = giorno(co);
  if (arrivo === null || partenza === null) return { errore: 'date non valide' };
  if (partenza <= arrivo) return { errore: 'la partenza precede l’arrivo' };

  const adesso = Date.UTC(oggi.getUTCFullYear(), oggi.getUTCMonth(), oggi.getUTCDate());
  if (arrivo < adesso) return { errore: 'arrivo nel passato' };
  const limite = new Date(adesso);
  limite.setUTCFullYear(limite.getUTCFullYear() + ANNI_AVANTI);
  if (arrivo > limite.getTime()) return { errore: 'arrivo troppo lontano' };

  const notti = Math.round((partenza - arrivo) / GIORNO_MS);
  if (notti > NOTTI_MAX) return { errore: 'soggiorno troppo lungo' };

  /* assente vuol dire due, il caso normale; presente ma assurdo e' un
     errore da segnalare, non da correggere di nascosto — stesso criterio
     usato sopra per gli ospiti di una richiesta */
  let adulti = 2;
  if (b.adulti !== undefined && b.adulti !== null && testo(b.adulti) !== '') {
    adulti = Number(b.adulti);
    if (!Number.isInteger(adulti) || adulti < 1 || adulti > OSPITI_MAX) {
      return { errore: 'numero di adulti non valido' };
    }
  }

  /* Gli adulti erano validati con rigore, i bambini per niente: Number('due')
     dava NaN e finiva a null, e le eta' passavano cosi' com'erano. L'azione e'
     pubblica — era l'unico argomento che scavalcava il presidio. */
  let bambini = 0;
  if (b.bambini !== undefined && b.bambini !== null && testo(b.bambini) !== '') {
    bambini = Number(b.bambini);
    if (!Number.isInteger(bambini) || bambini < 0 || bambini > BAMBINI_MAX) {
      return { errore: 'numero di bambini non valido' };
    }
  }

  /* Un'eta' per ogni bambino, ne' una in piu' ne' una in meno: il motore
     tariffa i bambini per fascia d'eta', e un elenco che non combacia col
     numero di bambini produce un prezzo che poi viene mostrato e archiviato. */
  const grezze = b.eta_bambini;
  if (bambini > 0 || (grezze !== undefined && grezze !== null)) {
    if (!Array.isArray(grezze) || grezze.length !== bambini) {
      return { errore: 'eta dei bambini non valide' };
    }
  }
  const eta_bambini: number[] = [];
  for (const v of (Array.isArray(grezze) ? grezze : [])) {
    const e = Number(v);
    if (!Number.isInteger(e) || e < 0 || e > ETA_BAMBINO_MAX) {
      return { errore: 'eta dei bambini non valide' };
    }
    eta_bambini.push(e);
  }

  /* Lo stesso tetto dell'invio, che conta adulti + bambini: prima la ricerca
     ammetteva 10 adulti PIU' i bambini, cosi' 8 adulti e 3 bambini cercavano,
     sceglievano, compilavano tutto e venivano respinti alla fine. */
  if (adulti + bambini > OSPITI_MAX) return { errore: 'troppe persone in una richiesta' };

  return { dati: { check_in: ci, check_out: co, adulti, bambini, eta_bambini } };
}
