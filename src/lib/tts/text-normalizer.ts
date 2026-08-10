// Text Normalizer for Vietnamese TTS

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

// Convert Roman numerals to integers
const ROMAN_MAP: Record<string, number> = {
  I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000
};

export function romanToNumber(roman: string): number {
  let str = roman.toUpperCase();
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

export function normalizeText(
  text: string,
  acronymsMap?: Record<string, string>,
  foreignWordsMap?: Record<string, string>
): string {
  if (!text) return '';

  let str = text;

  // 1. Strip HTML tags
  str = str.replace(/<[^>]*>/g, ' ');

  // 2. Remove unwanted decorative symbols
  str = str.replace(/[※★♦♦●▲▼▪▫◆◇✦✧✨⭐🎈🎉🎏🎊🔖🔖📑📌📍◆◇♠♣♥♦]/g, ' ');

  // 3. Convert Roman Numerals after words like "Chương", "Tập", "Thế kỷ"
  str = str.replace(/\b(Chương|Tập|Thế kỷ|Quyển|Phần)\s+([IVXLCDM]+)\b/gi, (_, prefix, roman) => {
    const num = romanToNumber(roman);
    return `${prefix} ${numberToVietnameseText(num)}`;
  });

  // 4. Convert numbers to words (handling decimals like 3.14 -> 3 phẩy 14)
  str = str.replace(/\b(\d+)[,.](\d+)\b/g, (_, whole, decimal) => {
    return `${numberToVietnameseText(parseInt(whole))} phẩy ${numberToVietnameseText(parseInt(decimal))}`;
  });

  str = str.replace(/\b\d+\b/g, (match) => {
    const num = parseInt(match, 10);
    return numberToVietnameseText(num);
  });

  // 5. Replace Acronyms if map provided
  if (acronymsMap) {
    for (const [key, value] of Object.entries(acronymsMap)) {
      const regex = new RegExp(`\\b${key}\\b`, 'g');
      str = str.replace(regex, value);
    }
  }

  // 6. Replace foreign words if map provided
  if (foreignWordsMap) {
    for (const [key, value] of Object.entries(foreignWordsMap)) {
      const regex = new RegExp(`\\b${key}\\b`, 'gi');
      str = str.replace(regex, value);
    }
  }

  // 7. Clean up extra spaces
  str = str.replace(/\s+/g, ' ').trim();

  return str;
}

// Split chapter content into sentences for TTS chunking
export function splitIntoSentences(text: string): string[] {
  if (!text) return [];

  // Split by sentence terminators (. ! ? ; \n)
  const rawSentences = text.split(/(?<=[.!?;\n])\s+/);
  const sentences: string[] = [];

  for (let s of rawSentences) {
    s = s.trim();
    if (!s) continue;

    // If a sentence is very long (> 200 chars), split further by commas
    if (s.length > 200) {
      const subParts = s.split(/(?<=[,])\s+/);
      for (const sub of subParts) {
        if (sub.trim()) sentences.push(sub.trim());
      }
    } else {
      sentences.push(s);
    }
  }

  return sentences;
}
