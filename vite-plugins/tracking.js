// Inietta in index.html, al build, banner cookie (CookieYes), Google Consent
// Mode v2 e Google Tag Manager. Ogni pezzo si attiva solo se il relativo ID è
// impostato (VITE_COOKIEYES_ID, VITE_GTM_ID): senza ID l'HTML resta invariato.
//
// Ordine nel <head>: consenso di default "denied" → CookieYes (aggiorna il
// consenso quando l'utente sceglie) → GTM. Così GA non scrive cookie finché
// l'utente non accetta i cookie statistici.

const GTM_ID_RE = /^GTM-[A-Z0-9]+$/;
const COOKIEYES_ID_RE = /^[a-f0-9]{16,64}$/;

const CSP_SOURCES = {
  gtm: {
    'script-src': ['https://www.googletagmanager.com', 'https://tagmanager.google.com'],
    'img-src': ['https://www.googletagmanager.com', 'https://*.google-analytics.com', 'https://ssl.gstatic.com', 'https://www.gstatic.com'],
    'connect-src': ['https://www.googletagmanager.com', 'https://*.google-analytics.com', 'https://*.analytics.google.com'],
    'frame-src': ['https://www.googletagmanager.com'],
    'style-src': ['https://tagmanager.google.com', 'https://fonts.googleapis.com'],
    'font-src': ['https://fonts.gstatic.com'],
  },
  cookieyes: {
    'script-src': ['https://cdn-cookieyes.com'],
    'img-src': ['https://cdn-cookieyes.com'],
    'connect-src': ['https://log.cookieyes.com', 'https://cdn-cookieyes.com'],
  },
};

export function validateTrackingIds({ gtmId = '', cookieyesId = '' } = {}) {
  const gtm = gtmId.trim();
  const cky = cookieyesId.trim();
  if (gtm && !GTM_ID_RE.test(gtm)) throw new Error(`VITE_GTM_ID non valido: "${gtm}" (atteso GTM-XXXXXXX)`);
  if (cky && !COOKIEYES_ID_RE.test(cky)) throw new Error(`VITE_COOKIEYES_ID non valido: "${cky}" (atteso l'ID esadecimale del sito CookieYes)`);
  return { gtmId: gtm, cookieyesId: cky };
}

// Aggiunge sorgenti alle direttive del meta CSP, creando la direttiva se manca.
export function extendCsp(csp, additions) {
  const directives = csp.split(';').map((d) => d.trim()).filter(Boolean);
  for (const [name, sources] of Object.entries(additions)) {
    const idx = directives.findIndex((d) => d.split(/\s+/)[0] === name);
    if (idx === -1) {
      directives.push(`${name} 'self' ${sources.join(' ')}`);
      continue;
    }
    const present = new Set(directives[idx].split(/\s+/));
    const missing = sources.filter((s) => !present.has(s));
    if (missing.length) directives[idx] = `${directives[idx]} ${missing.join(' ')}`;
  }
  return directives.join('; ') + ';';
}

function mergeAdditions(...sets) {
  const out = {};
  for (const set of sets) {
    for (const [name, sources] of Object.entries(set)) out[name] = [...(out[name] || []), ...sources];
  }
  return out;
}

export function injectTracking(html, ids) {
  const { gtmId, cookieyesId } = validateTrackingIds(ids);
  if (!gtmId && !cookieyesId) return html;

  const head = [];
  // Consent Mode v2: tutto negato finché il banner non registra una scelta.
  head.push(`<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',functionality_storage:'granted',security_storage:'granted',wait_for_update:2000});gtag('set','ads_data_redaction',true);</script>`);
  if (cookieyesId) {
    head.push(`<script id="cookieyes" type="text/javascript" src="https://cdn-cookieyes.com/client_data/${cookieyesId}/script.js"></script>`);
  }
  if (gtmId) {
    head.push(`<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtmId}');</script>`);
  }

  let out = html.replace(/(<meta http-equiv="Content-Security-Policy" content=")([^"]*)(")/, (_m, a, csp, b) =>
    a + extendCsp(csp, mergeAdditions(gtmId ? CSP_SOURCES.gtm : {}, cookieyesId ? CSP_SOURCES.cookieyes : {})) + b);

  // Subito dopo il meta CSP, prima di qualunque altro script.
  out = out.replace(/(<meta http-equiv="Content-Security-Policy"[^>]*>)/, `$1\n    ${head.join('\n    ')}`);

  if (gtmId) {
    out = out.replace(/<body([^>]*)>/, `<body$1>\n    <noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${gtmId}" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>`);
  }
  return out;
}

export default function trackingPlugin(env) {
  const ids = validateTrackingIds({ gtmId: env.VITE_GTM_ID || '', cookieyesId: env.VITE_COOKIEYES_ID || '' });
  return {
    name: 'step2connect-tracking',
    transformIndexHtml: (html) => injectTracking(html, ids),
  };
}
