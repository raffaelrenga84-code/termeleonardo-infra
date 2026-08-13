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

/* Chi chiede e come lo si richiama: uguale per tutti i tipi di richiesta.
   Un transfer o un green fee non hanno un periodo di soggiorno, ma hanno
   sempre una persona dietro. */
export function validaContatti(b: Record<string, unknown>): { errore?: string; dati?: Contatti } {
  const nome = testo(b.nome);
  if (!nome) return { errore: 'nome mancante' };
  if (nome.length > LIMITI.nome) return { errore: 'nome troppo lungo' };

  const email = testo(b.email);
  if (email.length > LIMITI.email) return { errore: 'email troppo lunga' };
  if (!/.+@.+\..+/.test(email)) return { errore: 'email non valida' };

  const telefono = testo(b.telefono);
  if (telefono.length > LIMITI.telefono) return { errore: 'telefono troppo lungo' };

  const lingua = ['it', 'de', 'en', 'fr'].includes(testo(b.lingua)) ? testo(b.lingua) : 'it';
  return { dati: { nome, email, telefono, lingua } };
}

export function validaRichiesta(
  b: Record<string, unknown>,
  oggi: Date = new Date(),
): { errore?: string; dati?: Richiesta } {
  const c = validaContatti(b);
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
