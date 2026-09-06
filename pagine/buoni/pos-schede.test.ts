/* ============================================================
   pos-schede.test.ts - le tre schede del POS nel back office.

   Menu (stampante, portata, prezzo, esaurito, preferiti, varianti),
   tavoli (locali, zone, tavoli con posizione) e personale (camerieri col
   PIN che si scrive e non si rilegge mai, dispositivi col token mostrato
   una volta). Parlano con la funzione pos, ruolo amministrazione.
   ============================================================ */
import { assert } from 'jsr:@std/assert';

const P = Deno.readTextFileSync(new URL('./index.html', import.meta.url));

Deno.test('le tre schede del POS esistono e parlano con la funzione pos', () => {
  for (const v of ['vistaPosMenu', 'vistaPosTavoli', 'vistaPosPersonale']) assert(P.includes(`function ${v}(`), v);
  assert(P.includes("const FUNZIONE_POS = 'https://mvuiuwakuseockotlcnp.supabase.co/functions/v1/pos'"));
  assert(P.includes('a=menu-salva') && P.includes('a=tavoli-salva') && P.includes('a=personale-salva'));
  assert(P.includes("['posMenu'") && P.includes("['posTavoli'") && P.includes("['posPersonale'"), 'registrate in SCHEDE');
  assert(P.includes('a=allinea-giu'), 'legge tutto con allinea-giu');
});

Deno.test('nel menu si cambiano stampante, portata, prezzo, esaurito, preferiti, varianti; il PIN non si rilegge mai', () => {
  const menu = P.slice(P.indexOf('function vistaPosMenu('), P.indexOf('function vistaPosTavoli('));
  for (const c of ['stampante', 'portata', 'prezzo', 'esaurito', 'preferit', 'variant', 'note_rapide']) assert(menu.includes(c), c);
  const pers = P.slice(P.indexOf('function vistaPosPersonale('), P.indexOf('function vistaPosPersonale(') + 8000);
  assert(pers.includes('type="password"') && !pers.includes('pin_hash'));
  assert(pers.includes('token'), 'il token del dispositivo nuovo si mostra una volta');
});

Deno.test('la scheda degli addebiti in camera: la coda che la reception riporta in Fidra', () => {
  assert(P.includes("['posAddebiti', 'POS · Addebiti in camera']"), 'la scheda c e');
  assert(P.includes('function vistaPosAddebiti()'), 'e la disegna una funzione sua');
  assert(P.includes("chiama(`?a=addebiti&stato=${encodeURIComponent(stato)}`"), 'legge la coda');
  assert(P.includes("chiama('?a=addebito-segna'"), 'e la segna');
  assert(P.includes('data-segna="riportato"') && P.includes('data-segna="annullato"') && P.includes('data-segna="da_riportare"'), 'riportato, annullato, rimetti in coda');
  assert(P.includes('tessera letta') && P.includes('camera scritta a mano'), 'si vede se la camera l ha detta la tessera o una persona');
});

Deno.test('nella coda si vede la firma dell ospite, o che manca', () => {
  assert(P.includes('firmato dall’ospite') && P.includes('Senza firma: l’ospite non era al tavolo'), 'lo dice in cima');
  assert(P.includes('alt="firma dell’ospite"'), 'e la firma si guarda: al check-out chiude la discussione');
});

Deno.test('nel menu i nomi per gli ospiti dal QR: un pulsante per articolo apre nomi, ingredienti e allergeni; la categoria ha i nomi tradotti', () => {
  /* spec docs/superpowers/specs/2026-09-05-menu-ospiti-design.md */
  const menu = P.slice(P.indexOf('function vistaPosMenu('), P.indexOf('function vistaPosTavoli('));
  assert(menu.includes('data-tradu="${esc(a.id)}"') && menu.includes('data-tradu-di="${esc(a.id)}" hidden'), 'il pulsante e la riga che si apre');
  for (const k of ['data-an="${l}"', 'data-ad="${l}"', 'data-allergeni']) assert(menu.includes(k), k);
  assert(menu.includes('data-cn="${l}"'), 'i nomi della categoria nelle quattro lingue');
  assert(menu.includes('a.nomi = Object.keys(n).length ? n : null;') && menu.includes('c.nomi = Object.keys(cn).length ? cn : null;'), 'campi vuoti = null, non {}');
  assert(menu.includes("a.allergeni = al && al.value.trim() ? al.value.trim().toUpperCase() : null;"), 'le sigle in maiuscolo');
});

Deno.test('nel menu gli orari per gli ospiti dal QR: una riga sulla categoria, una sull articolo', () => {
  /* fase 2 della spec 2026-09-05-menu-ospiti-design.md */
  const menu = P.slice(P.indexOf('function vistaPosMenu('), P.indexOf('function vistaPosTavoli('));
  assert(menu.includes('data-c="orari"') && menu.includes('12:15-14:30; ven,sab 12:15-20:30'), 'la categoria, con l esempio');
  assert(menu.includes('data-orari') && menu.includes("a.orari = or && or.value.trim() ? or.value.trim() : null;"), 'l articolo, nella riga dei nomi');
  assert(menu.includes("(k === 'sotto' || k === 'locale_stampa' || k === 'orari') ? (v || null) : v"), 'vuoto = null');
});

Deno.test('nei locali si scrivono gli orari della cucina: fuori da quelli il biglietto della cucina esce al bancone', () => {
  const tav = P.slice(P.indexOf('function vistaPosTavoli('), P.indexOf('function vistaPosPersonale('));
  assert(tav.includes('data-l="orari_cucina"') && tav.includes('placeholder="12:15-14:30"'), 'il campo, con l esempio');
});

