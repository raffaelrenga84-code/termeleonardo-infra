/* percorso.js — leggere lingua e tipo dall'indirizzo, non solo dalla query.

   Il motivo per cui questo modulo esiste. Le pagine sono servite sotto
   indirizzi tradotti come /it/trattamenti o /de/behandlungen, prodotti da una
   riscrittura di Vercel. Una riscrittura **non cambia l'indirizzo nel
   browser**: la destinazione porta `?tipo=trattamenti&l=it`, ma quella query
   la consuma il server di file statici e alla pagina non arriva mai. Una
   pagina che legge solo `location.search` quindi non vede niente e ricade sui
   valori predefiniti — ed e' cosi' che /it/trattamenti ha aperto il modulo
   dei green fee, e che un ospite tedesco leggeva le condizioni in inglese.

   E' gia' successo tre volte in due giorni, in tre pagine diverse. Sta qui
   perche' la quarta non succeda.

   La query ha comunque la precedenza: gli indirizzi vecchi con ?tipo= e ?l=
   continuano a funzionare esattamente come prima. */

export const LINGUE = ['it', 'de', 'en', 'fr'];

/* I percorsi tradotti, come sono scritti nelle riscritture di
   `termeleonardo/frontend/vercel.json`. Se se ne aggiunge uno la', va
   aggiunto anche qui: sono le due meta' della stessa cosa. */
export const PERCORSI = {
  greenfee: { it: 'green-fee', de: 'greenfee', en: 'green-fee', fr: 'green-fee' },
  maestro: { it: 'maestro-di-golf', de: 'golflehrer', en: 'golf-pro', fr: 'pro-de-golf' },
  trattamenti: { it: 'trattamenti', de: 'behandlungen', en: 'treatments', fr: 'soins' },
  /* «Day Spa» non si traduce: e' il nome col quale l'hotel vende l'ingresso
     alle piscine termali, ed e' quello stampato sul buono regalo e sul
     listino, in tutte e quattro le lingue. Un /de/tageswellness sarebbe un
     nome che non compare da nessun'altra parte. Stesso caso di `transfer`,
     che qui sopra e' identico in tre lingue su quattro. */
  dayspa: { it: 'day-spa', de: 'day-spa', en: 'day-spa', fr: 'day-spa' },
  transfer: { it: 'transfer', de: 'transfer', en: 'transfer', fr: 'transfert' },
  prenota: { it: 'prenota', de: 'buchen', en: 'book', fr: 'reserver' },
  buoni: { it: 'buoni-regalo', de: 'gutscheine', en: 'gift-vouchers', fr: 'cheques-cadeaux' },
};

/* le due parti di /it/trattamenti, se l'indirizzo ha quella forma */
function pezzi(percorso) {
  const p = String(percorso || '').split('/').filter(Boolean);
  return { lingua: p[0] || '', voce: p[1] || '' };
}

/* La lingua, in ordine di forza: quella chiesta esplicitamente, quella scritta
   nell'indirizzo, quella del browser, e in ultimo l'inglese — che e' la lingua
   con cui e' piu' probabile farsi capire da chi non parla le altre tre. */
export function linguaScelta(ricerca, percorso, linguaBrowser) {
  const q = new URLSearchParams(ricerca || '').get('l');
  if (LINGUE.includes(q)) return q;

  const { lingua } = pezzi(percorso);
  if (LINGUE.includes(lingua)) return lingua;

  const b = String(linguaBrowser || '').slice(0, 2).toLowerCase();
  if (LINGUE.includes(b)) return b;
  return 'en';
}

/* Il tipo di richiesta. `ammessi` e' l'elenco che la pagina sa gestire:
   quello che non c'e' dentro non viene restituito, cosi' un indirizzo
   inventato non apre un modulo a caso. */
export function tipoScelto(ricerca, percorso, ammessi, predefinito) {
  const q = new URLSearchParams(ricerca || '').get('tipo');
  if (ammessi.includes(q)) return q;

  const { voce } = pezzi(percorso);
  for (const [tipo, tradotti] of Object.entries(PERCORSI)) {
    if (ammessi.includes(tipo) && Object.values(tradotti).includes(voce)) return tipo;
  }
  return predefinito;
}

/* Dove mandare l'ospite quando cambia lingua. Se sta su un indirizzo tradotto
   si resta tradotti — altrimenti cambiando lingua si tornerebbe a un indirizzo
   tecnico, e l'ospite vedrebbe cambiare la barra sotto i piedi. */
export function indirizzoPerLingua(percorso, ricerca, tipo, nuovaLingua) {
  const { lingua, voce } = pezzi(percorso);
  const tradotto = LINGUE.includes(lingua) && voce && PERCORSI[tipo];
  if (tradotto) return `/${nuovaLingua}/${PERCORSI[tipo][nuovaLingua]}`;

  const q = new URLSearchParams(ricerca || '');
  q.set('l', nuovaLingua);
  if (tipo) q.set('tipo', tipo);
  return `${percorso || ''}?${q.toString()}`;
}

/* IL SITO PUBBLICO. Gli indirizzi qui sotto devono funzionare dentro
   un'email e in una pagina servita da due domini diversi (il sito
   dell'hotel e il progetto Vercel che sta dietro alle riscritture): un
   percorso relativo come `/it/trattamenti` va a vuoto sul secondo. */
export const SITO = 'https://www.hoteltermeleonardo.com';

/* L'INDIRIZZO PUBBLICO DI UN MODULO, con i dati dell'ospite gia' dentro.

   PERCHE'. Chi ha appena chiesto una camera e vuole anche il transfer si
   trovava davanti un modulo vuoto: nome, email e telefono da ridigitare,
   appena due minuti dopo averli scritti. Ogni campo da riempire una
   seconda volta e' gente che rinuncia.

   I nomi dei parametri sono quelli che le pagine LEGGONO GIA' — vedi
   parametriOspite() in ospite-url.js: sono gli stessi che scrivono i
   pulsanti delle email della reception, quindi non nasce un contratto
   nuovo. I valori vuoti non si scrivono: `?nome=` non riempie niente e
   sporca l'indirizzo. */
export function indirizzoModulo(tipo, lingua, dati = {}) {
  const l = LINGUE.includes(lingua) ? lingua : 'en';
  const voce = PERCORSI[tipo] && PERCORSI[tipo][l];
  if (!voce) return '';
  const q = new URLSearchParams();
  for (const chiave of ['nome', 'email', 'tel', 'arrivo', 'partenza', 'insieme', 'camera', 'di']) {
    const v = String(dati[chiave] ?? '').trim();
    if (v) q.set(chiave, v);
  }
  const coda = q.toString();
  return `${SITO}/${l}/${voce}${coda ? '?' + coda : ''}`;
}
