/* giorno-stesso.js — dopo una certa ora non si prenota piu' per oggi.

   PERCHE'. LE CAMERIERE AI PIANI FINISCONO ALLE 15:30. Una richiesta per
   il giorno stesso che arriva dopo non trova nessuno che prepari la
   camera, e sulle sistemazioni con LETTO AGGIUNTO non e' un dettaglio: il
   letto va montato. L'ospite arriva e la stanza non e' pronta — il
   disagio se lo prende lui e la figuraccia la reception.

   L'ORA E' LE 14:30, non le 15:30. Un'ora di margine serve a far vedere
   la richiesta alla reception, farla confermare e passarla ai piani: una
   richiesta che entra alle 15:29 non e' una camera pronta alle 15:30.

   NON E' UN RIFIUTO, E' UN «CI CHIAMI». Al telefono la reception sa se
   quel giorno c'e' ancora qualcuno ai piani e puo' dire di si'; una
   pagina non lo sa e non puo' prometterlo. Per questo il messaggio porta
   il numero e non si limita a dire di no.

   L'OROLOGIO DEV'ESSERE QUELLO ITALIANO, e per questo questa funzione non
   se lo prende da sola: lo riceve. Chi guarda da Londra alle 14:00 in
   Italia ha gia' le 15:00 e passerebbe; chi guarda da Tokyo all'una di
   notte in Italia e' ancora il giorno prima. Vedi adessoARoma() in
   comune/date.js — e riceverlo invece di prenderselo rende questa regola
   provabile a qualunque ora del giorno.

   Deciso con la proprieta' il 21 agosto 2026.
   Presidiato da giorno-stesso.test.ts. */

'use strict';

/** L'ora oltre la quale il giorno stesso non si prenota online, in minuti
 *  dalla mezzanotte. Si cambia QUI e la seguono il controllo e il testo
 *  che l'ospite legge — che l'ora se la fa dare da oraLimite(). */
export const LIMITE_MINUTI = 14 * 60 + 30;

/** L'ora in cui i piani smettono. Non entra nel conto: sta scritta perche'
 *  e' il motivo del limite, e chi un giorno volesse spostarlo sappia
 *  rispetto a che cosa. */
export const PIANI_FINO_A = '15:30';

/** Il limite come lo legge una persona: «14:30». */
export function oraLimite(minuti = LIMITE_MINUTI) {
  const p = (n) => String(n).padStart(2, '0');
  return `${p(Math.floor(minuti / 60))}:${p(minuti % 60)}`;
}

/** Si puo' ancora chiedere online un arrivo per questa data?
 *
 *  `adesso` e' quello che restituisce adessoARoma(): { giorno, minuti }.
 *
 *  SI SBAGLIA APERTO, non chiuso. Se la data non e' una data o l'orologio
 *  arriva guasto, si lascia passare: la richiesta finisce comunque sul
 *  tavolo della reception, che chiama l'ospite. Sbagliare chiuso invece
 *  rifiuterebbe prenotazioni buone per gli altri 364 giorni dell'anno
 *  senza che nessuno capisca perche'. */
export function chiusoPerOggi(arrivoISO, adesso) {
  const data = String(arrivoISO ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return false;
  if (!adesso || typeof adesso.giorno !== 'string') return false;
  if (!Number.isFinite(adesso.minuti)) return false;
  return data === adesso.giorno && adesso.minuti >= LIMITE_MINUTI;
}
