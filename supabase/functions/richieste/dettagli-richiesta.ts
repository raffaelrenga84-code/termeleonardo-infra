/* ============================================================
   dettagli-richiesta.ts — il blocco «cosa ha chiesto», per chiunque lo mandi.

   Stava dentro conferma.ts, ed era giusto finche' l'unica email che lo
   mostrava era la conferma. Da oggi lo mostrano in due: la conferma che la
   reception manda a mano, e la RICEVUTA automatica che l'ospite riceve
   appena preme invia.

   PERCHE' NON SI RICOPIA. Due copie di questo blocco divergono al primo
   cambiamento, e il giorno che divergono l'ospite legge una cosa nella
   ricevuta e un'altra nella conferma — che e' peggio di non avere la
   ricevuta. E' la stessa mossa gia' fatta con pagine/comune/obbligatori.js
   e pagine/comune/atam.js, per la stessa ragione.

   Qui stanno le ETICHETTE DEI CAMPI e il modo di disegnarli. I testi del
   messaggio — il titolo, il saluto, l'oggetto — restano in chi manda
   l'email, perche' una conferma e una ricevuta dicono cose diverse.
   ============================================================ */

export const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

/* Le etichette dei campi, nelle quattro lingue. Chi manda l'email le
   mescola con le sue: `{ ...ETICHETTE[l], ...MIE[l] }`. */
