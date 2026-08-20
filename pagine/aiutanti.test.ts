/* ============================================================
   aiutanti.test.ts — un aiutante chiamato e mai scritto.

   IL GUASTO CHE PRESIDIA, ed e' successo davvero. Il 18 agosto 2026 una
   modifica al modulo del transfer ha aggiunto i messaggi sui campi
   mancanti e, per strada, ha cancellato la riga che definiva `v` — la
   funzioncina che legge il valore di un campo. Le nove chiamate a `v(...)`
   sono rimaste. Il file era sintatticamente perfetto, tutte le prove del
   repository erano verdi, e la pagina si apriva normalmente.

   Poi l'ospite premeva «Invia» e il codice si fermava: `v is not defined`.
   L'ospite vedeva il riquadro rosso di ripiego e pensava che fossimo noi a
   non funzionare; in hotel non arrivava niente, e nessuno poteva
   accorgersene. E' rimasto cosi' due giorni.

   PERCHE' QUESTA PROVA E' STRETTA E NON GENERALE. Il primo tentativo
   controllava OGNI nome chiamato in ogni pagina. Non ha funzionato, e vale
   la pena dire come: contava `v` fra i nomi dichiarati, perche' `v` compare
   come PARAMETRO di due altre funzioncine dello stesso file — quindi la
   prova, sul difetto vero, restava verde. Distinguere «dichiarato qui
   dentro» da «dichiarato altrove» vuol dire sapere le regole di visibilita'
   di JavaScript, cioe' scrivere un compilatore.

   Quindi si guardano solo GLI AIUTANTI DI CASA: i quattro nomi corti che
   queste pagine si copiano l'una dall'altra, e che nessuno importa. Se una
   pagina ne chiama uno, quella pagina deve anche scriverlo, all'inizio di
   una riga — che e' come sono scritti tutti. Copre meno di un analizzatore
   vero, ma quel poco lo copre davvero, e questo difetto lo prende.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';

/* I nomi corti che le pagine si passano per copia. Non si importano da
   nessuna parte: o stanno scritti nella pagina, o non esistono. */
const AIUTANTI = ['v', 'esc', '$', 'stato'] as const;

/** Il corpo del <script type="module"> di una pagina, senza gli import. */
function copione(html: string): string {
  const m = html.match(/<script type="module">([\s\S]*?)<\/script>/);
  return m ? m[1] : '';
}

/* Via le frasi, resta il codice: «Massaggio antistress (45 minuti)» non e'
   una chiamata a `antistress()`, ma a una ricerca per testo lo sembra.
   Dentro gli apici inversi il codice c'e' davvero, nei ${...}: quelli si
   tengono, il testo attorno si butta. */
/* Gli a-capo si conservano. Buttare via una stringa vuol dire buttare via
   anche gli a-capo che conteneva, e allora una dichiarazione scritta a
   inizio riga smette di sembrarlo — `dichiara()` la cerca con `^`. E'
   successo davvero: la pagina d'arrivo dichiara `stato` a inizio riga e
   questa prova la dava per mancante. */
const A_CAPO = String.fromCharCode(10);
/** Tanti a-capo quanti ne conteneva il pezzo buttato via. */
const aCapo = (s: string) => s.split(A_CAPO).slice(1).map(() => A_CAPO).join("");

function soloCodice(s: string): string {
  let fuori = '';
  let i = 0;
  while (i < s.length) {
    const c = s[i], d = s[i + 1];
    if (c === '/' && d === '/') { while (i < s.length && s[i] !== '\n') i++; continue; }
    if (c === '/' && d === '*') {
      i += 2;
      const daC = i;
      while (i < s.length && !(s[i] === '*' && s[i + 1] === '/')) i++;
      i += 2; fuori += aCapo(s.slice(daC, i)); continue;
    }
    if (c === "'" || c === '"') {
      const apice = c; i++;
      while (i < s.length && s[i] !== apice) { if (s[i] === '\\') i++; i++; }
      i++; fuori += '""'; continue;
    }
    if (c === '`') {
      const daT = i; i++;
      while (i < s.length) {
        if (s[i] === '\\') { i += 2; continue; }
        if (s[i] === '`') { i++; break; }
        if (s[i] === '$' && s[i + 1] === '{') {
          i += 2;
          let liv = 1, dentro = '';
          while (i < s.length && liv > 0) {
            if (s[i] === '{') liv++;
            else if (s[i] === '}') { liv--; if (liv === 0) { i++; break; } }
            dentro += s[i]; i++;
          }
          fuori += ' ' + soloCodice(dentro) + ' ';
          continue;
        }
        i++;
      }
      fuori += '""' + aCapo(s.slice(daT, i)); continue;
    }
    fuori += c; i++;
  }
  return fuori;
}

