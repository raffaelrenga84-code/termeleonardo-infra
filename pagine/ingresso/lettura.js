/* ============================================================
   lettura.js — cosa ha letto il lettore del totem, e che cos'e'.

   Modulo puro (niente DOM): lo prova lettura.test.ts. La pagina
   dell'ingresso lo usa in modalita' totem per distinguere un biglietto
   del Day Spa da un buono regalo e per comporre la risposta sul buono.

   Formati:
   - Day Spa: 10 caratteri dell'alfabeto ABCDEFGHJKLMNPQRSTUVWXYZ23456789
     (posti.ts, codicePrenotazione): niente 0/O/1/I;
   - buono regalo: LEO-XXXX-XXXX con ACDEFGHJKMNPQRTUVWXY2346789
     (buoni/index.ts, nuovoCodice);
   - tessera della camera: solo cifre, da 4 a 20 (il codice a barre della
     tessera 1796 e' 000000017960), lette dopo le altre due: dieci cifre
     dell'alfabeto Day Spa restano Day Spa.
   I due formati non si confondono: il buono ha i trattini e il prefisso.
   ============================================================ */

const DAYSPA = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{10}$/;
const BUONO = /^LEO-[ACDEFGHJKMNPQRTUVWXY2346789]{4}-[ACDEFGHJKMNPQRTUVWXY2346789]{4}$/;
const TESSERA = /^[0-9]{4,20}$/;

/** Il codice pulito da cio' che il lettore (o una mano) ha scritto:
    maiuscole, spazi ai lati via, spazi interni come trattini; da un
    indirizzo prende il parametro `codice` o l'ultimo pezzo del percorso. */
export function codiceLetto(testo) {
  let s = String(testo ?? '').trim();
  if (/^https?:/i.test(s)) {
    try {
      const u = new URL(s);
      const dalParametro = u.searchParams.get('codice') || u.searchParams.get('c');
      s = dalParametro || u.pathname.split('/').filter(Boolean).pop() || '';
    } catch { /* non era un indirizzo: resta com'e' */ }
  }
  return s.trim().toUpperCase().replace(/ +/g, '-');
}

/** 'dayspa' | 'buono' | 'tessera' | 'ignoto', dal solo formato. */
export function tipoCodice(codice) {
  const c = String(codice ?? '');
  if (DAYSPA.test(c)) return 'dayspa';
  if (BUONO.test(c)) return 'buono';
  if (TESSERA.test(c)) return 'tessera';
  return 'ignoto';
}

/* Le parole del conto camera nella lingua dell'ospite (Fidra la manda con
   il conto): le stesse del totem di hldv, piu' quelle nostre. */
const ETICHETTE_CONTO = {
  it: { camera: 'Camera', descrizione: 'Descrizione', totale: 'Totale', lordo: 'Lordo', acconto: 'Acconto', daPagare: 'Da pagare', appuntamenti: 'Appuntamenti', chiude: 'Si chiude tra', chiudi: 'Chiudi' },
  en: { camera: 'Room', descrizione: 'Description', totale: 'Total', lordo: 'Gross', acconto: 'Deposit', daPagare: 'Balance due', appuntamenti: 'Appointments', chiude: 'Closes in', chiudi: 'Close' },
  de: { camera: 'Zimmer', descrizione: 'Beschreibung', totale: 'Summe', lordo: 'Brutto', acconto: 'Anzahlung', daPagare: 'Offener Betrag', appuntamenti: 'Termine', chiude: 'Schließt in', chiudi: 'Schließen' },
  fr: { camera: 'Chambre', descrizione: 'Description', totale: 'Total', lordo: 'Brut', acconto: 'Acompte', daPagare: 'Reste à payer', appuntamenti: 'Rendez-vous', chiude: 'Se ferme dans', chiudi: 'Fermer' },
};
export function etichetteConto(lingua) {
  return ETICHETTE_CONTO[lingua] || ETICHETTE_CONTO.it;
}

const dataEstesa = (iso) => {
  if (!iso) return '';
  const d = new Date(iso.length === 10 ? iso + 'T12:00:00' : iso);
  return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Rome' });
};
const euro = (n) => Number(n).toFixed(2).replace('.', ',') + ' €';

/** La risposta del totem su un buono, dalla verifica pubblica
    (?a=verifica della funzione buoni): classe 'ok' o 'no', titolo, testo,
    riga «sotto» in italiano e la stessa cosa in breve in inglese e tedesco.
    Il totem non riscuote: chi ha un buono valido lo usa alla reception. */
export function messaggioBuono(v) {
  const valore = euro(v.valore);
  const reception = 'Per usarlo si rivolga alla reception, qui accanto.';
  if (v.valido) {
    return {
      classe: 'ok',
      titolo: 'Questo buono regalo vale',
      testo: `${v.descrizione} · ${valore} · valido fino al ${dataEstesa(v.scade_il)}`,
      sotto: reception,
      tradotto: [
        `This gift voucher is valid (${valore}). To use it, please see the reception desk.`,
        `Dieser Gutschein ist gültig (${valore}). Zum Einlösen bitte an die Rezeption.`,
      ],
    };
  }
  if (v.stato === 'riscosso') {
    return {
      classe: 'no',
      titolo: 'Questo buono è già stato utilizzato',
      testo: `${v.descrizione} · ${valore} · utilizzato il ${dataEstesa(v.riscosso_il)}`,
      sotto: 'Per qualsiasi dubbio, la reception è qui accanto.',
      tradotto: ['This voucher has already been used.', 'Dieser Gutschein wurde bereits eingelöst.'],
    };
  }
  if (v.stato === 'scaduto') {
    return {
      classe: 'no',
      titolo: 'Questo buono è scaduto',
      testo: `${v.descrizione} · ${valore} · scaduto il ${dataEstesa(v.scade_il)}`,
      sotto: 'Per qualsiasi dubbio, la reception è qui accanto.',
      tradotto: ['This voucher has expired.', 'Dieser Gutschein ist abgelaufen.'],
    };
  }
  return {
    classe: 'no',
    titolo: 'Questo buono non è valido',
    testo: v.descrizione ? `${v.descrizione} · ${valore}` : '',
    sotto: 'Si rivolga alla reception, qui accanto.',
    tradotto: ['This voucher is not valid. Please ask at the reception desk.', 'Dieser Gutschein ist nicht gültig. Bitte an die Rezeption.'],
  };
}
