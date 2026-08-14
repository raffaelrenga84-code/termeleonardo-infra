/* ============================================================
   buoni — Buoni regalo Hotel Terme Leonardo
   ------------------------------------------------------------
   Due strade, come per le offerte:
   · in reception (contanti o bancomat) → nasce già pagato;
   · su richiesta via email → nasce in attesa, il cliente paga
     con bonifico o link, e il buono vero esce solo dopo.
   Finché è in attesa esiste solo l'anteprima filigranata: il
   codice viene assegnato al momento del pagamento, così non
   circolano codici spendibili non pagati.

   Back office (intestazione x-hotel-key):
     POST ?a=crea       → nuovo buono (pagato o in attesa)
     POST ?a=pagato     → registra l'incasso ed emette il codice
     POST ?a=link       → crea il link di pagamento Stripe
     POST ?a=riscuoti   → segna il buono usato
     POST ?a=annulla    → annulla
     GET  ?a=elenco     → ultimi buoni, con filtri
   Pubblico:
     GET  ?a=verifica&codice=…  → validità, senza dati personali (la usa la
                                  reception per controllare un codice)
     GET  ?a=stampa&codice=…    → il buono pronto per il foglio A4 (la usa
                                  pagine/buoni/stampa/, dal pulsante «Stampa
                                  il tuo buono» nell'email — vedi stampa.ts
                                  per cosa esce e perché è un'azione a parte)
     GET  ?a=qr&codice=…        → il codice come immagine PNG, per il <img>
                                  dentro l'email (vedi il commento sopra
                                  l'azione più sotto: disegna qualunque
                                  testo le si passi, non guarda il database)
     POST ?a=acquista   → acquisto dal sito: buono in attesa + link carta
   Stripe:
     POST ?a=webhook    → incasso confermato: emette il codice da sé
   ============================================================ */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { validaAcquisto, colonnaVoci } from './acquista.ts';
import { nasceGiaPagato } from './pagamenti.ts';
import { entroIlLimiteAcquista, entroIlLimiteQr, entroIlLimiteStampa, troppiDalSito } from './limite.ts';
import { avvisaAmministrazione, inviaBuonoEmesso, statoConsegna } from './email-buono.ts';
import { datiStampa } from './stampa.ts';
import { generaPngQR } from './qr.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, authorization, x-hotel-key',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

const db = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

/* ============================================================
   Stripe: link di pagamento per il singolo buono.
   Si usa una CHIAVE CON LIMITAZIONI (STRIPE_RESTRICTED_KEY), non
   quella del sito: può creare prezzi e link e leggere i pagamenti,
   nient'altro. Se il secret manca, la funzione continua a lavorare
   con il solo bonifico e lo dice.
   ============================================================ */
const STRIPE = 'https://api.stripe.com/v1';

