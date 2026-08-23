/* ============================================================
   email-richiesta.ts — l'avviso che arriva all'hotel quando dal sito
   entra una richiesta di preventivo.

   Costruito a tabelle come gli altri: Outlook non regge i layout moderni.
   Il campo reply_to punta all'ospite, non all'hotel: rispondere all'avviso
   deve bastare, senza ricopiare l'indirizzo a mano.
   ============================================================ */

import type { Richiesta } from './valida.ts';
import { casellaInCopia } from './ruoli.ts';
/* LE CAMERE IN PIU' del carrello. In back office sono pratiche distinte,
   legate dal campo `insieme`; qui vanno tutte insieme, perche' questa
   email e' quello che la reception legge davvero. Le etichette sono in
   italiano come tutto il resto di questo avviso: lo legge la casa, non
   l'ospite. */
import { cifra, ETICHETTE, interesse } from './dettagli-richiesta.ts';
import { righeAltreCamere, rigaTotale } from './altre-camere.ts';

/* I tipi diversi dal soggiorno portano campi propri, che arrivano qui
   insieme ai contatti: il tipo resta aperto invece di elencarli tutti. */
export type ConNumero =
  & Partial<Richiesta>
  & { numero: string; nome: string; email: string }
  & Record<string, unknown>;

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

const LINGUE: Record<string, string> = {
  it: 'Italiano', de: 'Tedesco', en: 'Inglese', fr: 'Francese',
};

/* l'ospite scrive 2026-09-10, chi legge in reception pensa in 10/09/2026 */
function data(iso: string): string {
  const [a, m, g] = String(iso || '').split('-');
  return g ? `${g}/${m}/${a}` : '';
}

/* ATTENZIONE ALL'UNITA': prezzo_cent e caparra_cent sono in CENTESIMI.
   31000 sono 310,00 euro. Nessun essere umano deve leggere "31000" in una
   email: e' la stessa trappola che ha gia' prodotto un difetto altrove. */
function euro(cent: unknown): string {
  const n = Number(cent);
  if (!Number.isFinite(n)) return '';
  return (n / 100).toLocaleString('it-IT', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }) + ' €';
}

/* "2 adulti · 2 bambini": la colonna `ospiti` dice solo "4", e la caparra si
   calcola sugli adulti. Senza questa riga la reception non ha modo di
   ricostruire i due numeri. */
function composizione(r: Record<string, unknown>): string {
  const a = Number(r.adulti);
  if (!Number.isInteger(a)) return '';
  const b = Number(r.bambini);
  const voci = [`${a} adult${a === 1 ? 'o' : 'i'}`];
  if (Number.isInteger(b) && b > 0) voci.push(`${b} bambin${b === 1 ? 'o' : 'i'}`);
  return voci.join(' · ');
}

/* una riga solo se ha qualcosa da dire: le righe vuote fanno sembrare
   l'avviso rotto e allungano la lettura per niente */
function riga(etichetta: string, valore: string, forte = false): string {
  if (!valore) return '';
  return `<tr>
    <td style="padding:7px 14px 7px 0;color:#7A8A86;font-size:13px;white-space:nowrap;vertical-align:top;">${esc(etichetta)}</td>
    <td style="padding:7px 0;color:#1B4D4A;font-size:${forte ? '16px;font-weight:bold' : '14px'};">${esc(valore)}</td>
  </tr>`;
}

/* Marchio nero su bianco: il logo.png del buono ha il fondo verde acqua
   incorporato e da solo mostra il rettangolo. PNG e non SVG perche' nelle
   email l'SVG non si vede; bianco e non trasparente perche' un nero su
   trasparente sparisce nei programmi che invertono i colori. */
const BASE_IMG = 'https://arrivo-terme-leonardo.vercel.app/buoni/img';

/* Ogni tipo di richiesta ha righe sue: un transfer non ha notti da contare,
   e mostrargli le righe del soggiorno riempirebbe l'avviso di "undefined". */
