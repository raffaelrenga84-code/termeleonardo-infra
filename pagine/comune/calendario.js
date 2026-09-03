/* calendario.js — il calendario a due tocchi delle pagine rivolte agli ospiti.

   PERCHE'. Su /prenota le date erano due campi nativi del telefono, arrivo
   e partenza separati: due pannelli diversi, il secondo che si apre su oggi,
   nessun conto delle notti, nessun segno dei giorni chiusi. «Poco intuitivo»
   (la proprieta', 3 settembre 2026). Qui: un calendario solo, primo tocco
   arrivo, secondo partenza, notti contate in cima, giorni chiusi in grigio.
   Sul telefono e' un foglio a tutto schermo, su computer un riquadro sotto
   il campo: stessa funzione, il vestito lo decide il CSS.

   Le regole sono funzioni pure, provate da calendario.test.ts con «oggi»
   passato dall'esterno. Il disegno (apriCalendario) sta in coda.

   NON IMPORTA NIENTE, di proposito: in una prova Deno «/comune/date.js» non
   si risolve, e un modulo che dev'essere provato da solo non puo'
   dipenderne. `notti` e' la stessa regola di nottiFra in date.js.

   Va importato con il PERCORSO ASSOLUTO `/comune/calendario.js`: un percorso
   relativo, sotto un indirizzo tradotto come /it/prenota, cerca
   /it/comune/... e la pagina resta bianca. */
'use strict';

export const TESTI = {
  it: {
    campo: 'Arrivo e partenza', scegli: 'Scelga le date', scegliGiorno: 'Scelga il giorno',
    scegliArrivo: 'Scelga il giorno di arrivo', scegliPartenza: 'Ora il giorno di partenza',
    notti: (n) => n === 1 ? '1 notte' : `${n} notti`,
    conferma: 'Conferma', cancella: 'Cancella', chiusi: 'chiusi', chiudi: 'Chiudi',
    esaurito: 'esaurito', nonInVendita: 'non ancora in vendita', ultimi: 'ultimi posti',
    giorni: ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom'],
    mesiBrevi: ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'],
    mesiLunghi: ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'],
  },
  de: {
    campo: 'An- und Abreise', scegli: 'Daten wählen', scegliGiorno: 'Tag wählen',
    scegliArrivo: 'Wählen Sie den Anreisetag', scegliPartenza: 'Jetzt den Abreisetag',
    notti: (n) => n === 1 ? '1 Nacht' : `${n} Nächte`,
    conferma: 'Bestätigen', cancella: 'Löschen', chiusi: 'geschlossen', chiudi: 'Schließen',
    esaurito: 'ausverkauft', nonInVendita: 'noch nicht im Verkauf', ultimi: 'letzte Plätze',
    giorni: ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'],
    mesiBrevi: ['Jan', 'Feb', 'März', 'Apr', 'Mai', 'Juni', 'Juli', 'Aug', 'Sept', 'Okt', 'Nov', 'Dez'],
    mesiLunghi: ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'],
  },
  en: {
    campo: 'Arrival and departure', scegli: 'Choose your dates', scegliGiorno: 'Choose the day',
    scegliArrivo: 'Choose your arrival day', scegliPartenza: 'Now the departure day',
    notti: (n) => n === 1 ? '1 night' : `${n} nights`,
    conferma: 'Confirm', cancella: 'Clear', chiusi: 'closed', chiudi: 'Close',
    esaurito: 'sold out', nonInVendita: 'not yet on sale', ultimi: 'last places',
    giorni: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    mesiBrevi: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    mesiLunghi: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  },
  fr: {
    campo: 'Arrivée et départ', scegli: 'Choisissez vos dates', scegliGiorno: 'Choisissez le jour',
    scegliArrivo: 'Choisissez le jour d’arrivée', scegliPartenza: 'Puis le jour de départ',
    notti: (n) => n === 1 ? '1 nuit' : `${n} nuits`,
    conferma: 'Confirmer', cancella: 'Effacer', chiusi: 'fermé', chiudi: 'Fermer',
    esaurito: 'complet', nonInVendita: 'pas encore en vente', ultimi: 'dernières places',
    giorni: ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'],
    mesiBrevi: ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'],
    mesiLunghi: ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'],
  },
};

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const pezzi = (iso) => { const m = ISO.exec(String(iso ?? '')); return m ? { a: +m[1], m: +m[2], g: +m[3] } : null; };
/* mezzogiorno UTC: l'aritmetica dei giorni non inciampa nell'ora legale */
const data = (iso) => { const p = pezzi(iso); return p ? new Date(Date.UTC(p.a, p.m - 1, p.g, 12)) : null; };
const isoDi = (d) =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;

