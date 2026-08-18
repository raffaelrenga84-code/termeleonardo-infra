/* ============================================================
   richieste — le richieste di preventivo dal sito nuovo.

   Nasce per un motivo preciso: il form del sito apriva un `mailto:` e
   dichiarava "inviato" comunque, senza guardare se fosse successo qualcosa.
   Su un telefono senza posta configurata non partiva niente e l'ospite se
   ne andava convinto di aver scritto. Ora la richiesta finisce a database
   PRIMA di dire qualsiasi cosa, e solo dopo parte l'avviso all'hotel.

   Pubblico (POST senza azione):  nuova richiesta
   Back office (x-hotel-key):     a=elenco · a=stato
   ============================================================ */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { validaParametriDisponibilita } from './valida.ts';
import { validaDati } from './tipi.ts';
import { componiRichiesta, type Contatti } from './componi-richiesta.ts';
import { avvisaHotel } from './email-richiesta.ts';
import { inviaRicevuta } from './ricevuta.ts';
import { inviaConferma } from './conferma.ts';
import { arricchisciElenco } from './elenco.ts';
import { filtroRicercaRichieste } from './ricerca.ts';
import { type Ruolo, ruoloDi, tipiVisibili, vedeTutto } from './ruoli.ts';
import { componiRisposta, corpoDisponibilita } from './disponibilita.ts';
import {
  aHotelChiuso, distanzaGiorni, esitoDisponibilita, ORIZZONTE_GIORNI, type Stagione,
} from './dayspa-disponibilita.ts';
import { LINGUE } from './condizioni.ts';
import { creaFrenoIp } from './limite-ip.ts';
import { dataConsenso } from './consenso.ts';

/* Portata da buoni/index.ts, stessa forma: legge stagione_chiusura ordinata
   per chiusura, e se la lettura fallisce prosegue senza — un ripiego onesto,
   non bloccare la pagina del Day Spa per un guasto di lettura.
   `aHotelChiuso` e il calcolo dei giorni sono invece in dayspa-disponibilita.ts:
   sono puri e collaudati li', questa funzione no perche' tocca il database. */
async function leggiStagioni(): Promise<Stagione[]> {
  try {
    const { data } = await db.from('stagione_chiusura')
      .select('chiusura, riapertura').order('chiusura');
    return (data ?? []) as Stagione[];
  } catch (e) {
    console.error('stagioni non lette, disponibilita day spa prosegue:', e);
    return [];
  }
}

const testo = (v: unknown) => String(v ?? '').trim();

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, authorization, x-hotel-key',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const db = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const risposta = (corpo: unknown, stato = 200) =>
  new Response(JSON.stringify(corpo), {
    status: stato,
    headers: { ...CORS, 'content-type': 'application/json' },
  });

function indirizzo(req: Request): string {
  const f = req.headers.get('x-forwarded-for') || '';
  return f.split(',')[0].trim() || 'sconosciuto';
}

/* Chi sta chiedendo, non solo se puo' entrare: da qui in poi ogni azione
   del back office deve sapere QUALI richieste quella persona puo' toccare.
   `chiave` e' l'estensione, che passa il segreto condiviso e vede tutto. */
type Accesso =
  | { ok: true; ruolo: Ruolo | null; chiave: boolean }
  | { ok: false };

/* IL BUCO CHIUSO IL 18 AGOSTO 2026. Questa funzione finiva con
   `return !!data?.user`: QUALUNQUE utente autenticato, senza guardare il
   dominio. E la registrazione sul progetto era aperta — bastava iscriversi
   con un indirizzo qualsiasi, confermarlo, e `?a=elenco` restituiva nome,
   email, telefono e dettagli di ogni ospite che avesse scritto dal sito.
   La funzione usa la chiave di servizio, quindi RLS non proteggeva niente.

   `buoni` il controllo sul dominio ce l'aveva gia'. Questa no: la stessa
   protezione a due livelli diversi, ed e' sempre quella piu' debole a
   decidere quanto vale l'insieme. */
