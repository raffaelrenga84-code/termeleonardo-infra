/* Il buono regalo: un solo modello per il back office e per la pagina
   pubblica di acquisto. Prima erano due funzioni diverse e quella pubblica
   era rimasta indietro — il cliente vedeva meno di quello che riceveva.

   Resta fuori la copia dentro email-buono.ts della funzione: l'email deve
   essere costruita a tabelle per Outlook e non puo' importare un modulo.
   Cambiando qui, controllare anche la'. Presidiato da buono.test.ts. */

export const esc = (s) => String(s ?? '').replace(/[&<>"]/g,
  c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));

/* percorso relativo, non '/comune/qr.js': un modulo si risolve contro
   l'URL DI QUESTO FILE (pagine/buoni/buono.js), non contro la barra degli
   indirizzi della pagina che lo importa — vale sia nel browser (buono.js è
   servito da /buoni/buono.js, quindi '../comune/qr.js' diventa
   /comune/qr.js) sia in Deno per i test (risolto contro il file su disco).
   percorsi-web.test.ts in pagine/prenota presidia i percorsi RELATIVI nelle
   pagine HTML (quelli sì dipendono dalla barra), non gli import fra moduli
   .js: qui la regola è opposta, un percorso assoluto sarebbe quello sbagliato. */
import { generaSvgQR } from '../comune/qr.js';

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
/* nota, in tutte e quattro le lingue qui sotto: dice che ogni ingresso o
   trattamento vale per una persona e come si prenota. Diceva anche che si
   poteva venire insieme o in momenti diversi "come preferite" \u2014 una
   promessa comoda da leggere ma scomoda da gestire in reception (riscossioni
   parziali, tenere il conto di quante volte un buono a pi\u00f9 voci \u00e8 gi\u00e0 stato
   usato): tolta su richiesta della propriet\u00e0. Vale per ogni lingua, non solo
   per quella che si sta modificando. Presidiata da buono.test.ts, che la
   confronta con la stessa nota in supabase/functions/buoni/email-buono.ts:
   deve restare identica l\u00ec e qui. */
/* prorogato: la riga di spiegazione della proroga, identica parola per
   parola a ETI.prorogato in supabase/functions/buoni/email-buono.ts \u2014
   presidiata dal confronto qui sotto in buono.test.ts. Non nomina mai un
   numero di mesi: la proroga sposta a una data usabile, non aggiunge mesi
   fissi, e quanti mesi siano dipende da quando si e' comprato. */
