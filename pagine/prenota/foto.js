/* foto.js — quale foto va su quale categoria di camera.

   LE FOTO SONO CINQUE, LE CATEGORIE UNDICI. L'hotel fotografa il TIPO di
   stanza, non la singola unita': la "Junior Suite Colli Euganei" e la
   "Junior Suite Monteortone" sono la stessa camera con un'altra vista, e
   la foto e' la stessa. Questo e' quello che fa gia' il sito dell'hotel,
   da cui le cinque immagini arrivano.

   L'abbinamento va per `room_category_id` — lo stesso identificativo che
   usa camere.ts per le descrizioni — e MAI per nome: i nomi cambiano, gli
   identificativi no, e un abbinamento per sottostringa metterebbe la foto
   della singola col balcone sulla "Singola senza balcone".

   SULLE ACCESSIBILI NON VA LA FOTO DELLA CAMERA NORMALE. Mostrare la
   stanza normale della stessa famiglia a chi cerca una stanza attrezzata
   sarebbe una promessa falsa proprio a chi ha piu' bisogno di sapere
   com'e' fatta: una scheda senza foto si legge lo stesso, una foto
   sbagliata no.

   Dal 21 agosto 2026 la Junior Suite Accessibile ha la SUA foto: il bagno
   attrezzato della 650, che il foglio della reception da' come l'unica
   camera di quella categoria (estensione/popup.js). E' un bagno e non una
   stanza, ed e' voluto — su una camera attrezzata il bagno e' quello che
   decide se la stanza va bene, e il testo alternativo lo dichiara (vedi
   COSA_MOSTRA). La Singola Accessibile resta senza: e' un'altra camera,
   e quel bagno non e' il suo.

   Presidiato da foto.test.ts, che confronta questo elenco col catalogo del
   server e verifica che ogni file esista davvero. */

'use strict';

/** Le foto, per identificativo di categoria. I nomi dei file sono quelli
 *  del sito dell'hotel, ridotti a 800px: su una scheda da 400px coprono
 *  anche gli schermi a densita' doppia. */
export const FOTO_CAMERA = {
  2: 'single-room-hotel-leonardo-da-vinci-terme.jpg', // Singola senza balcone
  3: 'single-room-hotel-leonardo-da-vinci-terme.jpg', // Singola Parco
  5: 'double-room-hotel-terme-leonardo.jpg', // Doppia
  6: 'queen-room.jpg', // Matrimoniale Queen
  7: 'junior-suite-32-1-hotel-terme-leonardo.jpg', // Junior Suite Colli Euganei
  8: 'junior-suite-accessibile-bagno.jpg', // Junior Suite Accessibile (il BAGNO)
  9: 'suite-533-hotel-terme-lonardo.jpg', // Suite Colli Euganei
  10: 'suite-533-hotel-terme-lonardo.jpg', // Suite Monteortone
  11: 'junior-suite-32-1-hotel-terme-leonardo.jpg', // Junior Suite Monteortone
  12: 'junior-suite-32-1-hotel-terme-leonardo.jpg', // Junior Suite Abano
};

/** Le categorie che restano senza foto, e il motivo. Non e' una
 *  dimenticanza: e' una decisione, e sta scritta qui perche' chi la cambia
 *  debba cambiarla apposta.
 *
 *  4  Singola Accessibile — attrezzata per esigenze di mobilita'. Serve
 *     la SUA foto: la 650 e' una Junior Suite, e il suo bagno non
 *     racconta questa stanza. */
export const SENZA_FOTO = [4];

/** Che cosa si vede nella foto, quando NON e' la stanza. Il testo
 *  alternativo di una foto camera e' il nome della camera, e va bene
 *  finche' la foto ritrae la camera. La 8 ha la foto del bagno: senza
 *  questo, chi si fa leggere la pagina ad alta voce sentirebbe «Junior
 *  Suite Accessibile» davanti a un bagno — e proprio li' sapere che cosa
 *  si sta guardando e' il motivo per cui si guarda. */
export const COSA_MOSTRA = { 8: 'il bagno attrezzato' };

/** Il testo alternativo della foto di questa categoria: il nome della
 *  camera, e se la foto non e' la stanza anche che cosa ritrae. */
export function altFoto(camera_id, nome) {
  const n = Number(camera_id);
  const s = String(nome ?? '');
  return Object.hasOwn(COSA_MOSTRA, n) ? `${s} — ${COSA_MOSTRA[n]}` : s;
}

/** Il percorso servibile della foto di questa categoria, o stringa vuota se
 *  non ne ha una. Vuoto e' un esito normale, non un errore: la pagina
 *  disegna la scheda senza immagine. */
export function fotoDi(camera_id) {
  const n = Number(camera_id);
  if (!Number.isInteger(n) || !Object.hasOwn(FOTO_CAMERA, n)) return '';
  return '/prenota/img/' + FOTO_CAMERA[n];
}
