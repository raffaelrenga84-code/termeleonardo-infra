# Gli ordini dal QR dopo il pagamento: vederli, rimborsarli, ristamparli

Approvato dalla proprietà il 5 settembre 2026 («vai» sui tre punti proposti,
più il riordino del back office).

## Perché

Oggi un ordine dal QR, pagato o addebitato in camera, diventa un conto del
cameriere fittizio «ospiti-qr», stampa la comanda e si chiude nello stesso
istante. Il palmare lo mostra per venti minuti in una striscia in cima alla
sala; il back office non ha un elenco; un rimborso si fa solo dal pannello
Stripe. Casi che capiteranno: tavolo sbagliato, piatto finito dopo il
pagamento, ordine doppio, modifica chiesta dopo, cliente che se ne va,
stampante spenta, contestazione con la banca mesi dopo.

## Cosa cambia

### 1. La tabella dell'ordine ricorda cosa è successo

`pos_ordine_ospite` prende `rimborsato_cent` (default 0), `rimborso_stripe`
(l'ultimo id del rimborso), `nota` (testo libero della reception),
`annullato_il`/`annullato_da`; lo stato ammette anche `rimborsato` (tutto
restituito). Migrazione `supabase/2026-09-05-pos-ordini-qr.sql`. Solo nel
cloud: il PC del Bistrot non tiene gli ordini dal QR.

### 2. Il back office: scheda «POS · Ordini dal QR»

Un giorno alla volta (oggi per primo). Per ogni ordine: numero, ora, tavolo
o camera, le righe con le note, come ha pagato, stato, quanto è stato
rimborsato, la nota. Pulsanti:

- **Rimborsa** (carta): tutto o una parte, in euro; va a Stripe con
  `POST /v1/refunds` e il `payment_intent` dell'ordine, come già fanno i
  buoni. Scrive `rimborsato_cent`, `rimborso_stripe`; a rimborso pieno lo
  stato diventa `rimborsato`. Un rimborso non può superare quel che resta.
- **Annulla l'addebito** (camera): se l'addebito è ancora `da_riportare`
  diventa `annullato` e l'ordine `annullato`; se è già `riportato` in
  Fidra il server risponde 409: si corregge là.
- **Ristampa la comanda**: le righe del conto escono di nuovo, per portata,
  con in cima «>>> RISTAMPA» (il campo `avviso` del biglietto).
- **Nota**: si salva com'è, sostituisce la precedente.

Azioni del server, nel gruppo del back office (reception e
amministrazione): `ospite-ordini` (GET, `giorno=`), `ospite-rimborsa`,
`ospite-annulla-addebito`, `ospite-ristampa`, `ospite-nota` (POST).
La «Giornata» mostra una riga «Rimborsi dal QR» con la somma di
`rimborsato_cent` degli ordini del giorno.

### 3. Il palmare: l'ordine resta sul tavolo

La `sala` manda, per ogni tavolo, gli ordini dal QR di oggi (`qr`: numero,
totale, modo, camera, righe, minuti). Nella schermata del tavolo compaiono
sotto i conti aperti con l'etichetta «📱 pagato» (o «📱 in camera»). Toccando
uno si apre un pannello con le righe e tre pulsanti:

- **Ristampa** (`conto-ristampa`, chiunque possa fare comande);
- **Sposta al tavolo…** (`conto-sposta`: un conto solo, anche chiuso, su un
  altro tavolo dello stesso locale; sposta anche l'ordine);
- **Storna e rimborsa** su una riga, solo capo sala e amministrazione
  (`riga-storna-rimborsa`): la riga va `stornata` con motivo, esce il
  biglietto STORNO, e l'importo della riga torna al cliente — con Stripe
  se ha pagato con la carta, togliendolo dall'addebito se era in camera
  (se l'addebito è già riportato in Fidra: 409).

Il conto per gli extra è quello di sempre («+ Esterno» / «+ Camera»).
Queste azioni vivono solo nel cloud (`chiama(..., { cloud: true })`): dal
PC del Bistrot rispondono 503 come le altre che scrivono su Stripe o Fidra.

### 4. L'avviso della stampante

La `sala` manda `coda_stampa: { n, minuti }` (i biglietti `da_stampare` del
locale e da quanti minuti aspetta il più vecchio). Sopra i due minuti il
palmare mostra una fascia rossa: «🖨️ 3 biglietti fermi da 5′: stampante
spenta?». Sparisce da sola quando la coda si svuota.

### 5. Il back office si riordina

Le schede sono sedici in fila. Si raggruppano in quattro famiglie, una
barra sopra e le schede della famiglia sotto: **Buoni** (emetti, emessi,
verifica), **Ospiti** (richieste, arrivi, privacy), **Day Spa** (oggi,
disponibilità, prenotazioni), **POS** (ordini dal QR, addebiti, giornata,
menù, tavoli, personale, fasce). L'ordine per indirizzo (reception, spa) e
le schede nascoste restano come sono; la famiglia aperta si ricorda
nell'indirizzo (`?scheda=`) come oggi.

## Regole pure, provate a parte

`supabase/functions/pos/rimborsi.ts`: quanto si può ancora rimborsare,
l'importo di una riga, lo stato dopo un rimborso, il corpo della chiamata
a Stripe. `orari.ts` e `comanda.ts` non cambiano, salvo `avviso` che il
biglietto ha già.

## Prove

- `rimborsi.test.ts` (puro); contratto su index.ts per le azioni nuove, la
  `sala` con `qr` e `coda_stampa`, `creaStampe` con l'avviso;
  `pagine/pos/pagina.test.ts` per il pannello e la fascia rossa;
  `pagine/buoni/pos-schede.test.ts` per la scheda e le famiglie;
  `scheda-iniziale.test.ts` per l'ordine delle schede.
