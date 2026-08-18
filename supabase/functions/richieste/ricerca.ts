/* ============================================================
   ricerca.ts — il filtro "or" per trovare una richiesta fra tutte
   (?a=elenco&cerca=…, azione GET protetta da autenticazione in index.ts).

   PERCHE' ESISTE. L'elenco del back office aveva un filtro per stato e
   basta, e il server ne restituisce al massimo 200. Finche' le richieste
   sono sei si scorre a occhio; alla duecentunesima quella del signore di
   tre settimane fa non si trova piu', e sembra che non esista. Il caso
   vero: il tassista sposta la partenza dopo che l'ospite ha gia' avuto la
   conferma, e la reception deve ritrovare quella richiesta per correggerla.

   PER QUESTO LA RICERCA STA QUI E NON NELLA PAGINA. Filtrare le 200 righe
   gia' caricate darebbe una risposta che SEMBRA completa e non lo e': il
   modo peggiore di sbagliare, perche' nessuno va a controllare.

   ---

   LA PROTEZIONE E' RICOPIATA DA buoni/ricerca.ts, E NON PER PIGRIZIA.
   `strumenti/pubblica.js` manda alla Management API soltanto i file della
   cartella della funzione: `richieste/` non puo' importare da `buoni/`, e
   un modulo condiviso non arriverebbe mai lassu'.

   Il deploy non puo' tenere insieme le due copie. Una PROVA si':
   ricerca.test.ts importa tutte e due le funzioni e pretende che
   sfuggano ogni carattere allo stesso modo. Il giorno che una delle due
   cambia senza l'altra, la prova diventa rossa.

   Il perche' dei conteggi di backslash e' spiegato per esteso in
   buoni/ricerca.ts, e quello resta l'originale: due livelli distinti —
   la grammatica or() di PostgREST e i jolly di ilike lato Postgres — che
   mangiano un backslash a testa.
   ============================================================ */

/** Le colonne di `richiesta_sito` che contengono qualcosa che una persona
 *  potrebbe digitare cercando un ospite. Il telefono c'e' perche' in
 *  reception spesso arriva prima quello del cognome. */
const COLONNE_RICERCA = ['numero', 'nome', 'email', 'telefono'] as const;

/** I tre nomi che il giorno del servizio ha nei vari tipi di richiesta:
 *  gli stessi che differenze.ts tratta come CAMPI_DATA. */
const CAMPI_DATA = ['quando', 'data', 'giorno'] as const;

const MESI = [
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
];

/* Identica a quella di buoni/ricerca.ts — vedi la nota in cima al file.
   Esportata perche' la prova possa confrontarle carattere per carattere. */
export function sfuggiValoreRicerca(testo: string): string {
  const bs = (n: number) => '\\'.repeat(n);
  return testo
    .replace(/\\/g, bs(4))
    .replace(/"/g, bs(1) + '"')
    .replace(/%/g, bs(2) + '%')
    .replace(/_/g, bs(2) + '_')
    .replace(/\*/g, bs(2) + '*');
}

/* Una data vera, o niente. Il 32 agosto e il 99/99 non sono date, e non
   devono diventarlo: una data inventata qui cercherebbe un giorno che non
   esiste e non troverebbe nulla, senza dire perche'. */
function componi(anno: number, mese: number, giorno: number): string | null {
  if (mese < 1 || mese > 12 || giorno < 1 || giorno > 31) return null;
  const d = new Date(anno, mese - 1, giorno);
  if (d.getFullYear() !== anno || d.getMonth() !== mese - 1 || d.getDate() !== giorno) return null;
  return `${anno}-${String(mese).padStart(2, '0')}-${String(giorno).padStart(2, '0')}`;
}

const conAnno = (a: number) => (a < 100 ? 2000 + a : a);

/** Traduce in ISO quello che una persona scrive quando pensa a un giorno.
 *
 *  IL DIFETTO CHE PRESIDIA: in reception si digita «20/08/2026», o «20
 *  agosto», perche' e' cosi' che si scrive una data. Dentro `dati` il
 *  giorno e' ISO. Senza questa traduzione la ricerca per giorno non trova
 *  mai niente, e nessuno capisce perche'.
 *
 *  `anno` si passa da fuori: una funzione che legge l'orologio da sola non
 *  si puo' provare. */
export function interpretaData(testo: string, anno: number): string | null {
  const t = String(testo || '').trim().toLowerCase();
  if (!t) return null;

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
  if (iso) return componi(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const numerica = /^(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?$/.exec(t);
  if (numerica) {
    return componi(
      numerica[3] ? conAnno(Number(numerica[3])) : anno,
      Number(numerica[2]),
      Number(numerica[1]),
    );
  }

  /* «20 agosto», «3 gen 2027»: almeno tre lettere, o "m" da sola non
     saprebbe scegliere fra marzo e maggio */
  const parole = /^(\d{1,2})\s+([a-zàèéìòù]{3,})\.?(?:\s+(\d{2,4}))?$/.exec(t);
  if (parole) {
    const mese = MESI.findIndex((m) => m.startsWith(parole[2]));
    if (mese < 0) return null;
    return componi(parole[3] ? conAnno(Number(parole[3])) : anno, mese + 1, Number(parole[1]));
  }

  return null;
}

/** Il filtro `or` per la ricerca libera dell'elenco richieste: numero,
 *  nome, email e telefono con ilike; e, solo quando il testo E' una data,
 *  anche il giorno del servizio dentro `dati`.
 *
 *  Le date si aggiungono, non sostituiscono: cercare un nome deve
 *  continuare a funzionare esattamente come prima. */
export function filtroRicercaRichieste(cerca: string, anno: number): string {
  const c = String(cerca || '').trim();
  if (!c) return '';

  const valore = sfuggiValoreRicerca(c);
  const parti: string[] = COLONNE_RICERCA.map((col) => `${col}.ilike."%${valore}%"`);

  const iso = interpretaData(c, anno);
  if (iso) for (const campo of CAMPI_DATA) parti.push(`dati->>${campo}.eq."${iso}"`);

  return parti.join(',');
}
