/* ============================================================
   consenso.ts — il consenso privacy: i testi nelle quattro lingue con la
   loro versione, la lettura dei corpi (attesa, firma), le email. Modulo
   puro: lo prova consenso.test.ts. Rete e database stanno in index.ts.

   Le frasi hanno una VERSIONE: si salva con ogni consenso, cosi' si sa
   sempre cosa ha letto e firmato l'ospite anche quando il testo cambia.
   Nessuna scelta e' preimpostata: un consenso pre-spuntato non vale
   (Corte di giustizia UE, Planet49, 2019).
   ============================================================ */
export type Lingua = 'it' | 'en' | 'de' | 'fr';
export type Scelta = 'conservazione' | 'messaggi' | 'marketing';
export const SCELTE: readonly Scelta[] = ['conservazione', 'messaggi', 'marketing'];
export const VERSIONE_TESTI = '2026-09-04';
const LINGUE: readonly Lingua[] = ['it', 'en', 'de', 'fr'];
const FIRMA_MAX = 200 * 1024;

const TITOLARE = 'Stabilimento Termale Hotel Terme Leonardo Tria srl, via Monteortone 46, 35037 Teolo (PD), tel. 049 9939200, info@termeleonardo.com';

export type Testi = {
  titolo: string; saluto: string; autorizzo: string; nonAutorizzo: string;
  scelte: Record<Scelta, string>; informativa: string; sintesi: string; leggi: string; revoca: string;
  firmaQui: string; cancella: string; conferma: string; grazie: string; grazieTesto: string;
  chiediNome: string; cognome: string; nome: string; avanti: string; passiTessera: string; tesseraIgnota: string;
  mancaFirma: string; mancaScelte: string; errore: string; emailOggetto: string; emailIntro: string;
};

