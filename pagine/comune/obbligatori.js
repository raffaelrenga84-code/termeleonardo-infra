/* Quali campi servono davvero, per ogni tipo di richiesta.

   UNA LISTA SOLA. Da qui nascono due cose che devono restare d'accordo:
   l'asterisco sull'etichetta e il controllo prima dell'invio. Erano scritte
   in due posti diversi — l'asterisco da nessuna parte, il controllo dentro
   un `completo()` che rispondeva sì o no — ed e' esattamente cosi' che
   divergono: un campo obbligatorio senza asterisco, o un asterisco su un
   campo che poi nessuno guarda.

   `eti` e' la chiave del nome tradotto nella pagina (t.nome, t.email, …):
   serve a NOMINARE il campo nel messaggio. Senza, si torna al «Compili i
   campi obbligatori», che dice all'ospite che qualcosa non va e non dove.

   Il controllo qui non e' una difesa: quella la fa il server (valida.ts,
   tipi.ts), perche' il browser si aggira. Questo serve a non far perdere
   tempo a chi sta compilando in buona fede. */

/* Nome, email e telefono su tutti. Ognuna di queste richieste e' un
   appuntamento che si puo' spostare, e per spostarlo bisogna poter
   chiamare: il telefono e' obbligatorio come il nome. */
const CONTATTI = [
  { id: 'fNome', eti: 'nome' },
  { id: 'fEmail', eti: 'email' },
  { id: 'fTel', eti: 'tel' },
];

const GIORNO_E_ORA = [
  { id: 'fData', eti: 'quando' },
  { id: 'fOra', eti: 'ora' },
];

/* Il Day Spa non ha un'ora: e' l'ingresso di una giornata (9:00–18:30).
   I trattamenti hanno una fascia, non un orario preciso, e la fascia parte
   gia' con un valore scelto. */
const PER_TIPO = {
  greenfee: GIORNO_E_ORA,
  maestro: GIORNO_E_ORA,
  soggiorno: GIORNO_E_ORA,
  /* Il modulo delle camere (/prenota) e' un'altra pagina e un altro giro:
     le date e la camera si scelgono nei passi precedenti, quindi qui non
     c'e' niente di proprio da chiedere. Restano i contatti, che li'
     mancavano del tutto: il messaggio era scritto a mano e diceva «nome
     ed email» anche quando il campo vuoto era il telefono. */
  prenota: [],
  /* Il transfer ha una pagina sua e nomi suoi: il giorno si chiama
     `fQuando` e non `fData`, e in piu' c'e' la destinazione, che senza non
     si sa nemmeno che corsa sia. Erano stati messi qui gli id degli altri
     moduli, e su quella pagina non avrebbero trovato niente: gli asterischi
     non sarebbero comparsi e il controllo avrebbe lasciato passare tutto,
     tornando a far scoprire il rifiuto solo dopo l'invio. */
  transfer: [
    /* `mostra`: la destinazione E' una <select>, ma sta dentro un riquadro
       chiuso (display:none) — quelle che l'ospite vede sono le dodici
       pastiglie. Segnare di rosso un elemento invisibile e dargli il fuoco
       non porta nessuno da nessuna parte: provato in un browser vero, il
       fuoco restava sul nulla e il modulo diceva che manca la destinazione
       senza mostrare dove sceglierla. */
    { id: 'fLuogo', eti: 'luogo', mostra: 'mete' },
    { id: 'fQuando', eti: 'quando' },
    { id: 'fOra', eti: 'ora' },
  ],
  trattamenti: [{ id: 'fGiorno', eti: 'giorno' }],
  dayspa: [{ id: 'fGiorno', eti: 'giorno' }],
};

export const TIPI_MODULO = Object.keys(PER_TIPO);

/* NELL'ORDINE IN CUI STANNO SUL MODULO: prima il riquadro del tipo (quando,
   a che ora, quale giorno), poi «I suoi dati». Non e' estetica — il
   messaggio elenca cio' che manca in quest'ordine e il fuoco va sul primo,
   quindi un ordine diverso da quello della pagina fa risalire l'ospite dopo
   averlo portato in fondo. Provato in un browser vero: con l'ordine
   sbagliato il messaggio diceva «Nome, Email, Telefono, Giorno, Ora» mentre
   sulla pagina il primo campo vuoto era il giorno, in cima. */
/* Dove un volo o un treno esiste davvero. Chi va a Golf Frassanelle non ne
   ha uno: obbligarlo a scriverne uno vorrebbe dire farglielo inventare, e un
   campo inventato e' peggio di un campo vuoto. Aeroporti, stazioni e porto
   si', il resto no.

   `aeroporto` contiene `porto`, ed e' voluto: e' comunque un posto da cui si
   parte con un volo. */
