// Text Normalizer for Vietnamese TTS
// Handles: numbers, Roman numerals, acronyms, foreign words,
//          Chinese punctuation, full-width chars, special symbols

// ─────────────────────────────────────────────────────────────
// Number → Vietnamese text
// ─────────────────────────────────────────────────────────────

const UNITS = ['', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];

function readThreeDigits(number: number, readZeroHundreds: boolean): string {
  const hundred = Math.floor(number / 100);
  const ten = Math.floor((number % 100) / 10);
  const unit = number % 10;
  let result = '';

  if (hundred > 0 || readZeroHundreds) {
    result += UNITS[hundred] + ' trăm ';
  }

  if (ten > 1) {
    result += UNITS[ten] + ' mươi ';
    if (unit === 1) result += 'mốt';
    else if (unit === 5) result += 'lăm';
    else if (unit > 0) result += UNITS[unit];
  } else if (ten === 1) {
    result += 'mười ';
    if (unit === 5) result += 'lăm';
    else if (unit > 0) result += UNITS[unit];
  } else if (ten === 0 && unit > 0) {
    if (hundred > 0 || readZeroHundreds) result += 'lẻ ';
    if (unit === 5 && (hundred > 0 || readZeroHundreds)) result += 'lăm';
    else result += UNITS[unit];
  }

  return result.trim();
}

export function numberToVietnameseText(num: number): string {
  if (num === 0) return 'không';
  if (isNaN(num)) return '';

  let n = Math.abs(num);
  let result = '';
  const scale = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ'];
  let scaleIndex = 0;

  while (n > 0) {
    const threeDigits = n % 1000;
    if (threeDigits > 0) {
      const readZero = n >= 1000;
      const text = readThreeDigits(threeDigits, readZero);
      const scaleName = scale[scaleIndex];
      result = `${text} ${scaleName} ${result}`.trim();
    }
    n = Math.floor(n / 1000);
    scaleIndex++;
  }

  return (num < 0 ? 'âm ' : '') + result.trim();
}

// ─────────────────────────────────────────────────────────────
// Roman Numerals → integer
// ─────────────────────────────────────────────────────────────
const ROMAN_MAP: Record<string, number> = {
  I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000
};

export function romanToNumber(roman: string): number {
  const str = roman.toUpperCase();
  let result = 0;
  for (let i = 0; i < str.length; i++) {
    const current = ROMAN_MAP[str[i]];
    const next = ROMAN_MAP[str[i + 1]];
    if (next && current < next) {
      result += next - current;
      i++;
    } else {
      result += current;
    }
  }
  return result;
}

// ─────────────────────────────────────────────────────────────
// Chinese/CJK punctuation → ASCII/Vietnamese equivalents
// ─────────────────────────────────────────────────────────────
const CJK_PUNCT: [string | RegExp, string][] = [
  // Quotation marks
  [/[「「『』〈〉《》【】〔〕]/g, ' '],
  [/[""„‟]/g, '"'],
  [/[''‛‚]/g, "'"],
  // Full-width punctuation → half-width
  [/，/g, ', '],
  [/。/g, '. '],
  [/！/g, '! '],
  [/？/g, '? '],
  [/；/g, '; '],
  [/：/g, ': '],
  [/、/g, ', '],
  [/…+/g, '... '],      // ellipsis
  [/—+/g, ', '],         // em dash
  [/–/g, '-'],           // en dash
  [/～/g, ' đến '],
  // Ideographic space
  [/\u3000/g, ' '],
  // Middle dot / bullet
  [/[·•‧]/g, ' '],
  // Ordinal / special chars that sneak in from web scraping
  [/\u00b7/g, ' '],
  [/\u2022/g, ' '],
];

// ─────────────────────────────────────────────────────────────
// Decorative / emoji symbols to strip
// ─────────────────────────────────────────────────────────────
const DECORATIVE_RE = /[※★♦●▲▼▪▫◆◇✦✧✨⭐🎈🎉🎏🎊🔖📑📌📍♠♣♥\u2600-\u27BF\uD83C-\uD83E]/gu;

