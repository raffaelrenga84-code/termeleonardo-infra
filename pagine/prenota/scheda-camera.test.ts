/* ============================================================
   scheda-camera.test.ts — la scheda della camera si disegna davvero.

   IL DIFETTO CHE PRESIDIA. foto.test.ts verifica l'elenco: che ogni
   categoria abbia la sua immagine e che il file esista. Non verifica che
   la pagina la METTA nella scheda, ne' come. Sono due difetti diversi:
   l'elenco giusto e il tag sbagliato danno lo stesso risultato di nessuna
   foto — o peggio.

   Le cose che qui si guardano, e che l'elenco non copre:

   · una camera senza foto (le accessibili) non deve produrre un <img> col
     `src` vuoto: il browser lo interpreta come «ricarica questa pagina» e
     scarica di nuovo l'HTML per ogni scheda muta;
   · l'`alt` deve portare il nome della camera, che e' l'unica cosa che
     legge chi non vede l'immagine — e quando la foto NON ritrae la
     stanza (la Junior Suite Accessibile ha la foto del bagno) deve dire
     anche che cosa ritrae, o annuncia una camera e mostra un bagno;
   · il percorso deve essere assoluto, per la ragione spiegata in
     percorsi-web.test.ts: su /it/prenota un percorso relativo esce fuori
     strada;
   · `loading="lazy"` e le misure devono esserci, o la pagina balla sotto
     il dito di chi sta gia' scegliendo mentre le immagini arrivano.

   COME. Si estrae dalla pagina il modello della scheda — la stessa
   stringa che gira nel browser, non una copia scritta qui — e la si
   ESEGUE con la vera fotoDi(). Se qualcuno riscrive il modello, questa
   prova gira sul nuovo.
   ============================================================ */
import { assert, assertEquals, assertStringIncludes } from 'jsr:@std/assert';
import { CAMERE } from '../../supabase/functions/richieste/camere.ts';
import { altFoto, fotoDi, SENZA_FOTO } from './foto.js';

const PAGINA = Deno.readTextFileSync(new URL('index.html', import.meta.url));

/* il modello: dal <div class="gruppoCamera"> fino alla riga della
   descrizione, che e' dove finisce la parte che ci riguarda */
function modello(): string {
  const da = PAGINA.indexOf('<div class="gruppoCamera">');
  assert(da > 0, 'la scheda della camera non si trova nella pagina');
  const a = PAGINA.indexOf('${g.descrizione', da);
  assert(a > da, 'la fine del modello non si trova: la scheda e cambiata forma');
  return PAGINA.slice(da, a);
}

/* si esegue il modello come lo esegue il browser: e' un pezzo di template
   literal, quindi lo si richiude in uno e lo si valuta */
function disegna(g: { camera_id: number; nome: string }): string {
  const esc = (v: unknown) =>
    String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const f = new Function('g', 'esc', 'fotoDi', 'altFoto', 'return `' + modello() + '`;');
  return f(g, esc, fotoDi, altFoto) as string;
}

Deno.test('una camera con foto esce con un img completo', () => {
  const out = disegna({ camera_id: 6, nome: 'Matrimoniale Queen' });
  assertStringIncludes(out, 'src="/prenota/img/queen-room.jpg"');
  assertStringIncludes(out, 'alt="Matrimoniale Queen"');
  assertStringIncludes(out, 'loading="lazy"');
  assert(/width="\d+"/.test(out) && /height="\d+"/.test(out),
    'senza misure la pagina balla mentre le immagini arrivano');
});

Deno.test('una camera senza foto non esce con nessun img', () => {
  for (const id of SENZA_FOTO) {
    const out = disegna({ camera_id: id, nome: CAMERE[id]?.nome ?? 'Accessibile' });
    assertEquals(
      out.includes('<img'),
      false,
      `la camera ${id} è dichiarata senza foto ma la scheda contiene un img`,
    );
    assertEquals(out.includes('src=""'), false, 'src vuoto: il browser riscarica la pagina');
  }
});

Deno.test('il nome della camera finisce nell alt, passato per esc', () => {
  const out = disegna({ camera_id: 5, nome: 'Doppia "vista" & parco' });
  assertStringIncludes(out, 'alt="Doppia &quot;vista&quot; &amp; parco"');
  assertEquals(out.includes('alt="Doppia "vista"'), false,
    'il nome non e passato per esc: virgolette dentro un attributo lo spezzano');
});

Deno.test('tutte le categorie del catalogo si disegnano senza errori', () => {
  /* la prova che nessuna combinazione fa esplodere il modello: undici
     categorie vere, non una scelta a caso */
  let conFoto = 0;
  for (const [id, c] of Object.entries(CAMERE)) {
    const out = disegna({ camera_id: Number(id), nome: c.nome });
    assertStringIncludes(out, c.nome.slice(0, 8));
    if (out.includes('<img')) conFoto++;
  }
  const attese = Object.keys(CAMERE).length - SENZA_FOTO.length;
  assertEquals(conFoto, attese,
    `schede con foto: ${conFoto}, attese ${attese}`);
});

Deno.test('la foto del bagno non si annuncia come la camera', () => {
  /* la prova end-to-end del caso che ha fatto nascere altFoto: si disegna
     la scheda vera della categoria 8 e si guarda l'attributo che esce.
     foto.test.ts prova la funzione; qui si prova la SCHEDA. */
  const out = disegna({ camera_id: 8, nome: 'Junior Suite Accessibile' });
  assertStringIncludes(out, 'src="/prenota/img/junior-suite-accessibile-bagno.jpg"');
  assertStringIncludes(out, 'alt="Junior Suite Accessibile — il bagno attrezzato"');
  assertEquals(
    out.includes('alt="Junior Suite Accessibile"'),
    false,
    "l'alt annuncia la camera davanti alla foto di un bagno",
  );
});
