/* ============================================================
   pagina.test.ts - la pagina del POS servita dal PC del Bistrot.

   I palmari la aprono da http://IP:8080/pos: niente certificati da
   installare. Si servono SOLO i file della pagina, mai altro del disco.
   ============================================================ */
import { assertEquals } from 'jsr:@std/assert';
import { fileDellaPagina } from './pagina.ts';

Deno.test('la pagina del POS si serve da qui: solo i suoi file, niente altro', () => {
  assertEquals(fileDellaPagina('/pos'), { file: 'index.html', tipo: 'text/html; charset=utf-8' });
  assertEquals(fileDellaPagina('/pos/'), { file: 'index.html', tipo: 'text/html; charset=utf-8' });
  assertEquals(fileDellaPagina('/')?.file, 'index.html');
  assertEquals(fileDellaPagina('/pos/stato.js')?.tipo, 'text/javascript; charset=utf-8');
  assertEquals(fileDellaPagina('/pos/pianta.js')?.file, 'pianta.js');
  assertEquals(fileDellaPagina('/pos/manifest.webmanifest')?.tipo, 'application/manifest+json');
  assertEquals(fileDellaPagina('/ingresso/icona-192.png'), { file: 'ingresso/icona-192.png', tipo: 'image/png' });
  /* il monitor cucina (6 settembre 2026): stessa pagina, altro punto di ingresso */
  assertEquals(fileDellaPagina('/cucina'), { file: 'cucina/index.html', tipo: 'text/html; charset=utf-8' });
  assertEquals(fileDellaPagina('/cucina/'), { file: 'cucina/index.html', tipo: 'text/html; charset=utf-8' });
  assertEquals(fileDellaPagina('/cucina/schermo.js')?.file, 'cucina/schermo.js');
  /* niente giri per le cartelle, niente config.json */
  assertEquals(fileDellaPagina('/pos/../config.json'), null);
  assertEquals(fileDellaPagina('/config.json'), null);
  assertEquals(fileDellaPagina('/pos/altro.js'), null);
  assertEquals(fileDellaPagina(''), null);
});
