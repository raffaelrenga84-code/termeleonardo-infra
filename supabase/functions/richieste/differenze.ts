/* ============================================================
   differenze.ts — cosa la reception ha cambiato rispetto a
   quello che l'ospite aveva chiesto.

   L'originale (quello arrivato dal sito) e il corrente (quello che la
   reception sta per confermare) sono due jsonb della stessa forma, presa
   da tipi.ts. Questo modulo li confronta campo per campo e restituisce solo
   quello che e' CAMBIATO — non un dump dei due oggetti.

   Il confronto e' sui VALORI, non sugli oggetti: due elenchi di trattamenti
   con le stesse voci in ordine diverso non sono una modifica. Segnalarli
   farebbe scrivere all'ospite "aveva chiesto X, le confermiamo X" — falso,
   e la specie di dettaglio che fa perdere fiducia in tutto il resto
   dell'email.

   Modulo puro: dati dentro, un elenco di differenze fuori. Nessuna rete,
   nessun database.
   ============================================================ */

export type Differenza = { campo: string; prima: string; adesso: string };

const MESI_LUNGHI = [
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
];

/* gli stessi campi "giorno del servizio" che tipi.ts convalida per ogni
   tipo (quando/data/giorno): solo questi si scrivono per esteso con l'anno,
   come li legge una persona e non come li scrive Postgres */
const CAMPI_DATA = new Set(['quando', 'data', 'giorno']);

function dataEstesa(v: unknown): string {
  const s = String(v ?? '');
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return s; // non e' una data riconoscibile: si mostra cosi' com'e', non si inventa niente
  const a = Number(m[1]), mese = Number(m[2]), g = Number(m[3]);
  if (mese < 1 || mese > 12) return s;
  return `${g} ${MESI_LUNGHI[mese - 1]} ${a}`;
}

/* Lo stesso trabocchetto gia' incontrato in email-richiesta.ts: prezzo_cent
   e caparra_cent sono CENTESIMI. 31000 e' 310,00 euro, e nessuno in
   reception deve leggere "31000" pensando che siano euro. */
const CAMPI_CENTESIMI = new Set(['prezzo_cent', 'caparra_cent']);

function euro(v: unknown): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return '';
  return (n / 100).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

/* Il nome leggibile di ogni campo, raccolto guardando tipi.ts: uno per ogni
   tipo di richiesta, piu' quelli comuni. Uno switch e non un oggetto
   indicizzato: una chiave come "toString" esiste su Object.prototype, e una
   lookup diretta (OGGETTO[chiave]) ci cascherebbe restituendo la funzione
   ereditata invece di sparire in un caso di riserva onesto. */
export function etichettaCampo(chiave: string): string {
  switch (chiave) {
    case 'quando': case 'data': return 'Data';
    case 'giorno': return 'Giorno';
    case 'ora': return 'Ora';
    case 'note': return 'Note';
    // ---- transfer ----
    case 'pax': return 'Passeggeri';
    case 'verso': return 'Arrivo o partenza';
    case 'luogo': return 'Luogo';
    case 'volo': return 'Volo';
    case 'ritorno': return 'Ritorno incluso';
    case 'ritorno_quando': return 'Giorno del ritorno';
    case 'ritorno_ora': return 'Ora del ritorno';
    case 'ora_volo': return 'Ora del volo';
    case 'collettivo': return 'Servizio';
    // ---- green fee ----
    case 'circolo': return 'Circolo';
    case 'circolo_nome': return 'Nome del circolo';
    case 'giocatori': return 'Giocatori';
    case 'percorso': return 'Percorso';
    case 'golfcar': return 'Golf car';
    case 'carrello': return 'Carrello';
    case 'carrello_elettrico': return 'Carrello elettrico';
    case 'sacca': return 'Sacca';
    case 'tessera': return 'Tessera';
    case 'taxi': return 'Taxi al campo';
    case 'taxi_ora': return 'Ora del taxi';
    case 'taxi_ritorno': return 'Ritorno del taxi incluso';
    case 'taxi_luogo': return 'Luogo del taxi';
    // ---- maestro ----
    case 'persone': return 'Persone';
    case 'livello': return 'Livello';
    // ---- trattamenti ----
    case 'voci': return 'Trattamenti scelti';
    case 'fascia': return 'Fascia oraria';
    // ---- soggiorno (dati.camera) ----
    case 'camera_id': case 'nome_camera': return 'Camera';
    case 'variante_id': return 'Variante';
    case 'tariffa': return 'Tariffa';
    case 'trattamento': return 'Trattamento';
    case 'prezzo_cent': return 'Prezzo';
    case 'valuta': return 'Valuta';
    case 'caparra_cent': return 'Caparra';
    case 'adulti': return 'Adulti';
    case 'bambini': return 'Bambini';
    default:
      /* un campo non ancora previsto qui non deve far sparire la
         differenza: meglio il nome tecnico capitalizzato che niente */
      return chiave ? chiave.charAt(0).toUpperCase() + chiave.slice(1) : chiave;
  }
}

