// src/sitemap.js — build sitemap.xml from the canonical route list + DB rows.
// No external deps.

const CORE = [
  '/', '/about', '/about/board', '/about/staff', '/about/principal',
  '/programs', '/programs/classes', '/programs/tcml', '/programs/recreational', '/programs/ta',
  '/enroll', '/calendar', '/news', '/events', '/media',
  '/parents/handbook', '/parents/volunteer', '/parents/scrip', '/documents',
  '/support', '/support/sponsors', '/contact', '/privacy', '/disclaimer',
];

function xmlEscape(s) {
  return String(s).replace(/[<>&"']/g, (c) => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;',
  })[c]);
}

export function buildSitemap({ base = 'http://localhost:3000' } = {}) {
  const urls = [];
  const push = (loc, changefreq = 'monthly', priority = '0.5') => {
    urls.push(`<url><loc>${base}${loc}</loc><changefreq>${changefreq}</changefreq><priority>${priority}</priority></url>`);
  };

  for (const lang of ['en', 'zh']) {
    for (const p of CORE) {
      push(`/${lang}${p}`, p === '/' ? 'daily' : 'weekly', p === '/' ? '1.0' : '0.6');
    }
  }
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.join('\n') +
    '\n</urlset>\n'
  );
}
