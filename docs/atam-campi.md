# Modulo prenotazioni ATAM — campi

Riferimento per la sezione transfer del sito: quello che l'ospite compila
deve poter essere ricopiato in questo modulo senza tradurre niente.

Rilevato in sola lettura da https://www.atam.biz/prenotazioni/ il 13 agosto 2026.
La pagina risulta gia' autenticata come «Ivano Ministeri per LEONARDO».

## Campi

| Campo | Nome | Obbligatorio | Note |
|---|---|---|---|
| Data | `data_corsa_0` | si | |
| Ora | `data_corsa_1` | si | nelle partenze e` l'ora della presa in hotel; negli arrivi l'ora al luogo indicato |
| Passeggeri | `pax` | si | numero |
| Individuale o collettivo | `is_collettivo` | | `False`=individuale · `True`=collettivo |
| Arrivo o partenza | `is_arrivo` | | `True`=arrivo da… · `False`=partenza per… |
| Luogo | `luogo` | | elenco chiuso, 189 voci (sotto) |
| Pagamento | `pagamento` | si | `D`=diretto · `H`=hotel · `F`=fattura |
| Numero di camera | `note_camera` | | |
| Nome del cliente | `note_cliente` | | |
| Dettagli arrivo | `note_arrivo` | | volo, treno, orario |
| Note | `note` | | testo libero |
| Allegato | `attachment` | | file |

## Osservazione

Non e` solo un servizio taxi: fra le destinazioni ci sono i Giri dei Colli
da 2, 3 e 4 ore, i tre campi da golf e le gite agli outlet. La sezione del
sito puo` vendere escursioni, non solo trasferimenti.

## Le 189 destinazioni

```
Montegrotto · Padova FS · Padova città · Terme  Euganee FS
Treviso Aeroporto · Venezia  aeroporto · Venezia P.le Roma · Venezia porto
Abano · Abano - Montegrotto · Abano F.S · Aeroporto Roma fiumicino
Agugliaro · Albignasego · Anguillara · Ariano ferrarese
Arquà Petrarca · Arzergrande · Ascona · Asiago
Asolo · Assenza corte · Assenza lunghe · Bad KleinKircheim
Badia Polesine · Bagnoli di Sopra · Baone · Bassano del Grappa
Bastia · Battaglia Terme · Belluno · Bergamo aeroporto✈️
Bologna Aeroporto · Bologna città🎯 · Bolzano · Bovolenta
Brendola (VI) · Brescia · Brindisi · Cadoneghe
Cagliari · Campodarsego · Camposampiero · Cartura
Casalserugo · Caselle di Selvazzano · Castelfranco · Castello del Catajo
Cervarese Santa Croce · Cesena · Chiasso · Chiasso (ch)
Chioggia-Sottomarina · Cinto Euganeo · Cittadella · Como
Conegliano · Conselve · Cortina D'ampezzo · Courmayeur
Cremona · Due Carrare · Este · Ferrara
Firenze · Folgaria · Formigine · Galzignano
Galzignano e Galz Hotels · Gardone Riviera · Genova · Giro Colli 2 ore🖼
Giro Colli 3 ore🖼 · Giro Colli 4 ore🖼 · Golf Frassanelle 🏌 · Golf Montecchia🏌
Golf Valsanzibio 🏌 · Gorizia · Grado · Grisignano
Imola · Imperia · Innsbruck · Ipercity-Albignasego
Jesolo⛱ · La Spezia · Legnaro · Lignano Sabbiadoro⛱
Limena · Luvigliano · Mandria opera immacolata · Mantova
Marchirolo · Marostica · Maserà · Mentone
Merano · Mercato Abano · Mercato Montegrotto · Mestre fs
Mestrino · Milano Città🎯 · Milano Malpensa✈️ · Milano Marittima
Milano-Linate · Mira-Dolo · Modena · Monselice
Montagnana · Montegaldella · Montemerlo · Noventa Padovana
Noventa di Piave👔 · Noventa vicentina · Occhiobello · Ortisei
Outlet Noventa 3 ore · Outlet Noventa 4 ore · Palmanova · Parco dei Tigli
Parma · Pavia · Pernumia · Perugia
Pesaro - Urbino · Pescara · Peschiera del Garda · Piacenza
Piazzola sul Brenta · Piove di Sacco · Pisa · Pordenone
Porto Sant' Elpidio · Pozzonovo · Praglia⛪️ · Prato
Princ. di Monaco · Ravenna · Reggio Emilia · Rimini
Riva del Garda · Roma · Rovigo · Rovolon
Rubano · Saccolongo · Sacile · San Daniele ⛪️
San Pietro viminario · Santa Giustina in Colle · Saonara · Sarmeola di Rubano
Sassuolo · Schiavonia · Schio · Selvazzano
Sermide · Siena · Sirmione · Solesino
Stanghella · Stra · Tencarola · Teolo
Terassa padovana · Terradura · Torino · Torre di Quartesolo
Torreglia · Tortona · Trento · Tribano
Trieste · Udine · Val Badia · Valsanzibio
Varese · Verona Aeroporto✈️ · Verona Arena🌛 · Verona città🎯
Vicenza Fiera · Vicenza città🎯 · Vienna · Vigonovo
Vigonza · Villafranca Padovana · Vo · Zurigo
civitavecchia
```
