# Preventivo senza Fidra — piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dalle righe di «Disponibilità e prezzi» si sceglie una o più sistemazioni e ne esce un preventivo email in quattro lingue, senza aprire una prenotazione in Fidra e senza digitare un prezzo.

**Architecture:** Tre pezzi con un confine netto. Il modale dentro Fidra (`fidra-disponibilita.js`) sceglie e misura, e deposita in `chrome.storage.local` una chiave `leonardo_preventivo` con dati **grezzi e in italiano**. Il pannello (`popup.js`) chiede a chi è rivolto e in che lingua. Il modello (`template-extra.js`) traduce e impagina, riusando la macchina a quattro lingue già provata sulle offerte vere. Il modale non traduce mai.

**Tech Stack:** JavaScript da browser (estensione Chrome MV3, nessun bundler, nessuna dipendenza). Prove in Deno + `jsr:@std/assert`, che caricano gli script del browser con `new Function`.

## Global Constraints

- **Repo di lavoro:** `C:\Users\admin\termeleonardo-infra`, cartella `estensione/`. **Non** si modifica mai direttamente la cartella della reception: ci pensa `node strumenti/estensione.js`.
- **Nessun campo prezzo nel pannello, e nessun ripiego manuale.** Se `leonardo_preventivo` non c'è, la voce «Preventivo soggiorno» non compare. Non si reintroduce nessun modulo dove digitare un prezzo.
- **Il modale non traduce.** `categoria` e `trattamento` viaggiano in italiano come li scrive Fidra.
- **Importi in centesimi interi** in `leonardo_preventivo`, come tutto `fidra-disponibilita.js`. La divisione per 100 avviene solo nel modello.
- **Massimo 4 voci** per preventivo.
- **Una voce con prezzo stimato non esce mai.** `sconto.stima === true` (pacchetto settimanale più coda di notti) → il modale disabilita il pulsante e il modello **solleva un errore** se una voce così gli arriva lo stesso.
- **Il 3% anticipo non si sottrae mai dal prezzo**: si nomina come importo reso alla partenza. Il 5% fedeltà invece è già dentro il prezzo.
- Nessuna scrittura in Fidra, nessun numero d'offerta, nessun acconto, nessuna scadenza, **nessun link di pagamento** (vedi sotto).
- Prove: `deno test --allow-read estensione/` deve passare interamente a ogni commit.
- Nessuna dipendenza nuova, nessuna funzione Supabase nuova, nessun permesso nuovo nel manifest.

## Il pagamento della caparra: perché qui non c'è

Il link non lo genera Stripe e non lo genera Fidra: **lo compone
`extractor.js:322`**, con tre pezzi che vengono tutti dalla prenotazione.

```js
const numeroOfferta = anno ? `O${String(anno).slice(2)}/${id}` : null;
const linkPagamento = (id && numeroOfferta)
  ? `https://www.termeleonardo.com/it/deposit-payment?id=${id}`
    + `&number=${encodeURIComponent(numeroOfferta)}`
    + `&amount=${Math.round(acconto * 100)}`
  : null;
```

`id` è l'identificativo della prenotazione in Fidra, `number` è `O26/12345`,
`amount` è la caparra. Fuori da una prenotazione **nessuno dei tre esiste**, e
il primo è quello che conta: `/deposit-payment` riconcilia il pagamento con la
pratica attraverso quell'`id`. Un incasso che arriva senza non ha niente a cui
attaccarsi.

E c'è una ragione che viene prima di quella tecnica: il preventivo dichiara di
**non bloccare la camera**. Prendere una caparra per una camera che non è
tenuta significa incassare per qualcosa che si può vendere a un altro nel
frattempo — e allora si hanno i soldi dell'ospite e nessuna camera.

**Quando l'ospite accetta, la strada è quella di sempre:** si apre la pratica
in Fidra, e l'offerta vera esce con il link che già funziona. Un clic in più
rispetto al preventivo, ma con dietro una camera davvero riservata.

Se un giorno si volesse «preventivo → opzione con caparra» servirebbero una
prenotazione in stato opzione creata da fuori e un `/deposit-payment` che
accetti un identificativo diverso da quello di Fidra. È un altro progetto, e
prima di tutto è una decisione commerciale: fin dove ci si spinge a incassare
su una camera non tenuta.

---

## Struttura dei file

| file | responsabilità | azione |
|---|---|---|
| `estensione/template-extra.js` | i documenti che **non** vengono da una prenotazione: Sollecito, Info Day Spa, Buoni regalo — e ora Preventivo. Contiene già `corniceExtra`, `salutoExtra`, `dataExtra` in quattro lingue. | modificare |
| `estensione/fidra-disponibilita.js` | il modale dentro Fidra: sceglie, misura, deposita | modificare |
| `estensione/popup.js` | il pannello: a chi è rivolto, in che lingua, e monta il documento | modificare |
| `estensione/preventivo.test.ts` | le prove della funzione | creare |
| `estensione/manifest.json` | numero di versione | modificare |
| `estensione/LEGGIMI-v2_6_1.md` | il diario, in coda | modificare |

**Perché `template-extra.js` e non `template.js` più le tre lingue.** La specifica diceva «modello nuovo in `template.js` e nelle tre lingue»; leggendo il codice il posto giusto è un altro. Day Spa e Buoni regalo — gli altri due documenti senza prenotazione — vivono in `template-extra.js` con **un solo** costruttore base e una tabella a quattro lingue (`costruisciDaySpaBase(d, o, lingua)` + `DAYSPA_T`). Il preventivo è la stessa forma. Spargerlo su quattro file vorrebbe dire quattro posti da ricordare a ogni modifica, che è esattamente il difetto che `pulsanti.test.ts` è stato scritto per sorvegliare.

---

## Task 1: Il documento e le sue quattro lingue

Si comincia da qui perché è l'unico pezzo puro: definisce la forma dei dati che gli altri due devono produrre, e si prova davvero.

**Files:**
- Create: `estensione/preventivo.test.ts`
- Modify: `estensione/template-extra.js` (in coda, dopo il blocco BUONI REGALO)

**Interfaces:**
- Consuma: `corniceExtra(banda, corpo, o, lingua)`, `salutoExtra(d, o, lingua)`, `dataExtra(giorno, meseAbbr, anno, lingua)`, `importoLingua(euro, lingua)` — tutte già esistenti e caricate prima.
- Produce:
  - `costruisciPreventivoBase(d, opzioni, lingua) → string` (HTML)
  - `costruisciPreventivoIT|DE|EN|FR(d, o) → string`
  - `oggettoPreventivoIT|DE|EN|FR(d) → string`
  - forma di `d` attesa:
    ```js
    { intestatario, email,
      giornoArrivo: 23, mese: 'Aug', anno: 2026,
      giornoPartenza: 26, mesePartenza: 'Aug', annoPartenza: 2026,
      notti: 3, adulti: 2, bambini: 0, etaBambini: [],
      voci: [ { categoria:'DOPPIA', trattamento:'Miglior Prezzo Mezza Pensione',
                prezzoPP:39000, totale:78000, cure:0,
                sconto5:0, sconto3:0, bambiniPrezzi:[], stima:false } ] }
    ```
    Importi in **centesimi**.
  - forma di `opzioni`: `{ genere, titolo, firma, cure, cane }`
- Riusa senza riscrivere: `notaPacchetto(trattamento, lingua)` (template.js:679),
  `descrizioneCamera(categoria, dizionario)` (template.js:773) con `CAMERE_IT` /
  `ZIMMER_DE` / `ROOMS_EN` / `CHAMBRES_FR`, `DOTAZIONE_IT` / `AUSSTATTUNG_DE` /
  `AMENITIES_EN` / `EQUIPEMENTS_FR`, `rigaBambini(c, lingua)` (template.js:533).

- [ ] **Step 1: Scrivere le prove che falliscono**

Creare `estensione/preventivo.test.ts`:

```ts
/* ============================================================
   preventivo.test.ts — il documento che nasce fuori da una
   prenotazione.

   COSA SORVEGLIA. Il preventivo esiste per rispondere a chi chiede
   un prezzo senza avere una pratica in Fidra. Il rischio non e' che
   non esca: e' che esca somigliando a un'offerta. Un cliente che
   legge un numero d'offerta, un acconto o una scadenza capisce
   «camera tenuta», e nessuno gliel'ha tenuta.

   E il secondo rischio e' un prezzo stimato. Quando c'e' un
   pacchetto settimanale piu' una coda di notti, il 5% che il modale
   mostra e' una stima — sta scritto nel codice: «stima: il conto
   esatto e' in Notte per notte». Una stima dentro un preventivo
   diventa una promessa. Qui il modello si rifiuta di scriverla.
   ============================================================ */