export const TESTI_CONSENSO: Record<Lingua, Testi> = {
  it: {
    titolo: 'Consenso al trattamento dei dati personali',
    saluto: 'Buongiorno',
    autorizzo: 'Autorizzo', nonAutorizzo: 'Non autorizzo',
    scelte: {
      conservazione: 'Autorizzo l’hotel a conservare i miei dati per rendere più veloci le registrazioni dei miei prossimi soggiorni.',
      messaggi: 'Autorizzo l’hotel a confermare a chi telefona o chiede di me che sono ospite, e a passarmi messaggi e chiamate.',
      marketing: 'Desidero ricevere per email offerte e novità dell’hotel.',
    },
    informativa: `L’informativa completa (Regolamento UE 2016/679) è su termeleonardo.com/it/privacy e alla reception. Titolare del trattamento: ${TITOLARE}.`,
    sintesi: 'I dati della registrazione servono per il contratto di soggiorno e per gli obblighi di legge (pubblica sicurezza, fisco) e si conservano per il tempo previsto dalla legge. Le scelte qui sopra sono facoltative e non cambiano il soggiorno. Può chiedere in ogni momento di vedere, correggere o cancellare i suoi dati scrivendo a info@termeleonardo.com, e rivolgersi al Garante per la protezione dei dati personali.',
    leggi: 'Leggi l’informativa',
    revoca: 'Può revocare questi consensi in ogni momento, senza dare una motivazione, scrivendo a info@termeleonardo.com.',
    firmaQui: 'Firmi qui con il dito', cancella: 'Cancella', conferma: 'Conferma',
    grazie: 'Grazie', grazieTesto: 'Il consenso è registrato. Buon soggiorno.',
    chiediNome: 'Come si chiama?', cognome: 'Cognome', nome: 'Nome', avanti: 'Avanti',
    passiTessera: 'Passi la tessera della camera al lettore', tesseraIgnota: 'Non riconosco questa tessera: scriva il suo nome.',
    mancaFirma: 'Manca la firma', mancaScelte: 'Risponda a tutte le domande',
    errore: 'Non sono riuscito a salvare il consenso: si rivolga alla reception, qui accanto.',
    emailOggetto: 'Le sue scelte sulla privacy · Hotel Terme Leonardo',
    emailIntro: 'Gentile ospite, questo è il riepilogo delle scelte che ha firmato al momento dell’arrivo.',
  },
  en: {
    titolo: 'Consent to the processing of personal data',
    saluto: 'Welcome',
    autorizzo: 'I agree', nonAutorizzo: 'I do not agree',
    scelte: {
      conservazione: 'I allow the hotel to keep my details to make check-in faster on my next stays.',
      messaggi: 'I allow the hotel to confirm to anyone calling or asking for me that I am a guest, and to pass on messages and calls.',
      marketing: 'I would like to receive the hotel’s offers and news by email.',
    },
    informativa: `The full privacy notice (EU Regulation 2016/679) is at termeleonardo.com/it/privacy and at the reception desk. Data controller: ${TITOLARE}.`,
    sintesi: 'Registration data are needed for the stay contract and for legal duties (public security, tax) and are kept for the time the law requires. The choices above are optional and do not affect your stay. You can ask at any time to see, correct or delete your data by writing to info@termeleonardo.com, and you may contact the Italian Data Protection Authority.',
    leggi: 'Read the notice',
    revoca: 'You can withdraw these consents at any time, without giving a reason, by writing to info@termeleonardo.com.',
    firmaQui: 'Sign here with your finger', cancella: 'Clear', conferma: 'Confirm',
    grazie: 'Thank you', grazieTesto: 'Your consent is recorded. Enjoy your stay.',
    chiediNome: 'What is your name?', cognome: 'Surname', nome: 'First name', avanti: 'Next',
    passiTessera: 'Hold your room key card up to the reader', tesseraIgnota: 'I do not recognise this card: please type your name.',
    mancaFirma: 'The signature is missing', mancaScelte: 'Please answer all the questions',
    errore: 'We could not save your consent: please ask at the reception desk, right here.',
    emailOggetto: 'Your privacy choices · Hotel Terme Leonardo',
    emailIntro: 'Dear guest, this is a summary of the choices you signed on arrival.',
  },
  de: {
    titolo: 'Einwilligung in die Verarbeitung personenbezogener Daten',
    saluto: 'Guten Tag',
    autorizzo: 'Ich stimme zu', nonAutorizzo: 'Ich stimme nicht zu',
    scelte: {
      conservazione: 'Ich erlaube dem Hotel, meine Daten zu speichern, damit der Check-in bei meinen nächsten Aufenthalten schneller geht.',
      messaggi: 'Ich erlaube dem Hotel, Anrufern oder Besuchern zu bestätigen, dass ich Gast bin, und mir Nachrichten und Anrufe weiterzugeben.',
      marketing: 'Ich möchte Angebote und Neuigkeiten des Hotels per E-Mail erhalten.',
    },
    informativa: `Die vollständige Datenschutzerklärung (EU-Verordnung 2016/679) finden Sie unter termeleonardo.com/it/privacy und an der Rezeption. Verantwortlicher: ${TITOLARE}.`,
    sintesi: 'Die Meldedaten sind für den Beherbergungsvertrag und für gesetzliche Pflichten (öffentliche Sicherheit, Steuern) nötig und werden so lange aufbewahrt, wie das Gesetz es verlangt. Die Entscheidungen oben sind freiwillig und ändern nichts an Ihrem Aufenthalt. Sie können jederzeit Auskunft, Berichtigung oder Löschung Ihrer Daten verlangen (info@termeleonardo.com) und sich an die italienische Datenschutzbehörde wenden.',
    leggi: 'Erklärung lesen',
    revoca: 'Sie können diese Einwilligungen jederzeit ohne Angabe von Gründen widerrufen, per E-Mail an info@termeleonardo.com.',
    firmaQui: 'Bitte hier mit dem Finger unterschreiben', cancella: 'Löschen', conferma: 'Bestätigen',
    grazie: 'Danke', grazieTesto: 'Ihre Einwilligung ist gespeichert. Schönen Aufenthalt.',
    chiediNome: 'Wie heißen Sie?', cognome: 'Nachname', nome: 'Vorname', avanti: 'Weiter',
    passiTessera: 'Halten Sie Ihre Zimmerkarte vor den Leser', tesseraIgnota: 'Diese Karte erkenne ich nicht: bitte geben Sie Ihren Namen ein.',
    mancaFirma: 'Die Unterschrift fehlt', mancaScelte: 'Bitte beantworten Sie alle Fragen',
    errore: 'Die Einwilligung konnte nicht gespeichert werden: bitte wenden Sie sich an die Rezeption, gleich nebenan.',
    emailOggetto: 'Ihre Datenschutz-Entscheidungen · Hotel Terme Leonardo',
    emailIntro: 'Sehr geehrter Gast, dies ist die Zusammenfassung der Entscheidungen, die Sie bei der Ankunft unterschrieben haben.',
  },
  fr: {
    titolo: 'Consentement au traitement des données personnelles',
    saluto: 'Bonjour',
    autorizzo: 'J’autorise', nonAutorizzo: 'Je n’autorise pas',
    scelte: {
      conservazione: 'J’autorise l’hôtel à conserver mes données pour accélérer l’enregistrement lors de mes prochains séjours.',
      messaggi: 'J’autorise l’hôtel à confirmer à qui appelle ou demande après moi que je suis client, et à me transmettre messages et appels.',
      marketing: 'Je souhaite recevoir par e-mail les offres et les nouveautés de l’hôtel.',
    },
    informativa: `La notice complète (Règlement UE 2016/679) est sur termeleonardo.com/it/privacy et à la réception. Responsable du traitement : ${TITOLARE}.`,
    sintesi: 'Les données d’enregistrement servent au contrat de séjour et aux obligations légales (sécurité publique, fiscalité) et sont conservées le temps prévu par la loi. Les choix ci-dessus sont facultatifs et ne changent rien à votre séjour. Vous pouvez à tout moment demander à voir, corriger ou effacer vos données en écrivant à info@termeleonardo.com, et saisir l’autorité italienne de protection des données.',
    leggi: 'Lire la notice',
    revoca: 'Vous pouvez retirer ces consentements à tout moment, sans motif, en écrivant à info@termeleonardo.com.',
    firmaQui: 'Signez ici avec le doigt', cancella: 'Effacer', conferma: 'Confirmer',
    grazie: 'Merci', grazieTesto: 'Votre consentement est enregistré. Bon séjour.',
    chiediNome: 'Comment vous appelez-vous ?', cognome: 'Nom', nome: 'Prénom', avanti: 'Suivant',
    passiTessera: 'Présentez votre carte de chambre au lecteur', tesseraIgnota: 'Je ne reconnais pas cette carte : écrivez votre nom.',
    mancaFirma: 'La signature manque', mancaScelte: 'Répondez à toutes les questions',
    errore: 'Nous n’avons pas pu enregistrer votre consentement : adressez-vous à la réception, juste à côté.',
    emailOggetto: 'Vos choix de confidentialité (privacy) · Hotel Terme Leonardo',
    emailIntro: 'Cher client, voici le récapitulatif des choix que vous avez signés à l’arrivée.',
  },
};