/** Le notti fra due date ISO; 0 se una manca. Stessa regola di nottiFra in /comune/date.js. */
export function notti(arrivo, partenza) {
  const a = data(arrivo), p = data(partenza);
  return a && p ? Math.round((p - a) / 86400000) : 0;
}

/** I mesi da quello di oggi in avanti; ogni giorno con la sua colonna (0 = lunedì). */
export function griglia(oggiISO, quantiMesi = 14) {
  const o = pezzi(oggiISO);
  if (!o) return [];
  const mesi = [];
  for (let k = 0; k < quantiMesi; k++) {
    const primo = new Date(Date.UTC(o.a, o.m - 1 + k, 1, 12));
    const anno = primo.getUTCFullYear(), mese = primo.getUTCMonth() + 1;
    const quanti = new Date(Date.UTC(anno, mese, 0, 12)).getUTCDate();
    const giorni = [];
    for (let g = 1; g <= quanti; g++) {
      const d = new Date(Date.UTC(anno, mese - 1, g, 12));
      giorni.push({ iso: isoDi(d), giorno: g, colonna: (d.getUTCDay() + 6) % 7 });
    }
    mesi.push({ anno, mese, giorni });
  }
  return mesi;
}

const chiuso = (iso, chiusure) => (chiusure || []).some((c) => iso >= c.chiusura && iso < c.riapertura);
/* almeno una notte chiusa fra arrivo e partenza: stessa regola di chiusuraCheCopre nel server */
const attraversa = (arrivo, partenza, chiusure) =>
  (chiusure || []).some((c) => arrivo < c.riapertura && partenza > c.chiusura);

/** Lo stato di un giorno: passato, oltre (dopo il limite del soggiorno),
 *  chiuso, arrivo, partenza, dentro, libero. */
export function statoGiorno(iso, { oggi, arrivo = '', partenza = '', chiusure = [], fine = '', statoExtra = null }) {
  if (iso < oggi) return 'passato';
  if (fine && iso > fine) return 'oltre';
  if (chiuso(iso, chiusure)) return 'chiuso';
  if (arrivo && iso === arrivo) return 'arrivo';
  if (partenza && iso === partenza) return 'partenza';
  if (arrivo && partenza && iso > arrivo && iso < partenza) return 'dentro';
  /* gli stati che sa solo il server (Day Spa, 3 settembre 2026): esaurito e
     non ancora in vendita si disegnano grigi e non si toccano; «ultimi» e'
     un giorno libero con un segno. Chi non passa statoExtra non vede
     niente di diverso. */
  const extra = statoExtra ? statoExtra(iso) : null;
  if (extra === 'esaurito' || extra === 'non-in-vendita' || extra === 'ultimi') return extra;
  return 'libero';
}

/* vero se statoExtra dice che il giorno non si puo' scegliere */
const bloccatoDaExtra = (iso, statoExtra) => {
  const e = statoExtra ? statoExtra(iso) : null;
  return e === 'esaurito' || e === 'non-in-vendita';
};

/** La macchina dei due tocchi. Un giorno passato o chiuso non si tocca; un
 *  tocco prima dell'arrivo, o con tutte e due le date gia' scelte, ricomincia;
 *  un intervallo che passa sopra una chiusura non si accetta. */
export function tocca(scelta, iso, { oggi, chiusure, fine = '', statoExtra = null }) {
  const s = { arrivo: (scelta && scelta.arrivo) || '', partenza: (scelta && scelta.partenza) || '' };
  if (iso < oggi || (fine && iso > fine) || chiuso(iso, chiusure) || bloccatoDaExtra(iso, statoExtra)) return s;
  if (!s.arrivo || s.partenza) return { arrivo: iso, partenza: '' };
  if (iso <= s.arrivo) return { arrivo: iso, partenza: '' };
  if (attraversa(s.arrivo, iso, chiusure)) return { arrivo: iso, partenza: '' };
  return { arrivo: s.arrivo, partenza: iso };
}