export const ETICHETTE: Record<string, Record<string, string>> = {
  it: {
    periodo: 'Periodo', camera: 'Camera', pacchetto: 'Pacchetto', trattamento: 'Trattamento', caparra: 'Caparra indicata',
    quando: 'Quando', dove: 'Dove', persone: 'Persone', volo: 'Volo / treno',
    ritorno: 'Ritorno incluso', rif: 'Riferimento',
    noleggi: 'Noleggi', taxi: 'Taxi dall’hotel', trattamenti: 'Trattamenti',
    servizio: 'Servizio', navetta: 'Navetta condivisa', privata: 'Auto privata',
    buono: 'Buono regalo',
    cane: 'Cane al seguito', si: 'Sì',
    prezzo: 'Prezzo', allAutista: 'da pagare direttamente all’autista', oraVolo: 'volo',
    modifiche: 'Cosa è cambiato rispetto alla richiesta',
    chiesto: 'Aveva chiesto', confermato: 'Confermiamo',
    oraArrivo: 'Arrivo previsto', mezzo: 'Come arriva', attenzioni: 'Piccole attenzioni',
    fanghi: 'Fanghi', personeAgg: 'Persone da aggiungere', note: 'Note',
    attCulla: 'Culla', attSeggiolone: 'Seggiolone', attParcheggio: 'Parcheggio', attCane: 'Cane al seguito',
    fanghiPresto: 'Presto', fanghiTardi: 'Più tardi', fanghiIndifferente: 'Indifferente',
    ragione: 'Intestazione', indirizzo: 'Indirizzo', piva: 'Partita IVA',
    cf: 'Codice fiscale', sdi: 'Codice SDI', pec: 'PEC',
  },
  de: {
    periodo: 'Zeitraum', camera: 'Zimmer', pacchetto: 'Paket', trattamento: 'Verpflegung', caparra: 'Angegebene Anzahlung',
    quando: 'Wann', dove: 'Wo', persone: 'Personen', volo: 'Flug / Zug',
    ritorno: 'Rückfahrt inbegriffen', rif: 'Referenz',
    noleggi: 'Verleih', taxi: 'Taxi ab Hotel', trattamenti: 'Anwendungen',
    servizio: 'Service', navetta: 'Sammeltransfer', privata: 'Privatwagen',
    buono: 'Gutschein',
    cane: 'Mit Hund', si: 'Ja',
    prezzo: 'Preis', allAutista: 'direkt an den Fahrer zu zahlen', oraVolo: 'Flug',
    modifiche: 'Was sich gegenüber Ihrer Anfrage geändert hat',
    chiesto: 'Angefragt', confermato: 'Bestätigt',
    oraArrivo: 'Voraussichtliche Ankunft', mezzo: 'Anreise mit', attenzioni: 'Kleine Aufmerksamkeiten',
    fanghi: 'Fangopackung', personeAgg: 'Weitere Personen', note: 'Anmerkungen',
    attCulla: 'Babybett', attSeggiolone: 'Hochstuhl', attParcheggio: 'Parkplatz', attCane: 'Hund dabei',
    fanghiPresto: 'Früh', fanghiTardi: 'Später', fanghiIndifferente: 'Egal',
    ragione: 'Rechnungsempfänger', indirizzo: 'Adresse', piva: 'USt-IdNr.',
    cf: 'Steuernummer', sdi: 'SDI-Code', pec: 'PEC',
  },
  en: {
    periodo: 'Dates', camera: 'Room', pacchetto: 'Package', trattamento: 'Board', caparra: 'Deposit indicated',
    quando: 'When', dove: 'Where', persone: 'People', volo: 'Flight / train',
    ritorno: 'Return trip included', rif: 'Reference',
    noleggi: 'Rentals', taxi: 'Taxi from the hotel', trattamenti: 'Treatments',
    servizio: 'Service', navetta: 'Shared shuttle', privata: 'Private car',
    buono: 'Gift voucher',
    cane: 'Travelling with a dog', si: 'Yes',
    prezzo: 'Price', allAutista: 'to be paid directly to the driver', oraVolo: 'flight',
    modifiche: 'What has changed from your request',
    chiesto: 'Originally requested', confermato: 'Now confirmed',
    oraArrivo: 'Expected arrival', mezzo: 'Travelling by', attenzioni: 'Small touches',
    fanghi: 'Mud therapy', personeAgg: 'People to add', note: 'Notes',
    attCulla: 'Baby cot', attSeggiolone: 'High chair', attParcheggio: 'Parking', attCane: 'Dog coming along',
    fanghiPresto: 'Early', fanghiTardi: 'Later', fanghiIndifferente: 'No preference',
    ragione: 'Billed to', indirizzo: 'Address', piva: 'VAT number',
    cf: 'Tax code', sdi: 'SDI code', pec: 'PEC',
  },
  fr: {
    periodo: 'Dates', camera: 'Chambre', pacchetto: 'Forfait', trattamento: 'Pension', caparra: 'Acompte indiqué',
    quando: 'Quand', dove: 'Où', persone: 'Personnes', volo: 'Vol / train',
    ritorno: 'Retour inclus', rif: 'Référence',
    noleggi: 'Locations', taxi: 'Taxi depuis l’hôtel', trattamenti: 'Soins',
    servizio: 'Service', navetta: 'Navette partagée', privata: 'Voiture privée',
    buono: 'Chèque-cadeau',
    cane: 'Avec un chien', si: 'Oui',
    prezzo: 'Prix', allAutista: 'à régler directement au chauffeur', oraVolo: 'vol',
    modifiche: 'Ce qui a changé par rapport à votre demande',
    chiesto: 'Demandé initialement', confermato: 'Confirmé',
    oraArrivo: 'Arrivée prévue', mezzo: 'Moyen de transport', attenzioni: 'Petites attentions',
    fanghi: 'Boues', personeAgg: 'Personnes à ajouter', note: 'Remarques',
    attCulla: 'Lit bébé', attSeggiolone: 'Chaise haute', attParcheggio: 'Parking', attCane: 'Chien accepté',
    fanghiPresto: 'Tôt', fanghiTardi: 'Plus tard', fanghiIndifferente: 'Peu importe',
    ragione: 'Facturé à', indirizzo: 'Adresse', piva: 'N° TVA',
    cf: 'Code fiscal', sdi: 'Code SDI', pec: 'PEC',
  },
};

export const LINGUE = ['it', 'de', 'en', 'fr'];

