/* ============================================================
   email-promemoria.ts — il promemoria dei trenta giorni prima
   della scadenza.

   Stessa casa di email-buono.ts: stessi colori (verde acqua #1B4D4A,
   oro #C9A961), lo stesso mittente, la stessa tecnica di invio via
   Resend — l'email nuova non deve sembrare di un altro albergo. Ma
   non è il buono: è un avviso breve che il buono sta per scadere,
   non una lettera. Un paio di frasi: ancora valido, cosa contiene,
   entro quando, come si prenota.

   Duplica qui (invece di importare) la formattazione della data e
   l'invio via Resend che email-buono.ts già ha: quel file non è fra
   quelli da toccare in questo lavoro — è collaudato e non si tocca
   per aggiungere un export che serve a un file diverso.

   Se il buono era stato prorogato la proroga non si rispiega qui:
   b.scade_il è già la data giusta (la proroga si decide una volta
   sola, all'emissione — vedi scadenza.ts), il cliente l'ha già letta
   sul buono.

   LA LINGUA ARRIVA DAL DATABASE (b.lingua, o il parametro `lingua`
   qui sotto): resta un valore ESTERNO, esattamente come in ETI di
   email-buono.ts. Mai indicizzare un oggetto di testi con quel
   valore direttamente (TESTI[lingua]) — un elenco chiuso con
   .includes() decide se fidarsene, altrimenti si scrive in italiano.
   Il progetto ha già pagato cinque volte il difetto opposto: 'toString'
   o un'altra proprietà ereditata da Object risulterebbe "trovata" e
   romperebbe la funzione o, peggio, mandarebbe un testo sbagliato.
   ============================================================ */

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g,
  (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

const MESI: Record<string, string[]> = {
  it: ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'],
  de: ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  fr: ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
};

function dataLingua(iso: string | null | undefined, l: string): string {
  if (!iso) return '';
  const d = new Date(String(iso).slice(0, 10) + 'T12:00:00Z');
  const m = (MESI[l] || MESI.it)[d.getUTCMonth()];
  return l === 'de' ? `${d.getUTCDate()}. ${m} ${d.getUTCFullYear()}`
    : `${d.getUTCDate()} ${m} ${d.getUTCFullYear()}`;
}

/* l'elenco chiuso: l'unico modo ammesso di decidere se una lingua che
   arriva da fuori è una delle quattro note. */
const LINGUE = ['it', 'de', 'en', 'fr'];

const TESTI: Record<string, {
  oggetto: string;
  caro: (nome: string) => string;
  corpo: (descrizione: string, scadenza: string) => string;
  codiceEtichetta: string;
  valido: (d: string) => string;
  saluto: string;
}> = {
  it: {
    oggetto: 'Il suo buono sta per scadere — Hotel Terme Leonardo',
    caro: (n) => `Gentile ${n || 'Cliente'},`,
    corpo: (d, s) => `le ricordiamo che il suo buono regalo <strong>${d}</strong> è ancora valido, utilizzabile fino al <strong>${s}</strong>. Per prenotare ci chiami o ci scriva, indicando il codice qui sotto.`,
    codiceEtichetta: 'CODICE BUONO',
    valido: (d) => `Valido fino al ${d}`,
    saluto: 'Un cordiale saluto,<br />Hotel Terme Leonardo',
  },
  de: {
    oggetto: 'Ihr Gutschein läuft bald ab — Hotel Terme Leonardo',
    caro: (n) => `Sehr geehrte(r) ${n || 'Kundin/Kunde'},`,
    corpo: (d, s) => `wir erinnern Sie daran, dass Ihr Geschenkgutschein <strong>${d}</strong> noch gültig ist, einlösbar bis zum <strong>${s}</strong>. Für eine Reservierung rufen Sie uns bitte an oder schreiben Sie uns, mit Angabe des unten stehenden Codes.`,
    codiceEtichetta: 'GUTSCHEINCODE',
    valido: (d) => `Gültig bis ${d}`,
    saluto: 'Mit freundlichen Grüßen,<br />Hotel Terme Leonardo',
  },
  en: {
    oggetto: 'Your voucher is about to expire — Hotel Terme Leonardo',
    caro: (n) => `Dear ${n || 'Guest'},`,
    corpo: (d, s) => `just a reminder that your gift voucher <strong>${d}</strong> is still valid, usable until <strong>${s}</strong>. To book, please call or write to us, quoting the code below.`,
    codiceEtichetta: 'VOUCHER CODE',
    valido: (d) => `Valid until ${d}`,
    saluto: 'Kind regards,<br />Hotel Terme Leonardo',
  },
  fr: {
    oggetto: 'Votre bon arrive à expiration — Hôtel Terme Leonardo',
    caro: (n) => `Cher/Chère ${n || 'Client(e)'},`,
    corpo: (d, s) => `nous vous rappelons que votre bon cadeau <strong>${d}</strong> est encore valable, utilisable jusqu’au <strong>${s}</strong>. Pour réserver, appelez-nous ou écrivez-nous, en indiquant le code ci-dessous.`,
    codiceEtichetta: 'CODE DU BON',
    valido: (d) => `Valable jusqu'au ${d}`,
    saluto: 'Cordialement,<br />Hôtel Terme Leonardo',
  },
};

/** L'oggetto dell'email, nella lingua del buono — o in italiano se la
 * lingua non è una delle quattro note. `lingua` arriva dal database:
 * vedi il commento in cima al file sul perché non si indicizza mai
 * TESTI[lingua] direttamente. */
export function oggettoPromemoria(lingua: string): string {
  const L = LINGUE.includes(lingua) ? lingua : 'it';
  return TESTI[L].oggetto;
}

/** Il corpo del promemoria: due frasi, non una lettera. Dice che il
 * buono è ancora valido, cosa contiene (b.descrizione), entro quando
 * (b.scade_il — già la data giusta se il buono era stato prorogato,
 * la proroga non si rispiega qui), e come prenotare (telefono ed
 * email in calce, come nel resto della corrispondenza del progetto). */
export function emailPromemoriaHTML(b: any, lingua: string): string {
  const L = LINGUE.includes(lingua) ? lingua : 'it';
  const t = TESTI[L];
  const nome = b.destinatario ? esc(b.destinatario) : '';
  /* un buono a più voci arriva con le righe separate da a capo, come in
     email-buono.ts: si uniscono con ' · ', un ritorno a capo in mezzo a
     una frase sarebbe uno strappo nel testo */
  const descrizione = esc(String(b.descrizione || '').split('\n').join(' · '));
  const scadenza = dataLingua(b.scade_il, L);
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#2A2E2B;max-width:620px;">
    <p>${t.caro(nome)}</p>
    <p>${t.corpo(descrizione, scadenza)}</p>
    <table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:20px 0;">
      <tr><td style="border-left:3px solid #C9A961;background:#FBFAF7;padding:14px 18px;">
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:9px;letter-spacing:2px;color:#9AA9A6;">${t.codiceEtichetta}</div>
        <div style="font-family:'Courier New',monospace;font-size:17px;letter-spacing:2px;color:#1B4D4A;margin-top:6px;">${esc(b.codice)}</div>
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#C9A961;margin-top:6px;">${t.valido(scadenza)}</div>
      </td></tr>
    </table>
    <p>${t.saluto}<br /><span style="color:#7B756A;font-size:13px;">+39 049 9939200 &middot; info@termeleonardo.com</span></p>
  </div>`;
}

/* Manda l'email vera via Resend — stessa infrastruttura di email-buono.ts
   (stesso mittente, stessa chiave d'ambiente), copiata qui apposta invece
   di importata: vedi il commento in cima al file sul perché. */
async function invia(a: string, oggetto: string, html: string): Promise<boolean> {
  const chiave = Deno.env.get('RESEND_API_KEY');
  if (!chiave) { console.error('promemoria non inviato: RESEND_API_KEY mancante ->', a, oggetto); return false; }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${chiave}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: Deno.env.get('MITTENTE_EMAIL') || 'Hotel Terme Leonardo <noreply@hoteltermeleonardo.com>',
      to: [a], subject: oggetto, html
    })
  });
  if (!r.ok) console.error('Resend (promemoria)', r.status, await r.text());
  return r.ok;
}

/** Manda il promemoria per un buono a un indirizzo già deciso da
 * daAvvisare (promemoria.ts) — quella funzione sceglie il destinatario,
 * questa manda soltanto. Usata dal lavoro giornaliero in index.ts
 * (?a=promemoria): non va chiamata altrove, e mai durante lo sviluppo —
 * manderebbe un'email vera a un cliente vero. I test di questo file non
 * la toccano per lo stesso motivo: provano solo la composizione
 * dell'HTML e la scelta della lingua, mai Resend.
 *
 * Chi APRE questa email non è sempre il destinatario del buono: se il
 * suo indirizzo manca, daAvvisare fa arrivare `email` uguale a
 * b.acquirente_email — si scrive a chi ha comprato, non a chi l'ha
 * ricevuto (vedi il commento in promemoria.ts). In quel caso il saluto
 * deve usare il nome DI CHI STA LEGGENDO, o "Gentile Silvia" arriverebbe
 * nella casella di Marco: si confronta l'indirizzo di arrivo con le due
 * colonne per scegliere il nome giusto prima di comporre l'HTML. */
export async function inviaEmailPromemoria(b: any, email: string): Promise<boolean> {
  const L = LINGUE.includes(b.lingua) ? b.lingua : 'it';
  const nome = email === b.destinatario_email ? b.destinatario : b.acquirente;
  return await invia(email, oggettoPromemoria(L), emailPromemoriaHTML({ ...b, destinatario: nome }, L));
}
