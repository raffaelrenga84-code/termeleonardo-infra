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
  assert(BACKOFFICE.includes('function mostraPdf(contenitore, url)') && BACKOFFICE.includes("anteprimaPdf(contenitore, url, 'Anteprima del buono')"), 'e lo disegna col canvas (pdf.js), iframe solo di ripiego');
  assert(BACKOFFICE.includes("from '/comune/anteprima-pdf.js'") && BACKOFFICE.includes('.pdfFrame{') && BACKOFFICE.includes('.pdfFrame.pdfTela{'), 'con le sue regole di stile');
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
  const repaint = risposta.indexOf("mostraPdf($('bAnteprima')");
  assert(repaint > controllo, 'e prima di riscrivere il pannello con #bAnteprima/#bScarica');
  assertEquals((risposta.match(/mio !== giroBuono/g) || []).length, 2,
    'il controllo c e anche nel ramo di errore (.catch), non solo in quello buono');
});

/* ============================================================
   E I PULSANTI? L'altra meta' dello stesso difetto, trovata dalla revisione
   finale (5-6 settembre 2026).

   Il numero di giro qui sopra difendeva il PANNELLO, ma «Stampa subito» e
   «Stampa l'anteprima» guardavano solo se urlBuonoMostrato fosse pieno — e
   quella variabile e' di modulo, non la azzera nessuno quando mostraFatto
   ridisegna. Aperto il buono A e poi il buono B dall'elenco, per tutto il
   volo della richiesta di B (e PER SEMPRE, se quella richiesta fallisce)
   urlBuonoMostrato tiene ancora il foglio di A: si stampava il buono di un
   altro cliente, col suo nome, la sua dedica e il suo codice spendibile.

   Il rimedio: l'URL e il giro a cui appartiene si scrivono INSIEME, e chi
   apre un PDF pretende di trovarci il proprio giro.
   ============================================================ */
Deno.test('stampare non apre il foglio di un altro buono: apriPdf pretende il proprio giro', () => {
  assert(BACKOFFICE.includes('let giroDelFoglio = 0;'), 'il giro del foglio che sta in urlBuonoMostrato');
  const apri = fra(BACKOFFICE, 'const apriPdf = () => {', 'pdfUrl(');
  assert(apri.includes('giroDelFoglio !== mio'),
    'apriPdf non confronta il giro del foglio con quello del proprio pannello');
  const guardia = apri.indexOf('giroDelFoglio !== mio');
  const apertura = apri.indexOf('apriPdfGuardato(');
  assert(guardia >= 0 && apertura > guardia, 'il controllo viene PRIMA di aprire qualunque cosa');
  assert(/return;/.test(apri.slice(guardia, apertura)), 'e chi non ha il proprio foglio esce senza aprire niente');
  /* i tre pulsanti che aprono un PDF gia' scaricato passano tutti di li' */
  assert(BACKOFFICE.includes("$('bStampa').onclick = apriPdf;")
    && BACKOFFICE.includes("$('bStampaBozza').onclick = apriPdf;"),
    'stampa e stampa-bozza passano per apriPdf, non per urlBuonoMostrato a mano');
  const scrittura = fra(BACKOFFICE, 'urlBuonoMostrato = url;', 'mostraPdf(');
  assert(scrittura.includes('giroDelFoglio = mio;'),
    'il giro si scrive INSIEME all URL: un foglio senza il suo giro e il difetto di prima');
});

/* Un <a> senza href e' un elemento con l'aria di un pulsante che non fa
   niente: #bScarica nasce cosi' (il PDF arriva dopo) e ci resta per sempre
   se la richiesta fallisce. Finche' l'indirizzo non c'e' si vede spento, e
   i clic non ci arrivano nemmeno. */
