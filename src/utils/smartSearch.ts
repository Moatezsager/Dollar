// Smart Search & Typo-Tolerant Engine for Dinar Index (Currencies & Metals)

// 1. Arabic Text Normalization (Diacritics, letter unification, and phonetic equivalences)
export function normalizeArabicText(text: string): string {
  if (!text) return '';
  return text
    .trim()
    .toLowerCase()
    // Remove diacritics / tashkeel
    .replace(/[\u064B-\u065F\u0670]/g, '')
    // Normalize alef variants
    .replace(/[إأآٱ]/g, 'ا')
    // Normalize taa marbouta and haa
    .replace(/ة/g, 'ه')
    // Normalize yaa variants
    .replace(/[ىئ]/g, 'ي')
    // Normalize waw with hamza
    .replace(/ؤ/g, 'و')
    // Normalize persian/urdu forms
    .replace(/گ/g, 'ك')
    .replace(/چ/g, 'ج')
    .replace(/پ/g, 'ب')
    // Remove tatweel (kashida)
    .replace(/\u0640/g, '')
    // Normalize multiple spaces
    .replace(/\s+/g, ' ');
}

// 2. Phonetic Normalization (for common Arabic typos: دهب -> ذهب, شكوك -> صكوك, إلخ)
export function phoneticNormalize(text: string): string {
  const norm = normalizeArabicText(text);
  return norm
    .replace(/ذ/g, 'د')
    .replace(/ظ/g, 'ض')
    .replace(/ث/g, 'س')
    .replace(/ص/g, 'س')
    .replace(/ش/g, 'س');
}

// 3. Levenshtein Distance for typo tolerance
export function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

// 4. Similarity ratio (0 to 1)
export function calculateSimilarity(str1: string, str2: string): number {
  const s1 = normalizeArabicText(str1);
  const s2 = normalizeArabicText(str2);
  if (s1 === s2) return 1.0;
  if (s1.includes(s2) || s2.includes(s1)) return 0.9;

  // Check phonetic
  const p1 = phoneticNormalize(str1);
  const p2 = phoneticNormalize(str2);
  if (p1 === p2) return 0.88;
  if (p1.includes(p2) || p2.includes(p1)) return 0.82;

  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 1.0;

  const dist = levenshteinDistance(s1, s2);
  return Math.max(0, (maxLen - dist) / maxLen);
}

// 5. Searchable Item Interface
export interface SearchableItem {
  id: string;
  code: string;
  name: string;
  category: 'parallel' | 'checks' | 'transfers' | 'metals' | 'official';
  categoryLabel: string;
  flag: string;
  unit?: string;
  aliases: string[];
  rate?: number;
  prevRate?: number;
  trend?: number;
  lastChangedDate?: string;
  decimals?: number;
}

