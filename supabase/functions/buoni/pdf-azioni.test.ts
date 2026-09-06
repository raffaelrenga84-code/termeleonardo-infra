/* ============================================================
   pdf-azioni.test.ts — le azioni che servono il PDF del buono.

   «Il buono deve essere un PDF sulla carta intestata» (la proprieta',
   5 settembre 2026). Il foglio lo disegna pdf-buono.ts, provato per conto
   suo; qui si presidia il CONTORNO in index.ts, che nessun'altra prova
   guarda: dove stanno i tre rami di ?a=pdf rispetto al cancello (chi puo'
   chiederlo e con quale chiave), il freno per IP sui due pubblici, le
   intestazioni con cui il foglio esce dal server, e i due punti in cui il
   PDF finisce in allegato a un'email.

   Prove sul SORGENTE, come totem.test.ts: Deno.serve non si chiama da qui
   — servirebbero un database e una rete veri. Sono prove di posizione e di
   collegamento, e falliscono se qualcuno sposta un ramo dalla parte
   sbagliata del cancello o stacca un pezzo dall'altro.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';

const S = Deno.readTextFileSync(new URL('./index.ts', import.meta.url));

const CANCELLO = '/* ---------- da qui in poi serve la chiave ---------- */';
const iCancello = S.indexOf(CANCELLO);
const iPubblicoGet = S.indexOf("if (azione === 'pdf' && req.method === 'GET'");
const iBozza = S.indexOf("if (azione === 'pdf' && req.method === 'POST')");
const iPerNumero = S.indexOf("if (req.method === 'GET' && azione === 'pdf')");

Deno.test('il PDF del buono viene da pdf-buono.ts, non ridisegnato qui', () => {
  assert(/import \{[^}]*pdfBuono[^}]*\} from '\.\/pdf-buono\.ts';/.test(S), 'import di pdfBuono');
  assert(S.includes('nomeFilePdf'), 'il nome del file');
  assert(S.includes('fotoBanner()'), 'la fotografia in cima al foglio');
});

Deno.test('il PDF esce come PDF: content-type, nome del file e cache privata', () => {
  const i = S.indexOf('const rispostaPdf = ');
  assert(i > 0, 'rispostaPdf');
  const r = S.slice(i, S.indexOf('\n  });', i));
  assert(r.includes("'content-type': 'application/pdf'"), r);
  assert(r.includes("'content-disposition': 'inline; filename=\""), r);
  /* privata: il foglio porta nome, dedica e codice spendibile di una
     persona sola, e non deve restare in nessuna cache condivisa */
  assert(r.includes("'cache-control': 'private"), r);
  assert(r.includes('...CORS'), 'le intestazioni CORS di sempre');
});

/* Il nome del file esce in content-disposition, e un browser lo legge da
   un'altra origine solo se glielo si lascia leggere: senza questa riga le
   pagine (Task 3) mostrerebbero «download.pdf». */
Deno.test('il CORS lascia leggere il nome del file alle pagine', () => {
  assert(S.includes("'Access-Control-Expose-Headers': 'content-disposition'"), 'CORS');
});

