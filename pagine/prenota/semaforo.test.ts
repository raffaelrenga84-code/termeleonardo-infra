/* ============================================================
   semaforo.test.ts — i due semafori che proteggono dal doppio clic.

   IL DIFETTO, segnalato dalla proprietà provando la pagina vera: si
   mettono le date, si guardano le camere, si torna indietro per
   cambiarle — e «Vedi le camere» non risponde più.

   CERCANDO si accende quando la ricerca parte e si spegneva in DUE punti
   su tre: quando non ci sono camere, e quando la ricerca fallisce. Sulla
   strada buona restava acceso per sempre. Finché non si torna indietro
   non lo nota nessuno, perché la schermata cambia subito — ed è per
   questo che è sopravvissuto dal primo commit della pagina.

   INVIANDO ha esattamente la stessa forma. Oggi non fa danno, perché
   dalla schermata finale non si torna al modulo: è la stessa trappola,
   armata, in attesa del prossimo «indietro» che qualcuno aggiungerà.

   COME SI PRESIDIA UNA COSA COSÌ. Non contando che le righe esistano —
   esistevano anche prima — ma pretendendo che il semaforo si spenga su
   OGNI strada che esce dalla funzione, e che si spenga PRIMA di cambiare
   schermata: dopo, il pulsante non c'è più e la riga non serve a nulla.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';

const PAGINA = Deno.readTextFileSync(new URL('index.html', import.meta.url))
  .split('\r\n').join('\n');

/* da dove il semaforo si accende in poi: prima non c'è niente da spegnere */
function daAccensione(nome: string): string {
  const i = PAGINA.indexOf(nome + ' = true');
  assert(i > 0, `${nome} non si accende piu da nessuna parte`);
  return PAGINA.slice(i);
}

const quante = (testo: string, pezzo: string) => testo.split(pezzo).length - 1;

Deno.test('la ricerca spegne il semaforo su tutte e tre le strade', () => {
  /* nessuna camera, camere trovate, guasto: tre uscite, tre spegnimenti.
     Erano due su tre, e la mancante era proprio quella che si percorre
     sempre. */
  const dopo = daAccensione('CERCANDO');
  assertEquals(
    quante(dopo, 'CERCANDO = false'),
    3,
    'il semaforo della ricerca non si spegne su tutte le uscite: ' +
      'tornando indietro il pulsante «Vedi le camere» resta morto',
  );
});

Deno.test('e lo spegne PRIMA di cambiare schermata', () => {
  /* dopo il cambio la schermata e' un altra e il pulsante non esiste piu':
     spegnere il semaforo li' non serve a niente */
  assert(
    PAGINA.includes("CERCANDO = false;\n    STATO = 'camere';"),
    'il semaforo si spegne dopo il cambio di schermata, o non si spegne affatto',
  );
});

Deno.test('e l invio fa lo stesso, anche se oggi non fa danno', () => {
  /* dalla schermata finale non si torna al modulo, quindi il difetto non
     si vede: e' la stessa trappola armata per il prossimo «indietro» */
  const dopo = daAccensione('INVIANDO');
  assertEquals(
    quante(dopo, 'INVIANDO = false'),
    2,
    'il semaforo dell invio non si spegne su tutte le uscite',
  );
  assert(
    PAGINA.includes("INVIANDO = false;\n    STATO = 'fatta';"),
    'il semaforo dell invio si spegne dopo il cambio di schermata, o non si spegne',
  );
});

Deno.test('e i due semafori esistono ancora: senza, il doppio clic torna', () => {
  /* la protezione dal doppio clic non si toglie per far passare queste
     prove: due richieste identiche dalla stessa persona sono due numeri
     di pratica bruciati */
  for (const nome of ['CERCANDO', 'INVIANDO']) {
    assert(PAGINA.includes(`if (${nome}) return;`), `sparita la guardia di ${nome}`);
    assert(PAGINA.includes(`${nome} = true;`), `${nome} non si accende piu`);
  }
});
