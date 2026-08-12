# Foto sui buoni regalo + acquisto dal sito nuovo — design

Data: 2026-08-12 · Stato: approvato da Raffael

## Obiettivo

Il buono regalo (email, stampa back office, anteprima pubblica) sostituisce il
gradiente segnaposto con una foto vera dell'hotel, diversa per tipo di buono.
Il sito nuovo (termeleonardo.vercel.app) porta i clienti alla pagina di
acquisto già in produzione.

## Scelte confermate

| Tipo di buono | Foto | Origine |
|---|---|---|
| Trattamenti (massaggi, viso, programmi) | collage massaggio + fango | `dolce-vita-mud-offer.jpg` |
| Day Spa (`voce_id` che inizia per `dayspa`) | piscina termale esterna | `outdoor-pool-hotel-leonardo-da-vinci-terme.jpg` |
| Valore (importo libero) e casi ignoti | panorama dall'alto sui Colli | `view-hotel-leonardo-da-vinci-terme.jpg` |

Logo: resta tipografico (LE**ONARDO** / TERME HOTEL ★★★★), identico ai due siti.

## Hosting delle foto

Ritagliate al formato del riquadro del buono e ottimizzate (~100 KB, JPEG),
committate in `pagine/buoni/img/` del repo infra → servite da
`https://arrivo-terme-leonardo.vercel.app/buoni/img/<nome>.jpg`.

Perché non hotlink a `www.termeleonardo.com/img/…`: un buono vive 12 mesi
nelle caselle email; se il sito Laravel venisse sostituito dal prototipo
nuovo, le foto sparirebbero dalle email già inviate.

## Regola di scelta (unica, condivisa)

```
tipo === 'valore'            → panorama
voce_id inizia per 'dayspa'  → piscina
altro servizio               → collage fango
fallback (es. "Altro" della reception, voce_id nullo) → panorama
```

## Superfici da aggiornare

1. **Email** — `supabase/functions/buoni/email-buono.ts`: `<img>` con URL
   assoluto al posto del div gradiente; il td mantiene il fondo verde acqua
   come fallback quando il client blocca le immagini. Funzione di scelta
   foto esportata e coperta da test Deno (TDD).
2. **Back office** — `pagine/buoni/index.html`: anteprima a schermo e
   stampa A4 (2 occorrenze del gradiente).
3. **Pagina pubblica** — `pagine/buoni/regala/index.html`: l'anteprima dal
   vivo cambia foto seguendo la selezione del cliente (1 occorrenza).

## Sito nuovo (repo raffaelrenga84-code/termeleonardo)

Nella sezione regali (`GiftVouchers.jsx`) il CTA passa da
`termeleonardo.com/shop` a
`https://arrivo-terme-leonardo.vercel.app/buoni/regala/?l=<lingua attiva>`
(URL base in `data.js`, lingua dal `LanguageContext`). Nessun porting del
modulo in React. Dopo il push, verificare che la build Vercel passi (l'ultimo
deployment risultava in errore).

## Fuori scope

Foto dentro le 3 card del sito nuovo · porting nativo del modulo di acquisto
in React · modifiche ai prezzi delle card · pagina multi-voce su /regala/.

## Collaudo

- Test Deno verdi (scelta foto per tipo/voce_id, regressione email).
- Email di prova: buono Day Spa → foto piscina; buono valore → panorama.
- Stampa A4 dal back office con foto nitida.
- /regala/: l'anteprima cambia foto scegliendo Day Spa vs massaggio vs importo.
- Sito nuovo: bottone regali apre /buoni/regala/?l=de con lingua tedesca attiva.
