/* ============================================================
   immagini.test.ts — le fotografie che finiscono nel buono regalo.

   IL DIFETTO CHE PRESIDIA. email-buono.ts sceglie una fotografia e ne
   scrive l'indirizzo dentro l'email; buono.js fa lo stesso sul buono che
   l'ospite stampa. Nessuno le guarda mai prima del cliente: le prove
   girano sull'HTML e non scaricano niente, e l'email si vede quando e'
   gia' partita. Due modi di rompersi, tutti e due silenziosi:

   · il file non c'e' piu' — rinominato, spostato, mai copiato. Chi apre
     l'email trova il riquadro vuoto dell'immagine rotta dentro un buono
     regalo che ha pagato;

   · il file c'e' ma ha un'altra forma. L'email dichiara width="218"
     height="150": una fotografia di proporzione diversa esce SCHIACCIATA
     nei lettori che rispettano gli attributi (Outlook li rispetta), e sul
     buono stampato — dove l'altezza non e' dichiarata e la decide il
     file — sposta in basso tutto quello che segue.

   PERCHE' NASCE ADESSO. Il 21 agosto 2026, sostituendo la fotografia del
   Day Spa con la grotta, il secondo caso e' andato a un passo: l'originale
   della grotta e' VERTICALE, 3747x5621. Ce ne siamo accorti leggendo il
   markup, non per merito di una prova. Adesso c'e' la prova.
   ============================================================ */
import { assert, assertEquals } from 'jsr:@std/assert';

const QUI = new URL('.', import.meta.url);

/* le proporzioni che l'email DICHIARA: da li' viene il vincolo, non da un
   numero scelto qui */
const EMAIL = Deno.readTextFileSync(
  new URL('../../supabase/functions/buoni/email-buono.ts', import.meta.url),
);
const BUONO = Deno.readTextFileSync(new URL('buono.js', import.meta.url));

function rapportoDichiarato(): number {
  const m = EMAIL.match(/fotoBuono\(b\)\}"\s+width="(\d+)"\s+height="(\d+)"/);
  assert(m, 'l img della fotografia non si trova piu nel modello dell email');
  return Number(m[1]) / Number(m[2]);
}

/* ogni file nominato accanto a BASE_IMG, in tutti e due i posti */
function nominati(): string[] {
  const fuori = new Set<string>();
  for (const src of [EMAIL, BUONO]) {
    for (const m of src.matchAll(/\$\{BASE_IMG\}\/([A-Za-z0-9._-]+)/g)) fuori.add(m[1]);
  }
  return [...fuori].sort();
}

/* larghezza e altezza di un JPEG, dal marcatore SOFn: si LEGGE il file,
   non si crede al nome */
function misure(b: Uint8Array): [number, number] {
  let i = 2;
  while (i < b.length) {
    if (b[i] !== 0xff) { i++; continue; }
    const k = b[i + 1];
    if (k >= 0xc0 && k <= 0xcf && k !== 0xc4 && k !== 0xc8 && k !== 0xcc) {
      return [(b[i + 7] << 8) | b[i + 8], (b[i + 5] << 8) | b[i + 6]];
    }
    i += 2 + ((b[i + 2] << 8) | b[i + 3]);
  }
  throw new Error('non e un JPEG leggibile');
}

Deno.test('ogni fotografia nominata dal buono esiste davvero', () => {
  const nomi = nominati();
  assert(nomi.length >= 3, `solo ${nomi.length} file nominati: la prova non guarda niente`);
  const mancanti: string[] = [];
  for (const n of nomi) {
    try {
      assert(Deno.statSync(new URL('img/' + n, QUI)).isFile);
    } catch {
      mancanti.push(n);
    }
  }
  assertEquals(
    mancanti,
    [],
    'file nominati dal buono che non esistono: chi apre l email trova il riquadro ' +
      'dell immagine rotta dentro un buono regalo pagato',
  );
});

Deno.test('e ha la forma che l email dichiara, o esce schiacciata', () => {
  const atteso = rapportoDichiarato();
  const storte: string[] = [];
  for (const n of nominati()) {
    if (!n.endsWith('.jpg')) continue; /* i loghi vanno ad altezza libera */
    const [w, h] = misure(Deno.readFileSync(new URL('img/' + n, QUI)));
    const r = w / h;
    if (Math.abs(r - atteso) / atteso > 0.01) {
      storte.push(`${n} ${w}x${h} (rapporto ${r.toFixed(4)}, atteso ${atteso.toFixed(4)})`);
    }
  }
  assertEquals(
    storte,
    [],
    'fotografie di forma diversa da quella dichiarata nell email: escono schiacciate ' +
      'in Outlook, e sul buono stampato spostano in basso tutto quello che segue',
  );
});

Deno.test('e non pesa quanto un originale da fotocamera', () => {
  /* viaggiano dentro un email, scaricate a ogni apertura. Le tre stanno fra
     48 e 78 KB: sopra i 150 si sta spedendo l originale. */
  const grosse: string[] = [];
  for (const n of nominati()) {
    if (!n.endsWith('.jpg')) continue;
    const kb = Deno.statSync(new URL('img/' + n, QUI)).size / 1024;
    if (kb > 150) grosse.push(`${n} ${Math.round(kb)} KB`);
  }
  assertEquals(grosse, [], 'fotografie troppo pesanti per un email');
});
