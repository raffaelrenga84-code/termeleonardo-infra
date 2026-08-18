<title>Prendere nota senza promettere</title>

# Prendere nota senza promettere

*18 agosto 2026*

Due cose diverse, una regola sola: **si può dire «abbiamo ricevuto» e «abbiamo
preso nota» senza promettere niente**, e in tutti e due i casi oggi non lo
diciamo affatto.

1. Chi manda una richiesta dal sito non riceve nulla.
2. Chi fa il ciclo di fanghi non ha modo di dire a che ora preferirebbe.

---

## Parte 1 — La ricevuta all'ospite

### Il problema, misurato

`supabase/functions/richieste/email-richiesta.ts` manda **solo alla
reception**: `to: EMAIL_HOTEL`, `reply_to: r.email`. L'ospite vede il
riferimento sullo schermo — `grazie(d.numero)` in `pagine/richieste/index.html`
— e poi silenzio, finché qualcuno non risponde a mano da `conferma.ts`.

Se chiude la scheda non gli resta niente: né il riferimento, né la prova di
aver inviato.

L'asimmetria è la spia: chi **compra** un buono riceve l'email, automatica
(`buoni/email-buono.ts`). Chi **chiede** un trattamento no. Eppure è lui
quello che sta aspettando una risposta.

### Cosa si fa

Quando la riga viene inserita in `richiesta_sito`, oltre all'avviso alla
reception parte una **ricevuta all'ospite**. Non sostituisce niente: la
risposta vera resta la conferma che la reception manda a mano.

**È una ricevuta breve, non una prima risposta.** Deciso così perché il
rischio centrale non è tecnico: il sistema ripete ovunque *«questa è una
richiesta, non una prenotazione»*, e un'email col nostro logo, il riferimento
e i dati del soggiorno **si legge come una conferma**. L'ospite si presenta
convinto. È lo stesso difetto dell'avviso che prometteva «giorno e prezzo» a
chi aveva già pagato col buono, solo più caro. Ogni riga in più è una riga in
più che può essere scambiata per un impegno.

### Dove vive

`conferma.ts` tiene già `dettagli(tipo, dati, t)` — il blocco «cosa ha
chiesto» per tutti e sei i tipi, in quattro lingue — chiuso dentro di sé,
insieme alla tabella `T` delle etichette (`quando`, `dove`, `persone`, `volo`,
`ritorno`, `noleggi`, `taxi`, `trattamenti`, `rif`).

Quel pezzo esce in **`dettagli-richiesta.ts`**, e lo usano in due: la conferma
e la nuova ricevuta. Non si ricopia. Due copie di quel blocco divergerebbero,
e il giorno che divergono l'ospite legge una cosa nella ricevuta e un'altra
nella conferma — che è peggio di non avere la ricevuta.

È la stessa mossa già fatta oggi con `pagine/comune/obbligatori.js` e
`pagine/comune/atam.js`, e per la stessa ragione.

Il nuovo modulo: **`ricevuta.ts`**, accanto a `conferma.ts` e
`email-richiesta.ts`. Espone `ricevutaHTML(r)` e `inviaRicevuta(r)`, con la
stessa forma di `richiestaHTML` / `avvisaHotel`.

### Cosa dice

Nella lingua della richiesta (`r.lingua`).

