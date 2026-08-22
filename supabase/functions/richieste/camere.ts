/* camere.ts — il catalogo delle categorie, per identificativo.

   L'abbinamento va per `room_category_id`, che l'API restituisce stabile, e
   MAI per nome: i modelli della reception abbinano per sottostringa e non
   hanno una voce per "singola senza balcone", quindi le assegnano la
   descrizione della "singola" — balcone compreso, su una camera che nel nome
   dichiara di non averlo. Stessa sorte per la "Singola Accessibile".

   DA DOVE VENGONO QUESTE DESCRIZIONI. Dal prompt dell'agente vocale
   (v4.10, 20 agosto 2026), dove la proprieta' le ha gia' confermate e dove
   i nomi delle categorie sono gli stessi che usa il motore di prenotazione
   — quindi l'abbinamento non e' dedotto, e' lo stesso elenco. Prima erano
   tutte vuote in attesa di quella conferma: una descrizione giusta sulla
   camera sbagliata e' peggio di nessuna descrizione.

   COSA RESTA FUORI, APPOSTA. Le due misure contestate: l'API dichiara
   35 mq per la Junior Suite Abano contro i 28 dei modelli della reception,
   e 21 mq per la Doppia contro 18. Finche' non si sa quale delle due e'
   giusta, il numero non si stampa — e camere.test.ts lo tiene fuori.
   I 16 mq della Matrimoniale Queen non sono contestati da nessuno. */

export type Camera = {
  id: number;
  nome: string;
  descrizione: Record<string, string>;
};

export const CAMERE: Record<number, Camera> = {
  /* IL LETTO ALLA FRANCESE E' DELLA PARCO, non di questa. Fino al 22
     agosto 2026 era scritto qui, e da qui era finito anche nella
     Knowledge Base e nel prompt dell'agente vocale. Che letto abbia
     questa camera non lo sappiamo: meglio non dirlo che dirlo storto. */
  2: { id: 2, nome: 'Singola senza balcone', descrizione: {
      it: 'È l’unica camera senza balcone.',
      de: 'Das einzige Zimmer ohne Balkon.',
      en: 'The only room without a balcony.',
      fr: 'La seule chambre sans balcon.',
    } },
  /* l'unica camera col letto alla francese */
  3: { id: 3, nome: 'Singola Parco', descrizione: {
      it: 'Letto alla francese da 1,45 m, balcone con vista sul parco.',
      de: 'Französisches Bett 1,45 m, Balkon mit Blick auf den Park.',
      en: 'French bed, 1.45 m, balcony overlooking the park.',
      fr: 'Lit à la française de 1,45 m, balcon avec vue sur le parc.',
    } },
  4: { id: 4, nome: 'Singola Accessibile', descrizione: {
      it: 'Camera singola attrezzata per ospiti con esigenze di mobilità.',
      de: 'Einzelzimmer, ausgestattet für Gäste mit eingeschränkter Mobilität.',
      en: 'Single room equipped for guests with reduced mobility.',
      fr: 'Chambre simple équipée pour les personnes à mobilité réduite.',
    } },
  5: { id: 5, nome: 'Doppia', descrizione: {
      it: 'Due letti singoli da 1×2 m, accostabili su richiesta.',
      de: 'Zwei Einzelbetten 1×2 m, auf Wunsch zusammenstellbar.',
      en: 'Two single beds, 1×2 m, which can be pushed together on request.',
      fr: 'Deux lits simples de 1×2 m, jumelables sur demande.',
    } },
  6: { id: 6, nome: 'Matrimoniale Queen', descrizione: {
      it: 'Letto matrimoniale da 1,60 m, circa 16 m².',
      de: 'Doppelbett 1,60 m, rund 16 m².',
      en: 'Double bed, 1.60 m, about 16 m².',
      fr: 'Lit double de 1,60 m, environ 16 m².',
    } },
  7: { id: 7, nome: 'Junior Suite Colli Euganei', descrizione: {
      it: 'Junior suite con doppio lavabo.',
      de: 'Junior-Suite mit Doppelwaschbecken.',
      en: 'Junior suite with a double washbasin.',
      fr: 'Junior suite avec double vasque.',
    } },
  8: { id: 8, nome: 'Junior Suite Accessibile', descrizione: {
      it: 'Junior suite attrezzata per ospiti con esigenze di mobilità, con letto aggiunto disponibile.',
      de: 'Junior-Suite für Gäste mit eingeschränkter Mobilität, Zustellbett möglich.',
      en: 'Junior suite equipped for guests with reduced mobility; an extra bed is available.',
      fr: 'Junior suite équipée pour les personnes à mobilité réduite, lit d’appoint possible.',
    } },
  9: { id: 9, nome: 'Suite Colli Euganei', descrizione: {
      it: 'La più ampia, con doppio lavabo.',
      de: 'Die geräumigste, mit Doppelwaschbecken.',
      en: 'The largest, with a double washbasin.',
      fr: 'La plus spacieuse, avec double vasque.',
    } },
  10: { id: 10, nome: 'Suite Monteortone', descrizione: {
      it: 'Suite per due-quattro persone.',
      de: 'Suite für zwei bis vier Personen.',
      en: 'Suite for two to four people.',
      fr: 'Suite pour deux à quatre personnes.',
    } },
  11: { id: 11, nome: 'Junior Suite Monteortone', descrizione: {
      it: 'Junior suite per due-quattro persone.',
      de: 'Junior-Suite für zwei bis vier Personen.',
      en: 'Junior suite for two to four people.',
      fr: 'Junior suite pour deux à quatre personnes.',
    } },
  12: { id: 12, nome: 'Junior Suite Abano', descrizione: {
      it: 'Vista su Abano e Monteortone. È la sistemazione per tre persone.',
      de: 'Blick auf Abano und Monteortone. Das Zimmer für drei Personen.',
      en: 'Overlooking Abano and Monteortone. This is the room for three people.',
      fr: 'Vue sur Abano et Monteortone. C’est la chambre pour trois personnes.',
    } },
};

export function descrizioneCamera(id: number, lingua: string): string {
  const c = CAMERE[id];
  if (!c) return '';
  return c.descrizione[lingua] || c.descrizione.it || '';
}
