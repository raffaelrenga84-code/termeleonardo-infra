/* ============================================================
   culla.test.ts — la culla: quanto costa, dove ci sta, e che cosa
   succede a chi la chiede su una camera che non la ospita.

   IL DIFETTO, segnalato dalla proprietà: la pagina non aveva nessun modo
   di chiedere una culla. Chi viaggiava con un neonato sceglieva una
   Matrimoniale Queen convinto che ci stesse, e la culla si scopriva in
   reception a camera già assegnata: o si cambia categoria all'arrivo, se
   c'è posto, o si dice di no a un ospite arrivato con un bambino
   piccolo.

   I DUE FATTI DI CASA, confermati dalla proprietà il 22 agosto 2026:
   30 € per TUTTO IL SOGGIORNO — non al giorno come il cane — e la culla
   ci sta solo nelle Junior Suite e nelle Suite.

   QUATTRO MODI DI ROMPERSI, e nessuno si vede spuntando la casella su
   una Suite e guardando che non esploda niente:

   · «al giorno» copiato dal testo del cane: su un soggiorno di dieci
     notti sono 300 € promessi invece di 30;
   · l'elenco delle categorie che ospitano la culla resta indietro quando
     il catalogo cambia, e una Suite nuova si sente dire di no;
   · si dice «deve cambiare categoria» e non si propone niente, cioè si
     manda via l'ospite con un problema e senza una strada;
   · la culla parte col modulo e il server la scarta, o arriva al
     database e non compare nell'avviso alla reception — il difetto del
     buono regalo, già visto in questo progetto.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';
import {
  CAMERE_CON_CULLA, ciStaLaCulla, primaConCulla, soloConCulla, SUPPLEMENTO_CULLA_CENT,
} from './culla.js';
import { corpoCamera, euroDaCentesimi } from './logica.js';
import { CAMERE } from '../../supabase/functions/richieste/camere.ts';
import { validaDati } from '../../supabase/functions/richieste/tipi.ts';
import { dettagli, ETICHETTE, LINGUE } from '../../supabase/functions/richieste/dettagli-richiesta.ts';

const PAGINA = Deno.readTextFileSync(new URL('index.html', import.meta.url))
  .split('\r\n').join('\n');
const OGGI = new Date('2026-08-22T09:00:00Z');

/* ============ i due numeri di casa ============ */

Deno.test('trenta euro, e per TUTTO il soggiorno', () => {
  assertEquals(SUPPLEMENTO_CULLA_CENT, 3000);
  assertEquals(euroDaCentesimi(SUPPLEMENTO_CULLA_CENT), '30,00');
});

