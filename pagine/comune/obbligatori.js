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
  transfer: GIORNO_E_ORA,
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
export function campiObbligatori(tipo) {
  return [...(PER_TIPO[tipo] || GIORNO_E_ORA), ...CONTATTI];
}

/* Cio' che manca, in ordine di comparsa nel modulo — cosi' chi legge il
   messaggio scende una volta sola. `leggi(id)` la passa la pagina: questo
   modulo non tocca il DOM, e cosi' si puo' provare senza browser.
   Uno spazio non e' un valore: «   » nel telefono e' un telefono che non
   c'e'. */
export function mancanti(tipo, leggi) {
  return campiObbligatori(tipo).filter((c) => !String(leggi(c.id) ?? '').trim());
}
