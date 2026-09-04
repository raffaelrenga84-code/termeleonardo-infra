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
import { dividi, PORTATE, prossima, type Portata } from '../supabase/functions/pos/portate.ts';
import { prezzoRiga, totaleCent } from '../supabase/functions/pos/conto.ts';
import { testoBiglietto, type Biglietto } from '../supabase/functions/pos/comanda.ts';
import { puo, type Ruolo } from '../supabase/functions/pos/permessi.ts';

export type Richiesta = { metodo: string; query: Record<string, string>; corpo: unknown; intestazioni: Record<string, string> };
export type Risposta = { stato: number; corpo: unknown };
export type Config = { locale: string };
type Cameriere = { id: string; nome: string; ruolo: Ruolo; storni: boolean; bloccato: boolean };
type RigaStampabile = Riga & { id: string; stampante: 'cucina' | 'bar'; portata: Portata; stato: string };

const ok = (corpo: unknown, stato = 200): Risposta => ({ stato, corpo });
const errore = (msg: string, stato: number): Risposta => ({ stato, corpo: { errore: msg } });
const adesso = () => new Date().toISOString();
const oraRoma = () => new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
const ePortata = (p: unknown): p is Portata => typeof p === 'string' && (PORTATE as readonly string[]).includes(p);
const testa = (req: Richiesta, nome: string) => String(req.intestazioni[nome] ?? req.intestazioni[nome.toLowerCase()] ?? '');
const segnaposto = (n: number) => Array.from({ length: n }, () => '?').join(', ');

