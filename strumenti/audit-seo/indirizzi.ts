/* ============================================================
   Gli indirizzi che l'audit guarda.

   PERCHE' UN ELENCO E NON UN CRAWLER. Un crawler che segue i link di
   termeleonardo.com finisce dentro /shop, /login, /register e il motore di
   prenotazione: pagine che non ci riguardano, che non vanno visitate a
   ripetizione, e che sono quelle che incassano. L'elenco si legge, si
   corregge, e si vede a colpo d'occhio cosa NON contiene.

   Da dove viene: dai menu delle quattro lingue e dalle pagine delle
   offerte, letti il 19 agosto 2026. Quando il sito cambia, si rifa' quella
   lettura e si aggiorna qui — e il conto nel test va cambiato con la mano,
   che e' esattamente il momento in cui uno si accorge di cosa e' cambiato.

   FUORI DI PROPOSITO: /cookies, /privacy e la pagina del finanziamento
   PR Veneto. Sono pagine legali: nessuno le cerca, e riempirebbero il
   rapporto di righe che nessuno guardera' mai.
   ============================================================ */
export const BASE = 'https://www.termeleonardo.com';

/* I percorsi che l'audit non tocca mai. Non e' una preferenza di stile:
   e' il cancello, e ha un test che lo prova in tutti e due i versi. */
export const VIETATI: RegExp[] = [
  /\/shop(\/|$)/,
  /\/login(\/|$)/,
  /\/register(\/|$)/,
  /\/prenotazioni(\/|$)/,
  /checkout/,
  /deposit-payment/,
];

export const INDIRIZZI: string[] = [
  // italiano — 17
  '/it',
  '/it/camere-suite',
  '/it/contatti',
  '/it/cure-termali',
  '/it/day-spa',
  '/it/driving-range-colli-euganei',
  '/it/golf',
  '/it/grotte-termali',
  '/it/info',
  '/it/offerte',
  '/it/offerte/7-giorni-di-golf',
  '/it/offerte/deluxe',
  '/it/offerte/escape',
  '/it/offerte/smart',
  '/it/piscine-termali',
  '/it/sale-meeting',
  '/it/virtual-tour',
  // tedesco — 15
  '/de',
  '/de/angebote',
  '/de/angebote/7-tage-golf',
  '/de/angebote/dolce-vita-fango-woche',
  '/de/angebote/februar-spezial',
  '/de/angebote/metaforum-sommercamp',
  '/de/angebote/november-spezial',
  '/de/angebote/sommer-spezial',
  '/de/golf',
  '/de/info',
  '/de/kontakte',
  '/de/thermal-grotten',
  '/de/thermal-kur',
  '/de/thermal-schwimmbad',
  '/de/zimmer-suite',
  // inglese — 9. /en/offers esiste ma non contiene nessuna offerta.
  '/en',
  '/en/contacts',
  '/en/golf',
  '/en/info',
  '/en/offers',
  '/en/rooms-suites',
  '/en/thermal-grotto',
  '/en/thermal-health-treatments',
  '/en/thermal-pool',
  // francese — 9. /fr/offres, come l'inglese, e' vuota.
  '/fr',
  '/fr/chambres-suites',
  '/fr/contactez-nous',
  '/fr/cures-thermales',
  '/fr/golf',
  '/fr/grottes-bio-thermales',
  '/fr/info',
  '/fr/offres',
  '/fr/piscines-thermales',
];
