/* Il buono regalo: un solo modello per il back office e per la pagina
   pubblica di acquisto. Prima erano due funzioni diverse e quella pubblica
   era rimasta indietro — il cliente vedeva meno di quello che riceveva.

   Resta fuori la copia dentro email-buono.ts della funzione: l'email deve
   essere costruita a tabelle per Outlook e non puo' importare un modulo.
   Cambiando qui, controllare anche la'. Presidiato da buono.test.ts. */

export const esc = (s) => String(s ?? '').replace(/[&<>"]/g,
  c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));

export const BASE_IMG = 'https://arrivo-terme-leonardo.vercel.app/buoni/img';
export const COPERTINE = {
  dayspa:   `${BASE_IMG}/dayspa.jpg`,
  massaggi: `${BASE_IMG}/trattamenti.jpg`,
  viso:     `${BASE_IMG}/trattamenti.jpg`,
  corpo:    `${BASE_IMG}/trattamenti.jpg`,
  valore:   `${BASE_IMG}/valore.jpg`
};
export const NARRATIVA = {
  dayspa: {
    it:{ occhiello:'PISCINE TERMALI \u00b7 HOTEL LEONARDO', frase:'Un momento di pura quiete,<br />\u00e8 il regalo pi\u00f9 bello.',
      testo:'Tra le acque termali dei Colli Euganei, un\u2019intera giornata pensata solo per te: per respirare piano, lasciarsi andare e ritrovare il proprio equilibrio.' },
    de:{ occhiello:'THERMALB\u00c4DER \u00b7 HOTEL LEONARDO', frase:'Ein Moment der Stille<br />ist das sch\u00f6nste Geschenk.',
      testo:'Im Thermalwasser der Euganeischen H\u00fcgel ein ganzer Tag nur f\u00fcr Sie: durchatmen, loslassen und wieder ins Gleichgewicht kommen.' },
    en:{ occhiello:'THERMAL POOLS \u00b7 HOTEL LEONARDO', frase:'A moment of pure quiet<br />is the finest gift.',
      testo:'In the thermal waters of the Euganean Hills, a whole day just for you: to breathe slowly, let go and find your balance again.' },
    fr:{ occhiello:'PISCINES THERMALES \u00b7 H\u00d4TEL LEONARDO', frase:'Un moment de pur calme,<br />le plus beau des cadeaux.',
      testo:'Dans les eaux thermales des collines eugan\u00e9ennes, une journ\u00e9e enti\u00e8re rien que pour vous : respirer, l\u00e2cher prise et retrouver son \u00e9quilibre.' }
  },
  massaggi: {
    it:{ occhiello:'CENTRO BENESSERE \u00b7 HOTEL LEONARDO', frase:'Un\u2019ora per s\u00e9,<br />\u00e8 il regalo pi\u00f9 raro.',
      testo:'Mani esperte, oli caldi e il silenzio del centro benessere: il tempo rallenta e il corpo si scioglie.' },
    de:{ occhiello:'WELLNESSBEREICH \u00b7 HOTEL LEONARDO', frase:'Eine Stunde f\u00fcr sich<br />ist das seltenste Geschenk.',
      testo:'Erfahrene H\u00e4nde, warme \u00d6le und die Ruhe des Wellnessbereichs: die Zeit wird langsamer, der K\u00f6rper l\u00f6st sich.' },
    en:{ occhiello:'WELLNESS CENTRE \u00b7 HOTEL LEONARDO', frase:'An hour to yourself<br />is the rarest gift.',
      testo:'Skilled hands, warm oils and the quiet of the wellness centre: time slows down and the body lets go.' },
    fr:{ occhiello:'CENTRE DE BIEN-\u00caTRE \u00b7 H\u00d4TEL LEONARDO', frase:'Une heure pour soi,<br />le plus rare des cadeaux.',
      testo:'Des mains expertes, des huiles chaudes et le silence du centre de bien-\u00eatre : le temps ralentit et le corps se d\u00e9tend.' }
  },
  viso: {
    it:{ occhiello:'TRATTAMENTI VISO \u00b7 HOTEL LEONARDO', frase:'La cura di s\u00e9<br />comincia da uno sguardo.',
      testo:'Trattamenti su misura con i principi attivi dell\u2019acqua termale, per una pelle che ritrova luce e morbidezza.' },
    de:{ occhiello:'GESICHTSBEHANDLUNGEN \u00b7 HOTEL LEONARDO', frase:'Die Pflege beginnt<br />mit einem Blick.',
      testo:'Ma\u00dfgeschneiderte Behandlungen mit den Wirkstoffen des Thermalwassers, f\u00fcr eine Haut voller Licht und Weichheit.' },
    en:{ occhiello:'FACIAL TREATMENTS \u00b7 HOTEL LEONARDO', frase:'Caring for yourself<br />begins with a glance.',
      testo:'Tailored treatments with the active ingredients of thermal water, for skin that regains its light and softness.' },
    fr:{ occhiello:'SOINS DU VISAGE \u00b7 H\u00d4TEL LEONARDO', frase:'Prendre soin de soi<br />commence par un regard.',
      testo:'Des soins sur mesure aux principes actifs de l\u2019eau thermale, pour une peau qui retrouve \u00e9clat et douceur.' }
  },
  corpo: {
    it:{ occhiello:'RITUALI CORPO \u00b7 HOTEL LEONARDO', frase:'Il benessere si sente<br />prima ancora di vederlo.',
      testo:'Scrub, fanghi e trattamenti che risvegliano il corpo, nel calore dell\u2019acqua termale dei Colli Euganei.' },
    de:{ occhiello:'K\u00d6RPERRITUALE \u00b7 HOTEL LEONARDO', frase:'Wohlbefinden sp\u00fcrt man,<br />bevor man es sieht.',
      testo:'Peelings, Fango und Behandlungen, die den K\u00f6rper wecken \u2014 in der W\u00e4rme des Thermalwassers der Euganeischen H\u00fcgel.' },
    en:{ occhiello:'BODY RITUALS \u00b7 HOTEL LEONARDO', frase:'Wellbeing is felt<br />before it is seen.',
      testo:'Scrubs, mud and treatments that awaken the body, in the warmth of the thermal water of the Euganean Hills.' },
    fr:{ occhiello:'RITUELS CORPS \u00b7 H\u00d4TEL LEONARDO', frase:'Le bien-\u00eatre se ressent<br />avant m\u00eame de se voir.',
      testo:'Gommages, fangos et soins qui r\u00e9veillent le corps, dans la chaleur de l\u2019eau thermale des collines eugan\u00e9ennes.' }
  },
  valore: {
    it:{ occhiello:'HOTEL TERME LEONARDO \u00b7 ABANO TERME', frase:'Lascia che scelga<br />il suo momento.',
      testo:'Un buono da usare come preferisce: una giornata alle terme, un trattamento, un soggiorno tra i Colli Euganei.' },
    de:{ occhiello:'HOTEL TERME LEONARDO \u00b7 ABANO TERME', frase:'Lassen Sie ihn<br />den Moment w\u00e4hlen.',
      testo:'Ein Gutschein nach Wunsch einzul\u00f6sen: ein Thermentag, eine Anwendung oder ein Aufenthalt in den Euganeischen H\u00fcgeln.' },
    en:{ occhiello:'HOTEL TERME LEONARDO \u00b7 ABANO TERME', frase:'Let them choose<br />their own moment.',
      testo:'A voucher to use as they please: a day at the spa, a treatment, or a stay in the Euganean Hills.' },
    fr:{ occhiello:'HOTEL TERME LEONARDO \u00b7 ABANO TERME', frase:'Laissez-lui choisir<br />son moment.',
      testo:'Un bon \u00e0 utiliser \u00e0 sa guise : une journ\u00e9e aux thermes, un soin, ou un s\u00e9jour dans les collines eugan\u00e9ennes.' }
  }
};

