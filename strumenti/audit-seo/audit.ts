/* ============================================================
   L'audit SEO di termeleonardo.com. SOLA LETTURA.

   uso:
     deno run --allow-net=www.termeleonardo.com --allow-write=docs \
       strumenti/audit-seo/audit.ts

   I permessi sono parte della garanzia, non una formalita': con questa
   riga lo strumento puo' parlare con un dominio solo e scrivere in una
   cartella sola. Se un giorno qualcuno gli facesse fare altro, Deno lo
   fermerebbe prima che succeda.

   Qui dentro non c'e' logica di proposito: l'elenco, la lettura, il
   sospetto di lingua, il giudizio e il rapporto stanno in cinque moduli
   con i loro test. Questo file mette in fila le richieste e scrive i file.
   ============================================================ */
import { BASE, INDIRIZZI, VIETATI } from './indirizzi.ts';
import { leggiPagina } from './leggi-pagina.ts';
import type { Riga } from './giudizio.ts';
import { dati, tabella } from './rapporto.ts';

/* Una richiesta alla volta, con una pausa. Cinquanta pagine in un minuto
   non fanno male a nessuno; cinquanta tutte insieme, contro il server che
   incassa, sono una cosa che non si fa. */
const PAUSA_MS = 800;
const AGENTE =
  'Leonardo-Audit/1.0 (controllo SEO interno dell hotel; info@termeleonardo.com)';

const attesa = (ms: number) => new Promise((r) => setTimeout(r, ms));

const MESI = [
  'gennaio',
  'febbraio',
  'marzo',
  'aprile',
  'maggio',
  'giugno',
  'luglio',
  'agosto',
  'settembre',
  'ottobre',
  'novembre',
  'dicembre',
];

export async function leggi(percorso: string): Promise<Riga> {
  /* Il secondo cancello. Il primo e' il test sull'elenco; questo vale
     anche per chi chiamasse leggi() a mano. */
  for (const v of VIETATI) {
    if (v.test(percorso)) throw new Error(`indirizzo vietato: ${percorso}`);
  }

  const inizio = Date.now();
  const url = BASE + percorso;
  try {
    const r = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: { 'user-agent': AGENTE, 'accept': 'text/html' },
    });
    const html = await r.text();
    const finale = r.url && r.url !== url ? r.url : '';
    return {
      ...leggiPagina(html),
      url: percorso,
      stato: r.status,
      finale,
      byte: html.length,
      ms: Date.now() - inizio,
    };
  } catch (e) {
    /* Una pagina che non risponde e' un dato, non un incidente: si scrive
       nel rapporto e si va avanti. Fermarsi al primo intoppo vorrebbe dire
       ricominciare da capo per una rete che ha singhiozzato. */
    return {
      ...leggiPagina(''),
      url: percorso,
      stato: 0,
      finale: `errore: ${String(e)}`,
      byte: 0,
      ms: Date.now() - inizio,
    };
  }
}

if (import.meta.main) {
  const righe: Riga[] = [];
  for (const p of INDIRIZZI) {
    const r = await leggi(p);
    righe.push(r);
    console.log(`${String(r.stato).padStart(3)} ${p}`);
    await attesa(PAUSA_MS);
  }

  const oggi = new Date();
  const iso = oggi.toISOString().slice(0, 10);
  const inParole = `${oggi.getDate()} ${MESI[oggi.getMonth()]} ${oggi.getFullYear()}`;

  await Deno.mkdir('docs/seo', { recursive: true });
  await Deno.writeTextFile(
    `docs/seo/${iso}-audit-termeleonardo.md`,
    tabella(righe, inParole),
  );
  await Deno.writeTextFile(
    `docs/seo/${iso}-audit-termeleonardo.json`,
    dati(righe),
  );

  const nonDuecento = righe.filter((r) => r.stato !== 200).length;
  console.log(`\n${righe.length} letti · ${nonDuecento} non rispondono 200`);
  console.log(`docs/seo/${iso}-audit-termeleonardo.md`);
}
