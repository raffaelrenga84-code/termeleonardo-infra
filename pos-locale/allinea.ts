/* ============================================================
   allinea.ts - il PC del Bistrot e il cloud si tengono allineati.

   SU (ogni 5 s): conti, righe, comande e stampe con allineato = 0 salgono
   con pos?a=allinea-su; il cloud tiene la versione con aggiornato_il piu'
   recente. Si segna allineato solo cio' che e' salito com'era: una riga
   cambiata durante la chiamata resta da mandare.
   GIU (ogni 60 s): menu', tavoli, personale e dispositivi cambiati dopo
   ultimo_giu scendono con pos?a=allinea-giu; con loro le stampe nate nel
   cloud (palmare in modalita' cloud), che entrano in coda qui gia'
   allineate: le stampa il PC, e l'esito risale con SU.
   BATTITO (ogni 5 s): pos?a=locale-vivo; finche' arriva, il cloud non
   stampa da se'.
   ============================================================ */
import { type Db, type Riga, salva } from './db.ts';

export type Cloud = { base: string; hotelKey: string; locale: string; fetch?: typeof globalThis.fetch };

const TABELLE_SU = [['pos_conto', 'conti'], ['pos_riga', 'righe'], ['pos_comanda', 'comande'], ['pos_addebito', 'addebiti'], ['pos_stampa', 'stampe'], ['pos_pagamento', 'pagamenti']] as const;
const JSON_DI: Record<string, string[]> = { pos_comanda: ['righe'], pos_addebito: ['righe'], pos_categoria: ['note_rapide', 'nomi'], pos_articolo: ['nomi', 'descrizioni'], pos_stampa: ['biglietto'] };
const TABELLE_GIU = ['locale', 'zona', 'tavolo', 'categoria', 'articolo', 'variante', 'preferito', 'cameriere', 'dispositivo', 'fascia', 'prezzo_fascia', 'postazione'];

async function chiama(cloud: Cloud, qs: string, init: RequestInit = {}): Promise<Riga> {
  const f = cloud.fetch ?? globalThis.fetch;
  const r = await f(cloud.base + qs, { ...init, headers: { 'content-type': 'application/json', 'x-hotel-key': cloud.hotelKey } });
  if (!r.ok) throw new Error(`cloud ${r.status}`);
  return await r.json() as Riga;
}

/** Manda al cloud cio' che e' nato o cambiato qui. Torna quante righe. */
export async function su(db: Db, cloud: Cloud): Promise<number> {
  const pacchetto: Record<string, Riga[]> = {};
  const mandate: { tabella: string; id: string; aggiornato_il: string }[] = [];
  for (const [tabella, chiave] of TABELLE_SU) {
    const righe = db.prepare(`select * from ${tabella} where allineato = 0 order by rowid limit 500`).all() as Riga[];
    pacchetto[chiave] = righe.map((r) => {
      const { allineato: _a, ...resto } = r;
      /* un JSON rotto (solo per mano sul database) non deve fermare per
         sempre la salita di conti, righe e pagamenti: il campo si svuota e
         si va avanti (revisione finale del monitor cucina, 6 settembre 2026) */
      for (const c of JSON_DI[tabella] ?? []) {
        if (typeof resto[c] !== 'string') continue;
        try { resto[c] = JSON.parse(resto[c] as string); } catch { resto[c] = c === 'biglietto' ? null : []; }
      }
      return resto;
    });
    for (const r of righe) mandate.push({ tabella, id: String(r.id), aggiornato_il: String(r.aggiornato_il) });
  }
  /* i conti tolti qui: cancellare non e' scrivere, e una riga sparita non
     sale con le altre. Gli id restano in pos_eliminato finche' il cloud
     non li ha tolti anche lui. */
  const eliminati = (db.prepare("select id from pos_eliminato where tabella = 'pos_conto' order by quando limit 200").all() as Riga[]).map((r) => String(r.id));
  if (!mandate.length && !eliminati.length) return 0;
  try { await chiama(cloud, '?a=allinea-su', { method: 'POST', body: JSON.stringify({ ...pacchetto, conti_eliminati: eliminati }) }); } catch { return 0; }
  for (const id of eliminati) db.prepare('delete from pos_eliminato where id = ?').run(id);
  const segna = new Map<string, ReturnType<Db['prepare']>>();
  for (const m of mandate) {
    if (!segna.has(m.tabella)) segna.set(m.tabella, db.prepare(`update ${m.tabella} set allineato = 1 where id = ? and aggiornato_il = ?`));
    segna.get(m.tabella)!.run(m.id, m.aggiornato_il);
  }
  return mandate.length;
}

/** Prende dal cloud cio' che e' cambiato dopo l'ultima volta. */
export async function giu(db: Db, cloud: Cloud): Promise<void> {
  const meta = db.prepare("select valore from pos_meta where chiave = 'ultimo_giu'").get() as { valore: string } | undefined;
  const da = meta?.valore ?? '1970-01-01T00:00:00Z';
  const j = await chiama(cloud, `?a=allinea-giu&da=${encodeURIComponent(da)}&locale=${encodeURIComponent(cloud.locale)}`);
  for (const t of TABELLE_GIU) {
    const righe = Array.isArray(j[t]) ? j[t] as Riga[] : [];
    if (t === 'preferito' && righe.length) {
      /* i preferiti il back office li riscrive per intero, locale per locale */
      for (const l of new Set(righe.map((r) => String(r.locale)))) db.prepare('delete from pos_preferito where locale = ?').run(l);
    }
    /* fasce e prezzi di fascia arrivano per intero: si riscrivono da capo */
    if ((t === 'fascia' || t === 'prezzo_fascia') && Array.isArray(j[t])) db.prepare('delete from pos_' + t).run();
    for (const r of righe) salva(db, 'pos_' + t, r);
  }
  for (const s of (Array.isArray(j.stampe) ? j.stampe as Riga[] : [])) {
    const c = db.prepare('select id from pos_stampa where id = ?').get(String(s.id));
    if (!c) salva(db, 'pos_stampa', { ...s, allineato: 1 });
  }
  if (typeof j.adesso === 'string') db.prepare("insert or replace into pos_meta (chiave, valore) values ('ultimo_giu', ?)").run(j.adesso);
}

/** «Sono vivo»: finche' il cloud lo sente, non stampa lui. */
export async function battito(cloud: Cloud): Promise<void> {
  await chiama(cloud, '?a=locale-vivo', { method: 'POST', body: JSON.stringify({ locale: cloud.locale }) });
}