Deno.test('Scarica il PDF nasce spento e si accende solo quando il foglio e arrivato', () => {
  assert(BACKOFFICE.includes('id="bScarica" aria-disabled="true"'), 'il link nasce spento');
  assert(/a\.azione\[aria-disabled="true"\]\{/.test(BACKOFFICE), 'e ha la sua regola di stile');
  assert(BACKOFFICE.includes('pointer-events:none'), 'spento vuol dire che il clic non fa nemmeno il giro');
  const acceso = fra(BACKOFFICE, 'urlBuonoMostrato = url;', '}).catch(');
  assert(acceso.includes("$('bScarica').href = url") && acceso.includes("removeAttribute('aria-disabled')"),
    'si accende insieme all indirizzo, non prima');
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

/* Il server risponde `allegato: !!pdf` APPOSTA: l'email parte anche quando
   il foglio non esce, e la reception deve sapere che al cliente e' arrivata
   una lettera senza il suo buono. Fino alla revisione finale (5-6 settembre
   2026) la pagina buttava via quel valore e scriveva «con il buono in PDF
   allegato» sempre: diceva a chi sta al banco il contrario della verita'. */
Deno.test('se l email e partita senza il PDF, il back office lo dice invece di mentire', () => {
  const per = fra(BACKOFFICE, 'const perEmail = async (bottone, dest, chi)', 'if ($(\'bMailDest\'))');
  assert(per.includes("const j = await chiama('?a=manda'"), 'la risposta si legge, non si butta via');
  assert(per.includes('if (j.allegato)'), 'e si guarda `allegato`');
  const senza = per.slice(per.indexOf('} else {'));
  assert(senza.includes('SENZA il buono in PDF'), 'il caso senza foglio ha il suo messaggio');
  assert(senza.includes('class="errore"'), 'e si vede che e diverso: non passa per l esito di sempre');
  assertEquals((per.match(/con il buono in PDF allegato\./g) || []).length, 1,
    'il messaggio con l allegato vale solo per il ramo in cui l allegato c e davvero');
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
  assertEquals(STAMPA.split('a=pdf&codice=').length - 1, 2, 'due volte: il link del pulsante e la fetch');
  assert(STAMPA.includes('class="azione"') && STAMPA.includes('rel="noopener"'), 'il pulsante e un link');
  assert(STAMPA.includes("anteprimaPdf($('telaio'), url, t.titolo)") && STAMPA.includes('.pdfFrame{'), 'e sotto l anteprima, disegnata col canvas');
  assert(!STAMPA.includes('window.print'), 'a stampare ci pensa il lettore di PDF del telefono o del computer');
  assert(!STAMPA.includes('adattaScala'), 'niente piu foglio da rimpicciolire a mano');
});

/* ============================================================
   IL 429 NON DEVE FINIRE DENTRO LA CORNICE DEL BUONO.

   Il difetto (revisione finale, 5-6 settembre 2026): l'iframe puntava
   dritto a ?a=pdf&codice= e nessuno guardava com'era andata. Un 429 (il
   freno per IP, che sul wifi dell'hotel scatta anche per colpa di
   qualcun altro) o un 404 si vedevano come il JSON crudo del server dentro
   il telaio del buono, sotto un pulsante che dice «Stampa il tuo buono», a
   un ospite che quel buono l'ha pagato. Adesso il foglio si scarica con una
   fetch: se non arriva, al suo posto va t.erroreRete, che esiste gia' nelle
   quattro lingue e dice anche come raggiungerci.
   ============================================================ */
Deno.test('se il PDF non arriva, la pagina di stampa mostra il suo errore e non il JSON del server', () => {
  const c = fra(STAMPA, 'async function carica()', '\ncarica();');
  assert(c.includes("await fetch(FUNZIONE + '?a=pdf&codice='"), 'il PDF si chiede con una fetch');
  assert(/if \(!r\.ok\) throw new Error/.test(c.slice(c.indexOf("'?a=pdf&codice='"))),
    'e una risposta storta non diventa il contenuto della cornice');
  assert(c.includes('URL.createObjectURL('), 'quello buono si mostra come blob');
  assert(c.includes('t.erroreRete'), 'e quello storto lascia il posto al messaggio nella lingua dell ospite');
  const telaio = c.slice(c.indexOf("$('telaio')"));
  assert(telaio.indexOf('t.erroreRete') > 0, 'il messaggio finisce proprio nel telaio, non altrove');
  assert(!/<iframe class="pdfFrame" src="\$\{FUNZIONE\}/.test(STAMPA),
    'l iframe non punta piu dritto alla funzione: quella era la strada del JSON in cornice');
  /* il pulsante sopra resta il link diretto: e' anche il modo con cui dal
     telefono si salva o si condivide il PDF, e vale pure se la fetch qui
     dentro e' fallita per un inciampo momentaneo */
  assert(/<a class="azione" href="\$\{FUNZIONE\}\?a=pdf&codice=/.test(STAMPA),
    'il pulsante resta il link diretto al PDF');
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
  assert(REGALA.includes("anteprimaPdf($('telaio'), url, t.anteprima)"), "l'anteprima e' il PDF disegnato col canvas (su Android l'iframe non mostrava niente)");
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

/* ============================================================
   IL DIFETTO. «importo libero» col campo vuoto (ha solo un placeholder,
   quindi e' esattamente lo stato nell'istante in cui l'ospite passa a
   questa scelta) o fuori dai 25-1.000 € produce stato().descrizione === ''.
   La pagina chiedeva comunque il PDF al server, che disegnava un buono con
   la casella del servizio vuota, un separatore che non separa niente e
   "Valido fino al —": un foglio che sembra difettoso, non uno semplicemente
   non ancora scelto (la proprieta', 6 settembre 2026). ============================================================ */

Deno.test('quando non c e niente da disegnare lo dice nelle quattro lingue, invece di un buono vuoto', () => {
  const blocchi = lingueDiT(REGALA);
  for (const l of ['it', 'de', 'en', 'fr']) {
    assert(blocchi[l].includes('anteprimaVuota:'), `manca in ${l}`);
  }
  for (const testo of [
    'Scelga il regalo o scriva',
    'Wählen Sie das Geschenk oder geben Sie den Betrag ein',
    'Choose the gift or enter the amount: the voucher you will receive appears here.',
    /* il testo francese in regala/index.html scrive l'apostrofo come ’
       (stessa scelta gia' fatta per altre frasi francesi della pagina):
       il sorgente non contiene il carattere tipografico, quindi qui si
       controlla solo la parte senza apostrofo, come gia' fa il test qui
       sopra per il tedesco (verfügbar) */
    'Choisissez le cadeau ou saisissez le montant',
  ]) assertStringIncludes(REGALA, testo);
  assert(REGALA.includes('t.anteprimaVuota'), 'e il messaggio finisce nel telaio dell anteprima');
});

Deno.test('quando non c e niente da disegnare la pagina di acquisto non chiede il PDF al server', () => {
  const chiesta = fra(REGALA, 'const chiediAnteprima', '\n  };');
  const controllo = chiesta.indexOf('if (!b.descrizione)');
  assert(controllo >= 0, 'chiediAnteprima deve controllare se c e qualcosa da disegnare');
  const chiamataServer = chiesta.indexOf('fetch(FUNZIONE');
  assert(chiamataServer >= 0 && controllo < chiamataServer,
    'il controllo della descrizione vuota viene prima della fetch, non dopo');
  const usoAvviso = chiesta.indexOf('t.anteprimaVuota', controllo);
  assert(usoAvviso >= 0 && usoAvviso < chiamataServer, 'il caso vuoto scrive l avviso, non chiama il server');
  const revoca = chiesta.indexOf('URL.revokeObjectURL(urlPdf)', controllo);
  assert(revoca >= 0 && revoca < chiamataServer,
    'anche nel caso vuoto si revoca l anteprima precedente, non resta un PDF vecchio in memoria');
});

/* ============================================================
   IL DIFETTO. chiediAnteprima() annullava il timer in attesa ma non la
   richiesta gia' partita: due POST possono rispondere in un ordine
   qualunque, e se quella per lo stato piu' vecchio arriva DOPO quella per
   lo stato piu' nuovo, il cliente vede un'anteprima che non corrisponde
   piu' a quello che ha scelto. Stesso difetto e stessa cura di giroBuono
   nel back office (test qui sopra, "due buoni aperti di fila non si
   rubano l anteprima"): un contatore di modulo, non un booleano. ============================================================ */

Deno.test('una risposta lenta dell anteprima non ne sovrascrive una piu nuova: chiediAnteprima ha un numero di giro', () => {
  assert(REGALA.includes('let giroAnteprima = 0;'), 'un contatore di modulo, non per chiamata');
  assert(REGALA.includes('const mio = ++giroAnteprima;'), 'ogni chiamata a chiediAnteprima prende il proprio numero');
  const chiesta = fra(REGALA, 'const chiediAnteprima', '\n  };');
  assertEquals((chiesta.match(/mio !== giroAnteprima/g) || []).length, 2,
    'il controllo c e sia nel ramo buono sia nel ramo di errore (.catch)');
  const primoControllo = chiesta.indexOf('mio !== giroAnteprima');
  assert(primoControllo >= 0);
  const revocaPropria = chiesta.indexOf('URL.revokeObjectURL(url)', primoControllo);
  assert(revocaPropria > primoControllo, 'chi ha perso il giro revoca il blob appena ricevuto: non e di nessuno');
  const revocaPrecedente = chiesta.indexOf('if (urlPdf) URL.revokeObjectURL(urlPdf);', primoControllo);
  assert(revocaPrecedente > revocaPropria, 'il controllo del giro viene prima della revoca del foglio gia mostrato');
  const repaint = chiesta.indexOf('anteprimaPdf(', revocaPrecedente);
  assert(repaint > revocaPrecedente, 'e prima di riscrivere il telaio con il nuovo PDF');
});

/* ============================================================
   IL DIFETTO. stato() non produce mai il campo `sottotitolo` (questa
   pagina non ha un campo per scriverlo, a differenza del back office): era
   rimasto nell'elenco CAMPI_PDF di un giro di modifiche precedente, morto,
   perche' `if (b[k] !== undefined)` lo scarta sempre. ============================================================ */

Deno.test('CAMPI_PDF non manda piu sottotitolo: stato() non lo produce mai in questa pagina', () => {
  const m = REGALA.match(/const CAMPI_PDF = \[([\s\S]*?)\];/);
  assert(m, "CAMPI_PDF non trovato in regala/index.html: la pagina e' cambiata, aggiornare questo test");
  const campi = m![1];
  assert(!campi.includes("'sottotitolo'"), 'sottotitolo e rimasto nell elenco ma stato() non lo produce mai');
  for (const atteso of ['tipo', 'voce_id', 'descrizione', 'valore', 'lingua',
    'destinatario', 'acquirente', 'dedica', 'scade_il']) {
    assert(campi.includes(`'${atteso}'`), `manca '${atteso}' in CAMPI_PDF`);
  }
});
