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
    fatti per la macchina (camera_id, variante_id, prezzo_cent...).

    ADULTI, BAMBINI E CAPARRA stanno in `dati` e non solo in `ospiti`: la
    colonna `ospiti` porta la somma, e la somma non si sa piu' rompere.
    La caparra mostrata all'ospite e' 7500 x ADULTI, quindi su 2 adulti +
    2 bambini la pagina promette 150,00 € mentre "4 ospiti" ne farebbero
    chiedere 300,00 €. La caparra si manda come cifra invece di lasciarla
    ricalcolare: e' una promessa gia' fatta all'ospite, e chi guardera'
    quella richiesta dovra' vedere quella cifra anche se un domani la
    regola dei 75 € a persona cambia. */
export function componiCorpo({
  scelta, nome, email, telefono, checkIn, checkOut,
  adulti, bambini, caparraCent = 0, note, lingua, cane = false,
}) {
  const nAdulti = Number(adulti) || 0;
  const nBambini = Number(bambini) || 0;
  /* una caparra a zero non si manda: sarebbe una promessa di "0,00 €"
     stampata in email e in back office, che e' peggio di nessuna riga */
  const nCaparra = Number(caparraCent) || 0;
  return {
    tipo: 'soggiorno',
    privacy_presa_atto: true,
    nome, email, telefono,
    check_in: checkIn,
    check_out: checkOut,
    ospiti: nAdulti + nBambini,
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
      adulti: nAdulti,
      bambini: nBambini,
      ...(nCaparra > 0 ? { caparra_cent: nCaparra } : {}),
      /* IL CANE. La Knowledge Base dice che va segnalato «sempre al
         momento della prenotazione, mai all'arrivo»: prima di oggi questa
         pagina non aveva modo di dirlo. Si manda solo quando c'e', come la
         caparra: un «cane: false» in back office e' rumore che si legge
         come un dato raccolto. */
      ...(cane === true ? { cane: true } : {}),
    },
  };
}

export const LINGUE = ['it', 'de', 'en', 'fr'];

/** Quale lingua mostrare, in ordine di precedenza:

    1. `?l=` nell'indirizzo — e' la scelta esplicita dell'ospite, quella
       che scrive il selettore di lingua in alto a destra. Se per qualche
       motivo ne arrivassero due, vince l'ULTIMA: quella appena espressa,
       non un valore di partenza rimasto attaccato all'indirizzo.
    2. il primo pezzo del percorso, quando e' una lingua: /de/buchen,
       /fr/reserver, /it/prenota. Sono gli indirizzi tradotti sul dominio
       dell'hotel, e prima non venivano guardati affatto — la pagina
       leggeva solo `?l=`, che li' non c'e', e finiva a decidere il
       browser. Un ospite con browser inglese che apriva l'indirizzo
       tedesco leggeva le CONDIZIONI DI CANCELLAZIONE in inglese: qui la
       lingua non e' un fatto estetico.
    3. la lingua del browser, e in ultimo l'inglese.

    Il percorso NON vince sul `?l=`: chi e' su /it/prenota e sceglie il
    tedesco nel selettore deve ottenere il tedesco. Resta che l'indirizzo
    dira' ancora /it/prenota?l=de — brutto ma onesto; portare il selettore
    sull'indirizzo tradotto giusto vorrebbe dire ricopiare qui la tabella
    dei percorsi di vercel.json e tenerne due allineate. */
export function linguaScelta(percorso, ricerca, linguaBrowser) {
  const chieste = new URLSearchParams(ricerca || '').getAll('l').filter((l) => LINGUE.includes(l));
  if (chieste.length) return chieste[chieste.length - 1];

  const primo = String(percorso || '').split('/').filter(Boolean)[0];
  if (LINGUE.includes(primo)) return primo;

  const b = String(linguaBrowser || '').slice(0, 2);
  return ['de', 'fr', 'it'].includes(b) ? b : 'en';
}

/* QUANTO VIENE A PERSONA, in centesimi, o null se non si puo' dire.

   Il prezzo che il motore manda e' il TOTALE del soggiorno. Chi legge
   «190,00 €» accanto a «2 adulti» non sa se sono 190 in tutto o a testa —
   il motore del sito vecchio scrive «Adulti 2 x € 95» proprio per questo.

   NON SI DIVIDE MAI COI BAMBINI. Hanno un prezzo loro: dividere il totale
   per i soli adulti direbbe un numero piu' alto del vero su una pagina che
   vende. E non si divide se la divisione non e' esatta, perche' arrotondare
   scriverebbe una cifra che nessuno pagherà mai.

   null e' un esito normale: la pagina dice solo che e' il totale, che e'
   vero sempre. */
export function aPersonaCent(cent, adulti, bambini) {
  /* typeof prima della conversione: Number(null) fa 0, e uno zero finto
     e uno zero vero non sono la stessa cosa */
  if (typeof cent !== 'number' || !Number.isInteger(cent) || cent < 0) return null;
  if (typeof adulti !== 'number' || !Number.isInteger(adulti) || adulti < 2) return null;
  if ((Number(bambini) || 0) > 0) return null;
  if (cent % adulti !== 0) return null;
  return cent / adulti;
}