async function autorizzato(req: Request): Promise<Accesso> {
  const attesa = Deno.env.get('HOTEL_KEY');
  if (attesa && req.headers.get('x-hotel-key') === attesa) {
    return { ok: true, ruolo: null, chiave: true };
  }
  const auth = req.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return { ok: false };
  const { data } = await db.auth.getUser(token);
  const ruolo = ruoloDi(data?.user?.email);
  if (!ruolo) return { ok: false };
  return { ok: true, ruolo, chiave: false };
}

/* Se questo accesso puo' leggere e toccare una richiesta di questo tipo.
   La chiave condivisa e i ruoli che vedono tutto passano sempre; la spa
   passa solo sui suoi tipi. */
function puoToccare(a: Accesso, tipo: unknown): boolean {
  if (!a.ok) return false;
  if (a.chiave || vedeTutto(a.ruolo)) return true;
  return tipiVisibili(a.ruolo).includes(String(tipo ?? ''));
}

/* Un tetto sulle mezz'ore, non sui secondi: un limite in memoria non
   funziona, perche' ogni richiesta puo' toccare un'istanza diversa della
   funzione e il contatore riparte da zero. Questo invece conta a database,
   dove il numero e' uno solo. In caso di errore si lascia passare: meglio
   una richiesta di troppo che una richiesta persa. */
const TETTO_PERSONA = 3;
/* Il tetto per persona resta stretto: e' li' che si ferma chi insiste.
   Quello TOTALE conta invece tutte le righe di richiesta_sito nella mezz'ora,
   di chiunque: a 20 ci passavano transfer e green fee, che sono pochi al
   giorno, ma da adesso ci passa ogni richiesta di soggiorno generata dai
   pulsanti sulla home. Lo scenario che ho in mente e' una giornata da
   vetrina: la newsletter di primavera o un post che gira, qualche centinaio
   di persone sul sito nella stessa mezz'ora e magari cinquanta che arrivano
   fino all'invio. A 20 la ventunesima — un ospite vero, con le date scelte e
   il modulo compilato — leggeva 429. Vale qui lo stesso criterio scritto per
   il freno della disponibilita': fra rifiutare un ospite vero e lasciarne
   passare uno di troppo, l'errore giusto e' il secondo. Questo resta un
   freno contro uno script che riempie la tabella, non un antifrode: chi
   insiste da solo lo ferma comunque TETTO_PERSONA a 3. */
const TETTO_TOTALE = 300;

async function troppeRichieste(email: string, ip: string): Promise<boolean> {
  const da = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  try {
    const { count: totale } = await db.from('richiesta_sito')
      .select('id', { count: 'exact', head: true }).gte('creato_il', da);
    if ((totale ?? 0) >= TETTO_TOTALE) return true;

    const { count: sue } = await db.from('richiesta_sito')
      .select('id', { count: 'exact', head: true })
      .gte('creato_il', da).or(`email.eq.${email},ip.eq.${ip}`);
    return (sue ?? 0) >= TETTO_PERSONA;
  } catch (e) {
    console.error('conteggio limite fallito, lascio passare:', e);
    return false;
  }
}

/* Freno per l'azione pubblica a=disponibilita. Non puo' usare
   troppeRichieste() sopra: quella conta a database le righe salvate in
   richiesta_sito e ha bisogno di una email, mentre la disponibilita' non
   salva niente e non ne ha una. Il conteggio vive quindi in memoria, per
   IP: e' un freno PER ISTANZA della funzione, quindi approssimativo (istanze
   diverse hanno contatori diversi, un riavvio a freddo lo azzera) — attrito
   onesto contro un abuso a raffica sul sito vero dell'hotel, non un sistema
   antifrode. Fra rifiutare un ospite vero e lasciarne passare uno di
   troppo, l'errore giusto e' il secondo.

   Il tetto NON e' per persona, e' per indirizzo: un albergo, un ufficio o
   una rete mobile con CGNAT mettono molti ospiti veri dietro lo stesso IP.
   200 chiamate ogni 5 minuti reggono, per esempio, una quarantina di
   persone che condividono una rete e fanno ciascuna 4-5 tentativi di date
   mentre confrontano i prezzi — restando comunque un freno vero contro uno
   script che manda centinaia di chiamate al secondo dallo stesso indirizzo. */
