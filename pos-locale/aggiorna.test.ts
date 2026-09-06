/* ============================================================
   aggiorna.test.ts — il PC del Bistrot si aggiorna da solo dal cloud.

   Cartelle vere (temporanee) e un cloud finto: si vede cosa succede su
   disco, non solo cosa torna la funzione.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';
import { aggiorna, AGGIORNATO, impronta, percorsoAmmesso, piuNuova, versioneLocale } from './aggiorna.ts';

const enc = new TextEncoder();
const b64 = (s: string) => btoa(String.fromCharCode(...enc.encode(s)));

async function pacchettoFinto(versione: string | null, file: Record<string, string>) {
  const manifesto = { versione, file: [] as { percorso: string; sha256: string; byte: number }[] };
  const contenuti: Record<string, { contenuto: string; sha256: string }> = {};
  for (const [percorso, testo] of Object.entries(file)) {
    const byte = enc.encode(testo);
    const sha256 = await impronta(byte);
    manifesto.file.push({ percorso, sha256, byte: byte.length });
    contenuti[percorso] = { contenuto: b64(testo), sha256 };
  }
  const chiamate: string[] = [];
  const fetchFinto = ((url: string, init?: RequestInit) => {
    chiamate.push(url);
    const chiave = (init?.headers as Record<string, string> | undefined)?.['x-hotel-key'];
    if (chiave !== 'K') return Promise.resolve(new Response('{"errore":"non autorizzato"}', { status: 401 }));
    const u = new URL(url);
    if (u.searchParams.get('a') === 'pacchetto') return Promise.resolve(Response.json(manifesto));
    const p = u.searchParams.get('percorso') ?? '';
    return Promise.resolve(contenuti[p] ? Response.json({ percorso: p, ...contenuti[p] }) : new Response('{"errore":"no"}', { status: 404 }));
  }) as unknown as typeof fetch;
  return { manifesto, contenuti, fetch: fetchFinto, chiamate };
}

function cartella(versione: string | null): string {
  const dir = Deno.makeTempDirSync({ prefix: 'aggiorna-' });
  Deno.mkdirSync(`${dir}/src/pos-locale`, { recursive: true });
  Deno.mkdirSync(`${dir}/pagina`, { recursive: true });
  Deno.writeTextFileSync(`${dir}/src/pos-locale/main.ts`, 'vecchio');
  Deno.writeTextFileSync(`${dir}/pagina/index.html`, 'pagina vecchia');
  Deno.writeTextFileSync(`${dir}/config.json`, '{"hotelKey":"K"}');
  if (versione) Deno.writeTextFileSync(`${dir}/VERSIONE.txt`, `${versione}\ndeno 2.9.5\n`);
  return dir;
}
const leggi = (p: string): string | null => { try { return Deno.readTextFileSync(p); } catch { return null; } };
const cloud = (f: typeof fetch) => ({ base: 'https://cloud/pos', hotelKey: 'K', fetch: f });
const compilaSempre = () => Promise.resolve(true);

Deno.test('percorsi ammessi: solo src/ e pagina/, niente giri, niente config, deno.exe o supervisore', () => {
  for (const ok of ['src/pos-locale/main.ts', 'src/supabase/functions/pos/portate.ts', 'pagina/index.html', 'pagina/cucina/tv.html', 'pagina/ingresso/icona-192.png']) assert(percorsoAmmesso(ok), ok);
  for (const no of ['config.json', 'deno.exe', 'avvio.ts', '../src/x.ts', 'src/../config.json', 'src/./a.ts', '/src/a.ts', 'src/', 'src//a.ts', 'pos.sqlite', 'src/a b.ts', 'srcx/a.ts', 42, null, '']) assert(!percorsoAmmesso(no), String(no));
});

Deno.test('la versione e una data: piu nuova se viene dopo; senza versione locale qualunque cloud e piu nuova; senza cloud mai', () => {
  assert(piuNuova('2026-09-06T18:00:00.000Z', '2026-09-06T17:17:20.879Z'));
  assert(!piuNuova('2026-09-06T17:17:20.879Z', '2026-09-06T17:17:20.879Z'));
  assert(!piuNuova('2026-09-05T23:00:00.000Z', '2026-09-06T17:17:20.879Z'));
  assert(piuNuova('2026-09-06T18:00:00.000Z', null));
  assert(!piuNuova(null, '2026-09-06T17:17:20.879Z'));
  assert(!piuNuova(null, null));
});

Deno.test('si aggiorna: scarica in nuovo/, controlla le impronte, compila, cambia src e pagina tenendo i vecchi accanto', async () => {
  const dir = cartella('2026-09-06T17:17:20.879Z');
  const p = await pacchettoFinto('2026-09-06T18:00:00.000Z', { 'src/pos-locale/main.ts': 'nuovo', 'src/pos-locale/db.ts': 'db', 'pagina/index.html': 'pagina nuova', 'pagina/bacheca/index.html': 'bacheca' });
  let controllata = '';
  const esito = await aggiorna({ dir, cloud: cloud(p.fetch), controlla: (d) => { controllata = d; return Promise.resolve(true); } });
  assertEquals(esito, { esito: 'aggiornato', versione: '2026-09-06T18:00:00.000Z' });
  assertEquals(controllata, `${dir}/nuovo`, 'si compila la cartella nuova, prima del cambio');
  assertEquals(leggi(`${dir}/src/pos-locale/main.ts`), 'nuovo');
  assertEquals(leggi(`${dir}/src/pos-locale/db.ts`), 'db');
  assertEquals(leggi(`${dir}/pagina/bacheca/index.html`), 'bacheca');
  assertEquals(leggi(`${dir}/src.vecchio/pos-locale/main.ts`), 'vecchio');
  assertEquals(leggi(`${dir}/pagina.vecchio/index.html`), 'pagina vecchia');
  assertEquals(versioneLocale(dir), '2026-09-06T18:00:00.000Z');
  assertEquals((leggi(`${dir}/VERSIONE.vecchio.txt`) ?? '').split('\n')[0], '2026-09-06T17:17:20.879Z');
  assertEquals(leggi(`${dir}/config.json`), '{"hotelKey":"K"}', 'config.json non si tocca');
  assertEquals(leggi(`${dir}/nuovo/src/pos-locale/main.ts`), null, 'nuovo/ sparisce');
  assert(p.chiamate.every((u) => u.startsWith('https://cloud/pos?a=pacchetto')), 'solo le due azioni del pacchetto');
  Deno.removeSync(dir, { recursive: true });
});

Deno.test('stessa versione, o cloud senza pacchetto: niente da fare, una chiamata sola', async () => {
  const dir = cartella('2026-09-06T18:00:00.000Z');
  const p = await pacchettoFinto('2026-09-06T18:00:00.000Z', { 'src/pos-locale/main.ts': 'nuovo', 'pagina/index.html': 'x' });
  assertEquals(await aggiorna({ dir, cloud: cloud(p.fetch), controlla: compilaSempre }), { esito: 'niente', versione_cloud: '2026-09-06T18:00:00.000Z' });
  assertEquals(p.chiamate.length, 1);
  const vuoto = await pacchettoFinto(null, {});
  assertEquals(await aggiorna({ dir, cloud: cloud(vuoto.fetch), controlla: compilaSempre }), { esito: 'niente', versione_cloud: null });
  assertEquals(leggi(`${dir}/src/pos-locale/main.ts`), 'vecchio');
  Deno.removeSync(dir, { recursive: true });
});

Deno.test('impronta sbagliata: si scarta tutto e si resta come si e', async () => {
  const dir = cartella('2026-09-06T17:00:00.000Z');
  const p = await pacchettoFinto('2026-09-06T18:00:00.000Z', { 'src/pos-locale/main.ts': 'nuovo', 'pagina/index.html': 'x' });
  p.contenuti['pagina/index.html'].contenuto = b64('manomesso');
  const esito = await aggiorna({ dir, cloud: cloud(p.fetch), controlla: compilaSempre });
  assertEquals(esito, { esito: 'scartato', motivo: 'impronta sbagliata: pagina/index.html', versione: '2026-09-06T18:00:00.000Z' });
  assertEquals(leggi(`${dir}/src/pos-locale/main.ts`), 'vecchio');
  assertEquals(versioneLocale(dir), '2026-09-06T17:00:00.000Z');
  assertEquals(leggi(`${dir}/nuovo/src/pos-locale/main.ts`), null, 'nuovo/ pulita');
  Deno.removeSync(dir, { recursive: true });
});

Deno.test('server nuovo che non compila (o il controllo che scoppia), percorso fuori posto, pacchetto senza main.ts: scartati', async () => {
  const dir = cartella('2026-09-06T17:00:00.000Z');
  const p = await pacchettoFinto('2026-09-06T18:00:00.000Z', { 'src/pos-locale/main.ts': 'rotto', 'pagina/index.html': 'x' });
  assertEquals((await aggiorna({ dir, cloud: cloud(p.fetch), controlla: () => Promise.resolve(false) })).esito, 'scartato');
  assertEquals((await aggiorna({ dir, cloud: cloud(p.fetch), controlla: () => Promise.reject(new Error('niente permesso di eseguire')) })).esito, 'scartato');
  assertEquals(leggi(`${dir}/src/pos-locale/main.ts`), 'vecchio');
  assertEquals(leggi(`${dir}/nuovo/src/pos-locale/main.ts`), null, 'nuovo/ pulita');
  const brutto = await pacchettoFinto('2026-09-06T18:00:00.000Z', { 'src/pos-locale/main.ts': 'a', 'pagina/index.html': 'x', 'config.json': '{}' });
  assertEquals(await aggiorna({ dir, cloud: cloud(brutto.fetch), controlla: compilaSempre }), { esito: 'scartato', motivo: 'percorso non ammesso: config.json', versione: '2026-09-06T18:00:00.000Z' });
  assertEquals(brutto.chiamate.length, 1, 'non scarica niente');
  const senza = await pacchettoFinto('2026-09-06T18:00:00.000Z', { 'src/pos-locale/db.ts': 'a', 'pagina/index.html': 'x' });
  assertEquals((await aggiorna({ dir, cloud: cloud(senza.fetch), controlla: compilaSempre })).esito, 'scartato');
  Deno.removeSync(dir, { recursive: true });
});

Deno.test('cloud che non risponde o chiave sbagliata: scartato, senza toccare niente', async () => {
  const dir = cartella('2026-09-06T17:00:00.000Z');
  const p = await pacchettoFinto('2026-09-06T18:00:00.000Z', { 'src/pos-locale/main.ts': 'a', 'pagina/index.html': 'x' });
  assertEquals((await aggiorna({ dir, cloud: { ...cloud(p.fetch), hotelKey: 'sbagliata' }, controlla: compilaSempre })).esito, 'scartato');
  const giu = await aggiorna({ dir, cloud: cloud((() => Promise.reject(new TypeError('rete giu'))) as unknown as typeof fetch), controlla: compilaSempre });
  assertEquals(giu, { esito: 'scartato', motivo: 'rete giu', versione: null });
  assertEquals(leggi(`${dir}/src/pos-locale/main.ts`), 'vecchio');
  Deno.removeSync(dir, { recursive: true });
});

Deno.test('il codice di uscita «aggiornato» e 75, lo stesso che aspetta il supervisore', async () => {
  assertEquals(AGGIORNATO, 75);
  const supervisore = await import('./avvio.ts');
  assertEquals(supervisore.AGGIORNATO, 75);
});