const ETICHETTA: Record<string, string> = {
  soggiorno: 'RICHIESTA DAL SITO',
  transfer: 'RICHIESTA TRANSFER',
  greenfee: 'RICHIESTA GREEN FEE',
  maestro: 'LEZIONE CON IL MAESTRO',
  trattamenti: 'RICHIESTA TRATTAMENTI',
  dayspa: 'INGRESSO DAY SPA',
  arrivo: 'CHECK-IN ONLINE',
  fattura: 'RICHIESTA FATTURA',
};

function righeTransfer(r: Record<string, unknown>, riga: (e: string, v: string, f?: boolean) => string): string {
  const verso = r.verso === 'partenza' ? 'Partenza per' : 'Arrivo da';
  return [
    riga('Quando', `${data(String(r.quando))} alle ${String(r.ora ?? '')}`, true),
    riga(verso, String(r.luogo ?? '')),
    riga('Passeggeri', `${r.pax}${r.ritorno === true ? ' · con ritorno' : ''}`),
    riga('Volo / treno', String(r.volo ?? '')),
  ].join('');
}

function righeGreenfee(r: Record<string, unknown>, riga: (e: string, v: string, f?: boolean) => string): string {
  const noleggi = [
    r.golfcar === true ? 'golf car' : '',
    r.carrello === true ? 'carrello' : '',
    r.carrello_elettrico === true ? 'carrello elettrico' : '',
    r.sacca === true ? 'sacca' : '',
  ].filter(Boolean).join(' · ');
  return [
    riga('Circolo', String(r.circolo_nome ?? r.circolo ?? ''), true),
    riga('Quando', `${data(String(r.data))} alle ${String(r.ora ?? '')}`),
    riga('Giocatori', String(r.giocatori ?? '')),
    riga('Percorso', String(r.percorso ?? '')),
    riga('Noleggi', noleggi),
    riga('Tessera', String(r.tessera ?? '')),
    /* il taxi e' parte della stessa richiesta: la reception deve vederlo
       qui, non scoprirlo dopo aver prenotato solo il campo */
    r.taxi === true
      ? riga('Taxi', `dall’hotel alle ${String(r.taxi_ora ?? '')}${r.taxi_ritorno === true ? ' · con ritorno' : ''} → ${String(r.taxi_luogo ?? '')}`)
      : '',
  ].join('');
}

function righeMaestro(r: Record<string, unknown>, riga: (e: string, v: string, f?: boolean) => string): string {
  return [
    riga('Quando', `${data(String(r.data))} alle ${String(r.ora ?? '')}`, true),
    riga('Persone', String(r.persone ?? '')),
    riga('Livello', String(r.livello ?? '')),
  ].join('');
}

function righeTrattamenti(r: Record<string, unknown>, riga: (e: string, v: string, f?: boolean) => string): string {
  const voci = Array.isArray(r.voci) ? (r.voci as string[]) : [];
  return [
    riga('Giorno', `${data(String(r.giorno))} · ${String(r.ora || r.fascia || '')}`, true),
    riga('Trattamenti', voci.join(' · ')),
  ].join('');
}

/* Un ingresso Day Spa non ha un'ora — si entra dalle 9:00 — quindi le righe
   sono due sole: quale giorno e in quanti. Sono anche le uniche due cose che
   la reception deve sapere per confermarlo, e questa email e' il modo in cui
   SCOPRE che e' arrivata una richiesta: la riga di back office e' giusta, ma
   nessuno la guarda se l'avviso non dice niente.
   Le persone si scrivono come le scriverebbe una persona ("1 persona", "2
   persone"), come gia' fa riepilogo.ts. */
function righeDayspa(r: Record<string, unknown>, riga: (e: string, v: string, f?: boolean) => string): string {
  const p = Number(r.persone);
  return [
    riga('Giorno', data(String(r.giorno ?? '')), true),
    riga('Persone', Number.isInteger(p) ? `${p} person${p === 1 ? 'a' : 'e'}` : ''),
  ].join('');
}

