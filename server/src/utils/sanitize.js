const escapeHTML = (str) =>
  str.replace(
    /[&<>"']/g,
    (tag) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[tag]
  );

const stripControlChars = (value) => value.replace(/[\u0000-\u001F\u007F]/g, '');

export const sanitizeText = (value) => escapeHTML(stripControlChars(String(value || '')).trim());

export const sanitizeName = (value) => sanitizeText(value).replace(/\s+/g, ' ').slice(0, 60);

export const sanitizeEmail = (value) => sanitizeText(value).toLowerCase().slice(0, 254);

export const sanitizeTitle = (value) => sanitizeText(value).slice(0, 120);

export const sanitizeBody = (value) => stripControlChars(String(value || '')).slice(0, 12000);

export const sanitizeTag = (value) => sanitizeText(value).replace(/\s+/g, ' ').slice(0, 24);

export const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export const isValidHexColor = (value) => /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value);
