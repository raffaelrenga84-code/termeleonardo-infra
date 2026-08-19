<title>Cinquanta pagine, guardate una per una</title>

# Cinquanta pagine, guardate una per una

*19 agosto 2026*

La domanda era «perché non sistemiamo la SEO del sito». Guardando, il problema
non è la SEO di un sito: è che **ci sono due siti vivi per lo stesso hotel**, e
quello su cui stavamo lavorando è il più debole dei due.

---

## Il problema, misurato

Tutto quello che segue è stato letto dal vivo il 19 agosto 2026, non dedotto.

**Due domini, entrambi indicizzabili.**

- `www.termeleonardo.com` (con `hldv.com` che ci porta sopra) — il sito
  vecchio, Laravel, quasi certamente di Fidra. Quindici pagine di contenuto per
  quattro lingue, HTML servito dal server, e sopra ci vivono le cose che
  incassano: `/shop/checkout`, `/it/day-spa/prenotazioni`, `deposit-payment`,
  il PDF del listino, il logo di ogni email.
- `www.hoteltermeleonardo.com` — il sito nuovo in React. **Una pagina sola**:
  `App.js` monta quindici sezioni tutte su `/`. L'HTML servito è 6,5 KB con un
  `div id="root"` vuoto; il contenuto esiste solo dopo che il JavaScript è
  girato. Le quattro lingue cambiano con `?lang=`, che per un motore non fa
  una pagina nuova.

Parlano dello stesso hotel con le stesse parole, e la storia — link, citazioni,
posizionamento — sta quasi tutta sul vecchio. Il nuovo per giunta manda le sue
prenotazioni sul vecchio (`data.js`: `DAYSPA_URL` punta a `termeleonardo.com`).

**Sul sito vecchio, i difetti trovati:**

| difetto | come si vede |
|---|---|
| nessun `canonical` su nessuna pagina | `/it` non ne ha uno |
| nessun `hreflang`, con quattro lingue vive | idem |
| `sitemap.xml` risponde **404** | e il `robots.txt` ne dichiara una su `hldv.com`, che è **404** anche lei |
| il francese ha i meta in inglese | `/fr`: `lang="fr"`, corpo francese, `title` e `description` inglesi, e un `h2` che dice «FAQ - Domande frequenti» |
| cinque `h1` per pagina | su `/it/cure-termali` e `/it/golf` |
| titoli con refusi | «Hotel 4 Stelle  con Cure Termali», con il doppio spazio dentro |
| le lingue non hanno le stesse pagine | in tedesco mancano **day spa** e **driving range**; in italiano mancano quattro delle sei offerte tedesche |
| inglese e francese hanno la vetrina delle offerte **vuota** | `/en/offers` e `/fr/offres` esistono e non contengono nessuna offerta: le dieci pagine offerta stanno solo in italiano e tedesco |

Gli indirizzi di contenuto sono **50**: diciassette in italiano, quindici in
tedesco, nove in inglese, nove in francese. Contati dai menu delle quattro
lingue e dalle pagine delle offerte, il 19 agosto 2026.

**E non abbiamo occhi.** Sulla home non c'è né Google Analytics né una verifica
di Search Console: solo PostHog, arrivato con l'impianto di emergent.sh, che
conta i clic e non le ricerche. Oggi non sappiamo per quali parole il sito
compare, e dopo il lavoro non sapremmo dire se ha funzionato.

---

## Le due decisioni della proprietà, 19 agosto 2026

1. **Il sito è `termeleonardo.com`.** Il nuovo resta come vetrina e casa dei
   moduli, e va tolto dalla concorrenza. Deciso così perché il vecchio ha la
   storia: spostarla costa mesi e si può perdere, e il nuovo oggi non ha
   nemmeno le pagine su cui atterrare.
2. **I due pubblici sono due:** tedeschi e austriaci per i soggiorni lunghi
   (cure, golf), e il pubblico locale e veneto per Day Spa e fanghi. Non uno o
   l'altro: tutti e due, con pagine diverse.

E un vincolo che decide la forma del lavoro: **sul sito vecchio si possono
cambiare i testi delle pagine, non i titoli, le description, i canonical né gli
indirizzi.** Quelli passano da Fidra.

---

## Cosa si fa

Uno strumento, `strumenti/audit-seo.js`, che legge le pagine del sito vecchio e
ne ricava una tabella. Poi, dalla tabella, **due liste con due destinatari
diversi.**

### Lo strumento

**Legge e basta.** Scarica pagine pubbliche come farebbe un browser: non scrive
niente, non manda moduli, non tocca il gestionale. Non è una cautela di stile —
è la ragione per cui questo è il primo passo invece che l'ultimo.

Per ogni indirizzo raccoglie:

- codice HTTP e, se c'è, l'indirizzo finale dopo i reindirizzamenti
- `title` e la sua lunghezza in caratteri
- `description` e la sua lunghezza
- la lingua dichiarata nell'attributo `lang`
- quanti `h1` ci sono, e il testo del primo
- `canonical`: c'è, e verso dove
- `hreflang`: quanti e quali
- il `meta robots`, se c'è
- parole del corpo, tolti gli script e i fogli di stile
- immagini senza `alt`, su quante immagini
- peso in byte e tempo di risposta

**Più un controllo che non è meccanico:** la lingua di `title` e `description`
combacia con quella dichiarata? È il controllo che ha trovato il francese, e va
automatizzato perché a mano su cinquanta pagine non lo rifà nessuno. Si fa con
l'euristica a parole spia già scritta in `estensione/outlook-inject.js`
(`linguaTesto`), che riconosce italiano, tedesco, inglese e francese contando
parole comuni. Sbaglia sui testi cortissimi, e infatti il suo esito si chiama
*sospetto*, non *errore*: la riga finisce in lista con un punto interrogativo e
la decide una persona.