| | italiano | tedesco | inglese | francese |
|---|---|---|---|---|
| oggetto | Abbiamo ricevuto la sua richiesta · RIC-… | Wir haben Ihre Anfrage erhalten · RIC-… | We have received your request · RIC-… | Nous avons bien reçu votre demande · RIC-… |
| titolo | Abbiamo ricevuto la sua richiesta | Wir haben Ihre Anfrage erhalten | We have received your request | Nous avons bien reçu votre demande |
| introduzione | Ecco cosa ci ha chiesto. | Hier ist, was Sie angefragt haben. | Here is what you asked for. | Voici ce que vous nous avez demandé. |
| **la riga che porta il peso** | **Non è ancora una prenotazione: le confermiamo noi, per email o al telefono.** | **Dies ist noch keine Buchung: wir bestätigen Ihnen per E-Mail oder telefonisch.** | **This is not a booking yet: we will confirm by email or by phone.** | **Ce n'est pas encore une réservation : nous vous confirmons par e-mail ou par téléphone.** |
| chiusura | Per qualsiasi cosa risponda a questa email, oppure ci chiami. | Für alles Weitere antworten Sie auf diese E-Mail oder rufen Sie uns an. | For anything at all, reply to this email or give us a call. | Pour toute question, répondez à cet e-mail ou appelez-nous. |

Più il riferimento (`r.numero`), il blocco di `dettagli()`, e telefono e
indirizzo dell'hotel.

`reply_to` **all'hotel**, non all'ospite: se risponde deve arrivare in
reception. È l'opposto dell'avviso, dove `reply_to` punta all'ospite proprio
perché lo legge la reception.

### Cosa non dice, di proposito

- **Nessun orario promesso.** «Di solito entro poche ore» sta sulla pagina,
  dove lo legge chi ha appena premuto invia. In un'email che si rilegge tre
  giorni dopo la stessa frase diventa un'accusa.
- **Nessun prezzo.** Lo conferma la reception.
- **Nessuna disponibilità.** Nemmeno per il Day Spa, dove la riga in pagina
  dice «risulta disponibilità»: quella è un'informazione del momento, e in
  un'email diventa un impegno.

### Se non parte

Come l'avviso alla reception, che già funziona così: la richiesta resta
salvata e la funzione risponde `ok`. L'ospite ha già letto «ricevuta» sullo
schermo, col riferimento. **Un'email che non parte non deve mai far fallire
una richiesta.**

### La porta che si apre, e perché resta stretta

Oggi il modulo pubblico manda posta a **un solo indirizzo**, il nostro. Da qui
in poi ne manda a **qualunque indirizzo scritto nel campo email**. Il bersaglio
cambia: non è più «qualcuno ci riempie la casella», è «qualcuno usa il nostro
dominio per mandare posta a terzi».

Il freno però c'è già, verificato in `richieste/index.ts`:

```
TETTO_PERSONA = 3    conta  email = X  OPPURE  ip = Y   in 30 minuti
TETTO_TOTALE  = 300  conta  tutte le righe               in 30 minuti
```

Lo stesso indirizzo si può quindi bersagliare **al massimo tre volte ogni
mezz'ora**, e ogni volta bisogna compilare una richiesta valida con la spunta
privacy. **Non serve un controllo nuovo.** Serve saperlo, e serve che chi
toccherà quei numeri sappia che adesso non governano più solo la nostra
casella.

---

## Parte 2 — Il desiderio d'orario per i fanghi

### Il problema

Il ciclo fanghi è la risorsa più vincolata dell'hotel — **sei turni al
mattino, dalle 5:50 alle 10:30**, con la visita medica di ammissione
obbligatoria prima, di norma la domenica pomeriggio — ed è la meno digitale:
l'unico canale è il telefono della Segreteria Cure.

La conferma dice già *«la segreteria cure le confermerà il turno»*. Fin lì è
onesto. Manca il passo prima: l'ospite non ha modo di dire **cosa
preferirebbe**.

### Cosa si fa, e cosa non si fa

Si chiede una **preferenza**, non un orario. E si risponde con una presa
d'atto, non con un appuntamento: *«abbiamo preso nota del suo desiderio»* —
in tedesco **«wir haben Ihren Wunschtermin vorgemerkt»**, che è la parola
esatta e il motivo per cui questa parte esiste.

Non si fa: nessun calendario, nessun turno scelto, nessuna disponibilità
mostrata. **Il turno lo assegna la Segreteria Cure dopo la visita medica**, e
qualunque cosa somigli a una prenotazione qui è una promessa che il servizio
non può mantenere.

