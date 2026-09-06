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
  fuori_orario?: boolean | null;   // gli orari del menu (orari.ts): chiuso adesso
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
    if (a.fuori_orario) return { ok: false, errore: `${a.nome}: non a quest ora` };
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

/** Il codice a barre della tessera (EAN-13) dalle cifre che l'ospite legge
    sulla tessera: «1», zeri fino a dodici cifre, la cifra di controllo.
    Tessera 1466 → 1000000014662 (visto dal vivo il 4 settembre 2026).
    Cinque cifre possono essere la coda del codice a barre (numero piu'
    controllo): se il controllo torna, si prende quella lettura. */
export function codiceTessera(scritto: unknown): string | null {
  const cifre = String(scritto ?? '').replace(/\D/g, '');
  if (cifre.length < 3) return null;
  if (cifre.length === 13) return cifre;
  const ean = (numero: string) => {
    const corpo = ('1' + numero.padStart(11, '0')).slice(-12);
    let somma = 0;
    for (let i = 0; i < 12; i++) somma += Number(corpo[i]) * (i % 2 === 0 ? 1 : 3);
    return corpo + String((10 - (somma % 10)) % 10);
  };
  if (cifre.length >= 5 && cifre.length <= 12) {
    const conCoda = ean(cifre.slice(0, -1));
    if (conCoda.endsWith(cifre.slice(-1)) && conCoda.endsWith(cifre)) return conCoda;
  }
  return ean(cifre);
}

/** L'indirizzo di chi chiama: il primo della catena x-forwarded-for. */
export function ipDi(intestazioni: Headers): string {
  return (intestazioni.get('x-forwarded-for') || '').split(',')[0].trim();
}

/** Si ordina solo dalla rete dell'hotel («fai funzionare l'ordina solo con
    l'IP dell'hotel», la proprieta', 5 settembre 2026). Gli IP ammessi
    possono essere piu di uno, separati da virgola (la reception e il
    Wi-Fi degli ospiti escono da linee diverse). Senza l'IP configurato
    non si blocca nessuno. */
export function dallHotel(intestazioni: Headers, ipHotel: string | undefined): boolean {
  if (!ipHotel) return true;
return ipHotel.split(',').map((s) => s.trim()).filter(Boolean).includes(ipDi(intestazioni));
}

/* Le reti che nascondono l'indirizzo di chi naviga. Le prime due sono le
   uscite di iCloud Privato («Protezione IP» su iPhone, acceso da solo con
   iCloud+): Safari esce da Cloudflare o da Akamai, e l'indirizzo dell'hotel
   non si vede piu'. Sono blocchi grandi e condivisi da mezzo mondo: non si
   possono ammettere, ma riconoscerli serve a dire all'ospite PERCHE' non
   lo riconosciamo, invece di lasciarlo davanti a un numero che non capisce
   (la proprieta', 6 settembre 2026, con l'iPhone sul Wi-Fi dell'hotel).
   L'elenco non e' completo per costruzione: e' un aiuto al messaggio, non
   una difesa, e chi non c'e' dentro legge comunque la strada del QR. */
const RETI_NASCOSTE = [
  '104.16.', '104.17.', '104.18.', '104.19.', '104.20.', '104.21.', '104.22.', '104.23.',
  '104.24.', '104.25.', '104.26.', '104.27.', '104.28.', '104.29.', '104.30.', '104.31.',
  '172.224.', '172.225.', '172.226.', '172.227.', '172.228.', '172.229.', '172.230.', '172.231.',
  '146.75.', '151.101.',
];

/** Vero se l'indirizzo e' di una rete che nasconde chi c'e' dietro
 *  (iCloud Privato e simili): serve solo a spiegarlo nel messaggio. */
export function reteNascosta(ip: string): boolean {
  const s = String(ip || '').trim();
  return !!s && RETI_NASCOSTE.some((p) => s.startsWith(p));
}

/** Il numero dell'ordine, corto e leggibile: Q piu' sei segni senza 0/O/1/I. */
export function numeroOrdine(casuale: () => number = Math.random): string {
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = 'Q';
  for (let i = 0; i < 6; i++) s += alfabeto[Math.floor(casuale() * alfabeto.length) % alfabeto.length];
  return s;
}
