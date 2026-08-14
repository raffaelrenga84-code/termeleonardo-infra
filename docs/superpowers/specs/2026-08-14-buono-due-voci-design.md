# Buono regalo con due voci e quantità

*14 agosto 2026*

## Il problema

Oggi un buono regalo porta **una sola voce**: o un trattamento, o un
ingresso, o un importo. Chi vuole regalare una giornata alle terme *con*
un massaggio deve comprare due buoni separati — due pagamenti, due email,
due fogli da stampare, e chi riceve non capisce che sono un regalo solo.

E non si possono regalare due ingressi a una coppia: la quantità non esiste.

## Cosa cambia

**Fino a due voci diverse, ognuna in quantità fino a quattro.**

Due voci e non di più per una ragione fisica: sul foglio del buono, sotto le
voci, c'è la descrizione di cosa comprendono. Con tre voci quel testo non ci
sta, e un buono che non spiega cosa dà è un buono che genera telefonate.

Quattro come quantità massima copre il caso vero — una famiglia, un gruppo di
amici — senza trasformare un regalo in un ordine all'ingrosso.

## Il prezzo: somma secca del listino

`45 € × 4 Day Spa festivi + 55 € × 4 massaggi antistress = 400 €`

Nessuno sconto per quantità. Il buono vale quello che valgono i servizi:
si spiega in una frase alla reception e torna in cassa senza calcoli.

I prezzi restano quelli del `LISTINO` sul server, che è già l'unica fonte:
la pagina propone, il server ricalcola, e se non coincidono vince il server.
Con le quantità questo conta di più, non di meno — moltiplicare è
esattamente il punto in cui un valore manipolato dal cliente farebbe danno.

## Sul buono stampato

```
4 × Day Spa festivo — piscine e grotte, sabato, domenica e festivi, 9.00–18.30
4 × Massaggio antistress (45 min)
```

Il numero davanti al nome: compatto, si legge di colpo, e lascia spazio alla
descrizione sotto.

**Quando la quantità è uno il numero non si scrive.** "1 × Massaggio
antistress" è il modo in cui un modulo dice a un essere umano che è stato
compilato da una macchina. Si scrive "Massaggio antistress", come oggi.

## La frase in fondo va adattata

Oggi dice, e va bene finché la voce è una sola:

> *Salvo diversa indicazione, ogni ingresso o trattamento vale per una
> persona. Ingressi e trattamenti su prenotazione: basta chiamarci o
> scriverci.*

Con le quantità quella frase risponde alla domanda sbagliata. Chi riceve
"4 × Day Spa festivo" si chiede se sono quattro persone in un giorno o una
persona per quattro volte — e la risposta è: **come preferisce**. È la cosa
che rende il regalo bello, e oggi non è scritta da nessuna parte.

Diventa:

> *Ogni ingresso o trattamento vale per una persona: potete venire insieme o
> in momenti diversi, come preferite. Su prenotazione: basta chiamarci o
> scriverci.*

Nelle quattro lingue. Il "salvo diversa indicazione" sparisce: era una
cautela che non indicava niente.

## Come è fatto dentro

Oggi la tabella `buono_regalo` ha `voce_id`, `descrizione`, `valore`: una
voce sola, e basta.

**La tabella è vuota — zero righe, verificato il 14 agosto 2026.** Non c'è
nessun buono già emesso da non rompere, quindi la struttura si cambia invece
di appiccicarci sopra una toppa. È una libertà che non ci sarà più fra un
mese: va usata adesso.

Si aggiunge una colonna `voci` di tipo jsonb:

```json
[{ "voce_id": "dayspa_wknd", "quantita": 4 },
 { "voce_id": "antistress45", "quantita": 4 }]
```

`descrizione` e `valore` restano e continuano a portare il testo composto e
il totale: email, stampa e back office leggono quelli e non hanno bisogno di
sapere come sono stati calcolati. Un buono monetario continua ad avere
`voci` vuoto, esattamente come oggi.

## Cosa NON cambia

Il buono monetario. Le condizioni di vendita. La scadenza. Il pagamento. Il
codice. La verifica in reception. Il riscatto.

Questo è un cambiamento su *cosa si può mettere dentro un buono*, non su come
il buono vive.

## I punti dove si sbaglia, e i presidi

**La quantità arriva dal cliente.** Come il prezzo: si valida sul server e i
limiti stanno lì, non nella pagina. Zero, negativo, frazionario, "4" come
testo, cinque, o duecento: tutti respinti prima di toccare il listino.

**Due voci uguali.** Chi sceglie due volte lo stesso trattamento sta dicendo
una quantità, non due voci: si sommano in una riga sola, e se la somma
supera quattro si respinge. Altrimenti si aggira il tetto scegliendo la
stessa voce due volte.

**Il testo che non ci sta.** Il limite di due voci esiste per lo spazio sul
foglio: va presidiato da un test che compone il buono più lungo possibile —
due voci con le descrizioni più lunghe del listino — e verifica che ci stia.
Senza, il limite è una buona intenzione.

**L'anteprima e il foglio devono dire la stessa cosa.** In questo progetto è
già successo che divergessero, e c'è un test che li confronta: va esteso alle
quantità, non aggirato.