**Un elenco di indirizzi scritto, non un crawler.** Deciso così di proposito: un
crawler che segue i link su quel sito finisce dentro `/shop`, `/login`,
`/register` e il motore di prenotazione — pagine che non ci riguardano, che non
vanno visitate a ripetizione, e che sono quelle che incassano. L'elenco lo
ricaviamo una volta dai menu delle quattro lingue e sta in un file accanto allo
strumento, dove si legge e si corregge.

**Una richiesta alla volta, con una pausa fra l'una e l'altra**, e uno
`User-Agent` che dice chi siamo. Cinquanta pagine in un minuto non fanno male a
nessuno; cinquanta pagine tutte insieme, contro il server che vende, sono una
cosa che non si fa.

### Dove finisce quello che raccoglie

Due file, con la data nel nome, in `docs/seo/`:

- `AAAA-MM-GG-audit-termeleonardo.md` — la tabella da leggere, una riga per
  indirizzo, con i sospetti segnati.
- `AAAA-MM-GG-audit-termeleonardo.json` — gli stessi dati grezzi. Servono per
  la passata di controllo: confrontare due tabelle a occhio è il modo di non
  accorgersi che una riga è rimasta com'era.

Il rapporto contiene solo quello che chiunque legge aprendo il sito: nessuna
chiave, nessun dato di ospite. Va bene che stia in un repo pubblico.

### Chi scrive le due liste

**Lo strumento produce la tabella, non le liste.** Le due liste le scrive una
persona leggendo la tabella, ed è giusto così: il titolo nuovo di
`/de/thermal-kur` lo può proporre solo qualcuno che sa cosa vende quell'hotel e
a chi. Un generatore automatico di title darebbe cinquanta righe plausibili e
nessuna vera.

### La lista A — quello che carica la reception

Per ogni pagina e ogni lingua, **il testo nuovo già scritto**: intestazione,
primo paragrafo, sezioni mancanti. Copiabile e incollabile.

Non «migliorare il testo delle cure»: il testo. Una lista di buoni propositi si
legge e non si applica.

### La lista B — quello che si chiede a Fidra

Per ogni pagina e ogni lingua, **il valore esatto del campo**: `title`,
`description`, `canonical`, `hreflang`. Più i difetti d'impianto, che sono
pochi e valgono molto:

- la sitemap che non esiste, su tutti e due i domini
- il `robots.txt` che dichiara una sitemap su `hldv.com`
- i meta francesi in inglese
- le pagine che mancano in tedesco: day spa e driving range

Una lista che si manda e si spunta, non una consulenza da interpretare.

### L'ordine

Le correzioni si ordinano per quanto rendono ai due pubblici decisi, non per
quanto sono facili:

1. **Le pagine che vendono ai tedeschi**: `/de/thermal-kur`, `/de/golf`, e le
   sei offerte tedesche.
2. **Le pagine che vendono ai locali**: `/it/day-spa`, `/it/piscine-termali`,
   `/it/grotte-termali`, `/it/cure-termali`.
3. **I difetti che ingannano il motore ovunque**: canonical assente, hreflang
   assente, sitemap 404, meta in lingua sbagliata.
4. Tutto il resto.

---

## Come si verifica

Lo strumento è codice, quindi ha i suoi test, **su HTML finti e non sulla
rete**: un test che chiama il sito vero fallisce il giorno che il sito cambia o
la rete cade, e a quel punto non lo guarda più nessuno.

La verifica vera arriva dopo: quando Fidra dice «fatto», **si rilancia lo
strumento** e si confronta riga per riga. È il motivo per cui è uno strumento e
non un pomeriggio di lavoro a mano. Un audit che non si ripete è una fotografia;
uno che si ripete è un controllo.

| garanzia | difetto che impedisce |
|---|---|
| lo strumento non fa mai richieste diverse da GET | toccare il motore di prenotazione |
| l'elenco degli indirizzi è un file, non un crawler | finire dentro `/shop`, `/login`, `/register` |
| una richiesta alla volta, con pausa | pesare sul server che incassa |
| il controllo di lingua produce *sospetti*, non verdetti | correggere un francese giusto perché l'euristica ha sbagliato |
| i test girano su HTML finti | una prova che dipende dalla rete e che si smette di guardare |
| il rapporto porta la data | confrontare due fotografie senza sapere quale è prima |

---

## Cosa resta fuori, e perché

- **Il profilo Google Business.** È l'unico accesso che abbiamo in mano e per il
  pubblico locale pesa più del sito, ma è un lavoro di contenuto — foto, orari,
  servizi, recensioni — non di audit. Ha la sua specifica.
- **Il sito nuovo che smette di competere.** Mezza giornata nel repo che
  controlliamo, nessuna dipendenza da nessuno. Va fatto, ma non fa parte di
  questa lettura.
- **Search Console.** Senza, non misureremo niente. La verifica però passa dal
  DNS o dall'intestazione delle pagine, cioè da Fidra: diventa la prima riga
  della lista B, non un compito nostro.
- **I link in entrata.** Chi cita l'hotel e con che peso: serve uno strumento a
  pagamento, e non cambia nessuna delle correzioni di questa lista.
- **I volumi di ricerca.** Quante persone cercano davvero «day spa abano»: idem.
  Le priorità qui sono decise dai due pubblici che la proprietà ha indicato, che
  è un criterio dichiarato invece che un numero comprato.
- **Le prestazioni oltre il tempo di risposta.** Si misura quanto ci mette a
  rispondere e quanto pesa; non si apre il capitolo Core Web Vitals.
- **Riscrivere il sito nuovo.** Non si tocca.
