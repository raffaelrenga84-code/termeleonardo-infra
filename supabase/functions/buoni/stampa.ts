/* ============================================================
   stampa.ts — cosa può vedere chi ha già il codice.

   IL PROBLEMA. Il buono arriva per email dentro il corpo del messaggio: per
   stamparlo il cliente deve stampare tutta l'email, intestazioni comprese.
   La pagina pubblica pagine/buoni/stampa/ risolve questo dando, dato un
   codice, il solo foglio A4 (buonoStampaHTML in buono.js) pronto da
   stampare. Questo file decide COSA quella pagina può ricevere dal server
   per farlo.

   PERCHÉ UN'AZIONE SEPARATA DA `verifica`. `?a=verifica` in index.ts serve
   alla reception per controllare un codice al banco, e apposta non
   restituisce acquirente, destinatario, dedica né dati di pagamento: non
   deve iniziare a spargere dati personali. Ma per stampare un foglio bello
   servono anche il nome di chi lo riceve e la dedica — quelli SÌ, servono
   qui — quindi non si allarga `verifica`: si fa un'azione a parte, con un
   contratto suo.

   CHI PUÒ CHIAMARLA E COSA PUÒ VEDERE.
   - Il codice è già la chiave che vale il buono: chi ce l'ha in mano può
     presentarsi in reception e riscuoterlo. Chi chiama questa azione con un
     codice valido è quindi il legittimo portatore del buono, non un
     estraneo — vedere anche il nome del destinatario o la dedica non gli dà
     alcun potere che non avesse già.
   - Ma non deve uscire NIENTE DI PIÙ di quello che sta già scritto sul
     buono che il destinatario ha ricevuto: niente email (né
     dell'acquirente né del destinatario), niente telefono, nessun dato o
     riferimento di pagamento (pagamento, pagamento_rif, stripe_sessione),
     nessuna nota interna, nessun nome di chi ha creato o riscosso il buono.
     Per questo qui sotto si COSTRUISCE la risposta campo per campo — un
     elenco di cosa esce, non un elenco di cosa si toglie: se domani la riga
     del database cresce di una colonna nuova, quella colonna resta fuori
     finché qualcuno non la aggiunge qui di proposito, invece di uscire da
     sola perché nessuno l'ha vietata.
   - I soli campi che uscono sono quelli che buonoStampaHTML() usa davvero
     per disegnare il foglio (codice, tipo, voce_id, descrizione, lingua,
     sottotitolo, destinatario, dedica, acquirente, numero, scade_il) — non
     "quello che sembra innocuo", ma esattamente quello che serve a
     ricomporre lo stesso foglio che la reception stampa con "Stampa
     subito". Anche `valore` e `voci` restano fuori: buonoStampaHTML non li
     guarda, quindi non c'è motivo di farli viaggiare.
   - `numero` (il riferimento per l'amministrazione, tipo "BR-2026-0042")
     invece esce: non è un dato di pagamento, ed è già stampato in fondo al
     foglio quando lo stampa la reception. Ometterlo qui produrrebbe un
     foglio diverso a seconda di CHI lo stampa — la stessa divergenza fra
     due rese di uno stesso buono che questo progetto ha già pagato più
     volte, solo spostata dai dati invece che dal codice.

   UN BUONO NON PIÙ VALIDO NON SI STAMPA COME SE LO FOSSE. Annullato,
   scaduto o già riscosso: si dice solo lo stato (la stessa informazione
   che `verifica` già dà pubblicamente a chiunque abbia il codice), e NON
   si manda nessuno dei campi sopra. Un buono in attesa di pagamento non ha
   nemmeno un codice spendibile: stesso trattamento.

   IL FRENO. Senza un limite, chiunque potrebbe provare codici a raffica
   finché non ne indovina uno valido: la stessa preoccupazione di
   `?a=acquista`, che già usa `entroIlLimite` di limite.ts. Qui si riusa lo
   stesso freno in memoria — vedi index.ts, che è il punto che chiama
   `entroIlLimite` prima di interrogare il database.
   ============================================================ */

/** Quello che una riga vera della tabella buono_regalo porta: qui dentro
 * ne bastano poche, il resto (email, telefono, pagamento, note interne…)
 * la riga vera lo porta comunque — e proprio per questo, sotto, si
 * COSTRUISCE la risposta invece di ripulire la riga: un campo nuovo sulla
 * riga non finisce in risposta finché non lo si aggiunge qui apposta. */
export interface RigaStampa {
  codice?: string | null;
  tipo?: string | null;
  voce_id?: string | null;
  descrizione?: string | null;
  lingua?: string | null;
  sottotitolo?: string | null;
  destinatario?: string | null;
  dedica?: string | null;
  acquirente?: string | null;
  numero?: string | null;
  scade_il?: string | null;
  stato?: string | null;
  // deno-lint-ignore no-explicit-any
  [altro: string]: any;
}

export type EsitoStampa =
  | { valido: false; motivo: 'non trovato' }
  | { valido: false; stato: string | null }
  | { valido: true; buono: {
      codice: string | null; tipo: string | null; voce_id: string | null;
      descrizione: string; lingua: string; sottotitolo: string | null;
      destinatario: string | null; dedica: string | null; acquirente: string | null;
      numero: string | null; scade_il: string | null; stato: 'pagato';
    } };

/** Decide cosa risponde `?a=stampa`, dalla riga del database (o null se il
 * codice non esiste) e dall'istante corrente (parametro solo per i test:
 * senza, "scaduto" dipenderebbe dall'orologio della macchina che esegue
 * il test, non dai dati). Stessa regola di scadenza di `?a=verifica` in
 * index.ts: valido fino alle 23:59:59 del giorno di scade_il compreso. */
export function datiStampa(riga: RigaStampa | null, ora: Date = new Date()): EsitoStampa {
  if (!riga) return { valido: false, motivo: 'non trovato' };

  const scaduto = !!riga.scade_il && new Date(riga.scade_il + 'T23:59:59') < ora;
  const stato = scaduto && riga.stato === 'pagato' ? 'scaduto' : (riga.stato ?? null);

  if (stato !== 'pagato') return { valido: false, stato };

  return {
    valido: true,
    buono: {
      codice: riga.codice ?? null,
      tipo: riga.tipo ?? null,
      voce_id: riga.voce_id ?? null,
      descrizione: riga.descrizione ?? '',
      lingua: riga.lingua ?? 'it',
      sottotitolo: riga.sottotitolo ?? null,
      destinatario: riga.destinatario ?? null,
      dedica: riga.dedica ?? null,
      acquirente: riga.acquirente ?? null,
      numero: riga.numero ?? null,
      scade_il: riga.scade_il ?? null,
      stato: 'pagato',
    },
  };
}