import { assert, assertEquals, assertThrows } from 'jsr:@std/assert';

const FILE = [
  'template.js', 'template-conferma.js', 'template-de.js',
  'template-en.js', 'template-fr.js', 'template-extra.js',
];
const SORGENTE = FILE.map((f) => Deno.readTextFileSync(new URL(f, import.meta.url))).join('\n');

const LINGUE = ['it', 'de', 'en', 'fr'] as const;

type Costruttore = (d: Record<string, unknown>, o: Record<string, unknown>) => string;
type Modelli = {
  html: Record<string, Costruttore>;
  ogg: Record<string, (d: Record<string, unknown>) => string>;
};

function modelli(): Modelli {
  const coda = `
    return {
      html: { it: costruisciPreventivoIT, de: costruisciPreventivoDE,
              en: costruisciPreventivoEN, fr: costruisciPreventivoFR },
      ogg:  { it: oggettoPreventivoIT, de: oggettoPreventivoDE,
              en: oggettoPreventivoEN, fr: oggettoPreventivoFR }
    };`;
  return new Function(SORGENTE + coda)() as Modelli;
}

const DATI = () => ({
  intestatario: 'Bianchi Maria',
  email: 'ospite@esempio.it',
  giornoArrivo: 23, mese: 'Aug', anno: 2026,
  giornoPartenza: 26, mesePartenza: 'Aug', annoPartenza: 2026,
  notti: 3, adulti: 2, bambini: 0,
  voci: [
    { categoria: 'DOPPIA', trattamento: 'Miglior Prezzo Mezza Pensione',
      prezzoPP: 39000, totale: 78000, cure: 0, sconto5: 0, sconto3: 0, stima: false },
    { categoria: 'JUNIOR SUITE COLLI EUGANEI', trattamento: 'Miglior Prezzo Bed & Breakfast',
      prezzoPP: 34500, totale: 69000, cure: 0, sconto5: 0, sconto3: 0, stima: false },
  ],
});
const OPZ = { genere: 'F', titolo: '', firma: 'La Reception' };

Deno.test('il modello si carica in tutte e quattro le lingue', () => {
  const m = modelli();
  for (const l of LINGUE) {
    assert(typeof m.html[l] === 'function', `manca il costruttore ${l}`);
    assert(typeof m.ogg[l] === 'function', `manca l oggetto ${l}`);
  }
});

Deno.test('esce un documento con dentro i prezzi, in tutte e quattro', () => {
  const m = modelli();
  for (const l of LINGUE) {
    const html = m.html[l](DATI(), OPZ);
    assert(html.length > 1000, `il documento ${l} e troppo corto per essere un'email`);
    assert(/390[.,]00/.test(html), `il prezzo a persona non compare in ${l}`);
    assert(/780[.,]00/.test(html), `il totale non compare in ${l}`);
    assert(html.includes('Miglior Prezzo Mezza Pensione') ||
           html.includes('Bestpreis') || html.includes('Best rate') ||
           html.includes('Meilleur tarif'), `il trattamento non compare in ${l}`);
  }
});

Deno.test('non nomina MAI numero d offerta, acconto, scadenza, caparra', () => {
  const m = modelli();
  /* le parole che fanno leggere «camera tenuta» a chi riceve */
  const VIETATE = [
    /offerta n\./i, /angebot nr/i, /offer no\./i, /offre n[°o]/i,
    /acconto/i, /anzahlung/i, /deposit/i, /acompte/i,
    /caparra/i, /conferma ora/i, /jetzt best/i, /confirm now/i,
    /scade/i, /verf(a|&auml;)llt/i, /expires/i, /expire/i,
    /causale/i, /bonifico/i, /IBAN/,
  ];
  for (const l of LINGUE) {
    const html = m.html[l](DATI(), OPZ);
    for (const re of VIETATE) {
      assert(!re.test(html), `il preventivo ${l} contiene «${re}»: sembra un'offerta`);
    }
  }
});

Deno.test('dice che non blocca la camera, in tutte e quattro', () => {
  const m = modelli();
  const ATTESE = {
    it: /non blocca la camera/i,
    de: /kein Zimmer reserviert/i,
    en: /does not hold the room/i,
    fr: /ne bloque pas la chambre/i,
  };
  for (const l of LINGUE) {
    const html = m.html[l](DATI(), OPZ);
    assert(ATTESE[l].test(html), `manca l avviso «non blocca la camera» in ${l}`);
  }
});

Deno.test('un pacchetto dice che cosa comprende, nelle lingue in cui esiste', () => {
  /* «Dolce Vita 10 cure» senza l'elenco delle applicazioni e' un prezzo
     senza merce: chi legge non sa che dentro ci sono visita medica,
     fanghi, bagni all'ozono, massaggi e inalazioni. notaPacchetto lo sa
     gia' fare per le offerte vere — qui si riusa, non si riscrive. */
  const m = modelli();
  const d = DATI();
  d.voci = [{ ...d.voci[0], trattamento: 'Dolce Vita Spezial 10 cure' }];
  /* si guarda l'intestazione del blocco, non una parola del listino: il
     testo dei pacchetti e' commerciale e cambia, il blocco no */
  const TITOLI = { it: /IL PACCHETTO COMPRENDE/, de: /IM PAKET ENTHALTEN/,
                   en: /YOUR PACKAGE INCLUDES/, fr: /LE FORFAIT COMPREND/ };
  for (const l of LINGUE) {
    const html = m.html[l](d, OPZ);
    assert(TITOLI[l].test(html), `il pacchetto non dice cosa comprende in ${l}`);
  }
  /* il numero di applicazioni si legge dal nome della tariffa */
  assert(/10/.test(m.html.de(d, OPZ)), 'le dieci applicazioni non compaiono');
  /* una tariffa che non e' un pacchetto non deve inventarsi un blocco */
  const semplice = DATI();
  assert(!TITOLI.it.test(m.html.it(semplice, OPZ)),
    'una mezza pensione qualunque si e presa il blocco di un pacchetto');
});

Deno.test('la camera e descritta, e la dotazione compare una volta sola', () => {
  const m = modelli();
  const ATTESE = { it: /16 m|18 m/, de: /16 m|18 m/, en: /16 m|18 m/, fr: /16 m|18 m/ };
  const DOT = { it: /aria condizionata/i, de: /Klimaanlage/i,
                en: /air conditioning/i, fr: /climatisation/i };
  for (const l of LINGUE) {
    const html = m.html[l](DATI(), OPZ);
    assert(ATTESE[l].test(html), `manca la descrizione della camera in ${l}`);
    assertEquals((html.match(DOT[l]) || []).length, 1,
      `la dotazione compare piu di una volta in ${l}: va in fondo, non per camera`);
  }
});

Deno.test('i bambini compaiono col loro prezzo, non solo contati', () => {
  /* il modale calcola il prezzo di ogni bambino per eta' (dettaglioB):
     buttarlo via e scrivere «2 bambini» sarebbe far ricopiare a mano
     proprio il numero che si e' fatto la fatica di leggere */
  const m = modelli();
  const d = DATI();
  d.bambini = 2;
  d.etaBambini = [5, 11];
  d.voci = [{ ...d.voci[0], bambiniPrezzi: [3000, 8000] }];
  for (const l of LINGUE) {
    const html = m.html[l](d, OPZ);
    assert(/30[.,]00/.test(html), `manca il prezzo del primo bambino in ${l}`);
    assert(/80[.,]00/.test(html), `manca il prezzo del secondo bambino in ${l}`);
    assert(/5/.test(html) && /11/.test(html), `mancano le eta in ${l}`);
  }
});

