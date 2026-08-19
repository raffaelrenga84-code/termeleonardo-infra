/* ============================================================
   In che lingua e' scritto questo testo?

   Serve a una domanda sola: il titolo e la description sono nella lingua
   che la pagina dichiara? Su /fr la risposta e' no — meta in inglese,
   pagina francese — e sono le due righe che Google mostra nei risultati.

   COME. Si contano le PAROLE FUNZIONE: articoli, preposizioni,
   congiunzioni. I nomi non servono («hotel», «terme», «spa», «golf» si
   scrivono uguale in tutte e quattro), le parole funzione invece dividono
   nettamente.

   E TACE QUANDO NON SA. Se il primo non stacca il secondo di almeno
   MARGINE, la risposta e' «non lo so». Il costo di un falso allarme non e'
   teorico: qualcuno andrebbe a «correggere» un francese giusto.
   La stessa euristica, con lo stesso limite, sta in
   estensione/outlook-inject.js (linguaTesto) per riconoscere la lingua di
   una richiesta Day Spa.

   ATTENZIONE ALLE PAROLE CHE FINISCONO CON UNA VOCALE ACCENTATA. In
   JavaScript `\b` guarda [A-Za-z0-9_]: una parola come «più» finisce con un
   carattere che per il motore NON e' una lettera, quindi `\bpiù\b` non
   combacia con «più » e la spia resterebbe muta per sempre, senza che
   niente lo segnali. Le spie qui sotto finiscono tutte con una lettera
   semplice; l'accento in mezzo — «für», «réserver» — invece va benissimo.
   ============================================================ */
export const MARGINE = 2;

const SPIE: Record<string, RegExp> = {
  it:
    /\b(e|di|il|la|con|per|del|nel|una|che|sono|anche|tuoi|nostri|scopri|prenota|tutti|servizi|tariffe)\b/gi,
  de:
    /\b(und|der|die|das|mit|für|ein|eine|sich|auch|ist|sind|ihre|ihnen|unsere|buchen|entdecken)\b/gi,
  en: /\b(the|and|with|for|your|our|you|are|of|to|in|book|discover|such|many)\b/gi,
  fr:
    /\b(et|des|les|avec|pour|vous|votre|nos|dans|une|est|sont|réserver|découvrez)\b/gi,
};

export function lingua(testo: string): string {
  const t = ' ' + String(testo ?? '') + ' ';
  const conti = Object.entries(SPIE)
    .map(([l, re]) => ({ l, n: (t.match(re) ?? []).length }))
    .sort((a, b) => b.n - a.n);
  const primo = conti[0];
  const secondo = conti[1];
  if (!primo || primo.n === 0) return '';
  if (secondo && primo.n - secondo.n < MARGINE) return '';
  return primo.l;
}

export function sospettoLingua(dichiarata: string, testo: string): string {
  const d = String(dichiarata ?? '').slice(0, 2).toLowerCase();
  if (!d) return '';
  const vista = lingua(testo);
  if (!vista || vista === d) return '';
  return `la pagina dichiara «${d}» ma titolo e description sembrano «${vista}»`;
}
