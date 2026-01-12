const DEFAULT_COLOR = 'hsl(220 10% 35%)';

const normalizeLetter = (input: string) => {
  if (!input) return '';
  return input.trim().charAt(0).toUpperCase();
};

const getLetterIndex = (letter: string) => {
  const code = letter.charCodeAt(0);
  if (code < 65 || code > 90) return -1;
  return code - 65;
};

export const getLetterColor = (input: string) => {
  const letter = normalizeLetter(input);
  const index = getLetterIndex(letter);
  if (index < 0) return DEFAULT_COLOR;

  // Deterministic hue per letter using golden angle.
  const hue = (index * 137.508) % 360;
  return `hsl(${hue} 85% 40%)`;
};

export const buildLetterColorMap = () => {
  const map: Record<string, string> = {};
  for (let i = 0; i < 26; i += 1) {
    const letter = String.fromCharCode(65 + i);
    map[letter] = getLetterColor(letter);
  }
  return map;
};
