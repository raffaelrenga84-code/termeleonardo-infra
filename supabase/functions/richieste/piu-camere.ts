/* ============================================================
   piu-camere.ts — una richiesta, piu' camere.

   PERCHE' ESISTE. Chi prenota due camere faceva DUE RICHIESTE: compilava
   nome, email e telefono due volte, e riceveva due ricevute con due
   totali. La reception vedeva due fogli slegati, e assegnava due camere
   lontane a persone che viaggiano insieme.

   E NON SI POTEVA RISOLVERE MANDANDO N RICHIESTE DI FILA dal browser:
   TETTO_PERSONA in index.ts ferma a 3 richieste per mezz'ora. Alla quarta
   camera l'ospite avrebbe letto un rifiuto, e chi ne prenota tre avrebbe
   bruciato la propria quota senza poter piu' correggere niente.

   COME. Un invio solo porta la prima camera come sempre — nel corpo, con
   i contatti — e le altre in `altre[]`. Ognuna e' un soggiorno a se': ha
   le SUE date, la SUA camera, il SUO pacchetto, il SUO prezzo. Il caso
   vero da cui nasce (prenotazione Fidra #18968) e' proprio questo: una
   camera 18 notti col pacchetto cure, un'altra 2 notti in mezza pensione.

   QUESTO MODULO NON TOCCA IL DATABASE. Prende il corpo e restituisce le
   camere in piu' gia' convalidate, con la STESSA funzione che convalida
   la prima: se un domani cambia una regola sul soggiorno, cambia per
   tutte e non solo per quella che sta in cima al modulo.

   Presidiato da piu-camere.test.ts.
   ============================================================ */

import { componiRichiesta, type Composta } from './componi-richiesta.ts';

/* Quante camere in un colpo solo. Cinque e' gia' un gruppo, e ogni camera
   in piu' e' una riga a database e un numero di pratica: un tetto qui e'
   la differenza fra una comitiva e uno script. */
export const CAMERE_MAX = 5;

/* I campi che appartengono alla PERSONA e non alla camera: si prendono
   dal corpo e valgono per tutte. Chi prenota due stanze e' una persona
   sola, e non deve poter mandare due email diverse in un invio. */
const DELLA_PERSONA = [
  'nome',
  'email',
  'telefono',
  'lingua',
  'privacy_presa_atto',
] as const;

/* I campi che appartengono alla CAMERA: ognuna ha i suoi. */
const DELLA_CAMERA = [
  'check_in',
  'check_out',
  'ospiti',
  'tipo_camera',
  'pacchetto',
  'messaggio',
  'dati',
] as const;

export type Esito = { errore?: string; camere?: Composta[] };

/* Le camere in piu', convalidate. Senza `altre` restituisce una lista
   vuota: e' il caso normale di chi prenota una camera sola, e non deve
   costare niente. */
export function altreCamere(corpo: Record<string, unknown>): Esito {
  const grezze = corpo?.altre;
  if (grezze === undefined || grezze === null) return { camere: [] };
  if (!Array.isArray(grezze)) return { errore: 'camere in piu non leggibili' };
  if (grezze.length === 0) return { camere: [] };
  if (grezze.length > CAMERE_MAX - 1) {
    return { errore: `troppe camere in una richiesta sola (massimo ${CAMERE_MAX})` };
  }

  const camere: Composta[] = [];
  for (const [i, grezza] of grezze.entries()) {
    if (!grezza || typeof grezza !== 'object' || Array.isArray(grezza)) {
      return { errore: `camera ${i + 2} non leggibile` };
    }
    const sua = grezza as Record<string, unknown>;

    /* si ricompone un corpo intero: i contatti dalla persona, il resto
       dalla camera. Cosi' passa dalla stessa porta della prima. */
    const corpoSuo: Record<string, unknown> = { tipo: 'soggiorno' };
    for (const k of DELLA_PERSONA) corpoSuo[k] = corpo[k];
    for (const k of DELLA_CAMERA) if (k in sua) corpoSuo[k] = sua[k];

    const composta = componiRichiesta(corpoSuo);
    if (composta.errore || !composta.contatti || !composta.colonne) {
      /* si dice QUALE camera, o l'ospite non sa quale correggere */
      return { errore: `camera ${i + 2}: ${composta.errore ?? 'non valida'}` };
    }
    camere.push(composta);
  }
  return { camere };
}

/* Il jsonb di una camera in piu', col numero della richiesta a cui
   appartiene. E' il filo che le tiene insieme in back office, e non una
   frase nelle note: una frase la si legge, un campo lo si cerca. */
export function conIlNumero(
  dati: Record<string, unknown> | null | undefined,
  numero: string,
): Record<string, unknown> {
  return { ...(dati ?? {}), insieme: String(numero) };
}