/* etichette del buono */
/* nota, in tutte e quattro le lingue qui sotto: la frase risponde alla
   domanda di chi riceve un buono con pi\u00f9 voci (es. "4 \u00d7 Day Spa festivo") \u2014
   quattro persone insieme o una persona in quattro momenti diversi?
   "come preferite" lascia scegliere. Vale per ogni lingua, non solo per
   quella che si sta modificando. */
export const ETI = {
  it:{ titolo:'Buono Regalo', haRicevuto:(n)=>`${n}, hai ricevuto<br />un dono speciale`,
    senzaNome:'Un dono speciale<br />per te', da:'CON AFFETTO, DA', codice:'CODICE BUONO',
    valido:(d)=>`Valido fino al ${d}`, valore:(v)=>`valore ${v} &euro;`,
    anteprima:'ANTEPRIMA \u2014 NON ANCORA VALIDO',
    anteprimaNota:'Il codice viene assegnato al momento del pagamento.',
    nota:'Ogni ingresso o trattamento vale per una persona: potete venire insieme o in momenti diversi, come preferite. Su prenotazione: basta chiamarci o scriverci.' },
  de:{ titolo:'Geschenkgutschein', haRicevuto:(n)=>`${n}, Sie haben<br />ein besonderes Geschenk erhalten`,
    senzaNome:'Ein besonderes<br />Geschenk f\u00fcr Sie', da:'HERZLICHST, VON', codice:'GUTSCHEINCODE',
    valido:(d)=>`G\u00fcltig bis ${d}`, valore:(v)=>`Wert ${v} &euro;`,
    anteprima:'VORSCHAU \u2014 NOCH NICHT G\u00dcLTIG',
    anteprimaNota:'Der Code wird bei Zahlungseingang vergeben.',
    nota:'Jeder Eintritt und jede Anwendung gilt f\u00fcr eine Person: Sie k\u00f6nnen gemeinsam kommen oder zu verschiedenen Zeiten, ganz wie Sie m\u00f6chten. Auf Reservierung: rufen Sie uns an oder schreiben Sie uns.' },
  en:{ titolo:'Gift Voucher', haRicevuto:(n)=>`${n}, you have received<br />a special gift`,
    senzaNome:'A special gift<br />for you', da:'WITH LOVE, FROM', codice:'VOUCHER CODE',
    valido:(d)=>`Valid until ${d}`, valore:(v)=>`value ${v} &euro;`,
    anteprima:'PREVIEW \u2014 NOT YET VALID',
    anteprimaNota:'The code is assigned once payment is received.',
    nota:'Each admission or treatment is for one person: you can come together or at different times, as you prefer. By reservation: just call or write to us.' },
  fr:{ titolo:'Bon Cadeau', haRicevuto:(n)=>`${n}, vous avez re\u00e7u<br />un cadeau tr\u00e8s sp\u00e9cial`,
    senzaNome:'Un cadeau sp\u00e9cial<br />pour vous', da:'AVEC AFFECTION, DE', codice:'CODE DU BON',
    valido:(d)=>`Valable jusqu'au ${d}`, valore:(v)=>`valeur ${v} &euro;`,
    anteprima:'APER\u00c7U \u2014 PAS ENCORE VALABLE',
    anteprimaNota:'Le code est attribu\u00e9 au moment du paiement.',
    nota:'Chaque entr\u00e9e ou soin vaut pour une personne : vous pouvez venir ensemble ou \u00e0 des moments diff\u00e9rents, comme vous pr\u00e9f\u00e9rez. Sur r\u00e9servation : appelez-nous ou \u00e9crivez-nous.' }
};

