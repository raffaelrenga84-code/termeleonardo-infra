/* ============================================================
   indirizzo.test.ts — un indirizzo solo, e quello giusto.

   IL GUASTO CHE PRESIDIA. Il 18 agosto 2026, scrivendo la ricevuta per
   l'ospite, il piede dell'email e' stato riempito con un indirizzo
   INVENTATO — «Via Tiro a Segno 6, 35031 Abano Terme» — invece di copiare
   quello che ogni altro file del repository usa da sempre. E' rimasto
   cosi' fino al 20 agosto, e in mezzo e' uscito agli ospiti: un'email col
   nostro logo che manda la gente nel posto sbagliato.

   Nessuna prova poteva vederlo, perche' un indirizzo sbagliato e'
   sintatticamente identico a uno giusto.

   L'ELENCO DEI FILE NON SI SCRIVE A MANO. Un elenco scritto a mano e'
   esattamente la cosa che ci si dimentica di aggiornare quando nasce una
   nuova email — e la prima email nuova sarebbe fuori sorveglianza. Qui i
   file si cercano: chiunque scriva un CAP in un file di codice o di
   markup finisce sotto questa prova, senza che nessuno debba ricordarsene.

   L'ORIGINALE, confermato dalla proprieta' il 20 agosto 2026:
       Hotel Terme Leonardo
       Via Monteortone 46, 35037 Monteortone di Abano Terme (PD)
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';

const VIA = 'Via Monteortone 46';
const CAP = '35037';

/* «35031» e' Abano Terme centro: e' il CAP che l'indirizzo inventato
   portava con se', ed e' l'errore piu' facile da rifare perche' l'hotel si
   chiama «di Abano Terme». Il nostro e' 35037, Monteortone. */
const CAP_SBAGLIATO = '35031';

const RADICI = ['../../supabase/functions', '../../pagine', '../../estensione'];
const ESTENSIONI = ['.ts', '.js', '.html'];

function file(dir: string, dentro: string[] = []): string[] {
  let radice: URL;
  try {
    radice = new URL(dir + '/', import.meta.url);
    Deno.statSync(radice);
  } catch {
    return dentro;
  }
  for (const e of Deno.readDirSync(radice)) {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory) file(p, dentro);
    else if (ESTENSIONI.some((x) => e.name.endsWith(x)) && !e.name.endsWith('.test.ts')) {
      dentro.push(p);
    }
  }
  return dentro;
}

/** I file che stampano un indirizzo postale: quelli con un CAP dentro. */
function conIndirizzo(): { percorso: string; testo: string }[] {
  const fuori: { percorso: string; testo: string }[] = [];
  for (const r of RADICI) {
    for (const p of file(r)) {
      const t = Deno.readTextFileSync(new URL(p, import.meta.url));
      if (/\b350\d{2}\b/.test(t)) fuori.push({ percorso: p, testo: t });
    }
  }
  return fuori;
}

/* Senza questa, le due prove sotto passerebbero su un elenco vuoto — cioe'
   senza guardare niente. */
Deno.test('i file che stampano un indirizzo si trovano', () => {
  const q = conIndirizzo();
  assert(q.length >= 5, `solo ${q.length} file con un indirizzo: la prova gira quasi a vuoto`);
});

Deno.test('chi stampa un indirizzo stampa quello vero', () => {
  const sbagliati: string[] = [];
  for (const { percorso, testo } of conIndirizzo()) {
    if (!testo.includes(VIA) || !testo.includes(CAP)) sbagliati.push(percorso);
  }
  assertEquals(sbagliati, [], `\n  non portano l indirizzo vero:\n  ${sbagliati.join('\n  ')}\n`);
});

Deno.test('e nessuno porta il CAP di Abano centro', () => {
  const conCapSbagliato = conIndirizzo()
    .filter((x) => x.testo.includes(CAP_SBAGLIATO))
    .map((x) => x.percorso);
  assertEquals(conCapSbagliato, [], `\n  hanno il CAP ${CAP_SBAGLIATO}:\n  ${conCapSbagliato.join('\n  ')}\n`);
});
