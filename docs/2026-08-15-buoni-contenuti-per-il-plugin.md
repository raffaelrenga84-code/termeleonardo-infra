<title>Contenuti Modello Buoni Regalo</title>

# Buoni regalo: i contenuti per il modello

*Per chi costruisce il modello nel plugin, sulla struttura dell'Info Day Spa.*
*Estratti dal codice che li applica davvero — 15 agosto 2026.*

> **Da dove vengono questi numeri.** Non dalla pagina del sito e non a
> memoria: dal `LISTINO` in `supabase/functions/buoni/acquista.ts`, che è la
> tabella con cui il server calcola il prezzo quando qualcuno compra. Se
> divergono, vince quella — ed è il motivo per cui vale la pena copiarla da
> lì e non da una schermata.

---

## La cosa da dire per prima

**I buoni regalo si comprano online**, su termeleonardo.com, sezione Buoni
Regalo. Si paga con carta e il buono **arriva per email in pochi minuti**,
pronto da stampare o da inoltrare a chi lo riceve.

Chi scrive per un buono regalo di solito lo vuole *adesso* — è un regalo, e
spesso all'ultimo. Mandarlo a chiamare la reception gli fa perdere un giorno.

---

## Cosa si può regalare

Il buono si compone: fino a **due voci diverse**, ognuna in quantità fino a
**quattro**. Oppure un **importo libero da 25 a 1000 €**, spendibile in hotel.

### Ingressi Day Spa

| | |
|---|---|
| Infrasettimanale — piscine e grotte, lun–ven 9.00–18.30 | **35 €** |
| Festivo — sabato, domenica e festivi 9.00–18.30 | **45 €** |
| Serale — venerdì e sabato 18.00–22.30 | **29 €** |

### Programmi benessere — più trattamenti in una volta

| | |
|---|---|
| Coccola — pulizia viso completa + manicure | **90 €** |
| Viso Antirughe — pulizia completa + collagene | **90 €** |
| Viso Termale — pulizia + trattamento termale | **95 €** |
| Antistress — scrub Mar Morto + massaggio + viso al fango | **130 €** |
| Oriente — Ayurveda + viso alla vitamina C | **130 €** |

### Massaggi

| | |
|---|---|
| Relax (con olio di cacao), 25 min | **40 €** |
| Riflessologia plantare, 25 min | **40 €** |
| Body Candle, 25 min | **48 €** |
| Antistress, 45 min | **55 €** |
| Ayurveda, 55 min | **65 €** |
| Hot Stone, 55 min | **65 €** |
| Pindasweda, 55 min | **65 €** |
| Linfodrenaggio completo, 60 min | **65 €** |
| Shiatsu, 50 min | **70 €** |

### Viso e corpo

| | |
|---|---|
| Viso al fango termale con massaggio, 25 min | **44 €** |
| Scrub corpo ai sali del Mar Morto, 40 min | **55 €** |
| Pulizia viso completa con peeling e maschera, 55 min | **60 €** |
| Riducente-anticellulite al fango, 55 min | **70 €** |
| Anti-age all'acido ialuronico, 55 min | **80 €** |
| Anti-age collagene naturale, 55 min | **80 €** |

**Ventitré voci in tutto.** Il massaggio californiano non c'è più: è stato
tolto dal listino il 15 agosto 2026. Se compare in un testo vecchio, va tolto.

---

## Il serale si regala, ma non si abbina

**Il Day Spa serale si può regalare** — costa 29 € ed è una voce come le
altre.

**Ma non si può mettere nello stesso buono insieme a un trattamento**, e il
sito lo rifiuta: di sera il centro benessere non fa trattamenti, quindi quel
buono non sarebbe utilizzabile in una volta sola.

Chi vuole regalare tutti e due prende il Day Spa **infrasettimanale o
festivo** più il trattamento. Vale la pena scriverlo nel modello: è la
domanda che arriva, e la risposta sbagliata fa comporre un buono che viene
respinto al momento di pagare.

---

## Validità

