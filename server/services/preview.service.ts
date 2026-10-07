import { rates } from "../state";

/**
 * Robustly replaces or inserts a meta tag regardless of attribute order:
 * handles both name="..." content="..." and content="..." name="..."
 * as well as property="..." content="..." and content="..." property="..."
 */
function replaceOrInsertMeta(
  html: string,
  identifierType: 'name' | 'property',
  identifierValue: string,
  newContent: string
): string {
  // Regex that matches <meta ...> containing identifierType="identifierValue" regardless of attribute order
  const tagRegex = new RegExp(
    `<meta\\s+[^>]*(?:${identifierType}=["']${identifierValue}["'][^>]*content=["'][^"']*["']|content=["'][^"']*["'][^>]*${identifierType}=["']${identifierValue}["'])[^>]*>`,
    'gi'
  );

  const newTag = `<meta ${identifierType}="${identifierValue}" content="${newContent}">`;

  if (tagRegex.test(html)) {
    return html.replace(tagRegex, newTag);
  }

  // If tag doesn't exist, insert it before </head>
  if (html.includes('</head>')) {
    return html.replace('</head>', `  ${newTag}\n  </head>`);
  }

  return html;
}

/**
 * Dynamically injects live USD and EUR rates into HTML meta tags (OG, Twitter, Description, Title)
 * to ensure that link previews across Telegram, WhatsApp, Facebook, Viber, and X/Twitter
 * are always up-to-date in real time.
 */
export function injectDynamicMetaTags(rawHtml: string, isTelegramPage: boolean = false): string {
  const usdVal = Number(rates?.parallel?.USD) || 0;
  const eurVal = Number(rates?.parallel?.EUR) || 0;

  const usdStr = usdVal > 0 ? usdVal.toFixed(2) : "9.55";
  const eurStr = eurVal > 0 ? eurVal.toFixed(2) : "10.30";

  let dynamicTitle: string;
  let dynamicDesc: string;

  if (isTelegramPage) {
    if (usdVal > 0 && eurVal > 0) {
      dynamicTitle = `💵 دولار: ${usdStr} | 💶 يورو: ${eurStr} | قناة مؤشر الدينار`;
      dynamicDesc = `السعر اللحظي في السوق الموازي: الدولار ${usdStr} د.ل | اليورو ${eurStr} د.ل. انضم لقناة مؤشر الدينار الرسمية لمتابعة أسعار العملات والذهب لحظة بلحظة.`;
    } else if (usdVal > 0) {
      dynamicTitle = `💵 دولار: ${usdStr} | قناة مؤشر الدينار`;
      dynamicDesc = `السعر اللحظي في السوق الموازي: الدولار ${usdStr} د.ل. انضم لقناة مؤشر الدينار الرسمية لمتابعة أسعار العملات والذهب لحظة بلحظة.`;
    } else {
      dynamicTitle = `📊 قناة مؤشر الدينار على تليجرام`;
      dynamicDesc = `انضم لمتابعة أسعار صرف الدولار واليورو والذهب في ليبيا لحظة بلحظة.`;
    }
  } else {
    if (usdVal > 0 && eurVal > 0) {
      dynamicTitle = `💵 دولار: ${usdStr} | 💶 يورو: ${eurStr} | مؤشر الدينار`;
      dynamicDesc = `السعر الآن في السوق الموازي: الدولار ${usdStr} د.ل، واليورو ${eurStr} د.ل. تابع أسعار العملات والذهب لحظة بلحظة من السوق الموازي والمصرف المركزي.`;
    } else if (usdVal > 0) {
      dynamicTitle = `💵 دولار: ${usdStr} | مؤشر الدينار`;
      dynamicDesc = `السعر الآن في السوق الموازي: الدولار ${usdStr} د.ل. تابع أسعار العملات والذهب لحظة بلحظة من السوق الموازي والمصرف المركزي.`;
    } else {
      dynamicTitle = `مؤشر الدينار | Dinar Index`;
      dynamicDesc = `متابعة أسعار العملات والذهب في ليبيا لحظة بلحظة من السوق الموازي والمصرف المركزي`;
    }
  }

  let html = rawHtml;

  // 1. Replace <title>
  if (/<title>.*?<\/title>/i.test(html)) {
    html = html.replace(/<title>.*?<\/title>/gi, `<title>${dynamicTitle}</title>`);
  } else if (html.includes('</head>')) {
    html = html.replace('</head>', `  <title>${dynamicTitle}</title>\n  </head>`);
  }

  // 2. Replace standard description
  html = replaceOrInsertMeta(html, 'name', 'description', dynamicDesc);

  // 3. Replace Open Graph og:title & og:description
  html = replaceOrInsertMeta(html, 'property', 'og:title', dynamicTitle);
  html = replaceOrInsertMeta(html, 'property', 'og:description', dynamicDesc);

  // 4. Also support name="og:title" for platforms that check name instead of property
  html = replaceOrInsertMeta(html, 'name', 'og:title', dynamicTitle);
  html = replaceOrInsertMeta(html, 'name', 'og:description', dynamicDesc);

  // 5. Replace Twitter twitter:title & twitter:description
  html = replaceOrInsertMeta(html, 'name', 'twitter:title', dynamicTitle);
  html = replaceOrInsertMeta(html, 'name', 'twitter:description', dynamicDesc);
  html = replaceOrInsertMeta(html, 'property', 'twitter:title', dynamicTitle);
  html = replaceOrInsertMeta(html, 'property', 'twitter:description', dynamicDesc);

  // 6. Updated time tag to prevent aggressive crawler cache
  const updatedIso = rates?.lastUpdated || new Date().toISOString();
  html = replaceOrInsertMeta(html, 'property', 'og:updated_time', updatedIso);

  return html;
}

