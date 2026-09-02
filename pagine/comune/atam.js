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

/* IL CELLULARE, ACCANTO AL NOME. Il modulo dei tassisti non ha un campo
   telefono: ha il campo del cliente, quello che l'autista legge per sapere
   chi cerca. Il numero va li', cosi' se il volo ritarda o non si trovano
   in aeroporto l'autista puo' chiamare. Prima restava nella scheda del
   back office e nell'email alla reception, e ai tassisti non arrivava mai
   (segnalato il 2 settembre 2026). Sull'andata e sul ritorno, che su
   atam.biz sono due prenotazioni.

   Solo il numero, non l'email: e' quello che serve a eseguire la corsa che
   l'ospite ha chiesto, e niente di piu'. Nelle email all'ospite non
   compare: il suo numero lo conosce, e quelle email girano. Non e' una
   voce a parte: sarebbe un valore senza un campo dove incollarlo. */
export function clienteATAM(r) {
  const nome = String((r && r.nome) || '').trim();
  const telefono = String((r && r.telefono) || '').trim();
  return [nome, telefono].filter(Boolean).join(' · ');
}

/* Nell'ordine in cui il modulo dei tassisti chiede le cose, cosi' chi copia
   scende una volta sola invece di saltare avanti e indietro. */
export function vociATAM(r, dataIT) {
  const d = (r && r.dati) || {};
  const voci = [
    { eti: 'Data', val: dataIT(d.quando || '') },
    { eti: 'Ora', val: d.ora || '' },
    { eti: 'Pax', val: d.pax === undefined || d.pax === null ? '' : String(d.pax) },
    /* qui, e non altrove, perche' e' il posto in cui il modulo dei tassisti
       lo chiede: fra i passeggeri e la direzione */
    { eti: 'Servizio', val: d.collettivo ? 'Navetta condivisa (collettivo)' : 'Auto privata (individuale)' },
    { eti: d.verso === 'partenza' ? 'Partenza per' : 'Arrivo da', val: d.luogo || '' },
    { eti: 'Nome del cliente', val: clienteATAM(r) },
  ];
  if (d.volo) voci.push({ eti: 'Dettagli arrivo', val: String(d.volo) });
  /* il ritorno non e' un valore da incollare in un campo: e' una cosa che
     l'operatore deve SAPERE, e infatti sul modulo dei tassisti si prenota
     come una seconda corsa */
  if (d.ritorno) voci.push({ eti: 'Nota', val: 'serve anche il ritorno', soloDaLeggere: true });
  if (d.note) voci.push({ eti: 'Note', val: String(d.note) });
  return voci;
}

/* I valori GREZZI per il modulo dei tassisti, quelli che l'estensione scrive
   nei campi: niente etichette, niente date scritte a parole. Le voci qui
   sopra servono agli occhi di chi legge; questi servono a una macchina.

   `ritorno` non ha un campo suo su atam.biz — li' il ritorno e' una seconda
   corsa — quindi finisce nelle note, dov'e' l'unico posto in cui qualcuno
   lo legge prima di prenotare. */
export function datiATAM(r) {
  const d = (r && r.dati) || {};
  const note = [
    d.ritorno ? 'Serve anche il ritorno' : '',
    d.note ? String(d.note) : '',
  ].filter(Boolean).join(' · ');
  return {
    data: String(d.quando || '').slice(0, 10),
    ora: d.ora || '',
    pax: d.pax == null ? '' : String(d.pax),
    verso: d.verso === 'partenza' ? 'partenza' : 'arrivo',
    /* SEMPRE un booleano vero, mai `undefined`. L'estensione deve scegliere
       fra due pallini: un valore assente la lascerebbe a indovinare, ed e'
       esattamente quello che facevamo prima di chiederlo nel modulo. */
    collettivo: d.collettivo === true,
    luogo: d.luogo || '',
    nome: clienteATAM(r),
    volo: d.volo ? String(d.volo) : '',
    note,
  };
}

