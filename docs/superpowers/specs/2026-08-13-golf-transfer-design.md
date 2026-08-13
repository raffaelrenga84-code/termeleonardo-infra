# Golf e transfer — progetto

**Obiettivo.** Una sola richiesta dell'ospite che alimenta due prenotazioni
fatte dalla reception: il green fee su OpenGolf o Chronogolf, e il taxi su
ATAM. Oggi l'ospite deve chiedere due volte la stessa cosa, o telefonare.

**Perché insieme.** Chi va a giocare deve arrivarci. Nella lista destinazioni
di ATAM i tre circoli ci sono già — `Golf Frassanelle`, `Golf Montecchia`,
`Golf Valsanzibio` — quindi la scelta del campo *è* la destinazione del
taxi. Tenerli separati farebbe ridigitare all'ospite dati che ha già dato.

---

## Cosa esiste già

**ATAM** (rilevato in sola lettura il 13 agosto 2026, vedi
[atam-campi.md](../../atam-campi.md)): modulo con data, ora, pax, individuale
o collettivo, arrivo o partenza, luogo da un elenco chiuso di 189 voci,
pagamento (`D` diretto, `H` hotel, `F` fattura), numero di camera, nome del
cliente, dettagli arrivo, note, allegato.

**OpenGolf** (`opengolf.it/it/tee-times`): si sceglie data e **percorso**,
e il sistema mostra le partenze disponibili con le disponibilità di
Golfcar, Carrello, Carrello elettrico e Sacca. **Chronogolf**
(`chronogolf.it`) è il secondo portale.

**`arrivo_richiesta`** ha già i campi del transfer — `transfer_tipo`,
`transfer_scalo`, `transfer_volo`, `transfer_quando`, `transfer_pax`,
`transfer_cell` — e i campi per la fattura: `fatt_ragione`, `fatt_piva`,
`fatt_cf`, `fatt_sdi`, `fatt_pec`. Le colonne nuove seguono questi nomi.

**La funzione `richieste`** ha già autenticazione, tetto anti-abuso,
numerazione ed email con marchio. Le richieste golf passano di lì con un
tipo diverso, invece di aggiungere una terza funzione.

### I tre circoli

| Circolo | Dove | Buche | Telefono | Chiusure |
|---|---|---|---|---|
| Golf Club Padova | Via Noiera 57, Valsanzibio di Galzignano | 27 (9216 m) | 049 9130078 | lunedì in bassa stagione; stagione feb–dic |
| Golf della Montecchia | Via Montecchia 12, Selvazzano Dentro | 27, par 72 | 049 8055550 | lunedì in lug, ago e nov–feb; 8.30–17.30 |
| Golf Frassanelle | Via Rialto 5/a, Rovolon | 18 | 049 9910722 | — |

Tutti e tre noleggiano golf car, carrelli e sacche. **Nessuno pubblica i
prezzi**: il modulo non ne mostra, li conferma la reception.

---

## La regola che regge tutto

**È una richiesta, non una prenotazione.** Non abbiamo accesso automatico a
OpenGolf né a Chronogolf: la partenza la prende una persona, a mano, dopo.
La pagina deve dirlo con parole semplici — un ospite che crede di avere una
partenza confermata e si presenta al circolo senza, è un danno peggiore del
non aver mai messo la pagina.

Stessa cosa per il taxi: la corsa la prenota la reception su ATAM.

---

## Dove sta

**Due porte sulla stessa stanza**, come deciso.

**1. Sezione pubblica** sul sito nuovo. Serve a farsi trovare da chi cerca
"golf Abano" e non ha ancora prenotato. Chiede anche nome, email e telefono,
perché di quella persona non sappiamo niente.

**2. Dentro il pre-arrivo**, per chi ha già prenotato. Nome, camera e date
li sappiamo già: il modulo parte compilato e chiede solo il resto. Sono
esattamente i campi che ATAM pretende (`note_camera`, `note_cliente`).

Le due porte scrivono nella stessa tabella. Cambia solo cosa si chiede.

---

## Cosa si chiede

### Il golf

| Campo | Obbligatorio | Note |
|---|---|---|
| Circolo | sì | i tre sopra; è anche la destinazione del taxi |
| Data | sì | non nel passato, non oltre due anni |
| Ora preferita | sì | l'orario esatto lo dà il circolo |
| Giocatori | sì | 1–4, come una partenza |
| Percorso | no | i circoli da 27 buche hanno più anelli; chi non lo sa lascia in bianco e sceglie la reception |
| Golf car | no | spunta |
| Carrello | no | spunta |
| Carrello elettrico | no | spunta |
| Sacca a noleggio | no | spunta |
| Tessera federale / handicap | no | vedi *Punti aperti* |
| Note | no | è il campo che serve per tutto il resto |

