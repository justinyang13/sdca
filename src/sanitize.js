// src/sanitize.js — the one HTML allow-list for rich text (markdown output and admin-edited bodies).
import sanitizeHtml from 'sanitize-html';

const OPTIONS = {
  allowedTags: [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'ul', 'ol', 'li', 'strong', 'em', 'del',
    'a', 'code', 'pre', 'blockquote', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'br', 'hr', 'span', 'img', 'details', 'summary',
  ],
  allowedAttributes: {
    a: ['href', 'title', 'rel', 'target'],
    img: ['src', 'alt', 'width', 'height'],
  },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
};

/** Clean untrusted rich text down to the allowed tags, attributes and URL schemes. */
export const sanitizeRich = (html) => sanitizeHtml(String(html ?? ''), OPTIONS);
