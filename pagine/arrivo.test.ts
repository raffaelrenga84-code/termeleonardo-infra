/* ============================================================
   arrivo.test.ts — la pagina del check-in online.

   Non si esegue una pagina intera senza browser, ma alcune cose si possono
   provare cosi', e sono quelle che si rompono in silenzio:
   il copione dev'essere leggibile (un apice inverso chiuso male apre la
   pagina bianca), il luogo dev'essere un elenco e non una casella libera,
   la porta dev'essere quella nuova, e il cellulare non deve finire nel
   posto sbagliato del corpo.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';

const SORGENTE = Deno.readTextFileSync(new URL('index.html', import.meta.url));

Deno.test('il copione si legge senza errori di sintassi', () => {
  const m = SORGENTE.match(/<script type="module">([\s\S]*)<\/script>/);
  assert(m, 'lo <script type="module"> non si trova');
  const corpo = m![1].split('\n').filter((r) => !/^\s*import\s/.test(r)).join('\n');
  assert(corpo.length > 5000, `corpo di sole ${corpo.length} lettere: la prova gira a vuoto`);
  new Function(corpo);
});

/* Era una casella di testo da 40 caratteri, e l'ospite ci scriveva
   "Venezia": nessuna delle sue varianti e' una voce ATAM, e la reception
   doveva cercarla a mano fra 189. GIRO DI CORREZIONE 1: la prova originale
   passava anche solo cambiando <input type="text"> in <select> — restava
   verde con "trScalo" ancora vivo sotto un altro tag. Ora il campo non deve
   comparire affatto, col nome vecchio ne' col nuovo. */
Deno.test('il luogo del transfer e un elenco, non una casella libera', () => {
  assert(SORGENTE.includes('/comune/luoghi.js'), 'la pagina non importa i luoghi');
  assert(!SORGENTE.includes('trScalo'), 'il campo "trScalo" e ancora nel sorgente, sotto qualche forma');
});

Deno.test('la pagina manda al nuovo indirizzo', () => {
  assert(SORGENTE.includes('a=invia-arrivo'), 'la pagina scrive ancora su prepara-arrivo');
});

/* Le attenzioni si mandano come chiavi: il testo tradotto in back office
   andrebbe letto da chi aveva davanti un'altra lingua. E' la stessa scelta
   gia' presa per il desiderio dei fanghi. */
Deno.test('le attenzioni partono come chiavi, non come testo tradotto', () => {
  assert(/'culla'\s*,\s*'seggiolone'\s*,\s*'parcheggio'\s*,\s*'cane'/.test(SORGENTE),
    'le chiavi delle attenzioni non si trovano nella pagina');
});

/* IL PUNTO IN CUI QUESTO COMPITO PUO' FALLIRE IN SILENZIO. Il validatore
   del transfer (supabase/functions/richieste/tipi.ts, validaTransfer) non
   legge "cell": un numero lasciato dentro transfer_dati sparisce senza
   errore, e la reception si ritrova un taxi da chiamare senza nessun
   numero — peggio di prima, perche' la vecchia email il numero lo
   stampava. index.ts (azione invia-arrivo) cerca il telefono in cima al
   corpo, esattamente come fa gia' il modulo transfer del sito. */