Deno.test('cure e cane compaiono solo se richiesti', () => {
  const m = modelli();
  const senza = m.html.it(DATI(), OPZ);
  assert(!/impegnativa/i.test(senza), 'le cure compaiono senza che siano state chieste');
  assert(!/cane/i.test(senza), 'il cane compare senza che sia stato chiesto');
  const CURE = { it: /impegnativa/i, de: /&auml;rztlich|arztlich|Verordnung/i,
                 en: /doctor/i, fr: /m&eacute;decin|medecin/i };
  const CANE = { it: /cane/i, de: /Hund/i, en: /dog/i, fr: /chien/i };
  for (const l of LINGUE) {
    const html = m.html[l](DATI(), { ...OPZ, cure: true, cane: true });
    assert(CURE[l].test(html), `manca la riga delle cure in ${l}`);
    assert(CANE[l].test(html), `manca la riga del cane in ${l}`);
    assert(/13/.test(html), `manca il prezzo del cane in ${l}`);
  }
});

Deno.test('con un ospite solo nomina l uso singola, in tutte e quattro', () => {
  const m = modelli();
  const d = DATI();
  d.adulti = 1;
  d.voci = [d.voci[0]];
  const ATTESE = {
    it: /uso singola/i, de: /Alleinbenutzung/i,
    en: /single use|sole use/i, fr: /usage individuel/i,
  };
  for (const l of LINGUE) {
    const html = m.html[l](d, OPZ);
    assert(ATTESE[l].test(html), `con un ospite solo manca l uso singola in ${l}`);
  }
});

Deno.test('una voce con prezzo stimato non si scrive: solleva errore', () => {
  const m = modelli();
  const d = DATI();
  d.voci[0].stima = true;
  for (const l of LINGUE) {
    assertThrows(() => m.html[l](d, OPZ), Error, 'stimato');
  }
});

Deno.test('il 3% anticipo si nomina ma non si sottrae dal totale', () => {
  /* il codice del modale lo dice gia': «non toglierli dall'offerta».
     Il cliente paga il prezzo pieno e riceve l'importo alla partenza. */
  const m = modelli();
  const d = DATI();
  d.voci = [{ ...d.voci[0], sconto3: 2340 }];
  const html = m.html.it(d, OPZ);
  assert(/780[.,]00/.test(html), 'il totale e stato ridotto dal 3%: non va sottratto');
  assert(/23[.,]40/.test(html), 'il 3% non e nominato');
});

Deno.test('senza nome saluta comunque, senza scrivere «undefined»', () => {
  const m = modelli();
  const d = DATI();
  d.intestatario = '';
  for (const l of LINGUE) {
    const html = m.html[l](d, { genere: 'N', titolo: '', firma: 'La Reception' });
    assert(!/undefined|null/.test(html), `«undefined» nel documento ${l}`);
  }
});
```

> Nota per chi implementa: l'ultima prova sul 3% è scritta storta di proposito nel
> blocco qui sopra? No — correggila così mentre la incolli, è un refuso del piano:
> ```ts
> const html = m.html.it(d, OPZ);
> ```
> e togli la funzione `l_it`.

- [ ] **Step 2: Eseguire le prove per vederle fallire**

Run: `deno test --allow-read estensione/preventivo.test.ts`
Expected: FAIL — `costruisciPreventivoIT is not defined`

- [ ] **Step 3: Scrivere il modello**

In coda a `estensione/template-extra.js`:

```js
/* ============================================================
   PREVENTIVO SOGGIORNO — il documento senza prenotazione (v1.0)
   ------------------------------------------------------------
   Le sistemazioni scelte in «Disponibilita' e prezzi» con i loro
   prezzi, e nient'altro: nessun numero d'offerta, nessun acconto,
   nessuna scadenza, nessun pulsante «Conferma Ora».

   NON E' UN'OFFERTA PIU' CORTA, E' UN ALTRO DOCUMENTO. Chi legge un
   numero d'offerta e un acconto capisce «camera tenuta»: qui non e'
   stata tenuta nessuna camera, e il documento lo dice in chiaro.

   I PREZZI ARRIVANO IN CENTESIMI, come li produce il modale: la
   divisione per cento avviene qui e in nessun altro posto.

   NON SI RISCRIVE NIENTE CHE ESISTA GIA'. La descrizione dei pacchetti
   (notaPacchetto), quella delle camere (CAMERE_IT / ZIMMER_DE /
   ROOMS_EN / CHAMBRES_FR), la dotazione e la riga dei bambini con il
   prezzo per eta' (rigaBambini) sono le stesse funzioni che scrivono
   le offerte vere da mesi. Una seconda copia divergerebbe dalla prima,
   ed e' il difetto che pulsanti.test.ts e' nato per sorvegliare.
   ============================================================ */
const PREVENTIVO_T = {
  it: {
    ogg: 'Preventivo per il suo soggiorno &mdash; Hotel Terme Leonardo',
    banda: 'PREVENTIVO',
    h1: 'Il preventivo per il suo soggiorno',
    intro: 'Ecco che cosa possiamo proporle per le date che ci ha indicato, con le tariffe di oggi.',
    notti: (n) => `${n} ${n === 1 ? 'notte' : 'notti'}`,
    ospiti: (a, b) => `${a} ${a === 1 ? 'adulto' : 'adulti'}${b ? ` e ${b} ${b === 1 ? 'bambino' : 'bambini'}` : ''}`,
    usoSingola: 'in uso singola',
    aPersona: 'a persona',
    totale: 'totale soggiorno',
    cure: 'di cui cure e trattamenti',
    sc5: 'sconto fedelt&agrave; 5% gi&agrave; compreso',
    sc3: 'e in pi&ugrave; 3% per il pagamento anticipato, reso alla partenza',
    sapereTitolo: 'Da sapere',
    avviso: 'I prezzi sono le tariffe di oggi e cambiano con l&rsquo;occupazione. Questo preventivo <strong style="color:#2A2E2B;">non blocca la camera</strong>: la disponibilit&agrave; si verifica al momento della conferma.',
    chiudi: 'Se una di queste soluzioni le piace, ci risponda a questa email: le prepariamo l&rsquo;offerta e teniamo la camera.',
    noteCure: 'Con l&rsquo;impegnativa del suo medico il ticket &egrave; di <strong style="color:#0F5C64;">55 &euro;</strong> e copre visita medica, dodici fanghi e dodici bagni terapeutici. I turni sono al mattino.',
    noteCane: 'Anche il suo cane &egrave; il benvenuto: <strong style="color:#0F5C64;">13 &euro;</strong> al giorno, da saldare in hotel; il cibo non &egrave; compreso.'
  },
  de: {
    ogg: 'Ihr unverbindliches Angebot &mdash; Hotel Terme Leonardo',
    banda: 'PREISANFRAGE',
    h1: 'Die Preise f&uuml;r Ihren Aufenthalt',
    intro: 'Das k&ouml;nnen wir Ihnen f&uuml;r die genannten Termine anbieten, zu den heutigen Tarifen.',
    notti: (n) => `${n} ${n === 1 ? 'Nacht' : 'N&auml;chte'}`,
    ospiti: (a, b) => `${a} ${a === 1 ? 'Erwachsener' : 'Erwachsene'}${b ? ` und ${b} ${b === 1 ? 'Kind' : 'Kinder'}` : ''}`,
    usoSingola: 'zur Alleinbenutzung',
    aPersona: 'pro Person',
    totale: 'Gesamt',
    cure: 'davon Kuren und Behandlungen',
    sc5: '5 % Treuerabatt bereits enthalten',
    sc3: 'zus&auml;tzlich 3 % bei Vorauszahlung, bei der Abreise verrechnet',
    sapereTitolo: 'Gut zu wissen',
    avviso: 'Die Preise sind die heutigen Tarife und &auml;ndern sich mit der Belegung. Mit dieser Preisangabe ist <strong style="color:#2A2E2B;">noch kein Zimmer reserviert</strong>: die Verf&uuml;gbarkeit wird bei der Best&auml;tigung gepr&uuml;ft.',
    chiudi: 'Wenn Ihnen eine dieser M&ouml;glichkeiten zusagt, antworten Sie einfach auf diese E-Mail: wir bereiten das Angebot vor und halten das Zimmer f&uuml;r Sie.',
    noteCure: 'Mit der &auml;rztlichen Verordnung betr&auml;gt der Ticketanteil <strong style="color:#0F5C64;">55 &euro;</strong> und umfasst die &auml;rztliche Untersuchung, zw&ouml;lf Fangopackungen und zw&ouml;lf Thermalb&auml;der. Die Anwendungen finden vormittags statt.',
    noteCane: 'Auch Ihr Hund ist willkommen: <strong style="color:#0F5C64;">13 &euro;</strong> pro Tag, vor Ort zu zahlen; Futter nicht inbegriffen.'
  },
  en: {
    ogg: 'Your quotation &mdash; Hotel Terme Leonardo',
    banda: 'QUOTATION',
    h1: 'A quotation for your stay',
    intro: 'Here is what we can offer for the dates you gave us, at today&rsquo;s rates.',
    notti: (n) => `${n} ${n === 1 ? 'night' : 'nights'}`,
    ospiti: (a, b) => `${a} ${a === 1 ? 'adult' : 'adults'}${b ? ` and ${b} ${b === 1 ? 'child' : 'children'}` : ''}`,
    usoSingola: 'for single use',
    aPersona: 'per person',
    totale: 'total stay',
    cure: 'of which spa treatments',
    sc5: '5% loyalty discount already included',
    sc3: 'plus 3% for advance payment, refunded on departure',
    sapereTitolo: 'Good to know',
    avviso: 'These are today&rsquo;s rates and they change with occupancy. This quotation <strong style="color:#2A2E2B;">does not hold the room</strong>: availability is checked at the time of confirmation.',
    chiudi: 'If one of these suits you, just reply to this email: we will prepare the offer and hold the room for you.',
    noteCure: 'With your doctor&rsquo;s prescription the ticket is <strong style="color:#0F5C64;">&euro;55</strong> and covers the medical examination, twelve mud packs and twelve thermal baths. Treatments take place in the morning.',
    noteCane: 'Your dog is welcome too: <strong style="color:#0F5C64;">&euro;13</strong> per day, payable at the hotel; food not included.'
  },
  fr: {
    ogg: 'Votre devis &mdash; Hotel Terme Leonardo',
    banda: 'DEVIS',
    h1: 'Le devis pour votre s&eacute;jour',
    intro: 'Voici ce que nous pouvons vous proposer pour les dates indiqu&eacute;es, aux tarifs du jour.',
    notti: (n) => `${n} ${n === 1 ? 'nuit' : 'nuits'}`,
    ospiti: (a, b) => `${a} ${a === 1 ? 'adulte' : 'adultes'}${b ? ` et ${b} ${b === 1 ? 'enfant' : 'enfants'}` : ''}`,
    usoSingola: 'en usage individuel',
    aPersona: 'par personne',
    totale: 's&eacute;jour complet',
    cure: 'dont cures et soins',
    sc5: 'remise fid&eacute;lit&eacute; de 5 % d&eacute;j&agrave; comprise',
    sc3: 'et 3 % pour le paiement anticip&eacute;, rendus au d&eacute;part',
    sapereTitolo: '&Agrave; savoir',
    avviso: 'Ce sont les tarifs du jour et ils changent avec le taux d&rsquo;occupation. Ce devis <strong style="color:#2A2E2B;">ne bloque pas la chambre</strong> : la disponibilit&eacute; est v&eacute;rifi&eacute;e au moment de la confirmation.',
    chiudi: 'Si l&rsquo;une de ces solutions vous convient, r&eacute;pondez simplement &agrave; cet e-mail : nous pr&eacute;parons l&rsquo;offre et gardons la chambre.',
    noteCure: 'Avec l&rsquo;ordonnance de votre m&eacute;decin, le ticket est de <strong style="color:#0F5C64;">55 &euro;</strong> et comprend la visite m&eacute;dicale, douze applications de fango et douze bains thermaux. Les soins ont lieu le matin.',
    noteCane: 'Votre chien est lui aussi le bienvenu : <strong style="color:#0F5C64;">13 &euro;</strong> par jour, &agrave; r&eacute;gler &agrave; l&rsquo;h&ocirc;tel ; nourriture non comprise.'
  }
};

