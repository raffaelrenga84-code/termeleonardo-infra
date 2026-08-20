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

   LE ACCESSIBILI NON HANNO FOTO. Mostrare la camera normale della stessa
   famiglia a chi cerca una stanza attrezzata sarebbe una promessa falsa
   proprio a chi ha piu' bisogno di sapere com'e' fatta. Restano senza
   immagine finche' non ci sono le loro: una scheda senza foto si legge
   lo stesso, una foto sbagliata no.

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
  9: 'suite-533-hotel-terme-lonardo.jpg', // Suite Colli Euganei
  10: 'suite-533-hotel-terme-lonardo.jpg', // Suite Monteortone
  11: 'junior-suite-32-1-hotel-terme-leonardo.jpg', // Junior Suite Monteortone
  12: 'junior-suite-32-1-hotel-terme-leonardo.jpg', // Junior Suite Abano
};

/** Le categorie che restano senza foto, e il motivo. Non e' una
 *  dimenticanza: e' una decisione, e sta scritta qui perche' chi la cambia
 *  debba cambiarla apposta.
 *
 *  4  Singola Accessibile
 *  8  Junior Suite Accessibile
 *  Le due attrezzate per esigenze di mobilita': servono le loro foto. */
export const SENZA_FOTO = [4, 8];

/** Il percorso servibile della foto di questa categoria, o stringa vuota se
 *  non ne ha una. Vuoto e' un esito normale, non un errore: la pagina
 *  disegna la scheda senza immagine. */
export function fotoDi(camera_id) {
  const n = Number(camera_id);
  if (!Number.isInteger(n) || !Object.hasOwn(FOTO_CAMERA, n)) return '';
  return '/prenota/img/' + FOTO_CAMERA[n];
}
