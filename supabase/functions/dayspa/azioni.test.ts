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
  const azioni = ['listino', 'giorni', 'prenota', 'webhook', 'qr', 'stato', 'scadute', 'oggi', 'presenti', 'elenco', 'disponibilita', 'rimborsa'];
  assert(azioni.length === 12);
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

Deno.test('in modalita di prova ogni prenotazione porta il segno', () => {
  assert(/const PROVA = Deno\.env\.get\('DAYSPA_PROVA'\) === '1'/.test(S));
  assert(/prova: PROVA/.test(S));
});
