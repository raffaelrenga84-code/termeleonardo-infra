/* inclusi.js — che cosa comprende il soggiorno, qualunque tariffa.

   IL DIFETTO CHE COLMA. La pagina mostrava tre prezzi e nient'altro: chi
   confronta 190 e 260 senza sapere che cosa comprendono sceglie il numero
   piu' basso. Il motore di prenotazione del sito vecchio ha un pannello
   «Servizi inclusi» proprio per questo; qui non c'era.

   DA DOVE VIENE L'ELENCO. Dalla Knowledge Base del chatbot, voce «Inclusi
   nel soggiorno» — la stessa che risponde all'ospite al telefono e in
   chat. E' PIU' COMPLETA di quella del motore vecchio, che tace tre cose
   che all'ospite servono:

   · la CUFFIA E' OBBLIGATORIA in piscina — chi non lo sa arriva senza;
   · il centro grotte e la zona relax sono SOLO PER ADULTI — chi viaggia
     con un figlio lo deve sapere prima di prenotare, non alla reception;
   · l'accappatoio e' uno a persona e il CAMBIO SI PAGA.

   Una cosa taciuta che si scopre al banco e' un reclamo; scritta prima e'
   una condizione accettata.

   L'ITALIANO E' LA PAROLA DELLA CASA, copiata dalla Knowledge Base. Le
   altre tre lingue sono una traduzione degli stessi fatti fatta qui: da
   rileggere, soprattutto il tedesco, che e' la lingua di mezza Abano.

   Presidiato da inclusi.test.ts. */

'use strict';

/** Quello che il soggiorno comprende, in ordine di quanto serve saperlo
 *  PRIMA di prenotare: le tre righe che possono diventare un reclamo al
 *  banco stanno in mezzo, non in fondo dove nessuno arriva. */
export const INCLUSI = {
  it: [
    'Parcheggi gratuiti, coperti e scoperti',
    'Wi-Fi gratuito ovunque',
    'Colazione a buffet, con opzioni senza glutine e senza lattosio e alternative vegetali',
    'Piscine termali: 800 mq d’acqua, 30–35 °C, con getti massaggianti — la cuffia è obbligatoria',
    'Centro grotte termali, solo per adulti',
    'Zona relax, solo per adulti',
    'Un accappatoio e un asciugamano a persona; il cambio si paga',
    'Prato con vista sui Colli Euganei',
    'Palestra e percorso Kneipp',
    'Green fee agevolato nei tre Golfclub della zona',
  ],
  de: [
    'Kostenlose Parkplätze, überdacht und im Freien',
    'Kostenloses WLAN im gesamten Hotel',
    'Frühstücksbuffet, mit gluten- und laktosefreien Optionen und pflanzlichen Alternativen',
    'Thermalbäder: 800 m² Wasserfläche, 30–35 °C, mit Massagedüsen — Badekappe ist Pflicht',
    'Thermalgrotten, nur für Erwachsene',
    'Ruhebereich, nur für Erwachsene',
    'Ein Bademantel und ein Handtuch pro Person; der Wechsel ist kostenpflichtig',
    'Liegewiese mit Blick auf die Euganeischen Hügel',
    'Fitnessraum und Kneipp-Parcours',
    'Ermäßigtes Greenfee in den drei Golfclubs der Umgebung',
  ],
  en: [
    'Free parking, covered and open-air',
    'Free Wi-Fi throughout the hotel',
    'Buffet breakfast, with gluten-free and lactose-free options and plant-based alternatives',
    'Thermal pools: 800 m² of water at 30–35 °C, with massage jets — a swim cap is compulsory',
    'Thermal caves, adults only',
    'Relaxation area, adults only',
    'One bathrobe and one towel per person; changing them is charged',
    'Lawn with a view over the Euganean Hills',
    'Gym and Kneipp path',
    'Reduced green fee at the three golf clubs nearby',
  ],
  fr: [
    'Parkings gratuits, couverts et en plein air',
    'Wi-Fi gratuit dans tout l’hôtel',
    'Petit-déjeuner buffet, avec options sans gluten et sans lactose et alternatives végétales',
    'Piscines thermales : 800 m² d’eau à 30–35 °C, avec jets massants — le bonnet de bain est obligatoire',
    'Grottes thermales, réservées aux adultes',
    'Espace détente, réservé aux adultes',
    'Un peignoir et une serviette par personne ; le change est payant',
    'Pelouse avec vue sur les collines Euganéennes',
    'Salle de sport et parcours Kneipp',
    'Green fee réduit dans les trois golfs des environs',
  ],
};

/** L'elenco nella lingua chiesta, con l'italiano come ripiego: meglio una
 *  lingua sbagliata che una scheda muta su che cosa si sta comprando. */
export function inclusiIn(lingua) {
  const l = String(lingua ?? '').toLowerCase();
  return Object.hasOwn(INCLUSI, l) ? INCLUSI[l] : INCLUSI.it;
}