/* Il check-in online (Task 5, arrivo-invio.ts): niente notti ne' ospiti da
   contare, e' la scheda che l'ospite compila prima di arrivare. La nota
   libera (r.note) la stampa gia' il blocco generico piu' sotto in
   richiestaHTML, come per gli altri tipi: non si ripete qui. */
function righeArrivo(r: Record<string, unknown>, riga: (e: string, v: string, f?: boolean) => string): string {
  const attenzioni = Array.isArray(r.attenzioni) ? (r.attenzioni as unknown[]).map(String) : [];
  const persone = Array.isArray(r.persone_extra) ? (r.persone_extra as Record<string, unknown>[]) : [];
  const elencoPersone = persone
    .map((p) => {
      const nome = String(p?.nome ?? '');
      const eta = String(p?.eta ?? '');
      return nome ? `${nome}${eta ? ` (${eta})` : ''}` : '';
    })
    .filter(Boolean)
    .join(' · ');
  return [
    riga('Arrivo previsto', String(r.ora_arrivo ?? ''), true),
    riga('Mezzo', String(r.mezzo ?? '')),
    riga('Attenzioni', attenzioni.join(' · ')),
    riga('Desiderio fanghi', String(r.fanghi_desiderio ?? '')),
    riga('Altre persone', elencoPersone),
  ].join('');
}

/* La fattura (Task 5, arrivo-invio.ts): arriva in copia all'amministrazione
   (casellaInCopia in ruoli.ts), che e' chi deve emetterla — la reception
   deve comunque vedere che l'ospite l'ha chiesta. */
function righeFattura(r: Record<string, unknown>, riga: (e: string, v: string, f?: boolean) => string): string {
  return [
    riga('Ragione sociale', String(r.ragione ?? ''), true),
    riga('Indirizzo', String(r.indirizzo ?? '')),
    riga('Partita IVA', String(r.piva ?? '')),
    riga('Codice fiscale', String(r.cf ?? '')),
    riga('Codice SDI', String(r.sdi ?? '')),
    riga('PEC', String(r.pec ?? '')),
  ].join('');
}

