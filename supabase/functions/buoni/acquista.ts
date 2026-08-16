/* ============================================================
   acquista.ts — validazione dell'acquisto pubblico (?a=acquista).
   Il listino qui sotto è la sola fonte dei prezzi: il valore che
   arriva dal browser conta solo per i buoni a importo libero,
   e anche lì entro i limiti del regolamento.
   ============================================================ */

import { calcolaScadenza, data as dataValida, type Scadenza, type Stagione } from './scadenza.ts';
import { validaFattura, type DatiFattura } from './fattura.ts';

export const LISTINO: Record<string, [string, number]> = {
  progCoccola: ['Programma Coccola — pulizia viso completa + manicure', 90],
  progViso: ['Programma Viso Antirughe — pulizia completa + collagene', 90],
  progTermale: ['Programma Viso Termale — pulizia + trattamento termale', 95],
  progAntistress: ['Programma Antistress — scrub Mar Morto + massaggio + viso al fango', 130],
  progOriente: ['Programma Oriente — Ayurveda + viso alla vitamina C', 130],
  relax25: ['Massaggio Relax (con olio di cacao) (25 min)', 40],
  plantare25: ['Massaggio riflessologia plantare (25 min)', 40],
  candle25: ['Massaggio Body Candle (25 min)', 48],
  antistress45: ['Massaggio antistress (45 min)', 55],
  ayurveda55: ['Massaggio Ayurveda (55 min)', 65],
  hotstone55: ['Massaggio Hot Stone (55 min)', 65],
  pindasweda55: ['Massaggio Pindasweda (55 min)', 65],
  linfo60: ['Linfodrenaggio completo (60 min)', 65],
  shiatzu50: ['Massaggio Shiatzu (50 min)', 70],
  visofango25: ['Trattamento viso al fango termale con massaggio (25 min)', 44],
  pulizia55: ['Pulizia viso completa con peeling e maschera (55 min)', 60],
  ialuronico55: ['Trattamento anti-age all’acido ialuronico (55 min)', 80],
  collagene55: ['Trattamento anti-age collagene naturale (55 min)', 80],
  scrubmar40: ['Scrub corpo ai sali del Mar Morto (40 min)', 55],
  riducente55: ['Trattamento riducente-anticellulite al fango (55 min)', 70],
  /* gli orari fanno parte della descrizione: il serale vale solo venerdì e
     sabato, e chi riceve il buono deve poterlo leggere sul buono stesso.
     Il "Day Spa pomeridiano" non esiste: il pomeriggio è già compreso nel
     giornaliero, e i 29 € sono l'ingresso serale. */
  dayspa_fer: ['Day Spa infrasettimanale — piscine e grotte, dal lunedì al venerdì, 9.00–18.30', 35],
  dayspa_wknd: ['Day Spa festivo — piscine e grotte, sabato, domenica e festivi, 9.00–18.30', 45],
  dayspa_sera: ['Day Spa serale — piscine e grotte, venerdì e sabato, 18.00–22.30', 29]
  /* Qui sotto stava `dayspa_pom`, il vecchio identificativo del serale,
     tenuto perché una pagina rimasta in cache poteva ancora mandarlo. Il
     commento diceva «si può togliere fra qualche giorno»: tolto il 15
     agosto 2026, con zero buoni venduti — il momento in cui non può averlo
     in mano nessuno. Da oggi quell'id viene rifiutato come qualunque altro
     sconosciuto, e un test lo verifica. */
};

const TESTO_VALORE: Record<string, (v: string) => string> = {
  it: (v) => `Buono valore di ${v} €, spendibile in hotel`,
  de: (v) => `Wertgutschein über ${v} €, im Hotel einlösbar`,
  en: (v) => `Gift voucher worth ${v} €, redeemable at the hotel`,
  fr: (v) => `Bon d’une valeur de ${v} €, utilisable à l’hôtel`
};
const eurS = (n: number) => n.toLocaleString('it-IT', { minimumFractionDigits: 2 });

export interface DatiAcquisto {
  tipo: 'servizio' | 'valore';
  voce_id: string | null;
  voci: Voce[];
  descrizione: string;
  valore: number;
  lingua: string;
  acquirente: string;
  acquirente_email: string;
  destinatario: string;
  destinatario_email: string;
  ricevuta_email: string;
  dedica: string;
  scade_il: string;
  scade_il_base: string;
  prorogato: boolean;
  /** dati e scelta privato/azienda per la fattura: vedi fattura.ts.
   *  fatt_richiesta è false e tutto il resto null quando l'ospite non ha
   *  spuntato «Mi serve la fattura» — la fattura non serve a tutti. */
  fattura: DatiFattura;
}

export type Voce = { voce_id: string; quantita: number };

