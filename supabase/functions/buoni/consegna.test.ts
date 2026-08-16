/* ============================================================
   consegna.test.ts — il ricevitore degli eventi di consegna di Resend.

   PERCHE' QUESTI TEST ESISTONO. L'indirizzo `?a=consegna` e' PUBBLICO: deve
   esserlo, perche' Resend non ha la nostra chiave. L'unica cosa che
   distingue un evento vero da uno inventato e' la firma.

   Se la verifica passasse sempre, chiunque conosca l'indirizzo potrebbe
   mandare un finto «consegnato» e FABBRICARE la prova che in una
   contestazione useremmo per dire all'ospite che si sbaglia. E il difetto
   sarebbe invisibile: tutto funzionerebbe benissimo, gli eventi veri
   arriverebbero, e nessuno si accorgerebbe che passano anche quelli falsi.

   Per questo la maggior parte di questi test prova il RIFIUTO, non
   l'accettazione.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';
import { colonnaPerEvento, firmaValida } from './consegna.ts';

const SEGRETO = 'whsec_' + btoa('chiave-di-prova-per-i-test');
const CORPO = JSON.stringify({ type: 'email.delivered', data: { email_id: 'msg_123' } });

/* costruisce una firma vera come farebbe Resend, per avere un caso
   positivo credibile contro cui misurare tutti i rifiuti */
async function firmaVera(corpo: string, id: string, quando: string, segreto = SEGRETO) {
  const chiave = await crypto.subtle.importKey(
    'raw',
    Uint8Array.from(atob(segreto.slice('whsec_'.length)), (c) => c.charCodeAt(0)),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const f = await crypto.subtle.sign('HMAC', chiave, new TextEncoder().encode(`${id}.${quando}.${corpo}`));
  return 'v1,' + btoa(String.fromCharCode(...new Uint8Array(f)));
}

const adesso = () => String(Math.floor(Date.now() / 1000));

Deno.test('una firma vera viene accettata', async () => {
  const q = adesso();
  const f = await firmaVera(CORPO, 'msg-evt-1', q);
  assertEquals(await firmaValida(CORPO, 'msg-evt-1', q, f, SEGRETO), true);
});

Deno.test('una firma sbagliata viene rifiutata', async () => {
  const q = adesso();
  assertEquals(await firmaValida(CORPO, 'msg-evt-1', q, 'v1,YWJjZGVm', SEGRETO), false);
});

Deno.test('una firma fatta con un altro segreto viene rifiutata', async () => {
  const q = adesso();
  const f = await firmaVera(CORPO, 'msg-evt-1', q, 'whsec_' + btoa('un-altro-segreto'));
  assertEquals(await firmaValida(CORPO, 'msg-evt-1', q, f, SEGRETO), false);
});

/* il caso piu' insidioso: la firma e' autentica, ma il corpo e' stato
   cambiato dopo. Se si verificasse solo la presenza della firma invece del
   suo contenuto, questo passerebbe */
Deno.test('corpo modificato dopo la firma: rifiutato', async () => {
  const q = adesso();
  const f = await firmaVera(CORPO, 'msg-evt-1', q);
  const manomesso = CORPO.replace('msg_123', 'msg_999');
  assertEquals(await firmaValida(manomesso, 'msg-evt-1', q, f, SEGRETO), false);
});

/* un evento vero, intercettato una volta, non deve poter essere rigiocato
   per sempre: senza il controllo sul tempo un «consegnato» di sei mesi fa
   varrebbe ancora oggi */
Deno.test('firma valida ma vecchia di un giorno: rifiutata', async () => {
  const vecchio = String(Math.floor(Date.now() / 1000) - 86400);
  const f = await firmaVera(CORPO, 'msg-evt-1', vecchio);
  assertEquals(await firmaValida(CORPO, 'msg-evt-1', vecchio, f, SEGRETO), false);
});

Deno.test('firma valida ma con un timestamp nel futuro: rifiutata', async () => {
  const futuro = String(Math.floor(Date.now() / 1000) + 86400);
  const f = await firmaVera(CORPO, 'msg-evt-1', futuro);
  assertEquals(await firmaValida(CORPO, 'msg-evt-1', futuro, f, SEGRETO), false);
});

/* un segreto non configurato non e' un permesso: e' il caso in cui si
   sbaglia piu' facilmente, perche' in sviluppo «funziona tutto» */
Deno.test('segreto non configurato: rifiuta invece di accettare', async () => {
  const q = adesso();
  const f = await firmaVera(CORPO, 'msg-evt-1', q);
  assertEquals(await firmaValida(CORPO, 'msg-evt-1', q, f, ''), false);
  assertEquals(await firmaValida(CORPO, 'msg-evt-1', q, f, undefined), false);
});

Deno.test('intestazioni mancanti: rifiutato', async () => {
  const q = adesso();
  const f = await firmaVera(CORPO, 'msg-evt-1', q);
  assertEquals(await firmaValida(CORPO, '', q, f, SEGRETO), false);
  assertEquals(await firmaValida(CORPO, 'msg-evt-1', '', f, SEGRETO), false);
  assertEquals(await firmaValida(CORPO, 'msg-evt-1', q, '', SEGRETO), false);
});

/* Resend puo' mandare piu' firme separate da spazio (durante la rotazione
   del segreto): basta che UNA sia valida */
Deno.test('piu firme separate da spazio: basta che una sia valida', async () => {
  const q = adesso();
  const buona = await firmaVera(CORPO, 'msg-evt-1', q);
  assertEquals(await firmaValida(CORPO, 'msg-evt-1', q, 'v1,YWJj ' + buona, SEGRETO), true);
});

Deno.test('a ogni tipo di evento la sua colonna', () => {
  assertEquals(colonnaPerEvento('email.delivered'), 'promemoria_consegnato_il');
  assertEquals(colonnaPerEvento('email.bounced'), 'promemoria_respinto_il');
  assertEquals(colonnaPerEvento('email.complained'), 'promemoria_respinto_il');
});

/* un tipo sconosciuto non e' un errore: si accetta e si ignora. Se
   rispondessimo con un errore, Resend riproverebbe all'infinito */
Deno.test('tipo di evento sconosciuto: nessuna colonna, nessun errore', () => {
  assertEquals(colonnaPerEvento('email.opened'), null);
  assertEquals(colonnaPerEvento('qualcosa.di.nuovo'), null);
  assertEquals(colonnaPerEvento(''), null);
});

/* il tipo arriva da fuori: non deve poter pescare da Object.prototype */
Deno.test('il tipo di evento non indicizza il prototipo', () => {
  assertEquals(colonnaPerEvento('toString'), null);
  assertEquals(colonnaPerEvento('constructor'), null);
  assertEquals(colonnaPerEvento('__proto__'), null);
});

/* «letto» non si registra, ed e' una scelta: vedi il commento nella
   migrazione. Questo test la difende da chi un domani volesse aggiungerlo
   senza sapere perche' non c'e' */
Deno.test('email.opened non produce nessuna colonna: il «letto» non si registra', () => {
  assert(colonnaPerEvento('email.opened') === null,
    'il «letto» non si registra: Apple Mail scarica le immagini da solo, ' +
    'quindi risulterebbe letto anche cio che nessuno ha aperto — e in una ' +
    'contestazione sarebbe una prova contro di noi. Vedi 2026-08-15-promemoria-consegna.sql');
});