export const ETI = {
  it:{ titolo:'Buono Regalo', haRicevuto:(n)=>`${n}, hai ricevuto<br />un dono speciale`,
    senzaNome:'Un dono speciale<br />per te', da:'CON AFFETTO, DA', codice:'CODICE BUONO',
    valido:(d)=>`Valido fino al ${d}`, valore:(v)=>`valore ${v} &euro;`,
    prorogato:(n,x)=>`La validit\u00e0 sarebbe scaduta il ${n}, quando l\u2019hotel \u00e8 chiuso: l\u2019abbiamo prorogata fino al ${x}.`,
    anteprima:'ANTEPRIMA \u2014 NON ANCORA VALIDO',
    anteprimaNota:'Il codice viene assegnato al momento del pagamento.',
    nota:'Ogni ingresso o trattamento vale per una persona. Per prenotare basta chiamarci o scriverci: ci organizziamo insieme.' },
  de:{ titolo:'Geschenkgutschein', haRicevuto:(n)=>`${n}, Sie haben<br />ein besonderes Geschenk erhalten`,
    senzaNome:'Ein besonderes<br />Geschenk f\u00fcr Sie', da:'HERZLICHST, VON', codice:'GUTSCHEINCODE',
    valido:(d)=>`G\u00fcltig bis ${d}`, valore:(v)=>`Wert ${v} &euro;`,
    prorogato:(n,x)=>`Die G\u00fcltigkeit w\u00e4re am ${n} abgelaufen, w\u00e4hrend das Hotel geschlossen ist: Wir haben sie bis zum ${x} verl\u00e4ngert.`,
    anteprima:'VORSCHAU \u2014 NOCH NICHT G\u00dcLTIG',
    anteprimaNota:'Der Code wird bei Zahlungseingang vergeben.',
    nota:'Jeder Eintritt und jede Anwendung gilt f\u00fcr eine Person. F\u00fcr die Reservierung rufen Sie uns an oder schreiben Sie uns: wir organisieren alles gemeinsam.' },
  en:{ titolo:'Gift Voucher', haRicevuto:(n)=>`${n}, you have received<br />a special gift`,
    senzaNome:'A special gift<br />for you', da:'WITH LOVE, FROM', codice:'VOUCHER CODE',
    valido:(d)=>`Valid until ${d}`, valore:(v)=>`value ${v} &euro;`,
    prorogato:(n,x)=>`It would have expired on ${n}, while the hotel is closed: we have extended it to ${x}.`,
    anteprima:'PREVIEW \u2014 NOT YET VALID',
    anteprimaNota:'The code is assigned once payment is received.',
    nota:'Each admission or treatment is for one person. To book, just call or write to us: we will arrange everything together.' },
  fr:{ titolo:'Bon Cadeau', haRicevuto:(n)=>`${n}, vous avez re\u00e7u<br />un cadeau tr\u00e8s sp\u00e9cial`,
    senzaNome:'Un cadeau sp\u00e9cial<br />pour vous', da:'AVEC AFFECTION, DE', codice:'CODE DU BON',
    valido:(d)=>`Valable jusqu'au ${d}`, valore:(v)=>`valeur ${v} &euro;`,
    prorogato:(n,x)=>`La validit\u00e9 aurait expir\u00e9 le ${n}, alors que l\u2019h\u00f4tel est ferm\u00e9 : nous l\u2019avons prolong\u00e9e jusqu\u2019au ${x}.`,
    anteprima:'APER\u00c7U \u2014 PAS ENCORE VALABLE',
    anteprimaNota:'Le code est attribu\u00e9 au moment du paiement.',
    nota:'Chaque entr\u00e9e ou soin vaut pour une personne. Pour r\u00e9server, appelez-nous ou \u00e9crivez-nous : nous organisons tout ensemble.' }
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
  it: "Apertura stagionale: l’hotel chiude ogni anno da fine novembre a metà febbraio; il buono non è utilizzabile mentre l’hotel è chiuso. Se la scadenza cade in quel periodo la prolunghiamo noi fino a un mese dopo la riapertura, e la data prorogata è quella scritta sul buono. È richiesta la maggiore età per l’accesso a piscine, hotel e spa; ingressi soggetti a disponibilità e prenotazione obbligatoria. Il buono non è utilizzabile nelle prime 48 ore dall’acquisto, non è rimborsabile né convertibile in denaro; gli importi residui dopo il primo utilizzo non sono trasferibili. In caso di cancellazione, modifica o mancata presentazione (no show) il buono non è rimborsabile. Validità un anno dalla data di emissione, salvo la proroga indicata sopra.",
  de: "Saisonale Öffnung: das Hotel schließt jedes Jahr von Ende November bis Mitte Februar; während der Schließung ist der Gutschein nicht einlösbar. Fällt das Ablaufdatum in diesen Zeitraum, verlängern wir es bis einen Monat nach der Wiedereröffnung; das verlängerte Datum ist das auf dem Gutschein angegebene. Für den Zutritt zu Pools, Hotel und Spa ist Volljährigkeit erforderlich; Eintritte nach Verfügbarkeit, Reservierung erforderlich. Der Gutschein ist in den ersten 48 Stunden nach dem Kauf nicht einlösbar, nicht erstattungsfähig und nicht in Bargeld umtauschbar; Restbeträge nach der ersten Einlösung sind nicht übertragbar. Bei Stornierung, Änderung oder Nichterscheinen (No-Show) ist der Gutschein nicht erstattungsfähig. Gültigkeit ein Jahr ab Ausstellungsdatum, vorbehaltlich der oben genannten Verlängerung.",
  en: "Seasonal opening: the hotel closes every year from late November to mid-February; the voucher cannot be used while the hotel is closed. If the expiry date falls in that period we extend it to one month after reopening, and the extended date is the one shown on the voucher. Guests must be of legal age to access pools, hotel and spa; admission subject to availability, booking required. The voucher cannot be used within the first 48 hours of purchase, is not refundable and cannot be exchanged for cash; any remaining amount after the first use is not transferable. In case of cancellation, modification or no-show, the voucher is not refundable. Valid for one year from the date of issue, subject to the extension described above.",
  fr: "Ouverture saisonnière : l’hôtel ferme chaque année de fin novembre à mi-février ; le bon n’est pas utilisable pendant la fermeture. Si la date d’expiration tombe dans cette période, nous la prolongeons jusqu’à un mois après la réouverture, et la date prolongée est celle indiquée sur le bon. La majorité est requise pour accéder aux piscines, à l’hôtel et au spa ; entrées soumises à disponibilité et réservation obligatoire. Le bon n’est pas utilisable dans les 48 heures suivant l’achat, n’est ni remboursable ni convertible en espèces ; les montants restants après la première utilisation ne sont pas transférables. En cas d’annulation, de modification ou de non-présentation (no-show), le bon n’est pas remboursable. Validité un an à compter de la date d’émission, sous réserve de la prolongation indiquée ci-dessus."
};

