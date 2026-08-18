# Offerta Leonardo v2.5.0 — la pagina d'arrivo sa chi fa le cure

## Cosa cambia

Quando l'estensione crea il link **«Prepara il suo arrivo»**, adesso dice
anche se quel soggiorno comprende le **cure termali**.

Serve alla pagina d'arrivo per mostrare una domanda nuova solo a chi le cure
le fa davvero:

> **A che ora preferirebbe i fanghi?**
> ◯ Presto — dalle 5:50  ◯ Più tardi — verso le 10:00  ◯ Indifferente

A chi viene per due notti di relax quella domanda non compare: sarebbe
rumore.

## E' un desiderio, non un turno

Il ciclo fanghi ha sei turni al mattino, dalle 5:50 alle 10:30, e il turno lo
assegna la **Segreteria Cure dopo la visita medica di ammissione**. La pagina
lo scrive, e all'ospite risponde solo «abbiamo preso nota del suo desiderio»
— in tedesco *wir haben Ihren Wunschtermin vorgemerkt*, che e' la parola da
cui e' nata tutta questa sezione.

Niente calendario, niente orario confermato, nessuna disponibilita'
mostrata: qualunque cosa somigli a una prenotazione sarebbe una promessa che
il servizio non puo' mantenere.

Nell'email alla reception arriva una riga in piu':

    FANGHI · desiderio dell'ospite: presto — dalle 5:50 — il turno lo assegna
    la Segreteria Cure

## Da dove viene il dato

Dalla stessa regola che decide gia' se mettere il blocco «cure termali»
nell'email: `deduci(d).cure` — il trattamento contiene CURA/FANGO/TERMALE/
DOLCE VITA, oppure il soggiorno supera le cinque notti. Una seconda regola
qui divergerebbe dalla prima.

## Come si aggiorna

Sostituire la cartella e premere **Ricarica** in `edge://extensions/`. I
permessi non cambiano rispetto alla 2.4.