export const MESI_L = {
  it:['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'],
  de:['Januar','Februar','M\u00e4rz','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'],
  en:['January','February','March','April','May','June','July','August','September','October','November','December'],
  fr:['janvier','f\u00e9vrier','mars','avril','mai','juin','juillet','ao\u00fbt','septembre','octobre','novembre','d\u00e9cembre']
};
export function dataLingua(iso, l) {
  if (!iso) return '';
  const d = new Date(String(iso).slice(0,10) + 'T12:00');
  const m = (MESI_L[l] || MESI_L.it)[d.getMonth()];
  if (l === 'de') return `${d.getDate()}. ${m} ${d.getFullYear()}`;
  if (l === 'en') return `${d.getDate()} ${m} ${d.getFullYear()}`;
  return `${d.getDate()} ${m} ${d.getFullYear()}`;
}

export function categoriaBuono(b) {
  const id = String(b.voce_id || '');
  if (b.tipo === 'valore') return 'valore';
  if (id.startsWith('dayspa')) return 'dayspa';
  if (/^(prog|relax|plantare|candle|antistress|californiano|ayurveda|hotstone|pindasweda|linfo|shiatzu)/.test(id)) return 'massaggi';
  if (/^(visofango|pulizia|ialuronico|collagene|vitaminac)/.test(id)) return 'viso';
  if (/^(scrub|riducente|seno|antiage|manicure|pedicure|epil)/.test(id)) return 'corpo';
  return 'valore';
}

