/* ============================================================
   pdf-pagine.test.ts — le tre pagine del buono mostrano il PDF del server.

   IL DIFETTO. Il buono esisteva in tre rese diverse: buonoHTML() per le
   anteprime a schermo, buonoStampaHTML() per il foglio A4, e la copia
   dentro email-buono.ts per l'email. Tre disegni della stessa cosa, e
   quello che il cliente vedeva nell'anteprima non era quello che gli
   arrivava — «se invece uso il pulsante copia e incolla viene un'immagine
   in miniatura» (la proprieta', 5 settembre 2026). Da qui in avanti il
   buono lo disegna una volta sola il server, in PDF sulla carta intestata:
   le pagine lo chiedono e lo mostrano in un iframe, non disegnano piu'
   niente.

   COME. Le tre pagine non sono eseguibili da Deno (moduli inline, DOM,
   fetch): si guarda il sorgente, come fanno gia' schede.test.ts e
   serale-backoffice.test.ts. Il presidio non e' sull'aspetto del PDF —
   quello vive in pdf-buono.test.ts, dalla parte del server — ma sul fatto
   che le pagine non tornino a disegnarselo da sole.
   ============================================================ */
import { assert, assertEquals, assertStringIncludes } from 'jsr:@std/assert';

const BACKOFFICE = Deno.readTextFileSync(new URL('./index.html', import.meta.url));
const STAMPA = Deno.readTextFileSync(new URL('./stampa/index.html', import.meta.url));
const REGALA = Deno.readTextFileSync(new URL('./regala/index.html', import.meta.url));

const TRE: [string, string][] = [
  ['pagine/buoni/index.html', BACKOFFICE],
  ['pagine/buoni/stampa/index.html', STAMPA],
  ['pagine/buoni/regala/index.html', REGALA],
];

/* il pezzo di sorgente fra due segni, per non far cadere un controllo su
   una riga qualunque della pagina che si chiama nello stesso modo */
function fra(sorgente: string, da: string, a: string): string {
  const i = sorgente.indexOf(da);
  assert(i >= 0, `"${da}" non si trova piu' nella pagina: aggiornare questo test`);
  const f = sorgente.indexOf(a, i + da.length);
  return sorgente.slice(i, f < 0 ? sorgente.length : f);
}

/* i quattro blocchi di lingua della tabella T di una pagina pubblica */
function lingueDiT(sorgente: string): Record<string, string> {
  const tabella = fra(sorgente, '\nconst T = {', '\n};');
  const lingue = ['it', 'de', 'en', 'fr'];
  const blocchi: Record<string, string> = {};
  for (let k = 0; k < lingue.length; k++) {
    const i = tabella.indexOf('\n  ' + lingue[k] + ':{');
    assert(i >= 0, `la tabella T non ha piu' il blocco ${lingue[k]}`);
    const fine = k + 1 < lingue.length ? tabella.indexOf('\n  ' + lingue[k + 1] + ':{') : tabella.length;
    blocchi[lingue[k]] = tabella.slice(i, fine);
  }
  return blocchi;
}

Deno.test('nessuna delle tre pagine disegna piu il buono in HTML', () => {
  for (const [nome, p] of TRE) {
    assert(!p.includes('buonoHTML('), `${nome} chiama ancora buonoHTML()`);
    assert(!p.includes('buonoStampaHTML('), `${nome} chiama ancora buonoStampaHTML()`);
  }
});

Deno.test('nessuna delle tre pagine carica piu il foglio di stile del buono a schermo', () => {
  for (const [nome, p] of TRE) {
    assert(!p.includes('stampa.css'), `${nome} linka ancora stampa.css`);
  }
});

