# Scadenza dei buoni: promemoria e chiusura stagionale

*14 agosto 2026 — decisioni prese con la proprietà*

## Il problema

Un buono vale **un anno esatto** dall'acquisto (`acquista.ts:97`,
`scade.setFullYear(+1)`). L'hotel chiude **da fine novembre a metà
febbraio**. Un buono che scade dentro quella finestra è un buono che il
cliente **non può usare**: non per una regola, ma perché l'albergo è chiuso.

E oggi nessuno lo avvisa che sta per scadere.

## Perché "+2 mesi" non basta

Era la prima idea, ed è sbagliata proprio dove serve. Con la riapertura a
metà febbraio:

| Scadenza | +2 mesi | Esito |
|---|---|---|
| 30 novembre | 30 gennaio | **ancora chiuso** |
| 15 dicembre | 15 febbraio | il giorno della riapertura, nessun margine per prenotare |
| 15 gennaio | 15 marzo | va bene |

Una proroga che lascia il cliente davanti a un albergo chiuso è peggio di
nessuna proroga, perché gliel'avete promessa.

## La regola

**Se la scadenza cade nella chiusura, si sposta al 15 marzo dello stesso
anno di riapertura.** Un mese dopo la riapertura: il tempo di ricevere
l'avviso, telefonare e trovare posto.

Non si aggiungono mesi: si sposta a una data che è certamente utilizzabile.
Il calcolo non dipende da quanto manca alla scadenza, quindi dà lo stesso
risultato per tutti — e due clienti che comprano a un giorno di distanza non
si ritrovano con proroghe diverse.

## Quando si applica: all'emissione

**Il buono nasce già con la data giusta.** Non si proroga al momento del
promemoria.

Il motivo è pratico: se il foglio che il cliente ha in mano dice 30 novembre
e un'email dice 15 marzo, lui crede al foglio — è il documento, l'email è un
messaggio. Due date in giro per la stessa cosa sono un reclamo che aspetta.

Conseguenza: i **buoni già emessi** con una scadenza dentro la chiusura vanno
sistemati a parte, una volta sola, e ai loro intestatari va detto — non
scoperto per caso.

## Il promemoria

**Trenta giorni prima della scadenza, a chi ha il buono in mano:** al
destinatario se il suo indirizzo c'è, altrimenti a chi l'ha comprato.

Non a entrambi: chi ha regalato ha già fatto la sua parte, e ricevere un
sollecito per un regalo fatto mesi prima è più fastidio che servizio.

Una volta sola, non due. Un promemoria è un favore, due sono una pressione.

L'email dice quanto vale ancora il buono, entro quando, e come si prenota.
Nelle quattro lingue, con la lingua del buono.

**Va mandato una volta sola per buono**: serve traccia dell'invio, altrimenti
un lavoro che gira ogni giorno lo rimanda ogni giorno.

**Non si manda** per i buoni già usati per intero, annullati o già scaduti.

## Il testo delle condizioni va chiarito

Oggi dice, in quattro lingue: *"l'hotel chiude ogni anno da fine novembre a
febbraio"*. Con la riapertura a metà febbraio quella frase si può leggere in
due modi opposti — chiuso *per tutto* febbraio, o chiuso *fino a* febbraio.

Va resa non ambigua, e va detto che se la scadenza cade nella chiusura il
buono viene prorogato: è una cosa a favore del cliente, e scriverla evita
la telefonata di chi teme di perdere il regalo.

## Cosa serve costruire

1. **La regola della scadenza** in `acquista.ts`, come funzione pura
   collaudabile: date dentro la chiusura, ai bordi, e la stessa data in anni
   diversi devono dare il risultato atteso.
2. **Il lavoro programmato** che ogni giorno cerca i buoni in scadenza fra
   trenta giorni e non ancora avvisati.
3. **L'email del promemoria** nelle quattro lingue, col mittente del dominio
   verificato.
4. **La traccia dell'invio** sul buono, così non si ripete.
5. **La correzione una tantum** dei buoni già emessi con scadenza nella
   chiusura.
6. **Il testo delle condizioni** chiarito nelle quattro lingue.

## Cosa resta da sapere

**Le date esatte della chiusura.** "Fine novembre" e "metà febbraio" non
bastano per calcolare: servono due giorni precisi. E se cambiano di stagione
in stagione, non possono stare scritte nel codice — serve un posto dove la
reception le aggiorna, e il calcolo le legge da lì.

Finché non ci sono, la regola non si può scrivere senza inventare.
