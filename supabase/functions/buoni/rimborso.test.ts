import { assertEquals, assertNotEquals } from 'jsr:@std/assert';
import {
  idoneitaRimborso,
  centesimiDaEuro,
  corpoRimborso,
  classificaRispostaRimborso,
  eseguiRimborsoStripe,
  messaggioScritturaFallita,
} from './rimborso.ts';

/* ============================================================
   idoneitaRimborso — la decisione, PRIMA di toccare la rete o il
   database: cosa si può fare con questo buono, dati solo i campi
   che già sono nella riga letta.
   ============================================================ */

Deno.test('un buono ancora in attesa di pagamento non si rimborsa: non è mai stato incassato', () => {
  const esito = idoneitaRimborso({ stato: 'attesa', pagamento: 'stripe', pagamento_rif: 'pi_1', valore: 50 });
  assertEquals(esito, { tipo: 'rifiutato', motivo: 'il buono non risulta ancora pagato' });
});

Deno.test('un buono già riscosso non si rimborsa: è stato usato, non ci sono soldi da restituire per quello', () => {
  const esito = idoneitaRimborso({ stato: 'riscosso', pagamento: 'stripe', pagamento_rif: 'pi_1', valore: 50 });
  assertEquals(esito, { tipo: 'rifiutato', motivo: 'il buono risulta già riscosso' });
});

Deno.test('un buono già annullato non si rimborsa una seconda volta', () => {
  const esito = idoneitaRimborso({ stato: 'annullato', pagamento: 'stripe', pagamento_rif: 'pi_1', valore: 50 });
  assertEquals(esito, { tipo: 'rifiutato', motivo: 'il buono risulta già annullato' });
});

Deno.test('contanti: nessun pagamento Stripe da rimborsare, si annulla soltanto', () => {
  const esito = idoneitaRimborso({ stato: 'pagato', pagamento: 'contanti', pagamento_rif: null, valore: 50 });
  assertEquals(esito, { tipo: 'senza_stripe' });
});

Deno.test('bonifico: nessun pagamento Stripe da rimborsare, si annulla soltanto', () => {
  const esito = idoneitaRimborso({ stato: 'pagato', pagamento: 'bonifico', pagamento_rif: 'CRO12345', valore: 50 });
  assertEquals(esito, { tipo: 'senza_stripe' });
});

Deno.test('promozionale: nessun incasso, nulla da rimborsare', () => {
  const esito = idoneitaRimborso({ stato: 'pagato', pagamento: 'promozionale', pagamento_rif: null, valore: 50 });
  assertEquals(esito, { tipo: 'senza_stripe' });
});

Deno.test('pagamento segnato "stripe" ma senza riferimento: non si può chiamare Stripe alla cieca, si annulla soltanto', () => {
  const esito = idoneitaRimborso({ stato: 'pagato', pagamento: 'stripe', pagamento_rif: null, valore: 50 });
  assertEquals(esito, { tipo: 'senza_stripe' });
});

Deno.test('pagamento "stripe" con un riferimento che non è né un payment_intent né un charge: si annulla soltanto', () => {
  /* pagamento_rif può valere anche un id di sessione (cs_...) quando il
     webhook non ha trovato un payment_intent — un caso limite, ma con
     quel valore Stripe non accetterebbe comunque una richiesta di
     rimborso, quindi non si finge di poterla fare */
  const esito = idoneitaRimborso({ stato: 'pagato', pagamento: 'stripe', pagamento_rif: 'cs_test_1', valore: 50 });
  assertEquals(esito, { tipo: 'senza_stripe' });
});

Deno.test('pagamento Stripe con payment_intent valido: da rimborsare, con l\'importo in centesimi', () => {
  const esito = idoneitaRimborso({ stato: 'pagato', pagamento: 'stripe', pagamento_rif: 'pi_abc123', valore: 45 });
  assertEquals(esito, { tipo: 'da_rimborsare', riferimentoStripe: 'pi_abc123', centesimi: 4500 });
});

Deno.test('pagamento Stripe con un id di charge (non di payment_intent): da rimborsare comunque', () => {
  const esito = idoneitaRimborso({ stato: 'pagato', pagamento: 'stripe', pagamento_rif: 'ch_xyz789', valore: 30 });
  assertEquals(esito, { tipo: 'da_rimborsare', riferimentoStripe: 'ch_xyz789', centesimi: 3000 });
});

/* ============================================================
   centesimiDaEuro — l'importo esatto che torna al cliente. Un
   arrotondamento sbagliato qui vuol dire rimborsare un centesimo
   in più o in meno di quanto pagato davvero.
   ============================================================ */

Deno.test('centesimiDaEuro: un valore intero si converte senza sorprese', () => {
  assertEquals(centesimiDaEuro(45), 4500);
});

Deno.test('centesimiDaEuro: un valore con i decimali dell\'imprecisione tipica dei float arrotonda al centesimo giusto', () => {
  /* 19.9 * 100 in virgola mobile non fa esattamente 1990: è il caso da
     cui creaLinkStripe (index.ts) già si difende con Math.round */
  assertEquals(centesimiDaEuro(19.9), 1990);
  assertEquals(centesimiDaEuro(33.3), 3330);
});

/* ============================================================
   corpoRimborso — il corpo della richiesta a Stripe: payment_intent
   o charge, a seconda di cosa porta la riga, mai l'uno al posto
   dell'altro (Stripe rifiuta un charge passato come payment_intent).
   ============================================================ */

Deno.test('corpoRimborso con un payment_intent usa il campo payment_intent', () => {
  assertEquals(corpoRimborso('pi_abc123', 4500), { payment_intent: 'pi_abc123', amount: '4500' });
});

