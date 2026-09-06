/* ============================================================
   aggiorna.ts — il PC del Bistrot si aggiorna da solo dal cloud.

   «aggiornamento automatico del PC per non ricopiare la cartella a ogni
   modifica» (la proprieta', 6 settembre 2026). Il pacchetto (src/ e
   pagina/, non deno.exe) sta in banca dati, tabella pos_pacchetto: ce lo
   mette strumenti/pubblica-pacchetto.js dalla reception, ogni volta che
   si rifa' la cartella. Qui, dopo ogni giro di «giu'» (ogni minuto), si
   chiede al cloud che versione c'e': se e' piu' nuova di VERSIONE.txt si
   scaricano i file in nuovo/, si controlla l'impronta di ognuno e si
   compila il server nuovo con lo stesso Deno del PC («deno check»): se
   non e' sano si scarta tutto e si resta come si e'. Se e' sano, src/ e
   pagina/ diventano src.vecchio/ e pagina.vecchio/, i nuovi prendono il
   loro posto e il server esce col codice AGGIORNATO: avvio.ts (il
   supervisore) lo fa ripartire col codice nuovo, e se il nuovo cade tre
   volte di fila rimette il vecchio. Mai toccati: config.json, deno.exe,
   pos.sqlite, avvio.ts.

   Puro dove si puo' (percorsoAmmesso, piuNuova); aggiorna() lavora su una
   cartella e su un fetch che le prove sostituiscono (aggiorna.test.ts).
   ============================================================ */

/** Codice di uscita del server: «ho cambiato codice, fammi ripartire». */
export const AGGIORNATO = 75;

export type FileDelPacchetto = { percorso: string; sha256: string; byte: number };
export type Manifesto = { versione: string | null; file: FileDelPacchetto[] };
export type Esito =
  | { esito: 'niente'; versione_cloud: string | null }
  | { esito: 'aggiornato'; versione: string }
  | { esito: 'scartato'; motivo: string; versione: string | null };
export type Cloud = { base: string; hotelKey: string; fetch?: typeof fetch };

/** Solo dentro src/ e pagina/, senza giri («..»), senza radici, con nomi puliti. */
export function percorsoAmmesso(p: unknown): boolean {
  if (typeof p !== 'string' || !/^(src|pagina)\/[A-Za-z0-9_.\-/]+$/.test(p)) return false;
  if (p.endsWith('/') || p.includes('//')) return false;
  return p.split('/').every((s) => s !== '..' && s !== '.');
}

/** La versione e' la data ISO del pacchetto: si confronta come testo. */
export function piuNuova(cloud: string | null | undefined, locale: string | null | undefined): boolean {
  if (!cloud) return false;
  return !locale || cloud > locale;
}

