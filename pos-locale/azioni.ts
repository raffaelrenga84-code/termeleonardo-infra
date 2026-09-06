/* ============================================================
   azioni.ts - le azioni del palmare, servite dal PC del Bistrot.

   Stesso contratto del cloud (supabase/functions/pos/index.ts): il
   palmare manda le stesse richieste e legge le stesse risposte, non sa
   con chi parla. Le regole (portate, prezzi, biglietti, permessi) sono
   importate dalla cartella della funzione: una regola sola, due server.
   Tutto cio' che nasce qui porta allineato = 0 e sale al cloud appena
   c'e' linea (allinea.ts).
   ============================================================ */
import { conJson, type Db, type Riga, salva } from './db.ts';
import { dividi, dividiSemplice, gruppoSegue, minutiSegueValido, PORTATE, type PortataBiglietto, prossima, quandoSegue, segueScaduti, type Portata } from '../supabase/functions/pos/portate.ts';
import { prezzoRiga, totaleCent } from '../supabase/functions/pos/conto.ts';
import { testoBiglietto, type Biglietto } from '../supabase/functions/pos/comanda.ts';
import { puo, type Ruolo } from '../supabase/functions/pos/permessi.ts';
import { motivoDelPrezzo, motivoPulito, prezzoCambiato } from '../supabase/functions/pos/motivi.ts';
import { chiusoCome, importoValido, residuo, resto } from '../supabase/functions/pos/pagamenti.ts';
import { applicaFascia, fasciaAttiva, oraLocale, prezzoInFascia } from '../supabase/functions/pos/fasce.ts';
import type { Fascia, PrezzoFascia } from '../supabase/functions/pos/fasce.ts';
import { localeChePrepara, portareA, siStampa } from '../supabase/functions/pos/dove.ts';
import { stampanteAdesso } from '../supabase/functions/pos/orari.ts';
import { daMostrare, impronta, inizioGiornata, passo, prontoInCucina, statoIniziale } from '../supabase/functions/pos/schermo.ts';

export type Richiesta = { metodo: string; query: Record<string, string>; corpo: unknown; intestazioni: Record<string, string> };
export type Risposta = { stato: number; corpo: unknown };
export type Config = { locale: string };
type Cameriere = { id: string; nome: string; ruolo: Ruolo; storni: boolean; bloccato: boolean; storno_con_motivo: boolean };
type RigaStampabile = Riga & { id: string; stampante: 'cucina' | 'bar'; locale_stampa: string | null; portata: Portata; stato: string };

const ok = (corpo: unknown, stato = 200): Risposta => ({ stato, corpo });
const errore = (msg: string, stato: number): Risposta => ({ stato, corpo: { errore: msg } });
const adesso = () => new Date().toISOString();
const oraRoma = () => new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
const ePortata = (p: unknown): p is Portata => typeof p === 'string' && (PORTATE as readonly string[]).includes(p);
const testa = (req: Richiesta, nome: string) => String(req.intestazioni[nome] ?? req.intestazioni[nome.toLowerCase()] ?? '');
const segnaposto = (n: number) => Array.from({ length: n }, () => '?').join(', ');
/* una firma col dito sta in pochi kilobyte: oltre, qualcosa non torna */
const FIRMA_MAX = 300_000;