/* la descrizione della camera e la dotazione: gli stessi dizionari delle
   offerte vere, uno per lingua. Non se ne scrive un quinto. */
function descrizionePreventivo(categoria, lingua) {
  const diz = lingua === 'de' ? ZIMMER_DE
            : lingua === 'en' ? ROOMS_EN
            : lingua === 'fr' ? CHAMBRES_FR
            : CAMERE_IT;
  return descrizioneCamera(categoria, diz);
}

function dotazionePreventivo(lingua) {
  if (lingua === 'de') return AUSSTATTUNG_DE;
  if (lingua === 'en') return AMENITIES_EN;
  if (lingua === 'fr') return EQUIPEMENTS_FR;
  return DOTAZIONE_IT;
}

/* la categoria nella lingua del documento, con l'uso singola quando
   l'ospite e' solo. Le mappe sono quelle delle offerte vere: non se ne
   scrive una seconda. */
function categoriaPreventivo(nome, adulti, lingua) {
  let base = nome;
  if (lingua === 'de') base = kategorieDE(nome);
  else if (lingua === 'en') base = categoryEN(nome);
  else if (lingua === 'fr') base = categorieFR(nome);
  else if (base === base.toUpperCase() && /[A-Z]/.test(base)) {
    base = base.toLowerCase().replace(/(^|[\s&(\/-])([a-z\u00e0-\u00f9])/g, (m, p, c) => p + c.toUpperCase());
  }
  if ((adulti || 1) !== 1) return base;
  const t = PREVENTIVO_T[lingua] || PREVENTIVO_T.it;
  return `${base} ${t.usoSingola}`;
}

function costruisciPreventivoBase(d, opzioni, lingua) {
  const o = opzioni || {};
  const t = PREVENTIVO_T[lingua] || PREVENTIVO_T.it;
  const voci = d.voci || [];

  /* una stima non si manda: il modale non la fa passare, e se ci
     arriva lo stesso e' un difetto, non un caso da gestire in silenzio */
  if (voci.some((v) => v.stima)) {
    throw new Error('preventivo: una voce ha un prezzo stimato, non si manda');
  }
  if (!voci.length) throw new Error('preventivo: nessuna sistemazione scelta');

  const soldi = (cent) => importoLingua((cent || 0) / 100, lingua);
  const dal = dataExtra(d.giornoArrivo, d.mese, d.anno, lingua);
  const al = dataExtra(d.giornoPartenza, d.mesePartenza || d.mese, d.annoPartenza || d.anno, lingua);

  const righe = voci.map((v) => {
    const extra = [];
    if (v.cure) extra.push(`${t.cure} ${soldi(v.cure)} ${t.aPersona}`);
    if (v.sconto5) extra.push(t.sc5);
    if (v.sconto3) extra.push(`${t.sc3} (${soldi(v.sconto3)})`);
    const desc = descrizionePreventivo(v.categoria, lingua);
    /* i bambini col loro prezzo per eta': rigaBambini li vuole in euro e
       le eta' come stringa, ed e' la stessa funzione delle offerte vere */
    const bimbi = (v.bambiniPrezzi && v.bambiniPrezzi.length)
      ? rigaBambini({ bambiniPrezzi: v.bambiniPrezzi.map((x) => x / 100),
                      etaBambini: (d.etaBambini || []).join(' ') }, lingua)
      : '';
    return `
    <tr><td style="padding:0 0 14px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#FAF8F4;border-left:3px solid #1E7F88;">
        <tr><td style="padding:14px 18px;">
          <div style="font-family:Georgia,'Times New Roman',serif;font-size:17px;line-height:24px;color:#2A2E2B;">${categoriaPreventivo(v.categoria, d.adulti, lingua)}</div>
          ${desc ? `<div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#7B756A;padding-top:2px;">${desc}</div>` : ''}
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;padding-top:6px;">${traduciTrattamento(v.trattamento, lingua)}</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;padding-top:8px;">
            <tr><td style="padding:0 10px 3px 0;color:#8C8578;">${t.aPersona}</td>
                <td align="right" style="padding:0 0 3px 0;white-space:nowrap;">${soldi(v.prezzoPP)}${bimbi}</td></tr>
            <tr><td style="padding:0 10px 0 0;color:#8C8578;">${t.totale}</td>
                <td align="right" style="padding:0;white-space:nowrap;"><strong style="color:#0F5C64;font-size:16px;">${soldi(v.totale)}</strong></td></tr>
          </table>
          ${extra.length ? `<div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:19px;color:#7B756A;padding-top:6px;">${extra.join(' &middot; ')}</div>` : ''}
          ${notaPacchetto(v.trattamento, lingua)}
        </td></tr>
      </table>
    </td></tr>`;
  }).join('');

  /* cure e cane: due righe, non i blocchi interi dell'offerta. Un
     preventivo non e' il posto per i turni dei fanghi e le condizioni:
     quelle stanno nell'offerta, che si manda quando l'ospite accetta. */
  const aggiunte = [];
  if (o.cure) aggiunte.push(t.noteCure);
  if (o.cane) aggiunte.push(t.noteCane);

  const corpo = `
  <tr><td style="padding:16px 36px 0 36px;">
    <p style="margin:0 0 14px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:22px;color:#2A2E2B;">${salutoExtra(d, o, lingua)},</p>
    <h1 style="margin:0 0 10px 0;font-family:Georgia,'Times New Roman',serif;font-size:25px;line-height:31px;font-weight:normal;color:#2A2E2B;">${t.h1}</h1>
    <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">${t.intro}</p>
  </td></tr>

  <tr><td style="padding:16px 36px 0 36px;">
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#1E7F88;padding-bottom:6px;">${dal} &ndash; ${al}</div>
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;padding-bottom:14px;">${t.notti(d.notti)} &middot; ${t.ospiti(d.adulti, d.bambini || 0)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${righe}</table>
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:19px;color:#A79E8F;padding:2px 0 4px 0;">${dotazionePreventivo(lingua)}</div>
  </td></tr>

  ${aggiunte.length ? `<tr><td style="padding:14px 36px 0 36px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#E3F0F1;">
      <tr><td style="padding:16px 20px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:23px;color:#3C6266;">
        ${aggiunte.join('<br /><br />')}
      </td></tr>
    </table>
  </td></tr>` : ''}

  <tr><td style="padding:16px 36px 0 36px;">
    <h2 style="margin:0 0 8px 0;font-family:Georgia,'Times New Roman',serif;font-size:17px;line-height:24px;font-weight:normal;color:#2A2E2B;">${t.sapereTitolo}</h2>
    <p style="margin:0 0 12px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">${t.avviso}</p>
    <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#55524B;">${t.chiudi}</p>
  </td></tr>`;

  return corniceExtra(t.banda, corpo, o, lingua);
}

function costruisciPreventivoIT(d, o) { return costruisciPreventivoBase(d, o, 'it'); }
function costruisciPreventivoDE(d, o) { return costruisciPreventivoBase(d, o, 'de'); }
function costruisciPreventivoEN(d, o) { return costruisciPreventivoBase(d, o, 'en'); }
function costruisciPreventivoFR(d, o) { return costruisciPreventivoBase(d, o, 'fr'); }
function oggettoPreventivoIT() { return PREVENTIVO_T.it.ogg.replace(/&mdash;/g, '\u2014'); }
function oggettoPreventivoDE() { return PREVENTIVO_T.de.ogg.replace(/&mdash;/g, '\u2014'); }
function oggettoPreventivoEN() { return PREVENTIVO_T.en.ogg.replace(/&mdash;/g, '\u2014'); }
function oggettoPreventivoFR() { return PREVENTIVO_T.fr.ogg.replace(/&mdash;/g, '\u2014'); }
```

- [ ] **Step 4: Eseguire le prove**

Run: `deno test --allow-read estensione/preventivo.test.ts`
Expected: PASS, tutte.

Se «uso singola» fallisce in una lingua, la causa è che `categoriaPreventivo` riceve `d.adulti` diverso da 1: controllare che la prova metta `d.adulti = 1`. Se una parola vietata scatta, **non allentare la prova**: cambiare il testo del modello.

- [ ] **Step 5: Eseguire tutte le prove, per non aver rotto le altre**

Run: `deno test --allow-read estensione/`
Expected: PASS (`allineata.test.ts` può segnalare che la reception non è allineata: è atteso, si allinea nel Task 4.)

- [ ] **Step 6: Commit**

```bash
git add estensione/template-extra.js estensione/preventivo.test.ts
git commit -m "Il preventivo ha un modello suo, e non puo' somigliare a un'offerta"
```

---

## Task 2: Il modale raccoglie la selezione

**Files:**
- Modify: `estensione/fidra-disponibilita.js` — `disegna()` (da riga 658), la cella dei pulsanti (righe 826-833), e in coda alla funzione gli agganci (righe 861-880)
- Modify: `estensione/preventivo.test.ts` (aggiunta in coda)

**Interfaces:**
- Consuma: niente dal Task 1.
- Produce: la chiave `chrome.storage.local.leonardo_preventivo`, nella forma
  ```js
  { quando, arrivo:'2026-08-23', partenza:'2026-08-26', notti:3,
    adulti:2, etaBambini:[],
    voci:[{categoria, trattamento, prezzoPP, totale, cure,
           sconto5, sconto3, bambiniPrezzi:[], stima:false}] }
  ```
  `arrivo`/`partenza` in ISO, importi in centesimi. Le voci hanno **sempre**
  `stima:false`: quelle stimate non entrano. `bambiniPrezzi` è in ordine di
  `etaBambini`, uno zero è un bambino gratuito.

- [ ] **Step 1: Dichiarare il carrello**

In `fidra-disponibilita.js`, subito dentro `function apri() {` (riga 522), prima di ogni altra cosa nel corpo:

```js
    /* le sistemazioni messe da parte per il preventivo. Vive quanto il
       riquadro: chiuderlo e riaprirlo azzera la scelta, ed e' giusto —
       una selezione fatta su una ricerca non vale per la successiva. */
    const SCELTE = [];
    const MAX_SCELTE = 4;
```

- [ ] **Step 2: Aggiungere il pulsante nella riga**

In `disegna()`, sostituire la cella dei pulsanti (attualmente `<td class="pr">` con il solo `.scorpora`) con:

```js
              <td class="pr">
                <button class="usa scorpora"
                  data-cat="${esc(nome)}" data-tratt="${esc(rv.full_name || rv.name)}"
                  data-idx="${variazioni.indexOf(rv)}">&#128208; Notte per notte</button>
                <button class="usa prev"
                  data-cat="${esc(nome)}" data-tratt="${esc(rv.full_name || rv.name)}"
                  data-pp="${c.perPersona}" data-tot="${c.totale}" data-cure="${cureTot}"
                  data-sc5="${sconto ? sconto.imp5 : 0}" data-sc3="${sconto ? sconto.imp3 : 0}"
                  data-bimbi="${c.dettaglioB.map(b => b.prezzo || 0).join(',')}"
                  ${sconto && sconto.stima
                    ? 'disabled title="Il 5% qui &egrave; una stima: il conto esatto sta in Notte per notte, e una stima non si manda a un cliente."'
                    : ''}>+ Prev.</button>
              </td>
```

- [ ] **Step 3: Disegnare la barra e agganciare i pulsanti**

In `disegna()`, subito dopo `$('dRis').innerHTML = html;`, aggiungere:

```js
      /* ---------- barra del preventivo ---------- */
      function aggiornaBarra() {
        const b = $('dPrevBarra');
        if (!b) return;
        if (!SCELTE.length) { b.style.display = 'none'; return; }
        b.style.display = 'block';
        b.innerHTML = `<span>${SCELTE.length} ${SCELTE.length === 1
            ? 'sistemazione scelta' : 'sistemazioni scelte'}${
            SCELTE.length >= MAX_SCELTE ? ' &middot; il massimo &egrave; quattro' : ''}</span>
          <button class="usa" id="dPrevSvuota">Svuota</button>
          <button class="usa" id="dPrevCrea">Crea preventivo</button>`;
        $('dPrevSvuota').onclick = () => { SCELTE.length = 0; aggiornaBarra(); marcaPulsanti(); };
        $('dPrevCrea').onclick = creaPreventivo;
      }

      /* un pulsante gia' scelto lo dice, e togliendolo si toglie dalla lista */
      function marcaPulsanti() {
        $('dRis').querySelectorAll('.prev').forEach(b => {
          if (b.disabled && !b.dataset.scelto) return;   // stima: resta spento
          const dentro = SCELTE.some(v => v.categoria === b.dataset.cat &&
                                          v.trattamento === b.dataset.tratt);
          b.dataset.scelto = dentro ? '1' : '';
          b.textContent = dentro ? '\u2713 nel preventivo' : '+ Prev.';
          b.disabled = !dentro && SCELTE.length >= MAX_SCELTE;
        });
      }

      $('dRis').querySelectorAll('.prev').forEach(b => b.addEventListener('click', () => {
        const i = SCELTE.findIndex(v => v.categoria === b.dataset.cat &&
                                        v.trattamento === b.dataset.tratt);
        if (i >= 0) SCELTE.splice(i, 1);
        else if (SCELTE.length < MAX_SCELTE) SCELTE.push({
          categoria:   b.dataset.cat,
          trattamento: b.dataset.tratt,
          prezzoPP: +b.dataset.pp  || 0,
          totale:   +b.dataset.tot || 0,
          cure:     +b.dataset.cure || 0,
          sconto5:  +b.dataset.sc5 || 0,
          sconto3:  +b.dataset.sc3 || 0,
          /* il prezzo di ogni bambino per eta', in centesimi: il modale
             lo ha gia' calcolato, e buttarlo via vorrebbe dire farlo
             ricopiare a mano proprio a chi non deve ricopiare niente.
             Uno zero e' un bambino gratuito, e va detto anche quello. */
          bambiniPrezzi: (b.dataset.bimbi || '').split(',').filter((x) => x !== '').map(Number),
          stima: false
        });
        marcaPulsanti();
        aggiornaBarra();
      }));

      async function creaPreventivo() {
        if (!SCELTE.length) return;
        const dato = {
          quando: Date.now(),
          arrivo, partenza, notti: nNotti,
          adulti, etaBambini: etaBambini.slice(),
          voci: SCELTE.slice()
        };
        const box = $('dEsito');
        try {
          if (!ESTENSIONE) throw new Error('serve l\u2019estensione, non il segnalibro');
          await chrome.storage.local.set({ leonardo_preventivo: dato });
          box.style.color = '#0F5C64';
          box.textContent = 'Preventivo pronto: apri il pannello (Ctrl+Shift+L) e scegli '
            + '\u00abPreventivo soggiorno\u00bb. Vale mezz\u2019ora.';
        } catch (e) {
          box.style.color = '#B3541E';
          box.textContent = 'Preventivo non messo da parte: ' + e.message;
        }
      }

      marcaPulsanti();
      aggiornaBarra();
```

E aggiungere il contenitore della barra: nel modello HTML del riquadro (dentro `apri()`), subito **dopo** l'elemento `dRis`, inserire

```html
      <div id="dPrevBarra" style="display:none;position:sticky;bottom:0;background:#FAF8F4;border-top:1px solid #EDE7DC;padding:10px 16px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#55524B;"></div>
```

- [ ] **Step 4: Scrivere la prova strutturale**

`fidra-disponibilita.js` è una IIFE che tocca il DOM: non si carica con `new Function`, quindi si sorveglia il testo. Aggiungere in coda a `estensione/preventivo.test.ts`:

```ts
/* ============================================================
   Il modale non si puo' eseguire in Deno: e' una IIFE che tocca il
   DOM di Fidra. Queste prove leggono il testo — meno di una prova
   vera, ma tengono ferme le due cose che, cambiando, romperebbero
   il preventivo in silenzio.
   ============================================================ */
const MODALE = Deno.readTextFileSync(new URL('fidra-disponibilita.js', import.meta.url));

Deno.test('il modale deposita leonardo_preventivo e nient altro di nuovo', () => {
  assert(MODALE.includes('leonardo_preventivo'),
    'il modale non scrive piu la chiave che il pannello legge');
  assert(MODALE.includes('leonardo_dettaglio'),
    'la strada del dettaglio notte per notte e sparita: non andava toccata');
});

Deno.test('una tariffa con sconto stimato ha il pulsante spento', () => {
  /* il ramo che spegne il pulsante e' l'unica cosa che impedisce a una
     stima di diventare una promessa in un'email */
  assert(/sconto\s*&&\s*sconto\.stima/.test(MODALE),
    'sparito il controllo su sconto.stima: le stime tornano preventivabili');
});

Deno.test('il massimo di quattro voci e scritto una volta sola', () => {
  const n = (MODALE.match(/MAX_SCELTE/g) || []).length;
  assert(n >= 3, 'MAX_SCELTE non e usato dove serve');
  assert(!/SCELTE\.length\s*>=\s*4\b/.test(MODALE),
    'il numero quattro e scritto a mano invece di MAX_SCELTE');
});
```

- [ ] **Step 5: Eseguire le prove**

Run: `deno test --allow-read estensione/preventivo.test.ts`
Expected: PASS.

- [ ] **Step 6: Provare a mano dentro Fidra**

Non c'è modo di provare il DOM di Fidra in Deno, quindi si guarda:

1. `node strumenti/estensione.js`
2. `chrome://extensions` → Ricarica
3. Aprire `leonardo.fidra.cloud`, riquadro «Disponibilità e prezzi», cercare 23→26 agosto 2026, 2 adulti
4. Verificare: `+ Prev.` su ogni riga; cliccandone una diventa `✓ nel preventivo` e la barra dice «1 sistemazione scelta»; alla quinta i pulsanti liberi si spengono; `Svuota` riporta tutto com'era
5. Rifare la ricerca con uno **sconto pensione** su un pacchetto settimanale più coda: il `+ Prev.` di quella riga è spento e il `title` spiega perché
6. `Crea preventivo` → il riquadro d'esito dice che è pronto

- [ ] **Step 7: Commit**

```bash
git add estensione/fidra-disponibilita.js estensione/preventivo.test.ts
git commit -m "Dalle righe della disponibilita' si mettono da parte fino a quattro sistemazioni"
```

---

## Task 3: Il pannello monta il documento, e il modulo manuale sparisce

**Files:**
- Modify: `estensione/popup.js` — `disegnaRapido()` (499), `costruisciDatiRapidi()` (625), `aggiungiCameraRapida()` (549, da cancellare), `MODELLI` (935 **e** 1020)
- Modify: `estensione/preventivo.test.ts` (aggiunta in coda)

**Interfaces:**
- Consuma: `chrome.storage.local.leonardo_preventivo` dal Task 2; `costruisciPreventivoIT|DE|EN|FR` e `oggettoPreventivoIT|DE|EN|FR` dal Task 1.
- Produce: niente per altri task.

- [ ] **Step 1: Leggere il preventivo all'apertura del pannello**

In `popup.js`, accanto a `let MODO = 'fidra';` (riga 6) aggiungere:

```js
let PREVENTIVO = null;   // leonardo_preventivo fresco, se c'e'
```

In `disegnaRapido()`, subito dopo `const salvate = await chrome.storage.local.get(['firma']);`:

```js
  /* v2.9: il preventivo preparato nel riquadro «Disponibilita' e prezzi».
     Mezz'ora, come il dettaglio notte per notte: oltre, i prezzi possono
     essere cambiati e un preventivo vecchio e' peggio di nessun preventivo. */
  PREVENTIVO = null;
  try {
    const r = await chrome.storage.local.get(['leonardo_preventivo']);
    const p = r.leonardo_preventivo;
    if (p && p.voci && p.voci.length && Date.now() - (p.quando || 0) <= 30 * 60 * 1000) {
      PREVENTIVO = p;
    }
  } catch (e) { /* senza, la voce semplicemente non compare */ }
```

- [ ] **Step 2: Disegnare la terza voce, solo se c'è**

In `disegnaRapido()`, dentro `$('corpo').innerHTML`, **dopo** la riga del radio `buoni`, inserire:

```js
    ${PREVENTIVO ? `<label><input type="radio" name="doc" value="preventivo" /> Preventivo soggiorno
      <span class="sub">(le sistemazioni scelte in &laquo;Disponibilit&agrave; e prezzi&raquo;)</span></label>
    <div class="box sub" style="margin-top:6px;">
      <strong>${esc(dataBreve(PREVENTIVO.arrivo))} &rarr; ${esc(dataBreve(PREVENTIVO.partenza))}</strong>
      &middot; ${PREVENTIVO.notti} ${PREVENTIVO.notti === 1 ? 'notte' : 'notti'}
      &middot; ${PREVENTIVO.adulti} ${PREVENTIVO.adulti === 1 ? 'adulto' : 'adulti'}
      ${PREVENTIVO.etaBambini.length ? '&middot; ' + PREVENTIVO.etaBambini.length + ' bambini' : ''}
      <div style="padding-top:5px;">${PREVENTIVO.voci.map(v =>
        `${esc(v.categoria)} &middot; ${esc(v.trattamento)} &mdash; <strong>${euroFmt(v.totale / 100)} &euro;</strong>`
      ).join('<br />')}</div>
      <div style="padding-top:5px;color:#7B756A;">Per cambiarle, torna sul riquadro in Fidra.</div>
    </div>
    <label style="margin-top:6px;"><input type="checkbox" id="optCure" /> Cure termali
      <span class="sub">(impegnativa, ticket 55 &euro;, turni al mattino)</span></label>
    <label><input type="checkbox" id="optCane" /> Cane al seguito
      <span class="sub">(13 &euro; al giorno, si salda in hotel)</span></label>` : ''}
```

Le due spunte esistono già con gli stessi id nella via Fidra (`popup.js:332-335`),
e il gestore di `$('copia')` legge già `$('optCure')?.checked` e `$('optCane')?.checked`
dentro `opzioni`: qui non c'è niente da agganciare, basta che gli elementi ci siano.

E aggiungere, accanto alle altre funzioncine di formato (vicino a `euroFmt`, riga ~484):

```js
/* '2026-08-23' → '23 ago 2026', solo per il riepilogo nel pannello:
   nell'email le date le formatta il modello, in quattro lingue. */
function dataBreve(iso) {
  const M = ['gen','feb','mar','apr','mag','giu','lug','ago','set','ott','nov','dic'];
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return String(iso || '');
  return `${+m[3]} ${M[+m[2] - 1]} ${m[1]}`;
}
```

- [ ] **Step 3: Costruire i dati, e cancellare il modulo manuale**

In `costruisciDatiRapidi()`:

a) Estendere la riga di `senzaSoggiorno` perché il nome resti facoltativo anche qui:

```js
  const senzaSoggiorno = ['dayspa', 'buoni', 'preventivo'].includes(
    document.querySelector('input[name=doc]:checked')?.value);
```

b) Subito **dopo** il blocco `if (['dayspa','buoni'].includes(...)) { ... return { dati: {...} }; }`, aggiungere il ramo del preventivo:

```js
  /* v2.9: il preventivo. I prezzi non si digitano: arrivano dal riquadro
     «Disponibilita' e prezzi», che li ha letti dalle API di Fidra con
     l'uso singola e i bambini gia' dentro. */
  if (document.querySelector('input[name=doc]:checked')?.value === 'preventivo') {
    if (!PREVENTIVO) return { errori: ['il preventivo preparato in Fidra (riaprilo dal riquadro)'] };
    const A = new Date(PREVENTIVO.arrivo + 'T00:00');
    const P = new Date(PREVENTIVO.partenza + 'T00:00');
    if (errori.length) return { errori };
    return { dati: {
      ok: true, rapido: true, preventivo: true, id: null, numeroOfferta: null,
      linkPagamento: null, stato: 'preventivo',
      intestatario: nome, email: $('rapEmail').value.trim(),
      emailAlternative: [], note: [], mancanti: [], profilo: {},
      giornoArrivo: A.getDate(), mese: MESI_ABBR[A.getMonth()], anno: A.getFullYear(),
      giornoPartenza: P.getDate(), mesePartenza: MESI_ABBR[P.getMonth()], annoPartenza: P.getFullYear(),
      notti: PREVENTIVO.notti, adulti: PREVENTIVO.adulti,
      bambini: PREVENTIVO.etaBambini.length,
      /* le eta' servono al modello: rigaBambini abbina prezzo ed eta' per
         rango crescente, e senza le eta' scriverebbe solo la somma */
      etaBambini: PREVENTIVO.etaBambini,
      voci: PREVENTIVO.voci,
      camere: [], nCamere: 0, caparraVersata: 0, caparraDovuta: null
    } };
  }
```

c) **Cancellare tutto quello che resta di `costruisciDatiRapidi()` dopo questo punto** — dal `const a = $('rapArrivo').value, p = $('rapPartenza').value;` fino alla chiusura della funzione — e sostituirlo con:

```js
  /* Non c'e' nessun altro documento che il pannello sappia fare fuori da
     Fidra. Il modulo che chiedeva camere e prezzi a mano stava qui ed e'
     stato tolto il 24 agosto 2026: e' il caso Kreiner, «ho copiato il
     modello con prezzi dus non inseriti». Un prezzo digitato e' un prezzo
     sbagliato, e adesso c'e' un modo di leggerlo. */
  return { errori: ['un documento che il pannello sappia fare senza Fidra'] };
}
```

d) **Cancellare** la funzione `aggiungiCameraRapida()` (riga 549) per intero, e le costanti che restano senza consumatori: `CATEGORIE_RAPIDO`, `TRATTAMENTI_RAPIDO`, `STILE_IN`, e `limiteCategoria` **solo se** non è usata altrove (verificare con `grep -n limiteCategoria popup.js`; se serve alla via Fidra, lasciarla).