export function voloRichiesto(luogo) {
  const p = String(luogo ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
  if (!p) return false;
  return /aeroport|\bfs\b|porto|p\.le roma/.test(p);
}

/* `contesto` e' quello che la pagina sa in questo momento — la destinazione
   scelta, se e' spuntato il ritorno — e serve per i campi che diventano
   obbligatori solo in certe situazioni. Chiamare senza contesto continua a
   dare l'elenco di sempre: gli altri moduli non ne hanno bisogno. */
export function campiObbligatori(tipo, contesto = {}) {
  const propri = [...(PER_TIPO[tipo] || GIORNO_E_ORA)];
  if (tipo === 'transfer') {
    if (voloRichiesto(contesto.luogo)) propri.push({ id: 'fVolo', eti: 'volo' });
    /* la spunta del ritorno apre due campi: senza, la reception riceve un
       booleano e deve telefonare per sapere quando */
    if (contesto.ritorno) {
      propri.push({ id: 'fRitornoQuando', eti: 'ritornoQuando' });
      propri.push({ id: 'fRitornoOra', eti: 'ritornoOra' });
    }
  }
  return [...propri, ...CONTATTI];
}

/* Cio' che manca, in ordine di comparsa nel modulo — cosi' chi legge il
   messaggio scende una volta sola. `leggi(id)` la passa la pagina: questo
   modulo non tocca il DOM, e cosi' si puo' provare senza browser.
   Uno spazio non e' un valore: «   » nel telefono e' un telefono che non
   c'e'. */
export function mancanti(tipo, leggi, contesto = {}) {
  return campiObbligatori(tipo, contesto).filter((c) => !String(leggi(c.id) ?? '').trim());
}

/* ---- la parte che tocca la pagina ----
   Sta qui e non dentro i moduli perche' le pagine sono due (le richieste e
   il transfer) e diventeranno tre: due copie di queste quindici righe sono
   due copie che divergono. `doc` si passa per poterle provare, e perche'
   scritto cosi' il modulo si carica anche dove `document` non esiste. */

/* L'asterisco e' decorazione per chi vede: a chi usa un lettore di schermo
   lo dice gia' aria-required, e sentirsi leggere «asterisco» dopo ogni
   etichetta e' rumore. */
/* I campi obbligatori solo in certe situazioni. Servono per TOGLIERE
   l'asterisco quando la situazione cambia: l'ospite sceglie Venezia
   aeroporto, il volo diventa obbligatorio, poi cambia idea per Golf
   Frassanelle — e la stella deve andarsene, o chiederebbe un dato che per
   quella destinazione non esiste. Segnare senza saper desegnare lascia
   bugie sullo schermo. */
const CONDIZIONALI = ['fVolo', 'fRitornoQuando', 'fRitornoOra'];

export function segnaEtichette(tipo, doc, contesto = {}) {
  const richiesti = campiObbligatori(tipo, contesto);
  const adesso = new Set(richiesti.map((c) => c.id));

  for (const id of CONDIZIONALI) {
    if (adesso.has(id)) continue;
    const el = doc.getElementById(id);
    if (el) el.removeAttribute('aria-required');
    const eti = doc.querySelector(`label[for="${id}"]`);
    const stella = eti && eti.querySelector('.obb');
    if (stella) stella.remove();
  }

  for (const c of richiesti) {
    const el = doc.getElementById(c.id);
    if (el) el.setAttribute('aria-required', 'true');
    const eti = doc.querySelector(`label[for="${c.id}"]`);
    if (eti && !eti.querySelector('.obb')) {
      eti.insertAdjacentHTML('beforeend', ' <span class="obb" aria-hidden="true">*</span>');
    }
  }
}

/* Segna i campi vuoti e porta l'ospite sul primo. Il segno si toglie appena
   ci scrive dentro: lasciarlo rosso mentre lo sta riempiendo e'
   rimproverarlo due volte. Restituisce il primo campo vuoto, cosi' chi
   chiama puo' decidere altro. */
/* Il bersaglio e' l'elemento che l'ospite VEDE: quasi sempre il campo
   stesso, ma quando il campo e' nascosto (la destinazione del transfer sta
   in una <select> dentro un riquadro chiuso) e' quello che sta al suo posto
   sullo schermo. */
const bersaglio = (c, doc) => doc.getElementById(c.mostra || c.id);

export function segnaVuoti(tipo, vuoti, doc, contesto = {}) {
  for (const c of campiObbligatori(tipo, contesto)) {
    const el = bersaglio(c, doc);
    if (el) el.classList.remove('vuoto');
  }
  for (const c of vuoti) {
    const el = bersaglio(c, doc);
    if (!el) continue;
    el.classList.add('vuoto');
    /* un contenitore di pastiglie non emette `input`: si ripulisce al
       click, che li' e' il modo in cui si sceglie */
    const quando = c.mostra ? 'click' : 'input';
    el.addEventListener(quando, () => el.classList.remove('vuoto'), { once: true });
  }
  const primo = vuoti.length ? bersaglio(vuoti[0], doc) : null;
  if (primo) {
    primo.scrollIntoView({ block: 'center', behavior: 'smooth' });
    /* focus() su un <div> non fa niente se non e' raggiungibile da
       tastiera: si prova sul primo comando che contiene */
    const fuoco = typeof primo.focus === 'function' && primo.tabIndex >= 0
      ? primo
      : primo.querySelector('button, input, select, textarea, [tabindex]') || primo;
    if (typeof fuoco.focus === 'function') fuoco.focus({ preventScroll: true });
  }
  return primo;
}

/* I nomi dei campi che mancano, come li legge l'ospite: «Giorno, Email».
   `t` sono i testi tradotti della pagina. */
export function nomiMancanti(vuoti, t) {
  return vuoti.map((c) => t[c.eti]).join(', ');
}