/* Due voci al massimo: sotto le voci, sul foglio del buono, c'e' la
   descrizione di cosa comprendono, e con tre quel testo non ci sta piu'.
   Quattro come quantita' copre la famiglia o il gruppo di amici senza
   trasformare un regalo in un ordine all'ingrosso.
   Il messaggio sotto ("al massimo due voci") e' scritto per esteso e non
   derivato da VOCI_MAX: un numero tradotto in parola italiana corretta per
   ogni valore possibile sarebbe piu' complicato del problema che risolve,
   per una costante che il vincolo qui sopra (lo spazio sul foglio del
   buono) lega fisicamente a "due" e che quindi non cambia da sola — se
   cambiasse, il messaggio va riscritto a mano insieme al codice. */
const VOCI_MAX = 2;
const QUANTITA_MAX = 4;

/* Il Day Spa serale vale solo venerdi' e sabato dalle 18.00 alle 22.30, e a
   quell'ora il centro benessere non fa trattamenti: un buono "serale +
   massaggio" sarebbe un buono che il cliente non potrebbe usare come gli
   e' stato venduto. La nota in fondo al buono non promette piu' "venga in
   momenti diversi, come preferisce" — tolta apposta dalla proprieta' (vedi
   ETI.nota in pagine/buoni/buono.js) perche' complicava le riscossioni
   parziali in reception — quindi non basta rimandare il problema al
   cliente, va rifiutato qui. Un altro ingresso Day Spa (anche un secondo
   serale) resta libero di combinarsi: e' un ingresso, non un trattamento
   che pretende il centro aperto.
   eIngressoDaySpa guarda solo il prefisso, come categoriaBuono in
   buono.js: qui e' sicuro perche' l'id e' gia' passato dal controllo
   Object.hasOwn(LISTINO, id) qui sopra, non una chiave arrivata da fuori
   senza prima essere stata verificata. */
/* Fino al 15 agosto 2026 qui c'era anche `dayspa_pom`, il vecchio
   identificativo del serale, tenuto perche' una pagina in cache poteva
   ancora mandarlo. E' stato tolto su decisione della proprieta': ora
   quell'id non e' piu' a listino e viene rifiutato come qualunque altro
   sconosciuto. Il momento scelto e' quello giusto — zero buoni venduti,
   quindi nessuno puo' averlo in mano. */
const eSerale = (id: string) => id === 'dayspa_sera';
const eIngressoDaySpa = (id: string) => id.startsWith('dayspa');
const ERRORE_SERALE_TRATTAMENTO =
  'il Day Spa serale non si può abbinare a un trattamento: di sera il centro non fa trattamenti — scelga il Day Spa infrasettimanale o festivo';

/* Le voci arrivano dal cliente: si normalizzano prima di toccare il listino.
   Chi sceglie due volte la stessa voce sta dicendo una quantita', non due
   voci — e se non si sommassero, il tetto di quattro si aggirerebbe
   scegliendo la stessa voce due volte.
   Il controllo sul cumulo (quantita' e numero di voci diverse) sta dentro
   lo stesso ciclo che scandisce l'elenco, non in un secondo giro sulla
   Map dopo: un elenco enorme viene rifiutato alla prima voce di troppo,
   non dopo averlo scandito per intero. */
function normalizzaVoci(grezze: unknown, voceSingola: unknown):
  { errore?: string; voci?: Voce[] } {
  let elenco: Array<Record<string, unknown>> = [];
  if (Array.isArray(grezze) && grezze.length) {
    elenco = grezze as Array<Record<string, unknown>>;
  } else if (voceSingola) {
    elenco = [{ voce_id: voceSingola, quantita: 1 }];
  }
  if (!elenco.length) return { errore: 'voce di listino sconosciuta' };

  const somma = new Map<string, number>();
  for (const v of elenco) {
    const id = String(v?.voce_id ?? '');
    /* proprieta' proprie soltanto: 'toString', 'constructor', '__proto__'
       esistono su qualunque oggetto letterale per ereditarieta' da
       Object.prototype e sarebbero truthy con un accesso diretto
       LISTINO[id] — una funzione, o per '__proto__' l'oggetto prototipo
       stesso — lasciando passare una voce fasulla fino al calcolo del
       prezzo, con NaN al posto di un rifiuto. Stesso precedente della
       lingua in condizioni.ts. */
    if (!Object.hasOwn(LISTINO, id)) return { errore: 'voce di listino sconosciuta' };
    const q = Number(v?.quantita ?? 1);
    if (!Number.isInteger(q) || q < 1 || q > QUANTITA_MAX) {
      return { errore: `quantita fuori dai limiti (1-${QUANTITA_MAX})` };
    }
    const cumulata = (somma.get(id) ?? 0) + q;
    if (cumulata > QUANTITA_MAX) {
      return { errore: `quantita fuori dai limiti (1-${QUANTITA_MAX})` };
    }
    somma.set(id, cumulata);
    if (somma.size > VOCI_MAX) return { errore: 'al massimo due voci' };
  }

  const voci = [...somma].map(([voce_id, quantita]) => ({ voce_id, quantita }));
  /* il controllo guarda l'elenco finito, non voce per voce dentro il ciclo
     qui sopra: l'ordine in cui il cliente ha scelto le due voci non deve
     cambiare l'esito, e con VOCI_MAX a due il costo di un secondo giro
     minuscolo su un elenco di al massimo due elementi non vale la
     complicazione di anticiparlo dentro il primo */
  if (voci.some((v) => eSerale(v.voce_id)) && voci.some((v) => !eIngressoDaySpa(v.voce_id))) {
    return { errore: ERRORE_SERALE_TRATTAMENTO };
  }
  return { voci };
}

