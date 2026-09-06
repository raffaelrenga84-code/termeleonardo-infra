/* Chi entra nel POS dal back office. Stessa regola dei buoni
   (buoni/ruoli.ts), riscritta qui perche' quel file importa il listino dei
   buoni e non si puo' copiare tale e quale: indirizzi scritti uno a uno,
   dominio esatto, nessun account che si aggiunge da solo.

   Reception e amministrazione fanno tutto: la proprieta' lavora con
   l'account della reception (visto il 4 settembre 2026). La spa non tocca
   il POS.

   IL BISTROT (6 settembre 2026). «Si puo' creare un account
   bistrot@termeleonardo.com»: dal PC del Bistrot si cambiano prezzi e
   prodotti senza vedere il resto del back office. Il bistrot tocca il
   menu', i tavoli, le fasce orarie e gli ordini dal QR (ristampa e nota);
   non il personale (PIN e codici dei palmari), non gli incassi della
   giornata, non gli addebiti in camera e non i rimborsi, che sono gesti
   sul denaro e restano a reception e amministrazione. Questo ruolo esiste
   SOLO qui: nelle altre funzioni (buoni, richieste, dayspa, privacy)
   l'indirizzo non e' in tabella e non ha ruolo, cioe' non vede niente,
   che e' esattamente cio' che si vuole. La pagina nasconde le schede
   (SCHEDE_NASCOSTE in pagine/buoni/index.html), ma il cancello e' qui. */

export type Ruolo = 'reception' | 'spa' | 'amministrazione' | 'bistrot';

const DOMINI_AMMESSI = (Deno.env.get('DOMINI_AMMESSI') || 'termeleonardo.com,hldv.com')
  .split(',').map((d) => d.trim().toLowerCase()).filter(Boolean);

const RUOLI = new Map<string, Ruolo>([
  ['reception@termeleonardo.com', 'reception'],
  ['spa@termeleonardo.com', 'spa'],
  ['amministrazione@termeleonardo.com', 'amministrazione'],
  ['bistrot@termeleonardo.com', 'bistrot'],
]);

/* Dominio ESATTO, non «contiene». */
function dominioAmmesso(email: string): boolean {
  const chiocciola = email.lastIndexOf('@');
  if (chiocciola < 1) return false;
  return DOMINI_AMMESSI.includes(email.slice(chiocciola + 1));
}

export function ruoloDi(email: unknown): Ruolo | null {
  const e = String(email ?? '').trim().toLowerCase();
  if (!dominioAmmesso(e)) return null;
  return RUOLI.get(e) ?? null;
}

export function vedeDayspa(ruolo: Ruolo | null): boolean {
  return ruolo === 'reception' || ruolo === 'spa' || ruolo === 'amministrazione';
}

export function puoRimborsare(ruolo: Ruolo | null): boolean {
  return ruolo === 'reception' || ruolo === 'amministrazione';
}

/* Le azioni del back office che il bistrot puo' chiamare: il menu' e i
   suoi listini, i tavoli e i loro QR, gli ordini dal QR da leggere,
   ristampare e annotare. `allinea-giu` e' la lettura di tutto il
   catalogo, che serve per disegnare quelle schede. */
const AZIONI_BISTROT = new Set([
  'allinea-giu', 'menu-salva', 'tavoli-salva', 'fasce-salva', 'tavoli-qr',
  'ospite-ordini', 'ospite-ristampa', 'ospite-nota',
]);

/** Vero se questo ruolo puo' chiamare quell'azione dal back office. */
export function puoDalBackOffice(ruolo: Ruolo | null, azione: string): boolean {
  if (ruolo === 'reception' || ruolo === 'amministrazione') return true;
  if (ruolo === 'bistrot') return AZIONI_BISTROT.has(azione);
  return false;
}

/** Le tabelle che `allinea-giu` NON manda a questo ruolo: al bistrot non
 *  scendono i camerieri (PIN) e i palmari (codici), che sulla sua pagina
 *  non compaiono comunque. Vuoto = scende tutto. */
export function tabelleNascoste(ruolo: Ruolo | null): string[] {
  return ruolo === 'bistrot' ? ['pos_cameriere', 'pos_dispositivo'] : [];
}
