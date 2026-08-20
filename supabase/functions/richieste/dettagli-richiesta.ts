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
    prezzo: 'Prezzo', allAutista: 'da pagare direttamente all’autista', oraVolo: 'volo',
    modifiche: 'Cosa è cambiato rispetto alla richiesta',
    chiesto: 'Aveva chiesto', confermato: 'Confermiamo',
  },
  de: {
    periodo: 'Zeitraum', camera: 'Zimmer', pacchetto: 'Paket', trattamento: 'Verpflegung', caparra: 'Angegebene Anzahlung',
    quando: 'Wann', dove: 'Wo', persone: 'Personen', volo: 'Flug / Zug',
    ritorno: 'Rückfahrt inbegriffen', rif: 'Referenz',
    noleggi: 'Verleih', taxi: 'Taxi ab Hotel', trattamenti: 'Anwendungen',
    servizio: 'Service', navetta: 'Sammeltransfer', privata: 'Privatwagen',
    prezzo: 'Preis', allAutista: 'direkt an den Fahrer zu zahlen', oraVolo: 'Flug',
    modifiche: 'Was sich gegenüber Ihrer Anfrage geändert hat',
    chiesto: 'Angefragt', confermato: 'Bestätigt',
  },
  en: {
    periodo: 'Dates', camera: 'Room', pacchetto: 'Package', trattamento: 'Board', caparra: 'Deposit indicated',
    quando: 'When', dove: 'Where', persone: 'People', volo: 'Flight / train',
    ritorno: 'Return trip included', rif: 'Reference',
    noleggi: 'Rentals', taxi: 'Taxi from the hotel', trattamenti: 'Treatments',
    servizio: 'Service', navetta: 'Shared shuttle', privata: 'Private car',
    prezzo: 'Price', allAutista: 'to be paid directly to the driver', oraVolo: 'flight',
    modifiche: 'What has changed from your request',
    chiesto: 'Originally requested', confermato: 'Now confirmed',
  },
  fr: {
    periodo: 'Dates', camera: 'Chambre', pacchetto: 'Forfait', trattamento: 'Pension', caparra: 'Acompte indiqué',
    quando: 'Quand', dove: 'Où', persone: 'Personnes', volo: 'Vol / train',
    ritorno: 'Retour inclus', rif: 'Référence',
    noleggi: 'Locations', taxi: 'Taxi depuis l’hôtel', trattamenti: 'Soins',
    servizio: 'Service', navetta: 'Navette partagée', privata: 'Voiture privée',
    prezzo: 'Prix', allAutista: 'à régler directement au chauffeur', oraVolo: 'vol',
    modifiche: 'Ce qui a changé par rapport à votre demande',
    chiesto: 'Demandé initialement', confermato: 'Confirmé',
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
};

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
