/* ============================================================
   riepilogo.ts — la riga che dice, in un colpo d'occhio, di che
   richiesta si tratta.

   Nasce da un difetto visto in una schermata vera del back office.
   L'elenco mostrava periodo, notti e ospiti per OGNI richiesta, anche
   quando era un transfer o dei trattamenti — campi che quei tipi non
   hanno mai avuto. Il risultato:

       →   ·   null notti · null ospiti

   e il contenuto vero (quali trattamenti, che giorno, a che ora, da quale
   aeroporto) restava invisibile, sepolto nella colonna `dati`.

   Modulo puro: dati dentro, una riga di testo fuori. Nessuna rete, nessun
   database. Ogni pezzo della riga compare solo se il dato che lo riguarda
   e' presente e valido: un campo mancante fa sparire quel pezzo, mai
   comparire come "null", "undefined" o "NaN". Le richieste vecchie possono
   avere buchi — e' il caso normale, non l'eccezione.
   ============================================================ */

import { CIRCOLI_GOLF } from './luoghi.ts';

export type Riga = { etichetta: string; riepilogo: string };

type Richiesta = {
  tipo?: string;
  dati?: Record<string, unknown> | null;
  check_in?: string | null;
  check_out?: string | null;
  notti?: number | null;
  ospiti?: number | null;
};

const MESI_LUNGHI = [
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
];
const MESI_BREVI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

/* la data deve esistere davvero e avere la forma attesa: un valore mancante
   o scritto a caso deve sparire dalla riga, non comparirci come "NaN
   NaN" o "Invalid Date" */
function scomponiData(v: unknown): { g: number; m: number; a: number } | null {
  const s = String(v ?? '');
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const a = Number(m[1]), mese = Number(m[2]), g = Number(m[3]);
  if (mese < 1 || mese > 12 || g < 1 || g > 31) return null;
  return { g, m: mese, a };
}

const dataLunga = (v: unknown): string => {
  const d = scomponiData(v);
  return d ? `${d.g} ${MESI_LUNGHI[d.m - 1]}` : '';
};

const dataBreve = (v: unknown): string => {
  const d = scomponiData(v);
  return d ? `${d.g} ${MESI_BREVI[d.m - 1]}` : '';
};

const dataConAnno = (v: unknown): string => {
  const d = scomponiData(v);
  return d ? `${String(d.g).padStart(2, '0')}/${String(d.m).padStart(2, '0')}/${d.a}` : '';
};

const oraValida = (v: unknown): string => {
  const s = String(v ?? '');
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(s) ? s : '';
};

/* un intero non negativo, o niente: "0" e' un dato vero e si mostra,
   null/undefined/una stringa vuota/NaN non sono un numero e spariscono
   dalla riga invece di comparirci come tali */