export function richiestaHTML(r: ConNumero): string {
  /* i campi del soggiorno sono facoltativi da quando l'avviso serve anche
     agli altri tipi: si leggono sempre passando da qui, cosi' un campo
     assente diventa una riga vuota che non si stampa, mai "undefined" */
  const s = (v: unknown) => String(v ?? '');
  const tipo = s(r.tipo) || 'soggiorno';
  const periodo = `${data(s(r.check_in))} → ${data(s(r.check_out))}`;
  const comp = composizione(r as unknown as Record<string, unknown>);
  const soggiorno = `${r.notti} notti · ${r.ospiti} ospiti${comp ? ` · ${comp}` : ''}`;
  /* La camera scelta si salva in `dati`, che index.ts appiattisce qui sopra:
     finche' nessuna riga la leggeva, l'ospite sceglieva "Doppia — Mezza
     Pensione — 310,00 €" e la reception riceveva "Camera: Doppia". Due
     proposte della stessa camera differiscono SOLO per trattamento e
     prezzo. */
  const prezzo = euro(r.prezzo_cent);
  const caparra = euro(r.caparra_cent);
  return `<table cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px;max-width:100%;
  border-collapse:collapse;font-family:Arial,Helvetica,sans-serif;background:#FFFFFF;">
<tr><td style="padding:26px 28px;">
  <img src="${BASE_IMG}/logo-nero.png" width="220" alt="Hotel Terme Leonardo"
    style="display:block;width:220px;height:auto;border:0;padding-bottom:18px;
    border-bottom:1px solid #E6E2D8;" />
  <div style="font-size:10px;letter-spacing:2px;color:#C9A961;padding-top:18px;">${
    esc(ETICHETTA[tipo] || ETICHETTA.soggiorno)}</div>
  <div style="font-size:22px;color:#1B4D4A;margin-top:6px;font-family:Georgia,serif;">${esc(r.nome)}</div>
  <div style="font-size:12px;color:#9AA9A6;margin-top:3px;">${esc(r.numero)}</div>

  <!-- POCO PREAVVISO: da guardare per prima. Senza questo riquadro una
       richiesta per domani arriva identica a una per il mese prossimo, e
       finisce in fondo alla casella come le altre.

       NON È UN RIFIUTO: la decisione se accontentare l'ospite resta della
       reception. Il modulo non blocca niente — bloccare vorrebbe dire
       rifiutare al posto vostro una richiesta che accettereste, e perdere
       insieme la vendita e l'informazione. -->
  ${r.poco_preavviso === true ? `<div style="margin-top:14px;background:#FDF0EE;
    border-left:4px solid #C0392B;padding:11px 14px;border-radius:6px;
    font-size:14px;line-height:1.55;color:#7A2E24;">
    <strong>Poco preavviso — da guardare per prima.</strong><br />
    Chiede meno di 48 ore. All'ospite abbiamo scritto che faremo il possibile e
    che le risponderemo al più presto: nient'altro, nessuna promessa.
  </div>` : ''}

  <table cellpadding="0" cellspacing="0" border="0" width="100%"
    style="margin-top:20px;border-collapse:collapse;border-top:1px solid #E6E2D8;">
    ${(() => {
      const d = r as unknown as Record<string, unknown>;
      if (tipo === 'transfer') return righeTransfer(d, riga);
      if (tipo === 'greenfee') return righeGreenfee(d, riga);
      if (tipo === 'maestro') return righeMaestro(d, riga);
      if (tipo === 'trattamenti') return righeTrattamenti(d, riga);
      if (tipo === 'dayspa') return righeDayspa(d, riga);
      if (tipo === 'arrivo') return righeArrivo(d, riga);
      if (tipo === 'fattura') return righeFattura(d, riga);
      return riga('Periodo', periodo, true) + riga('Soggiorno', soggiorno);
    })()}
    ${riga('Email', s(r.email))}
    ${riga('Telefono', s(r.telefono))}
    ${riga('Camera', s(r.tipo_camera) || s(r.nome_camera))}
    ${riga('Pacchetto', s(r.pacchetto))}
    ${tipo === 'soggiorno' ? riga('Trattamento', s(r.trattamento)) : ''}
    ${tipo === 'soggiorno' ? riga('Prezzo visto dall’ospite', prezzo, true) : ''}
    ${tipo === 'soggiorno' ? riga('Caparra indicata', caparra) : ''}
    <!-- QUELLO CHE L'OSPITE HA CHIESTO OLTRE ALLA CAMERA. Mancava tutto:
         il cane esiste dal 21 agosto e in reception non e' mai arrivato,
         e il buono regalo nemmeno. Le righe di questo avviso si
         costruiscono qui e non in dettagli-richiesta.ts — lo legge la
         casa, e va in italiano — ed e' per questo che erano rimaste
         indietro. Adesso una prova pretende che OGNI campo mandabile
         dall'ospite si legga qui dentro. -->
      ${tipo === 'soggiorno' ? riga('Cane al seguito', r.cane === true ? 'Sì' : '') : ''}
      ${tipo === 'soggiorno' ? riga('Culla', r.culla === true ? 'Sì' : '') : ''}
      ${riga('Buono regalo', s(r.buono))}
      ${riga(
        'Da richiamare per',
        (Array.isArray(r.interessi) ? r.interessi : [])
          .map((v) => interesse(String(v ?? ''), ETICHETTE.it)).filter(Boolean).join(' · '),
      )}
      <!-- il filo con le altre richieste dello stesso ospite: chi apre
           questa deve sapere che ce n'e' un'altra a cui si aggiunge -->
      ${riga('Si aggiunge alla richiesta', s(r.collegata_a) || s(r.insieme))}
    <!-- v2.8: i supplementi e il totale vero, gli stessi che l'ospite ha
         visto sulla pagina prima di premere invia -->
    ${riga('Lingua', LINGUE[s(r.lingua)] || LINGUE.it)}
    <!-- LE ALTRE CAMERE. Un avviso con una camera sola, dopo che
         l'ospite ne ha chieste tre, manda la reception a cercare le
         altre due in back office — sempre che sappia che ci sono. -->
    ${righeAltreCamere((r as unknown as Record<string, unknown>).altre_camere, ETICHETTE.it)}
    ${rigaTotale(
      r as unknown as Record<string, unknown>,
      (r as unknown as Record<string, unknown>).altre_camere,
      ETICHETTE.it,
      cifra,
    )}
  </table>

  ${prezzo && tipo === 'soggiorno'
    ? `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:14px;border-collapse:collapse;">
      <tr><td style="border-left:3px solid #8FC4BC;background:#F2F8F6;padding:12px 15px;
        font-size:12.5px;line-height:1.6;color:#3C5346;">
        Prezzo e caparra sono quelli che l’ospite ha visto sulla pagina al momento
        della scelta, per l’intero soggiorno. Vanno confermati dalla reception:
        non sono un preventivo della casa, e la camera non è bloccata.
      </td></tr>
    </table>`
    : ''}

  ${(() => {
    /* il soggiorno chiama questo campo `messaggio`, gli altri tipi `note`:
       guardarne uno solo faceva sparire in silenzio quello che l'ospite ha
       scritto, ed e' spesso la cosa piu' importante della richiesta */
    const libero = String(r.messaggio ?? r.note ?? '').trim();
    return libero
      ? `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:18px;border-collapse:collapse;">
      <tr><td style="border-left:3px solid #C9A961;background:#FBFAF7;padding:14px 16px;
        font-size:14px;line-height:1.6;color:#4A5C59;">${esc(libero)}</td></tr>
    </table>`
      : '';
  })()}

  <div style="margin-top:22px;padding-top:14px;border-top:1px solid #E6E2D8;font-size:12px;color:#8A938F;line-height:1.6;">
    Rispondendo a questa email si scrive direttamente all’ospite.
  </div>
</td></tr>
</table>`;
}

