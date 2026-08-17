const { z } = require('zod');
const sanitizeHtml = require('sanitize-html');

const ALLOWED_TAGS = ['b', 'i', 'u', 'strong', 'em', 'ul', 'ol', 'li', 'p', 'br', 'a', 'h2', 'h3'];
const ALLOWED_ATTRS = { a: ['href', 'target'] };

function sanitize(str) {
  if (typeof str !== 'string') return str;
  return sanitizeHtml(str, { allowedTags: ALLOWED_TAGS, allowedAttributes: ALLOWED_ATTRS });
}

const translationSchema = z.object({
  title: z.string().min(1).max(500),
  body: z.string().max(50000).default(''),
  audioUrl: z.string().url().optional().or(z.literal('')),
});

const contentSchema = z.object({
  id: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/),
  type: z.enum(['guides', 'news', 'library']),
  category: z.string().max(100).default(''),
  emoji: z.string().max(10).default('📄'),
  imageUrl: z.string().url().optional().or(z.literal('')),
  it: translationSchema,
  en: translationSchema,
  bn: translationSchema,
});

/**
 * Valida e sanifica il payload del contenuto.
 * Lancia ZodError se non valido, altrimenti restituisce i dati puliti.
 */
function validateContent(raw) {
  const parsed = contentSchema.parse(raw);
  // Sanifica tutti i campi di testo
  for (const lang of ['it', 'en', 'bn']) {
    parsed[lang].title = sanitize(parsed[lang].title);
    parsed[lang].body  = sanitize(parsed[lang].body);
  }
  return parsed;
}

module.exports = { validateContent };