/** La lingua dell'ospite, o l'italiano se non ne dice una che conosciamo. */
export const linguaDi = (v: unknown) =>
  LINGUE.includes(String(v)) ? String(v) : 'it';

/* l'ospite scrive 2026-09-10, ma legge 10/09/2026 */
function data(iso: unknown): string {
  const [a, m, g] = String(iso ?? '').split('-');
  return g ? `${g}/${m}/${a}` : '';
}

/* `vecchio` e' quello che l'ospite AVEVA chiesto, quando la reception l'ha
   cambiato e ha spuntato la casella. Compare accanto al valore nuovo, non in
   coda all'email: fino al 18 agosto 2026 stava solo la' in fondo, sotto la
   didascalia piu' pallida della pagina, mentre qui sopra il valore nuovo era
   scritto in carattere normale — e chi si fermava ai dettagli non sapeva che
   qualcosa era cambiato.

   SBARRATO PIU' LA PAROLA. Certi programmi di posta buttano via gli stili, e
   c'e' chi i colori li legge male: se cade la linea, «Aveva chiesto: 09:00»
   resta comprensibile da solo. Il grassetto sul valore nuovo si accende solo
   quando c'e' stato un cambio, cosi' le righe non toccate restano quiete. */
export function riga(
  etichetta: string,
  valore: string,
  vecchio?: string | null,
  t?: Record<string, string>,
): string {
  if (!valore) return '';
  const cambio = vecchio && t
    ? `<div style="font-size:13px;color:#8A938F;padding-top:2px;">${esc(t.chiesto)}:
       <span style="text-decoration:line-through;">${esc(vecchio)}</span></div>`
    : '';
  const nuovo = cambio ? `<strong>${esc(valore)}</strong>` : esc(valore);
  return `<tr>
    <td style="padding:7px 16px 7px 0;color:#8A938F;font-size:13px;white-space:nowrap;vertical-align:top;">${esc(etichetta)}</td>
    <td style="padding:7px 0;color:#1B4D4A;font-size:15px;">${nuovo}${cambio}</td>
  </tr>`;
}

/* Le chiavi che le righe di ogni tipo leggono davvero. Serve al riquadro in
   coda per sapere quali differenze sono gia' visibili accanto a un campo e
   quali resterebbero altrimenti invisibili — es. le note del transfer, che
   `tipi.ts` accetta ma la conferma non disegna. Stessa idea di
   differenzeNonMostrate() nel back office. */
export const CHIAVI_MOSTRATE: Record<string, string[]> = {
  transfer: [
    'quando', 'ora', 'ora_volo', 'luogo', 'verso', 'collettivo', 'pax', 'volo',
    'ritorno', 'ritorno_quando', 'ritorno_ora', 'ritorno_volo', 'ritorno_collettivo',
    'prezzo_cent',
  ],
  greenfee: [
    'circolo_nome', 'data', 'ora', 'giocatori', 'golfcar', 'carrello',
    'carrello_elettrico', 'sacca', 'taxi', 'taxi_ora', 'taxi_ritorno',
  ],
  maestro: ['data', 'ora', 'persone'],
  dayspa: ['giorno', 'persone'],
  trattamenti: ['giorno', 'fascia', 'voci'],
  /* persone_confermate NON e' in questo elenco apposta: e' la casella che
     la reception spunta quando ha risposto sulle persone da aggiungere, non
     un campo disegnato qui sopra. Tenendola fuori, se l'operatore chiede di
     segnalare i cambiamenti, l'ospite la legge nel riquadro in coda invece
     che sparire. */
  arrivo: ['ora_arrivo', 'mezzo', 'attenzioni', 'fanghi_desiderio', 'persone_extra', 'note'],
  fattura: ['ragione', 'indirizzo', 'piva', 'cf', 'sdi', 'pec'],
};