- [ ] **Step 4: Aggiungere il modello alle due tabelle `MODELLI`**

In **entrambe** le tabelle (righe 935 e 1020), aggiungere la riga:

```js
    preventivo: { it:[costruisciPreventivoIT, oggettoPreventivoIT], de:[costruisciPreventivoDE, oggettoPreventivoDE],
                  en:[costruisciPreventivoEN, oggettoPreventivoEN], fr:[costruisciPreventivoFR, oggettoPreventivoFR] },
```

E nel messaggio d'esito dopo l'apertura di Outlook (riga ~986), estendere il ramo `rapido`:

```js
        : (MODO === 'rapido' && doc === 'preventivo'
            ? 'Outlook aperto: il testo si inserisce da solo \u2014 se l\'ospite accetta, apri la pratica in Fidra e manda l\'offerta'
            : (MODO === 'rapido' && doc === 'offerta'
                ? 'Outlook aperto: il testo si inserisce da solo \u2014 quando l\'ospite accetta, registra l\'offerta in Fidra'
                : 'Outlook aperto: il testo si inserisce da solo (in riserva: Ctrl+V)'));
```

- [ ] **Step 5: Scrivere la prova che il modulo manuale non torna**

In coda a `estensione/preventivo.test.ts`:

```ts
const PANNELLO = Deno.readTextFileSync(new URL('popup.js', import.meta.url));

Deno.test('nel pannello non esiste piu nessun campo dove digitare un prezzo', () => {
  /* IL PUNTO DI TUTTA LA FUNZIONE. Se questi id tornano, e tornato anche
     il caso Kreiner: un prezzo scritto a mano, senza uso singola. */
  for (const id of ['rapPrezzo', 'rapAcconto', 'rapScadenza', 'rapRif', 'rapArrivo', 'camRapida']) {
    assert(!PANNELLO.includes(id), `«${id}» e tornato nel pannello: i prezzi si digitano di nuovo`);
  }
  assert(!PANNELLO.includes('aggiungiCameraRapida'),
    'aggiungiCameraRapida e tornata: era il modulo manuale');
});

Deno.test('il preventivo e in tutte e due le tabelle MODELLI', () => {
  const n = (PANNELLO.match(/preventivo:\s*\{\s*it:\s*\[costruisciPreventivoIT/g) || []).length;
  assertEquals(n, 2,
    'MODELLI e definito due volte in popup.js: il preventivo deve stare in tutte e due, ' +
    'altrimenti «Copia oggetto» e «Copia» si comportano diversamente');
});

Deno.test('la voce compare solo con un preventivo fresco', () => {
  assert(/30 \* 60 \* 1000/.test(PANNELLO), 'sparita la soglia della mezz ora');
  assert(/PREVENTIVO\s*\?/.test(PANNELLO),
    'la voce «Preventivo soggiorno» non e piu condizionata alla presenza del dato');
});
```