/* "4 x Day Spa festivo", senza numero quando la voce e' una sola e la
   quantita' e' uno: "1 x Massaggio" e' il modo in cui un modulo dice a un
   essere umano che l'ha compilato una macchina. Ma con piu' di una voce il
   numero si scrive su TUTTE, anche dove vale uno: sul buono vero la
   proprieta' ha visto "2 × Day Spa" sopra e "Scrub" sotto, senza numero — e
   quella riga senza numero sembrava una quantita' non specificata, non una
   quantita' di uno. L'asimmetria fra una riga col numero e una senza fa
   dubitare, la stessa forma su tutte le righe no. Una riga per voce: email
   e stampa spezzano gia' la descrizione sui ritorni a capo. */
export function componiDescrizione(voci: Voce[]): string {
  const mostraNumero = voci.length > 1;
  return voci.map((v) => {
    const nome = LISTINO[v.voce_id][0];
    return (mostraNumero || v.quantita > 1) ? `${v.quantita} × ${nome}` : nome;
  }).join('\n');
}

export function sommaVoci(voci: Voce[]): number {
  return voci.reduce((t, v) => t + LISTINO[v.voce_id][1] * v.quantita, 0);
}

/* Cosa finisce nella colonna jsonb voci al salvataggio. null e [] sono due
   cose diverse per chi legge i dati — il back office le distingue — e un
   buono monetario non ha scelto niente da un elenco: la colonna resta
   null, non un array vuoto. */
export function colonnaVoci(voci: Voce[]): Voce[] | null {
  return voci.length ? voci : null;
}

export function validaAcquisto(b: Record<string, unknown>, stagioni: Stagione[] = []):
  { errore?: string; dati?: DatiAcquisto } {
  const lingua = ['it', 'de', 'en', 'fr'].includes(String(b.lingua)) ? String(b.lingua) : 'it';
  const email = String(b.acquirente_email || '').trim();
  if (!/.+@.+\..+/.test(email)) return { errore: 'email non valida' };

  /* prezzo e descrizione: SOLO dal listino server o dal valore validato */
  const tipo = b.tipo === 'valore' ? 'valore' : 'servizio';
  let voce_id: string | null = null, descrizione = '', valore = 0;
  let voci: Voce[] = [];
  if (tipo === 'servizio') {
    const n = normalizzaVoci(b.voci, b.voce_id);
    if (n.errore || !n.voci) return { errore: n.errore };
    voci = n.voci;
    /* voce_id resta valorizzato con la prima voce: la fotografia del buono
       la sceglie fotoBuono() da li', e con due voci si prende quella della
       prima — che e' la prima che l'ospite ha scelto e la prima che legge */
    voce_id = voci[0].voce_id;
    descrizione = componiDescrizione(voci);
    valore = sommaVoci(voci);
  } else {
    valore = Math.round(Number(b.valore) || 0);
    if (!(valore >= 25 && valore <= 1000))
      return { errore: 'importo fuori dai limiti (25–1000 €)' };
    descrizione = (TESTO_VALORE[lingua] || TESTO_VALORE.it)(eurS(valore));
  }

  /* chiusura stagionale, niente rimborso, 12 mesi: chi compra deve averle
     accettate prima di pagare. Il controllo sta anche qui e non solo nella
     pagina, altrimenti basterebbe una chiamata diretta per saltarlo. */
  if (b.condizioni_accettate !== true) return { errore: 'condizioni non accettate' };
  /* Consenso distinto da quello sulle condizioni: le condizioni si
     accettano, dell'informativa privacy si prende atto. In un campo solo
     sarebbero indistinguibili se qualcuno chiedesse conto di quale dei due
     e' stato dato — ed e' il genere di domanda che arriva mesi dopo. */
  if (b.privacy_presa_atto !== true) return { errore: 'informativa privacy non accettata' };

  /* dati fattura: solo raccolta e validazione, qui — niente XML, niente
     numerazione (vedi fattura.ts). Con la spunta spenta f.dati torna
     comunque valorizzato (fatt_richiesta: false, il resto null): non
     c'e' un ramo "senza fattura" da gestire a parte qui sotto. */
  const f = validaFattura(b);
  if (f.errore) return { errore: f.errore };

  /* scadenza: dodici mesi, spostati se cadrebbero ad albergo chiuso.
     Le stagioni arrivano da fuori (tabella stagione_chiusura): qui non
     c'e' nessuna data scritta a mano, apposta. */
  const scadenza = calcolaScadenza(new Date(), stagioni);

  return { dati: {
    tipo, voce_id, voci, descrizione, valore, lingua,
    fattura: f.dati!,
    acquirente: String(b.acquirente || '').trim().slice(0, 120),
    acquirente_email: email.slice(0, 160),
    destinatario: String(b.destinatario || '').trim().slice(0, 120),
    destinatario_email: String(b.destinatario_email || '').trim().slice(0, 160),
    /* riepilogo d'acquisto a un altro indirizzo, per chi compra
       per l'azienda: si accetta solo se e' un indirizzo plausibile */
    ricevuta_email: /.+@.+\..+/.test(String(b.ricevuta_email || '').trim())
      ? String(b.ricevuta_email).trim().slice(0, 160) : '',
    dedica: String(b.dedica || '').trim().slice(0, 400),
    scade_il: scadenza.scade_il,
    scade_il_base: scadenza.scade_il_base,
    prorogato: scadenza.prorogato
  } };
}