Deno.test('il PDF per codice è pubblico, sta dopo ?a=stampa e prima del cancello, con lo stesso freno', () => {
  assert(iPubblicoGet > 0, 'il ramo GET ?a=pdf&codice');
  assert(iPubblicoGet > S.indexOf("if (azione === 'stampa')"), 'dopo ?a=stampa');
  assert(iPubblicoGet < iCancello, 'prima del cancello: lo chiede chi ha il codice, non la reception');
  const r = S.slice(iPubblicoGet, iBozza);
  assert(r.includes('entroIlLimiteStampa(ipRichiesta(req))'), 'il freno per IP contro l’enumerazione dei codici');
  assert(r.includes('}, 429)'), 'e la risposta 429, come ?a=stampa');
  /* la stessa regola di ?a=stampa, non una seconda scritta qui: un buono
     non pagato, scaduto o riscosso non esce in PDF come se valesse */
  assert(r.includes('datiStampa(data)'), 'la regola di stampa.ts');
  assert(r.includes('if (!d.valido) return risposta(d, 404)'), 'il buono non valido non si disegna');
  assert(r.includes('rispostaPdf(') && r.includes('nomeFilePdf('), r);
  /* La porta pubblica non legge NEMMENO UNA COLONNA in piu' di quella che
     c'era: la select e' la stessa parola per parola, non una scritta a
     mano che col tempo diverge. E' un elenco di cosa esce, non di cosa si
     toglie (vedi il commento sopra ?a=stampa e stampa.ts). */
  const selezione = (dove: string) => (dove.match(/\.select\('([^']*)'\)/) || [])[1];
  assertEquals(
    selezione(r),
    selezione(S.slice(S.indexOf("if (azione === 'stampa')"), iPubblicoGet)),
    'la select del PDF non è più la stessa di ?a=stampa',
  );
});

Deno.test('la bozza è un POST pubblico: si disegna quello che arriva, ripulito, e non è mai un buono vero', () => {
  assert(iBozza > 0, 'il ramo POST ?a=pdf');
  assert(iBozza < iCancello, 'prima del cancello: il modulo del sito non ha la chiave');
  const r = S.slice(iBozza, S.indexOf("if (azione === 'qr')"));
  /* Un freno SUO, non quello della stampa: l'anteprima la chiede anche il
     back office una volta per pausa di battitura, dall'indirizzo di uscita
     dell'hotel, e finche' il contatore era condiviso comporre due buoni al
     banco poteva togliere all'ospite dietro lo stesso wifi la stampa del
     proprio buono pagato (revisione finale, 5-6 settembre 2026). */
  assert(r.includes('entroIlLimiteBozza(ipRichiesta(req))'), 'il freno anche qui: disegnare un PDF costa');
  assert(!r.includes('entroIlLimiteStampa('),
    'la bozza non deve piu consumare il budget con cui l ospite stampa il suo buono');
  for (const campo of ['descrizione', 'sottotitolo', 'destinatario', 'acquirente', 'dedica', 'voce_id']) {
    assert(r.includes(`${campo}:`) && r.includes(`testo(g.${campo}`), `${campo} ripulito con testo()`);
  }
  assert(r.includes('codice: null') && r.includes('numero: null') && r.includes("stato: 'attesa'"),
    'una bozza non porta mai un codice spendibile');
  /* la chiamata per intero, non un `true)` qualunque: quel controllo lo
     passava quasi ogni espressione del ramo (`nomeFilePdf(campi, true)`, un
     `includes(...)`), e sarebbe restato verde anche togliendo la filigrana
     al foglio pubblico — cioe' con una BOZZA che esce con l'aria di un buono
     pagato. */
  assert(r.includes('pdfDelBuono(campi, true)'), 'si disegna con la filigrana della bozza');
});

Deno.test('il PDF per numero sta dietro il cancello, prima del muro dei POST, e rispetta la vista del ruolo', () => {
  assert(iPerNumero > 0, 'il ramo GET ?a=pdf&numero');
  assert(iPerNumero > iCancello, 'dietro il cancello: il numero non è una chiave pubblica');
  assert(iPerNumero < S.indexOf("if (req.method !== 'POST') return risposta"),
    'prima del 405: è un GET, come ?a=elenco');
  const r = S.slice(iPerNumero, S.indexOf("if (req.method !== 'POST') return risposta"));
  assert(r.includes('puoVedere('), 'la spa non stampa i buoni che non vede');
  assert(r.includes("}, 403)") && r.includes('}, 404)'), 'non autorizzato e non trovato');
  assert(r.includes("stato === 'attesa'"), 'un buono non ancora pagato esce come bozza');
});

Deno.test('?a=manda spedisce a uno solo, e solo un buono pagato, e registra la consegna', () => {
  const i = S.indexOf("if (azione === 'manda')");
  assert(i > 0, 'il ramo ?a=manda');
  assert(i > S.indexOf("if (azione === 'crea')"), 'dopo ?a=crea, fra le azioni del back office');
  const r = S.slice(i, S.indexOf("if (azione === 'pagato')"));
  assert(r.includes("a !== 'acquirente' && a !== 'destinatario'"),
    'si manda a uno dei due, non a un indirizzo qualunque');
  assert(r.includes('puoVedere('), 'la vista del ruolo vale anche qui');
  assert(r.includes("'si manda solo un buono pagato'") && r.includes('}, 409)'), 'niente email di un buono in attesa');
  assert(r.includes("'nessun indirizzo per '"), 'senza indirizzo si dice quello, non «non è partita»');
  assert(r.includes('inviaBuonoA('), 'l’invio a uno solo, da email-buono.ts');
  assert(r.includes('consegna: statoConsegna(nuoviEsiti)') && r.includes('consegna_il:')
    && r.includes('consegna_esiti: nuoviEsiti'),
    'la consegna si registra: senza, la reception non sa che è ripartita');
  /* Il difetto (revisione finale, 5-6 settembre 2026): qui c'era
     `consegna: 'inviato'` scritto a mano, mentre negli esiti si aggiornava
     la sola chiave mandata. Rimandare all'acquirente un buono la cui email
     al destinatario era fallita spegneva l'avviso «Il cliente non ha
     ricevuto questo buono» per una consegna ancora fallita. Lo stato lo
     decide la somma degli esiti, come in consegnaERegistra. */
  assert(!r.includes("consegna: 'inviato'"),
    'lo stato non si scrive a mano: lo calcola statoConsegna sugli esiti messi insieme');
  assert(r.includes("const nuoviEsiti = { ...(riga.consegna_esiti ?? {}), [a]: true }"),
    'gli esiti si fondono con quelli già registrati, non si sostituiscono');
});

/* La pagina legge `errore` da ogni risposta storta (`chiama` in
   pagine/buoni/index.html): senza quella chiave, l'operatore che vede
   fallire l'invio legge «errore 500» e non sa ne' cosa e' successo ne' cosa
   fare. E `allegato` esiste apposta perche' la reception sappia se al
   cliente e' arrivata la lettera SENZA il foglio. */
Deno.test('?a=manda dice perché non è partita, e se il buono è partito senza il PDF', () => {
  const i = S.indexOf("if (azione === 'manda')");
  const r = S.slice(i, S.indexOf("if (azione === 'pagato')"));
  assert(r.includes('allegato: !!pdf'), 'la reception deve sapere se il PDF era attaccato');
  const cinquecento = r.slice(r.indexOf('if (!r.ok) return risposta('));
  assert(r.includes('if (!r.ok) return risposta('), 'il ramo del 500 è scritto a parte');
  assert(cinquecento.includes('errore:'), 'il 500 porta un `errore`, come ogni altra risposta storta');
  assert(/non è partita/.test(cinquecento), 'e dice che l’email non è partita');
  assert(cinquecento.includes('allegato: !!pdf'), 'anche quando fallisce si dice del foglio');
});

/* Il foglio non deve mai fermare un'emissione: se pdfBuono lancia (la
   carta intestata, la fotografia, un carattere fuori WinAnsi in una
   dedica) l'email parte lo stesso, senza allegato. */
Deno.test('l’invio automatico allega il PDF, e se il PDF non esce l’email parte comunque', () => {
  const i = S.indexOf('async function consegnaERegistra(');
  assert(i > 0, 'consegnaERegistra');
  const r = S.slice(i, S.indexOf('\n}', S.indexOf('return stato;', i)));
  assert(r.includes('pdfDelBuono(buono, false)'), 'il foglio si genera prima di spedire');
  assert(r.includes('inviaBuonoEmesso(buono, pdf)'), 'e si passa all’email');
  assert(r.includes('console.error') && r.includes('pdf = null'),
    'se il foglio non esce si scrive nel registro e si spedisce senza');
});
