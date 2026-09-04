/* ============================================================
   comanda.ts — il biglietto per cucina e bar, e i byte ESC/POS.

   Larghezza 32 colonne (rotolo 80 mm, carattere normale; il titolo in
   doppia altezza e larghezza). Il testo lo capisce chiunque lo legga sul
   biglietto; i byte li capisce la stampante. Modulo puro: lo prova
   comanda.test.ts, lo usano la funzione (stampa dal cloud) e il server
   locale (stampa sulla LAN).
   ============================================================ */
export type Biglietto = {
  tipo: 'COMANDA' | 'VAI' | 'STORNO' | 'MODIFICA';
  locale: string; tavolo: string; conto: string; coperti: number;
  portata: string; ora: string; cameriere: string;
  righe: { quantita: number; nome: string; variante?: string | null; nota?: string | null }[];
  noteVitto?: string | null;
  /* Dove va portato, quando il biglietto esce in un locale diverso da
     quello del tavolo: il ristorante ordina le bevande al Bistrot, e chi
     le prepara deve sapere dove si mangia — se no tocca telefonare, che
     e' proprio quello che si vuole togliere (la proprieta', 4 settembre
     2026). Vuoto: si serve dove si e' ordinato. */
  portareA?: string | null;
};

const L = 32;
const taglia = (s: string) => s.length <= L ? s : s.slice(0, L);

/** Va a capo per parole senza superare le 32 colonne; ogni riga porta il rientro. */
const aCapo = (s: string, rientro = 4): string[] => {
  const larghezza = L - rientro;
  const out: string[] = [];
  let riga = '';
  for (const p of s.split(' ')) {
    const prova = (riga + ' ' + p).trim();
    if (prova.length > larghezza && riga) { out.push(riga); riga = p; } else riga = prova;
  }
  if (riga) out.push(riga);
  return out.map((r) => ' '.repeat(rientro) + taglia(r));
};

export function testoBiglietto(b: Biglietto): string {
  const righe: string[] = [];
  righe.push(taglia(`${b.tipo}  ${b.portata.toUpperCase()}`));
  /* subito sotto il titolo, prima ancora del tavolo: chi legge il
     biglietto deve capire in un colpo che questa roba se ne va altrove */
  if (b.portareA) righe.push(taglia(`>>> PORTARE AL ${b.portareA.toUpperCase()}`));
  righe.push(taglia(`${b.tavolo}  (${b.coperti} cop.)  ${b.conto}`));
  righe.push(taglia(`${b.ora}  ${b.cameriere}  ${b.locale}`));
  if (b.noteVitto) righe.push(taglia(`!!! ${b.noteVitto} !!!`));
  righe.push('-'.repeat(L));
  for (const r of b.righe) {
    righe.push(...aCapo(`${r.quantita} x ${r.nome}`, 0));
    if (r.variante) righe.push(...aCapo(`+ ${r.variante}`));
    if (r.nota) righe.push(...aCapo(`> ${r.nota}`));
  }
  righe.push('-'.repeat(L));
  return righe.join('\n') + '\n';
}

/* CP1252 per gli accenti: la stampante (Epson-compatibile) la seleziona con ESC t 16.
   Quello che non c'e' in CP1252 diventa un punto interrogativo, non un byte a caso. */
function cp1252(s: string): number[] {
  const out: number[] = [];
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    if (c < 0x80) out.push(c);
    else if (c >= 0xa0 && c <= 0xff) out.push(c);
    else if (c === 0x20ac) out.push(0x80);
    else out.push(0x3f);
  }
  return out;
}

/** I byte per la stampante: ESC @ (inizializza), ESC t 16 (CP1252), la prima
    riga in doppia altezza e larghezza (ESC ! 0x30), tre righe vuote e il
    taglio (GS V 0). */
export function escpos(testo: string): Uint8Array {
  const b: number[] = [0x1b, 0x40, 0x1b, 0x74, 16];
  const righe = testo.replace(/\n$/, '').split('\n');
  righe.forEach((r, i) => {
    if (i === 0) b.push(0x1b, 0x21, 0x30);
    b.push(...cp1252(r), 0x0a);
    if (i === 0) b.push(0x1b, 0x21, 0x00);
  });
  b.push(0x0a, 0x0a, 0x0a, 0x1d, 0x56, 0x00);
  return new Uint8Array(b);
}