// ─────────────────────────────────────────────────────────────
// Main normalizer
// ─────────────────────────────────────────────────────────────
export function normalizeText(
  text: string,
  acronymsMap?: Record<string, string>,
  foreignWordsMap?: Record<string, string>
): string {
  if (!text) return '';

  let str = text;

  // 1. Strip HTML tags
  str = str.replace(/<[^>]*>/g, ' ');

  // 2. CJK punctuation → readable equivalents
  for (const [pattern, replacement] of CJK_PUNCT) {
    if (typeof replacement === 'string') {
      str = str.replace(pattern as RegExp, replacement);
    }
  }

  // 3. Full-width alphanumeric → ASCII (e.g. Ａ→A, １→1)
  str = str.replace(/[\uFF01-\uFF5E]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));

  // 4. Remove decorative symbols
  str = str.replace(DECORATIVE_RE, ' ');

  // 5. Convert Roman Numerals after words like "Chương", "Tập", etc.
  str = str.replace(/\b(Chương|Tập|Thế kỷ|Quyển|Phần|Hồi|Tiết|Mục)\s+([IVXLCDM]{1,10})\b/gi,
    (_, prefix, roman) => {
      const num = romanToNumber(roman);
      return num > 0 ? `${prefix} ${numberToVietnameseText(num)}` : `${prefix} ${roman}`;
    }
  );

  // 5. Ordinal numbers like "1." / "1)" at start of line → read as number
  str = str.replace(/^\s*(\d+)[.)]\s+/gm, (_, n) => `${numberToVietnameseText(parseInt(n))}. `);

  // 6. Currency: 1.000đ / 1,000 VND / $1,000
  str = str.replace(/\$(\d[\d,.]*)/g, (_, n) =>
    numberToVietnameseText(parseInt(n.replace(/[,.]/g, ''))) + ' đô la'
  );
  str = str.replace(/(\d[\d,.]*)\s*(đ|VNĐ|VND)\b/gi, (_, n, unit) =>
    numberToVietnameseText(parseInt(n.replace(/[,.]/g, ''))) + ' đồng'
  );

  // 7. Decimal numbers: 3.14 → ba phẩy mười bốn
  str = str.replace(/\b(\d+)[,.](\d+)\b/g, (_, whole, decimal) =>
    `${numberToVietnameseText(parseInt(whole))} phẩy ${numberToVietnameseText(parseInt(decimal))}`
  );

  // 8. Plain integers (after currency/decimal handling)
  str = str.replace(/\b\d+\b/g, (match) => numberToVietnameseText(parseInt(match, 10)));

  // 9. Percentage
  str = str.replace(/(\d+)\s*%/g, (_, n) => `${numberToVietnameseText(parseInt(n))} phần trăm`);

  // 10. Replace Acronyms (case-sensitive keys)
  if (acronymsMap) {
    for (const [key, value] of Object.entries(acronymsMap)) {
      const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(?<![A-Za-zÀ-ỹ])${escaped}(?![A-Za-zÀ-ỹ])`, 'g');
      str = str.replace(regex, value);
    }
  }

  // 11. Replace foreign words (case-insensitive)
  if (foreignWordsMap) {
    for (const [key, value] of Object.entries(foreignWordsMap)) {
      const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(?<![A-Za-zÀ-ỹ])${escaped}(?![A-Za-zÀ-ỹ])`, 'gi');
      str = str.replace(regex, value);
    }
  }

  // 12. Normalize quotation/dash for TTS comfort
  str = str.replace(/["""]/g, ' ');
  str = str.replace(/[-–—]{2,}/g, ', ');   // multiple dashes → pause
  str = str.replace(/\.\.\./g, ' ');        // ellipsis → pause

  // 13. Clean up extra whitespace
  str = str.replace(/\s+/g, ' ').trim();

  return str;
}

// ─────────────────────────────────────────────────────────────
// Split chapter content into sentences for TTS chunking
// ─────────────────────────────────────────────────────────────
export function splitIntoSentences(text: string): string[] {
  if (!text) return [];

  // Split after sentence terminators: . ! ? ; and newlines
  // Keep the terminator attached to the preceding sentence
  const rawSentences = text.split(/(?<=[.!?;\n])\s+/);
  const sentences: string[] = [];

  for (let s of rawSentences) {
    s = s.trim();
    if (!s) continue;

    // Split very long sentences further at commas
    if (s.length > 200) {
      const subParts = s.split(/(?<=[,])\s+/);
      for (const sub of subParts) {
        const trimmed = sub.trim();
        if (trimmed) sentences.push(trimmed);
      }
    } else {
      sentences.push(s);
    }
  }

  return sentences;
}