/** Se il codice chiama questo aiutante. `$` non e' una lettera: va scappato. */
function chiama(codice: string, nome: string): boolean {
  const n = nome.replace(/\$/g, '\\$');
  return new RegExp(`(^|[^.\\w$])${n}\\s*\\(`).test(codice);
}

/** Se la pagina lo scrive, all'inizio di una riga come tutti gli altri. */
function dichiara(codice: string, nome: string): boolean {
  const n = nome.replace(/\$/g, '\\$');
  return new RegExp(`^\\s*(const|let|var)\\s+${n}\\s*=|^\\s*function\\s+${n}\\s*\\(`, 'm')
    .test(codice);
}

/* Oppure lo importa: `esc` sta in /buoni/buono.js e tre pagine se lo
   prendono da li' invece di riscriverlo, che e' il modo giusto. La regola
   e' «chi lo chiama deve averlo», non «deve scriverselo». */
function importa(html: string, nome: string): boolean {
  const n = nome.replace(/\$/g, '\\$');
  for (const m of html.matchAll(/^\s*import\s*\{([^}]*)\}/gm)) {
    for (const voce of m[1].split(',')) {
      if ((voce.trim().split(/\s+as\s+/).pop() ?? '').trim() === nome) return true;
    }
    void n;
  }
  return false;
}

function pagine(): string[] {
  const fuori: string[] = [];
  const gira = (dir: string) => {
    for (const e of Deno.readDirSync(new URL(dir, import.meta.url))) {
      if (e.isDirectory) gira(`${dir}${e.name}/`);
      else if (e.name.endsWith('.html')) fuori.push(`${dir}${e.name}`);
    }
  };
  gira('./');
  return fuori;
}

function conCopione(): { percorso: string; codice: string; grezzo: string; html: string }[] {
  return pagine()
    .map((p) => {
      const html = Deno.readTextFileSync(new URL(p, import.meta.url));
      const grezzo = copione(html);
      return { percorso: p, html, grezzo, codice: soloCodice(grezzo) };
    })
    .filter((x) => x.codice.length > 0);
}

/* Senza questa, tutto il resto girerebbe su un elenco vuoto. */
Deno.test('le pagine col copione si trovano', () => {
  const p = conCopione();
  assert(p.length >= 3, `solo ${p.length} pagine con un copione`);
});

/* E senza questa, la prova sotto potrebbe passare perche' nessuna pagina
   chiama nessun aiutante — cioe' perche' non guarda niente. */
Deno.test('gli aiutanti sono davvero usati da qualche parte', () => {
  const usati = AIUTANTI.filter((a) => conCopione().some((p) => chiama(p.codice, a)));
  assertEquals(usati.length, AIUTANTI.length, `mai chiamati: ${
    AIUTANTI.filter((a) => !usati.includes(a)).join(', ')
  }`);
});

Deno.test('chi chiama un aiutante di casa lo scrive anche', () => {
  const mancanti: string[] = [];
  for (const { percorso, codice, grezzo, html } of conCopione()) {
    for (const a of AIUTANTI) {
      /* LE CHIAMATE si cercano nel codice ripulito dalle frasi, o
         «Massaggio antistress (45 minuti)» sembrerebbe una chiamata.
         LA DICHIARAZIONE si cerca nel testo GREZZO, e non e' una
         distrazione: ripulire le stringhe vuol dire riconoscere dove
         cominciano e dove finiscono, e un apice dentro un'espressione
         regolare basta a far perdere il segno — e' successo, e questa
         prova dava per mancante una funzione dichiarata a riga 320.
         Sbagliare qui in eccesso (vedere una dichiarazione dentro una
         frase) fa tacere la prova su un caso raro; sbagliare in difetto
         la fa gridare su codice sano, e una prova che grida sempre non
         la guarda piu' nessuno. */
      if (chiama(codice, a) && !dichiara(grezzo, a) && !importa(html, a)) {
        mancanti.push(`${percorso}: chiama ${a}() e non lo definisce ne lo importa`);
      }
    }
  }
  assertEquals(mancanti, [], `\n  ${mancanti.join('\n  ')}\n`);
});