Deno.test('e il testo NON dice «al giorno», in nessuna delle quattro lingue', () => {
  /* il difetto piu' facile e il piu' caro: copiare la frase del cane, che
     e' 13 € AL GIORNO. Su dieci notti sarebbero 300 € promessi invece di
     30, scritti su una pagina che vende. */
  const note = [...PAGINA.matchAll(/cullaNota:\(imp\)=>`([^`]*)`/g)].map((m) => m[1]);
  assertEquals(note.length, 4, `le note della culla sono ${note.length}, non 4`);
  const alGiorno = [/al giorno(?!,)/i, /pro Tag(?!,)/i, /per day(?!,)/i, /par jour(?!,)/i];
  for (const [i, n] of note.entries()) {
    /* «non al giorno» e' proprio quello che si vuole leggere: si cerca la
       promessa, non la smentita */
    const promessa = n.replace(/non al giorno|nicht pro Tag|not per day|pas par jour/gi, '');
    for (const re of alGiorno) {
      assert(!re.test(promessa), `la nota ${i + 1} promette un prezzo al giorno: «${n}»`);
    }
    assert(
      /tutto il soggiorno|gesamten Aufenthalt|whole stay|tout le séjour/i.test(n),
      `la nota ${i + 1} non dice che vale per tutto il soggiorno: «${n}»`,
    );
  }
});

/* ============ dove ci sta ============ */

Deno.test('la culla ci sta nelle Junior Suite e nelle Suite', () => {
  for (const id of [7, 8, 9, 10, 11, 12]) {
    assert(ciStaLaCulla(id), `${CAMERE[id]?.nome ?? id} dovrebbe ospitare la culla`);
  }
});

Deno.test('e non nelle singole, nella Doppia, nella Queen', () => {
  /* i tre casi nominati dalla proprieta', piu' le altre due singole */
  for (const id of [2, 3, 4, 5, 6]) {
    assert(!ciStaLaCulla(id), `${CAMERE[id]?.nome ?? id} non dovrebbe ospitare la culla`);
  }
});

Deno.test('si sbaglia CHIUSO: quello che non conosciamo non ospita la culla', () => {
  /* l'errore opposto manderebbe l'ospite ad Abano con una culla che non
     entra in camera, e quello si paga al banco */
  /* «7» come stringa NON e in questo elenco apposta: e lo stesso
     identificativo scritto in un altro modo, e la camera e quella. Si
     sbaglia chiuso su quello che non conosciamo, non su come e scritto. */
  for (const v of [null, undefined, '', 'sette', 99, 7.5, {}, [], NaN, '  ']) {
    assertEquals(ciStaLaCulla(v as number), false, `«${JSON.stringify(v)}» e passato`);
  }
});

Deno.test('l elenco non resta indietro quando il catalogo cambia', () => {
  /* PRESIDIO VERO: se domani nasce una Suite nuova in camere.ts e nessuno
     la aggiunge qui, questa prova lo dice — altrimenti la Suite nuova si
     sentirebbe rispondere che la culla non ci sta. */
  for (const id of CAMERE_CON_CULLA) {
    assert(CAMERE[id], `la camera ${id} non esiste nel catalogo`);
    assert(
      /suite/i.test(CAMERE[id].nome),
      `«${CAMERE[id].nome}» e nell elenco della culla ma non e una suite`,
    );
  }
  for (const [id, c] of Object.entries(CAMERE)) {
    if (/suite/i.test(c.nome)) {
      assert(
        ciStaLaCulla(Number(id)),
        `«${c.nome}» e una suite ma non e nell elenco della culla`,
      );
    }
  }
});

/* ============ che cosa si propone ============ */

const PROPOSTE = [
  { camera_id: 6, nome: 'Matrimoniale Queen', prezzo_cent: 38000 },
  { camera_id: 5, nome: 'Doppia', prezzo_cent: 36000 },
  { camera_id: 9, nome: 'Suite Colli Euganei', prezzo_cent: 62000 },
  { camera_id: 7, nome: 'Junior Suite Colli Euganei', prezzo_cent: 48000 },
  { camera_id: 12, nome: 'Junior Suite Abano', prezzo_cent: 51000 },
];

Deno.test('si propone la MENO CARA fra le libere che ospitano la culla', () => {
  /* chi si sente dire «deve cambiare categoria» sta gia' ricevendo una
     notizia che costa: proporgli la Suite quando basta una Junior Suite e'
     il modo piu' veloce di far chiudere la pagina */
  const p = primaConCulla(PROPOSTE);
  assertEquals(p?.nome, 'Junior Suite Colli Euganei');
  assertEquals(p?.prezzo_cent, 48000);
});

Deno.test('e si porta dietro il suo posto nell elenco, non uno qualunque', () => {
  /* e' l indice che il pulsante usa per cambiare la camera scelta: uno
     sbagliato sceglierebbe un altra camera, in silenzio */
  assertEquals(primaConCulla(PROPOSTE)?.indice, 3);
});

Deno.test('quando non ce n e nessuna non si propone niente', () => {
  /* un pulsante che non porta da nessuna parte e peggio di nessun
     pulsante: li' si dice soltanto di chiamare */
  assertEquals(primaConCulla(PROPOSTE.slice(0, 2)), null);
  assertEquals(primaConCulla([]), null);
  assertEquals(primaConCulla(undefined as unknown as []), null);
});

Deno.test('e una camera senza prezzo non si propone', () => {
  /* «Passi alla Junior Suite — undefined €» */
  assertEquals(
    primaConCulla([{ camera_id: 7, nome: 'Junior Suite Colli Euganei' }])?.nome,
    undefined,
  );
});

/* ============ quello che l ospite legge ============ */

function banco(): {
  chiesta: (t: Record<string, unknown>) => string;
  avviso: (t: Record<string, unknown>) => string;
  metti: (culla: boolean, scelta: unknown, proposte: unknown[]) => void;
} {
  const pezzo = (re: RegExp, come: string) => {
    const m = PAGINA.match(re);
    assert(m, `${come} non si trova nella pagina: se e stato rinominato questa ` +
      'prova va aggiornata, non cancellata');
    return m![0];
  };
  const f = new Function(
    'aiuti',
    `
    const { esc, euroDaCentesimi, ciStaLaCulla, primaConCulla, SUPPLEMENTO_CULLA_CENT } = aiuti;
    const CULLA_SEGNO = '<svg class="segno"></svg>';
    let CULLA = false, SCELTA = null, PROPOSTE = [];
    ${pezzo(/function cullaChiestaHTML\(t\) \{[\s\S]*?\n\}/, 'cullaChiestaHTML')}
    ${pezzo(/function cullaAvvisoHTML\(t\) \{[\s\S]*?\n\}/, 'cullaAvvisoHTML')}
    return {
      chiesta: cullaChiestaHTML, avviso: cullaAvvisoHTML,
      metti: (c, s, p) => { CULLA = c; SCELTA = s; PROPOSTE = p; },
    };
  `,
  );
  return f({
    esc: (x: unknown) => String(x ?? '').replace(/</g, '&lt;'),
    euroDaCentesimi, ciStaLaCulla, primaConCulla, SUPPLEMENTO_CULLA_CENT,
  });
}

const T = {
  culla: 'Ci serve una culla',
  cullaNota: (imp: string) => `Supplemento ${imp} € per tutto il soggiorno, non al giorno.`,
  cullaNoQui: (nome: string) => `Nella ${nome} la culla non ci sta.`,
  cullaCambia: (nome: string, prezzo: string) => `Passi alla ${nome} — ${prezzo} €`,
  cullaNessuna: 'Ci chiami allo +39 049 9939200.',
};

Deno.test('la domanda c e sempre, il prezzo solo a chi risponde di si', () => {
  /* «supplemento 30 €» stampato a chi non ha chiesto niente e' un prezzo
     in piu' su una pagina che ne ha gia' tanti */
  const b = banco();
  b.metti(false, null, []);
  const spenta = b.chiesta(T);
  assert(spenta.includes('id="fCulla"'), 'sparita la domanda della culla');
  assert(!spenta.includes('Supplemento'), 'il prezzo esce anche a chi non ha chiesto la culla');

  b.metti(true, null, []);
  const accesa = b.chiesta(T);
  assert(accesa.includes('checked'), 'la spunta non si ricorda di essere accesa');
  assert(accesa.includes('30,00'), 'chi ha chiesto la culla non legge quanto costa');
});

Deno.test('su una camera che la ospita non si dice niente', () => {
  const b = banco();
  b.metti(true, { camera_id: 9, nome: 'Suite Colli Euganei' }, PROPOSTE);
  assertEquals(b.avviso(T), '');
});

Deno.test('e su una che non la ospita si dice, e si propone', () => {
  /* le due meta' della cosa chiesta dalla proprieta': informare che deve
     cambiare categoria, e proporre la prossima camera libera che la ospita */
  const b = banco();
  b.metti(true, { camera_id: 6, nome: 'Matrimoniale Queen' }, PROPOSTE);
  const html = b.avviso(T);
  assert(html.includes('Matrimoniale Queen'), 'l avviso non dice quale camera');
  assert(html.includes('Junior Suite Colli Euganei'), 'non propone la camera che la ospita');
  assert(html.includes('480,00'), 'non dice quanto costa quella che propone');
  assert(html.includes('data-indice="3"'), 'il pulsante non porta il posto giusto');
});

Deno.test('e senza una camera libera che la ospiti si dice di chiamare', () => {
  const b = banco();
  b.metti(true, { camera_id: 6, nome: 'Matrimoniale Queen' }, PROPOSTE.slice(0, 2));
  const html = b.avviso(T);
  assert(html.includes('049 9939200'), 'non si dice di chiamare');
  assert(!html.includes('bCullaCambia'), 'c e un pulsante che non porta da nessuna parte');
});

Deno.test('e chi non ha chiesto la culla non legge nessun avviso', () => {
  const b = banco();
  b.metti(false, { camera_id: 6, nome: 'Matrimoniale Queen' }, PROPOSTE);
  assertEquals(b.avviso(T), '');
});

/* ============ arriva in reception ============ */

Deno.test('la culla viaggia con la SUA camera, non con l ospite', () => {
  /* chi prenota due stanze puo' volerla in una sola */
  const con = corpoCamera({
    scelta: { nome: 'Suite', camera_id: 9, prezzo_cent: 62000 },
    checkIn: '2026-09-02', checkOut: '2026-09-04', adulti: 2, bambini: 0, culla: true,
  });
  assertEquals(con.dati.culla, true);
  const senza = corpoCamera({
    scelta: { nome: 'Doppia', camera_id: 5, prezzo_cent: 36000 },
    checkIn: '2026-09-02', checkOut: '2026-09-04', adulti: 2, bambini: 0,
  });
  assertEquals('culla' in senza.dati, false, 'una camera senza culla porta comunque il campo');
});

Deno.test('il server la registra, e non registra un «no»', () => {
  /* un «culla: false» in back office e' rumore che si legge come un dato
     raccolto, come il cane */
  const con = validaDati('soggiorno', { camera_id: 9, culla: true }, OGGI);
  assertEquals(con.dati!.culla, true);
  for (const v of [false, undefined, 0, '', 'no']) {
    const senza = validaDati('soggiorno', { camera_id: 9, culla: v }, OGGI);
    assertEquals('culla' in senza.dati!, false, `«${JSON.stringify(v)}» ha prodotto un campo`);
  }
});

Deno.test('e il server NON rifiuta una culla su una camera che non la ospita', () => {
  /* rifiutare qui farebbe perdere la richiesta invece di dare un consiglio:
     a dirglielo ci pensa la pagina, mentre puo' ancora cambiare idea. Una
     richiesta che arriva in reception vale piu' di una respinta. */
  const v = validaDati('soggiorno', { camera_id: 6, culla: true }, OGGI);
  assertEquals(v.errore, undefined);
  assertEquals(v.dati!.culla, true);
});

Deno.test('e compare nell avviso alla reception, in tutte e quattro le lingue', () => {
  const attese: Record<string, string> = {
    it: 'Culla', de: 'Kinderbett', en: 'Cot', fr: 'Lit bébé',
  };
  for (const l of LINGUE) {
    const html = dettagli('soggiorno', { culla: true }, ETICHETTE[l]);
    assert(html.includes(attese[l]), `in ${l} manca «${attese[l]}»`);
  }
  const senza = dettagli('soggiorno', { tipo_camera: 'Doppia' }, ETICHETTE.it);
  assert(!senza.includes('Culla'), 'la riga esce anche a chi non ha chiesto la culla');
});

/* ============ la pagina, com e scritta ============ */

Deno.test('la domanda sta in CIMA all elenco, non dopo le camere', () => {
  /* chiederla dopo aver scelto vorrebbe dire far scegliere alla cieca e
     poi rimandare indietro: e' il difetto che questa funzione corregge */
  const domanda = PAGINA.indexOf('${cullaChiestaHTML(t)}');
  const prima = PAGINA.indexOf('${visibili.map(g =>');
  assert(domanda > 0, 'la domanda non si disegna piu');
  assert(prima > 0, 'l elenco delle camere non si disegna piu');
  assert(domanda < prima, 'la domanda della culla sta sotto l elenco delle camere');
});

Deno.test('e le camere che non la ospitano non si vedono affatto', () => {
  /* detto dalla proprieta' guardando la pagina vera: «se non ci sta non
     farmela nemmeno vedere». Prima si mostravano tutte con scritto
     accanto «qui la culla non ci sta» — cioe' una camera da scartare a
     mano, e scartare a mano lo deve fare la pagina. */
  const camere = [
    { camera_id: 6, nome: 'Matrimoniale Queen' },
    { camera_id: 7, nome: 'Junior Suite Colli Euganei' },
    { camera_id: 5, nome: 'Doppia' },
    { camera_id: 9, nome: 'Suite Colli Euganei' },
  ];
  assertEquals(
    soloConCulla(camere, true).map((g: { nome: string }) => g.nome),
    ['Junior Suite Colli Euganei', 'Suite Colli Euganei'],
  );
});

Deno.test('e chi non l ha chiesta continua a vederle tutte', () => {
  /* il filtro esiste solo per chi ha risposto di si: a tutti gli altri
     toglierebbe otto camere su undici senza che l abbiano chiesto */
  const camere = [{ camera_id: 6 }, { camera_id: 7 }];
  assertEquals(soloConCulla(camere, false).length, 2);
  assertEquals(soloConCulla(camere, undefined as unknown as boolean).length, 2);
  assertEquals(soloConCulla(camere, 'si' as unknown as boolean).length, 2);
  assertEquals(soloConCulla(undefined as unknown as [], true), []);
});

Deno.test('il filtro della culla arriva DOPO il conto delle camere separate', () => {
  /* «separabili» confronta quante camere sono state tolte PER LE PERSONE:
     contarci dentro anche quelle tolte per la culla proporrebbe di
     dividersi in piu' camere a chi ha solo chiesto un lettino */
  const sep = PAGINA.indexOf('const separabili =');
  const filtro = PAGINA.indexOf('const conLaCulla = soloConCulla(capienti, CULLA);');
  const ordine = PAGINA.indexOf('const inOrdine = ordinaGruppi(conLaCulla, persone);');
  assert(sep > 0 && filtro > 0 && ordine > 0, 'il filtro della culla non si applica piu');
  assert(filtro > sep, 'il filtro della culla falsa il conto delle camere separate');
  assert(ordine > filtro, 'si ordina prima di filtrare');
  /* e UNA volta sola: una seconda chiamata dentro il conto di
     «separabili» lo rimetterebbe a mentire, lasciando questa in pace */
  assertEquals(
    PAGINA.split('soloConCulla(').length - 1,
    1,
    'il filtro della culla si applica piu di una volta: uno dei due punti ' +
      'falsa il conto delle camere separate',
  );
});

Deno.test('e un elenco rimasto vuoto non resta muto', () => {
  /* per quelle date puo' non esserci nessuna suite libera: un elenco
     vuoto e senza spiegazione sembra la pagina rotta */
  assert(
    PAGINA.includes('${CULLA && !inOrdine.length'),
    'l elenco svuotato dalla culla resta senza spiegazione',
  );
});

Deno.test('e non resta in giro la frase che non serve piu', () => {
  /* «qui la culla non ci sta» era la nota sulle schede: adesso quelle
     schede non ci sono. Un testo morto in quattro lingue e' una trappola
     per il prossimo che lo trova e lo crede in uso. */
  assertEquals(PAGINA.split('cullaNoScheda').length - 1, 0);
  assertEquals(PAGINA.split('senzaCulla').length - 1, 0);
});

/* I DUE GESTORI SI ESEGUONO. Guardare il testo della pagina diceva che
   schermaCamere() era nominato, non che ci si arrivava: un return messo
   prima lasciava la prova verde e l'elenco fermo. */
function mani(indice: number) {
  const blocco = (re: RegExp, come: string) => {
    const m = PAGINA.match(re);
    assert(m, `il gestore ${come} non si trova nella pagina`);
    return m![0];
  };
  const f = new Function(
    'avvia',
    `
    let CULLA = false, SCELTA = null;
    let PROPOSTE = avvia.proposte;
    let ridisegni = 0;
    const schermaCamere = () => { ridisegni++; };
    const nodi = {
      fCulla: { checked: false, onchange: null },
      bCullaCambia: { dataset: { indice: String(avvia.indice) }, onclick: null },
    };
    const $ = (id) => nodi[id] || null;
    ${blocco(/if \(\$\('fCulla'\)\) \{[\s\S]*?\n  \}/, 'della spunta')}
    ${blocco(/if \(\$\('bCullaCambia'\)\) \{[\s\S]*?\n  \}/, 'del cambio camera')}
    return {
      spunta: (v) => {
        nodi.fCulla.checked = v;
        nodi.fCulla.onchange();
        return { culla: CULLA, ridisegni };
      },
      cambia: () => {
        nodi.bCullaCambia.onclick();
        return { scelta: SCELTA, ridisegni };
      },
    };
  `,
  );
  return f({ proposte: PROPOSTE, indice }) as {
    spunta: (v: boolean) => { culla: boolean; ridisegni: number };
    cambia: () => { scelta: Record<string, unknown> | null; ridisegni: number };
  };
}

Deno.test('la spunta accende la culla E ridisegna tutto l elenco', () => {
  /* dalla risposta dipendono le note sulle schede e l'avviso nella barra:
     ridisegnare solo la spunta le lascerebbe indietro */
  const m = mani(3);
  const acceso = m.spunta(true);
  assertEquals(acceso.culla, true, 'la spunta non accende la culla');
  assertEquals(acceso.ridisegni, 1, 'l elenco non si ridisegna');
  const spento = m.spunta(false);
  assertEquals(spento.culla, false, 'la culla non si spegne piu');
  assertEquals(spento.ridisegni, 2, 'spegnendola l elenco non si ridisegna');
});

Deno.test('e il pulsante sceglie DAVVERO la camera proposta', () => {
  const dopo = mani(3).cambia();
  assertEquals(dopo.scelta?.nome, 'Junior Suite Colli Euganei');
  assertEquals(dopo.scelta?.indice, 3);
  assertEquals(dopo.ridisegni, 1, 'la camera cambia ma l elenco resta quello di prima');
});

Deno.test('e un indice fuori elenco non fa esplodere la pagina', () => {
  /* il pulsante porta un numero che viene dal markup: se l elenco nel
     frattempo e cambiato, quel numero puo non esserci piu */
  const dopo = mani(99).cambia();
  assertEquals(dopo.scelta, null, 'si sceglie una camera che non esiste');
  assertEquals(dopo.ridisegni, 0, 'si ridisegna per niente');
});
Deno.test('e la culla si rilegge prima di mandare la richiesta', () => {
  /* spuntata sul passo delle camere e mai piu' vista: chi arriva al modulo
     non ha modo di accorgersi di averla chiesta, o di non averla chiesta */
  assertEquals(PAGINA.split('cullaBreve:').length - 1, 4);
  /* DUE posti, non uno: il carrello e il riepilogo del modulo quando le
     camere sono piu' d'una. Cercare la stringa senza contarla lasciava
     la prova verde togliendola da uno dei due. Chi li disegna davvero e'
     carrello.test.ts. */
  assertEquals(
    PAGINA.split("c.culla ? ' · ' + esc(t.cullaBreve) : ''").length - 1,
    2,
    'la culla non si rilegge piu in tutti e due i riepiloghi',
  );
  assert(PAGINA.includes('(c.culla ? ` · ${esc(t.cullaBreve)}` : \'\')'), 'sparita dal riepilogo');
});

Deno.test('e le parole della culla ci sono in tutte e quattro le lingue', () => {
  /* col rientro e l apice: «culla:» da solo prende anche i campi che la
     fanno viaggiare nel carrello e nella richiesta, che sono un altra cosa */
  for (const k of ["    culla:'", 'cullaNota:', 'cullaNoQui:', 'cullaCambia:', 'cullaNessuna:']) {
    assertEquals(PAGINA.split(k).length - 1, 4, `«${k}» non c'e' in tutte e quattro le lingue`);
  }
});
