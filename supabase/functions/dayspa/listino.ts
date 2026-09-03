/* Il listino del Day Spa: l'unica copia. La pagina lo riceve da ?a=listino
   e il server lo usa per il totale: un prezzo cambiato qui cambia ovunque.
   Prezzi del sito il 3 settembre 2026, decisi dalla proprieta'. */

export type Fascia = 'giornaliero' | 'serale';
export type Tipo = 'feriale' | 'prefestivo' | 'festivo';

export const FASCE: Fascia[] = ['giornaliero', 'serale'];
export const TIPI: Tipo[] = ['feriale', 'prefestivo', 'festivo'];
export const PERSONE_MAX = 8;      // come PERSONE_DAYSPA_MAX in richieste/tipi.ts
export const SOGLIA_ULTIMI = 5;    // «ultimi posti» da qui in giu'

export const ORARI: Record<Fascia, string> = { giornaliero: '9:00–18:30', serale: '18:00–22:30' };

const PREZZI_CENT: Record<Fascia, Record<Tipo, number>> = {
  giornaliero: { feriale: 3500, prefestivo: 4500, festivo: 4500 },
  serale:      { feriale: 2900, prefestivo: 2900, festivo: 2900 },
};

export function prezzoCent(tipo: Tipo, fascia: Fascia): number {
  return PREZZI_CENT[fascia][tipo];
}

export function totaleCent(tipo: Tipo, fascia: Fascia, persone: number): number {
  if (!Number.isInteger(persone) || persone < 1 || persone > PERSONE_MAX) {
    throw new Error(`persone fuori dall intervallo 1-${PERSONE_MAX}`);
  }
  return prezzoCent(tipo, fascia) * persone;
}

/* Il listino come lo riceve la pagina: tutto cio' che le serve per
   disegnare le fasce e il totale, niente altro. */
export function listinoPubblico() {
  return { fasce: FASCE, orari: ORARI, prezzi: PREZZI_CENT, personeMax: PERSONE_MAX };
}

/* Pasqua col metodo di Gauss (algoritmo di Meeus): torna AAAA-MM-GG. */
export function pasqua(anno: number): string {
  const a = anno % 19, b = Math.floor(anno / 100), c = anno % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mese = Math.floor((h + l - 7 * m + 114) / 31);
  const giorno = ((h + l - 7 * m + 114) % 31) + 1;
  return `${anno}-${String(mese).padStart(2, '0')}-${String(giorno).padStart(2, '0')}`;
}

export const giornoDopo = (iso: string): string => {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

/* Le feste nazionali italiane: fisse piu' Pasqua e Pasquetta. */
export function eFesta(iso: string): boolean {
  const anno = Number(iso.slice(0, 4)), mmgg = iso.slice(5);
  const fisse = ['01-01', '01-06', '04-25', '05-01', '06-02', '08-15', '11-01', '12-08', '12-25', '12-26'];
  if (fisse.includes(mmgg)) return true;
  const p = pasqua(anno);
  return iso === p || iso === giornoDopo(p);
}

/* 0 domenica … 6 sabato, letto a mezzogiorno UTC per non sbagliare giorno
   al cambio dell'ora */
const giornoSettimana = (iso: string): number => new Date(iso + 'T12:00:00Z').getUTCDay();

/* Domenica e feste: festivo. Sabato e vigilie di festa: prefestivo. Il resto
   feriale. La reception puo' correggere il singolo giorno nella scheda. */
export function tipoDelGiorno(iso: string): Tipo {
  const g = giornoSettimana(iso);
  if (g === 0 || eFesta(iso)) return 'festivo';
  if (g === 6 || eFesta(giornoDopo(iso))) return 'prefestivo';
  return 'feriale';
}

/* Il serale c'e' venerdi e sabato. */
export function fasceDelGiorno(iso: string): Fascia[] {
  const g = giornoSettimana(iso);
  return g === 5 || g === 6 ? ['giornaliero', 'serale'] : ['giornaliero'];
}