/* Cinque anni oltre oggi: abbondante per qualunque validità vera (un anno,
   raramente prorogata di qualche mese in più), stretto abbastanza da
   intercettare un anno scritto per sbaglio (9999, o un 2036 al posto di
   2026) senza mai disturbare un caso reale. */
const ANNI_MAX_MANUALE = 5;

/* Il ramo di creazione manuale in back office (?a=crea, index.ts): la
   reception vende un buono al banco o ne crea uno omaggio, e l'operatore
   può scrivere una scadenza a mano per un caso particolare. Se lo fa,
   quella data è definitiva — non è "quella naturale" che il calcolo
   potrebbe ancora prorogare, e non va MAI fatta ripassare da
   calcolaScadenza: e' la decisione dell'operatore, non un dato da
   correggere. scade_il_base si valorizza comunque con la stessa data:
   il foglio legge sempre quella colonna per scrivere «sarebbe scaduto
   il...», e lasciarla vuota gli toglierebbe di cosa scrivere, non gli
   direbbe "nessuna proroga".
   Senza una data scritta a mano, si calcola come fa il sito: stessa
   regola, stessa proroga se la scadenza cade a hotel chiuso.

   LA DATA SCRITTA A MANO VA VALIDATA QUI, PRIMA DI POSTGRES. Trovato in
   revisione: senza controllo, un anno digitato per sbaglio (2025 invece di
   2026 — l'errore tipico nei primi mesi dell'anno) faceva nascere il buono
   già scaduto. Nessun errore, nessun avviso: lo si scopriva mesi dopo, al
   banco, con i contanti già in cassa e nessuno che ricollegava più le due
   cose. Si riusa `data()` di scadenza.ts (regex piu' andata-e-ritorno, che
   scarta anche un 31 novembre che altrimenti scivolerebbe silenziosamente
   al 1 dicembre) invece di riscriverlo: due copie dello stesso controllo
   divergono, una sola no. */
export function scadenzaCrea(scadeManuale: string | undefined, stagioni: Stagione[]):
  { errore?: string; scadenza?: Scadenza } {
  if (!scadeManuale) return { scadenza: calcolaScadenza(new Date(), stagioni) };

  const d = dataValida(scadeManuale);
  if (!d) return { errore: 'la scadenza scritta non è una data valida' };

  const oggi = new Date();
  const oggiUTC = new Date(Date.UTC(oggi.getUTCFullYear(), oggi.getUTCMonth(), oggi.getUTCDate(), 12));
  if (d < oggiUTC) return { errore: 'la scadenza scritta è già nel passato' };

  const limite = new Date(Date.UTC(
    oggi.getUTCFullYear() + ANNI_MAX_MANUALE, oggi.getUTCMonth(), oggi.getUTCDate(), 12));
  if (d > limite) return { errore: 'la scadenza scritta è troppo lontana nel futuro' };

  return { scadenza: { scade_il: scadeManuale, scade_il_base: scadeManuale, prorogato: false } };
}