Deno.test('il back office chiede il PDF al server: per numero il buono, in bozza l anteprima del modulo', () => {
  assert(BACKOFFICE.includes('async function pdfUrl(qs, corpo)'), 'il solo posto da cui esce un PDF');
  assert(BACKOFFICE.includes('?a=pdf&numero='), 'il buono gia emesso si chiede per numero');
  assert(BACKOFFICE.includes("pdfUrl('?a=pdf', buonoProvvisorio())"), 'il modulo in compilazione chiede la bozza');
  assert(BACKOFFICE.includes('function iframePdf(contenitore, url)'), 'e lo mostra in un iframe');
  assert(BACKOFFICE.includes('class="pdfFrame"') && BACKOFFICE.includes('.pdfFrame{'), 'con la sua regola di stile');
  assert(BACKOFFICE.includes('id="bAnteprima"'), 'il pannello del buono ha il posto per l anteprima');
  assert(BACKOFFICE.includes('download="Buono-Regalo-'), 'e il PDF si scarica col nome del buono');
});

Deno.test('l anteprima del modulo non si ridisegna a ogni tasto: 900 ms dopo l ultima modifica', () => {
  const ant = fra(BACKOFFICE, 'function aggiornaAnteprima()', "$('antStampa')");
  assert(ant.includes('900'), 'il ritardo');
  assert(ant.includes('clearTimeout('), 'un solo timer, non uno per tasto');
  assert(ant.includes('URL.revokeObjectURL('), 'il PDF di prima non resta in memoria');
});

Deno.test('antStampa non apre la finestra senza controllare se il browser l ha bloccata', () => {
  const ant = fra(BACKOFFICE, "$('antStampa').onclick", 'const conAnteprima');
  assert(!ant.includes('window.open('), 'deve passare per apriPdfGuardato, non aprire la finestra per conto suo');
  assert(ant.includes('apriPdfGuardato('), 'lo stesso percorso guardato di apriPdf (bStampa, bStampaBozza)');
});

Deno.test('due buoni aperti di fila non si rubano l anteprima: mostraFatto ha un numero di giro', () => {
  assert(BACKOFFICE.includes('let giroBuono = 0;'), 'un contatore di modulo, non per chiamata');
  assert(BACKOFFICE.includes('const mio = ++giroBuono;'), 'ogni chiamata a mostraFatto prende il proprio numero');
  const risposta = fra(BACKOFFICE, "pdfUrl('?a=pdf&numero=", "if ($('bRipristina'))");
  const controllo = risposta.indexOf('mio !== giroBuono');
  assert(controllo >= 0, 'la risposta si confronta col giro corrente prima di fare qualunque cosa');
  const revocaPropria = risposta.indexOf('URL.revokeObjectURL(url)');
  assert(revocaPropria > controllo, 'chi ha perso il giro revoca il blob appena ricevuto: non e di nessuno');
  const revocaPrecedente = risposta.indexOf('URL.revokeObjectURL(urlBuonoMostrato)');
  assert(revocaPrecedente > controllo, 'il controllo del giro viene prima della revoca del foglio gia mostrato');
  const repaint = risposta.indexOf("iframePdf($('bAnteprima')");
  assert(repaint > controllo, 'e prima di riscrivere il pannello con #bAnteprima/#bScarica');
  assertEquals((risposta.match(/mio !== giroBuono/g) || []).length, 2,
    'il controllo c e anche nel ramo di errore (.catch), non solo in quello buono');
});

Deno.test('le email del buono le manda il server con il PDF allegato, non Outlook a mano', () => {
  assert(BACKOFFICE.includes("chiama('?a=manda'"), 'l invio e una chiamata al server');
  assert(BACKOFFICE.includes('JSON.stringify({ numero: b.numero, a: chi })'), 'il buono e a chi mandarlo');
  assert(BACKOFFICE.includes("perEmail($('bMailDest'), b.destinatario_email, 'destinatario')")
    && BACKOFFICE.includes("perEmail($('bMailAcq'), b.acquirente_email, 'acquirente')"),
    'i due pulsanti, ognuno col suo indirizzo');
  assert(BACKOFFICE.includes('con il buono in PDF allegato.'), 'e l esito lo dice');
  assert(!BACKOFFICE.includes('outlook.office.com'),
    'niente piu copia-e-incolla in Outlook: era da li che arrivava il buono in miniatura');
});

