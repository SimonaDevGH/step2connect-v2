const { z } = require('zod');
const sanitizeHtml = require('sanitize-html');

const ALLOWED_TAGS = [
  'b', 'i', 'u', 'strong', 'em', 'ul', 'ol', 'li', 'p', 'br', 'a', 'h2', 'h3', 'img',
];
const ALLOWED_ATTRS = {
  a:   ['href', 'target'],
  img: ['src', 'alt'],
};
const ALLOWED_SCHEMES = { img: { src: ['http', 'https'] } };

function sanitize(str) {
  if (typeof str !== 'string') return str;
  return sanitizeHtml(str, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRS,
    allowedSchemesByTag: ALLOWED_SCHEMES,
  });
}

const translationSchema = z.object({
  title:    z.string().min(1).max(500),
  body:     z.string().max(50000).default(''),
  audioUrl: z.string().url().optional().or(z.literal('')),
  metaDesc: z.string().max(300).default(''),
});

const contentSchema = z.object({
  id:       z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/),
  type:     z.enum(['guides', 'news', 'library', 'pages']),
  category: z.string().max(100).default(''),
  emoji:    z.string().max(10).default('📄'),
  imageUrl: z.string().url().optional().or(z.literal('')),
  url:      z.string().max(500).optional().or(z.literal('')), // percorso pubblico, obbligatorio per pages lato UI
  it: translationSchema,
  en: translationSchema,
  bn: translationSchema,
}).superRefine((data, ctx) => {
  if (data.type === 'pages' && !data.url) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['url'],
      message: 'url è obbligatorio per il tipo pages',
    });
  }
  if (data.url && !data.url.startsWith('/')) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['url'],
      message: 'url deve iniziare con /',
    });
  }
});

/**
 * Valida e sanifica il payload del contenuto.
 * Lancia ZodError se non valido, altrimenti restituisce i dati puliti.
 */
function validateContent(raw) {
  const parsed = contentSchema.parse(raw);
  for (const lang of ['it', 'en', 'bn']) {
    parsed[lang].title    = sanitize(parsed[lang].title);
    parsed[lang].body     = sanitize(parsed[lang].body);
    parsed[lang].metaDesc = sanitize(parsed[lang].metaDesc);
  }
  return parsed;
}

module.exports = { validateContent };