async function hashPin(codice: string, pin: string): Promise<string> {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${codice}:${pin}`));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

/* ---------- la sessione del cameriere: dispositivo + sessione validi ---------- */
function cameriereDi(db: Db, req: Richiesta): Cameriere | null {
  const disp = testa(req, 'x-pos-dispositivo'), sess = testa(req, 'x-pos-sessione');
  if (!disp || !sess) return null;
  const s = db.prepare(`select s.scade_il, c.id, c.nome, c.ruolo, c.storni, c.storno_con_motivo, c.bloccato as c_bloccato, d.token, d.bloccato as d_bloccato
    from pos_sessione s join pos_cameriere c on c.id = s.cameriere join pos_dispositivo d on d.id = s.dispositivo where s.id = ?`).get(sess) as Riga | undefined;
  if (!s || new Date(String(s.scade_il)) < new Date()) return null;
  if (s.token !== disp || Number(s.d_bloccato) || Number(s.c_bloccato)) return null;
  return { id: String(s.id), nome: String(s.nome), ruolo: String(s.ruolo) as Ruolo, storni: !!Number(s.storni), bloccato: false, storno_con_motivo: !!Number(s.storno_con_motivo) };
}

/* ---------- le righe di un conto, con la stampante gia' decisa ---------- */
const righeDelConto = (db: Db, conto: string): RigaStampabile[] =>
  db.prepare(`select r.*, coalesce(a.stampante, c.stampante, 'cucina') as stampante,
      coalesce(r.locale_stampa, a.locale_stampa, c.locale_stampa) as locale_stampa
    from pos_riga r left join pos_articolo a on a.id = r.articolo left join pos_categoria c on c.id = a.categoria
    where r.conto = ? order by r.creata_il, r.rowid`).all(conto) as unknown as RigaStampabile[];

const contoDi = (db: Db, id: string): Riga | undefined => db.prepare('select * from pos_conto where id = ?').get(id) as Riga | undefined;

/* ---------- lo schermo di una postazione (monitor cucina): stessa regola del cloud, in SQL ---------- */
async function postazioneDelloSchermo(db: Db, req: Richiesta): Promise<Riga | null> {
  const chiave = testa(req, 'x-schermo-chiave');
  if (!chiave) return null;
  /* la postazione e' quella che ha questa chiave (sulla TV basta il
     codice); con locale e stampante si pretende che combacino */
  const locale = req.query.locale || '', stampante = req.query.stampante || '';
  const h = await impronta(chiave);
  const p = (locale && stampante
    ? db.prepare('select * from pos_postazione where chiave_hash = ? and locale = ? and stampante = ?').get(h, locale, stampante)
    : db.prepare('select * from pos_postazione where chiave_hash = ? limit 1').get(h)) as Riga | undefined;
  return p ?? null;
}

/* Come si chiama un conto in sala: il nome che il cameriere gli ha
   scritto sopra, se no la camera, se no «Esterno». Stessa regola del
   cloud (supabase/functions/pos/index.ts). */
function titoloConto(c: Riga): string {
  const suo = String(c.nome ?? '').trim();
  if (suo) return suo;
  if (c.tipo === 'camera') return `Camera ${c.camera ?? ''}`.trim() + (c.ospite ? ` · ${c.ospite}` : '');
  return 'Esterno';
}

/* ---------- le stampe di una portata: un biglietto per stampante ---------- */
function creaStampe(db: Db, conto: Riga, righe: RigaStampabile[], portata: PortataBiglietto, tipo: 'comanda' | 'vai' | 'storno' | 'modifica', cameriere: string): void {
  const t = db.prepare(`select t.nome as tavolo, l.id as locale_id, l.nome as locale_nome
    from pos_tavolo t join pos_zona z on z.id = t.zona join pos_locale l on l.id = z.locale where t.id = ?`).get(String(conto.tavolo)) as Riga | undefined;
  if (!t) return;
  const ora = adesso();
  /* Un biglietto per ogni coppia (locale che prepara, stampante): di
     regola si prepara dove si mangia, ma il ristorante puo' mandare le
     bevande al Bistrot e allora il biglietto esce di la'. */
  const nomi = db.prepare('select id, nome, stampante_cucina, stampante_bar, orari_cucina from pos_locale').all() as Riga[];
  const postazioni = db.prepare('select * from pos_postazione').all() as Riga[];
  const postazioneDi = (locale: string, stampante: string) => postazioni.find((p) => p.locale === locale && p.stampante === stampante) ?? null;
  const adessoOra = oraLocale(new Date());
  const nomeDelLocale = (id: string) => (nomi.find((l) => l.id === id)?.nome as string) ?? null;
  const gruppi = new Map<string, RigaStampabile[]>();
  for (const r of righe) {
    const dove = localeChePrepara({ riga: r.locale_stampa, tavolo: String(t.locale_id) });
    /* a cucina chiusa il biglietto della cucina esce al bancone (orari.ts) */
    const stampante = stampanteAdesso(r.stampante, nomi.find((l) => l.id === dove)?.orari_cucina, adessoOra);
    const chiave = `${dove}|${stampante}|${r.stampante}`;
    gruppi.set(chiave, [...(gruppi.get(chiave) ?? []), r]);
  }
  for (const [chiave, rr] of gruppi) {
    const [dove, stampante, originale] = chiave.split('|');
    /* dove non c'e' stampante non si stampa: la cucina del ristorante non
       ne ha, e il biglietto resterebbe in coda per sempre */
    const suo = nomi.find((l) => l.id === dove) as { stampante_cucina?: string | null; stampante_bar?: string | null } | undefined;
    const postazione = postazioneDi(dove, stampante);
    if (!siStampa({ stampante: stampante as 'cucina' | 'bar', locale: suo, postazione })) continue;
    const b: Biglietto = {
      tipo: tipo.toUpperCase() as Biglietto['tipo'], locale: String(t.locale_nome), tavolo: String(t.tavolo),
      conto: conto.tipo === 'camera' ? `Camera ${conto.camera ?? ''}`.trim() : 'Esterno',
      coperti: Number(conto.coperti ?? 1), portata, ora: oraRoma(), cameriere,
      righe: rr.map((r) => ({ quantita: Number(r.quantita), nome: String(r.nome), variante: (r.variante as string | null) ?? null, nota: (r.nota as string | null) ?? null })),
      noteVitto: null,
      portareA: portareA({ preparaIn: dove, tavoloIn: String(t.locale_id), nomeDelLocale }),
      avviso: stampante !== originale ? 'cucina chiusa: al bancone' : null,
    };
    salva(db, 'pos_stampa', {
      id: crypto.randomUUID(), locale: dove, stampante, testo: testoBiglietto(b), biglietto: b, conto: String(conto.id),
      stato: statoIniziale(postazione), creato_il: ora, stampata_il: null, stampata_da: null, errore: null, aggiornato_il: ora, allineato: 0,
      vista_il: null, presa_il: null, pronta_il: null, pronta_da: null,
    });
  }
  salva(db, 'pos_comanda', { id: crypto.randomUUID(), conto: conto.id, portata, tipo, righe: righe.map((r) => r.id), aggiornato_il: ora, allineato: 0 });
}

function aggiornaRighe(db: Db, ids: string[], campi: Record<string, unknown>): void {
  if (!ids.length) return;
  const chiavi = Object.keys(campi);
  db.prepare(`update pos_riga set ${chiavi.map((k) => `${k} = ?`).join(', ')}, allineato = 0 where id in (${segnaposto(ids.length)})`)
    .run(...chiavi.map((k) => campi[k] as string | number | null), ...ids);
}

/* ================= le azioni ================= */

/* il locale di un tavolo, riga intera: portate semplici e minuti del segue */
function localeDelTavolo(db: Db, tavolo: string): Riga | null {
  return (db.prepare('select l.* from pos_locale l join pos_zona z on z.locale = l.id join pos_tavolo t on t.zona = z.id where t.id = ?').get(tavolo) as Riga | undefined) ?? null;
}

/** «Segue in 5 minuti»: allo scadere parte da se', col biglietto VAI SEGUE
    firmato «a tempo». Lo chiama main.ts ogni 10 secondi; torna quante righe. */
export function mandaSegueScaduti(db: Db, quando: Date = new Date()): number {
  const inAttesa = db.prepare("select * from pos_riga where stato = 'inviata' and segue_alle is not null").all() as (Riga & { stato: string })[];
  const perConto = new Map<string, Riga[]>();
  for (const r of segueScaduti(inAttesa, quando)) perConto.set(String(r.conto), [...(perConto.get(String(r.conto)) ?? []), r]);
  let n = 0;
  for (const [contoId, rr] of perConto) {
    const c = contoDi(db, contoId);
    if (!c || c.stato === 'chiuso') continue;
    const righe = righeDelConto(db, contoId).filter((r) => rr.some((x) => x.id === r.id));
    if (!righe.length) continue;
    const ora = adesso();
    aggiornaRighe(db, righe.map((r) => r.id), { stato: 'partita', partita_il: ora, aggiornato_il: ora });
    creaStampe(db, c, righe, 'segue', 'vai', 'a tempo');
    n += righe.length;
  }
  return n;
}

export async function esegui(db: Db, azione: string, req: Richiesta, cfg: Config): Promise<Risposta> {
  const soloPost = () => req.metodo !== 'POST' ? errore('metodo non ammesso', 405) : null;
  const b = (req.corpo && typeof req.corpo === 'object' ? req.corpo : {}) as Riga;

  /* il palmare lo chiama per sapere se il PC risponde: senza sessione */
  if (azione === 'stato-locale') return ok({ esito: 'ok', locale: cfg.locale, adesso: adesso() });

  if (azione === 'accesso') {
    const no = soloPost(); if (no) return no;
    const token = testa(req, 'x-pos-dispositivo');
    const disp = token ? db.prepare('select * from pos_dispositivo where token = ? and bloccato = 0').get(token) as Riga | undefined : undefined;
    if (!disp) return errore('dispositivo non registrato', 401);
    const codice = String(b.codice ?? '').trim(), pin = String(b.pin ?? '').trim();
    let c: Riga;
    if (codice) {
      /* la strada di prima, col codice (pagina vecchia) */
      const trovato = db.prepare('select * from pos_cameriere where codice = ? and bloccato = 0').get(codice) as Riga | undefined;
      if (!trovato) return errore('codice non riconosciuto', 401);
      const senza = !!Number(trovato.senza_pin);
      if (!pin && !senza) return errore('serve il PIN', 400);
      if (!senza && trovato.pin_hash !== await hashPin(codice, pin)) return errore('PIN sbagliato', 401);
      c = trovato;
    } else {
      /* il PIN e' la persona (la proprieta', 6 settembre 2026): stessa
         regola del cloud, si prova ogni cameriere */
      if (!/^\d{4}$/.test(pin)) return errore('serve il PIN di quattro cifre', 400);
      const tutti = db.prepare('select * from pos_cameriere where bloccato = 0').all() as Riga[];
      const trovati: Riga[] = [];
      for (const x of tutti) if (x.pin_hash && x.pin_hash === await hashPin(String(x.codice), pin)) trovati.push(x);
      if (!trovati.length) return errore('PIN non riconosciuto', 401);
      if (trovati.length > 1) return errore('PIN uguale per due persone: cambiarlo nel back office', 409);
      c = trovati[0];
    }
    const senzaPin = !!Number(c.senza_pin);
    const sessione = crypto.randomUUID();
    const scade = new Date(Date.now() + 14 * 60 * 60 * 1000).toISOString();
    /* allineato = 0: la sessione sale al cloud (allinea.ts), cosi' se il
       palmare passa al cloud non viene buttato fuori (6 settembre 2026) */
    salva(db, 'pos_sessione', { id: sessione, cameriere: c.id, dispositivo: disp.id, scade_il: scade, aggiornato_il: adesso(), allineato: 0 });
    db.prepare('update pos_dispositivo set ultimo_accesso = ? where id = ?').run(adesso(), String(disp.id));
    return ok({ sessione, scade_il: scade, cameriere: { id: c.id, nome: c.nome, ruolo: c.ruolo, storni: !!Number(c.storni), storno_con_motivo: !!Number(c.storno_con_motivo), senza_pin: senzaPin } });
  }

  const cameriere = cameriereDi(db, req);
  const azioniPalmare = ['menu', 'sala', 'conto', 'conto-cambia', 'conto-elimina', 'righe', 'invia', 'vai', 'storna', 'sposta', 'chiudi', 'articolo-cambia', 'tessera', 'tavolo-sposta', 'tavolo-svuota', 'paga'];
  if (azioniPalmare.includes(azione) && !cameriere) return errore('sessione non valida', 401);

  if (azione === 'menu') {
    const categorie = (db.prepare('select * from pos_categoria where attiva = 1 order by posizione').all() as Riga[]).map(conJson(['note_rapide']));
    /* il listino in vigore adesso, per questo locale (fasce.ts) */
    const fasce = (db.prepare('select * from pos_fascia where attiva = 1').all() as Riga[]).map(conJson(['giorni', 'categorie'])) as unknown as Fascia[];
    const prezziFascia = db.prepare('select * from pos_prezzo_fascia').all() as unknown as PrezzoFascia[];
    const fascia = fasciaAttiva({ fasce, adesso: oraLocale(new Date()), locale: cfg.locale });
    const articoli = applicaFascia({ articoli: db.prepare('select * from pos_articolo where attivo = 1 order by posizione').all() as unknown as { id: string; categoria: string | null; prezzo_cent: number }[], fascia, prezzi: prezziFascia }) as unknown as Riga[];
    const varianti = db.prepare('select * from pos_variante order by posizione').all() as Riga[];
    const preferiti = db.prepare('select * from pos_preferito order by posizione').all() as Riga[];
    const tutte = [...categorie, ...articoli, ...varianti, ...preferiti].map((r) => String(r.aggiornato_il));
    /* i locali, come dal cloud: il palmare guarda se il suo ha le portate semplici e quali minuti offrire per il segue */
    const locali = db.prepare('select id, nome, portate_semplici, segue_minuti from pos_locale order by nome').all() as Riga[];
    return ok({ categorie, articoli, varianti, preferiti, locali, fascia: fascia ? { id: fascia.id, nome: fascia.nome, alle: fascia.alle } : null, aggiornato_il: tutte.sort().pop() ?? null });
  }

  if (azione === 'sala') {
    const locale = req.query.locale || '';
    if (!locale) return errore('serve il locale', 400);
    const zone = db.prepare('select * from pos_zona where locale = ? order by posizione').all(locale) as Riga[];
    const tavoli = db.prepare('select t.* from pos_tavolo t join pos_zona z on z.id = t.zona where z.locale = ? and t.attivo = 1').all(locale) as Riga[];
    const conti = db.prepare(`select c.* from pos_conto c join pos_tavolo t on t.id = c.tavolo join pos_zona z on z.id = t.zona
      where z.locale = ? and c.stato != 'chiuso'`).all(locale) as Riga[];
    const ids = conti.map((c) => String(c.id));
    const righe = ids.length
      ? db.prepare(`select conto, quantita, prezzo_cent, stato, creata_il from pos_riga where conto in (${segnaposto(ids.length)})`).all(...ids) as Riga[]
      : [];
    /* i biglietti pronti in cucina negli ultimi venti minuti: il palmare
       segnala al cameriere che puo' andare a ritirare (prontoInCucina, schermo.ts) */
    const pronte = ids.length
      ? db.prepare(`select conto, pronta_il from pos_stampa where conto in (${segnaposto(ids.length)}) and pronta_il is not null and pronta_il >= ?`)
          .all(...ids, new Date(Date.now() - 20 * 60 * 1000).toISOString()) as Riga[]
      : [];
    const contiPronti = conti.map((c) => {
      const rr = righe.filter((r) => r.conto === c.id);
      const p = prontoInCucina(pronte.filter((s) => s.conto === c.id), new Date());
      return {
        id: c.id, tavolo: c.tavolo, tipo: c.tipo, camera: c.camera, ospite: c.ospite, coperti: c.coperti, stato: c.stato,
        nome: c.nome ?? null, titolo: titoloConto(c),
        totale_cent: totaleCent(rr.map((r) => ({ quantita: Number(r.quantita), prezzo_cent: Number(r.prezzo_cent), stato: String(r.stato) }))),
        attesa: rr.some((r) => r.stato === 'inviata'),
        da_inviare: rr.some((r) => r.stato === 'da_inviare'),
        ultima: rr.map((r) => String(r.creata_il)).sort().pop() ?? c.aperto_il,
        pronto_in_cucina: p.pronto, pronto_alle: p.alle,
      };
    });
    return ok({ zone, tavoli: tavoli.map((t) => ({ ...t, conti: contiPronti.filter((c) => c.tavolo === t.id) })) });
  }

  if (azione === 'conto') {
    if (req.metodo === 'GET') {
      const c = contoDi(db, req.query.id || '');
      if (!c) return errore('conto non trovato', 404);
      /* gli altri conti aperti dello stesso tavolo: per spostarci una riga */
      const fratelli = db.prepare("select id, tipo, camera, ospite, coperti, nome from pos_conto where tavolo = ? and stato != 'chiuso' and id != ?")
        .all(String(c.tavolo), String(c.id));
      const pagamenti = db.prepare('select id, conto, modo, importo_cent, ricevuto_cent, cameriere, il, aggiornato_il from pos_pagamento where conto = ? order by il').all(String(c.id));
      return ok({ conto: c, righe: righeDelConto(db, String(c.id)), fratelli, pagamenti });
    }
    const no = soloPost(); if (no) return no;
    const tavolo = String(b.tavolo ?? '');
    const tipo = b.tipo === 'camera' ? 'camera' : 'esterno';
    if (!tavolo) return errore('serve il tavolo', 400);
    const ora = adesso();
    const id = String(b.id ?? crypto.randomUUID());
    salva(db, 'pos_conto', {
      id, tavolo, tipo,
      camera: tipo === 'camera' ? String(b.camera ?? '') || null : null,
      ospite: tipo === 'camera' ? String(b.ospite ?? '') || null : null,
      tessera: tipo === 'camera' ? String(b.tessera ?? '') || null : null,
      nome: String(b.nome ?? '').trim().slice(0, 40) || null,
      lingua: ['it', 'en', 'de', 'fr'].includes(String(b.lingua)) ? String(b.lingua) : null,
      coperti: Math.max(1, Number(b.coperti ?? 1) || 1), stato: 'aperto', chiuso_come: null,
      aperto_da: cameriere!.id, aperto_il: ora, chiuso_da: null, chiuso_il: null, aggiornato_il: ora, allineato: 0,
    });
    return ok({ conto: contoDi(db, id) });
  }

  /* Il nome di chi paga e i coperti, cambiati a conto aperto. */
  if (azione === 'conto-cambia') {
    const no = soloPost(); if (no) return no;
    const c = contoDi(db, String(b.conto ?? ''));
    if (!c || c.stato === 'chiuso') return errore('conto non aperto', 409);
    const ora = adesso();
    const agg: Record<string, string | number | null> = { aggiornato_il: ora, allineato: 0 };
    if (b.nome !== undefined) agg.nome = String(b.nome ?? '').trim().slice(0, 40) || null;
    if (b.coperti !== undefined) agg.coperti = Math.max(1, Number(b.coperti) || 1);
    /* «In camera» anche a conto gia' aperto come esterno (vedi il cloud) */
    if (b.camera !== undefined) {
      const camera = String(b.camera ?? '').trim();
      if (!camera) return errore('serve la camera', 400);
      agg.tipo = 'camera'; agg.camera = camera;
      agg.tessera = b.tessera ? String(b.tessera) : null;
      agg.ospite = String(b.ospite ?? '').trim().slice(0, 40) || null;
      agg.lingua = ['it', 'en', 'de', 'fr'].includes(String(b.lingua)) ? String(b.lingua) : null;
    }
    const chiavi = Object.keys(agg);
    db.prepare(`update pos_conto set ${chiavi.map((k) => `${k} = ?`).join(', ')} where id = ?`).run(...chiavi.map((k) => agg[k]), String(c.id));
    return ok({ conto: contoDi(db, String(c.id)) });
  }

  /* Un conto aperto per sbaglio si toglie, ma solo finche' e' vuoto. La
     riga sparisce da qui e l'id resta in pos_eliminato finche' il cloud
     non l'ha tolto anche lui: cancellare non sale con le scritture. */
  if (azione === 'conto-elimina') {
    const no = soloPost(); if (no) return no;
    const id = String(b.conto ?? '');
    const c = contoDi(db, id);
    if (!c) return errore('conto non trovato', 404);
    if (c.stato === 'chiuso') return errore('conto gia chiuso', 409);
    const righe = righeDelConto(db, id);
    if (righe.some((r) => r.stato !== 'stornata')) return errore('il conto ha delle righe: le storni prima, oppure lo chiuda', 409);
    if (righe.length) {
      /* solo storni dentro: si chiude a zero, la traccia resta (vedi il cloud) */
      const ora = adesso();
      db.prepare("update pos_conto set stato = 'chiuso', chiuso_come = null, chiuso_da = ?, chiuso_il = ?, aggiornato_il = ?, allineato = 0 where id = ?").run(cameriere!.id, ora, ora, id);
      return ok({ esito: 'ok', chiuso: true });
    }
    db.prepare('delete from pos_conto where id = ?').run(id);
    db.prepare("insert or replace into pos_eliminato (id, tabella, quando) values (?, 'pos_conto', ?)").run(id, adesso());
    return ok({ esito: 'ok' });
  }

  /* Prezzo e disponibilita' si cambiano nel cloud, non qui: il menu' da
     noi scende e basta (allinea.ts), e una modifica scritta qui sarebbe
     cancellata al primo allineamento. Il palmare lo sa e li manda al
     cloud; se non c'e' linea, aspetta. */
  if (azione === 'articolo-cambia') return errore('prezzi e disponibilita si cambiano col cloud: serve la linea', 503);

  /* La tessera la sa leggere solo il cloud: la chiave di Fidra sta li',
     non su questo PC. Senza linea si apre il conto scrivendo la camera. */
  if (azione === 'tessera') return errore('per leggere la tessera serve la linea: scriva il numero della camera', 503);

  if (azione === 'righe') {
    const no = soloPost(); if (no) return no;
    const conto = String(b.conto ?? '');
    const richieste = Array.isArray(b.righe) ? b.righe as Riga[] : [];
    if (!conto || !richieste.length) return errore('serve il conto e almeno una riga', 400);
    const c = contoDi(db, conto);
    if (!c || c.stato === 'chiuso') return errore('conto non aperto', 409);
    const idArt = [...new Set(richieste.map((r) => String(r.articolo ?? '')).filter(Boolean))];
    const articoli = idArt.length
      ? db.prepare(`select a.*, c.portata as cat_portata from pos_articolo a left join pos_categoria c on c.id = a.categoria where a.id in (${segnaposto(idArt.length)})`).all(...idArt) as Riga[]
      : [];
    const idVar = [...new Set(richieste.map((r) => String(r.variante_id ?? '')).filter(Boolean))];
    const varianti = idVar.length ? db.prepare(`select * from pos_variante where id in (${segnaposto(idVar.length)})`).all(...idVar) as Riga[] : [];
    /* il listino in vigore adesso (fasce.ts) */
    const fasce = (db.prepare('select * from pos_fascia where attiva = 1').all() as Riga[]).map(conJson(['giorni', 'categorie'])) as unknown as Fascia[];
    const prezziFascia = db.prepare('select * from pos_prezzo_fascia').all() as unknown as PrezzoFascia[];
    const fascia = fasciaAttiva({ fasce, adesso: oraLocale(new Date()), locale: cfg.locale });
    const puoPrezzo = puo(cameriere!, 'prezzo');
    const ora = adesso();
    const nuove: Riga[] = [];
    for (const r of richieste) {
      const a = articoli.find((x) => x.id === r.articolo);
      if (!a) return errore(`articolo sconosciuto: ${r.articolo}`, 400);
      if (Number(a.esaurito)) return errore(`${a.nome}: esaurito`, 409);
      const listino = prezzoInFascia({ articolo: { id: String(a.id), categoria: a.categoria as string | null, prezzo_cent: Number(a.prezzo_cent) }, fascia, prezzi: prezziFascia }) ?? Number(a.prezzo_cent);
      const v = varianti.find((x) => x.id === r.variante_id) ?? null;
      let prezzo: number;
      try {
        prezzo = prezzoRiga({
          articolo: { prezzo_cent: listino, prezzo_libero: !!Number(a.prezzo_libero) },
          variante: v ? { supplemento_cent: Number(v.supplemento_cent) } : null,
          prezzo_manuale_cent: r.prezzo_manuale_cent === undefined || r.prezzo_manuale_cent === null ? null : Number(r.prezzo_manuale_cent),
        }, puoPrezzo);
      } catch (e) { return errore((e as Error).message, 403); }
      /* un prezzo diverso dal listino vuole il perche' */
      const cambiato = prezzoCambiato({
        prezzoListinoCent: listino, supplementoCent: v ? Number(v.supplemento_cent) : 0,
        prezzoManualeCent: r.prezzo_manuale_cent === undefined || r.prezzo_manuale_cent === null ? null : Number(r.prezzo_manuale_cent),
        prezzoLibero: !!Number(a.prezzo_libero),
      });
      const motivoPrezzo = motivoDelPrezzo({ motivo: r.motivo_prezzo, nota: r.nota });
      if (cambiato && !motivoPrezzo) return errore(`${a.nome}: scriva il motivo della variazione di prezzo`, 400);
      const portata = ePortata(r.portata) ? r.portata : (ePortata(a.portata) ? a.portata : (ePortata(a.cat_portata) ? a.cat_portata : 'secondi'));
      nuove.push({
        id: String(r.id ?? crypto.randomUUID()), conto, articolo: a.id, nome: a.nome,
        quantita: Math.max(1, Number(r.quantita ?? 1) || 1),
        prezzo_listino_cent: listino, prezzo_cent: prezzo,
        variante: v ? v.nome : (r.variante ? String(r.variante) : null),
        nota: r.nota ? String(r.nota).slice(0, 200) : null,
        motivo_prezzo: cambiato ? motivoPrezzo : null,
        /* «questa stasera la prepara il Bistrot»: la scelta del cameriere
           batte quella dell'articolo e della categoria */
        locale_stampa: r.locale_stampa ? String(r.locale_stampa) : null,
        segue_min: minutiSegueValido(r.segue_min), segue_alle: null,
        portata, stato: 'da_inviare', creata_da: cameriere!.id, creata_il: ora,
        partita_il: null, stornata_da: null, stornata_il: null, motivo_storno: null, aggiornato_il: ora, allineato: 0,
      });
    }
    for (const r of nuove) salva(db, 'pos_riga', r);
    const ids = nuove.map((r) => String(r.id));
    return ok({ righe: db.prepare(`select * from pos_riga where id in (${segnaposto(ids.length)})`).all(...ids) });
  }

  if (azione === 'invia') {
    const no = soloPost(); if (no) return no;
    const c = contoDi(db, String(b.conto ?? ''));
    if (!c || c.stato === 'chiuso') return errore('conto non aperto', 409);
    const righe = righeDelConto(db, String(c.id));
    const ora = adesso();
    /* portate semplici (vedi il cloud): tutto insieme, aspetta solo il «segue» */
    const loc = localeDelTavolo(db, String(c.tavolo));
    if (loc && Number(loc.portate_semplici)) {
      const { subito, attesa } = dividiSemplice(righe);
      if (subito.length) {
        aggiornaRighe(db, subito.map((r) => r.id), { stato: 'partita', partita_il: ora, aggiornato_il: ora });
        creaStampe(db, c, subito, 'tutto', 'comanda', cameriere!.nome);
      }
      for (const r of attesa) aggiornaRighe(db, [r.id], { stato: 'inviata', segue_alle: quandoSegue(ora, minutiSegueValido(r.segue_min)), aggiornato_il: ora });
      return ok({ partite: subito.length ? ['tutto'] : [], attesa: attesa.length ? ['segue'] : [] });
    }
    const { subito, attesa } = dividi(righe);
    for (const p of subito) {
      const rr = righe.filter((r) => r.portata === p && r.stato === 'da_inviare');
      aggiornaRighe(db, rr.map((r) => r.id), { stato: 'partita', partita_il: ora, aggiornato_il: ora });
      creaStampe(db, c, rr, p, 'comanda', cameriere!.nome);
    }
    for (const p of attesa) {
      const rr = righe.filter((r) => r.portata === p && r.stato === 'da_inviare');
      aggiornaRighe(db, rr.map((r) => r.id), { stato: 'inviata', aggiornato_il: ora });
    }
    return ok({ partite: subito, attesa });
  }

  if (azione === 'vai') {
    const no = soloPost(); if (no) return no;
    const c = contoDi(db, String(b.conto ?? ''));
    if (!c || c.stato === 'chiuso') return errore('conto non aperto', 409);
    const righe = righeDelConto(db, String(c.id));
    const locVai = localeDelTavolo(db, String(c.tavolo));
    if (locVai && Number(locVai.portate_semplici)) {
      const rr = gruppoSegue(righe);
      if (!rr.length) return errore('niente in attesa', 409);
      const ora = adesso();
      aggiornaRighe(db, rr.map((r) => r.id), { stato: 'partita', partita_il: ora, aggiornato_il: ora });
      creaStampe(db, c, rr, 'segue', 'vai', cameriere!.nome);
      const resto = righe.filter((r) => !rr.some((x) => x.id === r.id));
      return ok({ partita: 'segue', prossima: gruppoSegue(resto).length ? 'segue' : null });
    }
    const p = prossima(righe);
    if (!p) return errore('niente in attesa', 409);
    if (ePortata(b.portata) && b.portata !== p) return { stato: 409, corpo: { errore: `la prossima e ${p}`, prossima: p } };
    const rr = righe.filter((r) => r.portata === p && r.stato === 'inviata');
    const ora = adesso();
    aggiornaRighe(db, rr.map((r) => r.id), { stato: 'partita', partita_il: ora, aggiornato_il: ora });
    creaStampe(db, c, rr, p, 'vai', cameriere!.nome);
    return ok({ partita: p, prossima: prossima(righe.map((r) => r.portata === p ? { ...r, stato: 'partita' } : r)) });
  }

  if (azione === 'storna') {
    const no = soloPost(); if (no) return no;
    if (!puo(cameriere!, 'storno')) return errore('storno non permesso', 403);
    const r = db.prepare('select * from pos_riga where id = ?').get(String(b.riga ?? '')) as Riga | undefined;
    if (!r || r.stato === 'stornata') return errore('riga non trovata o gia stornata', 404);
    /* il motivo lo pretende solo chi ha la spunta «motivo storno» (vedi il cloud) */
    const motivo = motivoPulito(b.motivo);
    if (!motivo && cameriere!.storno_con_motivo) return errore('scriva il motivo dello storno', 400);
    const ora = adesso();
    aggiornaRighe(db, [String(r.id)], { stato: 'stornata', stornata_da: cameriere!.id, stornata_il: ora, motivo_storno: motivo, aggiornato_il: ora });
    if (r.stato === 'partita') {
      const c = contoDi(db, String(r.conto));
      const questa = righeDelConto(db, String(r.conto)).filter((x) => x.id === r.id);
      if (c && questa.length) creaStampe(db, c, questa, r.portata as Portata, 'storno', cameriere!.nome);
    }
    return ok({ riga: db.prepare('select * from pos_riga where id = ?').get(String(r.id)) });
  }

  /* una riga passa a un altro conto dello stesso tavolo: cambia chi paga,
     non cambia niente in cucina */
  if (azione === 'sposta') {
    const no = soloPost(); if (no) return no;
    const r = db.prepare('select * from pos_riga where id = ?').get(String(b.riga ?? '')) as Riga | undefined;
    if (!r || r.stato === 'stornata') return errore('riga non trovata o stornata', 404);
    const da = contoDi(db, String(r.conto));
    if (!da || da.stato === 'chiuso') return errore('conto non aperto', 409);
    let versoId = String(b.conto ?? '');
    const ora = adesso();
    if (b.nuovo) {
      versoId = crypto.randomUUID();
      salva(db, 'pos_conto', {
        id: versoId, tavolo: da.tavolo, tipo: 'esterno', camera: null, ospite: null, tessera: null,
        coperti: Math.max(1, Number(b.coperti ?? 1) || 1), stato: 'aperto', chiuso_come: null,
        aperto_da: cameriere!.id, aperto_il: ora, chiuso_da: null, chiuso_il: null, aggiornato_il: ora, allineato: 0,
      });
    }
    const verso = contoDi(db, versoId);
    if (!verso || verso.stato === 'chiuso') return errore('l altro conto non e aperto', 409);
    if (verso.tavolo !== da.tavolo) return errore('i due conti non sono dello stesso tavolo', 409);
    db.prepare('update pos_riga set conto = ?, aggiornato_il = ?, allineato = 0 where id = ?').run(versoId, ora, String(r.id));
    return ok({ esito: 'ok', riga: r.id, conto: versoId });
  }

  /* tutto il tavolo su un altro, nello stesso locale: i conti aperti
     cambiano tavolo insieme (vedi il cloud) */
  /* tutto il tavolo via in un colpo (vedi il cloud): storno di tutte le
     righe vive, STORNO in coda per quelle partite, conti chiusi a zero */
  if (azione === 'tavolo-svuota') {
    const no = soloPost(); if (no) return no;
    if (!puo(cameriere!, 'storno')) return errore('storno non permesso', 403);
    const tavolo = String(b.tavolo ?? '');
    const scritto = motivoPulito(b.motivo);
    if (!scritto && cameriere!.storno_con_motivo) return errore('scriva il motivo', 400);
    const motivo = scritto ? `tavolo cancellato: ${scritto}` : 'tavolo cancellato';
    const conti = db.prepare("select * from pos_conto where tavolo = ? and stato <> 'chiuso'").all(tavolo) as Riga[];
    if (!conti.length) return errore('questo tavolo non ha conti aperti', 409);
    const ora = adesso();
    let stornate = 0;
    for (const c of conti) {
      const righe = righeDelConto(db, String(c.id));
      const vive = righe.filter((r) => r.stato !== 'stornata');
      if (vive.length) {
        aggiornaRighe(db, vive.map((r) => String(r.id)), { stato: 'stornata', stornata_da: cameriere!.id, stornata_il: ora, motivo_storno: motivo, aggiornato_il: ora });
        stornate += vive.length;
        const partite = vive.filter((r) => r.stato === 'partita');
        for (const p of new Set(partite.map((r) => r.portata))) creaStampe(db, c, partite.filter((r) => r.portata === p), p, 'storno', cameriere!.nome);
      }
      if (righe.length) db.prepare("update pos_conto set stato = 'chiuso', chiuso_come = null, chiuso_da = ?, chiuso_il = ?, aggiornato_il = ?, allineato = 0 where id = ?").run(cameriere!.id, ora, ora, String(c.id));
      else {
        db.prepare('delete from pos_conto where id = ?').run(String(c.id));
        db.prepare("insert or replace into pos_eliminato (id, tabella, quando) values (?, 'pos_conto', ?)").run(String(c.id), ora);
      }
    }
    return ok({ esito: 'ok', conti: conti.length, righe: stornate });
  }

  if (azione === 'tavolo-sposta') {
    const no = soloPost(); if (no) return no;
    const daId = String(b.da ?? ''), aId = String(b.a ?? '');
    if (!daId || !aId) return errore('servono il tavolo di partenza e quello di arrivo', 400);
    if (daId === aId) return errore('e lo stesso tavolo', 400);
    const localeDi = (id: string) => (db.prepare('select z.locale as locale from pos_tavolo t join pos_zona z on z.id = t.zona where t.id = ?').get(id) as Riga | undefined)?.locale ?? null;
    const lDa = localeDi(daId), lA = localeDi(aId);
    if (!lDa || !lA) return errore('tavolo non trovato', 404);
    if (lDa !== lA) return errore('l altro tavolo e di un altro locale: le stampanti non sono le stesse', 409);
    const n = Number((db.prepare("select count(*) as n from pos_conto where tavolo = ? and stato <> 'chiuso'").get(daId) as { n: number }).n);
    if (!n) return errore('questo tavolo non ha conti aperti', 409);
    const ora = adesso();
    db.prepare("update pos_conto set tavolo = ?, aggiornato_il = ?, allineato = 0 where tavolo = ? and stato <> 'chiuso'").run(aId, ora, daId);
    return ok({ esito: 'ok', conti: n, tavolo: aId });
  }

  /* un pagamento, anche parziale: il conto si chiude da solo quando i
     pagamenti coprono il totale (vedi il cloud e pagamenti.ts) */
  if (azione === 'paga') {
    const no = soloPost(); if (no) return no;
    const modo = ['contanti', 'carta'].includes(String(b.modo)) ? String(b.modo) : null;
    if (!modo) return errore('modo: contanti o carta', 400);
    const c = contoDi(db, String(b.conto ?? ''));
    if (!c || c.stato === 'chiuso') return errore('conto non aperto', 409);
    const righe = righeDelConto(db, String(c.id));
    if (righe.some((r) => r.stato === 'da_inviare')) return errore('ci sono righe non inviate', 409);
    const totale = totaleCent(righe.map((r) => ({ quantita: Number(r.quantita), prezzo_cent: Number(r.prezzo_cent), stato: r.stato })));
    const prima = db.prepare('select modo, importo_cent from pos_pagamento where conto = ? order by il').all(String(c.id)) as { modo: string; importo_cent: number }[];
    const daPagare = residuo(totale, prima);
    if (!daPagare) return errore('il conto e gia pagato', 409);
    const importo = b.importo_cent === undefined || b.importo_cent === null ? daPagare : Math.round(Number(b.importo_cent));
    if (!importoValido(importo, daPagare)) return errore(`l importo deve essere fra 1 centesimo e ${daPagare} centesimi`, 409);
    const ricevuto = modo === 'contanti' && b.ricevuto_cent !== undefined && b.ricevuto_cent !== null ? Math.round(Number(b.ricevuto_cent)) : null;
    const ora = adesso();
    const pagamento = { id: crypto.randomUUID(), conto: String(c.id), modo, importo_cent: importo, ricevuto_cent: Number.isFinite(ricevuto as number) ? ricevuto : null, cameriere: cameriere!.id, il: ora, aggiornato_il: ora };
    salva(db, 'pos_pagamento', { ...pagamento, allineato: 0 });
    const dopo = daPagare - importo;
    if (!dopo) {
      db.prepare("update pos_conto set stato = 'chiuso', chiuso_come = ?, chiuso_da = ?, chiuso_il = ?, aggiornato_il = ?, allineato = 0 where id = ?")
        .run(chiusoCome([...prima, pagamento]), cameriere!.id, ora, ora, String(c.id));
    }
    return ok({ pagamento, residuo_cent: dopo, chiuso: !dopo, resto_cent: resto(ricevuto, importo), conto: contoDi(db, String(c.id)) });
  }

  if (azione === 'chiudi') {
    const no = soloPost(); if (no) return no;
    const modo = ['contanti', 'carta', 'camera'].includes(String(b.modo)) ? String(b.modo) : null;
    if (!modo) return errore('modo: contanti, carta o camera', 400);
    const c = contoDi(db, String(b.conto ?? ''));
    if (!c || c.stato === 'chiuso') return errore('conto non aperto', 409);
    const righe = righeDelConto(db, String(c.id));
    if (righe.some((r) => r.stato === 'da_inviare')) return errore('ci sono righe non inviate', 409);
    if (modo === 'camera' && !String(c.camera ?? '').trim()) return errore('per addebitare serve la camera: apra un conto in camera', 409);
    const ora = adesso();
    const totale = totaleCent(righe.map((r) => ({ quantita: Number(r.quantita), prezzo_cent: Number(r.prezzo_cent), stato: r.stato })));
    /* con pagamenti parziali gia' registrati (paga) il modo e' misto; e
       contanti o carta lasciano comunque un pagamento, per la giornata */
    const prima = db.prepare('select modo, importo_cent from pos_pagamento where conto = ? order by il').all(String(c.id)) as { modo: string; importo_cent: number }[];
    const come = modo === 'camera' ? 'camera' : chiusoCome([...prima, { modo }]);
    db.prepare("update pos_conto set stato = 'chiuso', chiuso_come = ?, chiuso_da = ?, chiuso_il = ?, aggiornato_il = ?, allineato = 0 where id = ?")
      .run(come, cameriere!.id, ora, ora, String(c.id));
    if (modo !== 'camera') {
      const manca = residuo(totale, prima);
      if (manca > 0) salva(db, 'pos_pagamento', { id: crypto.randomUUID(), conto: String(c.id), modo, importo_cent: manca, ricevuto_cent: null, cameriere: cameriere!.id, il: ora, aggiornato_il: ora, allineato: 0 });
    }
    /* «In camera» non e' un incasso: e' un addebito che la reception deve
       ancora riportare nel conto camera di Fidra. Sale al cloud con gli
       altri e da li' lo vede il back office. */
    if (modo === 'camera') {
      const t = db.prepare('select z.locale as locale from pos_tavolo t join pos_zona z on z.id = t.zona where t.id = ?').get(String(c.tavolo)) as Riga | undefined;
      /* la firma dell'ospite sul palmare, se l'ha data: prova dell'ordine */
      const firma = typeof b.firma === 'string' ? b.firma : '';
      if (firma && (!firma.startsWith('data:image/png;base64,') || firma.length > FIRMA_MAX)) {
        return errore('la firma deve essere un PNG, e piccolo', 400);
      }
      salva(db, 'pos_addebito', {
        firma: firma || null, firmato_il: firma ? ora : null,
        id: crypto.randomUUID(), conto: c.id, locale: t?.locale ?? null, camera: String(c.camera).trim(),
        tessera: c.tessera ?? null, ospite: c.ospite ?? null, totale_cent: totale,
        righe: righe.filter((r) => r.stato !== 'stornata').map((r) => ({
          quantita: Number(r.quantita), nome: String(r.nome), totale_cent: Number(r.quantita) * Number(r.prezzo_cent),
        })),
        chiuso_da: cameriere!.id, chiuso_il: ora, stato: 'da_riportare',
        riportato_il: null, riportato_da: null, nota: null, aggiornato_il: ora, allineato: 0,
      });
    }
    return ok({ conto: contoDi(db, String(c.id)), totale_cent: totale });
  }

  /* ================= il monitor cucina (chiave dello schermo) ================= */

  if (azione === 'schermo') {
    const p = await postazioneDelloSchermo(db, req);
    if (!p) return errore('schermo non riconosciuto', 401);
    if (req.metodo !== 'GET') return errore('metodo non ammesso', 405);
    const ora = new Date();
    const inizio = inizioGiornata(ora, oraLocale(ora).minuti);
    const stampe = db.prepare(`select id, stato, creato_il, vista_il, presa_il, pronta_il, biglietto, testo, stampante, conto
      from pos_stampa where locale = ? and stampante = ? and pronta_il is null and creato_il >= ? order by creato_il limit 200`)
      .all(String(p.locale), String(p.stampante), inizio.toISOString()) as Riga[];
    const biglietti = stampe.filter((s) => daMostrare(s as { pronta_il?: unknown; creato_il: unknown }, inizio));
    /* da qui in poi il ripiego non scatta: uno schermo l'ha mostrato */
    const nonViste = biglietti.filter((s) => !s.vista_il).map((s) => String(s.id));
    const adessoIso = ora.toISOString();
    if (nonViste.length) {
      db.prepare(`update pos_stampa set vista_il = ?, aggiornato_il = ?, allineato = 0 where id in (${segnaposto(nonViste.length)}) and vista_il is null`)
        .run(adessoIso, adessoIso, ...nonViste);
    }
    return ok({ postazione: { nome: p.nome, locale: p.locale, stampante: p.stampante }, biglietti: biglietti.map(conJson(['biglietto'])).map((s) => ({ ...s, vista_il: s.vista_il ?? adessoIso })), adesso: adessoIso });
  }

  if (azione === 'schermo-stato') {
    const no = soloPost(); if (no) return no;
    const p = await postazioneDelloSchermo(db, req);
    if (!p) return errore('schermo non riconosciuto', 401);
    const s = db.prepare('select id, locale, stampante, presa_il, pronta_il from pos_stampa where id = ?').get(String(b.id ?? '')) as Riga | undefined;
    if (!s) return errore('biglietto non trovato', 404);
    if (s.locale !== p.locale || s.stampante !== p.stampante) return errore("di un'altra postazione", 403);
    const esito = passo(s, String(b.passo ?? ''), new Date(), String(p.nome));
    if ('errore' in esito) return errore(esito.errore, esito.stato);
    const ora = adesso();
    const chiavi = Object.keys(esito.campi);
    db.prepare(`update pos_stampa set ${chiavi.map((k) => `${k} = ?`).join(', ')}, aggiornato_il = ?, allineato = 0 where id = ?`)
      .run(...chiavi.map((k) => esito.campi[k]), ora, String(s.id));
    return ok({ esito: 'ok', ...esito.campi });
  }

  return errore('azione sconosciuta', 404);
}
