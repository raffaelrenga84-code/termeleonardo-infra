# L'agente vocale, e perché il suo prompt sta qui

Il prompt che gira sulla piattaforma vocale ripete a parole decine di numeri
che nel sistema stanno scritti da un'altra parte: gli orari della navetta, i
prezzi dei transfer, i nomi delle categorie di camera, l'indirizzo, gli orari
del Bistrot. Quando uno dei due cambia, l'altro non se ne accorge — e l'agente
continua a dire al telefono una cosa che il sito non fa più.

Il 20 agosto 2026, leggendo la v4.10, sono uscite **otto** divergenze di questo
tipo. Nessuna era visibile senza mettere i due testi uno accanto all'altro:

- la navetta condivisa: il prompt diceva «partenze fra le otto e le
  diciassette», il modulo che governa i moduli del sito dice **08:00–20:00**;
- i buoni regalo: mandati su `termeleonardo.com`, dove quella pagina risponde
  **404** (stanno su `hoteltermeleonardo.com`);
- il bar del Bistrot: 23:30 nel prompt, 23:00 nel sito;
- e cinque contraddizioni **interne**, fra quello che il changelog dichiarava
  di aver cambiato e quello che il corpo diceva ancora — fra cui il massaggio
  californiano «tolto dal listino» e ancora nel listino, e un rimando al
  simbolo ♥ che nel listino non compare.

`prompt.test.ts` mette i due testi uno accanto all'altro a ogni giro di prove.

## Cosa va fatto, una volta

Salvare qui dentro, come **`prompt.txt`**, una copia del prompt in uso sulla
piattaforma. Non riscriverlo a mano: dev'essere una copia del file vero.

Finché non c'è, le prove falliscono e lo dicono. È voluto: un controllo che si
salta in silenzio quando il file manca è un controllo che non c'è.

## Quando il prompt cambia

Si aggiorna la copia qui, si lancia `deno test --allow-read --allow-env`, e le
prove dicono se qualche numero ha smesso di combaciare con il resto del
sistema. Se una prova diventa rossa, **prima si guarda quale delle due fonti
ha ragione** — non si aggiorna la prova per farla tacere.
