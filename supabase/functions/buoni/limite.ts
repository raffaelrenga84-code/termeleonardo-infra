/* ============================================================
   limite.ts — freno sulle richieste pubbliche.
   ?a=acquista è aperto a chiunque e ogni chiamata consuma un numero
   di buono: un ciclo automatico bucherebbe la numerazione.

   Due freni, perché quello in memoria da solo non basta: provato in
   produzione, quattordici richieste di fila non lo fanno mai scattare,
   perché ogni chiamata prende un'istanza nuova e il contatore riparte
   da zero. Resta come prima linea a costo zero quando l'istanza è calda;
   il tetto che regge davvero è quello contato sul database.
   ============================================================ */

const FINESTRA_MS = 10 * 60 * 1000;   // dieci minuti
const MAX_PER_IP = 8;                 // acquisti plausibili nella finestra

const visti = new Map<string, number[]>();

/** true se la richiesta può passare; registra il tentativo. */
export function entroIlLimite(ip: string, ora: number = Date.now()): boolean {
  if (!ip) return true;                     // senza IP non si discrimina
  const soglia = ora - FINESTRA_MS;
  const recenti = (visti.get(ip) || []).filter((t) => t > soglia);
  if (recenti.length >= MAX_PER_IP) {
    visti.set(ip, recenti);                 // niente accumulo infinito
    return false;
  }
  recenti.push(ora);
  visti.set(ip, recenti);
  /* pulizia opportunistica: senza, la mappa cresce finché l'istanza vive */
  if (visti.size > 500) {
    for (const [k, v] of visti) if (!v.some((t) => t > soglia)) visti.delete(k);
  }
  return true;
}

/** solo per i test: azzera lo stato fra un caso e l'altro */
export function azzeraLimite(): void {
  visti.clear();
}

/* ---------- il tetto che regge fra istanze diverse ----------
   Conta i buoni nati dal sito nell'ultima mezz'ora: sta nel database,
   quindi vale per tutti. La soglia è molto sopra il traffico vero (un
   hotel non vende trenta buoni online in mezz'ora) e serve solo a
   fermare un ciclo impazzito prima che mangi la numerazione. */
export const TETTO_MEZZORA = 30;

export async function troppiDalSito(
  db: { from: (t: string) => any },
  ora: number = Date.now()
): Promise<boolean> {
  const da = new Date(ora - 30 * 60 * 1000).toISOString();
  const { count, error } = await db.from('buono_regalo')
    .select('numero', { count: 'exact', head: true })
    .eq('creato_da', 'sito')
    .gte('creato_il', da);
  /* se il conteggio non riesce non si blocca la vendita: meglio un
     acquisto in più che una cassa chiusa per un errore di lettura */
  if (error) { console.error('conteggio acquisti non riuscito', error.message); return false; }
  return (count ?? 0) >= TETTO_MEZZORA;
}