/* ============================================================
   LE CHIAVI CHE DIVENTANO PAROLE.

   Le attenzioni e il desiderio dei fanghi viaggiano come CHIAVI e non come
   testo (tipi.ts, ATTENZIONI e DESIDERI_FANGHI): la pagina d'arrivo parla
   quattro lingue e «Culla per neonato» finirebbe in back office letto da
   chi in quel momento aveva davanti «Babybett». Qui si fa il giro opposto,
   perche' questa email la rilegge l'ospite nella SUA lingua.

   Uno switch e non un OGGETTO[chiave]: e' la stessa cautela di
   riepilogo.ts e differenze.ts — una chiave come «toString» esiste su
   Object.prototype, e una lookup diretta restituirebbe la funzione
   ereditata invece di sparire. Una chiave sconosciuta sparisce: stampare
   all'ospite il nome interno di un campo e' il parente stretto di
   «undefined».
   ============================================================ */
function attenzione(chiave: string, t: Record<string, string>): string {
  switch (chiave) {
    case 'culla': return t.attCulla;
    case 'seggiolone': return t.attSeggiolone;
    case 'parcheggio': return t.attParcheggio;
    case 'cane': return t.attCane;
    default: return '';
  }
}

function desiderioFanghi(chiave: string, t: Record<string, string>): string {
  switch (chiave) {
    case 'presto': return t.fanghiPresto;
    case 'tardi': return t.fanghiTardi;
    case 'indifferente': return t.fanghiIndifferente;
    default: return '';
  }
}

/* «Elena (12) · Marco»: il nome e' obbligatorio, l'eta' no. Le voci senza
   nome non esistono gia' a monte (validaArrivo le scarta), ma un elenco
   letto da una riga vecchia puo' averle: una voce vuota qui e' un
   «(undefined)» in meno nell'email dell'ospite. */
function elencoPersone(v: unknown): string {
  if (!Array.isArray(v)) return '';
  return v.map((p) => {
    const o = (p && typeof p === 'object') ? p as Record<string, unknown> : {};
    const nome = String(o.nome ?? '').trim();
    const eta = String(o.eta ?? '').trim();
    return nome ? (eta ? `${nome} (${eta})` : nome) : '';
  }).filter(Boolean).join(' · ');
}

/* Ogni tipo racconta le sue cose. Un tipo non ancora previsto non rompe
   niente: mostra solo il riferimento, che e' meglio di "undefined".

   Ogni voce sa CALCOLARSI da un oggetto dati qualunque. E' la riga che rende
   possibile mostrare accanto al campo quello che l'ospite aveva chiesto:
   la stessa `calcola` gira due volte, una sui dati definitivi e una su
   `dati_originali`. Scrivere le due versioni a mano vorrebbe dire due
   formattazioni della stessa cosa, e il giorno che divergono l'ospite legge
   «aveva chiesto: 2026-09-10» accanto a «10 settembre 2026». */
type Voce = { eti: string; calcola: (d: Record<string, unknown>) => string };