export const testiConsenso = (lingua: unknown): Testi => TESTI_CONSENSO[lingua as Lingua] || TESTI_CONSENSO.it;

const pulito = (v: unknown, max = 120) => typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : '';
const laLingua = (v: unknown): Lingua => LINGUE.includes(v as Lingua) ? v as Lingua : 'it';
const dataIso = (v: unknown): string | null => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
const email = (v: unknown): string | null => {
  const e = pulito(v, 200).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) ? e : null;
};

export type Attesa = { camera: string; cognome: string; nome: string; email: string | null; lingua: Lingua; fidra_prenotazione: string | null; arrivo: string | null; partenza: string | null };
export type Esito<T> = { ok: true; valore: T } | { ok: false; errore: string };

/** Quello che manda l'estensione al check-in. */
export function leggiAttesa(corpo: unknown): Esito<Attesa> {
  const c = (corpo && typeof corpo === 'object' ? corpo : {}) as Record<string, unknown>;
  const camera = pulito(c.camera, 20), cognome = pulito(c.cognome, 80);
  if (!camera) return { ok: false, errore: 'serve la camera' };
  if (!cognome) return { ok: false, errore: 'serve il cognome' };
  return { ok: true, valore: {
    camera, cognome, nome: pulito(c.nome, 80), email: email(c.email), lingua: laLingua(c.lingua),
    fidra_prenotazione: pulito(c.fidra_prenotazione, 40) || null, arrivo: dataIso(c.arrivo), partenza: dataIso(c.partenza),
  } };
}

export type Firma = { id: string | null; camera: string | null; cognome: string | null; nome: string; lingua: Lingua; scelte: Record<Scelta, boolean>; firma: string; versione: string; fonte: 'totem' | 'ipad' };

/** Quello che manda il totem o l'iPad alla conferma. Le tre risposte devono
    esserci tutte e tre, vere o false: una mancante non e' un «no». */
