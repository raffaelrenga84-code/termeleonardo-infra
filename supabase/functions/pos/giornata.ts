/* ============================================================
   giornata.ts — la cassa di fine giornata, dai conti chiusi. Puro.

   «il riepilogo di fine giornata (incassato per cameriere, per
   contanti/carta/camera, articoli piu' venduti)» (la proprieta', 4
   settembre 2026). Senza questo la cassa non quadra da sola: e' la prima
   cosa che ASA e Fidra hanno e noi no.

   Le parole contano: contanti e carta sono INCASSO; «in camera» e' un
   ADDEBITO che la reception riporta sul conto camera — soldi che
   arrivano al check-out, non stasera. Per cameriere si conta chi ha
   CHIUSO il conto, cioe' chi ha in mano i soldi. Gli storni si vedono a
   parte col motivo e chi li ha fatti: e' li' che si guarda quando
   qualcosa non torna.

   Dal 5 settembre 2026 ogni incasso e' una riga di pos_pagamento: un
   conto pagato meta' in contanti e meta' con la carta si divide fra i
   due. I conti di prima, senza pagamenti registrati, valgono per il
   modo con cui sono stati chiusi. Lo prova giornata.test.ts.
   ============================================================ */
export type ContoChiuso = { id: string; chiuso_come: string | null; chiuso_da: string | null; coperti?: number | null; camera?: string | null };
export type RigaGiornata = { conto: string; nome: string; quantita: number; prezzo_cent: number; stato: string; motivo_storno?: string | null; stornata_da?: string | null };
export type PagamentoGiornata = { conto: string; modo?: string | null; importo_cent: number };
export type Riepilogo = {
  conti: number; coperti: number;
  per_modo: { contanti: number; carta: number; camera: number };
  incasso_cent: number; camera_cent: number; totale_cent: number;
  per_cameriere: { id: string; nome: string; conti: number; totale_cent: number }[];
  articoli: { nome: string; quantita: number; totale_cent: number }[];
  storni: { nome: string; quantita: number; totale_cent: number; motivo: string | null; da: string | null }[];
  storni_cent: number;
};

type Modo = 'contanti' | 'carta' | 'camera';
const modoDi = (x: string | null | undefined): Modo => x === 'carta' ? 'carta' : x === 'camera' ? 'camera' : 'contanti';

export function riepilogo({ conti, righe, pagamenti = [], nomi, quantiArticoli = 15 }: {
  conti: ContoChiuso[]; righe: RigaGiornata[]; pagamenti?: PagamentoGiornata[]; nomi: Record<string, string>; quantiArticoli?: number;
}): Riepilogo {
  const nome = (id: string | null | undefined) => (id ? (nomi[id] ?? id) : '—');
  const totaleDi = new Map<string, number>();
  const articoli = new Map<string, { nome: string; quantita: number; totale_cent: number }>();
  const storni: Riepilogo['storni'] = [];
  for (const r of righe) {
    const q = Number(r.quantita) || 0, p = Number(r.prezzo_cent) || 0;
    if (r.stato === 'stornata') {
      storni.push({ nome: r.nome, quantita: q, totale_cent: q * p, motivo: r.motivo_storno ?? null, da: r.stornata_da ? nome(r.stornata_da) : null });
      continue;
    }
    totaleDi.set(r.conto, (totaleDi.get(r.conto) ?? 0) + q * p);
    const a = articoli.get(r.nome) ?? { nome: r.nome, quantita: 0, totale_cent: 0 };
    a.quantita += q; a.totale_cent += q * p;
    articoli.set(r.nome, a);
  }
  const pagatiDi = new Map<string, PagamentoGiornata[]>();
  for (const p of pagamenti) pagatiDi.set(p.conto, [...(pagatiDi.get(p.conto) ?? []), p]);
  const per_modo = { contanti: 0, carta: 0, camera: 0 };
  const perCameriere = new Map<string, { id: string; nome: string; conti: number; totale_cent: number }>();
  let coperti = 0;
  for (const c of conti) {
    const tot = totaleDi.get(c.id) ?? 0;
    /* coi pagamenti registrati il modo lo dicono loro; quel che avanza
       (o tutto, per i conti di prima) va nel modo di chiusura */
    let coperto = 0;
    for (const p of pagatiDi.get(c.id) ?? []) {
      const i = Math.max(0, Math.round(Number(p.importo_cent) || 0));
      per_modo[modoDi(p.modo)] += i;
      coperto += i;
    }
    if (tot > coperto) per_modo[modoDi(c.chiuso_come)] += tot - coperto;
    coperti += Number(c.coperti) || 0;
    const id = c.chiuso_da ?? '—';
    const chi = perCameriere.get(id) ?? { id, nome: nome(c.chiuso_da), conti: 0, totale_cent: 0 };
    chi.conti += 1; chi.totale_cent += tot;
    perCameriere.set(id, chi);
  }
  const incasso_cent = per_modo.contanti + per_modo.carta;
  return {
    conti: conti.length, coperti, per_modo,
    incasso_cent, camera_cent: per_modo.camera, totale_cent: incasso_cent + per_modo.camera,
    per_cameriere: [...perCameriere.values()].sort((a, b) => b.totale_cent - a.totale_cent || a.nome.localeCompare(b.nome)),
    articoli: [...articoli.values()].sort((a, b) => b.quantita - a.quantita || b.totale_cent - a.totale_cent || a.nome.localeCompare(b.nome)).slice(0, quantiArticoli),
    storni, storni_cent: storni.reduce((t, s) => t + s.totale_cent, 0),
  };
}
