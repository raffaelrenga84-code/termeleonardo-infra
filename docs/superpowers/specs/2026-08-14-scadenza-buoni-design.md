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

*(Verificato il 15 agosto 2026: la tabella `buono_regalo` ha **zero righe**.
Non c'è niente da correggere, quindi la correzione una tantum non si
costruisce. Va però ricontato il giorno della pubblicazione: se nel
frattempo qualcuno ha comprato, quel buono si sistema a mano — è uno.)*

## La proroga si deve vedere

Se il buono nasce già col 13 marzo stampato sopra e basta, il cliente non
sa che gli è stato fatto un favore: vede solo una data, e non ha modo di
capire che è più lunga di quella che gli spettava. Un regalo che non si
vede non è un regalo.

Sul foglio e nell'email si scrivono **tutte e due**:

> **Valido fino al 13 marzo 2027**
> La validità sarebbe scaduta il 30 novembre 2026, quando l'hotel è chiuso:
> l'abbiamo prorogata fino al 13 marzo 2027, un mese dopo la riapertura.

La data grande è quella che vale — una sola, quella operativa, così alla
reception non c'è mai dubbio su quale leggere. La riga sotto spiega da dove
viene.

**Solo quando c'è stata una proroga.** Un buono che scade a giugno mostra
la sua data e nient'altro: una spiegazione che non spiega niente è rumore.

Serve quindi tenere anche la **scadenza naturale** dei dodici mesi, accanto
a quella valida: senza, la frase non si può scrivere, e ricalcolarla dopo
darebbe una data diversa se il regolamento cambia.

*(Il numero di mesi non si scrive mai — né "due mesi" né "tre e mezzo".
La proroga non aggiunge mesi: sposta a una data utilizzabile, e quanti mesi
siano dipende da quando si è comprato. Scrivere un numero vorrebbe dire
scriverne uno diverso per ogni cliente, e sbagliarne qualcuno.)*

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

1. **La regola della scadenza** come funzione pura collaudabile: date dentro
   la chiusura, ai bordi, e la stessa data in anni diversi devono dare il
   risultato atteso. Restituisce **due** date — quella valida e quella
   naturale — più il fatto che ci sia stata una proroga.
2. **La proroga scritta** sul foglio, nell'email e nell'anteprima, nelle
   quattro lingue, e solo quando c'è stata.
3. **Il lavoro programmato** che ogni giorno cerca i buoni in scadenza fra
   trenta giorni e non ancora avvisati.
4. **L'email del promemoria** nelle quattro lingue, col mittente del dominio
   verificato.
5. **La traccia dell'invio** sul buono, così non si ripete.
6. **Il testo delle condizioni** chiarito nelle quattro lingue.

*(La correzione una tantum dei buoni già emessi non si costruisce: non ce
n'è nessuno. Vedi sopra.)*

## Le date della chiusura, e perché non vanno nel codice

**Stagione 2026/2027, dalla proprietà il 14 agosto 2026:**

| | |
|---|---|
| Chiusura | **29 novembre 2026** |
| Riapertura | **13 febbraio 2027** |

**E cambiano ogni anno.** Questo decide l'impianto: le date non possono
stare scritte nel codice, altrimenti ogni stagione serve un intervento di
programmazione per una cosa che sa la reception. Vanno in una tabella che il
back office modifica, con una riga per stagione.

Il calcolo le legge da lì. Se per una stagione mancano, **non si prorogano
buoni a caso**: si emette la scadenza normale e si avvisa che le date della
stagione non sono state inserite. Meglio un promemoria mancato che una
proroga inventata su date sbagliate.

Con le date di quest'anno, la regola dà: scadenza fra il 29 novembre 2026 e
il 13 febbraio 2027 → spostata al **13 marzo 2027**, un mese dopo la
riapertura.

*(Il 15 marzo indicato prima era una data fissa scelta quando la riapertura
era approssimata a "metà febbraio". Con la data vera si calcola: riapertura
più un mese.)*
