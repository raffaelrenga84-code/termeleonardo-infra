/* ============================================================
   db.ts - lo schema SQLite del server locale (PC del Bistrot).

   Le stesse tabelle del cloud (supabase/2026-09-04-pos.sql), tradotte:
   date ISO in `text`, booleani in `integer` 0/1, array in `text` JSON.
   In piu': `allineato` (0 = da mandare al cloud) sulle tabelle che
   nascono qui, e pos_meta per ricordare l'ultimo allineamento in giu'.
   Ripetibile: solo `create table if not exists`.

   Nessuna chiave esterna imposta: la verita' e' nel cloud, e le righe
   possono arrivare in qualunque ordine.
   ============================================================ */
import { DatabaseSync } from 'node:sqlite';

export type Db = DatabaseSync;
export type Riga = Record<string, unknown>;
type Valore = string | number | bigint | null;

export function apri(percorso: string): Db {
  const db = new DatabaseSync(percorso);
  if (percorso !== ':memory:') db.exec('pragma journal_mode = wal');
  return db;
}

const ORA = "(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))";

export function creaSchema(db: Db): void {
  db.exec(`
create table if not exists pos_locale (
  id text primary key, nome text not null, reparto text not null default 'F&B',
  stampante_cucina text, stampante_bar text, aggiornato_il text not null default ${ORA});
create table if not exists pos_zona (
  id text primary key, locale text not null, nome text not null, posizione integer not null default 0,
  aggiornato_il text not null default ${ORA});
create table if not exists pos_tavolo (
  id text primary key, zona text not null, nome text not null, posti integer not null default 4,
  x integer not null default 0, y integer not null default 0, attivo integer not null default 1,
  aggiornato_il text not null default ${ORA});
create table if not exists pos_categoria (
  nomi text,
  id text primary key, nome text not null, posizione integer not null default 0, colore text,
  stampante text not null, portata text not null default 'secondi', sotto text,
  note_rapide text not null default '[]', fidra_id text, locale_stampa text, attiva integer not null default 1,
  aggiornato_il text not null default ${ORA});
create table if not exists pos_articolo (
  nomi text, descrizioni text, allergeni text,
  id text primary key, categoria text not null, nome text not null, prezzo_cent integer not null default 0,
  iva integer not null default 10, portata text, stampante text, prezzo_libero integer not null default 0,
  incluso_trattamento integer not null default 0, conto_ricavo text, esaurito integer not null default 0,
  posizione integer not null default 0, fidra_id text, locale_stampa text, attivo integer not null default 1,
  aggiornato_il text not null default ${ORA});
create table if not exists pos_variante (
  id text primary key, articolo text, categoria text, nome text not null,
  supplemento_cent integer not null default 0, posizione integer not null default 0,
  aggiornato_il text not null default ${ORA});
create table if not exists pos_preferito (
  id text primary key, locale text not null, articolo text not null, posizione integer not null,
  aggiornato_il text not null default ${ORA});
create table if not exists pos_cameriere (
  id text primary key, nome text not null, codice text not null, pin_hash text not null,
  ruolo text not null, storni integer not null default 0, bloccato integer not null default 0,
  senza_pin integer not null default 0,
  aggiornato_il text not null default ${ORA});
create table if not exists pos_dispositivo (
  id text primary key, nome text not null, token text not null, locale text, ultimo_accesso text,
  bloccato integer not null default 0, aggiornato_il text not null default ${ORA});
create table if not exists pos_sessione (
  id text primary key, cameriere text not null, dispositivo text not null, scade_il text not null,
  aggiornato_il text not null default ${ORA});
create table if not exists pos_conto (
  id text primary key, tavolo text not null, tipo text not null, camera text, ospite text, tessera text, nome text, lingua text,
  coperti integer not null default 1, stato text not null default 'aperto', chiuso_come text,
  aperto_da text, aperto_il text not null default ${ORA}, chiuso_da text, chiuso_il text,
  aggiornato_il text not null default ${ORA}, allineato integer not null default 0);
create table if not exists pos_riga (
  id text primary key, conto text not null, articolo text, nome text not null,
  quantita integer not null default 1, prezzo_listino_cent integer not null, prezzo_cent integer not null,
  variante text, nota text, motivo_prezzo text, locale_stampa text, portata text not null, stato text not null, creata_da text,
  creata_il text not null default ${ORA}, partita_il text, stornata_da text, stornata_il text,
  motivo_storno text, aggiornato_il text not null default ${ORA}, allineato integer not null default 0);
create table if not exists pos_comanda (
  id text primary key, conto text not null, portata text not null, tipo text not null,
  righe text not null default '[]', aggiornato_il text not null default ${ORA},
  allineato integer not null default 0);
/* i conti chiusi «in camera»: l'importo aspetta qui di essere riportato
   nel conto camera di Fidra (la reception lo fa dal back office) */
create table if not exists pos_addebito (
  id text primary key, conto text not null, locale text, camera text not null, tessera text, ospite text, firma text, firmato_il text,
  totale_cent integer not null default 0, righe text not null default '[]',
  chiuso_da text, chiuso_il text not null default ${ORA},
  stato text not null default 'da_riportare', riportato_il text, riportato_da text, nota text,
  aggiornato_il text not null default ${ORA}, allineato integer not null default 0);
create table if not exists pos_fascia (
  id text primary key, nome text not null, locale text, dalle text not null, alle text not null,
  giorni text, sconto_percento integer, categorie text, attiva integer not null default 1,
  aggiornato_il text not null default ${ORA});
create table if not exists pos_prezzo_fascia (
  id text primary key, fascia text not null, articolo text not null, prezzo_cent integer not null default 0,
  aggiornato_il text not null default ${ORA});
create table if not exists pos_pagamento (
  id text primary key, conto text not null, modo text not null, importo_cent integer not null,
  ricevuto_cent integer, cameriere text, il text not null default ${ORA},
  aggiornato_il text not null default ${ORA}, allineato integer not null default 0);
create table if not exists pos_stampa (
  id text primary key, locale text not null, stampante text not null, testo text not null,
  stato text not null default 'da_stampare', creato_il text not null default ${ORA},
  stampata_il text, stampata_da text, errore text, aggiornato_il text not null default ${ORA},
  allineato integer not null default 0);
create table if not exists pos_meta (chiave text primary key, valore text);
/* Cancellare non e' scrivere: una riga tolta qui non sale con le altre.
   Qui restano gli id tolti finche' il cloud non li ha tolti anche lui. */
create table if not exists pos_eliminato (
  id text primary key, tabella text not null, quando text not null default ${ORA});
create index if not exists pos_riga_conto on pos_riga(conto);
create index if not exists pos_stampa_stato on pos_stampa(stato);
`);
}