/* dettaglio di cosa comprende: per il Day Spa l'elenco vero delle piscine */
export const COMPRENDE = {
  dayspa: {
    it:['Piscine termali interna ed esterna comunicanti, con idromassaggi e giochi d\u2019acqua',
      'Zona Relax: Biogrotta, bagno turco, vasca idromassaggio, lettini massaggianti',
      'Cascata di acqua termale, cascata di ghiaccio e docce emozionali con aromaterapia',
      'Vasca esterna di acqua termale più fresca, con bordo a sfioro e lettini prendisole'],
    de:['Thermal-Innen- und Au\u00dfenpool, miteinander verbunden, mit Sprudelliegen und Wasserspielen',
      'Relaxbereich: Biogrotte, Dampfbad, Whirlpool, Massageliegen',
      'Thermalwasserfall, Eisbrunnen und Erlebnisduschen mit Aromatherapie',
      'Au\u00dfenbecken mit k\u00fchlerem Thermalwasser, Infinity-Rand und Sonnenliegen'],
    en:['Connected indoor and outdoor thermal pools, with hydromassage and water features',
      'Relax area: Bio-grotto, steam bath, whirlpool, massage loungers',
      'Thermal waterfall, ice fountain and emotional showers with aromatherapy',
      'Outdoor pool with cooler thermal water, infinity edge and sun loungers'],
    fr:['Piscines thermales int\u00e9rieure et ext\u00e9rieure communicantes, avec hydromassages et jeux d\u2019eau',
      'Espace Relax : bio-grotte, bain turc, bain \u00e0 remous, lits de massage',
      'Cascade d\u2019eau thermale, cascade de glace et douches sensorielles \u00e0 l\u2019aromath\u00e9rapie',
      'Bassin ext\u00e9rieur d\u2019eau thermale plus fra\u00eeche, \u00e0 d\u00e9bordement, avec transats']
  }
};

/* ⚠ due copie per forza: qui e in email-buono.ts della funzione, che va
   costruita a tabelle per Outlook e non puo' importare questo modulo.
   È il testo che il cliente dichiara di accettare prima di pagare: deve
   restare parola per parola identico. Presidiato da buono.test.ts. */
export const CONDIZIONI = {
  it: "Apertura stagionale: l’hotel chiude ogni anno da fine novembre a febbraio; il buono non è valido in questo periodo. È richiesta la maggiore età per l’accesso a piscine, hotel e spa; ingressi soggetti a disponibilità e prenotazione obbligatoria. Il buono non è utilizzabile nelle prime 48 ore dall’acquisto, non è rimborsabile né convertibile in denaro; gli importi residui dopo il primo utilizzo non sono trasferibili. In caso di cancellazione, modifica o mancata presentazione (no show) il buono non è rimborsabile. Validità un anno dalla data di emissione.",
  de: "Saisonale Öffnung: das Hotel schließt jedes Jahr von Ende November bis Februar; in diesem Zeitraum ist der Gutschein nicht gültig. Für den Zutritt zu Pools, Hotel und Spa ist Volljährigkeit erforderlich; Eintritte nach Verfügbarkeit, Reservierung erforderlich. Der Gutschein ist in den ersten 48 Stunden nach dem Kauf nicht einlösbar, nicht erstattungsfähig und nicht in Bargeld umtauschbar; Restbeträge nach der ersten Einlösung sind nicht übertragbar. Bei Stornierung, Änderung oder Nichterscheinen (No-Show) ist der Gutschein nicht erstattungsfähig. Gültigkeit ein Jahr ab Ausstellungsdatum.",
  en: "Seasonal opening: the hotel closes every year from late November to February; the voucher is not valid in this period. Guests must be of legal age to access pools, hotel and spa; admission subject to availability, booking required. The voucher cannot be used within the first 48 hours of purchase, is not refundable and cannot be exchanged for cash; any remaining amount after the first use is not transferable. In case of cancellation, modification or no-show, the voucher is not refundable. Valid for one year from the date of issue.",
  fr: "Ouverture saisonnière : l’hôtel ferme chaque année de fin novembre à février ; le bon n’est pas valable durant cette période. La majorité est requise pour accéder aux piscines, à l’hôtel et au spa ; entrées soumises à disponibilité et réservation obligatoire. Le bon n’est pas utilisable dans les 48 heures suivant l’achat, n’est ni remboursable ni convertible en espèces ; les montants restants après la première utilisation ne sont pas transférables. En cas d’annulation, de modification ou de non-présentation (no-show), le bon n’est pas remboursable. Validité un an à compter de la date d’émission."
};