Deno.test('il cellulare per l autista finisce in telefono, non dentro transfer_dati', () => {
  assert(/telefono\s*:\s*v\(\s*['"]trCell['"]\s*\)/.test(SORGENTE),
    'il cellulare non parte come "telefono" in cima al corpo');
  assert(!/cell\s*:\s*v\(\s*['"]trCell['"]\s*\)/.test(SORGENTE),
    'il cellulare finisce ancora dentro transfer_dati.cell, dove il validatore lo ignora in silenzio');
});

/* La "verso" del transfer deve combaciare parola per parola con quello che
   accetta validaTransfer ('arrivo' o 'partenza', letterale): un'opzione con
   solo il testo tradotto ("L'arrivo", "Die Anreise"...) come valore
   manderebbe OGNI richiesta di transfer al rifiuto "indicare arrivo o
   partenza", in tutte e quattro le lingue. */
Deno.test('il tipo di transfer manda i valori del server, non il testo tradotto', () => {
  assert(/<select id="trTipo">[\s\S]{0,400}?\[\s*['"]arrivo['"]\s*,\s*['"]partenza['"]\s*\]/.test(SORGENTE),
    'le opzioni di trTipo non portano i valori letterali "arrivo"/"partenza"');
});

/* GIRO DI CORREZIONE 1: la prova originale accettava un trTipi di
   qualunque lunghezza. Il mapping e' posizionale — ['arrivo','partenza'][i]
   — quindi una terza voce aggiunta domani a trTipi uscirebbe con
   value="undefined": esattamente il difetto appena corretto sopra, di
   nuovo, e stavolta senza una prova rossa ad avvisare. */
Deno.test('il tipo di transfer ha sempre due voci, mai una lunghezza qualunque', () => {
  const liste = [...SORGENTE.matchAll(/trTipi\s*:\s*\[([^\]]*)\]/g)];
  assertEquals(liste.length, 4, `trovate ${liste.length} liste trTipi, servono 4 (una per lingua)`);
  for (const m of liste) {
    const voci = m[1].split(',').filter((s) => s.trim().length > 0);
    assertEquals(voci.length, 2,
      `trTipi con ${voci.length} voci invece di 2: il mapping su ['arrivo','partenza'] uscirebbe "undefined"`);
  }
});

/* Lo stato "gia inviato" (409) non e' un errore rosso: e' normale, capita a
   chi ricarica la pagina. Deve esistere in tutte e quattro le lingue, o
   chi ricarica in tedesco o francese vede "undefined". */
Deno.test('lo stato "gia inviato" parla tutte e quattro le lingue', () => {
  assert((SORGENTE.match(/giaInviatoT\s*:/g) || []).length === 4,
    'il titolo dello stato "gia inviato" non e in tutte e quattro le lingue');
  assert((SORGENTE.match(/perCambiare\s*:/g) || []).length === 4,
    'l invito a scrivere per cambiare qualcosa non e in tutte e quattro le lingue');
});

/* GIRO DI CORREZIONE 1: le etichette da sole non provano che il ramo
   esista. Chi cancella `if (r.status === 409) { giaInviato(...) }` e lascia
   le chiavi del dizionario intatte vedeva questa suite restare tutta
   verde, con il 409 finito silenziosamente nel riquadro d'errore rosso
   come un rifiuto qualunque. */
Deno.test('lo stato "gia inviato" e un ramo vero, non solo etichette rimaste in giro', () => {
  assert(/status\s*===\s*409[\s\S]{0,80}?giaInviato\(/.test(SORGENTE),
    'il 409 non chiama piu giaInviato(): lo stato "gia inviato" esiste solo nel dizionario, non nel codice');
});

/* La forma del corpo e' l'interfaccia di questo compito (vedi il brief):
   il token dentro il corpo — non nell'indirizzo — e transfer_dati/
   fattura_dati ANNIDATI, non stesi allo stesso livello degli altri campi.
   pezziDaArrivo() (supabase/functions/richieste/arrivo-invio.ts) legge
   proprio questa forma; un corpo stese sparirebbe dentro validaDati come
   un oggetto vuoto, e la sezione svanirebbe senza errore. */
Deno.test('il corpo ha il token dentro di se e transfer_dati/fattura_dati annidati', () => {
  const m = SORGENTE.match(/const corpo = \{[\s\S]*?\n  \};/);
  assert(m, 'non si trova la costruzione del corpo in invia()');
  const corpo = m[0];
  assert(/token\s*:\s*TOKEN/.test(corpo), 'il token non e dentro il corpo');
  assert(/transfer_dati\s*:\s*tr\s*\?\s*\{/.test(corpo), 'transfer_dati non e un oggetto annidato');
  assert(/fattura_dati\s*:\s*fatt\s*\?\s*\{/.test(corpo), 'fattura_dati non e un oggetto annidato');
});

/* GIRO DI CORREZIONE 1, punto 1. Senza mandare "collettivo" il validatore
   lo risolve a false: ogni transfer nasce "auto privata" e quel dettaglio
   finisce cosi' com'e' nell'email di conferma, senza che l'ospite abbia
   mai visto l'alternativa (su Venezia aeroporto, entro tre passeggeri)
   piu' economica.

   GIRO DI CORREZIONE 2: la prova qui sotto controllava solo che la parola
   "collettivo" comparisse — sarebbe passata anche con `collettivo: false`
   scritto a mano. Ora pretende che il valore venga da trServizio (non un
   letterale fisso) e che transfer_dati non lo sovrascriva con true/false. */
Deno.test('collettivo riflette davvero la scelta del servizio, non un valore fisso', () => {
  assert(/const collettivo\s*=\s*v\(\s*['"]trServizio['"]\s*\)\s*===\s*['"]1['"]/.test(SORGENTE),
    'collettivo non e calcolato dal campo trServizio: potrebbe essere un valore fisso');
  const m = SORGENTE.match(/transfer_dati:\s*tr\s*\?\s*\{([\s\S]*?)\}\s*:\s*null/);
  assert(m, 'non si trova transfer_dati nel corpo');
  /* "(?<!ritorno_)" esclude ritorno_collettivo: questa prova riguarda solo
     il campo "collettivo", non il suo omonimo del ritorno (che ha la sua
     prova a parte, piu' sotto) */
  assert(/(?<!ritorno_)\bcollettivo\b\s*(,|:\s*collettivo\b)/.test(m[1]),
    'transfer_dati non manda la variabile collettivo calcolata sopra');
  assert(!/(?<!ritorno_)\bcollettivo\b\s*:\s*(true|false)\b/.test(m[1]),
    'collettivo e scritto come true/false fisso dentro transfer_dati, non calcolato');
  assert((SORGENTE.match(/trServizio\s*:/g) || []).length === 4,
    'l etichetta del servizio (privata/condivisa) non e in tutte e quattro le lingue');
});

/* La navetta condivisa NON e' un'opzione sempre valida: navetta.js mette
   quattro condizioni (solo Venezia aeroporto, al massimo tre passeggeri,
   corsa fra le 08:00 e le 20:00, ventiquattro ore di preavviso) e
   validaTransfer non ne controlla nessuna — si fida del corpo. Una select
   sempre visibile lascerebbe scegliere "condivisa" per Treviso in cinque
   alle sei del mattino, e la conferma scritta all'ospite direbbe una cosa
   falsa: lo stesso difetto della correzione precedente, girato al
   contrario. */
Deno.test('la scelta del servizio compare solo quando navetta() la permette, e si ricalcola', () => {
  assert(/id="trBoxServizio"[^>]*style="display:\s*none/.test(SORGENTE),
    'il blocco del servizio non parte nascosto');
  assert(/from ['"]\/comune\/navetta\.js['"]/.test(SORGENTE),
    'la pagina non importa la regola della navetta da /comune/navetta.js');
  const m = SORGENTE.match(/function aggiornaServizioTr\(\)\{([\s\S]*?)\n\}/);
  assert(m, 'aggiornaServizioTr() non si trova per intero');
  const corpoFn = m[1];
  assert(/navetta\(\{/.test(corpoFn), 'aggiornaServizioTr non chiama navetta()');
  assert(/trLuogo/.test(corpoFn) && /trPax/.test(corpoFn) && /trQuando/.test(corpoFn)
    && /trOra/.test(corpoFn) && /trTipo/.test(corpoFn),
    'aggiornaServizioTr non guarda tutti e cinque i campi da cui dipende navetta()');
  /* GIRO DI CORREZIONE 3: la prova non collegava mai la VISIBILITA' al
     risultato di navetta() — sostituendo l'assegnazione condizionale con
     `box.style.display = 'block'` fisso, tutte le prove restavano verdi e
     il menu tornava sempre visibile (il punto 1 del giro precedente, di
     nuovo). Ora pretende l'assegnazione condizionata sul risultato `n`. */
  assert(/box\.style\.display\s*=\s*n\s*\?\s*['"]block['"]\s*:\s*['"]none['"]/.test(corpoFn),
    'la visibilita del blocco non segue piu il risultato di navetta(): potrebbe essere un valore fisso');
  assert(/trServizio['"]\)\.value\s*=\s*['"]0['"]/.test(corpoFn),
    'quando navetta() nega, il servizio non torna forzato a "auto privata"');
  /* deve ricalcolarsi da sola quando l'ospite cambia meta, passeggeri,
     giorno, ora o verso — non solo al primo caricamento */
  assert(/\[\s*['"]trLuogo['"]\s*,\s*['"]trPax['"]\s*,\s*['"]trQuando['"]\s*,\s*['"]trOra['"]\s*,\s*['"]trTipo['"]\s*\]/.test(SORGENTE),
    'non tutti i campi che decidono la navetta sono collegati a un ricalcolo');
  assert(/addEventListener\(['"]change['"]\s*,\s*aggiornaServizioTr\)/.test(SORGENTE),
    'aggiornaServizioTr non e collegata a nessun cambiamento');
});

/* Il commento doveva spiegare perche' la scelta vale la pena di chiederla,
   non promettere una tratta che non c'e': la navetta condivisa si vende
   solo su Venezia aeroporto, non "su molte tratte". */
Deno.test('il commento sulla navetta non promette piu tratte di quante ce ne siano', () => {
  assert(!/molte tratte/.test(SORGENTE), 'il commento dice ancora "molte tratte": e una tratta sola, Venezia aeroporto');
});

/* GIRO DI CORREZIONE 1, punto 2. Il ritorno torna, ma con le sue date: il
   validatore accetta "ritorno:true" senza giorno ne' ora (per compatibilita'
   con le righe vecchie), ed e' esattamente il difetto che quei due campi
   esistono per uccidere — la reception saprebbe CHE serve il ritorno e non
   QUANDO, e dovrebbe telefonare.

   GIRO DI CORREZIONE 2: la prova qui sotto controllava solo che la
   CONDIZIONE `if (ritorno && ...)` esistesse, non il suo corpo — cancellando
   il `return;` (e lasciando passare il carico proibito) la prova restava
   verde lo stesso. Ora pretende anche il contenuto del blocco: il
   messaggio mostrato e il `return` che blocca davvero l'invio. */
Deno.test('il ritorno porta sempre giorno e ora, mai un booleano muto', () => {
  const m = SORGENTE.match(/transfer_dati:\s*tr\s*\?\s*\{([\s\S]*?)\}\s*:\s*null/);
  assert(m, 'non si trova transfer_dati nel corpo');
  assert(/ritorno_quando\s*:\s*ritorno\s*\?\s*v\(\s*['"]trRitornoQuando['"]\s*\)\s*:\s*null/.test(m[1]),
    'ritorno_quando non e condizionato al ritorno: rischia di partire vuoto');
  assert(/ritorno_ora\s*:\s*ritorno\s*\?\s*v\(\s*['"]trRitornoOra['"]\s*\)\s*:\s*null/.test(m[1]),
    'ritorno_ora non e condizionato al ritorno: rischia di partire vuoto');

  /* la scorciatoia vietata: mandare "true" senza controllare che le due
     date ci siano davvero, prima ancora di chiamare il server — e non solo
     controllarlo, ma FERMARE l'invio quando manca qualcosa */
  const guardia = SORGENTE.match(
    /if\s*\(\s*ritorno\s*&&\s*\(!v\(\s*['"]trRitornoQuando['"]\s*\)\s*\|\|\s*!v\(\s*['"]trRitornoOra['"]\s*\)\s*\)\s*\)\s*\{([^}]*)\}/,
  );
  assert(guardia, 'la guardia del ritorno non si trova (o non e piu un blocco { } semplice)');
  assert(/return\s*;/.test(guardia[1]),
    'la guardia controlla la condizione ma non blocca piu l invio: manca il "return" prima di costruire il corpo');
  assert(/box\.textContent\s*=\s*t\.trRitornoManca/.test(guardia[1]),
    'la guardia non mostra piu il messaggio "manca giorno/ora del ritorno" prima di fermarsi');

  assert((SORGENTE.match(/trRitornoQuando\s*:/g) || []).length === 4,
    'l etichetta del giorno di ritorno non e in tutte e quattro le lingue');
  assert((SORGENTE.match(/trRitornoOra\s*:/g) || []).length === 4,
    'l etichetta dell ora di ritorno non e in tutte e quattro le lingue');
});

/* La data di ritorno copiava la casella del modulo del sito ma non il suo
   legame col minimo: il modulo lega fRitornoQuando.min alla data d'andata
   apposta perche' l'inversione e' stata VISTA SUCCEDERE DAVVERO (ritorno il
   18 con andata il 19, vedi legaDateRitorno() in
   pagine/richieste/transfer/index.html). Senza quel legame l'inversione
   arriva al server, che la rifiuta con una frase italiana secca — la
   stessa classe di problema per cui il punto 5 del giro precedente ha
   spostato 404/410 sulle schermate tradotte, stavolta per un errore che si
   poteva evitare invece di tradurre. */
Deno.test('la data di ritorno non puo cadere prima di quella di andata', () => {
  const m = SORGENTE.match(/function legaRitornoTr\(\)\{([\s\S]*?)\n\}/);
  assert(m, 'legaRitornoTr() non si trova per intero');
  assert(/rq\.min\s*=\s*a/.test(m[1]),
    'legaRitornoTr non impone il minimo sulla data di ritorno');
  assert(/rq\.value\s*=\s*a/.test(m[1]),
    'legaRitornoTr non corregge una data di ritorno gia scritta prima del minimo');
  assert(/trQuando['"]\)\.addEventListener\(\s*['"]change['"]\s*,\s*legaRitornoTr\)/.test(SORGENTE),
    'legaRitornoTr non e collegata al cambiamento della data di andata');
});

/* GIRO DI CORREZIONE 2, punto 3. Senza ricalcolare ritorno_collettivo sulla
   corsa di ritorno, il server lo risolve a false (assente = false) e il
   modulo che prepara la prenotazione dai tassisti legge "privata": un
   ospite che ha chiesto la navetta per il ritorno si vedrebbe prenotare un
   taxi privato. Niente di falso stampato per l'ospite, ma quello che si
   prenota diverge da quello che e' stato chiesto. */
Deno.test('il ritorno eredita "collettivo" solo se la sua corsa lo permette davvero', () => {
  assert(/corsaDiRitorno\(\{/.test(SORGENTE),
    'la pagina non calcola la corsa di ritorno: ritorno_collettivo non puo dipendere da niente');
  /* GIRO DI CORREZIONE 3: la prova pretendeva che corsaDiRitorno() venisse
     chiamata da qualche parte, ma non che il suo risultato tornasse
     davanti a navetta() per un secondo giudizio. Togliendo la chiamata a
     navetta() e lasciando `!!corsaRitorno` da solo, il ritorno erediterebbe
     in silenzio la scelta dell'andata — il punto 3 del giro precedente, di
     nuovo — e questa prova restava verde lo stesso. Ora pretende che
     ritornoCollettivo nasca da `navetta(corsaRitorno, ...)`, non dalla sola
     presenza della corsa. */
  assert(/const ritornoCollettivo\s*=\s*collettivo\s*&&\s*!!\(\s*corsaRitorno\s*&&\s*navetta\(\s*corsaRitorno\s*,/.test(SORGENTE),
    'ritornoCollettivo non ripassa la corsa di ritorno per navetta(): il ritorno erediterebbe la scelta dell andata senza controllo');
  const m = SORGENTE.match(/transfer_dati:\s*tr\s*\?\s*\{([\s\S]*?)\}\s*:\s*null/);
  assert(m, 'non si trova transfer_dati nel corpo');
  assert(/ritorno_collettivo\s*(,|:\s*ritornoCollettivo\b)/.test(m[1]),
    'transfer_dati non manda ritorno_collettivo calcolato sulla corsa di ritorno');
  assert(!/ritorno_collettivo\s*:\s*(true|false)\b/.test(m[1]),
    'ritorno_collettivo e scritto come true/false fisso, non calcolato');
});

/* GIRO DI CORREZIONE 1, punto 6. Il server risponde {ok:true, numeri:[...]}
   sull'invio riuscito: se la schermata di ringraziamento li ignora,
   l'ospite li scopre solo ricaricando la pagina e finendo nel 409. */
Deno.test('i numeri della richiesta si vedono anche al primo invio, non solo ricaricando', () => {
  assert(/stato\(\s*t\.grazieT[\s\S]{0,200}?d\.numeri/.test(SORGENTE),
    'la schermata di ringraziamento non mostra d.numeri');
});

/* GIRO DI CORREZIONE 1, punto 5. 404 (link non valido) e 410 (scaduto) sono
   gli stessi casi del caricamento: la pagina ha gia' le schermate tradotte,
   non serve mostrarli come un rifiuto in italiano nel riquadro rosso. */
Deno.test('link non valido e soggiorno scaduto restano schermate tradotte, non un errore muto', () => {
  assert(/status\s*===\s*404[\s\S]{0,80}?nonValidoT/.test(SORGENTE),
    'il 404 sull invio non porta piu alla schermata "link non valido"');
  assert(/status\s*===\s*410[\s\S]{0,80}?scadutoT/.test(SORGENTE),
    'il 410 sull invio non porta piu alla schermata "soggiorno scaduto"');
});

/* ============================================================
   GIRO DI CORREZIONE 3 — punto 1: partenza + navetta condivisa.

   navetta.js tratta SEMPRE il campo "ora" di una partenza come l'ora del
   volo (per giudicare se offrire la navetta), ma validaTransfer (server)
   lo documenta come gia' l'orario della corsa: le due letture si
   contraddicono, e la contraddizione e' stata VERIFICATA ESEGUENDO
   navetta() sul modulo vero — partenza 09:00 negata (il ritiro vero
   sarebbe dentro la fascia), partenza 22:00 offerta (il ritiro vero cade
   due ore fuori servizio). Senza riconciliarle, un ospite con ritiro alle
   22:00 riceve una conferma scritta per una corsa che la navetta non fa a
   quell'ora.
   ============================================================ */

/* L'etichetta e la nota cambiano solo quando SERVE davvero: partenza
   scelta come navetta condivisa. In ogni altro caso (arrivo, o partenza
   con auto privata) "ora" resta quello che l'ospite legge da sempre. */
Deno.test('l etichetta "ora" diventa "ora del volo" solo con partenza e navetta condivisa', () => {
  assert(/from ['"]\/comune\/navetta\.js['"]/.test(SORGENTE) && /ritiroPerVolo/.test(SORGENTE),
    'la pagina non importa ritiroPerVolo da /comune/navetta.js');
  const fn = SORGENTE.match(/function conNavettaInPartenzaTr\(\)\{([\s\S]*?)\n\}/);
  assert(fn, 'conNavettaInPartenzaTr() non si trova per intero');
  assert(/trServizio['"]\)\.value\s*===\s*['"]1['"]/.test(fn[1])
    && /trTipo['"]\)\.value\s*===\s*['"]partenza['"]/.test(fn[1])
    && /&&/.test(fn[1]),
    'conNavettaInPartenzaTr non pretende ENTRAMBE le condizioni (servizio condiviso E partenza): un arrivo o una partenza privata cambierebbero etichetta senza motivo');

  const ag = SORGENTE.match(/function aggiornaRitiroTr\(\)\{([\s\S]*?)\n\}/);
  assert(ag, 'aggiornaRitiroTr() non si trova per intero');
  assert(/conNavettaInPartenzaTr\(\)/.test(ag[1]), 'aggiornaRitiroTr non controlla conNavettaInPartenzaTr()');
  assert(/getElementById\(\s*['"]trEtiOra['"]\s*\)/.test(ag[1]),
    'aggiornaRitiroTr non legge l etichetta trEtiOra');
  assert(/firstChild\.nodeValue\s*=\s*\w+\s*\?\s*t\.trOraVolo\s*:\s*t\.trOra\b/.test(ag[1]),
    'aggiornaRitiroTr non scambia l etichetta fra "Ora" e "Ora del volo"');
  assert(/ritiroPerVolo\(/.test(ag[1]), 'aggiornaRitiroTr non calcola il ritiro vero da ritiroPerVolo()');

  /* niente \s* prima dei due punti: senza, "t.trOraVolo : t.trOra" nel
     ternario di aggiornaRitiroTr() conterebbe come una quinta "definizione" */
  assert((SORGENTE.match(/trOraVolo:/g) || []).length === 4,
    'l etichetta "ora del volo" non e in tutte e quattro le lingue');
  assert((SORGENTE.match(/trRitiroAlle:/g) || []).length === 4,
    'la nota del ritiro non e in tutte e quattro le lingue');
});

/* Il valore che PARTE deve essere gia' convertito, non solo l etichetta che
   lo introduce: altrimenti il server riceve ancora l ora del volo scambiata
   per orario della corsa, ed e' esattamente il difetto che l etichetta da
   sola non basta a chiudere. */
Deno.test('prima di partire, l ora del volo si converte nell ora di ritiro', () => {
  const fn = SORGENTE.match(/function corsaVeraTr\(v\)\{([\s\S]*?)\n\}/);
  assert(fn, 'corsaVeraTr() non si trova per intero');
  assert(/conNavettaInPartenzaTr\(\)/.test(fn[1]),
    'corsaVeraTr non controlla conNavettaInPartenzaTr(): potrebbe convertire anche gli arrivi o le partenze private');
  assert(/ritiroPerVolo\(/.test(fn[1]), 'corsaVeraTr non chiama ritiroPerVolo()');
  /* IL GIORNO PRIMA: un volo notturno fa arretrare la data, o si prenota un
     taxi per il giorno sbagliato — il punto su cui il messaggio di
     revisione chiedeva di fermarsi e chiedere invece di indovinare. */
  assert(/giornoPrima/.test(fn[1]) && /setDate\(.*-\s*1\)/.test(fn[1]),
    'corsaVeraTr non arretra la data quando il ritiro cade il giorno prima del volo');
  assert(/ora_volo:\s*scritta/.test(fn[1]),
    'corsaVeraTr non porta con se ora_volo, il dato da cui nasce la conversione');

  const corpo = SORGENTE.match(/const corpo = \{[\s\S]*?\n  \};/);
  assert(corpo, 'non si trova la costruzione del corpo in invia()');
  assert(/const corsaTr\s*=\s*tr\s*\?\s*corsaVeraTr\(v\)\s*:\s*null/.test(SORGENTE),
    'invia() non calcola corsaTr con corsaVeraTr(v) prima di costruire il corpo');
  const td = SORGENTE.match(/transfer_dati:\s*tr\s*\?\s*\{([\s\S]*?)\}\s*:\s*null/);
  assert(td, 'non si trova transfer_dati nel corpo');
  assert(/quando:\s*corsaTr\.quando/.test(td[1]) && /ora:\s*corsaTr\.ora/.test(td[1]),
    'transfer_dati manda ancora il valore grezzo di trQuando/trOra invece del risultato di corsaVeraTr()');
  assert(/ora_volo:\s*corsaTr\.ora_volo/.test(td[1]),
    'transfer_dati non manda ora_volo: chi legge in reception non puo verificare la conversione');
});
