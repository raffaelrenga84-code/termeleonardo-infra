/* ============================================================
   dove.ts — dove si prepara una riga, e dove va portata.

   Di regola si prepara dove si ordina: il tavolo sta in una zona, la zona
   in un locale, e il biglietto esce li'. Ma il ristorante, la sera, ordina
   le bevande al Bistrot e vuole che il biglietto esca al Bistrot, cosi'
   gliele portano senza telefonare (la proprieta', 4 settembre 2026).

   Chi lo decide, dal piu' preciso al piu' generale:
     1. la riga      — stasera questa la fa il Bistrot
     2. l'articolo   — questo cocktail lo fa solo il Bistrot
     3. la categoria — i cocktail li fa il Bistrot
     4. il tavolo    — tutto il resto si prepara dove si mangia

   Modulo puro: lo prova dove.test.ts, lo usano la funzione e il server
   locale. Una regola sola, due server.
   ============================================================ */

/** Il locale che prepara: la scelta piu' precisa fra quelle date. */
export function localeChePrepara(
  { riga, articolo, categoria, tavolo }: {
    riga?: string | null;
    articolo?: string | null;
    categoria?: string | null;
    tavolo: string;
  },
): string {
  const primo = [riga, articolo, categoria].map((x) => String(x ?? '').trim()).find((x) => x);
  return primo || tavolo;
}

/** C'e' una stampante per questa coppia (locale, stampante)?

    La cucina del ristorante non ne ha, e il ristorante il palmare lo usa
    solo per gli addebiti e per ordinare le bibite al Bistrot (la
    proprieta', 4 settembre 2026): un biglietto per il ristorante non
    uscirebbe mai e resterebbe in coda per sempre. Meglio non farlo: la
    riga sta sul conto lo stesso, e il giorno che una stampante arriva
    comincia a stampare da sola, senza toccare niente.
    O la postazione ha uno schermo, 6 settembre 2026: il biglietto nasce lo stesso. */
export function siStampa(
  { stampante, locale, postazione }: {
    stampante: 'cucina' | 'bar';
    locale: { stampante_cucina?: string | null; stampante_bar?: string | null } | null | undefined;
    postazione?: { schermo?: unknown } | null;
  },
): boolean {
  if (postazione && (postazione.schermo === true || Number(postazione.schermo) === 1)) return true;
  if (!locale) return false;
  const dove = stampante === 'bar' ? locale.stampante_bar : locale.stampante_cucina;
  return !!String(dove ?? '').trim();
}

/** Il nome da stampare come «PORTARE AL …», o null se si serve li'. */
export function portareA(
  { preparaIn, tavoloIn, nomeDelLocale }: { preparaIn: string; tavoloIn: string; nomeDelLocale: (id: string) => string | null },
): string | null {
  if (preparaIn === tavoloIn) return null;
  return nomeDelLocale(tavoloIn) || tavoloIn;
}