/* dalle voci scelte nel modulo di acquisto alla stessa descrizione, allo
   stesso totale e allo stesso elenco che comporrà il server (componiDescrizione
   e sommaVoci in supabase/functions/buoni/acquista.ts): prima fonde per
   voce_id le voci ripetute — scegliere due volte la stessa voce non è un
   errore, è una quantità, e il server le somma in una riga — poi compone
   "N × nome" quando la quantità supera uno, il nome soltanto quando è uno
   solo: "1 × Massaggio" è il modo in cui un modulo dice a un essere umano
   che l'ha compilato una macchina. Così l'anteprima nella pagina di acquisto
   dice esattamente quello che dirà il buono vero. Presidiato da buono.test.ts. */
export function riepilogoVoci(voci) {
  const mappa = new Map();
  for (const v of voci) {
    const precedente = mappa.get(v.voce_id);
    if (precedente) precedente.quantita += v.quantita;
    else mappa.set(v.voce_id, { ...v });
  }
  const raggruppate = [...mappa.values()];
  return {
    descrizione: raggruppate.map(v => v.quantita > 1 ? `${v.quantita} × ${v.nome}` : v.nome).join('\n'),
    valore: raggruppate.reduce((tot, v) => tot + v.prezzo * v.quantita, 0),
    voci: raggruppate.map(({ voce_id, quantita }) => ({ voce_id, quantita }))
  };
}

/* Le righe da mostrare nel dettaglio di un buono in back office: una per
   voce, con la quantità sempre in chiaro quando la sappiamo. La descrizione
   arriva già composta con la stessa regola di riepilogoVoci qui sopra —
   "N × nome", ma senza il numero quando è uno solo, perché sul buono che
   vede il cliente "1 × Massaggio" suonerebbe scritto da una macchina. In
   reception quell'ambiguità non serve: se `voci` combacia riga per riga con
   la descrizione (stesso numero di elementi), il numero si mostra sempre,
   tolto quello eventualmente già scritto nel testo per non vederlo due
   volte. Se `voci` manca, è vuoto o non combacia — buono monetario, buono
   creato a mano dal back office (voci è null, non [], vedi colonnaVoci in
   acquista.ts) o qualunque disallineamento imprevisto — si mostra la riga
   così com'è, senza inventare una quantità. */
export function righeDescrizione(descrizione, voci) {
  const righe = String(descrizione || '').split('\n').filter(Boolean);
  const combaciano = Array.isArray(voci) && voci.length === righe.length;
  return righe.map((testo, i) => combaciano
    ? { testo: testo.replace(/^\d+\s*×\s*/, ''), quantita: voci[i].quantita }
    : { testo, quantita: null });
}

