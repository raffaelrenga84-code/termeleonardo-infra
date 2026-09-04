/* ============================================================
   azioni.test.ts — index.ts non e' importabile (Deno.serve in cima): si
   legge come testo, come fanno le altre funzioni del repository.

   Presidia le regole che, se saltano, non si vedono da nessuna schermata:
   il numero dei posti che non deve uscire dalle azioni pubbliche, i posti
   restituiti se Stripe fallisce, il webhook che non rimanda l'email a un
   evento ripetuto, il rimborso solo a chi tocca il denaro.
   ============================================================ */
import { assert } from 'jsr:@std/assert';

const S = Deno.readTextFileSync(new URL('./index.ts', import.meta.url));
const senzaCommenti = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const CONFINE = '/* ---------- riservati';
const pubblica = () => senzaCommenti(S.slice(0, S.indexOf(CONFINE)));
const riservata = () => senzaCommenti(S.slice(S.indexOf(CONFINE)));

Deno.test('le azioni pubbliche e riservate esistono', () => {
  const azioni = ['listino', 'giorni', 'prenota', 'webhook', 'qr', 'stato', 'scadute', 'oggi', 'presenti', 'conto', 'elenco', 'disponibilita', 'rimborsa'];
  assert(azioni.length === 13);
  for (const a of azioni) assert(new RegExp(`azione === '${a}'`).test(S), `manca ?a=${a}`);
  assert(S.indexOf(CONFINE) > 1000, 'il confine fra pubblico e riservato deve esistere');
});

Deno.test('il numero dei posti non esce mai dalle azioni pubbliche', () => {
  const risposte = pubblica().match(/risposta\(\{[\s\S]*?\}\s*(?:,\s*\d+)?\)/g) ?? [];
  assert(risposte.length >= 10, `poche risposte trovate nella parte pubblica: ${risposte.length}`);
  for (const r of risposte) {
    assert(!/venduti|liberi|posti:/.test(r), `una risposta pubblica porta il numero dei posti: ${r.slice(0, 120)}`);
  }
});