// 6. Curated Aliases & Synonyms Dictionary (Typo-tolerant bank)
export const KEYWORD_ALIASES: Record<string, string[]> = {
  // Cash USD
  "USD": [
    "دولار", "دولر", "امريكي", "دولار كاش", "دولر كاش", "كاش", "نقدي", "ورق", 
    "dollar", "usd", "dolar", "doolar", "us", "امريكا", "طرابلس", "بنغازي"
  ],
  // Euro
  "EUR": [
    "يورو", "اورو", "أورو", "يورو كاش", "اوروبي", "euro", "eur", "eu", "اوربا"
  ],
  // British Pound
  "GBP": [
    "باوند", "باوندات", "استرليني", "استرليني كاش", "جنيه استرليني", "بريطاني", "لندن", "gbp", "pound", "gb"
  ],
  // Tunisian Dinar
  "TND": [
    "تونسي", "دينار تونسي", "تونس", "راس جدير", "tnd", "tunis", "tunisie"
  ],
  // Turkish Lira
  "TRY": [
    "تركي", "ليرة تركية", "ليره", "تركيا", "try", "turkey", "lira"
  ],
  // Egyptian Pound
  "EGP": [
    "مصري", "جنيه مصري", "مصر", "امساعد", "egp", "egypt", "masri"
  ],
  // Jordanian Dinar
  "JOD": [
    "اردني", "دينار اردني", "الاردن", "jod", "jordan"
  ],
  // Emirati Dirham
  "AED": [
    "اماراتي", "درهم", "درهم اماراتي", "دبي", "الامارات", "aed", "dirham"
  ],
  // Saudi Riyal
  "SAR": [
    "سعودي", "ريال", "ريال سعودي", "السعودية", "sar", "riyal"
  ],
  // Canadian Dollar
  "CAD": [
    "كندي", "دولار كندي", "كندا", "cad"
  ],
  // Kuwaiti Dinar
  "KWD": [
    "كويتي", "دينار كويتي", "الكويت", "kwd"
  ],
  // Chinese Yuan
  "CNY": [
    "صيني", "يوان", "يوان صيني", "الصين", "cny", "yuan"
  ],

  // --- Bank Checks ---
  "USD_CHECKS": [
    "صكوك", "شكوك", "شيك", "شيكات", "صك", "صكوك مصارف", "دولار صكوك", "شيك مصدق", "مصارف", "بنوك", "check", "checks"
  ],
  "USD_JBANK": [
    "تجارة", "تجاره", "تجارة وتنمية", "مصرف التجارة والتنمية", "صك تجارة", "شيك تجارة", "بنك التجارة"
  ],
  "USD_WAHA": [
    "واحة", "واحه", "الواحة", "مصرف الواحة", "صك الواحة", "شيك الواحة"
  ],
  "USD_NCB": [
    "اهلي", "الاهلي", "التجاري الوطني", "المصرف التجاري الوطني", "صك الاهلي", "شيك الاهلي", "ncb"
  ],
  "USD_AMAN": [
    "امان", "الأمان", "مصرف الأمان", "صك الأمان", "شيك الأمان", "aman"
  ],
  "USD_ISLAMIC": [
    "اسلامي", "الإسلامي", "المصرف الإسلامي الليبي", "صك اسلامي", "شيك اسلامي"
  ],
  "USD_ALSARAY": [
    "سراي", "السراي", "مصرف السراي", "صك السراي", "شيك السراي", "atib"
  ],
  "USD_ATIB": [
    "متحد", "المتحد", "المصرف المتحد", "صك المتحد"
  ],
  "USD_BOC": [
    "شمال افريقيا", "شمال أفريقيا", "مصرف شمال افريقيا", "صك شمال افريقيا"
  ],
  "USD_NAB": [
    "جمهورية", "الجمهورية", "مصرف الجمهورية", "صك الجمهورية", "شيك الجمهورية"
  ],

  // --- Transfers ---
  "USD_TR": [
    "حوالة تركيا", "حوالات تركيا", "حواله تركيا", "تركيا دولار", "تحويل تركيا"
  ],
  "USD_AE": [
    "حوالة دبي", "حوالات دبي", "حواله دبي", "دبي دولار", "تحويل دبي", "الامارات حوالة"
  ],
  "USD_CN": [
    "حوالة الصين", "حوالات الصين", "حواله الصين", "الصين دولار", "تحويل الصين"
  ],

  // --- Precious Metals (الذهب والفضة) ---
  "GOLD_SCRAP_18": [
    "ذهب 18", "دهب 18", "كسر 18", "سكراب 18", "ذهب كسر 18", "دهب كسر 18", "عيار 18", 
    "ذهب عيار 18", "دهب عيار 18", "ذهب قديم 18", "gold 18", "scrap 18"
  ],
  "GOLD_SCRAP_21": [
    "ذهب 21", "دهب 21", "كسر 21", "سكراب 21", "ذهب كسر 21", "دهب كسر 21", "عيار 21", 
    "ذهب عيار 21", "دهب عيار 21", "gold 21", "scrap 21"
  ],
  "GOLD_CAST_18": [
    "مسبوك 18", "ذهب مسبوك 18", "دهب مسبوك 18", "سبائك 18", "سبيكة 18", "ايطالي 18"
  ],
  "GOLD_CAST_24": [
    "مسبوك 24", "ذهب مسبوك 24", "دهب مسبوك 24", "سبائك 24", "سبيكة 24", "عيار 24", 
    "ذهب 24", "دهب 24", "ذهب نقي", "ذهب خالص", "gold 24", "cast 24"
  ],
  "GOLD_EXT_18": [
    "ذهب جديد 18", "دهب جديد 18", "لازوردي 18", "ذهب مستورد 18"
  ],
  "GOLD_EXT_21": [
    "ذهب جديد 21", "دهب جديد 21", "لازوردي 21", "ذهب كويتي", "ذهب خليجي"
  ],
  "GOLD_LIRA_8G": [
    "ليرة", "ليره", "ليرات", "ليرة ذهب", "ليره دهب", "ليرة 8 غرام", "ليرة عثماني", 
    "ليرة رشادي", "ليرة انكليزي", "ليره ذهب"
  ],
  "GOLD_LIRA_14G": [
    "ليرة 14 غرام", "ليره 14", "ليرة ذهب 14 غرام"
  ],
  "GOLD_MUJARA_14G": [
    "مجارة", "مجاره", "مجارة ذهب", "مجارة 14 غرام"
  ],
  "SILVER_CAST_1000": [
    "فضة", "فضه", "فدة", "فضة كسر", "فضه كسر", "فضة مسبوك", "فضة عيار 1000", "فضة نقية", "silver"
  ]
};