- [ ] **Step 6: Eseguire tutte le prove**

Run: `deno test --allow-read estensione/`
Expected: PASS, salvo `allineata.test.ts` che segnala il disallineamento (si sistema nel Task 4).

- [ ] **Step 7: Provare a mano il giro intero**

1. `node strumenti/estensione.js`, poi Ricarica da `chrome://extensions`
2. In Fidra: cerca 23→26 agosto 2026, 2 adulti; scegli due sistemazioni; `Crea preventivo`
3. `Ctrl+Shift+L` → il pannello dice «Fuori da Fidra» e ha **tre** voci; il riepilogo mostra periodo, ospiti e le due sistemazioni
4. Nome, email, lingua **Deutsch**, `Copia e apri Outlook` → l'email tedesca contiene i due prezzi, la descrizione delle camere («16 m², Doppelbett…»), la dotazione, dice «noch kein Zimmer reserviert», e **non** contiene numero d'offerta né acconto
5. Ripetere in EN e FR
6. **Un pacchetto:** rifare la ricerca su un periodo con «Dolce Vita 10 cure» o «Spezial»; il preventivo deve portare il blocco «IL PACCHETTO COMPRENDE» con dentro **dieci** applicazioni, non il segnaposto `{N}`
7. **Bambini:** cercare con 2 adulti e due bambini di età diverse (es. 5 e 11); il preventivo deve dare a ciascuno il **suo** prezzo, e un bambino gratuito deve risultare gratuito
8. **Spunte:** con «Cure termali» e «Cane al seguito» compaiono le due righe; senza, non compaiono
9. Aspettare oltre mezz'ora (o modificare `quando` da `chrome://extensions` → service worker → console): la voce non compare più
10. Aprire il pannello da una prenotazione Fidra: nulla è cambiato, offerta e conferma escono come prima

