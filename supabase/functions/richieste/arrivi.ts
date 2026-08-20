/* ============================================================
   arrivi.ts — che cosa vede, di un arrivo, chi lo guarda.

   Chi compila «Prepara il suo arrivo» scrive ventuno cose: l'ora, il mezzo,
   il transfer, le persone da aggiungere, il desiderio dei fanghi — e i dati
   di FATTURAZIONE, cioe' ragione sociale, partita IVA, codice fiscale,
   codice SDI e PEC. Non riguardano tutti le stesse persone.

   ALLA SPA SERVONO I FANGHI, NON LA PARTITA IVA. E' lo stesso principio gia'
   in piedi per le richieste dal sito, dove la spa vede trattamenti e Day Spa
   e nient'altro; qui vale dentro una riga sola invece che fra le righe.

   E LA SCELTA SI FA QUI, SUL SERVER. Nascondere le caselle nella pagina
   lascerebbe i dati dentro la risposta, a disposizione di chiunque apra gli
   strumenti del browser. Quello che non parte non si puo' leggere.

   ELENCO CHIUSO, NON LISTA DI ESCLUSIONI. Con una lista di campi vietati, la
   prima colonna aggiunta domani ad arrivo_richiesta arriverebbe alla spa
   senza che nessuno l'abbia deciso. Con l'elenco chiuso non arriva finche'
   qualcuno non la scrive qui — ed e' una riga che si scrive guardandola.
   ============================================================ */
import { tipiVisibili, vedeTutto } from './ruoli.ts';
import type { Ruolo } from './ruoli.ts';
import { arricchisciElenco } from './elenco.ts';

export type Riga = Record<string, unknown>;

/* ============================================================
   IL GIORNO ARRIVA DAL BROWSER.

   Va a finire dentro due filtri — la data d'arrivo e il giorno dei
   trattamenti — e prima di arrivarci passa di qui. La forma e' una sola:
   dieci caratteri, quattro-due-due. Tutto il resto non e' una data.

   E NON E' SOLO UNA QUESTIONE DI SICUREZZA. Un giorno scritto male senza
   questo cancello non da' un errore: da' una schermata vuota, che si legge
   «quel giorno non arriva nessuno». Meglio un 400 che dice cos'e'
   successo, che una pagina serena che dice una cosa falsa.
   ============================================================ */
