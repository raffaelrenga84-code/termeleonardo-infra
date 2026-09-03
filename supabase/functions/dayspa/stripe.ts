/* Stripe per il Day Spa: i parametri del link di pagamento e la verifica
   della firma del webhook. Copiati da buoni/index.ts e resi puri: il
   segreto e l'orologio arrivano da fuori, cosi' si provano senza rete.

   MODALITA' DI PROVA. Finche' DAYSPA_PROVA=1 si usano le chiavi di prova
   di Stripe (STRIPE_PROVA_KEY, STRIPE_PROVA_WEBHOOK_SECRET): le carte
   finte pagano, nessun euro vero si muove. In produzione la chiave con
   limitazioni dei buoni (STRIPE_RESTRICTED_KEY) e un segreto di webhook
   suo, STRIPE_WEBHOOK_SECRET_DAYSPA, perche' l'endpoint e' un altro. */

export const STRIPE = 'https://api.stripe.com/v1';

export function chiaveStripe(prova: boolean): string | undefined {
  return Deno.env.get(prova ? 'STRIPE_PROVA_KEY' : 'STRIPE_RESTRICTED_KEY');
}

export function segretoWebhook(prova: boolean): string | undefined {
  return Deno.env.get(prova ? 'STRIPE_PROVA_WEBHOOK_SECRET' : 'STRIPE_WEBHOOK_SECRET_DAYSPA');
}

/* I parametri del prezzo e del link in un oggetto solo: index.ts li divide
   fra POST /v1/prices (currency, unit_amount, product_data[name]) e
   POST /v1/payment_links (il resto), come fa buoni/index.ts. */
export function parametriLink(p: { numero: string; descrizione: string; importoCent: number; redirect: string }): Record<string, string> {
  return {
    currency: 'eur',
    unit_amount: String(p.importoCent),
    'product_data[name]': p.descrizione.slice(0, 250),
    'line_items[0][quantity]': '1',
    /* un link, un pagamento: senza questo Stripe lo lascia riutilizzabile e
       chi lo inoltra o ricarica la pagina paga due volte */
    'restrictions[completed_sessions][limit]': '1',
    'metadata[numero]': p.numero,
    'payment_intent_data[metadata][numero]': p.numero,
    'payment_intent_data[description]': `Day Spa ${p.numero}`,
    'after_completion[type]': 'redirect',
    'after_completion[redirect][url]': p.redirect,
  };
}

export const CHIAVI_PREZZO = ['currency', 'unit_amount', 'product_data[name]'];

export function dividi(p: Record<string, string>): { prezzo: Record<string, string>; link: Record<string, string> } {
  const prezzo: Record<string, string> = {}, link: Record<string, string> = {};
  for (const [k, v] of Object.entries(p)) (CHIAVI_PREZZO.includes(k) ? prezzo : link)[k] = v;
  return { prezzo, link };
}

/* verifica della firma del webhook, senza librerie: HMAC-SHA256
   sullo schema "timestamp.corpo" come da documentazione Stripe */
export async function firmaValida(corpo: string, intestazione: string | null, segreto: string | undefined, adessoMs: number = Date.now()): Promise<boolean> {
  if (!segreto || !intestazione) return false;
  const parti = Object.fromEntries(intestazione.split(',')
    .map((x) => x.split('=')).filter((x) => x.length === 2)) as Record<string, string>;
  const t = parti['t'], firma = parti['v1'];
  if (!t || !firma) return false;
  /* rifiuta gli eventi vecchi: protegge dai rinvii */
  if (Math.abs(adessoMs / 1000 - Number(t)) > 300) return false;

  const chiave = await crypto.subtle.importKey('raw', new TextEncoder().encode(segreto),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const calcolata = await crypto.subtle.sign('HMAC', chiave, new TextEncoder().encode(`${t}.${corpo}`));
  const atteso = [...new Uint8Array(calcolata)].map((b) => b.toString(16).padStart(2, '0')).join('');
  /* confronto a tempo costante */
  if (atteso.length !== firma.length) return false;
  let diff = 0;
  for (let i = 0; i < atteso.length; i++) diff |= atteso.charCodeAt(i) ^ firma.charCodeAt(i);
  return diff === 0;
}
