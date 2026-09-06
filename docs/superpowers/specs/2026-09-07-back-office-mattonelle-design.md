# Back office a mattonelle — specifica (7 settembre 2026)

## Perché

«Il back office sta diventando affollato: ordinarlo, renderlo semplice, intuitivo e mobile friendly» (la proprietà, 6 settembre 2026). Diciotto schede in quattro famiglie, tutte a tabelle larghe; sul telefono, che è dove soffre di più (risposta D), le tabelle escono dallo schermo e i tasti sono piccoli. Scelta la strada B: una schermata iniziale a mattonelle, ogni funzione una pagina intera con «indietro», schede al posto delle tabelle sul telefono, un file solo.

## Cosa si costruisce

1. **La schermata iniziale («home»)**: mattonelle grandi, poche, con icona e nome, raggruppate per famiglia (Buoni, Ospiti, Day Spa, POS). Le mattonelle sono le schede che quell'account vede (`schedeDi(EMAIL)`, nel suo ordine): le famiglie compaiono nell'ordine in cui compare la loro prima scheda per quel ruolo. La prima scheda del ruolo (`schedaIniziale`) è la mattonella principale, più grande. La mattonella «Richieste» porta il numero delle richieste da guardare, come oggi il pulsante.
2. **Ogni funzione è una pagina intera**: in alto una barra con «‹ Home», l'icona e il titolo; sul PC anche le schede sorelle della stessa famiglia come pillole, per passare senza tornare alla home; sul telefono la barra resta fissa in alto e le pillole spariscono.
3. **Indirizzo e tasto indietro del browser**: la pagina aperta sta nell'hash (`#posMenu`); il tasto indietro del telefono torna alla home o alla pagina precedente; ricaricando si resta dove si era. `?scheda=…&sportello=1` (il tablet dello sportello) continua a funzionare come oggi.
4. **Sul telefono (≤ 700 px)**: le tabelle con intestazione diventano schede impilate, una per riga, con l'etichetta accanto a ogni valore (le etichette le copia un osservatore dalle intestazioni, così vale per tutte le viste di oggi e di domani, senza toccarle una per una); i tasti d'azione principali (`button.azione` non secondari) restano appiccicati in fondo, a portata di pollice; i campi hanno 16 px (niente zoom di iOS); i riquadri e la testata sono più stretti. Sul PC le tabelle restano tabelle.
5. **Niente altro cambia**: le viste, le chiamate al server, i ruoli e le schede nascoste (`SCHEDE_NASCOSTE`, `ORDINE_SCHEDE`, `puoDalBackOffice` nel server) sono quelli di oggi.

## Come

- `VISTA` può valere `'home'`; `disegna()` la disegna prima di consultare la mappa delle viste (la mappa non cambia: `home` non è una scheda).
- `apri(vista)` cambia `VISTA`, scrive l'hash e ridisegna; `popstate` legge l'hash. All'accesso si entra sulla home, salvo `?scheda=`.
- `aggiornaContatore()` scrive il numero su ogni elemento `[data-scheda="richieste"]` (mattonella e pillola).
- `tabelleInSchede(radice)`: a ogni tabella con una riga di intestazione (`th`, almeno due colonne) mette la classe `aSchede` e copia il testo dell'intestazione in `data-eti` su ogni cella; lo lancia un `MutationObserver` su `#app`. Il CSS a 700 px fa il resto; le righe `[hidden]` restano nascoste.
- Le icone stanno in una tabella `ICONE` con una voce per ogni scheda di `SCHEDE`; una prova lo garantisce.

## Prove

- Ogni scheda di `SCHEDE` ha un'icona; `home` non è in `SCHEDE`; all'accesso `VISTA` è `home` (salvo `?scheda=`).
- Il sorgente contiene `apri(`, `popstate`, la barra con «Home», le mattonelle con `data-scheda`, l'osservatore e le regole a 700 px (schede, tasti appiccicati, 16 px).
- Le prove esistenti su schede, famiglie, ordine per ruolo e contatore restano verdi.
