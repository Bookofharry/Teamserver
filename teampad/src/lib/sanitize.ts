// eslint-disable-next-line no-control-regex
const controlCharsRegex = new RegExp("[\\u0000-\\u001F\\u007F]", "g");

const stripControlChars = (value: string) => value.replace(controlCharsRegex, "");

export const sanitizeText = (value: string) => stripControlChars(value).trim();

export const sanitizeName = (value: string) =>
  sanitizeText(value)
    .replace(/\s+/g, " ")
    .slice(0, 80);

export const sanitizeEmail = (value: string) => sanitizeText(value).toLowerCase().slice(0, 254);