/* dalle voci scelte nel modulo di acquisto alla stessa descrizione, allo
   stesso totale e allo stesso elenco che comporrà il server (componiDescrizione
   e sommaVoci in supabase/functions/buoni/acquista.ts): prima fonde per
   voce_id le voci ripetute — scegliere due volte la stessa voce non è un
   errore, è una quantità, e il server le somma in una riga — poi compone
   "N × nome". Il numero si tace solo quando la voce è una sola e la
   quantità è uno: "1 × Massaggio" è il modo in cui un modulo dice a un
   essere umano che l'ha compilato una macchina. Con più di una voce il
   numero si scrive su tutte, anche dove vale uno, o due righe — una col
   numero e una senza — si leggono come se la seconda avesse una quantità
   non specificata invece che pari a uno. Così l'anteprima nella pagina di
   acquisto dice esattamente quello che dirà il buono vero. Presidiato da
   buono.test.ts. */
export function riepilogoVoci(voci) {
  const mappa = new Map();
  for (const v of voci) {
    const precedente = mappa.get(v.voce_id);
    if (precedente) precedente.quantita += v.quantita;
    else mappa.set(v.voce_id, { ...v });
  }
  const raggruppate = [...mappa.values()];
  const mostraNumero = raggruppate.length > 1;
  return {
    descrizione: raggruppate.map(v => (mostraNumero || v.quantita > 1) ? `${v.quantita} × ${v.nome}` : v.nome).join('\n'),
    valore: raggruppate.reduce((tot, v) => tot + v.prezzo * v.quantita, 0),
    voci: raggruppate.map(({ voce_id, quantita }) => ({ voce_id, quantita }))
  };
}

/* Le righe da mostrare nel dettaglio di un buono in back office: una per
   voce, con la quantità in chiaro quando la voce è una sola e supera uno,
   oppure sempre quando le voci sono più di una. La descrizione arriva già
   composta con la stessa regola di riepilogoVoci qui sopra — "N × nome",
   col numero taciuto solo per una voce sola a quantità uno. Qui usiamo la
   STESSA soglia, non una diversa: il dettaglio del back office e
   l'anteprima del buono per il cliente stanno fianco a fianco sulla stessa
   schermata, e se scrivessimo "1 × Massaggio" sopra e "Massaggio" sotto (o
   viceversa fra due righe di uno stesso buono a più voci) le due viste si
   contraddirebbero proprio dove serve certezza. Se `voci` combacia riga per
   riga con la descrizione (stesso numero di elementi), il numero si mostra
   sempre quando le righe sono più di una, tolto quello eventualmente già
   scritto nel testo per non vederlo due volte. Se `voci` manca, è vuoto o
   non combacia — buono monetario, buono creato a mano dal back office
   (voci è null, non [], vedi colonnaVoci in acquista.ts) o qualunque
   disallineamento imprevisto — si mostra la riga così com'è, senza
   inventare una quantità. */