const testi = (l) => TESTI[l] || TESTI.it;

/** «sab 13 feb», «Sa 13. Feb», «Sat 13 Feb», «sam 13 févr». */
export function giornoBreve(iso, lingua) {
  const d = data(iso);
  if (!d) return '';
  const t = testi(lingua), l = TESTI[lingua] ? lingua : 'it';
  return `${t.giorni[(d.getUTCDay() + 6) % 7]} ${d.getUTCDate()}${l === 'de' ? '.' : ''} ${t.mesiBrevi[d.getUTCMonth()]}`;
}

/** «sab 13 feb → mer 17 feb · 4 notti»; «sab 13 feb → …» con la sola partenza da scegliere; '' senza niente. */
export function riassunto(scelta, lingua) {
  const t = testi(lingua);
  if (!scelta || !scelta.arrivo) return '';
  if (!scelta.partenza) return `${giornoBreve(scelta.arrivo, lingua)} → …`;
  return `${giornoBreve(scelta.arrivo, lingua)} → ${giornoBreve(scelta.partenza, lingua)} · ${t.notti(notti(scelta.arrivo, scelta.partenza))}`;
}

/** Cosa manca ancora: il giorno di arrivo, quello di partenza, o niente. */
export function suggerimento(scelta, lingua) {
  const t = testi(lingua);
  if (!scelta || !scelta.arrivo) return t.scegliArrivo;
  if (!scelta.partenza) return t.scegliPartenza;
  return '';
}

/* ---------- un giorno solo, e la nota della chiusura ---------- */

/** Un tocco solo, per i moduli che chiedono un giorno (trattamenti, transfer,
 *  green fee, maestro): la data, oppure '' se passata o chiusa. */
export function toccaGiorno(iso, { oggi, chiusure, fine = '', statoExtra = null }) {
  if (iso < oggi || (fine && iso > fine) || chiuso(iso, chiusure) || bloccatoDaExtra(iso, statoExtra)) return '';
  return iso;
}

