/* Il riepilogo di un transfer nella forma che vuole il modulo dei tassisti.

   Vive qui e non dentro la pagina del back office perche' e' la parte che
   vale la pena provare da sola: il luogo deve combaciare parola per parola
   con l'elenco di atam.biz — doppi spazi compresi — e una voce che non
   combacia costringe la reception a cercarla a mano.

   ETICHETTA E VALORE SONO DUE COSE SEPARATE, e non e' un dettaglio. Il
   modulo dei tassisti ha un campo per ognuna di queste voci: chi copia deve
   poter prendere il VALORE e basta. Prima era un blocco solo, con le
   etichette dentro, e sopra ci stava scritto «Da incollare su atam.biz»:
   incollandolo, nel campo della data finiva «Data: 15 agosto 2026», la
   parola «Data:» compresa, e il calendario non la sapeva leggere.

   Il formattatore della data lo passa chi chiama: questo modulo non
   possiede il modo di scrivere una data, e due copie di quella regola
   divergerebbero. */

/* Nell'ordine in cui il modulo dei tassisti chiede le cose, cosi' chi copia
   scende una volta sola invece di saltare avanti e indietro. */
export function vociATAM(r, dataIT) {
  const d = (r && r.dati) || {};
  const voci = [
    { eti: 'Data', val: dataIT(d.quando || '') },
    { eti: 'Ora', val: d.ora || '' },
    { eti: 'Pax', val: d.pax === undefined || d.pax === null ? '' : String(d.pax) },
    { eti: d.verso === 'partenza' ? 'Partenza per' : 'Arrivo da', val: d.luogo || '' },
    { eti: 'Nome del cliente', val: (r && r.nome) || '' },
  ];
  if (d.volo) voci.push({ eti: 'Dettagli arrivo', val: String(d.volo) });
  /* il ritorno non e' un valore da incollare in un campo: e' una cosa che
     l'operatore deve SAPERE, e infatti sul modulo dei tassisti si prenota
     come una seconda corsa */
  if (d.ritorno) voci.push({ eti: 'Nota', val: 'serve anche il ritorno', soloDaLeggere: true });
  if (d.note) voci.push({ eti: 'Note', val: String(d.note) });
  return voci;
}

/* Il blocco intero, com'era prima: c'e' chi lo incolla nelle note del modulo
   dei tassisti, ed e' legittimo. Le due forme non possono divergere perche'
   la seconda e' fatta con la prima. */
export function riepilogoATAM(r, dataIT) {
  return vociATAM(r, dataIT)
    .filter((v) => v.val !== '')
    .map((v) => `${v.eti}: ${v.val}`)
    .join('\n');
}