export function buonoHTML(b, bozza) {
  const cat = categoriaBuono(b);
  const L = ['it','de','en','fr'].includes(b.lingua) ? b.lingua : 'it';
  const e = ETI[L];
  const n = (NARRATIVA[cat] || NARRATIVA.valore)[L] || (NARRATIVA[cat] || NARRATIVA.valore).it;
  const foto = COPERTINE[cat] || '';
  const catComprende = /day spa/i.test(String(b.descrizione || '')) ? 'dayspa' : cat;
  const comprende = (COMPRENDE[catComprende] || {})[L] || (COMPRENDE[catComprende] || {}).it || [];
  const dest = b.destinatario ? esc(b.destinatario) : '';
  const sotto = b.sottotitolo ? esc(b.sottotitolo) : '';
  const righeDescr = String(b.descrizione || '').split('\n').filter(Boolean);

  return `<table cellpadding="0" cellspacing="0" border="0" width="700" style="width:700px;max-width:100%;
  border-collapse:collapse;font-family:Georgia,'Times New Roman',serif;background:#FFFFFF;">
<tr>
  <!-- colonna sinistra -->
  <td width="270" valign="top" style="width:270px;background:#E4F0EA;padding:34px 26px;">
    <img src="${BASE_IMG}/logo.png" width="150" alt="Hotel Terme Leonardo"
      style="display:block;width:150px;height:auto;border:0;" />
    ${foto
      ? `<img src="${esc(foto)}" width="218" style="width:218px;display:block;margin:26px 0 8px;border-radius:2px;" alt="" />`
      : `<div style="height:150px;margin:26px 0 8px;border-radius:2px;
        background:linear-gradient(160deg,#BEDCD4,#8FC4BC 55%,#5FA8A0);"></div>`}
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:8.5px;letter-spacing:2px;color:#7A9490;">
      ${esc(n.occhiello)}</div>
    <div style="font-size:19px;line-height:1.35;color:#1B4D4A;font-style:italic;margin:26px 0 12px;">
      ${n.frase}</div>
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:11.5px;line-height:1.6;color:#5C736F;">
      ${esc(n.testo)}</div>
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:8.5px;letter-spacing:2px;color:#7A9490;padding-top:34px;">
      ABANO TERME \u00b7 COLLI EUGANEI</div>
  </td>

  <!-- colonna destra -->
  <td valign="top" style="padding:34px 30px;">
    <div style="width:34px;height:2px;background:#C9A961;margin-bottom:14px;"></div>
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:9.5px;letter-spacing:3px;color:#C9A961;">
      ${e.titolo.toUpperCase()}</div>
    <div style="font-size:25px;line-height:1.3;color:#1B4D4A;margin:12px 0 0;">
      ${dest ? e.haRicevuto(dest) : e.senzaNome}</div>
    ${b.dedica ? `<div style="font-size:13.5px;font-style:italic;color:#5C736F;margin-top:14px;line-height:1.5;">
      ${esc(b.dedica)}</div>` : ''}
    ${b.acquirente ? `<div style="font-family:Arial,Helvetica,sans-serif;font-size:9px;letter-spacing:2px;color:#9AA9A6;margin-top:20px;">
      ${e.da}</div>
    <div style="font-size:15px;font-style:italic;color:#1B4D4A;margin-top:4px;">${esc(b.acquirente)}</div>` : ''}

    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:26px;border-collapse:collapse;">
      <tr><td style="border-left:3px solid #C9A961;background:#FBFAF7;padding:18px 20px;">
        ${righeDescr.map((r, i) => `<div style="font-size:17px;color:#1B4D4A;${i ? 'margin-top:6px;' : ''}">${esc(r)}</div>`).join('')}
        ${sotto ? `<div style="font-family:Arial,Helvetica,sans-serif;font-size:9px;letter-spacing:2px;color:#C9A961;margin-top:7px;">
          ${sotto}</div>` : ''}
        ${comprende.length ? `<div style="margin-top:14px;">` + comprende.map(x =>
          `<div style="font-family:Arial,Helvetica,sans-serif;font-size:11.5px;line-height:1.7;color:#4A5C59;">
          <span style="color:#C9A961;">\u00b7</span> ${esc(x)}</div>`).join('') + `</div>` : ''}
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;line-height:1.6;color:#8A938F;margin-top:12px;border-top:1px solid #EFEBE0;padding-top:9px;">
          ${esc(e.nota)}</div>
      </td></tr>
    </table>

    ${bozza ? `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:26px;border-collapse:collapse;">
      <tr><td style="background:#FFF6E8;border:1px dashed #E8751A;border-radius:4px;padding:14px 18px;
        font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#6B4A22;text-align:center;">
        <strong style="letter-spacing:2px;">${e.anteprima}</strong><br />
        ${e.anteprimaNota}<br />
        Riferimento ${esc(b.numero || '')}
      </td></tr></table>` : ''}
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:34px;border-top:1px solid #E6E2D8;border-collapse:collapse;">
      <tr>
        <td valign="top" style="padding-top:14px;">
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:9px;letter-spacing:2px;color:#9AA9A6;">
            ${e.codice}</div>
          <div style="font-family:'Courier New',monospace;font-size:17px;letter-spacing:2px;color:${bozza ? '#C7C2B6' : '#1B4D4A'};margin-top:6px;">
            ${bozza ? '\u2014 \u2014 \u2014 \u2014 \u2014 \u2014 \u2014' : esc(b.codice)}</div>
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#C9A961;margin-top:6px;">
            ${b.scade_il ? e.valido(dataLingua(b.scade_il, L)) : e.valido('\u2014')}</div>
        </td>
        <td valign="top" align="right" style="padding-top:14px;font-family:Arial,Helvetica,sans-serif;
          font-size:11px;line-height:1.6;color:#5C736F;">
          <strong style="color:#1B4D4A;">+39 049 9939200</strong><br />
          info@termeleonardo.com<br />www.termeleonardo.com
        </td>
      </tr>
    </table>

    <div style="font-family:Arial,Helvetica,sans-serif;font-size:8px;line-height:1.55;color:#B3ADA1;padding-top:22px;">
      ${esc(CONDIZIONI[L] || CONDIZIONI.it)}</div>
  </td>
</tr>
</table>`;
}