/* L'indirizzo che apre il modulo dei tassisti gia' compilato.
   I dati viaggiano nel FRAMMENTO — tutto cio' che sta dopo il # — che il
   browser non manda mai al server: atam.biz riceve la richiesta della
   pagina e basta. E' lo stesso meccanismo del segnalibro «Documenti
   Leonardo». Li legge atam-booking.js dell'estensione, che poi li toglie
   dall'indirizzo. */
export function indirizzoATAM(r) {
  return 'https://www.atam.biz/prenotazioni/#leo='
    + encodeURIComponent(JSON.stringify(datiATAM(r)));
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

/* IL RITORNO E' UNA SECONDA PRENOTAZIONE, non un campo.

   Su atam.biz non esiste un «ritorno»: si prenota da capo, con la sua data,
   la sua ora, il suo verso e il suo servizio. Finora la richiesta portava
   solo un booleano e una nota nelle note, e la reception ricostruiva tutto
   a mano.

   IL VERSO E' OPPOSTO. Chi arriva dall'aeroporto torna in aeroporto:
   copiare il verso dell'andata manderebbe il tassista dalla parte
   sbagliata.

   IL SERVIZIO E' SUO. Alle 22:00 la navetta non e' in servizio, quindi un
   ritorno puo' essere privato anche quando l'andata era condivisa.

   Le note dell'andata NON si ricopiano: «serve anche il ritorno» sulla
   prenotazione del ritorno sarebbe un'istruzione a vuoto. */
export function datiATAMRitorno(r) {
  const d = (r && r.dati) || {};
  if (!d.ritorno_quando) return null;
  return {
    data: String(d.ritorno_quando).slice(0, 10),
    ora: d.ritorno_ora || '',
    pax: d.pax == null ? '' : String(d.pax),
    verso: d.verso === 'partenza' ? 'arrivo' : 'partenza',
    collettivo: d.ritorno_collettivo === true,
    luogo: d.luogo || '',
    nome: clienteATAM(r),
    volo: d.ritorno_volo ? String(d.ritorno_volo) : '',
    note: d.note ? String(d.note) : '',
  };
}

/* Le voci del ritorno per gli occhi di chi legge, nell'ordine del modulo
   dei tassisti, come vociATAM per l'andata. Nel back office l'andata aveva
   la sua tabella e il ritorno soltanto un pulsante: chi non ha l'estensione
   doveva ricostruirlo a mano, e chi ce l'ha non vedeva cosa stava per
   aprire (la proprieta', 2 settembre 2026: «andata e poi pulsante, ritorno
   e poi pulsante: metti un po' di ordine»).

   Nascono dai valori grezzi (datiATAMRitorno) e non dalla richiesta: cosi'
   la tabella e il modulo aperto gia' compilato non possono dire due cose
   diverse. null senza ritorno, come datiATAMRitorno: un blocco vuoto e' un
   blocco che si prenota per sbaglio. */
export function vociATAMRitorno(r, dataIT) {
  const g = datiATAMRitorno(r);
  if (!g) return null;
  const voci = [
    { eti: 'Data', val: dataIT(g.data) },
    { eti: 'Ora', val: g.ora },
    { eti: 'Pax', val: g.pax },
    { eti: 'Servizio', val: g.collettivo ? 'Navetta condivisa (collettivo)' : 'Auto privata (individuale)' },
    { eti: g.verso === 'partenza' ? 'Partenza per' : 'Arrivo da', val: g.luogo },
    { eti: 'Nome del cliente', val: g.nome },
  ];
  if (g.volo) voci.push({ eti: 'Dettagli arrivo', val: g.volo });
  if (g.note) voci.push({ eti: 'Note', val: g.note });
  return voci;
}

/* L'indirizzo che apre il modulo dei tassisti gia' compilato per il
   RITORNO. Stesso frammento, stesso meccanismo: sono due prenotazioni, e
   quindi due indirizzi. */
export function indirizzoATAMRitorno(r) {
  const d = datiATAMRitorno(r);
  if (!d) return null;
  return 'https://www.atam.biz/prenotazioni/#leo=' + encodeURIComponent(JSON.stringify(d));
}
