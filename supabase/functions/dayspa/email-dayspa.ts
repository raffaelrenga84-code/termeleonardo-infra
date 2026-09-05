/* L'email di conferma del Day Spa: il QR, il giorno, l'orario della
   fascia, le persone, l'importo, il numero. Quattro lingue, tutte con le
   stesse chiavi (la prova lo controlla). Pura: nessun invio qui dentro,
   `index.ts` la manda con Resend come fa buoni/email-buono.ts. */
import { ORARI, type Fascia } from './listino.ts';

type Testi = {
  oggetto: (numero: string) => string;
  saluto: (nome: string) => string;
  intro: string;
  giorno: string;
  orario: string;
  persone: (n: number) => string;
  importo: string;
  numero: string;
  fascia: Record<Fascia, string>;
  qrTitolo: string;
  qrIstruzioni: string;
  /* con piu' persone: il codice e' uno solo, vale per tutti, e se non
     arrivano insieme si inoltra l'email. Vuoto con una persona sola. */
  qrPerTutti: (n: number) => string;
  codice: string;
  neonati: string;
  nonRimborsabile: string;
  portare: string;
  firma: string;
};

export const TESTI_EMAIL: Record<string, Testi> = {
  it: {
    oggetto: (n) => `Il suo ingresso Day Spa · ${n}`,
    saluto: (nome) => `Gentile ${nome},`,
    intro: 'grazie: il suo ingresso al Day Spa dell\'Hotel Terme Leonardo è confermato. Questo è il suo biglietto.',
    giorno: 'Giorno', orario: 'Orario',
    persone: (n) => n === 1 ? '1 persona' : `${n} persone`,
    importo: 'Importo pagato', numero: 'Numero',
    fascia: { giornaliero: 'Ingresso giornaliero', serale: 'Ingresso serale' },
    qrTitolo: 'Il suo codice d\'ingresso',
    qrIstruzioni: 'All\'arrivo mostri questo codice alla reception, anche dal telefono.',
    qrPerTutti: (n) => n === 1 ? '' : `Il codice è uno solo e vale per tutte e ${n} le persone della prenotazione. Se non arrivate insieme, inoltri questa email a chi la accompagna: alla reception segniamo gli ingressi man mano.`,
    codice: 'Codice',
    neonati: 'I neonati fino a 1 anno entrano gratuitamente e non vanno contati.',
    nonRimborsabile: 'Ingresso non rimborsabile e non modificabile.',
    portare: 'Porti costume, ciabatte e cuffia (obbligatoria in piscina, in vendita alla reception). Accappatoio e telo in dotazione.',
    firma: 'A presto, Hotel Terme Leonardo',
  },
  de: {
    oggetto: (n) => `Ihr Day-Spa-Eintritt · ${n}`,
    saluto: (nome) => `Guten Tag ${nome},`,
    intro: 'vielen Dank: Ihr Eintritt ins Day Spa des Hotel Terme Leonardo ist bestätigt. Dies ist Ihr Ticket.',
    giorno: 'Tag', orario: 'Uhrzeit',
    persone: (n) => n === 1 ? '1 Person' : `${n} Personen`,
    importo: 'Bezahlter Betrag', numero: 'Nummer',
    fascia: { giornaliero: 'Tageseintritt', serale: 'Abendeintritt' },
    qrTitolo: 'Ihr Eintrittscode',
    qrIstruzioni: 'Zeigen Sie diesen Code bei der Ankunft an der Rezeption, gern auch auf dem Handy.',
    qrPerTutti: (n) => n === 1 ? '' : `Der Code ist nur einer und gilt für alle ${n} Personen der Buchung. Wenn Sie nicht zusammen ankommen, leiten Sie diese E-Mail an Ihre Begleitung weiter: an der Rezeption tragen wir die Eintritte nach und nach ein.`,
    codice: 'Code',
    neonati: 'Babys bis 1 Jahr haben freien Eintritt und werden nicht mitgezählt.',
    nonRimborsabile: 'Der Eintritt ist nicht erstattungsfähig und nicht änderbar.',
    portare: 'Bitte Badekleidung, Badeschuhe und Badekappe mitbringen (im Pool Pflicht, an der Rezeption erhältlich). Bademantel und Handtuch werden gestellt.',
    firma: 'Bis bald, Hotel Terme Leonardo',
  },
  en: {
    oggetto: (n) => `Your Day Spa entry · ${n}`,
    saluto: (nome) => `Dear ${nome},`,
    intro: 'thank you: your entry to the Day Spa of Hotel Terme Leonardo is confirmed. This is your ticket.',
    giorno: 'Day', orario: 'Hours',
    persone: (n) => n === 1 ? '1 person' : `${n} people`,
    importo: 'Amount paid', numero: 'Number',
    fascia: { giornaliero: 'Day entry', serale: 'Evening entry' },
    qrTitolo: 'Your entry code',
    qrIstruzioni: 'On arrival, show this code at reception, on your phone is fine.',
    qrPerTutti: (n) => n === 1 ? '' : `There is one code only and it covers all ${n} people in the booking. If you do not arrive together, forward this email to the others: reception marks the entries as each of you arrives.`,
    codice: 'Code',
    neonati: 'Babies up to 1 year enter free and do not count.',
    nonRimborsabile: 'Entry is non-refundable and cannot be changed.',
    portare: 'Bring swimwear, flip-flops and a swim cap (compulsory in the pools, sold at reception). Bathrobe and towel provided.',
    firma: 'See you soon, Hotel Terme Leonardo',
  },
  fr: {
    oggetto: (n) => `Votre entrée Day Spa · ${n}`,
    saluto: (nome) => `Bonjour ${nome},`,
    intro: 'merci : votre entrée au Day Spa de l\'Hôtel Terme Leonardo est confirmée. Voici votre billet.',
    giorno: 'Jour', orario: 'Horaire',
    persone: (n) => n === 1 ? '1 personne' : `${n} personnes`,
    importo: 'Montant payé', numero: 'Numéro',
    fascia: { giornaliero: 'Entrée journée', serale: 'Entrée soirée' },
    qrTitolo: 'Votre code d\'entrée',
    qrIstruzioni: 'À l\'arrivée, présentez ce code à la réception, sur le téléphone aussi.',
    qrPerTutti: (n) => n === 1 ? '' : `Le code est unique et vaut pour les ${n} personnes de la réservation. Si vous n'arrivez pas ensemble, transférez cet e-mail à vos accompagnants : à la réception nous enregistrons les entrées au fur et à mesure.`,
    codice: 'Code',
    neonati: 'Les bébés jusqu\'à 1 an entrent gratuitement et ne sont pas comptés.',
    nonRimborsabile: 'Entrée non remboursable et non modifiable.',
    portare: 'Apportez maillot, tongs et bonnet de bain (obligatoire dans les piscines, en vente à la réception). Peignoir et serviette fournis.',
    firma: 'À bientôt, Hôtel Terme Leonardo',
  },
};

