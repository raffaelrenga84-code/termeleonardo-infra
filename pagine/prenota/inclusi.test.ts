/* ============================================================
   inclusi.test.ts — che cosa comprende il soggiorno.

   IL DIFETTO CHE PRESIDIA. La pagina mostrava tre prezzi e nient'altro:
   chi confronta 190 e 260 senza sapere che cosa comprendono sceglie il
   numero più basso. Il motore del sito vecchio ha un pannello «Servizi
   inclusi» proprio per questo; qui non c'era.

   MA IL PRESIDIO VERO È UN ALTRO, e non riguarda il marketing. Tre voci
   di quell'elenco sono cose che, se non si leggono prima, diventano una
   discussione al banco:

   · in piscina LA CUFFIA È OBBLIGATORIA — chi non lo sa arriva senza;
   · grotte e zona relax sono SOLO PER ADULTI — chi viaggia con un figlio
     lo deve sapere prima di pagare, non alla reception;
   · l'accappatoio è uno a persona e IL CAMBIO SI PAGA.

   Il pannello del motore vecchio tace tutte e tre. Se un domani qualcuno
   accorcia l'elenco «perché è lungo», queste tre non devono cadere: è
   quello che questa prova impedisce.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';
import { INCLUSI, inclusiIn } from './inclusi.js';

const LINGUE = ['it', 'de', 'en', 'fr'] as const;

Deno.test('l elenco c e in tutte e quattro le lingue, con le stesse voci', () => {
  assertEquals(Object.keys(INCLUSI).sort(), [...LINGUE].sort());
  const quante = INCLUSI.it.length;
  assert(quante >= 8, `solo ${quante} voci: la prova non guarda niente`);
  for (const l of LINGUE) {
    assertEquals(
      INCLUSI[l].length,
      quante,
      `«${l}» ha ${INCLUSI[l].length} voci invece di ${quante}: una lingua dice meno delle altre`,
    );
  }
});

Deno.test('e nessuna voce e vuota o monca', () => {
  for (const l of LINGUE) {
    for (const [i, r] of INCLUSI[l].entries()) {
      /* la soglia serve a prendere il vuoto e il troncato, non a
         pretendere frasi: «Palestra» sono otto caratteri e «Gym» tre, e
         sono voci complete. Una soglia scelta a occhio aveva gia' fatto
         diventare rossa una modifica giusta. */
      assert(
        typeof r === 'string' && r.trim().length >= 3,
        `«${l}» voce ${i + 1} e vuota o troncata: «${r}»`,
      );
    }
  }
});

Deno.test('le tre cose che diventano un reclamo al banco ci sono, in ogni lingua', () => {
  /* non un controllo di stile: e' il motivo per cui questo elenco esiste
     ed e' piu' lungo di quello del motore vecchio */
  const PRETESE: [string, RegExp][] = [
    ['la cuffia obbligatoria', /cuffia|badekappe|swim cap|bonnet/i],
    ['il cambio accappatoio a pagamento', /cambio si paga|kostenpflichtig|is charged|payant/i],
  ];
  for (const l of LINGUE) {
    const tutto = INCLUSI[l].join(' | ');
    for (const [che, segno] of PRETESE) {
      assert(segno.test(tutto), `«${l}» non dice ${che}`);
    }
    /* solo adulti: due volte, grotte E zona relax. Una sola non basta. */
    const soloAdulti = INCLUSI[l].filter((r: string) =>
      /solo per adulti|nur für erwachsene|adults only|réserv[a-zéèêë]* aux adultes/i.test(r)
    );
    assertEquals(
      soloAdulti.length,
      2,
      `«${l}» dichiara «solo adulti» su ${soloAdulti.length} voci invece di 2 ` +
        '(grotte e zona relax): chi viaggia con un figlio lo scoprirebbe alla reception',
    );
  }
});

Deno.test('una lingua che non conosciamo ripiega sull italiano', () => {
  /* meglio una lingua sbagliata che una scheda muta su che cosa si compra */
  assertEquals(inclusiIn('xx'), INCLUSI.it);
  assertEquals(inclusiIn(''), INCLUSI.it);
  assertEquals(inclusiIn(undefined as unknown as string), INCLUSI.it);
  assertEquals(inclusiIn('DE'), INCLUSI.de, 'la lingua maiuscola non viene riconosciuta');
});

Deno.test('la pagina lo mostra davvero, e con un details vero', () => {
  const pagina = Deno.readTextFileSync(new URL('index.html', import.meta.url));
  assert(
    pagina.includes('inclusiIn(LNG)'),
    'la schermata non mostra piu che cosa comprende il soggiorno',
  );
  assert(
    pagina.includes('<details class="inclusi">') && pagina.includes('<summary>'),
    'il pannello non e piu un <details>: senza, non si apre da tastiera e lo screen reader non lo annuncia',
  );
});

Deno.test('la «i» accanto al prezzo riporta all elenco, senza copiarlo', () => {
  /* IL VINCOLO CHE DECIDE DOVE STA. La scheda di una tariffa e' un
     <button>: un pulsante dentro un pulsante non e' markup valido — da
     tastiera il secondo diventa irraggiungibile e lo screen reader ne
     annuncia uno solo. La «i» sta quindi fuori dalla scheda, sulla riga
     della camera, a un centimetro dal primo prezzo. */
  const pagina = Deno.readTextFileSync(new URL('index.html', import.meta.url));
  assert(pagina.includes('class="infoInclusi"'), 'sparita la «i»');
  assert(
    pagina.includes('aria-label="${esc(t.inclusiTit)}"'),
    'la «i» non ha un nome: chi si fa leggere la pagina sente solo «i»',
  );
  /* fuori dalla scheda: compare PRIMA del punto in cui le tariffe si
     disegnano */
  const dovI = pagina.indexOf('class="infoInclusi"');
  const dovTariffe = pagina.indexOf('accorpa(g.voci');
  assert(dovI > 0 && dovTariffe > 0);
  assert(
    dovI < dovTariffe,
    'la «i» e finita dentro la scheda della tariffa, che e un <button>: markup non valido',
  );
  /* e non disegna una copia dell elenco: apre quello che c e gia */
  assert(
    pagina.includes("document.querySelector('details.inclusi')"),
    'la «i» non apre piu il pannello: o non fa niente, o qualcuno ha copiato l elenco',
  );
  assert(
    pagina.split('inclusiIn(LNG)').length - 1 === 1,
    'l elenco viene disegnato piu di una volta: due copie divergeranno',
  );
});