const TETTO_DISPONIBILITA = 200;
const FINESTRA_DISPONIBILITA_MS = 5 * 60 * 1000;
const permessoDisponibilita = creaFrenoIp(TETTO_DISPONIBILITA, FINESTRA_DISPONIBILITA_MS);

/* Freno per l'azione pubblica a=dayspa. Stesso meccanismo di
   a=disponibilita (creaFrenoIp), soglia diversa e pensata per QUESTA
   azione: a=disponibilita passa da check-availability, che tiene in cache
   una sessione (cookie + token CSRF) verso termeleonardo.com per 5 minuti,
   quindi molte chiamate ravvicinate pesano solo su quella cache. a=dayspa
   invece chiama /it/api/1/availability DIRETTAMENTE — una fetch vera verso
   il sito reale dell'hotel a ogni chiamata, senza nessuna cache in mezzo.

   COM'E' FATTA LA PAGINA CHE CHIAMA QUI (aggiornato il 17 agosto 2026: fino
   a quel giorno questo commento diceva «un solo campo data», ed era la
   giustificazione dichiarata del numero qui sotto). I campi che fanno
   partire una domanda sono DUE: il giorno e «quante persone» — quest'ultimo
   perche' il ponte gira il numero all'API, e in sei si puo' essere pieni
   dove in uno c'era posto. Un `input[type=number]` pero' lancia un `change`
   a ogni scatto della freccetta, quindi davanti ai due campi c'e' un freno
   di 400 ms (ATTESA_PRIMA_DI_CHIEDERE in pagine/richieste/index.html): il
   gesto 1→8 vale UNA chiamata, non sette. Restano le combinazioni che un
   ospite vero prova davvero — qualche giorno per qualche numero di persone,
   cioe' ancora qualche decina di chiamate, non centinaia.

   60 chiamate ogni 5 minuti reggono una decina di persone che condividono
   una rete (albergo, ufficio, CGNAT) e provano 5-6 combinazioni di giorno e
   persone ciascuna, restando comunque un freno vero contro uno script che
   bombarda direttamente il sito reale dell'hotel. */