function vociDettagli(tipo: string, t: Record<string, string>): Voce[] {
  if (tipo === 'transfer') {
    return [
      /* con la navetta in partenza l'ora della corsa e' tre ore prima del
         volo: vedersi confermare «11:30» senza vedere il volo delle 14:30
         sembra uno sbaglio nostro */
      {
        eti: t.quando,
        calcola: (d) =>
          `${data(d.quando)}${d.ora ? ' · ' + String(d.ora) : ''}` +
          (d.ora_volo ? ` (${t.oraVolo} ${String(d.ora_volo)})` : ''),
      },
      { eti: t.dove, calcola: (d) => `${d.verso === 'partenza' ? '→' : '←'} ${String(d.luogo ?? '')}` },
      { eti: t.servizio, calcola: (d) => d.collettivo === true ? t.navetta : t.privata },
      { eti: t.persone, calcola: (d) => String(d.pax ?? '') },
      { eti: t.volo, calcola: (d) => String(d.volo ?? '') },
      /* «✓» e basta era quello che diceva prima: l'ospite non rileggeva mai
         il giorno e l'ora della seconda corsa, e non poteva accorgersi di un
         errore. Le richieste vecchie hanno solo il booleano, e per quelle il
         segno di spunta resta l'unica cosa onesta da mostrare. */
      {
        eti: t.ritorno,
        calcola: (d) =>
          d.ritorno !== true
            ? ''
            : (d.ritorno_quando
              ? `${data(d.ritorno_quando)}${d.ritorno_ora ? ' · ' + String(d.ritorno_ora) : ''}`
              : '✓'),
      },
      /* il prezzo lo conferma la reception: senza, la riga non c'e' —
         «non c'e' un prezzo» e «e' gratis» sono due cose diverse */
      { eti: t.prezzo, calcola: (d) => euro(d.prezzo_cent, t) },
    ];
  }
  if (tipo === 'greenfee') {
    return [
      { eti: t.dove, calcola: (d) => String(d.circolo_nome ?? '') },
      { eti: t.quando, calcola: (d) => `${data(d.data)}${d.ora ? ' · ' + String(d.ora) : ''}` },
      { eti: t.persone, calcola: (d) => String(d.giocatori ?? '') },
      {
        eti: t.noleggi,
        calcola: (d) =>
          [
            d.golfcar === true ? 'golf car' : '', d.carrello === true ? 'trolley' : '',
            d.carrello_elettrico === true ? 'e-trolley' : '', d.sacca === true ? 'set' : '',
          ].filter(Boolean).join(' · '),
      },
      {
        eti: t.taxi,
        calcola: (d) =>
          d.taxi === true
            ? `${String(d.taxi_ora ?? '')}${d.taxi_ritorno === true ? ' · ' + t.ritorno : ''}`
            : '',
      },
    ];
  }
  if (tipo === 'maestro') {
    return [
      { eti: t.quando, calcola: (d) => `${data(d.data)}${d.ora ? ' · ' + String(d.ora) : ''}` },
      { eti: t.persone, calcola: (d) => String(d.persone ?? '') },
    ];
  }
  if (tipo === 'dayspa') {
    return [
      { eti: t.quando, calcola: (d) => data(d.giorno) },
      { eti: t.persone, calcola: (d) => String(d.persone ?? '') },
    ];
  }
  /* LA RICHIESTA DI UNA CAMERA. Mancava, e l'ospite riceveva un'email che
     annunciava il riepilogo e poi mostrava il solo riferimento. I dati
     c'erano tutti — l'avviso alla reception li stampa da sempre: erano
     solo le colonne, che qui non arrivavano. */
  if (tipo === 'soggiorno') {
    return [
      {
        eti: t.periodo,
        calcola: (d) => [data(d.check_in), data(d.check_out)].filter(Boolean).join(" → "),
      },
      { eti: t.persone, calcola: (d) => String(d.ospiti ?? "") },
      { eti: t.camera, calcola: (d) => String(d.tipo_camera ?? "") },
      { eti: t.pacchetto, calcola: (d) => String(d.pacchetto ?? d.tariffa ?? "") },
      { eti: t.trattamento, calcola: (d) => String(d.trattamento ?? "") },
      { eti: t.prezzo, calcola: (d) => cifra(d.prezzo_cent) },
      /* la caparra non c'e' sempre: dove manca la riga non compare, perche
         «0,00 €» stampato si legge come una promessa di gratuita' */
      { eti: t.caparra, calcola: (d) => cifra(d.caparra_cent) },
      /* il cane compare solo se c'e': la reception deve saperlo prima di
         assegnare la camera, e chi non ne ha uno non deve leggere «no» */
      { eti: t.cane, calcola: (d) => (d.cane ? t.si : '') },
      /* il buono: la reception lo verifica e lo scala dal conto. Compare
         solo se c'e', come tutto il resto. */
      { eti: t.buono, calcola: (d) => String(d.buono ?? ''), }
    ];
  }

  if (tipo === 'trattamenti') {
    return [
      { eti: t.quando, calcola: (d) => `${data(d.giorno)}${d.fascia ? ' · ' + String(d.fascia) : ''}` },
      {
        eti: t.trattamenti,
        calcola: (d) => (Array.isArray(d.voci) ? (d.voci as string[]) : []).join(' · '),
      },
    ];
  }

  /* IL CHECK-IN ONLINE. Mancava, e l'unica email con cui la reception puo'
     rispondere sulle persone da aggiungere annunciava «Il dettaglio:» e poi
     mostrava il solo numero. Le persone e le note dell'ospite vivevano solo
     nella casella info@: qui tornano dove le legge chi le ha scritte.

     `ora_arrivo` e `mezzo` NON si traducono: la pagina d'arrivo li manda
     gia' come testo scelto dall'ospite nella sua lingua (le <option> di
     pagine/index.html non hanno un value), quindi tradurli qui vorrebbe
     dire indovinare da quale delle quattro liste viene la stringa. Le
     attenzioni e il desiderio dei fanghi invece sono chiavi, e si traducono
     (vedi attenzione() e desiderioFanghi() sopra). */
  if (tipo === 'arrivo') {
    return [
      { eti: t.oraArrivo, calcola: (d) => String(d.ora_arrivo ?? '') },
      { eti: t.mezzo, calcola: (d) => String(d.mezzo ?? '') },
      {
        eti: t.attenzioni,
        calcola: (d) => (Array.isArray(d.attenzioni) ? d.attenzioni : [])
          .map((a) => attenzione(String(a ?? ''), t)).filter(Boolean).join(' · '),
      },
      { eti: t.fanghi, calcola: (d) => desiderioFanghi(String(d.fanghi_desiderio ?? ''), t) },
      { eti: t.personeAgg, calcola: (d) => elencoPersone(d.persone_extra) },
      { eti: t.note, calcola: (d) => String(d.note ?? '') },
    ];
  }

  /* LA FATTURA. L'amministrazione la riceve in copia, ma la conferma che
     rilegge l'ospite deve ripetere quello che ci ha dato: e' l'unico modo
     che ha di accorgersi di una partita IVA sbagliata PRIMA che il
     documento sia emesso. */
  if (tipo === 'fattura') {
    return [
      { eti: t.ragione, calcola: (d) => String(d.ragione ?? '') },
      { eti: t.indirizzo, calcola: (d) => String(d.indirizzo ?? '') },
      { eti: t.piva, calcola: (d) => String(d.piva ?? '') },
      { eti: t.cf, calcola: (d) => String(d.cf ?? '') },
      { eti: t.sdi, calcola: (d) => String(d.sdi ?? '') },
      { eti: t.pec, calcola: (d) => String(d.pec ?? '') },
    ];
  }
  return [];
}

/* I centesimi come li legge una persona. Stesso trabocchetto gia' pagato in
   email-richiesta.ts e in differenze.ts: 13500 sono 135 euro, e nessuno deve
   leggerli come tredicimila. */
/* Una cifra e basta: `euro()` ci attacca «da pagare all'autista», che vale
   per il transfer e non per una camera. */
function cifra(v: unknown): string {
  if (v === null || v === undefined || v === "") return "";
  const n = Number(v);
  if (!Number.isFinite(n) || n === 0) return "";
  return `${(n / 100).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

function euro(v: unknown, t: Record<string, string>): string {
  if (v === null || v === undefined || v === '') return '';
  const n = Number(v);
  if (!Number.isFinite(n)) return '';
  const cifra = (n / 100).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${cifra} € · ${t.allAutista}`;
}

export function dettagli(
  tipo: string,
  d: Record<string, unknown>,
  t: Record<string, string>,
  originali?: Record<string, unknown> | null,
): string {
  return vociDettagli(tipo, t).map((v) => {
    const adesso = v.calcola(d);
    const prima = originali ? v.calcola(originali) : '';
    return riga(v.eti, adesso, prima && prima !== adesso ? prima : null, t);
  }).join('');
}