async function stripe(percorso: string, corpo?: Record<string, string>) {
  const chiave = Deno.env.get('STRIPE_RESTRICTED_KEY');
  if (!chiave) throw new Error('Stripe non configurato');
  const r = await fetch(STRIPE + percorso, {
    method: corpo ? 'POST' : 'GET',
    headers: {
      authorization: `Bearer ${chiave}`,
      'content-type': 'application/x-www-form-urlencoded'
    },
    body: corpo ? new URLSearchParams(corpo).toString() : undefined
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error?.message || 'Stripe ha risposto ' + r.status);
  return j;
}

/* prezzo una tantum + link di pagamento per un buono; con `redirect`
   il cliente torna alla pagina indicata, altrimenti resta su Stripe.
   Usata da a=link (back office) e da a=acquista (sito). */
async function creaLinkStripe(
  buono: { numero: string; descrizione: string; valore: number },
  opzioni: { redirect?: string } = {}
) {
  const prezzo = await stripe('/prices', {
    currency: 'eur',
    unit_amount: String(Math.round(Number(buono.valore) * 100)),
    /* con due voci la descrizione arriva su due righe, e il nome di un
       prodotto Stripe e' una riga sola: il ritorno a capo si perderebbe e
       le voci si leggerebbero attaccate sulla pagina di pagamento. Qui
       l'HTML non c'e', quindi si uniscono con ' · ' come gia' fa
       ricevutaEmailHTML. */
    'product_data[name]':
      `Buono regalo — ${String(buono.descrizione ?? '').split('\n').join(' · ')}`.slice(0, 250)
  });
  const dopo: Record<string, string> = opzioni.redirect
    ? { 'after_completion[type]': 'redirect',
        'after_completion[redirect][url]': opzioni.redirect }
    : { 'after_completion[type]': 'hosted_confirmation',
        'after_completion[hosted_confirmation][custom_message]':
          'Grazie. Il buono arriva per email tra pochi minuti.' };
  const linkPag = await stripe('/payment_links', {
    'line_items[0][price]': prezzo.id,
    'line_items[0][quantity]': '1',
    /* un link, un pagamento: senza questo Stripe lo lascia riutilizzabile e
       chi lo inoltra o ricarica la pagina paga due volte lo stesso buono */
    'restrictions[completed_sessions][limit]': '1',
    'metadata[numero]': buono.numero,
    'payment_intent_data[metadata][numero]': buono.numero,
    'payment_intent_data[description]': `Buono regalo ${buono.numero}`,
    ...dopo
  });
  await db.from('buono_regalo')
    .update({ stripe_sessione: linkPag.id, pagamento: 'stripe' })
    .eq('numero', buono.numero);
  return linkPag.url as string;
}

/* verifica della firma del webhook, senza librerie: HMAC-SHA256
   sullo schema "timestamp.corpo" come da documentazione Stripe */
async function firmaValida(corpo: string, intestazione: string | null) {
  const segreto = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  if (!segreto || !intestazione) return false;
  const parti = Object.fromEntries(intestazione.split(',')
    .map(x => x.split('=')).filter(x => x.length === 2)) as Record<string, string>;
  const t = parti['t'], firma = parti['v1'];
  if (!t || !firma) return false;
  /* rifiuta gli eventi vecchi: protegge dai rinvii */
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;

  const chiave = await crypto.subtle.importKey('raw', new TextEncoder().encode(segreto),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const calcolata = await crypto.subtle.sign('HMAC', chiave,
    new TextEncoder().encode(`${t}.${corpo}`));
  const atteso = [...new Uint8Array(calcolata)]
    .map(b => b.toString(16).padStart(2, '0')).join('');
  /* confronto a tempo costante */
  if (atteso.length !== firma.length) return false;
  let diff = 0;
  for (let i = 0; i < atteso.length; i++) diff |= atteso.charCodeAt(i) ^ firma.charCodeAt(i);
  return diff === 0;
}

/* assegna il codice a un buono pagato; usato sia dalla reception
   sia dal webhook, così la regola sta scritta in un punto solo */
async function emettiCodice(numero: string, dati: Record<string, unknown>) {
  for (let i = 0; i < 5; i++) {
    const { data, error } = await db.from('buono_regalo').update({
      codice: nuovoCodice(), stato: 'pagato',
      pagato_il: new Date().toISOString(), ...dati
    }).eq('numero', numero).eq('stato', 'attesa').select().single();
    if (!error) return { buono: data };
    if (!String(error.message).includes('duplicate')) return { errore: error.message };
  }
  return { errore: 'codice non generato' };
}

const risposta = (corpo: unknown, stato = 200) =>
  new Response(JSON.stringify(corpo),
    { status: stato, headers: { ...CORS, 'content-type': 'application/json' } });

/* ============================================================
   ACCESSO: tre strati, tutti e tre devono passare.
   1. utente autenticato con Supabase (email e password personali)
   2. email del dominio dell'hotel
   3. richiesta proveniente dagli IP dell'hotel
   La vecchia chiave condivisa resta accettata solo se il secret
   HOTEL_KEY esiste ancora: serve a non spegnere l'estensione
   durante il passaggio. Toglilo quando tutti hanno un utente.
   ============================================================ */
const DOMINI_AMMESSI = (Deno.env.get('DOMINI_AMMESSI') || 'termeleonardo.com,hldv.com')
  .split(',').map(d => d.trim().toLowerCase()).filter(Boolean);

const IP_AMMESSI = (Deno.env.get('IP_AMMESSI') || '')
  .split(',').map(x => x.trim()).filter(Boolean);

function ipRichiesta(req: Request) {
  /* l'intestazione può contenere più indirizzi: il primo è il client */
  const av = req.headers.get('x-forwarded-for') || '';
  return av.split(',')[0].trim();
}

function ipAmmesso(req: Request) {
  if (!IP_AMMESSI.length) return true;          // nessun elenco = nessun filtro
  const ip = ipRichiesta(req);
  return IP_AMMESSI.includes(ip);
}

/* verifica il token dell'utente chiedendo a Supabase chi è */
async function utenteDaToken(req: Request) {
  const aut = req.headers.get('authorization') || '';
  const token = aut.startsWith('Bearer ') ? aut.slice(7) : '';
  if (!token) return null;
  try {
    const { data, error } = await db.auth.getUser(token);
    if (error || !data?.user?.email) return null;
    const email = data.user.email.toLowerCase();
    const dominio = email.split('@')[1] || '';
    if (!DOMINI_AMMESSI.includes(dominio)) return null;
    return { email, nome: data.user.user_metadata?.nome || email.split('@')[0] };
  } catch { return null; }
}

async function autorizzato(req: Request) {
  if (!ipAmmesso(req)) return { ok: false, motivo: 'fuori sede' };
  const u = await utenteDaToken(req);
  if (u) return { ok: true, utente: u };
  /* transizione: chiave condivisa, finché il secret esiste */
  const attesa = Deno.env.get('HOTEL_KEY');
  if (attesa && req.headers.get('x-hotel-key') === attesa) return { ok: true, utente: null };
  return { ok: false, motivo: 'non autorizzato' };
}

/* Manda il buono e registra com'e' andata.

   Un buono puo' risultare "pagato" senza essere mai arrivato: succede
   davvero, perche' finche' il dominio non e' verificato Resend rifiuta ogni
   indirizzo che non sia quello del titolare dell'account. Senza questa
   registrazione il cliente paga, non riceve niente, e in reception nessuno
   ha modo di accorgersene.

   L'emissione non si blocca mai per un'email non partita: il buono e'
   valido comunque, e si rimanda dal back office. */
async function consegnaERegistra(buono: any): Promise<string> {
  let esiti: Record<string, boolean> = {};
  try {
    esiti = await inviaBuonoEmesso(buono);
  } catch (e) {
    console.error('invio email buono', e);
    /* un'eccezione non e' "nessun indirizzo": e' un invio fallito */
    esiti = { acquirente: false };
  }
  const stato = statoConsegna(esiti);
  try {
    await db.from('buono_regalo').update({
      consegna: stato,
      consegna_il: new Date().toISOString(),
      consegna_esiti: esiti,
    }).eq('numero', buono.numero);
  } catch (e) {
    console.error('registrazione della consegna fallita', e);
  }
  return stato;
}

/* codice leggibile al telefono: niente 0/O, 1/I/L che si confondono */
const ALFABETO = 'ACDEFGHJKMNPQRTUVWXY2346789';
function nuovoCodice() {
  const pezzo = (n: number) => Array.from({ length: n },
    () => ALFABETO[Math.floor(Math.random() * ALFABETO.length)]).join('');
  return `LEO-${pezzo(4)}-${pezzo(4)}`;
}

const testo = (v: unknown, max: number) =>
  v == null ? null : String(v).trim().slice(0, max) || null;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const url = new URL(req.url);
  const azione = url.searchParams.get('a') || '';

  /* ---------- pubblico: verifica di un codice ---------- */
  if (azione === 'verifica') {
    const codice = (url.searchParams.get('codice') || '').toUpperCase().trim();
    if (!codice) return risposta({ errore: 'codice mancante' }, 400);
    const { data } = await db.from('buono_regalo')
      .select('codice, descrizione, valore, scade_il, stato, riscosso_il, voci')
      .eq('codice', codice).maybeSingle();
    if (!data) return risposta({ valido: false, motivo: 'non trovato' }, 404);
    const scaduto = new Date(data.scade_il + 'T23:59:59') < new Date();
    return risposta({
      valido: data.stato === 'pagato' && !scaduto,
      stato: scaduto && data.stato === 'pagato' ? 'scaduto' : data.stato,
      descrizione: data.descrizione, valore: data.valore, voci: data.voci,
      scade_il: data.scade_il, riscosso_il: data.riscosso_il
    });
  }

  /* ---------- pubblico: il buono pronto per il foglio A4 ----------
     Azione SEPARATA da `verifica` qui sopra, di proposito: il ragionamento
     completo — perché non si allarga verifica, cosa può vedere chi chiama
     questa azione e perché, cosa invece non esce mai — sta in stampa.ts,
     accanto a datiStampa() che decide la risposta. Qui restano solo le due
     cose che riguardano il TRASPORTO, non la privacy dei dati:
     - il freno: un contatore in memoria TUTTO SUO (entroIlLimiteStampa,
       limite.ts) — non più lo stesso di ?a=acquista: sono due rischi
       diversi (qui l'enumerazione dei codici, là l'integrità della
       numerazione) e condividere un'unica risorsa lasciava che l'uno
       erodesse il budget dell'altro. Senza freno, chiunque potrebbe
       provare codici a raffica finché non ne indovina uno valido;
     - la select(): elenca ESATTAMENTE i campi che datiStampa può lasciar
       uscire. Anche qui un allow-list, non un blocklist: se domani la
       tabella cresce di una colonna, quella colonna non arriva nemmeno
       fino a datiStampa finché qualcuno non la aggiunge qui apposta. */
  if (azione === 'stampa') {
    const codice = (url.searchParams.get('codice') || '').toUpperCase().trim();
    if (!codice) return risposta({ errore: 'codice mancante' }, 400);
    if (!entroIlLimiteStampa(ipRichiesta(req))) {
      console.warn('stampa respinta per troppe richieste, ip', ipRichiesta(req));
      return risposta({ errore: 'troppe richieste, riprovi tra qualche minuto' }, 429);
    }
    const { data } = await db.from('buono_regalo')
      .select('codice, tipo, voce_id, descrizione, lingua, sottotitolo, destinatario, dedica, acquirente, numero, scade_il, stato')
      .eq('codice', codice).maybeSingle();
    return risposta(datiStampa(data), data ? 200 : 404);
  }

  /* ---------- pubblico: il QR del codice, come immagine, per l'email ----------
     Il perché di un'azione a parte, che genera un'immagine invece di JSON, sta
     nel vincolo che ha deciso tutto il resto: Gmail e Outlook scartano l'SVG
     nelle email (stesso motivo per cui il logo nell'email è logo.png, non
     logo.svg — vedi il test dedicato in email-buono.test.ts), quindi il QR
     dentro buonoEmailHTML non può essere lo stesso SVG del foglio stampato:
     serve un'immagine raster richiamabile da un indirizzo, come già il logo e
     la foto del buono. generaPngQR (qr.js, copia server-side di
     pagine/comune/qr.js — vedi il commento in cima a quel file per il perché
     di una copia) fa esattamente questo.

     NON È UN ORACOLO, DI PROPOSITO. A differenza di ?a=verifica e ?a=stampa
     qui sopra, questa azione NON legge il database: disegna il QR di
     QUALUNQUE testo le venga passato in `codice`, senza chiedersi se
     corrisponde a un buono vero. È voluto — se controllasse l'esistenza del
     codice, chiamarla a raffica con codici a caso e guardare quali rispondono
     "trovato" invece di "non trovato" la trasformerebbe in un modo per
     scoprire quali buoni esistono, esattamente il rischio che stampa.ts
     spiega per ?a=stampa. Così com'è, chi la chiama non impara nulla che non
     sapesse già: ha scelto lui il testo. Niente query al database nemmeno
     per questo: velocità, genera l'immagine e basta, come vuole stare
     "dentro il caricamento di un'email". L'unico limite sul TESTO è sulla
     sua lunghezza, non sul contenuto o sulla validità: un freno contro
     l'abuso di calcolo (un input molto lungo produce un QR di versione più
     alta, più lento da generare), non un controllo di validità del codice.

     IL FRENO È COMPLESSIVO, NON PER INDIRIZZO IP — E NON È UNA DIFESA
     CONTRO L'ABUSO, È UNA RETE CONTRO LE FUGHE. Non essendo un oracolo non
     c'è enumerazione da fermare, quindi qui manca apposta il freno per IP
     che hanno ?a=stampa e ?a=acquista — anzi, uno per IP sarebbe dannoso:
     i proxy immagine dei client di posta (Gmail, e soprattutto Apple Mail
     Privacy Protection, che precarica ogni immagine di ogni email appena
     arriva) arrivano da pool di indirizzi condivisi fra destinatari
     scollegati fra loro, e frenare per IP farebbe sparire il QR a gruppi
     interi di ospiti veri. entroIlLimiteQr (limite.ts) è un tetto UNICO
     sull'intera funzione, non un contatore per chi chiama — ma proprio
     perché è condiviso, chiunque può tenerlo pieno di proposito (basta un
     ritmo costante, senza bisogno di più indirizzi) e spegnere il QR a
     TUTTI per tutto il tempo che vuole: non protegge da questo, per
     costruzione, a nessun valore del tetto. Serve solo a limitare il danno
     di un baco nostro (un ciclo impazzito che richiama questa azione), non
     a fermare un aggressore — vedi il commento sopra il numero in
     limite.ts per il conto completo e la finestra di traffico legittimo
     che il numero non deve mai toccare. */
  if (azione === 'qr') {
    const testo = url.searchParams.get('codice') || '';
    if (!testo) return risposta({ errore: 'codice mancante' }, 400);
    if (testo.length > 128) return risposta({ errore: 'codice troppo lungo' }, 400);
    if (!entroIlLimiteQr()) {
      console.warn('qr respinto per troppe richieste complessive');
      return risposta({ errore: 'troppe richieste, riprovi tra qualche minuto' }, 429);
    }
    let corpo: ArrayBuffer;
    try {
      /* generaPngQR vive in qr.js, un modulo .js senza annotazioni di tipo:
         deno check infra il suo Uint8Array come Uint8Array<ArrayBufferLike>
         (potenzialmente un SharedArrayBuffer), che Response non accetta più
         come corpo con le definizioni di tipo più recenti. new Uint8Array(...)
         qui copia in una vista fresca, di sicuro su un ArrayBuffer vero. */
      corpo = new Uint8Array(generaPngQR(testo, { livello: 'Q', margine: 4, scala: 8 })).buffer;
    } catch (e) {
      console.error('generazione QR fallita', (e as Error).message);
      return risposta({ errore: 'generazione non riuscita' }, 500);
    }
    return new Response(corpo, {
      status: 200,
      headers: {
        ...CORS,
        'content-type': 'image/png',
        /* il codice di un buono non cambia mai dopo l'emissione: la stessa
           chiamata produce sempre lo stesso PNG, un anno dopo compreso —
           si può mettere in cache per sempre, alleggerendo sia il client di
           posta (Gmail e simili tengono comunque una cache propria) sia
           questa funzione sulle riaperture ripetute della stessa email */
        'cache-control': 'public, max-age=31536000, immutable',
      },
    });
  }

  /* ---------- Stripe ha incassato: il buono si sblocca da solo ---------- */
  if (azione === 'webhook') {
    const grezzo = await req.text();
    if (!(await firmaValida(grezzo, req.headers.get('stripe-signature')))) {
      console.warn('webhook con firma non valida: ignorato');
      return risposta({ errore: 'firma non valida' }, 400);
    }
    let evento: any;
    try { evento = JSON.parse(grezzo); } catch { return risposta({ errore: 'corpo illeggibile' }, 400); }

    if (evento.type !== 'checkout.session.completed') return risposta({ ricevuto: true });
    const sessione = evento.data?.object || {};
    if (sessione.payment_status !== 'paid') return risposta({ ricevuto: true });

    /* il buono si riconosce dal link salvato alla creazione, oppure
       dal numero messo nei metadati: due strade, la seconda di scorta */
    const link = sessione.payment_link;
    const numero = sessione.metadata?.numero || null;
    let q = db.from('buono_regalo').select('numero, stato, pagamento_rif');
    q = numero ? q.eq('numero', numero) : q.eq('stripe_sessione', link);
    const { data: buono } = await q.maybeSingle();

    if (!buono) { console.error('pagamento senza buono:', link, numero); return risposta({ ricevuto: true }); }
    /* Stripe rimanda lo stesso evento quando rispondiamo piano: quello è
       normale e si ignora in silenzio. Un pagamento con un payment_intent
       DIVERSO su un buono già chiuso è un'altra cosa: sono soldi arrivati
       senza un buono dietro. Distinguere i due casi è ciò che rende il
       log credibile invece di un allarme che grida sempre. */
    const rifPagamento = sessione.payment_intent || sessione.id;
    if (buono.stato !== 'attesa') {
      if (rifPagamento !== buono.pagamento_rif)
        console.error('SECONDO pagamento su buono già', buono.stato, '-',
          buono.numero, 'payment_intent', rifPagamento);
      return risposta({ ricevuto: true });
    }

    const esito = await emettiCodice(buono.numero, {
      pagamento: 'stripe',
      pagamento_rif: rifPagamento,
      pagato_da: 'Stripe (automatico)'
    });
    if (esito.errore) console.error('emissione fallita:', esito.errore);
    else await consegnaERegistra(esito.buono);
    return risposta({ ricevuto: true });
  }

  /* ---------- pubblico: acquisto dal sito, si paga con carta ---------- */
  if (azione === 'acquista' && req.method === 'POST') {
    /* due freni: quello in memoria costa nulla e prende il caso facile
       (contatore suo, separato da quello di ?a=stampa — vedi limite.ts),
       quello sul database regge anche fra istanze diverse */
    if (!entroIlLimiteAcquista(ipRichiesta(req)) || await troppiDalSito(db)) {
      console.warn('acquisto respinto per troppe richieste, ip', ipRichiesta(req));
      return risposta({ errore: 'troppe richieste, riprovi tra qualche minuto' }, 429);
    }
    let b: Record<string, unknown>;
    try { b = await req.json(); } catch { b = {}; }

    /* prezzi e limiti decisi qui, non dal browser */
    const v = validaAcquisto(b);
    if (v.errore) return risposta({ errore: v.errore }, 400);
    const d = v.dati!;

    const { data: num, error: eNum } = await db.rpc('prossimo_numero_buono');
    const riga0 = Array.isArray(num) ? num[0] : num;
    if (eNum || !riga0) return risposta({ errore: 'salvataggio non riuscito' }, 500);

    const { data: ins, error } = await db.from('buono_regalo').insert({
      anno: riga0.anno, progressivo: riga0.progressivo, numero: riga0.numero,
      stato: 'attesa', tipo: d.tipo, voce_id: d.voce_id,
      /* la scelta in forma leggibile da una macchina: null per i buoni
         monetari, non un array vuoto — vedi colonnaVoci in acquista.ts */
      voci: colonnaVoci(d.voci),
      descrizione: d.descrizione, valore: d.valore, lingua: d.lingua,
      acquirente: d.acquirente || null,
      acquirente_email: d.acquirente_email,
      destinatario: d.destinatario || null,
      destinatario_email: d.destinatario_email || null,
      ricevuta_email: d.ricevuta_email || null,
      dedica: d.dedica || null,
      scade_il: d.scade_il,
      pagamento: 'stripe', creato_da: 'sito',
      /* l'ora la mette il server, non il browser: è la traccia che le
         condizioni sono state accettate prima del pagamento. La versione
         serve a sapere QUALE testo è stato accettato: alzarla ogni volta
         che le CONDIZIONI cambiano, o la traccia indica un testo che non
         esiste più. */
      /* i due consensi si registrano separati: se qualcuno chiede conto di
         quale e' stato dato, "condizioni + privacy" e' una risposta, un
         "accettato" generico no */
      note: `acquisto dal sito · condizioni v1 e informativa privacy accettate il ${
        new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`
    }).select().single();
    if (error || !ins) return risposta({ errore: 'salvataggio non riuscito' }, 500);

    /* al ritorno da Stripe il cliente atterra sulla pagina di ringraziamento */
    const ritorno = String(b.ritorno || Deno.env.get('BASE_REGALA') || '');
    try {
      const urlPag = await creaLinkStripe(ins, {
        redirect: ritorno
          ? `${ritorno}${ritorno.includes('?') ? '&' : '?'}ok=1&rif=${encodeURIComponent(ins.numero)}`
          : undefined
      });
      return risposta({ numero: ins.numero, url: urlPag });
    } catch (e) {
      console.error('link di pagamento non creato:', (e as Error).message);
      /* senza link il cliente non potrà mai pagare: il buono appena
         inserito resterebbe in elenco come un'attesa che non arriva mai,
         e la reception starebbe dietro a un fantasma. Si toglie. */
      await db.from('buono_regalo').delete()
        .eq('numero', ins.numero).eq('stato', 'attesa');
      return risposta({ errore: 'pagamento non disponibile al momento' }, 502);
    }
  }

  /* ---------- da qui in poi serve la chiave ---------- */
  const acc = await autorizzato(req);
  if (!acc.ok) {
    return risposta({ errore: acc.motivo === 'fuori sede'
      ? 'Questa pagina si usa dalla rete dell’hotel.'
      : 'Accesso non valido: controlli email e password.' }, 401);
  }
  /* l'operatore è quello autenticato, non quello digitato a mano */
  const OPERATORE = acc.utente?.nome || null;

  if (req.method === 'GET' && azione === 'elenco') {
    const stato = url.searchParams.get('stato') || '';
    const cerca = (url.searchParams.get('cerca') || '').trim();
    let q = db.from('buono_regalo').select('*').order('creato_il', { ascending: false }).limit(200);
    if (stato) q = q.eq('stato', stato);
    if (cerca) q = q.or(
      `codice.ilike.%${cerca}%,acquirente.ilike.%${cerca}%,destinatario.ilike.%${cerca}%`);
    const { data, error } = await q;
    if (error) return risposta({ errore: error.message }, 500);
    return risposta({ buoni: data });
  }

  if (req.method !== 'POST') return risposta({ errore: 'metodo non ammesso' }, 405);

  let b: Record<string, unknown>;
  try { b = await req.json(); }
  catch { return risposta({ errore: 'corpo non leggibile' }, 400); }

  if (azione === 'crea') {
    const valore = Number(b.valore);
    if (!b.descrizione || !isFinite(valore) || valore <= 0)
      return risposta({ errore: 'servono descrizione e valore' }, 400);

    /* pagato subito (reception od omaggio) oppure in attesa (richiesta via email) */
    const subito = nasceGiaPagato(b.pagamento);

    const { data: num, error: eNum } = await db.rpc('prossimo_numero_buono');
    const riga0 = Array.isArray(num) ? num[0] : num;
    if (eNum || !riga0) return risposta({ errore: eNum?.message || 'numerazione fallita' }, 500);

    /* validità: 12 mesi, come scritto nelle FAQ del sito */
    const scade = b.scade_il ? String(b.scade_il) : (() => {
      const d = new Date(); d.setFullYear(d.getFullYear() + 1);
      return d.toISOString().slice(0, 10);
    })();

    /* il codice si assegna solo quando il buono è pagato */
    let creato = null, errore = null;
    for (let i = 0; i < 5 && !creato; i++) {
      const { data, error } = await db.from('buono_regalo').insert({
        anno: riga0.anno, progressivo: riga0.progressivo, numero: riga0.numero,
        codice: subito ? nuovoCodice() : null,
        stato: subito ? 'pagato' : 'attesa',
        pagato_il: subito ? new Date().toISOString() : null,
        pagato_da: subito ? testo(OPERATORE || b.operatore, 80) : null,
        pagamento_rif: testo(b.pagamento_rif, 80),
        destinatario_email: testo(b.destinatario_email, 160),
        creato_da:        testo(OPERATORE || b.operatore, 80),
        tipo:             b.tipo === 'valore' ? 'valore' : 'servizio',
        voce_id:          testo(b.voce_id, 40),
        descrizione:      String(b.descrizione).slice(0, 300),
        valore,
        lingua:           ['it','de','en','fr'].includes(String(b.lingua)) ? String(b.lingua) : 'it',
        sottotitolo:      testo(b.sottotitolo, 120),
        acquirente:       testo(b.acquirente, 120),
        acquirente_email: testo(b.acquirente_email, 160),
        acquirente_tel:   testo(b.acquirente_tel, 40),
        destinatario:     testo(b.destinatario, 120),
        dedica:           testo(b.dedica, 400),
        scade_il:         scade,
        pagamento:        testo(b.pagamento, 20),
        note:             testo(b.note, 500)
      }).select().single();
      if (!error) { creato = data; break; }
      errore = error;
      if (!String(error.message).includes('duplicate')) break;
    }
    if (!creato) return risposta({ errore: errore?.message || 'creazione fallita' }, 500);
    /* i buoni emessi subito in reception non passano dal webhook: l'avviso
       interno parte da qui, o un omaggio non lascerebbe alcuna traccia.
       Al cliente non si spedisce nulla: il buono glielo consegna la
       reception con i pulsanti di stampa ed email. */
    if (subito) {
      try { await avvisaAmministrazione(creato); }
      catch (e) { console.error('avviso amministrazione', e); }
    }
    return risposta({ ok: true, buono: creato });
  }

  /* ---------- l'incasso è arrivato: si emette il codice ---------- */
  if (azione === 'pagato') {
    const numero = String(b.numero || '').toUpperCase().trim();
    if (!numero) return risposta({ errore: 'numero mancante' }, 400);
    const { data: esistente } = await db.from('buono_regalo')
      .select('stato, codice').eq('numero', numero).maybeSingle();
    if (!esistente) return risposta({ errore: 'buono non trovato' }, 404);
    if (esistente.stato !== 'attesa')
      return risposta({ errore: `il buono risulta già ${esistente.stato}` }, 409);

    const esito = await emettiCodice(numero, {
      pagato_da: testo(OPERATORE || b.operatore, 80),
      pagamento: testo(b.pagamento, 20),
      pagamento_rif: testo(b.pagamento_rif, 80)
    });
    if (esito.errore) return risposta({ errore: esito.errore }, 500);
    const consegna = await consegnaERegistra(esito.buono);
    return risposta({ ok: true, buono: { ...esito.buono, consegna }, consegna });
  }

  /* ---------- prepara il link di pagamento per un buono in attesa ---------- */
  if (azione === 'link') {
    const numero = String(b.numero || '').toUpperCase().trim();
    const { data: buono } = await db.from('buono_regalo')
      .select('numero, descrizione, valore, stato, acquirente_email').eq('numero', numero).maybeSingle();
    if (!buono) return risposta({ errore: 'buono non trovato' }, 404);
    if (buono.stato !== 'attesa') return risposta({ errore: `il buono risulta già ${buono.stato}` }, 409);

    try {
      const urlPag = await creaLinkStripe(buono);
      return risposta({ ok: true, url: urlPag });
    } catch (e) {
      return risposta({ errore: String((e as Error).message) }, 502);
    }
  }

  if (azione === 'riscuoti' || azione === 'annulla') {
    const codice = String(b.codice || '').toUpperCase().trim();
    if (!codice) return risposta({ errore: 'codice mancante' }, 400);
    const { data: esistente } = await db.from('buono_regalo')
      .select('stato').or(`codice.eq.${codice},numero.eq.${codice}`).maybeSingle();
    if (!esistente) return risposta({ errore: 'buono non trovato' }, 404);
    if (esistente.stato === 'attesa')
      return risposta({ errore: 'il buono non risulta ancora pagato' }, 409);
    if (esistente.stato !== 'pagato')
      return risposta({ errore: `il buono risulta già ${esistente.stato}` }, 409);

    const patch = azione === 'riscuoti'
      ? { stato: 'riscosso', riscosso_il: new Date().toISOString(),
          riscosso_da: testo(OPERATORE || b.operatore, 80), riscosso_note: testo(b.note, 300) }
      : { stato: 'annullato', riscosso_note: testo(b.note, 300) };

    const { error } = await db.from('buono_regalo').update(patch)
      .or(`codice.eq.${codice},numero.eq.${codice}`);
    if (error) return risposta({ errore: error.message }, 500);
    return risposta({ ok: true });
  }

  return risposta({ errore: 'azione sconosciuta' }, 400);
});