/* ---------- da e verso SQLite ---------- */

/** Un valore di JavaScript come SQLite lo accetta. */
export function perSqlite(x: unknown): Valore {
  if (x === undefined || x === null) return null;
  if (typeof x === 'boolean') return x ? 1 : 0;
  if (typeof x === 'number' || typeof x === 'bigint' || typeof x === 'string') return x;
  return JSON.stringify(x);
}

const colonne = new Map<string, string[]>();
export function colonneDi(db: Db, tabella: string): string[] {
  let c = colonne.get(tabella);
  if (!c) {
    c = (db.prepare(`pragma table_info(${tabella})`).all() as { name: string }[]).map((x) => x.name);
    colonne.set(tabella, c);
  }
  return c;
}

/** Scrive una riga intera (insert or replace): le colonne che la riga non
    porta prendono il valore di default, non quello vecchio. Per cambiare
    un campo solo si usa un update esplicito. */
export function salva(db: Db, tabella: string, riga: Riga): void {
  const cols = colonneDi(db, tabella).filter((c) => c in riga);
  if (!cols.length) return;
  db.prepare(`insert or replace into ${tabella} (${cols.join(', ')}) values (${cols.map(() => '?').join(', ')})`)
    .run(...cols.map((c) => perSqlite(riga[c])));
}

/** I campi JSON tornano array/oggetti. */
export const conJson = (campi: string[]) => (r: Riga): Riga => {
  const out = { ...r };
  for (const c of campi) {
    if (typeof out[c] === 'string') { try { out[c] = JSON.parse(out[c] as string); } catch { /* resta testo */ } }
  }
  return out;
};