export function leggiFirma(corpo: unknown): Esito<Firma> {
  const c = (corpo && typeof corpo === 'object' ? corpo : {}) as Record<string, unknown>;
  const s = (c.scelte && typeof c.scelte === 'object' ? c.scelte : {}) as Record<string, unknown>;
  const scelte = {} as Record<Scelta, boolean>;
  for (const k of SCELTE) {
    if (typeof s[k] !== 'boolean') return { ok: false, errore: `manca la risposta: ${k}` };
    scelte[k] = s[k] as boolean;
  }
  const firma = typeof c.firma === 'string' ? c.firma : '';
  if (!firma.startsWith('data:image/png;base64,')) return { ok: false, errore: 'la firma deve essere un PNG' };
  if (firma.length > FIRMA_MAX) return { ok: false, errore: 'firma troppo grande' };
  if (firma.length < 'data:image/png;base64,'.length + 40) return { ok: false, errore: 'manca la firma' };
  const fonte = c.fonte === 'ipad' ? 'ipad' : c.fonte === 'totem' ? 'totem' : null;
  if (!fonte) return { ok: false, errore: 'fonte sconosciuta' };
  const id = pulito(c.id, 60) || null;
  const camera = pulito(c.camera, 20) || null, cognome = pulito(c.cognome, 80) || null;
  if (!id && (!camera || !cognome)) return { ok: false, errore: 'senza consenso in attesa servono camera e cognome' };
  return { ok: true, valore: { id, camera, cognome, nome: pulito(c.nome, 80), lingua: laLingua(c.lingua), scelte, firma, versione: pulito(c.versione, 20) || VERSIONE_TESTI, fonte } };
}

export const firmaBase64 = (dataUrl: string): string => dataUrl.slice(dataUrl.indexOf(',') + 1);

/* ---------- le email ---------- */
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
const oraRoma = (iso: string) => new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso)).replace(',', '');
const ETICHETTE_IT: Record<Scelta, string> = { conservazione: 'Conservazione', messaggi: 'Messaggi', marketing: 'Offerte' };

export type PerEmail = { camera: string; cognome: string; nome: string; email: string | null; lingua: Lingua; scelte: Record<Scelta, boolean>; firmatoIl: string; fonte: string; versione: string };

const cornice = (dentro: string) => `<div style="font:15px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;color:#2A2E2B;max-width:600px;">${dentro}</div>`;

/** Per la reception: tutto, in italiano; la firma va in allegato. */
export function emailConsensoReception(c: PerEmail): { oggetto: string; html: string; testo: string } {
  const chi = `${c.cognome} ${c.nome}`.trim();
  const oggetto = `Privacy firmata: camera ${c.camera} · ${chi}`;
  const righe: [string, string][] = [
    ['Quando', oraRoma(c.firmatoIl)],
    ['Ospite', `${chi} · camera ${c.camera}`],
    ['Email', c.email || 'nessuna'],
    ['Lingua', c.lingua],
    ...SCELTE.map((k): [string, string] => [ETICHETTE_IT[k], c.scelte[k] ? 'sì' : 'no']),
    ['Dove', c.fonte],
    ['Testi', `versione ${c.versione}`],
    ['Firma', 'in allegato (firma.png)'],
  ];
  const testo = `${oggetto}\n\n` + righe.map(([k, v]) => `${k}: ${v}`).join('\n') + '\n';
  const html = cornice(`<p style="font-size:18px;margin:0 0 12px;">${esc(oggetto)}</p><table style="border-collapse:collapse;">${righe.map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#7B756A;">${esc(k)}</td><td style="padding:4px 0;">${esc(v)}</td></tr>`).join('')}</table>`);
  return { oggetto, html, testo };
}

/** Per l'ospite, nella sua lingua: le frasi che ha firmato e come revocarle. */
export function emailConsensoOspite(c: PerEmail): { oggetto: string; html: string; testo: string } {
  const t = testiConsenso(c.lingua);
  const righe = SCELTE.map((k) => `${c.scelte[k] ? '✓' : '✗'} ${t.scelte[k]}`);
  const testo = `${t.emailIntro}\n\n${righe.join('\n')}\n\n${t.revoca}\n\n${t.informativa}\n`;
  const html = cornice(`<p>${esc(t.emailIntro)}</p><ul style="padding-left:18px;">${righe.map((r) => `<li style="margin:6px 0;">${esc(r)}</li>`).join('')}</ul><p>${esc(t.revoca)}</p><p style="color:#7B756A;font-size:13px;">${esc(t.informativa)}</p>`);
  return { oggetto: t.emailOggetto, html, testo };
}