const TETTO_DAYSPA = 60;
const FINESTRA_DAYSPA_MS = 5 * 60 * 1000;
const permessoDayspa = creaFrenoIp(TETTO_DAYSPA, FINESTRA_DAYSPA_MS);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const url = new URL(req.url);
  const azione = url.searchParams.get('a') || '';

  /* ---------- pubblico: una nuova richiesta ---------- */
  if (!azione) {
    if (req.method !== 'POST') return risposta({ errore: 'metodo non ammesso' }, 405);

    let corpo: Record<string, unknown>;
    try { corpo = await req.json(); }
    catch { return risposta({ errore: 'richiesta illeggibile' }, 400); }

    /* Cosa si valida e cosa finisce dove vive in componi-richiesta.ts, non
       qui: e' un modulo puro, collaudato da solo, che Deno.serve non puo'
       far scavalcare in silenzio come e' gia' successo una volta. */
    const composta = componiRichiesta(corpo);
    if (composta.errore || !composta.contatti || !composta.colonne) {
      return risposta({ errore: composta.errore }, 400);
    }
    const tipo = composta.tipo!;
    const contatti: Contatti = composta.contatti;
    const colonne = composta.colonne;
    const propri = composta.dati ?? null;

    const ip = indirizzo(req);
    if (await troppeRichieste(contatti.email, ip)) {
      return risposta({ errore: 'troppe richieste ravvicinate' }, 429);
    }

    const { data: num, error: eNum } = await db.rpc('prossimo_numero_richiesta');
    if (eNum || !num?.[0]) {
      console.error('numerazione fallita:', eNum);
      return risposta({ errore: 'salvataggio non riuscito' }, 500);
    }
    const n = num[0];

    /* prima si salva, poi si parla: se l'inserimento fallisce all'ospite
       si dice che non ha funzionato, e non il contrario come prima */
    const { error: eIns } = await db.from('richiesta_sito').insert({
      anno: n.anno, progressivo: n.progressivo, numero: n.numero,
      tipo,
      ...colonne,
      dati: propri,
      /* la richiesta come e' arrivata, scritta una volta sola qui e mai
         piu' toccata: ?a=conferma aggiorna `dati`, non questa colonna,
         altrimenti conserverebbe la penultima versione invece
         dell'originale */
      dati_originali: propri,
      arrivo_token: testo(corpo.token).slice(0, 120) || null,
      origine: String(corpo.origine || '').slice(0, 200) || null,
      ip,
      /* dataConsenso guarda il booleano grezzo com'e' arrivato dal modulo,
         non "il fatto che siamo arrivati fin qui" (componiRichiesta l'ha
         gia' preteso piu' sopra, per rifiutare la richiesta): se un giorno
         quel controllo cambiasse, questa colonna resterebbe comunque
         onesta invece di scrivere una data non guadagnata. */
      privacy_il: dataConsenso(corpo.privacy_presa_atto),
    });
    if (eIns) {
      console.error('inserimento fallito:', eIns);
      return risposta({ errore: 'salvataggio non riuscito' }, 500);
    }

    /* Due email, e nessuna delle due puo' far fallire la richiesta: se non
       partono, la richiesta e' comunque salvata e si ritrova nell'elenco del
       back office.

       L'AVVISO va alla reception. LA RICEVUTA va all'ospite, ed e' la
       novita': prima chi mandava una richiesta non riceveva nulla — vedeva
       il riferimento sullo schermo e poi silenzio. Chi COMPRA un buono
       l'email l'ha sempre avuta; chi CHIEDE un trattamento no, ed e' lui
       quello che sta aspettando una risposta.

       Insieme e non in fila: sono indipendenti, e una lenta non deve far
       aspettare l'altra ne' l'ospite davanti allo schermo. */
    const dati = { ...contatti, ...colonne, ...(propri || {}), tipo, numero: n.numero };
    const [avvisato, ricevuta] = await Promise.all([
      avvisaHotel(dati),
      inviaRicevuta({ ...dati, dati: propri ?? null }),
    ]);
    return risposta({ ok: true, numero: n.numero, avviso: avvisato, ricevuta });
  }

  /* ---------- pubblico: precompilazione da un link della nostra email ----------
     L'ospite che arriva da una nostra email porta un token: nome, contatti e
     periodo di soggiorno li sappiamo gia' e non ha senso richiederglieli.
     Un token inventato o scaduto NON blocca niente: si ricade sul modulo
     vuoto, che e' il caso normale di chi arriva dal sito. */
  if (azione === 'precompila') {
    const t = testo(url.searchParams.get('t'));
    if (!t) return risposta({ ok: true, noto: false });
    const { data, error } = await db.from('arrivo_link')
      .select('intestatario, email, lingua, data_arrivo, data_partenza, adulti, bambini, numero_pratica, scade_il')
      .eq('token', t).maybeSingle();
    if (error) {
      console.error('lettura token fallita:', error);
      return risposta({ ok: true, noto: false });
    }
    if (!data) return risposta({ ok: true, noto: false });
    if (data.scade_il && new Date(data.scade_il).getTime() < Date.now()) {
      return risposta({ ok: true, noto: false, scaduto: true });
    }
    return risposta({
      ok: true, noto: true,
      ospite: {
        nome: data.intestatario, email: data.email, lingua: data.lingua,
        arrivo: data.data_arrivo, partenza: data.data_partenza,
        adulti: data.adulti, bambini: data.bambini, pratica: data.numero_pratica,
      },
    });
  }

  /* ---------- pubblico: disponibilita' camere ----------
     La pagina non deve conoscere la chiave del proxy: e' questa funzione
     che chiama check-availability con PROXY_KEY dal proprio ambiente. */
  if (azione === 'disponibilita') {
    if (!permessoDisponibilita(indirizzo(req))) {
      return risposta({ errore: 'troppe richieste, riprova tra qualche minuto' }, 429);
    }

    const b = await req.json().catch(() => ({}));

    /* le date e il numero di adulti si convalidano PRIMA di chiamare il
       servizio a monte, con gli stessi limiti di una richiesta di
       soggiorno vera: una data assurda respinta qui e' anche una chiamata
       in meno verso il sito reale dell'hotel */
    const v = validaParametriDisponibilita(b);
    if (v.errore || !v.dati) return risposta({ errore: v.errore }, 400);
    const { adulti } = v.dati;

    const lingua = LINGUE.includes(String(b?.lingua)) ? String(b.lingua) : 'it';
    const r = await fetch(
      Deno.env.get('SUPABASE_URL') + '/functions/v1/check-availability',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-proxy-key': Deno.env.get('PROXY_KEY') ?? '',
        },
        /* i nomi e i formati dell'API a monte stanno in disponibilita.ts, un
           modulo puro: `children_ages` e' una stringa "4,9" come la manda gia'
           la chat, non un array */
        body: JSON.stringify(corpoDisponibilita(v.dati)),
      },
    );
    if (!r.ok) {
      /* senza questo, un guasto a monte diventa invisibile in produzione */
      console.error('check-availability ha risposto', r.status, await r.text().catch(() => ''));
      return risposta({ esito: 'errore', errore: 'disponibilita non raggiungibile' }, 502);
    }
    /* Un 200 con dentro qualcosa che non e' JSON faceva uscire l'eccezione da
       Deno.serve: la risposta perdeva le intestazioni CORS e sulla pagina
       l'errore diventava incomprensibile. Un guasto a monte e' un guasto
       nostro da raccontare, non un'eccezione da lasciar scappare. */
    let grezzo: unknown;
    try { grezzo = await r.json(); }
    catch (e) {
      console.error('check-availability ha risposto 200 con qualcosa che non e JSON:', e);
      return risposta({ esito: 'errore', errore: 'disponibilita non raggiungibile' }, 502);
    }
    return risposta(componiRisposta(grezzo, adulti, lingua));
  }

  /* ---------- pubblico: disponibilita' Day Spa ----------
     L'API del sito precedente non manda CORS: il browser non puo' chiamarla.
     Passa da qui, e da qui esce solo uno stato — mai i posti residui. */
  if (azione === 'dayspa') {
    /* Endpoint pubblico, senza JWT: ogni chiamata anonima costa una SELECT
       su stagione_chiusura piu' una fetch verso il sito vero dell'hotel.
       Il freno viene PRIMA di tutto il resto, come per a=disponibilita. */
    if (!permessoDayspa(indirizzo(req))) {
      return risposta({ errore: 'troppe richieste, riprova tra qualche minuto' }, 429);
    }

    /* Stessa regola di una richiesta Day Spa vera (validaDati, compito 2):
       stesso intervallo persone (1-8, PERSONE_DAYSPA_MAX) e la stessa
       dataServizio — che accetta oggi (un ospite puo' chiedere per oggi),
       respinge il passato e le date impossibili (9999-99-99 diventava un
       NaN travestito da 'non-aperte' invece di un 400 onesto), e cosi' il
       controllo di disponibilita' e l'invio della richiesta non rischiano
       mai di dire cose diverse sulla stessa data. Riusata, non riscritta:
       gia' collaudata in tipi.test.ts. */
    const b = {
      giorno: url.searchParams.get('giorno') || '',
      persone: url.searchParams.get('persone') || '1',
    };
    const v = validaDati('dayspa', b, new Date());
    if (v.errore || !v.dati) return risposta({ errore: v.errore }, 400);
    const { giorno, persone } = v.dati as { giorno: string; persone: number };

    const stagioni = await leggiStagioni();
    const chiuso = aHotelChiuso(giorno, stagioni);
    const giorni = distanzaGiorni(giorno, new Date());
    let dati: unknown = null;
    if (!chiuso && giorni <= ORIZZONTE_GIORNI) {
      try {
        const r = await fetch('https://www.termeleonardo.com/it/api/1/availability' +
          `?from_date=${giorno}&to_date=${giorno}&people=${encodeURIComponent(String(persone))}`);
        dati = r.ok ? await r.json() : null;
      } catch (e) {
        console.error('disponibilita day spa', e);
      }
    }
    return risposta(esitoDisponibilita(dati, giorni, chiuso));
  }

  /* ---------- riservati al back office ---------- */
  const accesso = await autorizzato(req);
  if (!accesso.ok) return risposta({ errore: 'non autorizzato' }, 401);

  if (azione === 'elenco') {
    const stato = url.searchParams.get('stato') || '';
    const cerca = (url.searchParams.get('cerca') || '').trim();
    let q = db.from('richiesta_sito').select('*').order('creato_il', { ascending: false }).limit(200);
    if (stato) q = q.eq('stato', stato);
    /* La ricerca sta QUI e non nella pagina: il tetto di 200 righe qui sopra
       significa che filtrare quelle gia' caricate darebbe una risposta che
       SEMBRA completa e non lo e'. Il caso vero e' il tassista che sposta la
       partenza dopo la conferma, e la richiesta da correggere e' vecchia.
       La costruzione del filtro vive in ricerca.ts, che tratta il testo
       digitato come testo e mai come sintassi. */
    if (cerca) q = q.or(filtroRicercaRichieste(cerca, new Date().getFullYear()));
    /* La spa vede trattamenti e Day Spa e nient'altro: transfer, green fee,
       maestro e soggiorni sono dati di ospiti che con la spa non c'entrano.
       Il filtro sta QUI e non nella pagina: nasconderli a schermo li
       lascerebbe comunque nella risposta, a disposizione di chiunque apra
       gli strumenti del browser. */
    if (!accesso.chiave && !vedeTutto(accesso.ruolo)) {
      q = q.in('tipo', tipiVisibili(accesso.ruolo));
    }
    const { data, error } = await q;
    if (error) return risposta({ errore: error.message }, 500);
    /* etichetta, riepilogo e differenze si calcolano QUI, non nella pagina
       del back office: quella e' HTML puro e non puo' importare moduli
       Deno, e riscriverne la logica li' vorrebbe dire due implementazioni
       della stessa regola che divergono al primo cambiamento — il difetto
       gia' pagato coi prezzi del listino, i testi dei buoni, l'indirizzo,
       i trattamenti. */
    return risposta({ ok: true, richieste: arricchisciElenco(data ?? []) });
  }

  /* ---------- conferma all'ospite ----------
     La reception puo' correggere prima di confermare — un orario spostato,
     un luogo diverso — e l'ospite riceve i dati DEFINITIVI, non quelli che
     aveva chiesto. Le correzioni passano dalla stessa validazione della
     richiesta: non ha senso essere severi col cliente e permissivi con noi. */
  if (azione === 'conferma') {
    if (req.method !== 'POST') return risposta({ errore: 'metodo non ammesso' }, 405);
    const b = await req.json().catch(() => ({})) as Record<string, unknown>;
    const numero = testo(b.numero);
    if (!numero) return risposta({ errore: 'numero mancante' }, 400);

    const { data: r, error: eSel } = await db.from('richiesta_sito')
      .select('*').eq('numero', numero).maybeSingle();
    if (eSel) return risposta({ errore: eSel.message }, 500);
    if (!r) return risposta({ errore: 'richiesta non trovata' }, 404);
    /* non si conferma una richiesta che non si potrebbe nemmeno leggere */
    if (!puoToccare(accesso, r.tipo)) return risposta({ errore: 'non autorizzato' }, 403);

    /* se arrivano correzioni si rivalidano; se non arrivano si conferma
       quello che c'e' gia' */
    let dati = r.dati;
    if (b.dati && typeof b.dati === 'object') {
      const v = validaDati(r.tipo, b.dati as Record<string, unknown>);
      if (v.errore || !v.dati) return risposta({ errore: v.errore }, 400);
      dati = v.dati;
    }

    const messaggio = testo(b.messaggio).slice(0, 2000);
    /* la casella del back office "segnala all'ospite cosa e' cambiato":
       le differenze si calcolano dentro conferma.ts, da dati_originali
       (mai riscritto dopo la creazione) contro `dati` appena rivalidato */
    const segnalaModifiche = b.segnala_modifiche === true;
    const esito = await inviaConferma({
      numero: r.numero, tipo: r.tipo, nome: r.nome, email: r.email,
      lingua: r.lingua, dati, messaggio,
      dati_originali: r.dati_originali,
      segnala_modifiche: segnalaModifiche,
    });

    const { error: eUp } = await db.from('richiesta_sito').update({
      dati,
      stato: 'risposta',
      conferma_il: new Date().toISOString(),
      conferma_da: testo(b.utente).slice(0, 120) || null,
      conferma_testo: messaggio || null,
      /* se l'email non e' partita deve restare scritto: altrimenti la
         richiesta risulta "risposta" e l'ospite non sa niente */
      conferma_esito: esito ? 'inviata' : 'fallita',
    }).eq('numero', numero);
    if (eUp) return risposta({ errore: eUp.message }, 500);

    return risposta({ ok: true, inviata: esito, dati });
  }

  if (azione === 'stato') {
    if (req.method !== 'POST') return risposta({ errore: 'metodo non ammesso' }, 405);
    const b = await req.json().catch(() => ({})) as Record<string, unknown>;
    const numero = String(b.numero || '');
    const nuovo = String(b.stato || '');
    if (!numero) return risposta({ errore: 'numero mancante' }, 400);
    if (!['nuova', 'vista', 'risposta', 'chiusa'].includes(nuovo)) {
      return risposta({ errore: 'stato sconosciuto' }, 400);
    }
    /* Si legge il tipo PRIMA di aggiornare. Senza, la spa potrebbe
       chiudere un transfer che non ha nemmeno il diritto di vedere:
       basterebbe indovinare un numero, e i numeri sono progressivi. */
    const { data: chi } = await db.from('richiesta_sito')
      .select('tipo').eq('numero', numero).maybeSingle();
    if (!chi) return risposta({ errore: 'richiesta non trovata' }, 404);
    if (!puoToccare(accesso, chi.tipo)) return risposta({ errore: 'non autorizzato' }, 403);

    const { error } = await db.from('richiesta_sito').update({
      stato: nuovo,
      gestita_il: new Date().toISOString(),
      gestita_da: String(b.utente || '').slice(0, 120) || null,
      note: b.note == null ? undefined : String(b.note).slice(0, 2000),
    }).eq('numero', numero);
    if (error) return risposta({ errore: error.message }, 500);
    return risposta({ ok: true });
  }

  return risposta({ errore: 'azione sconosciuta' }, 404);
});