Deno.test('prenota prende i posti con la funzione SQL e li libera se Stripe fallisce', () => {
  const prenota = S.slice(S.indexOf("azione === 'prenota'"), S.indexOf("azione === 'webhook'"));
  assert(/rpc\('dayspa_prendi_posti'/.test(prenota));
  assert(/rpc\('dayspa_libera_posti'/.test(prenota), 'un link Stripe fallito deve restituire i posti');
  assert(/scade_il: scadenza\(/.test(prenota), 'la prenotazione in pagamento deve avere la scadenza dei venti minuti');
});

Deno.test('il webhook verifica la firma e non rimanda l email a un evento ripetuto', () => {
  const w = S.slice(S.indexOf("azione === 'webhook'"), S.indexOf("azione === 'qr'"));
  assert(/await firmaValida\(/.test(w));
  assert(/stato === 'pagata'/.test(w) && /ripetuto: true/.test(w));
  /* la conferma (pagata, ricevuta in coda, email col QR) sta in una
     funzione sola, confermaPagata, chiamata dal webhook e da nessun altro */
  assert(/await confermaPagata\(/.test(w));
  const conferma = S.slice(S.indexOf('async function confermaPagata'), S.indexOf('Deno.serve('));
  assert(/emailConferma\(/.test(conferma) && /inviaEmail\(/.test(conferma) && /ricevuta_stato: 'da_battere'/.test(conferma));
  assert(S.split('confermaPagata(').length === 3, 'confermaPagata: una definizione e una chiamata sola');
});

Deno.test('le azioni riservate passano da autorizzato, e il rimborso da puoRimborsare', () => {
  const r = riservata();
  assert(/await autorizzato\(req\)/.test(r));
  assert(/vedeDayspa\(/.test(r));
  const rimborsa = r.slice(r.indexOf("azione === 'rimborsa'"));
  assert(/puoRimborsare\(/.test(rimborsa), 'il rimborso e solo di reception e amministrazione');
  assert(/rpc\('dayspa_libera_posti'/.test(rimborsa), 'un rimborso libera i posti');
});

Deno.test('scadute e protetta dalla chiave del cron, e usa la stessa variabile dei buoni', () => {
  const s = S.slice(S.indexOf("azione === 'scadute'"), S.indexOf(CONFINE));
  assert(/Deno\.env\.get\('CRON_KEY'\)/.test(s) && /x-cron-key/.test(s));
});

Deno.test('la disponibilita non scende mai sotto i posti gia venduti', () => {
  const d = riservata().slice(riservata().indexOf("azione === 'disponibilita'"));
  assert(/posti < [a-z.]*venduti/.test(d), 'caricare meno posti di quelli venduti va rifiutato');
});

Deno.test('la lettura da Fidra e riservata, passa dal modulo puro e chiede una persona per un intervallo', () => {
  assert(/azione === 'fidra'/.test(riservata()), '?a=fidra deve stare fra le riservate: legge il sito dell hotel per conto della reception');
  assert(/righeDaFidra\(/.test(riservata()) && /URL_FIDRA\(/.test(riservata()));
  /* l'indirizzo dell'API del sito precedente sta in fidra.ts, non qui (gli
     indirizzi email @termeleonardo.com invece qui ci stanno) */
  assert(!/termeleonardo\.com\/it\/api/.test(senzaCommenti(S)), 'l indirizzo dell API del sito precedente sta in fidra.ts, non qui');
});

Deno.test('il totem in hall segna i presenti con la sua chiave, solo col QR, solo per oggi, e non legge altro', () => {
  /* «procedi»: l'obliterazione fai da te in hall (la proprieta', 3
     settembre 2026). La chiave del totem apre UNA cosa sola: segnare i
     presenti della prenotazione di cui ha letto il QR, e solo se e' per
     oggi. Niente numero digitato, niente elenco, niente email o telefono
     nella risposta. */
  const s = S.slice(S.indexOf('/* ---------- i presenti'), S.indexOf("azione === 'elenco'"));
  assert(/Deno\.env\.get\('TOTEM_KEY'\)/.test(s) && /x-totem-key/.test(s), 'manca la chiave del totem');
  assert(/totem && !codice/.test(s) || /totem && numero/.test(s), 'col totem vale solo il codice del QR');
  assert(/totem && p\.giorno !== oggiRoma\(\)/.test(s), 'col totem vale solo oggi');
  assert(/totem \? \{ nome: agg\.nome, persone: agg\.persone, presenti: agg\.presenti \}/.test(s), 'al totem torna il minimo: nome, persone, presenti');
  /* e la presenza del totem non apre le altre azioni riservate */
  const confine = S.indexOf('/* ---------- riservati');
  const riservate = S.slice(confine, S.indexOf("azione === 'presenti'"));
  assert(!/x-totem-key/.test(riservate), 'la chiave del totem non deve passare dal cancello generale');
});

Deno.test('in modalita di prova ogni prenotazione porta il segno', () => {
  assert(/const PROVA = Deno\.env\.get\('DAYSPA_PROVA'\) === '1'/.test(S));
  assert(/prova: PROVA/.test(S));
});

Deno.test('il totem si riconosce anche dall IP fisso dell hotel, ma solo se la pagina dice di essere il totem', () => {
  /* «/ingresso-totem visibile solo dall IP 46.234.202.29, cosi non serve
     login» (la proprieta', 3 settembre 2026, notte). La chiave resta
     valida; in piu' una richiesta che PORTA l intestazione del totem e
     arriva dall IP in TOTEM_IP e' il totem. Senza intestazione no: lo
     sportello della reception, sulla stessa rete, deve restare sportello
     (numero digitato, presenti a mano, risposta intera). */
  const s = S.slice(S.indexOf('/* ---------- i presenti'), S.indexOf("azione === 'elenco'"));
  assert(s.includes("Deno.env.get('TOTEM_IP')"), 'manca TOTEM_IP');
  assert(s.includes('indirizzo('), 'l IP e quello della richiesta, letto dallo stesso helper dei freni');
  assert(s.includes("headers.get('x-totem-key')") && s.includes('=== null) return false'),
    'per IP conta solo chi porta l intestazione del totem');
});

Deno.test('il conto camera al totem: solo per il totem, chiave di Fidra nei secret del server, mai nella pagina', () => {
  /* «Procedi con la seconda strada» (la proprieta', 3 settembre 2026,
     notte; hldv ha dato il consenso, sola lettura). La pagina chiede il
     conto alla nostra funzione; la funzione lo chiede all'interfaccia di
     Fidra, la stessa del totem di hldv, con la chiave fra i secret
     (FIDRA_TOTEM_KEY). La pagina non vede la chiave, e la risposta esce
     solo a chi e' il totem. */
  const c = S.slice(S.indexOf("azione === 'conto'"), S.indexOf('/* ---------- riservati'));
  assert(c.length > 200, '?a=conto deve stare fra le azioni del totem, prima del cancello generale');
  assert(c.includes("Deno.env.get('FIDRA_TOTEM_KEY')") && c.includes("Deno.env.get('FIDRA_TOTEM_URL')"), 'chiave e indirizzo di Fidra dai secret');
  assert(c.includes('/api/bill-scanner/'), 'la stessa interfaccia del totem di hldv');
  assert(c.includes('if (!eTotem(req))'), 'il conto esce solo al totem');
  assert(c.includes('[0-9]{4,20}'), 'il codice della tessera sono solo cifre');
  assert(c.includes('riassuntoConto('), 'esce il riassunto, non la risposta grezza');
  const pagina = Deno.readTextFileSync(new URL('../../../pagine/ingresso/index.html', import.meta.url));
  assert(!pagina.includes('FIDRA_TOTEM_KEY') && !pagina.includes('bill-scanner'), 'la pagina non conosce ne la chiave ne l indirizzo di Fidra');
});
