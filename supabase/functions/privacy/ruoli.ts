/* Chi vede e chi scrive nel Day Spa. Stessa regola dei buoni
   (buoni/ruoli.ts), riscritta qui perche' quel file importa il listino dei
   buoni e non si puo' copiare tale e quale: tre indirizzi, dominio esatto,
   nessun account che si aggiunge da solo.

   Reception e spa vedono le prenotazioni e caricano i posti; il rimborso
   e' un gesto sul denaro incassato e sta alla reception e
   all'amministrazione, come per i buoni (decisione del 18 agosto 2026). */

export type Ruolo = 'reception' | 'spa' | 'amministrazione';

const DOMINI_AMMESSI = (Deno.env.get('DOMINI_AMMESSI') || 'termeleonardo.com,hldv.com')
  .split(',').map((d) => d.trim().toLowerCase()).filter(Boolean);

const RUOLI = new Map<string, Ruolo>([
  ['reception@termeleonardo.com', 'reception'],
  ['spa@termeleonardo.com', 'spa'],
  ['amministrazione@termeleonardo.com', 'amministrazione'],
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
