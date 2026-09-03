/* ============================================================
   copie.test.ts — le copie prese dalle altre funzioni restano identiche.

   Le funzioni Supabase non condividono file: qr.js viene da buoni/ e
   limite-ip.ts da richieste/, copiati. Se una copia diverge, questa prova
   lo dice prima che il QR del Day Spa e quello dei buoni comincino a
   differire, o che un freno abbia una regola e l'altro un'altra.
   ============================================================ */
import { assertEquals } from 'jsr:@std/assert';

const leggi = (p: string) => Deno.readTextFileSync(new URL(p, import.meta.url));

Deno.test('qr.js e la stessa copia dei buoni', () => {
  assertEquals(leggi('./qr.js'), leggi('../buoni/qr.js'));
});

Deno.test('limite-ip.ts e la stessa copia delle richieste', () => {
  assertEquals(leggi('./limite-ip.ts'), leggi('../richieste/limite-ip.ts'));
});
