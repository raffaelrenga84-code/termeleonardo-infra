/* ============================================================
   avvio.ts — il supervisore del server sul PC del Bistrot.

   Sta in C:\pos accanto a deno.exe, FUORI da src/: gli aggiornamenti
   automatici (aggiorna.ts) non lo toccano, e per cambiarlo serve la
   chiavetta. L'attivita' pianificata «POS Bistrot» lancia questo, e
   questo lancia il server (src/pos-locale/main.ts) e lo tiene su:
   - se il server esce con AGGIORNATO (75) riparte subito, col codice nuovo;
   - se cade, riparte dopo tre secondi;
   - se cade tre volte di fila entro trenta secondi dall'avvio e c'e'
     src.vecchio/, rimette src.vecchio/ e pagina.vecchio/ al loro posto,
     torna alla VERSIONE.vecchio.txt e lo scrive in RIPRISTINO.txt.
   Quello che succede finisce in supervisore.log, accanto a questo file.

   Uso: deno run --node-modules-dir=none --no-prompt --allow-run=<deno.exe>
        --allow-read --allow-write --allow-env avvio.ts C:\pos\config.json
   Le regole sono pure (decisione, ripristina): le prova avvio.test.ts.
   ============================================================ */
export const AGGIORNATO = 75;
export const POCO_MS = 30_000;
export const CADUTE_MASSIME = 3;
export const ATTESA_MS = 3_000;

export type Decisione = { cosa: 'riparti' | 'ripristina'; cadute: number; attesaMs: number };

/** Cosa fare quando il server esce: e' un aggiornamento, una caduta, o la terza caduta di fila. */
export function decisione(s: { codice: number; durataMs: number; cadute: number }): Decisione {
  if (s.codice === AGGIORNATO) return { cosa: 'riparti', cadute: 0, attesaMs: 0 };
  if (s.durataMs >= POCO_MS) return { cosa: 'riparti', cadute: 0, attesaMs: ATTESA_MS };
  const cadute = s.cadute + 1;
  if (cadute >= CADUTE_MASSIME) return { cosa: 'ripristina', cadute: 0, attesaMs: ATTESA_MS };
  return { cosa: 'riparti', cadute, attesaMs: ATTESA_MS };
}

const esiste = (p: string): boolean => { try { Deno.statSync(p); return true; } catch { return false; } };
const via = (p: string): void => { if (esiste(p)) Deno.removeSync(p, { recursive: true }); };

/** Rimette la versione precedente, se c'e'. Torna false se non c'era niente da rimettere. */
export function ripristina(dir: string): boolean {
  if (!esiste(`${dir}/src.vecchio`)) return false;
  const rotto = versione(dir);
  via(`${dir}/src.rotto`); via(`${dir}/pagina.rotto`);
  if (esiste(`${dir}/src`)) Deno.renameSync(`${dir}/src`, `${dir}/src.rotto`);
  if (esiste(`${dir}/pagina`)) Deno.renameSync(`${dir}/pagina`, `${dir}/pagina.rotto`);
  Deno.renameSync(`${dir}/src.vecchio`, `${dir}/src`);
  if (esiste(`${dir}/pagina.vecchio`)) Deno.renameSync(`${dir}/pagina.vecchio`, `${dir}/pagina`);
  if (esiste(`${dir}/VERSIONE.vecchio.txt`)) { via(`${dir}/VERSIONE.txt`); Deno.renameSync(`${dir}/VERSIONE.vecchio.txt`, `${dir}/VERSIONE.txt`); }
  Deno.writeTextFileSync(`${dir}/RIPRISTINO.txt`, `${new Date().toISOString()} la versione ${rotto ?? '?'} cadeva all'avvio: rimessa la ${versione(dir) ?? '?'}\n`);
  return true;
}

function versione(dir: string): string | null {
  try { return Deno.readTextFileSync(`${dir}/VERSIONE.txt`).split(/\r?\n/)[0].trim() || null; } catch { return null; }
}

if (import.meta.main) {
  const cfg = Deno.args[0] || 'config.json';
  const dir = cfg.replace(/[^\\/]*$/, '').replace(/[\\/]$/, '') || '.';
  const log = (m: string) => {
    const riga = `${new Date().toISOString().slice(0, 19)} ${m}\n`;
    console.log(riga.trim());
    try { Deno.writeTextFileSync(`${dir}/supervisore.log`, riga, { append: true }); } catch { /* senza log si va avanti */ }
  };
  let cadute = 0;
  log(`supervisore: parto (${dir}, versione ${versione(dir) ?? '?'})`);
  while (true) {
    const inizio = Date.now();
    const server = new Deno.Command(Deno.execPath(), {
      args: ['run', '--node-modules-dir=none', '--no-prompt', '--allow-net', '--allow-read', '--allow-write', '--allow-env', `--allow-run=${Deno.execPath()}`, `${dir}/src/pos-locale/main.ts`, cfg],
      stdout: 'inherit', stderr: 'inherit',
    });
    let codice = 1;
    try { codice = (await server.spawn().status).code; } catch (e) { log(`non parte: ${(e as Error).message}`); }
    const d = decisione({ codice, durataMs: Date.now() - inizio, cadute });
    cadute = d.cadute;
    log(codice === AGGIORNATO ? 'il server si e aggiornato: riparto col codice nuovo' : `il server e uscito (codice ${codice}) dopo ${Math.round((Date.now() - inizio) / 1000)} s`);
    if (d.cosa === 'ripristina') log(ripristina(dir) ? `tre cadute di fila: rimessa la versione precedente (${versione(dir) ?? '?'})` : 'tre cadute di fila e nessuna versione precedente da rimettere');
    if (d.attesaMs) await new Promise((r) => setTimeout(r, d.attesaMs));
  }
}
