/* ============================================================
   pagina.ts - quali file della pagina del POS serve il PC del Bistrot.

   I palmari aprono la pagina da http://IP:8080/pos, dal PC stesso: cosi'
   parlano col server locale senza certificati da installare (una pagina
   in https non puo' chiamare un PC della LAN in http; una in http si').
   Si servono SOLO questi file: niente giri per le cartelle, mai il
   config.json con la chiave hotel. Puro: lo prova pagina.test.ts.
   ============================================================ */
const FILE: Record<string, string> = {
  '/pos/stato.js': 'stato.js',
  '/pos/server.js': 'server.js',
  '/pos/pianta.js': 'pianta.js',
  '/pos/sw.js': 'sw.js',
  '/pos/manifest.webmanifest': 'manifest.webmanifest',
  '/ingresso/icona-192.png': 'ingresso/icona-192.png',
  '/ingresso/icona-512.png': 'ingresso/icona-512.png',
};

const tipoDi = (file: string): string =>
  file.endsWith('.js') ? 'text/javascript; charset=utf-8'
  : file.endsWith('.png') ? 'image/png'
  : file.endsWith('.webmanifest') ? 'application/manifest+json'
  : 'application/octet-stream';

/** Il file da servire per un percorso, o null se non e' della pagina. */
export function fileDellaPagina(pathname: string): { file: string; tipo: string } | null {
  const p = String(pathname ?? '').replace(/\/+$/, '');
  if (p === '' && String(pathname) === '/') return { file: 'index.html', tipo: 'text/html; charset=utf-8' };
  if (p === '/pos') return { file: 'index.html', tipo: 'text/html; charset=utf-8' };
  const file = FILE[p];
  return file ? { file, tipo: tipoDi(file) } : null;
}