const LOCALE: Record<string, string> = { it: 'it-IT', de: 'de-DE', en: 'en-GB', fr: 'fr-FR' };

/* «sabato 12 settembre 2026»: giorno della settimana, giorno, mese, anno,
   nella lingua dell'ospite, letto a mezzogiorno di Roma per non scivolare
   di un giorno al cambio dell'ora. Senza la virgola dopo il giorno della
   settimana, che Intl mette in alcune lingue e in altre no. */
export function dataEstesa(iso: string, lingua: string): string {
  const f = new Intl.DateTimeFormat(LOCALE[lingua] || LOCALE.it, {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Rome',
  });
  return f.format(new Date(iso + 'T12:00:00Z')).replace(/,/g, '');
}

export function euro(cent: number, lingua: string): string {
  return new Intl.NumberFormat(LOCALE[lingua] || LOCALE.it, { style: 'currency', currency: 'EUR' }).format(cent / 100)
    .replace(/ /g, ' ');
}

const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

type Prenotazione = {
  numero: string; giorno: string; fascia: string; persone: number; importo_cent: number;
  nome: string; lingua: string; codice: string;
};

export function emailConferma(p: Prenotazione, linkQr: string): { oggetto: string; html: string; testo: string } {
  const t = TESTI_EMAIL[p.lingua] || TESTI_EMAIL.it;
  const fascia = p.fascia as Fascia;
  const righe: [string, string][] = [
    [t.giorno, dataEstesa(p.giorno, p.lingua)],
    [t.orario, `${t.fascia[fascia] ?? p.fascia} · ${ORARI[fascia] ?? ''}`],
    ['', t.persone(p.persone)],
    [t.importo, euro(p.importo_cent, p.lingua)],
    [t.numero, p.numero],
  ];
  const tabella = righe.map(([k, v]) =>
    `<tr><td style="padding:6px 12px 6px 0;color:#7B756A;font-size:13px;white-space:nowrap;">${esc(k)}</td><td style="padding:6px 0;color:#1C1C1C;">${esc(v)}</td></tr>`).join('');
  const html = `<div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;color:#1C1C1C;line-height:1.5;">
  <div style="background:#1A3626;color:#F9F6F0;padding:22px 26px;">
    <div style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#E7C98B;">Hotel Terme Leonardo</div>
    <div style="font-size:22px;margin-top:6px;">Day Spa</div>
  </div>
  <div style="padding:22px 26px;background:#FFFFFF;">
    <p>${esc(t.saluto(p.nome))}<br />${esc(t.intro)}</p>
    <table style="border-collapse:collapse;margin:14px 0;">${tabella}</table>
    <div style="border:1px solid #E5E0D8;border-radius:10px;padding:18px;text-align:center;margin:18px 0;">
      <div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#8A6A38;">${esc(t.qrTitolo)}</div>
      <img src="${esc(linkQr)}" width="220" height="220" alt="QR ${esc(p.codice)}" style="display:block;margin:12px auto;" />
      <div style="font-family:ui-monospace,Menlo,monospace;font-size:20px;letter-spacing:3px;">${esc(p.codice)}</div>
      <p style="font-size:13px;color:#5A5A5A;margin:10px 0 0;">${esc(t.qrIstruzioni)}</p>
      ${t.qrPerTutti(p.persone) ? `<p style="font-size:13px;color:#1A3626;margin:10px 0 0;"><strong>${esc(t.qrPerTutti(p.persone))}</strong></p>` : ''}
    </div>
    <p style="font-size:13px;color:#5A5A5A;">${esc(t.portare)}</p>
    <p style="font-size:13px;color:#5A5A5A;">${esc(t.neonati)}</p>
    <p style="font-size:13px;color:#8C2F28;"><strong>${esc(t.nonRimborsabile)}</strong></p>
    <p>${esc(t.firma)}<br /><span style="color:#7B756A;font-size:13px;">+39 049 9939200 &middot; info@termeleonardo.com</span></p>
  </div>
</div>`;
  const testo = [
    t.saluto(p.nome), t.intro, '',
    ...righe.map(([k, v]) => (k ? `${k}: ${v}` : v)),
    '', `${t.qrTitolo}: ${p.codice}`, t.qrIstruzioni, t.qrPerTutti(p.persone), linkQr, '',
    t.portare, t.neonati, t.nonRimborsabile, '', t.firma,
  ].join('\n');
  return { oggetto: t.oggetto(p.numero), html, testo };
}

