/* ============================================================
   server.js — quale server, e la coda quando nessuno risponde.

   Il palmare prova prima il PC del Bistrot (rete locale); se non risponde
   entro un secondo usa il cloud; riprova il PC ogni 30 secondi e torna su
   di lui appena risponde. Il cameriere non fa nulla: vede solo un pallino.
   Puro: ping, orologio e deposito sono iniettati, cosi' si prova senza rete.
   ============================================================ */
export function creaServer({ locale, cloud, ping, timeoutMs = 1000, ogniMs = 30000, adesso = Date.now }) {
  let corrente = 'cloud', ultimoTentativo = -Infinity;
  const provaLocale = async () => {
    try {
      const ok = await Promise.race([ping(locale), new Promise((r) => setTimeout(() => r(false), timeoutMs))]);
      return ok === true;
    } catch { return false; }
  };
  return {
    async base() {
      if (!locale) { corrente = 'cloud'; return cloud; }
      if (corrente === 'locale' || adesso() - ultimoTentativo >= ogniMs) {
        ultimoTentativo = adesso();
        corrente = (await provaLocale()) ? 'locale' : 'cloud';
      }
      return corrente === 'locale' ? locale : cloud;
    },
    stato() { return corrente; },
    /* il locale ha smesso di rispondere a meta' strada: si passa subito al cloud */
    localeCaduto() { corrente = 'cloud'; ultimoTentativo = adesso(); },
  };
}

/** La coda delle richieste che nessun server ha ricevuto: si mandano in
    ordine appena qualcuno risponde. Un errore di rete ferma la coda (si
    riprova dopo); un errore del server butta via la richiesta, perche' il
    server l'ha vista e l'ha rifiutata. */
export function creaCoda({ salva, leggi }) {
  const eRete = (e) => e instanceof TypeError || /fetch|network|rete|timeout/i.test(String(e && e.message));
  return {
    metti(richiesta) { salva([...(leggi() || []), richiesta]); },
    quante() { return (leggi() || []).length; },
    async svuota(chiama) {
      let coda = leggi() || [];
      while (coda.length) {
        try { await chiama(coda[0]); coda = coda.slice(1); salva(coda); }
        catch (e) { if (eRete(e)) break; coda = coda.slice(1); salva(coda); }
      }
      return { rimaste: coda.length };
    },
  };
}
