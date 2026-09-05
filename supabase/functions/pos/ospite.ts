/* ============================================================
   ospite.ts — l'ordine dal tavolo, fatto dall'ospite col QR. Puro.

   «un QR code sul tavolo... pagando con Google Pay o Apple Pay, e se
   ospiti dell'hotel scansionando la carta stanza, obbligando a mettere
   anche il numero di camera perche' uno potrebbe trovare una carta per
   terra» (la proprieta', 5 settembre 2026).

   Qui le regole che non toccano rete ne' banca dati:
     - il QR porta l'id del tavolo e una FIRMA (HMAC con la chiave
       hotel, 16 caratteri): senza la firma giusta nessuno ordina su un
       tavolo che non ha davanti;
     - le righe ordinate si ricostruiscono dal listino del server, mai
       dai prezzi mandati dal telefono; quantita' e note hanno un tetto;
     - la camera scritta dall'ospite deve combaciare con quella che Fidra
       associa alla tessera.
   Lo prova ospite.test.ts.
   ============================================================ */
export const OSPITE_MAX_RIGHE = 40;
export const OSPITE_MAX_QUANTITA = 20;
export const OSPITE_MAX_NOTA = 120;
export const OSPITE_MAX_TOTALE_CENT = 100_000;   // mille euro: oltre non e' un ordine al tavolo

async function hmacEsadecimale(testo: string, segreto: string): Promise<string> {
  const chiave = await crypto.subtle.importKey('raw', new TextEncoder().encode(segreto), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const firma = await crypto.subtle.sign('HMAC', chiave, new TextEncoder().encode(testo));
  return [...new Uint8Array(firma)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** La firma che sta nel QR del tavolo: 16 caratteri, stabile finche' la chiave hotel non cambia. */
export async function firmaTavolo(tavolo: string, segreto: string): Promise<string> {
  return (await hmacEsadecimale('tavolo:' + tavolo, segreto)).slice(0, 16);
}

/** La firma del QR e' quella giusta? Confronto a tempo costante. */
export async function tavoloFirmato(tavolo: unknown, firma: unknown, segreto: string | undefined): Promise<boolean> {
  if (!segreto || typeof tavolo !== 'string' || typeof firma !== 'string' || !tavolo) return false;
  const attesa = await firmaTavolo(tavolo, segreto);
  if (attesa.length !== firma.length) return false;
  let diff = 0;
  for (let i = 0; i < attesa.length; i++) diff |= attesa.charCodeAt(i) ^ firma.charCodeAt(i);
  return diff === 0;
}

export type ArticoloVendibile = {
  id: string; nome: string; prezzo_cent: number; categoria?: string | null; portata?: string | null;
  esaurito?: boolean | null; prezzo_libero?: boolean | null; attivo?: boolean | null;
};
export type RigaOspite = { articolo: string; nome: string; quantita: number; prezzo_cent: number; nota: string | null; portata: string | null };

/** Le righe dell'ordine, ricostruite dal listino: prezzo e nome li dice il
    server, dal telefono arrivano solo articolo, quantita' e nota. */
export function righeOrdine(richieste: unknown, articoli: ArticoloVendibile[]): { ok: true; righe: RigaOspite[]; totale_cent: number } | { ok: false; errore: string } {
  if (!Array.isArray(richieste) || !richieste.length) return { ok: false, errore: 'l ordine e vuoto' };
  if (richieste.length > OSPITE_MAX_RIGHE) return { ok: false, errore: `al massimo ${OSPITE_MAX_RIGHE} righe` };
  const righe: RigaOspite[] = [];
  for (const r of richieste as Record<string, unknown>[]) {
    const a = articoli.find((x) => x.id === String(r?.articolo ?? ''));
    if (!a || a.attivo === false) return { ok: false, errore: 'un articolo non e piu in listino' };
    if (a.esaurito) return { ok: false, errore: `${a.nome}: esaurito` };
    if (a.prezzo_libero) return { ok: false, errore: `${a.nome}: si ordina al cameriere` };
    const q = Math.round(Number(r?.quantita));
    if (!Number.isInteger(q) || q < 1 || q > OSPITE_MAX_QUANTITA) return { ok: false, errore: `${a.nome}: quantita fra 1 e ${OSPITE_MAX_QUANTITA}` };
    const nota = String(r?.nota ?? '').replace(/\s+/g, ' ').trim().slice(0, OSPITE_MAX_NOTA) || null;
    righe.push({ articolo: a.id, nome: a.nome, quantita: q, prezzo_cent: Math.max(0, Math.round(Number(a.prezzo_cent) || 0)), nota, portata: a.portata ?? null });
  }
  const totale_cent = righe.reduce((t, r) => t + r.quantita * r.prezzo_cent, 0);
  if (totale_cent <= 0) return { ok: false, errore: 'l ordine non ha un importo' };
  if (totale_cent > OSPITE_MAX_TOTALE_CENT) return { ok: false, errore: 'ordine troppo grande: chiami il cameriere' };
  return { ok: true, righe, totale_cent };
}

/** La camera scritta dall'ospite e' quella della tessera? Contro la
    tessera trovata per terra: chi non sa la camera non addebita. */
export function cameraCombacia(scritta: unknown, daFidra: string | null | undefined): boolean {
  const a = String(scritta ?? '').trim().replace(/^0+(?=\d)/, '').toLowerCase();
  const b = String(daFidra ?? '').trim().replace(/^0+(?=\d)/, '').toLowerCase();
  return !!a && !!b && a === b;
}

/** Il numero dell'ordine, corto e leggibile: Q piu' sei segni senza 0/O/1/I. */
export function numeroOrdine(casuale: () => number = Math.random): string {
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = 'Q';
  for (let i = 0; i < 6; i++) s += alfabeto[Math.floor(casuale() * alfabeto.length) % alfabeto.length];
  return s;
}
