# Come si scelgono i trattamenti sul modulo delle richieste

*15 agosto 2026 — decisioni prese con la proprietà*

## Il problema

Il modulo delle richieste offre **otto trattamenti** come caselle da spuntare,
senza prezzi, con un elenco scritto a mano dentro la pagina. Il reparto
benessere ne fa **trentatré**.

Mancano fra gli altri Shiatzu, Pindasweda, Body Candle, riflessologia
plantare, il linfodrenaggio, manicure e pedicure — e **tutti e cinque i
Programmi benessere**, che sono anche i più cari, da 90 a 130 €. Oggi un
ospite non può chiederli dal sito.

E i nomi non coincidono nemmeno per gli otto presenti: il modulo dice
*«Antistress (45–55 min)»*, il listino dice *«Massaggio antistress (45 min)»*.
La reception riceve una richiesta e deve indovinare a quale voce corrisponde.

C'è poi un problema che non è di completezza ma di tono, e la proprietà l'ha
posto così:

> *«Siamo sempre un hotel 4 stelle: non devono risultare moduli da compilare
> di un ufficio, devono saper trasmettere emozioni.»*

## Le decisioni

**Tutti e trentatré, con i prezzi.** Compresi manicure, pedicure ed
epilazione, che a listino hanno un prezzo «da».

**Il percorso guidato.** Prima si chiede *«cosa le farebbe piacere?»*, poi si
mostrano solo i trattamenti di quella famiglia — cinque o sei per volta invece
di trentatré.

Sono state guardate tre strade su un'anteprima cliccabile: l'elenco completo
come la carta di un ristorante, le famiglie come riquadri con pastiglie, e il
percorso guidato. La proprietà ha scelto il percorso.

Il motivo tiene anche tecnicamente: trentatré voci tutte insieme, su un
telefono, sono una lista della spesa. Il costo è un clic in più per chi sa già
cosa vuole.

**«I più richiesti» come prima strada**, segnata. E la classifica **non è
inventata**: è quella che la Knowledge Base del chatbot usa già quando un
ospite non sa scegliere — antistress, relax al cacao, Ayurveda, in quest'ordine.
Il sito dice così la stessa cosa che si dice al telefono.

**Una ⓘ accanto a ogni trattamento**, che apre una riga o due su cosa sia. Chi
legge «Pindasweda» non sa cosa sta comprando, e un prezzo accanto a una parola
che non si capisce non si sceglie.

## Le regole delle spiegazioni

**Descrivono cosa succede sul lettino, non cosa promettono di fare.** «Pietre
laviche calde appoggiate sulla schiena e fatte scorrere», non «scioglie le
tensioni profonde». Un trattamento estetico che promette effetti terapeutici è
una promessa che l'hotel non può mantenere, e fra benessere e curativo la
differenza non è solo di parole — la Knowledge Base la tratta già come una
distinzione da rispettare.

**Non tutti ce l'hanno.** Manicure, pedicure ed epilazione no: una ⓘ che dice
«la manicure è la cura delle mani» insegna al cliente che quelle icone non
servono, e allora non clicca quella del Pindasweda, dove servirebbe.

**Il bersaglio della ⓘ è di trenta pixel**, anche se ne mostra quattordici.
Un'icona piccola su un telefono è un pulsante che non si riesce a premere.

**Le spiegazioni vanno lette dal reparto benessere prima di andare online.**
Sono state scritte descrivendo la tecnica in generale, non come la fa questo
hotel. Se una è imprecisa, l'ospite arriva con un'aspettativa sbagliata e la
delusione se la prende con l'operatrice.

## L'unica fonte, e perché non è quella dei buoni

Le voci **non** si copiano di nuovo dentro la pagina: sarebbe un terzo elenco
che diverge dagli altri due entro un mese. Questo progetto ha già pagato questo
difetto coi prezzi dei buoni, e per quello esiste `listino-copie.test.ts`.

Ma attenzione: **il listino dei buoni regalo non è la fonte giusta.** Contiene
21 voci — quelle *regalabili* — mentre il reparto ne fa 33. Mancano fra le
altre manicure, pedicure, epilazione, il linfodrenaggio e l'antistress da 55
minuti.

Serve quindi **un elenco maestro unico** con, per ogni voce: nome, durata,
prezzo, gruppo, e un contrassegno **regalabile**. Il catalogo dei buoni prende
le regalabili; il modulo delle richieste le prende tutte. Il test che confronta
le copie va esteso a quell'elenco.

## L'anteprima

`docs/anteprime/2026-08-15-menu-trattamenti.html` — apribile in un browser,
cliccabile, coi dati veri. Serve a decidere, non è codice di produzione.

## Cosa NON cambia

Il resto del modulo: contatti, giorno, fascia oraria, note. La validazione sul
server (`richieste/tipi.ts`) accetta già fino a otto voci come testo libero:
non serve toccarla per cambiare come si scelgono.