export function righeDescrizione(descrizione, voci) {
  const righe = String(descrizione || '').split('\n').filter(Boolean);
  const combaciano = Array.isArray(voci) && voci.length === righe.length;
  const mostraNumero = combaciano && righe.length > 1;
  return righe.map((testo, i) => combaciano
    ? { testo: testo.replace(/^\d+\s*×\s*/, ''), quantita: (mostraNumero || voci[i].quantita > 1) ? voci[i].quantita : null }
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
          ${b.prorogato && b.scade_il_base ? `<div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;color:#8A8A8A;margin-top:3px;line-height:1.45;">
            ${e.prorogato(dataLingua(b.scade_il_base, L), dataLingua(b.scade_il, L))}</div>` : ''}
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

/* ============================================================
   Stampa: il foglio A4 da piegare a metà (piegato = A5, come il depliant).
   Sopra la copertina, sotto l'interno.

   Viveva solo dentro pagine/buoni/index.html, la pagina del back office:
   "Stampa subito" la riempiva e chiamava window.print(). Ora la usa anche
   pagine/buoni/stampa/index.html, la pagina pubblica che il cliente apre dal
   pulsante «Stampa il tuo buono» nell'email — e tenerne due copie avrebbe
   rifatto lo stesso errore già pagato con buonoHTML più sopra: due rese
   dello stesso buono, una delle due prima o poi rimasta indietro. Una sola
   funzione, per entrambe le pagine.

   Lo stile del foglio (#stampa .foglio e tutto quel che c'è dentro, più
   @page) vive invece in stampa.css, caricato da entrambe le pagine con
   <link>: un foglio di stile si condivide con un <link>, un modulo con un
   import — stessa ragione, due strumenti diversi.

   IL QR (vicino al codice, dentro .codice-riga). In portineria c'è un
   lettore di codici 2D: si comporta come una tastiera, "digita" quello
   che legge nel campo che ha il fuoco e preme Invio (vedi vCod in
   pagine/buoni/index.html). Il QR contiene SOLO il codice del buono —
   la stringa "LEO-XXXX-XXXX", niente indirizzi web, niente altro — o il
   lettore digiterebbe un indirizzo dentro un campo che si aspetta un
   codice. Generato in pagine/comune/qr.js (nessuna libreria esterna, SVG
   vettoriale: nitido a ogni scala di stampa, non un'immagine caricata da
   fuori). Niente QR in bozza: senza codice vero non c'è niente di
   spendibile da far leggere. Livello di correzione d'errore 'Q' (25%
   circa) invece del default: il foglio si piega a metà e può stare in un
   portafoglio, quindi tollera meglio una piega o un angolo consumato — a
   parità di versione del QR, perché il codice è breve (13 caratteri) e
   ci sta comunque nella versione più piccola anche al livello più alto. */
const ETI_STAMPA = {
  it:{ prenota:'COME PRENOTARE', condizioni:'CONDIZIONI', piega:'piega qui', rif:'Riferimento',
    come:'Per prenotare ci chiami o ci scriva: fissiamo insieme il giorno e l’ora.' },
  de:{ prenota:'SO RESERVIEREN SIE', condizioni:'BEDINGUNGEN', piega:'hier falten', rif:'Referenz',
    come:'Rufen Sie uns an oder schreiben Sie uns: wir vereinbaren gemeinsam Tag und Uhrzeit.' },
  en:{ prenota:'HOW TO BOOK', condizioni:'TERMS', piega:'fold here', rif:'Reference',
    come:'To book, call or write to us: we will arrange the day and time together.' },
  fr:{ prenota:'COMMENT RÉSERVER', condizioni:'CONDITIONS', piega:'plier ici', rif:'Référence',
    come:'Pour réserver, appelez-nous ou écrivez-nous : nous fixerons ensemble le jour et l’heure.' }
};

export function buonoStampaHTML(b, bozza) {
  const cat = categoriaBuono(b);
  const L = ['it','de','en','fr'].includes(b.lingua) ? b.lingua : 'it';
  const e = ETI[L], s = ETI_STAMPA[L];
  const n = (NARRATIVA[cat] || NARRATIVA.valore)[L] || (NARRATIVA[cat] || NARRATIVA.valore).it;
  const foto = COPERTINE[cat] || '';
  const catComprende = /day spa/i.test(String(b.descrizione || '')) ? 'dayspa' : cat;
  const comprende = (COMPRENDE[catComprende] || {})[L] || (COMPRENDE[catComprende] || {}).it || [];
  const dest = b.destinatario ? esc(b.destinatario) : '';
  const righeDescr = String(b.descrizione || '').split('\n').filter(Boolean);

  return `<div class="foglio">
  ${bozza ? `<div class="bozza-avviso">BOZZA &middot; NON VALIDO &middot; il codice viene assegnato al pagamento</div>` : ''}
  <section class="meta copertina">
    <img class="marchio-s" src="/buoni/img/logo.svg" alt="Hotel Terme Leonardo" />
    ${foto ? `<img class="foto" src="${esc(foto)}" alt="" />` : `<div class="foto sfumata"></div>`}
    <div class="occhiello">${esc(n.occhiello)}</div>
    <div class="titolo-oro">${e.titolo.toUpperCase()}</div>
    <div class="dedicatario">${dest ? e.haRicevuto(dest) : e.senzaNome}</div>
    ${b.dedica ? `<div class="dedica">${esc(b.dedica)}</div>` : ''}
    ${b.acquirente ? `<div class="da">${e.da}</div>
      <div class="firma-s">${esc(b.acquirente)}</div>` : ''}
  </section>

  <div class="piega"><span>${s.piega}</span></div>

  <section class="meta interno">
    <div class="servizio">
      ${righeDescr.map(r => `<div class="servizio-nome">${esc(r)}</div>`).join('')}
      ${b.sottotitolo ? `<div class="servizio-sotto">${esc(b.sottotitolo)}</div>` : ''}
      ${comprende.length ? `<ul class="comprende">${comprende.map(x =>
        `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      <div class="nota-persone">${esc(e.nota)}</div>
    </div>
    <div class="codice-riga">
      <div>
        <div class="etichetta-s">${e.codice}</div>
        <div class="codice-s">${bozza ? '&mdash; &mdash; &mdash; &mdash; &mdash;' : esc(b.codice || '')}</div>
        <div class="scadenza">${e.valido(dataLingua(b.scade_il, L))}</div>
        ${b.prorogato && b.scade_il_base ? `<div class="scadenza-prorogata">${
          e.prorogato(dataLingua(b.scade_il_base, L), dataLingua(b.scade_il, L))}</div>` : ''}
      </div>
      ${!bozza && b.codice ? `<div class="qr-riquadro">${
        generaSvgQR(b.codice, { livello: 'Q', classe: 'qr-s' })}</div>` : ''}
      <div class="recapiti">+39 049 9939200<br />info@termeleonardo.com<br />www.termeleonardo.com</div>
    </div>
    <span class="etichetta-s cond-tit">${s.prenota}</span>
    <div class="prenota">${s.come}</div>
    <span class="etichetta-s cond-tit">${s.condizioni}</span>
    <div class="condizioni">${esc(CONDIZIONI[L] || CONDIZIONI.it)}</div>
  </section>
  <div class="pieded">TERME LEONARDO &middot; ${s.rif} ${esc(b.numero || '')}</div>
</div>`;
}