### Il taxi, se lo vuole

Una spunta «Mi serve il trasporto» che apre tre campi soli: **ora di
partenza dall'hotel**, **passeggeri** (preimpostato al numero di giocatori)
e **ritorno sì/no**. Il resto la reception ce l'ha già: la destinazione è il
circolo, il nome e la camera sono nella richiesta.

Non si chiede il pagamento: sul modulo ATAM lo sceglie la reception fra
diretto, hotel e fattura, ed è una decisione loro, non dell'ospite.

---

## Dati

Tabella nuova `richiesta_golf`, con la stessa forma di `richiesta_sito`:
numerazione `GF-2026-0001` da un contatore dedicato, `stato` fra `nuova`,
`vista`, `prenotata`, `chiusa`, più `creato_il`, `ip`, `origine`, `lingua`.

Campi propri: `circolo`, `data_gioco`, `ora`, `giocatori`, `percorso`,
`golfcar`, `carrello`, `carrello_elettrico`, `sacca`, `tessera`, `note`,
e per il taxi `taxi`, `taxi_ora`, `taxi_pax`, `taxi_ritorno`.

Chi arriva dal pre-arrivo porta anche `arrivo_token`, così la richiesta si
lega alla prenotazione invece di restare un foglio staccato.

---

## Back office

Quinta scheda accanto alle altre, stessa forma di «Richieste dal sito»: si
apre sulle «da guardare», si clicca una richiesta e si vede tutto.

Due cose che fanno risparmiare tempo vero:

- **il riepilogo per ATAM già pronto**, coi valori nella forma che vuole
  quel modulo (`is_arrivo=False`, `luogo=Golf Montecchia🏌`, `pax`,
  `note_camera`, `note_cliente`), da copiare senza tradurre niente;
- **il collegamento diretto** alla pagina di prenotazione del circolo
  scelto, così non si cerca fra i preferiti.

---

## Errori

| Situazione | Comportamento |
|---|---|
| Data nel passato o oltre due anni | rifiutata, messaggio sul campo |
| Giocatori fuori da 1–4 | rifiutata: una partenza non ne regge di più |
| Data di lunedì su un circolo che chiude il lunedì | accettata, con avviso a video: le chiusure cambiano con la stagione e non voglio rifiutare una richiesta valida per una regola che potrebbe essere cambiata |
| Invio fallito | come nel form richieste: telefono e indirizzo dell'hotel, mai un falso «inviata» |
| Troppe richieste ravvicinate | stesso tetto contato a database della funzione `richieste` |

---

## Test

Il modulo di validazione è puro, come `valida.ts`: si prova senza rete.

1. Circolo sconosciuto rifiutato; i tre validi accettati.
2. Date: passato, troppo lontano, formato inesistente tipo 31 febbraio.
3. Giocatori 0 e 5 rifiutati, 1 e 4 accettati.
4. Taxi: se la spunta è attiva, ora e passeggeri diventano obbligatori.
5. Il riepilogo per ATAM contiene il nome esatto della destinazione come
   compare nell'elenco del loro modulo — è un test sul testo, perché una
   voce che non combacia costringe a cercarla a mano.
6. Email: marchio presente, `reply_to` all'ospite, e nessuna eccezione se
   Resend non risponde.

---

## Punti aperti

**Tessera federale e handicap.** I circoli chiedono la tessera per il green
fee, ma non so se tutti e tre e con che regola: sulle schede struttura non
c'è. Da chiedere ai circoli. Fino ad allora il campo resta facoltativo con
una nota, invece di rifiutare richieste per una regola che non ho
verificato.

**Nomi dei percorsi.** I due circoli da 27 buche hanno più anelli, ma i
nomi non compaiono sulle schede. Finché non li abbiamo il campo resta
libero e lo compila la reception.

**Chronogolf.** So che è il secondo portale, non quali circoli ci stiano
sopra. Serve per mettere il collegamento giusto accanto a ogni circolo.

---

## Fuori ambito

- Prenotazione automatica su OpenGolf o Chronogolf: non c'è accesso.
- Prenotazione automatica su ATAM: stesso motivo.
- Prezzi e disponibilità in tempo reale.
- Lezioni con il maestro e campo pratica dell'hotel: sono un'altra cosa,
  con un listino nostro, e meritano una sezione loro.