Deno.test('nel menu ogni articolo ha la spunta «QR»: senza, l ospite non lo vede', () => {
  const menu = P.slice(P.indexOf('function vistaPosMenu('), P.indexOf('function vistaPosTavoli('));
  assert(menu.includes('data-a="per_ospiti" ${a.per_ospiti !== false ? \'checked\' : \'\'}'), 'la spunta, accesa se non e mai stata spenta');
  assert(menu.includes('<th title="Lo vedono gli ospiti che ordinano dal QR">QR</th>'), 'la colonna');
});

Deno.test('la scheda «POS · Ordini dal QR»: un giorno alla volta, rimborsa, annulla l addebito, ristampa, nota', () => {
  /* spec docs/superpowers/specs/2026-09-05-ordini-qr-design.md */
  assert(P.includes("['posOrdiniQr', 'POS · Ordini dal QR']") && P.includes('posOrdiniQr: vistaPosOrdiniQr'), 'la scheda c e');
  const v = P.slice(P.indexOf('function vistaPosOrdiniQr('), P.indexOf('function vistaPosGiornata('));
  for (const a of ['a=ospite-ordini&da=', 'a=ospite-rimborsa', 'a=ospite-annulla-addebito', 'a=ospite-ristampa', 'a=ospite-nota']) assert(v.includes(a), a);
  assert(v.includes('>Rimborsa<') && v.includes('Annulla l’addebito') && v.includes('Ristampa la comanda'), 'i pulsanti');
  assert(P.includes("cifra('Rimborsi dal QR', num(g.rimborsi_qr_cent))"), 'la giornata mostra i rimborsi');
});

Deno.test('le postazioni dal back office: schermo, carta di ripiego, e il link della chiave', () => {
  /* Task 7 del piano «Monitor cucina» (6 settembre 2026) */
  const tav = P.slice(P.indexOf('function vistaPosTavoli('), P.indexOf('function vistaPosPersonale('));
  assert(tav.includes('<b>Postazioni</b>') && tav.includes('schermo'), 'il riquadro «Postazioni», con lo schermo');
  assert(tav.includes('data-post=') && tav.includes('data-p="ripiego_s"') && tav.includes('data-p="stampa_sempre"'), 'una riga per postazione');
  assert(tav.includes("chiama('?a=postazioni-salva'"), 'le salva nel cloud');
  assert(tav.includes('data-p="nuova_chiave"'), 'la chiave nuova si chiede con una spunta');
  assert(P.includes("const PC_BISTROT = 'http://192.168.0.18:8080';"), 'il PC del Bistrot');
  assert(tav.includes('const coda = `/tv/${encodeURIComponent(c.chiave)}`;') && tav.includes('PC_BISTROT'), 'i due link dello schermo, corti (/tv/CODICE): dal cloud e dal PC');
  assert(tav.includes('Si vede una volta sola'), 'la chiave non si rilegge');
  assert(tav.includes('postazioni: j.postazione') || P.includes('postazioni: j.postazione'), 'le postazioni scendono con allinea-giu');
});

Deno.test('le postazioni, dopo la rilettura: ripiego in bianco, locali gia salvati, link che non si perdono', () => {
  /* fix round 1 del piano «Monitor cucina» (6 settembre 2026) */
  const tav = P.slice(P.indexOf('function vistaPosTavoli('), P.indexOf('function vistaPosPersonale('));
  assert(tav.includes("el.dataset.p === 'ripiego_s' ? el.value : valoreCampo(el)"), 'il ripiego va su com e scritto: in bianco non e zero');
  assert(P.includes('localiSalvati: new Set((j.locale || []).map((l) => l.id))') && tav.includes('salvati.has(l.id)'), 'righe solo per i locali che il cloud conosce gia');
  assert(tav.includes('Un locale nuovo compare qui dopo'), 'e lo dice, invece di far sparire il locale nuovo senza spiegazioni');
  assert(tav.includes('chiaviHtml += riquadriChiavi(j.chiavi);'), 'i link nuovi si sommano ai vecchi invece di cancellarli');
  assert(tav.indexOf('chiaviHtml += riquadriChiavi(j.chiavi);') < tav.indexOf('const fresco = await caricaPos();'), 'e vanno in pagina PRIMA del ricarico');
  assert(tav.includes('Ricarico non riuscito'), 'un ricarico storto lo dice e basta: non porta via le chiavi');
  assert(tav.includes('ptNascondiChiavi'), 'i link se ne vanno solo quando lo si chiede');
  assert(tav.includes('raccogliPost();'), 'e le postazioni toccate sopravvivono a «+ locale», «+ zona» e «+ tavolo»');
});

Deno.test('le schede stanno in quattro famiglie: Buoni, Ospiti, Day Spa, POS', () => {
  assert(P.includes('const FAMIGLIE = [') && P.includes("['pos', 'POS', ['posOrdiniQr', 'posAddebiti', 'posGiornata', 'posMenu', 'posBacheca', 'posTavoli', 'posPersonale', 'posFasce']]"), 'la famiglia del POS');
  assert(P.includes('class="famiglie"') && P.includes('const famigliaDi = (scheda) =>'), 'la barra delle famiglie');
  for (const f of ["['buoni', 'Buoni', ['emetti', 'elenco', 'verifica']]", "['ospiti', 'Ospiti', ['richieste', 'arrivi', 'privacy']]", "['dayspa', 'Day Spa', ['dayspaOggi', 'dayspaDisponibilita', 'dayspaPrenotazioni']]"]) assert(P.includes(f), f);
});