### Dove vive

Nella pagina **«Prepara il suo arrivo»** (`arrivo/index.html`), che già
raccoglie proprio questo: a che ora arriva, con quale mezzo, la fattura, il
transfer, le piccole attenzioni. È il posto dove l'ospite dice le sue
preferenze prima di partire.

Una sezione nuova, **Cure termali**, con una scelta sola:

> A che ora preferirebbe i fanghi?
> ◯ Presto — dalle 5:50   ◯ Più tardi — verso le 10:00   ◯ Indifferente
>
> Il turno lo assegna la Segreteria Cure dopo la visita medica di ammissione:
> qui prendiamo nota della sua preferenza.

### Il vincolo da risolvere

`prepara-arrivo?action=crea` riceve `reservation_id`, `numero_pratica`,
`intestatario`, `email`, `lingua`, `data_arrivo`, `data_partenza`, `adulti`,
`bambini`. **Non riceve il trattamento**, quindi la pagina oggi non può sapere
se quell'ospite ha le cure — e mostrare la domanda a chi viene per due notti
di relax sarebbe rumore.

L'estensione quel dato ce l'ha già: `deduci(d).cure` in `popup.js`, la stessa
regola che decide se mettere il blocco «cure termali» nell'email
(`/\bCUR[AE]|FANGO|TERMAL|DOLCE VITA/` sui trattamenti, oppure più di cinque
notti).

**Si passa quel booleano a `?action=crea`**, si salva accanto agli altri dati
del soggiorno, e la pagina mostra la sezione solo quando è vero. Chi non ha le
cure non vede niente di nuovo.

### Cosa torna indietro

Nella conferma che la pagina d'arrivo manda già alla reception, una riga in
più: **«Fanghi · preferenza: presto (dalle 5:50)»**. Per l'ospite, nella stessa
schermata di ringraziamento, la frase della presa d'atto.

Nessuna email nuova: la pagina d'arrivo un suo riscontro ce l'ha già.

---

## Le prove, e il difetto che ognuna presidia

| prova | il difetto che presidia |
|---|---|
| la ricevuta va all'**ospite**, non all'hotel | mandarla a noi due volte e all'ospite mai: è l'errore più facile in questo punto del codice |
| tutti e sei i tipi rendono un blocco `dettagli` non vuoto | il Day Spa arrivò in reception come «undefined notti · undefined ospiti»: un tipo nuovo si dimentica sempre da qualche parte |
| nessuna delle quattro lingue della ricevuta contiene parole di conferma | è il rischio centrale: un'email col nostro logo si legge come una prenotazione |
| `dettagli` è **importato** da `dettagli-richiesta.ts`, non ricopiato | due copie che divergono, e l'ospite legge due cose diverse |
| se Resend non risponde, la funzione risponde comunque `ok` | una richiesta persa per un'email non partita |
| la sezione fanghi **non** compare quando `cure` è falso | rumore a chi viene per due notti di relax |
| il testo della preferenza non contiene parole di appuntamento in nessuna delle quattro lingue | promettere un turno che assegna la Segreteria Cure |

---

## Cosa resta fuori, e perché

- **Il sollecito della ricevuta.** Se la reception non risponde, l'ospite non
  riceve un secondo avviso. Ci vuole una regola su quanto tempo è troppo, e
  quella regola non è una cosa da decidere dentro questa specifica.
- **La disponibilità dei turni fanghi.** Servirebbe leggere l'agenda della
  Segreteria Cure, che non è un sistema che il sito raggiunge.
- **Gli altri cinque buchi trovati il 18 agosto** — il dopo-soggiorno, la
  richiesta che non entra in Fidra, le due porte del Day Spa, il «Prepara il
  suo arrivo» che si manda una volta sola, il modulo dei tassisti che si
  compila a mano. Restano scritti qui perché non si perdano, ognuno con la sua
  specifica quando toccherà.