export function giornoValido(v: unknown): string | null {
  const s = String(v ?? '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

/** I soli campi di un arrivo che la spa puo' vedere. */
export const CAMPI_SPA = [
  'numero',
  'intestatario',
  'data_arrivo',
  'data_partenza',
  'adulti',
  'bambini',
  'cure',
  'ora_arrivo',
  'mezzo',
  'fanghi_desiderio',
  'note',
  /* quante volte ha compilato: se sono due, il desiderio che si legge
     potrebbe essere quello vecchio */
  'compilazioni',
] as const;

/**
 * La riga come la deve ricevere chi guarda, o `null` se non deve riceverla.
 * `conChiave` e' la chiave interna dell'estensione: vale come la reception.
 */
export function perRuolo(riga: Riga, ruolo: Ruolo | null, conChiave: boolean): Riga | null {
  if (conChiave || vedeTutto(ruolo)) return riga;
  if (ruolo !== 'spa') return null;

  const fuori: Riga = {};
  for (const campo of CAMPI_SPA) {
    /* i campi che nella riga non ci sono non si inventano: una scheda piena
       di caselle vuote si legge come un guasto */
    if (campo in riga) fuori[campo] = riga[campo];
  }
  return fuori;
}

/* ============================================================
   DUE COMPILAZIONI PER LO STESSO OSPITE.

   prepara-arrivo fa un `insert`, non un `upsert`: chi rimanda il modulo —
   perche' ha sbagliato l'ora, perche' il volo e' cambiato — lascia due
   righe con lo stesso token. Mostrarne una a caso come se fosse l'unica e'
   il modo silenzioso di sbagliare un transfer.

   Due cose insieme, allora: si tiene la piu' recente quando la riga porta
   una data, e in ogni caso si DICE quante ce n'erano. Il numero e' la
   parte che non puo' mentire: se la data non c'e', «2» manda qualcuno a
   guardare, mentre un vincitore inventato non manda nessuno.
   ============================================================ */

/** I nomi possibili della data di compilazione, in ordine di preferenza. */
const QUANDO = ['creato_il', 'created_at', 'inserted_at'];

function quando(r: Riga): string {
  for (const c of QUANDO) {
    const v = r[c];
    if (typeof v === 'string' && v) return v;
  }
  return '';
}

export type Compilazione = { riga: Riga; compilazioni: number };

/** Le compilazioni raccolte per ospite: una riga a testa, e quante erano. */
export function perToken(righe: Riga[]): Record<string, Compilazione> {
  const fuori: Record<string, Compilazione> = {};
  for (const r of righe) {
    const t = String(r.token ?? '');
    if (!t) continue;
    const gia = fuori[t];
    if (!gia) {
      fuori[t] = { riga: r, compilazioni: 1 };
      continue;
    }
    gia.compilazioni++;
    /* le date ISO si confrontano come testo; senza data resta la prima */
    if (quando(r) > quando(gia.riga)) gia.riga = r;
  }
  return fuori;
}

/* ============================================================
   QUALI RICHIESTE SI VEDONO ACCANTO AGLI ARRIVI.

   Nella scheda «Arrivi» si guarda un giorno e si vedono, oltre a chi
   arriva, i trattamenti chiesti per quel giorno. Quali tipi contino come
   cure lo sa gia' ruoli.ts: riscriverlo qui vorrebbe dire due elenchi che
   divergono al primo cambiamento, e a decidere sarebbe il piu' debole.

   Quindi si parte dai tipi delle cure e si interseca con quello che quel
   ruolo puo' gia' leggere. Se domani la spa perdesse il Day Spa, questa
   funzione lo saprebbe senza che nessuno venga a modificarla.
   ============================================================ */
const CURA = ['trattamenti', 'dayspa'];

export function tipiCura(ruolo: Ruolo | null, conChiave: boolean): string[] {
  if (conChiave || vedeTutto(ruolo)) return [...CURA];
  const suoi = tipiVisibili(ruolo);
  return CURA.filter((t) => suoi.includes(t));
}

/* ============================================================
   QUALI RICHIESTE DI UN ARRIVO PUO' VEDERE CHI GUARDA.

   Una riga piatta si filtra campo per campo (CAMPI_SPA). Una richiesta no:
   o la si vede o non la si vede, e a deciderlo e' il tipo — che e'
   esattamente la domanda a cui ruoli.ts risponde gia' per l'elenco delle
   richieste. Qui non si riscrive: si chiama.

   Percio' la spa vede la richiesta `arrivo`? NO. Vede solo trattamenti e
   Day Spa, come sullo schermo delle richieste. Il desiderio dei fanghi le
   arriva dalla SCHEDA dell'arrivo (CAMPI_SPA, che lo contiene), non dalla
   richiesta: e' il dato che le serve, senza la fatturazione che le sta
   accanto.
   ============================================================ */
export function richiestePerRuolo(
  richieste: Riga[],
  ruolo: Ruolo | null,
  conChiave: boolean,
): Riga[] {
  if (conChiave || vedeTutto(ruolo)) return richieste;
  const suoi = tipiVisibili(ruolo);
  return richieste.filter((r) => suoi.includes(String(r.tipo ?? '')));
}

/* ============================================================
   DAL LINK, DALLE RIGHE VECCHIE E DALLE RICHIESTE, ALLA SCHEDA DI OGNI
   OSPITE DEL GIORNO.

   QUI E NON IN index.ts. arrivo-invio.ts lo dice gia' per lo stesso motivo,
   su un altro pezzo di questa stessa funzionalita': "la parte che decide
   come si scrivono le righe e' logica pura come sopra — dati dentro, dati
   fuori, nessun database — e va provata come tale. index.ts resta
   responsabile solo della sequenza che ha davvero bisogno della rete."
   Lasciare l'appiattimento, il raggruppamento e i due filtri di ruolo in
   linea in index.ts vuol dire che nessuna prova li tocca: ne' un elenco di
   richieste attaccato senza filtrarlo (fattura e transfer alla spa), ne'
   una chiave sbagliata nell'appiattimento (ogni ospite mostrato come "non
   ha ancora compilato") farebbero fallire niente. Qui invece si provano.

   TRE FONTI, UNA RIGA A OSPITE:
   - `link`    arrivo_link — chi arriva e quando, sempre presente
   - `vecchie` arrivo_richiesta — chi ha compilato prima del cambio del
               Task 9 di "strada unica", gia' piatta
   - `nuove`   richiesta_sito filtrata per arrivo_token — chi e' passato
               dal check-in nuovo (Task 8), con `dati` annidato e un `tipo`

   La richiesta di tipo `arrivo` fra le nuove porta esattamente i campi
   della scheda piatta (ora, mezzo, fanghi, note — validaArrivo() in
   tipi.ts): appiattita cosi', si mescola con le righe vecchie nello stesso
   perToken(), che non deve sapere da dove viene ciascuna riga.

   perRuolo() decide la scheda piatta; richiestePerRuolo() — la regola di
   ruoli.ts, non una seconda scritta qui — decide l'elenco delle sue
   richieste: due regole diverse, chiamate insieme qui e in nessun altro
   punto del codice.
   ============================================================ */

/* token e id sono chiavi interne: non servono a chi guarda, e il token
   e' la chiave con cui si apre la pagina di compilazione di quell'ospite */
const senzaInterni = (o: Riga): Riga =>
  Object.fromEntries(Object.entries(o).filter(([k]) => k !== 'token' && k !== 'id'));

/* La stessa cautela, ma su una richiesta: la colonna si chiama
   arrivo_token e non token, quindi senzaInterni() sopra non la vedrebbe.
   Ed e' lo STESSO segreto di l.token: chi lo leggesse nell'elenco delle
   richieste potrebbe aprire la pagina di compilazione di quell'ospite
   senz'altra autenticazione — lo stesso dato, la stessa fuga, un varco
   diverso. */
const senzaTokenArrivo = (o: Riga): Riga =>
  Object.fromEntries(Object.entries(o).filter(([k]) => k !== 'arrivo_token'));

/** La scheda di ogni ospite del giorno: la riga piatta che perRuolo()
 *  lascia passare, con le sue richieste (richiestePerRuolo() + etichetta e
 *  riepilogo gia' pronti) attaccate — o niente, per chi non deve vedere
 *  nemmeno la scheda. */
export function arriviDelGiorno(
  link: Riga[],
  vecchie: Riga[],
  nuove: Riga[],
  ruolo: Ruolo | null,
  conChiave: boolean,
): Riga[] {
  const arriviAppiattiti = nuove
    .filter((r) => r.tipo === 'arrivo')
    .map((r) => ({
      ...(r.dati && typeof r.dati === 'object' ? r.dati as Record<string, unknown> : {}),
      token: r.arrivo_token,
      creato_il: r.creato_il,
    }));
  /* prepara-arrivo (e prima ancora la vecchia tabella) fa un insert, non
     un upsert: chi rimanda il modulo lascia due righe. perToken() tiene
     la piu' recente e dice quante erano — il conteggio e' la parte che
     non puo' mentire. */
  const compilate = perToken([...vecchie, ...arriviAppiattiti]);

  /* le richieste vere di ciascun ospite, raggruppate per arrivo_token */
  const richiestePerToken: Record<string, Riga[]> = {};
  for (const r of nuove) {
    const t = String(r.arrivo_token ?? '');
    if (!t) continue;
    (richiestePerToken[t] ??= []).push(r);
  }

  const fuori: Riga[] = [];
  for (const l of link) {
    const tok = String(l.token ?? '');
    const c = compilate[tok];
    const riga: Record<string, unknown> = {
      ...senzaInterni(c?.riga ?? {}),
      ...senzaInterni(l),
      numero: (l.numero_pratica as string) ?? '',
      /* 0 = non ha ancora compilato; 2 o piu' = c'e' da guardare */
      compilazioni: c?.compilazioni ?? 0,
    };
    delete riga.numero_pratica;

    const vista = perRuolo(riga, ruolo, conChiave);
    if (!vista) continue;

    /* le richieste sono un elenco a parte, filtrato dalla SUA regola
       (richiestePerRuolo, cioe' ruoli.ts) e non da CAMPI_SPA: la spa non
       deve perdere le sue solo perche' 'richieste' non e' nell'elenco
       chiuso della scheda piatta. */
    const sue = richiestePerRuolo(richiestePerToken[tok] ?? [], ruolo, conChiave)
      .map(senzaTokenArrivo);
    fuori.push({ ...vista, richieste: arricchisciElenco(sue) });
  }
  return fuori;
}

/* ============================================================
   UNA RICHIESTA D'ARRIVO CON GENTE DA AGGIUNGERE NON SI CHIUDE.

   Chi ha scritto "si aggiunge mia figlia" sta aspettando di sapere se c'e'
   posto e quanto costa. Una richiesta d'arrivo si chiude in fretta, perche'
   quasi sempre non c'e' niente da rispondere: e' esattamente il caso in cui
   una riga si perde.

   Il segno che qualcuno ha risposto e' persone_confermate, che validaArrivo
   conserva apposta attraverso ?a=conferma: la porta pubblica del check-in
   lo forza sempre a falso, quindi solo la reception puo' metterlo a vero.
   ============================================================ */
/** Se questa richiesta si puo' portare allo stato «chiusa». */
export function puoChiudere(riga: Riga): { ok: boolean; perche?: string } {
  if (String(riga?.tipo ?? '') !== 'arrivo') return { ok: true };
  const d = (riga.dati && typeof riga.dati === 'object')
    ? riga.dati as Record<string, unknown> : {};
  const persone = Array.isArray(d.persone_extra) ? d.persone_extra : [];
  if (persone.length === 0 || d.persone_confermate === true) return { ok: true };
  return {
    ok: false,
    perche: 'ci sono persone da aggiungere in attesa di risposta: ' +
      'confermi disponibilita e prezzo prima di chiudere',
  };
}