**Dodici mesi** dalla data di emissione.

**Se la scadenza cadesse durante la chiusura invernale, la prolunghiamo noi**
fino a un mese dopo la riapertura — e **la data prorogata è quella scritta
sul buono**. Non c'è niente da chiedere e niente da negoziare: sul foglio si
leggono tutte e due le date, con la spiegazione.

**Trenta giorni prima della scadenza mandiamo un promemoria** a chi ha il
buono in mano. Una volta sola.

*(L'hotel chiude ogni anno da fine novembre a metà febbraio, e durante la
chiusura il buono non è utilizzabile — per questo esiste la proroga.)*

---

## Come si acquista

Online, su **termeleonardo.com → Buoni Regalo**. Carta di credito, e il buono
arriva per email in pochi minuti.

La **fattura** si può chiedere **al momento dell'acquisto**, come privato o
come azienda. Vale la pena dirlo: le aziende comprano buoni per il welfare
aziendale e senza fattura non possono. Se nell'email si legge «azienda»,
«welfare» o «dipendenti», la riga sulla fattura va messa.

---

## Come si riscuote

Il buono porta un **codice** e un **QR** che la reception legge col lettore.
Chi lo riceve può ristamparlo da solo dal link nella sua email, senza
stampare tutta la posta.

**Ingressi e trattamenti sempre su prenotazione**, soggetti a disponibilità.

Le condizioni, come sono scritte sul buono:

- non utilizzabile nelle **prime 48 ore** dall'acquisto;
- **non rimborsabile né convertibile in denaro**;
- gli **importi residui** dopo il primo utilizzo **non sono trasferibili**;
- in caso di cancellazione, modifica o mancata presentazione **non è
  rimborsabile**;
- **maggiore età** richiesta per l'accesso a piscine, hotel e spa;
- ogni ingresso o trattamento vale **per una persona**.

---

## Il pulsante

Nel plugin è già tutto pronto e non usato:

```js
MODULI.buoni        → https://www.hoteltermeleonardo.com/it/buoni-regalo
TESTI_MODULI.buoni  → «Regala un buono» · «Gutschein verschenken»
                      «Give a gift voucher» · «Offrir un bon cadeau»
bottoneServizio('buoni', d, lingua)
```

Basta chiamarlo. Gli indirizzi tradotti esistono e sono stati verificati uno
per uno: `/de/gutscheine`, `/en/gift-vouchers`, `/fr/cheques-cadeaux`.

**Meglio puntare all'indirizzo della lingua** invece di aggiungere `lang=de`
all'indirizzo italiano: l'ospite tedesco atterra su una pagina tedesca invece
di vedere per un attimo quella italiana.

---

## Cosa il modello NON deve dire

**Che i buoni si gestiscono al telefono.** Fino a poche ore fa lo diceva
anche la base di conoscenza dell'assistente: è falso da mesi. Al telefono si
gestiscono solo i buoni **già emessi** — ricerca, riscatto, problemi.

**I tre pacchetti fissi** («Ingresso Day Spa da 35 €», «Spa & Massaggio Relax
da 75 €», «Giornata Benessere Deluxe da 90 €»). Non esistono più: il buono si
compone liberamente. Se compaiono in un testo vecchio, vanno tolti.

**Il massaggio californiano**, per la stessa ragione.

**Che il buono «vale un anno» e basta.** Vale un anno *salvo la proroga*, e
la proroga è il pezzo che evita la telefonata arrabbiata di chi si accorge
che la scadenza cadeva mentre eravamo chiusi.

---

## Una cosa da far sistemare, non da mettere nel modello

Nel listino del server ci sono **due voci identiche** per il Day Spa serale
(`dayspa_sera` e `dayspa_pom`), stessa descrizione e stesso prezzo. La
seconda non è offerta in nessuno dei due cataloghi, quindi nessuno può
sceglierla — è un residuo. Non fa danni, ma è il tipo di doppione che un
giorno qualcuno «sistema» facendone comparire due nell'elenco.
