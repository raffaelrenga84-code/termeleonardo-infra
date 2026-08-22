/* ============================================================
   elenco.ts — la riga come la vede il back office in `?a=elenco`.

   riepilogo.ts sa calcolare l'etichetta e il riepilogo per tipo;
   differenze.ts sa confrontare l'originale col corrente. Questo modulo fa
   solo una cosa: li chiama tutti e due per ogni riga di richiesta_sito,
   cosi' la pagina HTML del back office — che e' HTML puro e non puo'
   importare moduli Deno — riceve gia' pronto quello che deve mostrare.
   Una sola implementazione della regola, non due che divergono al primo
   cambiamento: e' il difetto che questo progetto ha gia' pagato con i
   prezzi del listino, i testi dei buoni, l'indirizzo, i trattamenti.

   Modulo puro: righe dentro, righe arricchite fuori. Nessuna rete, nessun
   database.
   ============================================================ */

import { riepilogoRichiesta, type Riga } from './riepilogo.ts';
import { differenze, type Differenza } from './differenze.ts';

/* La riga come arriva da `select('*')` su richiesta_sito: i campi che
   riepilogo.ts e differenze.ts guardano davvero, dichiarati per tipo, piu'
   un indice aperto per tutti gli altri (numero, stato, email, ...) che qui
   non servono ma vanno restituiti intatti. */
export type RigaGrezza = {
  tipo?: string;
  dati?: Record<string, unknown> | null;
  dati_originali?: Record<string, unknown> | null;
  check_in?: string | null;
  check_out?: string | null;
  notti?: number | null;
  ospiti?: number | null;
  [k: string]: unknown;
};

/* `camere_insieme` c'e' solo sulle righe che fanno parte di un gruppo di
   camere, e le porta tutte, capofila per prima. Dichiarato qui e non
   lasciato all'indice aperto di RigaGrezza: e' un campo che il back
   office legge davvero, e un `unknown` costringerebbe a fidarsi. */
export type RigaArricchita = RigaGrezza & Riga & {
  differenze: Differenza[];
  camere_insieme?: string[];
};

/* IL TOKEN DELL'ARRIVO NON ESCE DA QUI. `arrivo_token` e' la chiave con cui
   si apre la pagina di compilazione di quell'ospite: chi la leggesse nella
   risposta potrebbe entrarci senz'altra autenticazione, vedere il suo
   soggiorno e mandare richieste a suo nome. Lo spread di tutta la riga la
   faceva uscire da DUE porte — ?a=elenco, e l'array `trattamenti` di
   ?a=arrivi, l'unico posto dove arriviDelGiorno() si era preso la briga di
   toglierla. Tolta qui, dove passano tutte le righe, sono chiuse tutte e
   due; e il giorno che nasce una terza porta, e' gia' chiusa anche quella. */
const SEGRETI = ['arrivo_token'];

export function arricchisciRiga(r: RigaGrezza): RigaArricchita {
  const { etichetta, riepilogo } = riepilogoRichiesta(r);
  return {
    ...Object.fromEntries(Object.entries(r).filter(([k]) => !SEGRETI.includes(k))),
    etichetta,
    riepilogo,
    /* dati_originali puo' mancare o essere null sulle righe piu' vecchie:
       differenze() gia' tratta quel caso come "niente da confrontare", non
       come "ogni campo del corrente e' una novita'" — qui non si aggira
       quel presidio con un `?? {}`. */
    differenze: differenze(r.dati_originali, r.dati),
  };
}

export function arricchisciElenco(righe: RigaGrezza[]): RigaArricchita[] {
  return righe.map(arricchisciRiga);
}

/* ============================================================
   LE CAMERE CHE VIAGGIANO INSIEME, viste da tutte e due i versi.

   Il carrello salva una riga per camera: la prima e' la capofila, e
   quelle in piu' portano il suo numero in `dati.insieme`. Il filo
   quindi esisteva gia', ma si vedeva da una parte sola: aprendo la
   camera 2 si risaliva alla 1, aprendo la 1 non c'era scritto niente.
   Chi lavora dalla lista invece che dall'email non poteva sapere che
   quell'ospite ne aveva prenotate tre.

   SI DERIVA, NON SI COPIA. Scrivere sulla capofila l'elenco delle
   figlie sarebbe un secondo dato che dice la stessa cosa, e due dati
   che dicono la stessa cosa prima o poi si contraddicono — per esempio
   quando una camera viene cancellata a mano. Qui il gruppo si ricompone
   ogni volta da quello che c'e' scritto.

   LE FIGLIE ARRIVANO DA UNA QUERY LORO e non dalle 200 righe della
   pagina: con un filtro per stato — «mostrami solo le nuove» — una
   figlia gia' vista resterebbe fuori, e la capofila direbbe «2 camere»
   quando sono tre. Un numero sbagliato e' peggio di nessun numero.
   ============================================================ */

/** La chiave del gruppo di una riga: il numero della capofila se e' una
 *  camera in piu', il proprio se e' lei la capofila. */
export function chiaveGruppo(r: RigaGrezza): string {
  const suo = String(r.numero ?? '').trim();
  return capofilaDi(r.dati) || suo;
}

/** Il numero della capofila dichiarato da una riga, comunque ci sia
 *  arrivato: `insieme` se e' una camera in piu' dello stesso invio,
 *  `collegata_a` se e' una richiesta mandata dopo da «aggiunga
 *  un'altra camera». Due strade diverse — e due campi diversi, perche'
 *  il freno per persona tratta la prima come «non e' un invio nuovo» e
 *  la seconda come «lo e'» — ma per chi guarda la lista sono la stessa
 *  cosa: camere dello stesso ospite, da assegnare vicine. */
export function capofilaDi(dati: Record<string, unknown> | null | undefined): string {
  const d = dati || {};
  return String(d.insieme ?? '').trim() || String(d.collegata_a ?? '').trim();
}

/** Attacca a ogni riga `camere_insieme`: tutti i numeri del suo gruppo,
 *  capofila per prima, SOLO quando le camere sono piu' d'una.
 *
 *  `figlie` sono le righe che dichiarano di appartenere a un gruppo —
 *  numero e `dati.insieme` — prese da una query loro, cosi' il conto e'
 *  giusto anche quando la lista e' filtrata per stato.
 *
 *  Una riga sola nel suo gruppo non porta niente: «1 camera» scritto su
 *  ogni richiesta normale sarebbe rumore su tutta la lista. */
export function collegaCamere(
  righe: RigaArricchita[],
  figlie: { numero?: unknown; dati?: Record<string, unknown> | null }[],
): RigaArricchita[] {
  const per = new Map<string, string[]>();
  for (const f of figlie ?? []) {
    const capo = capofilaDi(f?.dati);
    const suo = String(f?.numero ?? '').trim();
    if (!capo || !suo) continue;
    if (!per.has(capo)) per.set(capo, []);
    const elenco = per.get(capo)!;
    /* una figlia puo' arrivare due volte se la query la ripete: due
       «camera 2» nella stessa lista sono un numero sbagliato */
    if (!elenco.includes(suo)) elenco.push(suo);
  }
  return (righe ?? []).map((r) => {
    const capo = chiaveGruppo(r);
    const altre = per.get(capo) ?? [];
    if (!altre.length || !capo) return r;
    /* la capofila per prima, poi le sue camere nell'ordine dei numeri:
       e' l'ordine in cui l'ospite le ha scelte */
    return { ...r, camere_insieme: [capo, ...[...altre].sort()] };
  });
}