function numeroValido(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

const conPlurale = (n: number, singolare: string, plurale: string): string =>
  `${n} ${n === 1 ? singolare : plurale}`;

/* Il dato salvato NON si tocca: alcune voci del modulo ATAM hanno spazi
   doppi copiati testualmente dal loro elenco (vedi luoghi.ts, "Venezia
   aeroporto" con due spazi), e restano cosi' perche' la reception li
   ricopia parola per parola nel modulo dei tassisti. Ma questa riga e' la
   VETRINA di quel dato, non il dato: qui gli spazi doppi si riducono a uno,
   cosi' si legge come la leggerebbe una persona. */
const unoSpazio = (s: string): string => s.replace(/\s+/g, ' ').trim();

/* Il modulo ATAM chiede data/ora/persone e un luogo dal suo elenco chiuso;
   qui basta sapere in che verso va il taxi. Senza un luogo non c'e' niente
   da dire: meglio un pezzo mancante che una freccia con un lato vuoto. */
function direzioneTransfer(d: Record<string, unknown>): string {
  const luogo = unoSpazio(String(d.luogo ?? ''));
  if (!luogo) return '';
  const verso = String(d.verso ?? '').trim();
  if (verso === 'arrivo') return `${luogo} → hotel`;
  if (verso === 'partenza') return `hotel → ${luogo}`;
  /* un verso mancante o sconosciuto non autorizza a indovinare la
     direzione: si mostra solo il luogo */
  return luogo;
}

/* Il nome per esteso, `circolo_nome`, e' quello buono: tipi.ts lo salva gia'
   apposta (vedi validaGreenfee), preso da CIRCOLI_GOLF al momento della
   richiesta. E' la PRIMA scelta. La chiave capitalizzata e' solo un ripiego
   per le richieste vecchie che non ce l'hanno ancora — e resta verificata
   con Object.hasOwn contro CIRCOLI_GOLF, mai una chiave sbagliata travestita
   da nome inventato. */
function nomeCircoloBreve(d: Record<string, unknown>): string {
  const nomeCompleto = unoSpazio(String(d.circolo_nome ?? ''));
  if (nomeCompleto) return nomeCompleto;
  const chiave = String(d.circolo ?? '').trim();
  if (chiave && Object.hasOwn(CIRCOLI_GOLF, chiave)) {
    return chiave.charAt(0).toUpperCase() + chiave.slice(1);
  }
  return '';
}

/* Uguale per 'soggiorno' e per un tipo non riconosciuto: e' il comportamento
   di prima del difetto, e resta un fallback onesto quando non si sa altro
   sulla richiesta. */
function riepilogoSoggiorno(r: Richiesta): string {
  const periodo = [dataConAnno(r.check_in), dataConAnno(r.check_out)].filter(Boolean).join(' → ');
  const notti = numeroValido(r.notti);
  const ospiti = numeroValido(r.ospiti);
  return [
    periodo,
    notti !== null ? conPlurale(notti, 'notte', 'notti') : '',
    ospiti !== null ? conPlurale(ospiti, 'ospite', 'ospiti') : '',
  ].filter(Boolean).join(' · ');
}

/* Una riga vuota in elenco e' lo stesso difetto di partenza vestito
   diverso: chi guarda non sa se la richiesta non ha dettagli o se il back
   office si e' rotto. Meglio dirlo. Applicato in un solo punto, alla fine,
   cosi' vale per tutti i tipi (compreso il fallback di un tipo sconosciuto)
   senza doverlo ripetere in ogni ramo. */
const NESSUN_DETTAGLIO = 'nessun dettaglio indicato';

export function riepilogoRichiesta(r: Richiesta): Riga {
  const tipo = typeof r?.tipo === 'string' ? r.tipo : '';
  const d = r?.dati && typeof r.dati === 'object' ? (r.dati as Record<string, unknown>) : {};

  let etichetta: string;
  let riepilogo: string;

  /* elenco chiuso via switch, mai un OGGETTO[tipo]: un tipo come "toString"
     esiste su Object.prototype, e una lookup diretta ci cascherebbe */
  switch (tipo) {
    case 'trattamenti': {
      const voci = Array.isArray(d.voci) ? d.voci : [];
      const fasciaGrezza = typeof d.fascia === 'string' ? unoSpazio(d.fascia) : '';
      /* "indifferente" da sola non dice a cosa si riferisce, in mezzo a
         conteggio e data: si preferisce dirlo per esteso piuttosto che
         ometterlo, per lo stesso motivo per cui una riga vuota non basta */
      const fascia = fasciaGrezza === 'indifferente' ? 'orario indifferente' : fasciaGrezza;
      etichetta = 'Trattamenti';
      riepilogo = [
        voci.length > 0 ? conPlurale(voci.length, 'trattamento', 'trattamenti') : '',
        dataLunga(d.giorno),
        fascia,
      ].filter(Boolean).join(' · ');
      break;
    }

    case 'transfer': {
      const quandoOra = [dataBreve(d.quando), oraValida(d.ora)].filter(Boolean).join(' ');
      const pax = numeroValido(d.pax);
      etichetta = 'Transfer';
      riepilogo = [
        direzioneTransfer(d),
        quandoOra,
        pax !== null ? conPlurale(pax, 'persona', 'persone') : '',
      ].filter(Boolean).join(' · ');
      break;
    }

    case 'greenfee': {
      const quandoOra = [dataBreve(d.data), oraValida(d.ora)].filter(Boolean).join(' ');
      const giocatori = numeroValido(d.giocatori);
      etichetta = 'Green fee';
      riepilogo = [
        nomeCircoloBreve(d),
        quandoOra,
        giocatori !== null ? conPlurale(giocatori, 'giocatore', 'giocatori') : '',
      ].filter(Boolean).join(' · ');
      break;
    }

    case 'maestro': {
      const quandoOra = [dataBreve(d.data), oraValida(d.ora)].filter(Boolean).join(' ');
      const persone = numeroValido(d.persone);
      const livello = typeof d.livello === 'string' ? unoSpazio(d.livello) : '';
      etichetta = 'Maestro';
      riepilogo = [
        quandoOra,
        persone !== null ? conPlurale(persone, 'persona', 'persone') : '',
        livello,
      ].filter(Boolean).join(' · ');
      break;
    }

    case 'dayspa': {
      const p = numeroValido(d.persone);
      etichetta = 'Day Spa';
      riepilogo = [
        p !== null ? conPlurale(p, 'persona', 'persone') : '',
        dataLunga(d.giorno),
      ].filter(Boolean).join(' · ');
      break;
    }

    case 'soggiorno':
      etichetta = 'Soggiorno';
      riepilogo = riepilogoSoggiorno(r);
      break;

    default:
      /* tipo assente, mai visto, o un nome ereditato come "toString": una
         riga generica col periodo se c'e' e' meglio di un errore o di un
         vuoto senza spiegazione */
      etichetta = 'Richiesta';
      riepilogo = riepilogoSoggiorno(r);
      break;
  }

  return { etichetta, riepilogo: riepilogo || NESSUN_DETTAGLIO };
}