function formattaValore(chiave: string, v: unknown): string {
  if (v === null || v === undefined) return '';
  if (CAMPI_DATA.has(chiave)) return dataEstesa(v);
  if (CAMPI_CENTESIMI.has(chiave)) return euro(v);
  if (typeof v === 'boolean') return v ? 'Sì' : 'No';
  if (Array.isArray(v)) return v.map((x) => String(x ?? '').trim()).filter(Boolean).join(', ');
  return String(v).trim();
}

/* Uguaglianza per VALORE. Gli array (le voci scelte) si confrontano come
   insiemi: stesso contenuto, ordine qualsiasi, e' "uguale". E' la riga che
   protegge il caso vero — due elenchi con le stesse voci in ordine diverso
   non sono una modifica dell'ospite, sono un dettaglio di come Postgres o
   il modulo li ha restituiti. */
function ugualiValori(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) || Array.isArray(b)) {
    const aa = Array.isArray(a) ? a : [];
    const bb = Array.isArray(b) ? b : [];
    if (aa.length !== bb.length) return false;
    const na = aa.map((x) => String(x ?? '')).sort();
    const nb = bb.map((x) => String(x ?? '')).sort();
    return na.every((v, i) => v === nb[i]);
  }
  return a === b;
}

export function differenze(
  originali: Record<string, unknown> | null | undefined,
  correnti: Record<string, unknown> | null | undefined,
): Differenza[] {
  /* Le richieste mai corrette hanno originali=null finche' la colonna non
     viene riempita: significa "non c'e' niente da confrontare", non "ogni
     campo del corrente e' una novita' da segnalare". Lo stesso vale se e'
     il corrente a mancare: senza un lato reale non si inventa una lista. */
  if (!originali || typeof originali !== 'object') return [];
  if (!correnti || typeof correnti !== 'object') return [];

  const risultato: Differenza[] = [];
  const chiavi = new Set([...Object.keys(originali), ...Object.keys(correnti)]);

  for (const chiave of chiavi) {
    const cEraPresente = Object.hasOwn(originali, chiave);
    const cEPresente = Object.hasOwn(correnti, chiave);
    const prima = cEraPresente ? originali[chiave] : undefined;
    const adesso = cEPresente ? correnti[chiave] : undefined;

    /* presente in tutti e due con lo stesso valore: niente da dire */
    if (cEraPresente && cEPresente && ugualiValori(prima, adesso)) continue;

    /* un campo aggiunto o tolto e' una differenza, non un caso da saltare:
       chi legge deve sapere che prima non c'era o che adesso non c'e' piu' */
    risultato.push({
      campo: etichettaCampo(chiave),
      prima: cEraPresente ? formattaValore(chiave, prima) : '',
      adesso: cEPresente ? formattaValore(chiave, adesso) : '',
    });
  }

  return risultato;
}
