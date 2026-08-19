/* ============================================================
   Il rapporto, in due forme.

   La tabella e' per gli occhi: prima cosa non va, poi tutto il resto. Una
   tabella di cinquanta righe messa in cima non la legge nessuno, e il
   difetto che conta resta sepolto in mezzo.

   Il JSON e' per il confronto: quando Fidra dira' «fatto», si rilancia lo
   strumento e si guarda la differenza. Perche' quella differenza sia
   leggibile le chiavi devono uscire sempre nello stesso ordine —
   altrimenti il confronto e' pieno di righe cambiate che non sono
   cambiate.
   ============================================================ */
import { type Riga, sospetti } from './giudizio.ts';

/* Dentro una tabella markdown la barra verticale apre una colonna: il
   titolo di /it/golf ne ha una vera. */
function cella(s: string, max = 55): string {
  const t = String(s ?? '').replace(/\|/g, '\\|');
  return t.length <= max ? t : t.slice(0, max - 1) + '…';
}

/* «5» in colonna, quando quei cinque hanno l'indirizzo relativo, si legge
   come «a posto»: chi scorre la tabella si ferma li'. La colonna deve dire
   quanti non contano. */
function cellaHreflang(r: Riga): string {
  if (r.hreflang.length === 0) return '—';
  if (r.hreflangRelativi === 0) return String(r.hreflang.length);
  return `${r.hreflang.length} (${r.hreflangRelativi} relativi)`;
}

export function tabella(righe: Riga[], quando: string): string {
  const guardate = righe.map((r) => ({ r, s: sospetti(r) }));
  const conProblemi = guardate
    .filter((x) => x.s.length > 0)
    .sort((a, b) => b.s.length - a.s.length || a.r.url.localeCompare(b.r.url));

  const testa = `<title>Audit SEO di termeleonardo.com</title>\n\n` +
    `# Audit SEO — termeleonardo.com\n\n` +
    `*${quando}*\n\n` +
    `${righe.length} ${righe.length === 1 ? 'indirizzo letto' : 'indirizzi letti'}. ` +
    `${conProblemi.length} ${conProblemi.length === 1 ? 'ha' : 'hanno'} qualcosa da sistemare.\n\n` +
    `Sono **sospetti**, non verdetti: ogni riga la legge una persona e decide.\n`;

  const problemi = conProblemi
    .map(({ r, s }) => `### ${r.url}\n\n${s.map((x) => `- ${x}`).join('\n')}\n`)
    .join('\n');

  const intestazione =
    '| indirizzo | stato | titolo | car. | description | car. | h1 | canonical | hreflang | parole |\n' +
    '|---|---|---|---|---|---|---|---|---|---|\n';

  const corpo = [...righe]
    .sort((a, b) => a.url.localeCompare(b.url))
    .map((r) =>
      `| ${cella(r.url, 40)} | ${r.stato} | ${cella(r.titolo)} | ${r.titolo.length}` +
      ` | ${cella(r.descrizione)} | ${r.descrizione.length} | ${r.h1.length}` +
      ` | ${r.canonical ? 'sì' : '—'} | ${cellaHreflang(r)} | ${r.parole} |`
    )
    .join('\n');

  return `${testa}\n## Quello che non va\n\n${problemi}\n## Tutte le pagine\n\n${intestazione}${corpo}\n`;
}

const ordinaChiavi = (_chiave: string, valore: unknown): unknown => {
  if (valore && typeof valore === 'object' && !Array.isArray(valore)) {
    const o = valore as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(o).sort(([a], [b]) => a.localeCompare(b)),
    );
  }
  return valore;
};

export function dati(righe: Riga[]): string {
  const ordinate = [...righe].sort((a, b) => a.url.localeCompare(b.url));
  return JSON.stringify(ordinate, ordinaChiavi, 2) + '\n';
}