export async function avvisaHotel(r: ConNumero): Promise<boolean> {
  const chiave = Deno.env.get('RESEND_API_KEY');
  if (!chiave) {
    /* la richiesta e' gia' salvata: senza avviso la si ritrova nell'elenco
       del back office. Meglio un avviso mancato che una richiesta persa. */
    console.error('avviso non inviato: RESEND_API_KEY mancante ->', r.numero);
    return false;
  }
  const a = Deno.env.get('EMAIL_HOTEL') || 'info@termeleonardo.com';
  /* LA COPIA. Non un secondo invio: cosi' la reception VEDE che la spa e'
     in copia. Con due email separate nessuno dei due sa che l'altro l'ha
     ricevuta, e ci si telefona per chiedere "l'hai vista?".
     Se la variabile non c'e' la copia non parte: si scrive nel registro,
     perche' un destinatario mancante in silenzio e' come non averlo
     deciso. */
  const chi = casellaInCopia(r.tipo);
  const copia = chi === 'spa'
    ? Deno.env.get('EMAIL_SPA')
    : chi === 'amministrazione'
    ? Deno.env.get('EMAIL_AMMINISTRAZIONE')
    : undefined;
  if (chi && !copia) console.error(`copia non inviata: manca l'indirizzo per ${chi} ->`, r.numero);
  try {
    const risposta = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${chiave}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: Deno.env.get('MITTENTE_EMAIL') || 'Hotel Terme Leonardo <noreply@hoteltermeleonardo.com>',
        to: a,
        ...(copia ? { cc: [copia] } : {}),
        reply_to: r.email,
        subject: `${r.numero} · richiesta dal sito · ${r.nome}`,
        html: richiestaHTML(r),
      }),
    });
    if (!risposta.ok) {
      console.error('Resend ha risposto', risposta.status, await risposta.text());
      return false;
    }
    return true;
  } catch (e) {
    console.error('avviso non inviato:', e instanceof Error ? e.message : String(e));
    return false;
  }
}