// 7. Match Score Calculator with Typo Tolerance
export function scoreSearchMatch(query: string, item: SearchableItem): { score: number; matchedBy?: string } {
  const q = normalizeArabicText(query);
  if (!q) return { score: 0 };

  const qPhonetic = phoneticNormalize(query);
  const words = q.split(' ').filter(w => w.length > 0);

  // Check direct Code match (e.g. "USD", "EUR", "TRY")
  const itemCodeNorm = item.code.toLowerCase();
  if (itemCodeNorm === q || item.id.toLowerCase() === q) {
    return { score: 100, matchedBy: item.code };
  }

  // Check exact/prefix match in Item Name
  const itemNameNorm = normalizeArabicText(item.name);
  if (itemNameNorm === q) {
    return { score: 95, matchedBy: item.name };
  }
  if (itemNameNorm.startsWith(q) || itemNameNorm.includes(q)) {
    return { score: 85, matchedBy: item.name };
  }

  // Phonetic match on Name
  const itemNamePhonetic = phoneticNormalize(item.name);
  if (itemNamePhonetic.includes(qPhonetic)) {
    return { score: 80, matchedBy: item.name };
  }

  // Check Aliases
  let bestAliasScore = 0;
  let bestAliasMatched = '';

  const allAliases = [
    ...(KEYWORD_ALIASES[item.id] || []),
    ...(KEYWORD_ALIASES[item.code] || []),
    ...(item.aliases || [])
  ];

  for (const alias of allAliases) {
    const aNorm = normalizeArabicText(alias);
    const aPhonetic = phoneticNormalize(alias);

    // Exact alias
    if (aNorm === q) {
      return { score: 90, matchedBy: alias };
    }

    // Substring match
    if (aNorm.includes(q) || q.includes(aNorm)) {
      const score = 75 + (aNorm.length === q.length ? 10 : 0);
      if (score > bestAliasScore) {
        bestAliasScore = score;
        bestAliasMatched = alias;
      }
    }

    // Phonetic alias match (e.g. دهب matches ذهب)
    if (aPhonetic.includes(qPhonetic) || qPhonetic.includes(aPhonetic)) {
      const score = 70;
      if (score > bestAliasScore) {
        bestAliasScore = score;
        bestAliasMatched = alias;
      }
    }

    // Word-by-word matching
    for (const w of words) {
      if (w.length >= 2) {
        // Levenshtein similarity on words
        const sim = calculateSimilarity(w, aNorm);
        if (sim >= 0.75) {
          const score = Math.round(sim * 65);
          if (score > bestAliasScore) {
            bestAliasScore = score;
            bestAliasMatched = alias;
          }
        }
      }
    }

    // Levenshtein distance on full string if lengths are close
    if (Math.abs(q.length - aNorm.length) <= 2 && q.length >= 3) {
      const dist = levenshteinDistance(q, aNorm);
      if (dist <= 2) {
        const score = 65 - dist * 5;
        if (score > bestAliasScore) {
          bestAliasScore = score;
          bestAliasMatched = alias;
        }
      }
    }
  }

  if (bestAliasScore > 0) {
    return { score: bestAliasScore, matchedBy: bestAliasMatched };
  }

  // Fallback: Check if query contains generic category words
  if (q.includes('ذهب') || q.includes('دهب') || q.includes('عيار')) {
    if (item.category === 'metals' && item.id.startsWith('GOLD')) {
      return { score: 50, matchedBy: 'معادن الذهب' };
    }
  }
  if (q.includes('فضة') || q.includes('فضه') || q.includes('فدة')) {
    if (item.category === 'metals' && item.id.includes('SILVER')) {
      return { score: 60, matchedBy: 'الفضة' };
    }
  }
  if (q.includes('صكوك') || q.includes('شكوك') || q.includes('شيك') || q.includes('صك')) {
    if (item.category === 'checks') {
      return { score: 55, matchedBy: 'صكوك المصارف' };
    }
  }

  return { score: 0 };
}

// 8. Execute Smart Search over dataset
export function searchRates(
  query: string,
  items: SearchableItem[],
  threshold = 40
): { item: SearchableItem; score: number; matchedBy?: string }[] {
  if (!query || !query.trim()) return [];

  const results: { item: SearchableItem; score: number; matchedBy?: string }[] = [];

  for (const item of items) {
    const match = scoreSearchMatch(query, item);
    if (match.score >= threshold) {
      results.push({
        item,
        score: match.score,
        matchedBy: match.matchedBy
      });
    }
  }

  // Sort descending by score
  results.sort((a, b) => b.score - a.score);

  return results;
}
