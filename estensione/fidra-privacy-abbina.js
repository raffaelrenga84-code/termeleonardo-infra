/* ============================================================
   Offerta Leonardo — la privacy appena salvata si abbina all'ospite (v2.44)
   ------------------------------------------------------------
   PERCHE' ESISTE. Su privacy/create Fidra crea la scheda privacy ma non la
   lega alla persona: nell'elenco (leonardo.fidra.cloud/privacy) resta la X
   rossa su «Nominativo hotel», e bisognava aprire la riga e premere «Abbina»
   sul suggerimento giusto («molti passaggi, troppo macchinoso», la
   proprieta', 5 settembre 2026).

   COSA FA. Dopo «Salva», fidra-privacy-crea.js lascia in sessionStorage chi
   e' l'ospite (leoAbbina) e porta all'elenco. Qui: nell'elenco si apre la
   riga di quella persona ancora senza nominativo; nella scheda, se fra i
   suggerimenti di Fidra c'e' UNA sola riga con lo stesso cognome e nome, si
   preme «Abbina» da soli — e' il gesto che la proprieta' ha chiesto di
   togliere alla reception. Con due omonimi, o senza suggerimento, non si
   preme niente: si dice cosa si e' trovato e la scelta resta all'operatore.
   Aprendo una scheda a mano (senza leoAbbina) si suggerisce soltanto.
   ============================================================ */
(() => {
  const ID = 'leoPrivacyAbbina';
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  /* nomi confrontabili: minuscole, senza accenti, spazi singoli */
  const norma = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const stessaPersona = (nominativo, cognome, nome) => {
    const n = norma(nominativo);
    return !!n && (n === norma(cognome + ' ' + nome) || n === norma(nome + ' ' + cognome));
  };
  const leggiAbbina = () => {
    try {
      const j = JSON.parse(sessionStorage.getItem('leoAbbina') || 'null');
      if (!j || !j.cognome || Date.now() - (j.quando || 0) > 15 * 60 * 1000) return null;
      return j;
    } catch (e) { return null; }
  };
  const dimentica = () => { try { sessionStorage.removeItem('leoAbbina'); sessionStorage.removeItem('leoPrivacy'); } catch (e) { /* niente */ } };

  function barra(html, colore) {
    let box = document.getElementById(ID);
    if (!box) {
      box = document.createElement('div');
      box.id = ID;
      const dove = document.querySelector('main') || document.body;
      dove.insertBefore(box, dove.firstChild);
    }
    box.style.cssText = 'margin:10px 16px;padding:10px 14px;background:' + (colore === 'ok' ? '#E8F3E8' : '#EAF4F5') + ';border-left:4px solid ' + (colore === 'ok' ? '#2E7D32' : '#1E7F88') + ';border-radius:4px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#2A2E2B;';
    box.innerHTML = html;
  }

  /* ---------- l'elenco: la riga della persona ancora senza nominativo ---------- */
  function elenco(ab) {
    const righe = [...document.querySelectorAll('tr')].filter((tr) => tr.querySelector('td'));
    /* colonne: Data, Cognome, Nome, Nominativo hotel, … — la quarta e' vuota
       quando la privacy non e' legata a nessuno (la X rossa) */
    const trovata = righe.find((tr) => {
      const c = [...tr.querySelectorAll('td')].map((td) => (td.textContent || '').trim());
      return c.length >= 4 && norma(c[1]) === norma(ab.cognome) && norma(c[2]) === norma(ab.nome) && !norma(c[3]);
    });
    const apri = trovata && trovata.querySelector('a[href*="/privacy/"]');
    if (!apri) { barra('Privacy salvata. Non trovo nell&rsquo;elenco la riga di <strong>' + esc(ab.cognome) + ' ' + esc(ab.nome) + '</strong> senza nominativo: la apra e prema Abbina.'); dimentica(); return; }
    barra('Apro la privacy di <strong>' + esc(ab.cognome) + ' ' + esc(ab.nome) + '</strong> per abbinarla all&rsquo;ospite…');
    location.href = apri.href;
  }

  /* ---------- la scheda: i suggerimenti di Fidra e il pulsante Abbina ---------- */
  function valoreSotto(etichetta) {
    const re = new RegExp('^' + etichetta + '$', 'i');
    const el = [...document.querySelectorAll('div, span, p, dt, label')].find((x) => !x.children.length && re.test((x.textContent || '').trim()));
    const dopo = el && el.nextElementSibling;
    return dopo ? (dopo.textContent || '').trim() : '';
  }
  function candidati(cognome, nome) {
    const bottoni = [...document.querySelectorAll('button, a')].filter((b) => /^abbina$/i.test((b.textContent || '').trim()));
    return bottoni.map((b) => {
      const tr = b.closest('tr');
      const celle = tr ? [...tr.querySelectorAll('td')].map((td) => (td.textContent || '').trim()) : [];
      const nominativo = celle.find((c) => stessaPersona(c, cognome, nome)) || '';
      return { bottone: b, celle, nominativo };
    }).filter((c) => c.nominativo);
  }
  function scheda(ab) {
    const cognome = ab ? ab.cognome : valoreSotto('Cognome');
    const nome = ab ? ab.nome : valoreSotto('Nome');
    if (!cognome) return;
    const trovati = candidati(cognome, nome);
    const descrizione = (c) => esc(c.nominativo) + (c.celle.filter((x) => x !== c.nominativo && x && !/^abbina$/i.test(x)).length ? ' (' + esc(c.celle.filter((x) => x !== c.nominativo && x && !/^abbina$/i.test(x)).join(' · ')) + ')' : '');
    if (!trovati.length) {
      if (ab) { barra('Privacy di <strong>' + esc(cognome) + ' ' + esc(nome) + '</strong> salvata, ma Fidra non suggerisce nessun arrivo con questo nome: scelga lei fra gli arrivi qui a destra, o lasci cosi&rsquo;.'); dimentica(); }
      return;
    }
    if (ab && trovati.length === 1) {
      /* il gesto che la proprieta' ha chiesto di togliere alla reception:
         una persona sola con quel nome, si abbina da soli */
      trovati[0].bottone.click();
      barra('&#10003; Privacy di <strong>' + esc(cognome) + ' ' + esc(nome) + '</strong> abbinata a ' + descrizione(trovati[0]) + '.', 'ok');
      dimentica();
      return;
    }
    barra((ab ? 'Privacy salvata. ' : '') + (trovati.length === 1 ? 'Stesso nome fra gli arrivi: ' : trovati.length + ' arrivi con lo stesso nome: ') + trovati.map(descrizione).join(' · ') + ' &mdash; prema <strong>Abbina</strong> su quello giusto.');
    if (ab) dimentica();
  }

  /* ---------- avvio: elenco o scheda, quando Livewire ha disegnato ---------- */
  const ab = leggiAbbina();
  const percorso = location.pathname.replace(/\/+$/, '');
  let tentativi = 0;
  const attesa = setInterval(() => {
    tentativi++;
    if (/^\/privacy$/.test(percorso)) {
      if (!ab) { clearInterval(attesa); return; }
      if (document.querySelector('tr td') || tentativi > 25) { clearInterval(attesa); elenco(ab); }
      return;
    }
    if (/^\/privacy\/\d+$/.test(percorso)) {
      const pronta = [...document.querySelectorAll('button, a')].some((b) => /^abbina$/i.test((b.textContent || '').trim())) || valoreSotto('Cognome');
      if (pronta || tentativi > 25) { clearInterval(attesa); scheda(ab); }
      return;
    }
    clearInterval(attesa);
  }, 700);
})();