- [ ] **Step 8: Commit**

```bash
git add estensione/popup.js estensione/preventivo.test.ts
git commit -m "Il pannello monta il preventivo, e il modulo dei prezzi a mano se ne va"
```

---

## Task 4: Versione, allineamento, diario

**Files:**
- Modify: `estensione/manifest.json`
- Modify: `estensione/LEGGIMI-v2_6_1.md`

- [ ] **Step 1: Alzare la versione**

In `estensione/manifest.json`, `"version": "2.8.13"` → `"version": "2.9.0"`. Funzione nuova, non correzione.

- [ ] **Step 2: Scrivere il diario**

In coda a `estensione/LEGGIMI-v2_6_1.md`:

```markdown
---

## v2.9.0 — il preventivo torna, con i prezzi letti (24/08/2026)

Una richiesta di prezzi arriva per email e l'ospite non ha una pratica in
Fidra: per rispondergli bisognava aprirgliene una.

**Il preventivo fuori da Fidra c'era gia'.** Il codice era ancora tutto li'
spento — `aggiungiCameraRapida()` definita e mai chiamata, `costruisciDatiRapidi()`
che leggeva ancora `rapPrezzo` e `rapAcconto`, e a riga 986 il messaggio
«quando l'ospite accetta, registra l'offerta in Fidra». Fu tolto per una
ragione buona: chiedeva **il prezzo a persona in una casella**, ed e' il caso
Kreiner, «ho copiato il modello con prezzi dus non inseriti».

Torna perche' quella ragione non c'e' piu'. «Disponibilita' e prezzi» i prezzi
non li fa digitare: li legge da `/api/available/rooms` e `/api/available/rates`
con la sessione dell'operatore, e `calcola()` ci mette dentro l'uso singola e i
bambini per eta' — i due numeri che a mano non venivano messi.

### Come si usa

Nel riquadro, accanto a «Notte per notte», ogni riga ha `+ Prev.`. Se ne
scelgono fino a quattro, si preme «Crea preventivo», si apre il pannello
(Ctrl+Shift+L) e si sceglie «Preventivo soggiorno». Nome e lingua, e l'email
esce in italiano, tedesco, inglese o francese.

### Le tre regole che il codice fa rispettare

- **Nel pannello non c'e' un solo campo dove digitare un prezzo.** Se il
  preventivo non e' stato preparato, la voce non compare — non esiste un
  ripiego manuale. Il vecchio modulo e' stato cancellato, e una prova
  (`preventivo.test.ts`) diventa rossa se `rapPrezzo` o `aggiungiCameraRapida`
  tornano nel file.
- **Non puo' somigliare a un'offerta.** Niente numero, acconto, scadenza,
  «Conferma Ora», IBAN: una prova cerca quelle parole in tutte e quattro le
  lingue e fallisce se ne trova una. Dice invece, in tutte e quattro, che
  **non blocca la camera**.
- **Una stima non si manda.** Con un pacchetto settimanale piu' una coda di
  notti il 5% e' una stima — lo dice gia' il modale. Li' il pulsante e' spento;
  e se una voce cosi' arrivasse lo stesso al modello, il modello solleva un
  errore invece di scriverla.

### Che cosa c'e' dentro l'email

Non solo il prezzo. Il preventivo porta le stesse cose che porta un'offerta,
perche' sono le stesse funzioni:

- **che cosa comprende il pacchetto** — `notaPacchetto`: Dolce Vita, Spezial,
  Golf, Smart, Escape, Deluxe, Sommer, Metaforum, e il numero di applicazioni
  letto dal nome della tariffa («Spezial 10 cure» scrive dieci);
- **com'e' fatta la camera** — metratura, letti, balcone, e la dotazione
  comune, dai dizionari `CAMERE_IT` / `ZIMMER_DE` / `ROOMS_EN` / `CHAMBRES_FR`;
- **i bambini con il loro prezzo per eta'** — il modale lo calcola gia',
  `rigaBambini` lo scrive gia': prima si buttava via e restava il conteggio;
- **cure termali e cane**, con due spunte nel pannello. Qui una riga, non i
  blocchi interi dell'offerta: i turni dei fanghi e le condizioni stanno
  nell'offerta, che si manda quando l'ospite accetta.

La **culla** non c'e' perche' non c'e' nei modelli email: sta nel modulo del
sito, ed e' un altro pezzo.

### Dove sta

Il documento e' in `template-extra.js`, insieme a Info Day Spa e Buoni regalo:
sono i tre che non vengono da una prenotazione. Un solo costruttore e una
tabella a quattro lingue, come gli altri due — non quattro file da ricordare.

Il modale **non traduce**: passa i nomi in italiano come li scrive Fidra, e a
tradurre pensano `traduciTrattamento`, `kategorieDE`, `categoryEN`,
`categorieFR`, che le offerte vere usano da mesi.

### Niente link di pagamento, ed e' voluto

Il link della caparra non lo fa Stripe e non lo fa Fidra: lo compone
`extractor.js:322` con l'id della prenotazione, il numero d'offerta e
l'importo. Fuori da una prenotazione non esiste nessuno dei tre, e
`/deposit-payment` riconcilia l'incasso proprio attraverso quell'id.

Prima ancora: il preventivo dichiara di non bloccare la camera. Incassare una
caparra su una camera non tenuta vuol dire poterla vendere a un altro e avere
in mano i soldi di chi resta senza. Quando l'ospite accetta si apre la pratica
in Fidra, e l'offerta esce con il link che gia' funziona.

### Scartato: check-availability

L'endpoint Supabase esiste, ma e' un proxy verso il **sito pubblico** ed espone
solo `rates`, non `rooms`. Senza `rooms` non ci sono numeri di camera ne'
capienza, e `calcola()` non parte perche' la categoria che riceve viene da li'.
Servirebbe se un giorno si volesse preventivare da Outlook senza aprire Fidra:
allora andrebbe esteso, ed e' un altro progetto.
```

