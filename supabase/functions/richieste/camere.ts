/* camere.ts — il catalogo delle categorie, per identificativo.

   L'abbinamento va per `room_category_id`, che l'API restituisce stabile, e
   MAI per nome: i modelli della reception abbinano per sottostringa e non
   hanno una voce per "singola senza balcone", quindi le assegnano la
   descrizione della "singola" — balcone compreso, su una camera che nel nome
   dichiara di non averlo. Stessa sorte per la "Singola Accessibile".

   Le descrizioni qui sono solo quelle di cui la direzione ha confermato
   l'abbinamento. Dove manca la conferma il campo resta vuoto e la pagina non
   scrive nulla: una descrizione giusta sulla camera sbagliata e' peggio di
   nessuna descrizione. Due discordanze note, da chiarire prima di riempirle:
   l'API dichiara 35 mq per la Junior Suite Abano contro i 28 dei modelli, e
   21 mq per la Doppia contro 18. */

export type Camera = {
  id: number;
  nome: string;
  descrizione: Record<string, string>;
};

export const CAMERE: Record<number, Camera> = {
  2: { id: 2, nome: 'Singola senza balcone', descrizione: {} },
  3: { id: 3, nome: 'Singola Parco', descrizione: {} },
  4: { id: 4, nome: 'Singola Accessibile', descrizione: {} },
  5: { id: 5, nome: 'Doppia', descrizione: {} },
  6: { id: 6, nome: 'Matrimoniale Queen', descrizione: {} },
  7: { id: 7, nome: 'Junior Suite Colli Euganei', descrizione: {} },
  8: { id: 8, nome: 'Junior Suite Accessibile', descrizione: {} },
  9: { id: 9, nome: 'Suite Colli Euganei', descrizione: {} },
  10: { id: 10, nome: 'Suite Monteortone', descrizione: {} },
  11: { id: 11, nome: 'Junior Suite Monteortone', descrizione: {} },
  12: { id: 12, nome: 'Junior Suite Abano', descrizione: {} },
};

export function descrizioneCamera(id: number, lingua: string): string {
  const c = CAMERE[id];
  if (!c) return '';
  return c.descrizione[lingua] || c.descrizione.it || '';
}