/** «29 nov 2026», «29. Nov 2026»: la data breve con l'anno. */
export function dataBreve(iso, lingua) {
  const d = data(iso);
  if (!d) return '';
  const t = testi(lingua), l = TESTI[lingua] ? lingua : 'it';
  return `${d.getUTCDate()}${l === 'de' ? '.' : ''} ${t.mesiBrevi[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

const NOTA_CHIUSURA = {
  it: (a, b) => `Chiusi dal ${a} al ${b}`,
  de: (a, b) => `Geschlossen vom ${a} bis ${b}`,
  en: (a, b) => `Closed from ${a} to ${b}`,
  fr: (a, b) => `Fermé du ${a} au ${b}`,
};

/** «Chiusi dal 29 nov 2026 al 12 feb 2027»: un giorno grigio senza
 *  spiegazione e' un giorno che l'ospite prova a toccare tre volte. */
export function notaChiusura(chiusure, lingua) {
  const c = (chiusure || [])[0];
  if (!c || !c.chiusura || !c.riapertura) return '';
  const l = TESTI[lingua] ? lingua : 'it';
  const ultimo = data(c.riapertura);
  if (!ultimo) return '';
  ultimo.setUTCDate(ultimo.getUTCDate() - 1);
  return NOTA_CHIUSURA[l](dataBreve(c.chiusura, l), dataBreve(isoDi(ultimo), l));
}

/* ---------- il disegno ---------- */

const STILE = `
.calFoglio{background:#fff;border:1px solid #E5E0D8;border-radius:14px;box-shadow:0 12px 40px rgba(26,54,38,.18);font-family:inherit;color:#2A2E2B;z-index:50;}
.calTesta{position:sticky;top:0;background:#fff;border-bottom:1px solid #EFEAE0;padding:12px 16px;display:flex;align-items:center;gap:10px;z-index:1;}
.calTesta strong{flex:1;font-weight:500;font-size:15px;}
.calTesta small{display:block;color:#6B7A72;font-size:12.5px;font-weight:400;}
.calNota{color:#8C7A45;font-size:12.5px;padding:8px 16px 0;}
.calX{border:0;background:none;font-size:24px;line-height:1;cursor:pointer;color:#6B7A72;padding:4px 8px;}
.calMesi{display:grid;grid-template-columns:1fr 1fr;gap:18px;padding:12px 16px 90px;}
.calMese h3{font-family:"Cormorant Garamond",Georgia,serif;font-weight:400;font-size:20px;margin:6px 0 8px;color:#1A3626;}
.calSett,.calGiorni{display:grid;grid-template-columns:repeat(7,1fr);gap:2px;}
.calSett span{font-size:11px;color:#8C8578;text-align:center;padding:2px 0;}
.g{border:0;background:none;padding:0;height:42px;border-radius:9px;font:15px inherit;color:#2A2E2B;cursor:pointer;position:relative;}
.g.passato,.g.oltre{color:#C9C3B8;cursor:default;}
.campoDate{width:100%;margin-top:6px;padding:12px 13px;font:15px inherit;border:1px solid #DCD6CB;border-radius:9px;
  background:#FCFBF8;color:#2A2E2B;text-align:left;cursor:pointer;}
.campoDate:focus{outline:2px solid #4FA3A8;border-color:transparent;}
.campoDate.vuoto{color:#8C8578;}
.calBox{position:relative;}
.g.chiuso{color:#B8B2A6;background:#F1EEE8;cursor:default;}
.g.chiuso small{position:absolute;left:0;right:0;bottom:2px;font-size:9px;line-height:1;color:#9A948A;}
.g.esaurito{color:#B8B2A6;text-decoration:line-through;cursor:default;}
.g.non-in-vendita{color:#C9C3B8;cursor:default;}
.g.ultimi::after{content:"";position:absolute;left:50%;bottom:5px;width:5px;height:5px;margin-left:-2.5px;border-radius:50%;background:#C9A961;}
.calLegenda{display:flex;flex-wrap:wrap;gap:6px 14px;padding:8px 16px 0;font-size:12px;color:#6B7A72;}
.calLegenda .lg::before{content:"";display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:5px;vertical-align:-1px;background:#F1EEE8;border:1px solid #DCD6CB;}
.calLegenda .lg.esaurito::before{background:#B8B2A6;border-color:#B8B2A6;}
.calLegenda .lg.ultimi::before{background:#C9A961;border-color:#C9A961;border-radius:50%;}
.g.dentro{background:#E6F0EC;border-radius:0;}
.g.arrivo,.g.partenza{background:#1A3626;color:#fff;font-weight:600;}
.g.arrivo{border-radius:9px 0 0 9px;}
.g.partenza{border-radius:0 9px 9px 0;}
.g.arrivo.solo{border-radius:9px;}
.calBarra{position:sticky;bottom:0;background:#fff;border-top:1px solid #EFEAE0;padding:12px 16px;display:flex;gap:10px;justify-content:flex-end;}
.calBarra button{padding:12px 18px;border-radius:9px;font:600 15px inherit;cursor:pointer;}
.calCancella{background:#fff;border:1px solid #DCD6CB;color:#1A3626;}
.calConferma{background:#1A3626;border:0;color:#fff;}
.calConferma:disabled{opacity:.45;cursor:default;}
@media (max-width:640px){
  .calFoglio{position:fixed;inset:0;border-radius:0;overflow:auto;-webkit-overflow-scrolling:touch;}
  .calMesi{grid-template-columns:1fr;}
}
@media (min-width:641px){
  .calFoglio{position:absolute;left:0;right:0;margin-top:8px;max-height:560px;overflow:auto;}
}`;

function stileUnaVolta() {
  if (document.getElementById('leoCalendarioStile')) return;
  const s = document.createElement('style');
  s.id = 'leoCalendarioStile';
  s.textContent = STILE;
  document.head.appendChild(s);
}

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Disegna il calendario dentro `radice` e resta in ascolto. `modo`:
 *  'intervallo' (arrivo e partenza, il default) o 'giorno' (una data sola).
 *  Alla conferma chiama onConferma({ arrivo, partenza }) — in modo 'giorno'
 *  la data sta in `arrivo` — e si chiude; Esc e la X chiamano onChiudi. */
export function apriCalendario({ radice, lingua, oggi, chiusure, arrivo, partenza, modo, fine, statoExtra, onConferma, onChiudi }) {
  stileUnaVolta();
  const t = testi(lingua);
  const unGiorno = modo === 'giorno';
  let scelta = { arrivo: arrivo || '', partenza: unGiorno ? '' : (partenza || '') };
  const ctx = { oggi, chiusure: chiusure || [], fine: fine || '', statoExtra: typeof statoExtra === 'function' ? statoExtra : null };
  const primiChiusi = new Set((chiusure || []).map((c) => c.chiusura));
  const pronta = () => unGiorno ? !!scelta.arrivo : !!(scelta.arrivo && scelta.partenza);
  const testa = () => {
    if (unGiorno) return { forte: scelta.arrivo ? giornoBreve(scelta.arrivo, lingua) : t.scegliGiorno, sotto: '' };
    return { forte: riassunto(scelta, lingua) || t.scegli, sotto: suggerimento(scelta, lingua) };
  };
  const suTasto = (e) => { if (e.key === 'Escape') { chiudi(); if (onChiudi) onChiudi(); } };
  const chiudi = () => { radice.innerHTML = ''; document.removeEventListener('keydown', suTasto); };
  const disegna = () => {
    const mesi = griglia(oggi).map((m) => `<div class="calMese"><h3>${esc(t.mesiLunghi[m.mese - 1])} ${m.anno}</h3>
      <div class="calSett">${t.giorni.map((g) => `<span>${esc(g)}</span>`).join('')}</div>
      <div class="calGiorni">${m.giorni.map((d, i) => {
        const stato = statoGiorno(d.iso, { ...ctx, ...scelta });
        const vuoti = i === 0 && d.colonna ? `<span style="grid-column:span ${d.colonna}"></span>` : '';
        const solo = stato === 'arrivo' && !scelta.partenza ? ' solo' : '';
        const spento = stato === 'passato' || stato === 'oltre' || stato === 'chiuso' || stato === 'esaurito' || stato === 'non-in-vendita';
        return `${vuoti}<button type="button" data-iso="${d.iso}" class="g ${stato}${solo}"${spento ? ' tabindex="-1" aria-disabled="true"' : ''}>${d.giorno}${
          stato === 'chiuso' && primiChiusi.has(d.iso) ? `<small>${esc(t.chiusi)}</small>` : ''}</button>`;
      }).join('')}</div></div>`).join('');
    const nota = notaChiusura(ctx.chiusure, lingua);
    const h = testa();
    radice.innerHTML = `<div class="calFoglio" role="dialog" aria-label="${esc(t.campo)}">
      <div class="calTesta"><strong>${esc(h.forte)}<small>${esc(h.sotto)}</small></strong>
        <button type="button" class="calX" aria-label="${esc(t.chiudi)}">&times;</button></div>
      ${nota ? `<div class="calNota">${esc(nota)}</div>` : ''}
      ${ctx.statoExtra ? `<div class="calLegenda"><span class="lg esaurito">${esc(t.esaurito)}</span><span class="lg nonInVendita">${esc(t.nonInVendita)}</span><span class="lg ultimi">${esc(t.ultimi)}</span></div>` : ''}
      <div class="calMesi">${mesi}</div>
      <div class="calBarra"><button type="button" class="calCancella">${esc(t.cancella)}</button>
        <button type="button" class="calConferma">${esc(t.conferma)}</button></div></div>`;
    radice.querySelector('.calConferma').disabled = !pronta();
    radice.querySelectorAll('.g').forEach((b) => b.addEventListener('click', () => {
      /* A UN GIORNO SOLO UN TOCCO BASTA: «se uno seleziona una data non
         chiedere conferma, chiudi il calendario» (la proprieta', 3
         settembre 2026). Un giorno che non si puo' toccare non fa niente. */
      if (unGiorno) {
        const dopo = { arrivo: toccaGiorno(b.dataset.iso, ctx), partenza: '' };
        if (unGiorno && dopo.arrivo) { chiudi(); if (onConferma) onConferma({ ...dopo }); }
        return;
      }
      const dopo = tocca(scelta, b.dataset.iso, ctx);
      if (dopo.arrivo === scelta.arrivo && dopo.partenza === scelta.partenza) return;
      scelta = dopo;
      disegna();
    }));
    radice.querySelector('.calCancella').onclick = () => { scelta = { arrivo: '', partenza: '' }; disegna(); };
    radice.querySelector('.calConferma').onclick = () => { if (!pronta()) return; chiudi(); if (onConferma) onConferma({ ...scelta }); };
    radice.querySelector('.calX').onclick = () => { chiudi(); if (onChiudi) onChiudi(); };
  };
  document.addEventListener('keydown', suTasto);
  disegna();
  return { chiudi };
}

/* ---------- l'innesto sui moduli che chiedono un giorno solo ---------- */

/** Data locale di oggi, non UTC: fra mezzanotte e le due il campo direbbe
 *  ieri. Stessa regola di oggiISO in /comune/date.js. */
export function oggiLocale(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Le chiusure dal server (a=stagione della funzione richieste): la stagione
 *  in corso o prossima, o niente. Mai un errore, mai date inventate. */
export async function leggiChiusure(funzione) {
  try {
    const r = await fetch(funzione + '?a=stagione');
    const d = await r.json().catch(() => ({}));
    return d && d.stagione && d.stagione.chiusura && d.stagione.riapertura ? [d.stagione] : [];
  } catch (e) {
    return [];
  }
}

/** Innesta il calendario a un giorno solo su un campo data esistente
 *  (trattamenti, transfer, green fee, maestro): il campo diventa nascosto —
 *  stesso id, stesso valore ISO, stessi min e max, che si leggono al momento
 *  dell'apertura — e al suo posto compare un pulsante che mostra la data e
 *  apre il calendario. Alla conferma scrive il valore e lancia `input` e
 *  `change`, cosi' chi ascoltava il campo continua a sentire. Un valore
 *  scritto dal codice (le date precompilate dai link delle offerte, il
 *  cambio di verso del transfer) si vede comunque: il pulsante si riallinea
 *  a intervalli. `chiusure` e' un elenco o una funzione che lo restituisce,
 *  perche' dal server arriva dopo. */
export function innestaGiorno({ campo, lingua, chiusure, testoVuoto, statoExtra }) {
  if (!campo || campo.dataset.calendarioInnestato) return null;
  campo.dataset.calendarioInnestato = '1';
  stileUnaVolta();
  const t = testi(lingua);
  campo.type = 'hidden';
  const bottone = document.createElement('button');
  bottone.type = 'button';
  bottone.className = 'campoDate';
  bottone.id = campo.id + 'Btn';
  const box = document.createElement('div');
  box.className = 'calBox';
  campo.insertAdjacentElement('afterend', bottone);
  bottone.insertAdjacentElement('afterend', box);
  const aggiorna = () => {
    const v = campo.value;
    bottone.textContent = v ? `${giornoBreve(v, lingua)} ${v.slice(0, 4)}` : (testoVuoto || t.scegliGiorno);
    bottone.classList.toggle('vuoto', !v);
  };
  aggiorna();
  const orologio = setInterval(() => {
    if (!document.body.contains(campo)) { clearInterval(orologio); return; }
    aggiorna();
  }, 500);
  bottone.addEventListener('click', () => {
    const oggi = oggiLocale();
    const inizio = campo.min && campo.min > oggi ? campo.min : oggi;
    apriCalendario({
      radice: box, lingua, oggi: inizio, fine: campo.max || '',
      chiusure: typeof chiusure === 'function' ? chiusure() : chiusure,
      statoExtra,
      arrivo: campo.value, modo: 'giorno',
      onConferma: ({ arrivo }) => {
        campo.value = arrivo;
        for (const ev of ['input', 'change']) campo.dispatchEvent(new Event(ev, { bubbles: true }));
        aggiorna();
      },
    });
  });
  return { aggiorna };
}