- [ ] **Step 3: Allineare la cartella della reception**

Run: `node strumenti/estensione.js`
Expected: elenca i file copiati, fra cui `template-extra.js`, `popup.js`, `fidra-disponibilita.js`, `manifest.json`.

- [ ] **Step 4: Eseguire tutte le prove, allineamento compreso**

Run: `deno test --allow-read estensione/`
Expected: PASS **tutte**, `allineata.test.ts` inclusa. Se quest'ultima è ancora rossa, `node strumenti/estensione.js` non ha copiato: leggere cosa ha detto.

- [ ] **Step 5: Commit**

```bash
git add estensione/manifest.json estensione/LEGGIMI-v2_6_1.md
git commit -m "v2.9.0: il preventivo senza Fidra entra in reception"
```

- [ ] **Step 6: Ricaricare sui computer della reception**

`chrome://extensions` → Ricarica. Dopo il Ricarica il manifest dice **2.9.0**: se dice 2.8.13, non è entrata.

---

## Verifica finale

- [ ] `deno test --allow-read estensione/` — tutto verde, `allineata.test.ts` compresa
- [ ] Il giro intero provato a mano in almeno due lingue (una è il tedesco)
- [ ] Provato con un **pacchetto** (il blocco «comprende» c'è, con il numero giusto di applicazioni) e con **due bambini di età diverse** (ognuno con il suo prezzo)
- [ ] Le spunte **cure** e **cane** aggiungono e tolgono le due righe
- [ ] Aprendo il pannello da una prenotazione Fidra, offerta e conferma sono identiche a prima
- [ ] `grep -n "rapPrezzo\|aggiungiCameraRapida" estensione/popup.js` non trova niente
- [ ] Nessun link di pagamento nel preventivo, in nessuna lingua
- [ ] Il manifest dice 2.9.0 sia nel repo sia nella cartella della reception