export async function impronta(byte: Uint8Array<ArrayBuffer>): Promise<string> {
  const h = await crypto.subtle.digest('SHA-256', byte);
  return [...new Uint8Array(h)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

/** La prima riga di VERSIONE.txt, o null se non c'e'. */
export function versioneLocale(dir: string): string | null {
  try { return Deno.readTextFileSync(`${dir}/VERSIONE.txt`).split(/\r?\n/)[0].trim() || null; } catch { return null; }
}
/** La versione che e' caduta all'avvio e che il supervisore ha rimesso
    indietro (VERSIONE.rotta.txt): non la si riprende, se no PC in giostra
    (revisione del 6 settembre 2026). Alla pubblicazione successiva, che
    ha un'altra data, si riprova da soli. */
export function versioneRotta(dir: string): string | null {
  try { return Deno.readTextFileSync(`${dir}/VERSIONE.rotta.txt`).split(/\r?\n/)[0].trim() || null; } catch { return null; }
}

/** Si prende la versione del cloud se e' DIVERSA da quella locale (anche
    piu' vecchia: ripubblicare quella di ieri e' il modo di tornare indietro
    da lontano) e non e' quella rotta. */
export function daPrendere(cloud: string | null | undefined, locale: string | null | undefined, rotta: string | null | undefined): boolean {
  if (!cloud) return false;
  return cloud !== (locale ?? null) && cloud !== (rotta ?? null);
}

function decodificaBase64(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function chiedi(cloud: Cloud, qs: string): Promise<Record<string, unknown>> {
  const f = cloud.fetch ?? globalThis.fetch;
  const r = await f(`${cloud.base}?a=${qs}`, { headers: { 'x-hotel-key': cloud.hotelKey } });
  if (!r.ok) throw new Error(`${qs.split('&')[0]}: HTTP ${r.status}`);
  return await r.json() as Record<string, unknown>;
}

const esiste = (p: string): boolean => { try { Deno.statSync(p); return true; } catch { return false; } };
const via = (p: string): void => { if (esiste(p)) Deno.removeSync(p, { recursive: true }); };

/** Scarica e mette in opera il pacchetto nuovo, se c'e'. `controlla(dirNuovo)`
    dice se il server nuovo compila (main.ts lo chiede a «deno check»). */
export async function aggiorna(opz: { dir: string; cloud: Cloud; controlla: (dirNuovo: string) => Promise<boolean>; log?: (m: string) => void }): Promise<Esito> {
  const { dir, cloud, controlla } = opz;
  const log = opz.log ?? (() => {});
  const locale = versioneLocale(dir);
  let m: Manifesto;
  try { m = await chiedi(cloud, 'pacchetto') as unknown as Manifesto; } catch (e) { return { esito: 'scartato', motivo: (e as Error).message, versione: null }; }
  const versione = typeof m.versione === 'string' ? m.versione : null;
  if (!versione || !daPrendere(versione, locale, versioneRotta(dir))) return { esito: 'niente', versione_cloud: versione };
  const file = Array.isArray(m.file) ? m.file : [];
  const scarta = (motivo: string): Esito => { via(`${dir}/nuovo`); log(`aggiornamento ${versione} scartato: ${motivo}`); return { esito: 'scartato', motivo, versione }; };
  if (!file.length) return scarta('pacchetto vuoto');
  for (const f of file) if (!percorsoAmmesso(f?.percorso)) return scarta(`percorso non ammesso: ${String(f?.percorso)}`);
  if (!file.some((f) => f.percorso === 'src/pos-locale/main.ts')) return scarta('manca src/pos-locale/main.ts');
  if (!file.some((f) => f.percorso.startsWith('pagina/'))) return scarta('manca la pagina');
  /* si scarica tutto in nuovo/ e si controlla ogni impronta prima di toccare qualcosa */
  via(`${dir}/nuovo`);
  try {
    for (const f of file) {
      const r = await chiedi(cloud, `pacchetto-file&percorso=${encodeURIComponent(f.percorso)}`);
      const byte = decodificaBase64(String(r.contenuto ?? ''));
      if (byte.length !== Number(f.byte) || await impronta(byte) !== f.sha256) return scarta(`impronta sbagliata: ${f.percorso}`);
      const dest = `${dir}/nuovo/${f.percorso}`;
      Deno.mkdirSync(dest.slice(0, dest.lastIndexOf('/')), { recursive: true });
      Deno.writeFileSync(dest, byte);
    }
  } catch (e) { return scarta((e as Error).message); }
  let sano = false;
  try { sano = await controlla(`${dir}/nuovo`); } catch (e) { return scarta(`controllo fallito: ${(e as Error).message}`); }
  if (!sano) return scarta('il server nuovo non compila');
  /* il cambio: il vecchio resta accanto, per tornare indietro (avvio.ts) */
  via(`${dir}/src.vecchio`); via(`${dir}/pagina.vecchio`);
  if (esiste(`${dir}/src`)) Deno.renameSync(`${dir}/src`, `${dir}/src.vecchio`);
  if (esiste(`${dir}/pagina`)) Deno.renameSync(`${dir}/pagina`, `${dir}/pagina.vecchio`);
  Deno.renameSync(`${dir}/nuovo/src`, `${dir}/src`);
  Deno.renameSync(`${dir}/nuovo/pagina`, `${dir}/pagina`);
  via(`${dir}/nuovo`);
  if (esiste(`${dir}/VERSIONE.txt`)) Deno.renameSync(`${dir}/VERSIONE.txt`, `${dir}/VERSIONE.vecchio.txt`);
  Deno.writeTextFileSync(`${dir}/VERSIONE.txt`, `${versione}\n`);
  log(`aggiornato: ${locale ?? 'senza versione'} → ${versione}`);
  return { esito: 'aggiornato', versione };
}
