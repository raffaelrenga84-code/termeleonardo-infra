/* logica.js — le due funzioni pure della pagina di prenotazione: la
   conversione dei prezzi e la composizione del corpo della richiesta.

   Stanno qui e non dentro <script> perche' sono le uniche due cose di
   questa pagina che vale la pena provare senza un browser: prendono dati
   dentro e restituiscono dati fuori, senza toccare il DOM ne' la rete.
   Presidiate da logica.test.ts.

   ATTENZIONE ALL'UNITA': /richieste?a=disponibilita risponde in CENTESIMI
   (lo dichiara nel campo valuta). 31000 sono 310,00 euro, non 31000 euro:
   la stessa trappola ha gia' prodotto un difetto altrove nel progetto. */

'use strict';

/** Da centesimi a euro con due decimali, virgola italiana: 31000 -> "310,00".
    Un valore non numerico (assente, null, NaN) diventa "0,00" invece di
    "NaN,00" scritto in faccia all'ospite. */
export function euroDaCentesimi(cent) {
  const n = Number(cent);
  const sicuro = Number.isFinite(n) ? n : 0;
  return (sicuro / 100).toLocaleString('it-IT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/* Il tipo camera NON entra mai come numero di camera: qui e' sempre il
   nome della categoria (es. "Doppia"), mai un numero di stanza — regola
   della casa, valida per ogni modulo rivolto agli ospiti. */

/** Compone il corpo di POST /richieste per una richiesta di soggiorno,
    esattamente come descritto nel brief del passo 1: le colonne che
    legge la reception (tipo_camera, pacchetto) e il jsonb `dati` con i
    fatti per la macchina (camera_id, variante_id, prezzo_cent...). */
export function componiCorpo({
  scelta, nome, email, telefono, checkIn, checkOut,
  adulti, bambini, note, lingua,
}) {
  return {
    tipo: 'soggiorno',
    privacy_presa_atto: true,
    nome, email, telefono,
    check_in: checkIn,
    check_out: checkOut,
    ospiti: (Number(adulti) || 0) + (Number(bambini) || 0),
    tipo_camera: scelta.nome,
    pacchetto: scelta.tariffa,
    messaggio: note,
    lingua,
    dati: {
      camera_id: scelta.camera_id,
      variante_id: scelta.variante_id,
      tariffa: scelta.tariffa,
      trattamento: scelta.trattamento,
      prezzo_cent: scelta.prezzo_cent,
    },
  };
}
