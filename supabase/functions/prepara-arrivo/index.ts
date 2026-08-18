// ============================================================
//  Prepara il tuo arrivo — Edge Function
//  Deploy:  supabase functions deploy prepara-arrivo --no-verify-jwt
//
//  Tre azioni:
//    POST ?action=crea      (interna, richiede x-hotel-key) → crea il link
//    GET  ?token=...                                       → dati del soggiorno
//    POST ?token=...                                       → salva la richiesta
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { desiderioValido, IN_RECEPTION } from './fanghi.ts';

const CHIAVE_INTERNA = Deno.env.get('HOTEL_KEY')!;        // segreto condiviso con l'estensione
const RESEND_KEY     = Deno.env.get('RESEND_API_KEY');     // opzionale, per le notifiche
const DESTINATARIO   = 'info@termeleonardo.com';
const BASE_PAGINA    = Deno.env.get('BASE_PAGINA') ?? 'https://arrivo.termeleonardo.com';

const db = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-hotel-key',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

const risposta = (dati: unknown, stato = 200) =>
  new Response(JSON.stringify(dati), {
    status: stato,
    headers: { ...CORS, 'Content-Type': 'application/json' }
  });

/* token opaco, 32 byte casuali in base64url */
function nuovoToken(): string {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...b))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/* --- pulizia dell'input: niente stringhe infinite nel database --- */
const testo = (v: unknown, max = 200) =>
  typeof v === 'string' ? v.trim().slice(0, max) || null : null;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const url    = new URL(req.url);
  const azione = url.searchParams.get('action');
  const token  = url.searchParams.get('token');

  try {
    // ---------- 1. CREAZIONE DEL LINK (solo interna) ----------
    if (req.method === 'POST' && azione === 'crea') {
      if (req.headers.get('x-hotel-key') !== CHIAVE_INTERNA) {
        return risposta({ errore: 'non autorizzato' }, 401);
      }
      const b = await req.json();
      for (const campo of ['reservation_id', 'intestatario', 'data_arrivo', 'data_partenza']) {
        if (!b[campo]) return risposta({ errore: `manca ${campo}` }, 400);
      }

      const t = nuovoToken();
      // il link resta valido fino a mezzanotte del giorno di partenza
      const scade = new Date(b.data_partenza + 'T23:59:59Z');

      const { error } = await db.from('arrivo_link').insert({
        token: t,
        reservation_id: String(b.reservation_id),
        numero_pratica: testo(b.numero_pratica, 40),
        intestatario:   testo(b.intestatario, 120),
        email:          testo(b.email, 160),
        lingua:         ['it','de','en','fr'].includes(b.lingua) ? b.lingua : 'it',
        data_arrivo:    b.data_arrivo,
        data_partenza:  b.data_partenza,
        adulti:         Number(b.adulti)  || 1,
        bambini:        Number(b.bambini) || 0,
        /* Lo sappiamo NOI, non l'ospite: ?action=crea riceve date e ospiti
           ma non il trattamento. Il dato ce l'ha gia' l'estensione
           (deduci(d).cure in popup.js, la stessa regola che decide se
           mettere il blocco «cure termali» nell'email) e da qui in poi lo
           passa. Serve a mostrare la domanda sui fanghi solo a chi le cure
           le fa davvero: a chi viene per due notti di relax sarebbe rumore. */
        cure:           b.cure === true,
        scade_il:       scade.toISOString()
      });
      if (error) return risposta({ errore: error.message }, 500);

      return risposta({ url: `${BASE_PAGINA}/?t=${t}` });
    }

    if (!token) return risposta({ errore: 'token mancante' }, 400);

    const { data: link } = await db
      .from('arrivo_link').select('*').eq('token', token).maybeSingle();

    if (!link) return risposta({ errore: 'link non valido' }, 404);
    if (new Date(link.scade_il) < new Date()) {
      return risposta({ errore: 'scaduto' }, 410);
    }

    // ---------- 2. DATI DEL SOGGIORNO ----------
    // Si restituisce il minimo indispensabile: mai email o id interni.
    if (req.method === 'GET') {
      return risposta({
        intestatario:  link.intestatario,
        numero:        link.numero_pratica,
        lingua:        link.lingua,
        data_arrivo:   link.data_arrivo,
        data_partenza: link.data_partenza,
        adulti:        link.adulti,
        bambini:       link.bambini,
        cure:          link.cure === true
      });
    }

    // ---------- 3. RICHIESTA DELL'OSPITE ----------
    if (req.method === 'POST') {
      const b = await req.json();

      const persone = Array.isArray(b.persone_extra)
        ? b.persone_extra.slice(0, 6).map((p: Record<string, unknown>) => ({
            nome: testo(p.nome, 80),
            eta:  testo(p.eta, 10)
          })).filter((p: {nome: string|null}) => p.nome)
        : [];

      const { error } = await db.from('arrivo_richiesta').insert({
        token,
        reservation_id:  link.reservation_id,
        ora_arrivo:      testo(b.ora_arrivo, 30),
        mezzo:           testo(b.mezzo, 20),
        fattura:         !!b.fattura,
        fatt_ragione:    testo(b.fatt_ragione, 160),
        fatt_indirizzo:  testo(b.fatt_indirizzo, 200),
        fatt_piva:       testo(b.fatt_piva, 20),
        fatt_cf:         testo(b.fatt_cf, 20),
        fatt_sdi:        testo(b.fatt_sdi, 10),
        fatt_pec:        testo(b.fatt_pec, 160),
        persone_extra:   persone,
        transfer:        !!b.transfer,
        transfer_tipo:   testo(b.transfer_tipo, 20),
        transfer_scalo:  testo(b.transfer_scalo, 40),
        transfer_volo:   testo(b.transfer_volo, 20),
        transfer_quando: b.transfer_quando || null,
        transfer_pax:    Number(b.transfer_pax) || null,
        transfer_cell:   testo(b.transfer_cell, 30),
        extra:           Array.isArray(b.extra) ? b.extra.slice(0, 10).map((e: unknown) => testo(e, 60)) : [],
        /* elenco chiuso: il valore arriva dal browser, e senza un elenco in
           reception arriverebbe qualunque stringa — dentro un'email col
           nostro logo */
        fanghi_desiderio: desiderioValido(b.fanghi_desiderio),
        note:            testo(b.note, 1000)
      });
      if (error) return risposta({ errore: error.message }, 500);

      // notifica alla reception: se fallisce, il dato è comunque salvato
      if (RESEND_KEY) {
        const righe: string[] = [
          `<b>${link.intestatario}</b> — pratica ${link.numero_pratica ?? link.reservation_id}`,
          `Soggiorno: ${link.data_arrivo} → ${link.data_partenza}`
        ];
        if (b.ora_arrivo)   righe.push(`Arrivo previsto: <b>${b.ora_arrivo}</b>${b.mezzo ? ' (' + b.mezzo + ')' : ''}`);
        if (b.fattura)      righe.push(`<b>FATTURA</b>: ${b.fatt_ragione ?? ''} · P.IVA ${b.fatt_piva ?? '—'} · SDI ${b.fatt_sdi ?? '—'} · ${b.fatt_indirizzo ?? ''}`);
        if (persone.length) righe.push(`<b>PERSONE DA AGGIUNGERE (da confermare)</b>: ${persone.map((p: {nome:string;eta:string|null}) => p.nome + (p.eta ? ' (' + p.eta + ')' : '')).join(', ')}`);
        if (b.transfer)     righe.push(`<b>TRANSFER</b>: ${b.transfer_scalo ?? ''} · ${b.transfer_tipo ?? ''} · volo ${b.transfer_volo ?? '—'} · ${b.transfer_quando ?? ''} · ${b.transfer_pax ?? '?'} pax · cell ${b.transfer_cell ?? '—'}`);
        /* DESIDERIO, non turno: il turno lo assegna la Segreteria Cure
           dopo la visita medica, e la riga qui deve dirlo o qualcuno la
           leggera' come un appuntamento gia' preso. */
        const desiderio = desiderioValido(b.fanghi_desiderio);
        if (desiderio) {
          righe.push(`<b>FANGHI</b> · desiderio dell'ospite: ${IN_RECEPTION[desiderio]} — il turno lo assegna la Segreteria Cure`);
        }
        if (b.extra?.length) righe.push(`Extra richiesti: ${b.extra.join(', ')}`);
        if (b.note)         righe.push(`Note: ${b.note}`);

        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: Deno.env.get('MITTENTE_EMAIL') || 'Prepara arrivo <noreply@hoteltermeleonardo.com>',
            to: [DESTINATARIO],
            subject: `PREPARA ARRIVO — ${link.intestatario} — ${link.data_arrivo}`,
            html: righe.join('<br>')
          })
        }).catch(() => { /* la richiesta è salvata comunque */ });
      }

      return risposta({ ok: true });
    }

    return risposta({ errore: 'metodo non consentito' }, 405);

  } catch (e) {
    return risposta({ errore: String(e) }, 500);
  }
});