async function hashPin(codice: string, pin: string): Promise<string> {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${codice}:${pin}`));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

/* ---------- la sessione del cameriere: dispositivo + sessione validi ---------- */
function cameriereDi(db: Db, req: Richiesta): Cameriere | null {
  const disp = testa(req, 'x-pos-dispositivo'), sess = testa(req, 'x-pos-sessione');
  if (!disp || !sess) return null;
  const s = db.prepare(`select s.scade_il, c.id, c.nome, c.ruolo, c.storni, c.bloccato as c_bloccato, d.token, d.bloccato as d_bloccato
    from pos_sessione s join pos_cameriere c on c.id = s.cameriere join pos_dispositivo d on d.id = s.dispositivo where s.id = ?`).get(sess) as Riga | undefined;
  if (!s || new Date(String(s.scade_il)) < new Date()) return null;
  if (s.token !== disp || Number(s.d_bloccato) || Number(s.c_bloccato)) return null;
  return { id: String(s.id), nome: String(s.nome), ruolo: String(s.ruolo) as Ruolo, storni: !!Number(s.storni), bloccato: false };
}

/* ---------- le righe di un conto, con la stampante gia' decisa ---------- */
const righeDelConto = (db: Db, conto: string): RigaStampabile[] =>
  db.prepare(`select r.*, coalesce(a.stampante, c.stampante, 'cucina') as stampante
    from pos_riga r left join pos_articolo a on a.id = r.articolo left join pos_categoria c on c.id = a.categoria
    where r.conto = ? order by r.creata_il, r.rowid`).all(conto) as unknown as RigaStampabile[];

const contoDi = (db: Db, id: string): Riga | undefined => db.prepare('select * from pos_conto where id = ?').get(id) as Riga | undefined;

/* ---------- le stampe di una portata: un biglietto per stampante ---------- */
function creaStampe(db: Db, conto: Riga, righe: RigaStampabile[], portata: Portata, tipo: 'comanda' | 'vai' | 'storno' | 'modifica', cameriere: string): void {
  const t = db.prepare(`select t.nome as tavolo, l.id as locale_id, l.nome as locale_nome
    from pos_tavolo t join pos_zona z on z.id = t.zona join pos_locale l on l.id = z.locale where t.id = ?`).get(String(conto.tavolo)) as Riga | undefined;
  if (!t) return;
  const ora = adesso();
  const perStampante = new Map<'cucina' | 'bar', RigaStampabile[]>();
  for (const r of righe) perStampante.set(r.stampante, [...(perStampante.get(r.stampante) ?? []), r]);
  for (const [stampante, rr] of perStampante) {
    const b: Biglietto = {
      tipo: tipo.toUpperCase() as Biglietto['tipo'], locale: String(t.locale_nome), tavolo: String(t.tavolo),
      conto: conto.tipo === 'camera' ? `Camera ${conto.camera ?? ''}`.trim() : 'Esterno',
      coperti: Number(conto.coperti ?? 1), portata, ora: oraRoma(), cameriere,
      righe: rr.map((r) => ({ quantita: Number(r.quantita), nome: String(r.nome), variante: (r.variante as string | null) ?? null, nota: (r.nota as string | null) ?? null })),
      noteVitto: null,
    };
    salva(db, 'pos_stampa', { id: crypto.randomUUID(), locale: t.locale_id, stampante, testo: testoBiglietto(b), stato: 'da_stampare', creato_il: ora, stampata_il: null, stampata_da: null, errore: null, aggiornato_il: ora, allineato: 0 });
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
    if (!codice || !pin) return errore('codice e PIN', 400);
    const c = db.prepare('select * from pos_cameriere where codice = ? and bloccato = 0').get(codice) as Riga | undefined;
    if (!c || c.pin_hash !== await hashPin(codice, pin)) return errore('codice o PIN sbagliati', 401);
    const sessione = crypto.randomUUID();
    const scade = new Date(Date.now() + 14 * 60 * 60 * 1000).toISOString();
    salva(db, 'pos_sessione', { id: sessione, cameriere: c.id, dispositivo: disp.id, scade_il: scade, aggiornato_il: adesso() });
    db.prepare('update pos_dispositivo set ultimo_accesso = ? where id = ?').run(adesso(), String(disp.id));
    return ok({ sessione, scade_il: scade, cameriere: { id: c.id, nome: c.nome, ruolo: c.ruolo, storni: !!Number(c.storni) } });
  }

  const cameriere = cameriereDi(db, req);
  const azioniPalmare = ['menu', 'sala', 'conto', 'righe', 'invia', 'vai', 'storna', 'chiudi'];
  if (azioniPalmare.includes(azione) && !cameriere) return errore('sessione non valida', 401);

  if (azione === 'menu') {
    const categorie = (db.prepare('select * from pos_categoria where attiva = 1 order by posizione').all() as Riga[]).map(conJson(['note_rapide']));
    const articoli = db.prepare('select * from pos_articolo where attivo = 1 order by posizione').all() as Riga[];
    const varianti = db.prepare('select * from pos_variante order by posizione').all() as Riga[];
    const preferiti = db.prepare('select * from pos_preferito order by posizione').all() as Riga[];
    const tutte = [...categorie, ...articoli, ...varianti, ...preferiti].map((r) => String(r.aggiornato_il));
    return ok({ categorie, articoli, varianti, preferiti, aggiornato_il: tutte.sort().pop() ?? null });
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
    const contiPronti = conti.map((c) => {
      const rr = righe.filter((r) => r.conto === c.id);
      return {
        id: c.id, tavolo: c.tavolo, tipo: c.tipo, camera: c.camera, ospite: c.ospite, coperti: c.coperti, stato: c.stato,
        nome: c.tipo === 'camera' ? `Camera ${c.camera ?? ''}`.trim() + (c.ospite ? ` · ${c.ospite}` : '') : 'Esterno',
        totale_cent: totaleCent(rr.map((r) => ({ quantita: Number(r.quantita), prezzo_cent: Number(r.prezzo_cent), stato: String(r.stato) }))),
        attesa: rr.some((r) => r.stato === 'inviata'),
        da_inviare: rr.some((r) => r.stato === 'da_inviare'),
        ultima: rr.map((r) => String(r.creata_il)).sort().pop() ?? c.aperto_il,
      };
    });
    return ok({ zone, tavoli: tavoli.map((t) => ({ ...t, conti: contiPronti.filter((c) => c.tavolo === t.id) })) });
  }

  if (azione === 'conto') {
    if (req.metodo === 'GET') {
      const c = contoDi(db, req.query.id || '');
      if (!c) return errore('conto non trovato', 404);
      return ok({ conto: c, righe: righeDelConto(db, String(c.id)) });
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
      coperti: Math.max(1, Number(b.coperti ?? 1) || 1), stato: 'aperto', chiuso_come: null,
      aperto_da: cameriere!.id, aperto_il: ora, chiuso_da: null, chiuso_il: null, aggiornato_il: ora, allineato: 0,
    });
    return ok({ conto: contoDi(db, id) });
  }

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
    const puoPrezzo = puo(cameriere!, 'prezzo');
    const ora = adesso();
    const nuove: Riga[] = [];
    for (const r of richieste) {
      const a = articoli.find((x) => x.id === r.articolo);
      if (!a) return errore(`articolo sconosciuto: ${r.articolo}`, 400);
      if (Number(a.esaurito)) return errore(`${a.nome}: esaurito`, 409);
      const v = varianti.find((x) => x.id === r.variante_id) ?? null;
      let prezzo: number;
      try {
        prezzo = prezzoRiga({
          articolo: { prezzo_cent: Number(a.prezzo_cent), prezzo_libero: !!Number(a.prezzo_libero) },
          variante: v ? { supplemento_cent: Number(v.supplemento_cent) } : null,
          prezzo_manuale_cent: r.prezzo_manuale_cent === undefined || r.prezzo_manuale_cent === null ? null : Number(r.prezzo_manuale_cent),
        }, puoPrezzo);
      } catch (e) { return errore((e as Error).message, 403); }
      const portata = ePortata(r.portata) ? r.portata : (ePortata(a.portata) ? a.portata : (ePortata(a.cat_portata) ? a.cat_portata : 'secondi'));
      nuove.push({
        id: String(r.id ?? crypto.randomUUID()), conto, articolo: a.id, nome: a.nome,
        quantita: Math.max(1, Number(r.quantita ?? 1) || 1),
        prezzo_listino_cent: Number(a.prezzo_cent), prezzo_cent: prezzo,
        variante: v ? v.nome : (r.variante ? String(r.variante) : null),
        nota: r.nota ? String(r.nota).slice(0, 200) : null,
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
    const { subito, attesa } = dividi(righe);
    const ora = adesso();
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
    const ora = adesso();
    aggiornaRighe(db, [String(r.id)], { stato: 'stornata', stornata_da: cameriere!.id, stornata_il: ora, motivo_storno: String(b.motivo ?? '').slice(0, 200) || null, aggiornato_il: ora });
    if (r.stato === 'partita') {
      const c = contoDi(db, String(r.conto));
      const questa = righeDelConto(db, String(r.conto)).filter((x) => x.id === r.id);
      if (c && questa.length) creaStampe(db, c, questa, r.portata as Portata, 'storno', cameriere!.nome);
    }
    return ok({ riga: db.prepare('select * from pos_riga where id = ?').get(String(r.id)) });
  }

  if (azione === 'chiudi') {
    const no = soloPost(); if (no) return no;
    const modo = ['contanti', 'carta', 'camera'].includes(String(b.modo)) ? String(b.modo) : null;
    if (!modo) return errore('modo: contanti, carta o camera', 400);
    const c = contoDi(db, String(b.conto ?? ''));
    if (!c || c.stato === 'chiuso') return errore('conto non aperto', 409);
    const righe = righeDelConto(db, String(c.id));
    if (righe.some((r) => r.stato === 'da_inviare')) return errore('ci sono righe non inviate', 409);
    const ora = adesso();
    db.prepare("update pos_conto set stato = 'chiuso', chiuso_come = ?, chiuso_da = ?, chiuso_il = ?, aggiornato_il = ?, allineato = 0 where id = ?")
      .run(modo, cameriere!.id, ora, ora, String(c.id));
    return ok({ conto: contoDi(db, String(c.id)), totale_cent: totaleCent(righe.map((r) => ({ quantita: Number(r.quantita), prezzo_cent: Number(r.prezzo_cent), stato: r.stato }))) });
  }

  return errore('azione sconosciuta', 404);
}
