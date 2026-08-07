/**
 * Supabase Edge Function: Proxy CSRF per termeleonardo.com
 *
 * Problema: /api/available/rates è protetto da CSRF (Laravel).
 * Soluzione: carichiamo la homepage come un browser, estraiamo il token CSRF
 * e il cookie di sessione, poi li riusiamo per la vera richiesta.
 */

const SITE_BASE = 'https://www.termeleonardo.com';
const RATES_ENDPOINT = `${SITE_BASE}/api/available/rates`;
const HOMEPAGE_URL = `${SITE_BASE}/it`;

interface CachedSession {
  cookie: string;
  csrfToken: string;
  fetchedAt: number;
}

interface RequestBody {
  from_date: string;
  to_date: string;
  adults: number;
  children?: number;
  children_ages?: string;
}

// Cache in-memory (dura finché la funzione è "warm")
let cachedSession: CachedSession | null = null;
const SESSION_TTL_MS = 5 * 60 * 1000; // 5 minuti

function parseSetCookies(setCookieHeaders: string[]): string {
  return setCookieHeaders
    .map((c) => c.split(';')[0])
    .join('; ');
}

async function fetchFreshSession(): Promise<CachedSession> {
  const res = await fetch(HOMEPAGE_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; TermeLeonardoProxy/1.0)',
      Accept: 'text/html',
    },
  });

  if (!res.ok) {
    throw new Error(
      `Impossibile caricare la homepage (status ${res.status})`
    );
  }

  const html = await res.text();

  // Estrai il token CSRF dal meta tag
  const tokenMatch = html.match(
    /<meta\s+name=["']csrf-token["']\s+content=["']([^"']+)["']/i
  );
  const csrfToken = tokenMatch ? tokenMatch[1] : null;

  if (!csrfToken) {
    throw new Error('Token CSRF non trovato nella homepage');
  }

  // Estrai i cookie da Set-Cookie header
  const setCookieHeaders = res.headers.getSetCookie?.() || [];
  const cookie = parseSetCookies(setCookieHeaders);

  if (!cookie) {
    throw new Error('Cookie di sessione non trovato');
  }

  return { cookie, csrfToken, fetchedAt: Date.now() };
}

async function getSession(forceRefresh = false): Promise<CachedSession> {
  const isStale =
    !cachedSession || Date.now() - cachedSession.fetchedAt > SESSION_TTL_MS;

  if (forceRefresh || isStale) {
    cachedSession = await fetchFreshSession();
  }

  return cachedSession;
}

Deno.serve(async (req) => {
  // CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, x-proxy-key',
      },
    });
  }

  // Solo POST
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Verifica proxy key (opzionale)
  const PROXY_KEY = Deno.env.get('PROXY_KEY');
  const requestKey = req.headers.get('x-proxy-key');

  if (PROXY_KEY && requestKey !== PROXY_KEY) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Parse body
  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON in body' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  const { from_date, to_date, adults, children, children_ages } = body;

  // Validazione
  if (!from_date || !to_date || adults === undefined) {
    return new Response(
      JSON.stringify({
        error: 'from_date, to_date e adults sono obbligatori',
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  const requestBody = {
    from_date,
    to_date,
    adults,
    ...(children !== undefined ? { children } : {}),
    ...(children_ages !== undefined ? { children_ages } : {}),
    locale: 'it',
  };

  // Retry loop: primo tentativo con cache, secondo con sessione nuova
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const session = await getSession(attempt === 2);

      const apiRes = await fetch(RATES_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'X-CSRF-TOKEN': session.csrfToken,
          Cookie: session.cookie,
          'User-Agent': 'Mozilla/5.0 (compatible; TermeLeonardoProxy/1.0)',
        },
        body: JSON.stringify(requestBody),
      });

      // Se 419 al primo tentativo, riprova con sessione nuova
      if (apiRes.status === 419 && attempt === 1) {
        continue;
      }

      const text = await apiRes.text();
      let data: unknown;

      try {
        data = JSON.parse(text);
      } catch {
        return new Response(
          JSON.stringify({
            error: 'Risposta inattesa dal sito (non è JSON)',
            upstream_status: apiRes.status,
          }),
          {
            status: 502,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      if (!apiRes.ok) {
        return new Response(
          JSON.stringify({
            error: 'Errore dal sistema di prenotazione',
            upstream_status: apiRes.status,
            details: data,
          }),
          {
            status: apiRes.status,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      return new Response(JSON.stringify(data), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    } catch (err) {
      if (attempt === 2) {
        console.error('check-availability error:', err);
        return new Response(
          JSON.stringify({
            error: 'Impossibile contattare il sistema di prenotazione',
            message: err instanceof Error ? err.message : String(err),
          }),
          {
            status: 502,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
    }
  }

  return new Response(
    JSON.stringify({ error: 'Unknown error' }),
    {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    }
  );
});