Deno.test('Copia copia il testo del buono col link al PDF, non un immagine', () => {
  const copia = fra(BACKOFFICE, "$('bCopia').onclick", '};');
  assert(copia.includes('writeText('), 'solo testo');
  assert(copia.includes('buonoTesto(b)'), 'il buono scritto');
  assert(copia.includes('/buoni/stampa?codice='), 'e il link da cui si apre il PDF');
  assert(!copia.includes('ClipboardItem'),
    'l HTML negli appunti e proprio quello che diventava un immagine in miniatura');
});

Deno.test('la pagina pubblica di stampa apre il PDF: il pulsante e l anteprima sotto', () => {
  assertEquals(STAMPA.split('a=pdf&codice=').length - 1, 2, 'due volte: il link e l iframe');
  assert(STAMPA.includes('class="azione"') && STAMPA.includes('rel="noopener"'), 'il pulsante e un link');
  assert(STAMPA.includes('class="pdfFrame"') && STAMPA.includes('.pdfFrame{'), 'e sotto l anteprima');
  assert(!STAMPA.includes('window.print'), 'a stampare ci pensa il lettore di PDF del telefono o del computer');
  assert(!STAMPA.includes('adattaScala'), 'niente piu foglio da rimpicciolire a mano');
});

Deno.test('le istruzioni della pagina di stampa dicono che si apre un PDF, nelle quattro lingue', () => {
  for (const testo of [
    'Si apre il PDF del buono: da lì lo stampa o lo salva. Da telefono può anche condividerlo.',
    'Es öffnet sich der Gutschein als PDF: von dort drucken oder speichern. Vom Smartphone aus können Sie ihn auch teilen.',
    'The voucher opens as a PDF: print or save it from there. On a phone you can also share it.',
    'Le bon s’ouvre en PDF : imprimez-le ou enregistrez-le depuis là. Depuis un téléphone, vous pouvez aussi le partager.',
  ]) assertStringIncludes(STAMPA, testo);
});

Deno.test('la pagina di acquisto chiede la bozza in PDF al server, senza credenziali', () => {
  const chiesta = fra(REGALA, 'const chiediAnteprima', '\n  };');
  assert(chiesta.includes("'?a=pdf'") && chiesta.includes("method: 'POST'"),
    'la bozza si chiede in POST, coi campi nel corpo');
  assert(!chiesta.includes('authorization'), 'e la pagina di acquisto e pubblica: nessun token da spendere');
  assert(chiesta.includes('}, 900);'), 'anche qui il PDF si chiede quando l ospite ha smesso di scrivere');
  assert(chiesta.includes('URL.revokeObjectURL('), 'il PDF di prima non resta in memoria');
  assert(REGALA.includes('class="pdfFrame"'), "l'anteprima e' l'iframe col PDF");
  assert(!REGALA.includes('transform: scale') && !REGALA.includes('scale(${'),
    'niente piu buono da 700px da rimpicciolire');
});

Deno.test('se il PDF non arriva, la pagina di acquisto lo dice nelle quattro lingue', () => {
  const blocchi = lingueDiT(REGALA);
  for (const l of ['it', 'de', 'en', 'fr']) {
    assert(blocchi[l].includes('anteprimaNonDisponibile:'), `manca in ${l}`);
  }
  for (const testo of [
    'disponibile in questo momento',
    'Die Vorschau ist im Moment nicht',
    'The preview is not available right now',
    'pas disponible pour le moment',
  ]) assertStringIncludes(REGALA, testo);
  assert(REGALA.includes('t.anteprimaNonDisponibile'), 'e il messaggio finisce nel telaio dell anteprima');
});