/** L'avviso alla reception a ogni ingresso pagato, come mandava Fidra
    («Notifica acquisto Day-Spa»): numero, giorno, fascia, persone, importo,
    nome ed email, e il collegamento al back office. In italiano, sempre
    (la proprieta', 5 settembre 2026). */
export function emailAvvisoReception(p: Prenotazione & { email: string; telefono?: string | null }, linkBackOffice: string): { oggetto: string; html: string; testo: string } {
  const t = TESTI_EMAIL.it;
  const fascia = p.fascia as Fascia;
  const righe: [string, string][] = [
    ['Numero', p.numero],
    ['Giorno', dataEstesa(p.giorno, 'it')],
    ['Fascia', `${t.fascia[fascia] ?? p.fascia} · ${ORARI[fascia] ?? ''}`],
    ['Persone', t.persone(p.persone)],
    ['Importo', euro(p.importo_cent, 'it')],
    ['Cliente', `${p.nome} · ${p.email}${p.telefono ? ' · ' + p.telefono : ''}`],
    ['Lingua', p.lingua],
  ];
  const tabella = righe.map(([k, v]) =>
    `<tr><td style="padding:6px 12px 6px 0;color:#7B756A;font-size:13px;white-space:nowrap;">${esc(k)}</td><td style="padding:6px 0;color:#1C1C1C;">${esc(v)}</td></tr>`).join('');
  const oggetto = `Day Spa venduto: ${p.numero} · ${t.persone(p.persone)} · ${dataEstesa(p.giorno, 'it')}`;
  const html = `<div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;color:#1C1C1C;line-height:1.5;">
  <div style="background:#1A3626;color:#F9F6F0;padding:22px 26px;">
    <div style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#E7C98B;">Hotel Terme Leonardo</div>
    <div style="font-size:22px;margin-top:6px;">Ingresso Day Spa venduto sul sito</div>
  </div>
  <div style="padding:22px 26px;background:#FFFFFF;">
    <table style="border-collapse:collapse;margin:0 0 14px;">${tabella}</table>
    <p><a href="${esc(linkBackOffice)}" style="display:inline-block;background:#B08D57;color:#FFFFFF;text-decoration:none;padding:10px 18px;border-radius:6px;">Apri nel back office</a></p>
    <p style="font-size:13px;color:#5A5A5A;">L'ospite ha ricevuto l'email col QR. Il documento commerciale va battuto dalla cassa.</p>
  </div>
</div>`;
  const testo = [oggetto, '', ...righe.map(([k, v]) => `${k}: ${v}`), '', `Back office: ${linkBackOffice}`].join('\n');
  return { oggetto, html, testo };
}
