/* ============================================================
   acquista.ts — validazione dell'acquisto pubblico (?a=acquista).
   Il listino qui sotto è la sola fonte dei prezzi: il valore che
   arriva dal browser conta solo per i buoni a importo libero,
   e anche lì entro i limiti del regolamento.
   ============================================================ */

export const LISTINO: Record<string, [string, number]> = {
  progCoccola: ['Programma Coccola — pulizia viso completa + manicure', 90],
  progViso: ['Programma Viso Antirughe — pulizia completa + collagene', 90],
  progTermale: ['Programma Viso Termale — pulizia + trattamento termale', 95],
  progAntistress: ['Programma Antistress — scrub Mar Morto + massaggio + viso al fango', 130],
  progOriente: ['Programma Oriente — Ayurveda + viso alla vitamina C', 130],
  relax25: ['Massaggio relax con olio di cacao (25 min)', 40],
  plantare25: ['Riflessologia plantare (25 min)', 40],
  candle25: ['Massaggio Body Candle (25 min)', 48],
  antistress45: ['Massaggio antistress (45 min)', 55],
  californiano50: ['Massaggio californiano (50 min)', 60],
  ayurveda55: ['Massaggio Ayurveda (55 min)', 65],
  hotstone55: ['Massaggio Hot Stone (55 min)', 65],
  pindasweda55: ['Massaggio Pindasweda (55 min)', 65],
  linfo60: ['Linfodrenaggio completo (60 min)', 65],
  shiatzu50: ['Massaggio Shiatzu (50 min)', 70],
  visofango25: ['Trattamento viso al fango termale con massaggio (25 min)', 44],
  pulizia55: ['Pulizia viso completa con peeling e maschera (55 min)', 60],
  ialuronico55: ['Trattamento anti-age all’acido ialuronico (55 min)', 80],
  collagene55: ['Trattamento anti-age collagene naturale (55 min)', 80],
  scrubmar40: ['Scrub corpo ai sali del Mar Morto (40 min)', 55],
  riducente55: ['Trattamento riducente-anticellulite al fango (55 min)', 70],
  /* gli orari fanno parte della descrizione: il serale vale solo venerdì e
     sabato, e chi riceve il buono deve poterlo leggere sul buono stesso.
     Il "Day Spa pomeridiano" non esiste: il pomeriggio è già compreso nel
     giornaliero, e i 29 € sono l'ingresso serale. */
  dayspa_fer: ['Day Spa infrasettimanale — piscine e grotte, dal lunedì al venerdì, 9.00–18.30', 35],
  dayspa_wknd: ['Day Spa festivo — piscine e grotte, sabato, domenica e festivi, 9.00–18.30', 45],
  dayspa_sera: ['Day Spa serale — piscine e grotte, venerdì e sabato, 18.00–22.30', 29],
  /* il vecchio identificativo resta accettato finché tutte le pagine in
     cache non sono state sostituite; punta al prodotto vero, non a quello
     inesistente. Si può togliere fra qualche giorno. */
  dayspa_pom: ['Day Spa serale — piscine e grotte, venerdì e sabato, 18.00–22.30', 29]
};

const TESTO_VALORE: Record<string, (v: string) => string> = {
  it: (v) => `Buono valore di ${v} €, spendibile in hotel`,
  de: (v) => `Wertgutschein über ${v} €, im Hotel einlösbar`,
  en: (v) => `Gift voucher worth ${v} €, redeemable at the hotel`,
  fr: (v) => `Bon d’une valeur de ${v} €, utilisable à l’hôtel`
};
const eurS = (n: number) => n.toLocaleString('it-IT', { minimumFractionDigits: 2 });

export interface DatiAcquisto {
  tipo: 'servizio' | 'valore';
  voce_id: string | null;
  descrizione: string;
  valore: number;
  lingua: string;
  acquirente: string;
  acquirente_email: string;
  destinatario: string;
  destinatario_email: string;
  ricevuta_email: string;
  dedica: string;
  scade_il: string;
}

export function validaAcquisto(b: Record<string, unknown>):
  { errore?: string; dati?: DatiAcquisto } {
  const lingua = ['it', 'de', 'en', 'fr'].includes(String(b.lingua)) ? String(b.lingua) : 'it';
  const email = String(b.acquirente_email || '').trim();
  if (!/.+@.+\..+/.test(email)) return { errore: 'email non valida' };

  /* prezzo e descrizione: SOLO dal listino server o dal valore validato */
  const tipo = b.tipo === 'valore' ? 'valore' : 'servizio';
  let voce_id: string | null = null, descrizione = '', valore = 0;
  if (tipo === 'servizio') {
    const voce = LISTINO[String(b.voce_id || '')];
    if (!voce) return { errore: 'voce di listino sconosciuta' };
    voce_id = String(b.voce_id); descrizione = voce[0]; valore = voce[1];
  } else {
    valore = Math.round(Number(b.valore) || 0);
    if (!(valore >= 25 && valore <= 1000))
      return { errore: 'importo fuori dai limiti (25–1000 €)' };
    descrizione = (TESTO_VALORE[lingua] || TESTO_VALORE.it)(eurS(valore));
  }

  /* chiusura stagionale, niente rimborso, 12 mesi: chi compra deve averle
     accettate prima di pagare. Il controllo sta anche qui e non solo nella
     pagina, altrimenti basterebbe una chiamata diretta per saltarlo. */
  if (b.condizioni_accettate !== true) return { errore: 'condizioni non accettate' };

  /* scadenza: 12 mesi da oggi, come da regolamento */
  const scade = new Date(); scade.setFullYear(scade.getFullYear() + 1);

  return { dati: {
    tipo, voce_id, descrizione, valore, lingua,
    acquirente: String(b.acquirente || '').trim().slice(0, 120),
    acquirente_email: email.slice(0, 160),
    destinatario: String(b.destinatario || '').trim().slice(0, 120),
    destinatario_email: String(b.destinatario_email || '').trim().slice(0, 160),
    /* riepilogo d'acquisto a un altro indirizzo, per chi compra
       per l'azienda: si accetta solo se e' un indirizzo plausibile */
    ricevuta_email: /.+@.+\..+/.test(String(b.ricevuta_email || '').trim())
      ? String(b.ricevuta_email).trim().slice(0, 160) : '',
    dedica: String(b.dedica || '').trim().slice(0, 400),
    scade_il: scade.toISOString().slice(0, 10)
  } };
}