Deno.test('corpoRimborso con un charge usa il campo charge, non payment_intent', () => {
  assertEquals(corpoRimborso('ch_xyz789', 3000), { charge: 'ch_xyz789', amount: '3000' });
});

/* ============================================================
   classificaRispostaRimborso — legge la risposta (già in JSON) di
   Stripe e distingue i tre esiti che contano per la regola 1 e la
   regola 5: riuscito, già-rimborsato (non è un errore, è uno stato),
   fallito (il buono NON va toccato).
   ============================================================ */

Deno.test('una risposta 2xx di Stripe è un rimborso riuscito, con l\'id del rimborso', () => {
  const esito = classificaRispostaRimborso({ ok: true, corpo: { id: 're_1', status: 'succeeded' } });
  assertEquals(esito, { esito: 'riuscito', id: 're_1' });
});

Deno.test('Stripe che dice "charge_already_refunded" non è un guasto: è uno stato, il buono si annulla comunque', () => {
  const esito = classificaRispostaRimborso({
    ok: false,
    corpo: { error: { code: 'charge_already_refunded', message: 'Charge ch_1 has already been refunded.' } },
  });
  assertEquals(esito, { esito: 'gia_rimborsato' });
});

Deno.test('un rifiuto Stripe diverso da "già rimborsato" resta un fallimento vero, col messaggio di Stripe', () => {
  const esito = classificaRispostaRimborso({
    ok: false,
    corpo: { error: { code: 'card_declined', message: 'la banca ha rifiutato il rimborso' } },
  });
  assertEquals(esito, { esito: 'fallito', messaggio: 'la banca ha rifiutato il rimborso' });
});

Deno.test('una risposta di errore senza un corpo leggibile non fa esplodere la classificazione', () => {
  const esito = classificaRispostaRimborso({ ok: false, corpo: {} });
  assertEquals(esito.esito, 'fallito');
  assertNotEquals((esito as { messaggio: string }).messaggio, '');
});

/* ============================================================
   eseguiRimborsoStripe — la SOLA funzione che tocca la rete, e lo fa
   attraverso un fetch iniettato: nei test è sempre finto, non chiama
   mai Stripe davvero (nemmeno in modalità di prova).
   ============================================================ */

Deno.test('eseguiRimborsoStripe: una chiamata riuscita restituisce l\'id del rimborso', async () => {
  let vista: { url: string; opzioni: RequestInit } | null = null;
  const fintoFetch = ((url: string, opzioni: RequestInit) => {
    vista = { url, opzioni };
    return Promise.resolve(new Response(JSON.stringify({ id: 're_777', status: 'succeeded' }), { status: 200 }));
  }) as typeof fetch;

  const esito = await eseguiRimborsoStripe(fintoFetch, 'rk_test_chiave', 'pi_abc123', 4500);
  assertEquals(esito, { esito: 'riuscito', id: 're_777' });

  /* la richiesta vera va verso l'endpoint dei rimborsi, autenticata con
     la chiave passata, con l'importo giusto nel corpo — se uno di questi
     cambia per sbaglio, Stripe rimborserebbe la cosa sbagliata o niente */
  assertEquals(vista!.url, 'https://api.stripe.com/v1/refunds');
  assertEquals((vista!.opzioni.headers as Record<string, string>).authorization, 'Bearer rk_test_chiave');
  const corpo = new URLSearchParams(vista!.opzioni.body as string);
  assertEquals(corpo.get('payment_intent'), 'pi_abc123');
  assertEquals(corpo.get('amount'), '4500');
});

Deno.test('eseguiRimborsoStripe: Stripe che risponde "già rimborsato" non è un errore di rete', async () => {
  const fintoFetch = (() => Promise.resolve(new Response(
    JSON.stringify({ error: { code: 'charge_already_refunded', message: 'già rimborsato' } }),
    { status: 400 }
  ))) as typeof fetch;

  const esito = await eseguiRimborsoStripe(fintoFetch, 'rk_test', 'pi_abc123', 4500);
  assertEquals(esito, { esito: 'gia_rimborsato' });
});

Deno.test('eseguiRimborsoStripe: se la rete non risponde (fetch che lancia), il buono NON va toccato — fallito, non un\'eccezione che scappa', async () => {
  const fintoFetch = (() => Promise.reject(new Error('rete non raggiungibile'))) as typeof fetch;

  const esito = await eseguiRimborsoStripe(fintoFetch, 'rk_test', 'pi_abc123', 4500);
  assertEquals(esito.esito, 'fallito');
});

/* ============================================================
   messaggioScritturaFallita — regola 2: il rimborso è già partito,
   ma la scrittura sul database ha fallito tre volte. Il messaggio che
   torna all'operatore deve dire cosa è successo davvero e cosa fare,
   non un "errore" generico — altrimenti l'operatore non saprebbe se
   ritentare, se i soldi sono partiti o no, o cosa scrivere a mano.
   ============================================================ */

Deno.test('messaggioScritturaFallita nomina il codice del buono, l\'importo già rimborsato, e dice di segnarlo a mano', () => {
  const msg = messaggioScritturaFallita('LEO-AB12-CD34', 4500, 'pi_abc123');
  assertEquals(msg.includes('LEO-AB12-CD34'), true);
  assertEquals(msg.includes('45,00'), true, msg);
  assertEquals(/a mano|manualmente/.test(msg), true, msg);
  /* non basta dire "errore": deve dire che i soldi SONO GIA' TORNATI al
     cliente, o l'operatore potrebbe rimborsare una seconda volta a mano */
  assertEquals(/rimbors/i.test(msg), true, msg);
  assertNotEquals(msg.trim().toLowerCase(), 'errore');
});
