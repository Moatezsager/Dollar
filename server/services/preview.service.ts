import { rates } from "../state";

/**
 * Dynamically injects live USD and EUR rates into HTML meta tags (OG, Twitter, Description, Title)
 * to ensure that link previews across Telegram, WhatsApp, Facebook, Viber, and X/Twitter
 * are always up-to-date in real time.
 */
export function injectDynamicMetaTags(rawHtml: string, isTelegramPage: boolean = false): string {
  const usdVal = Number(rates?.parallel?.USD) || 0;
  const eurVal = Number(rates?.parallel?.EUR) || 0;

  if (usdVal <= 0 && eurVal <= 0) {
    return rawHtml;
  }

  const usdStr = usdVal > 0 ? usdVal.toFixed(2) : "";
  const eurStr = eurVal > 0 ? eurVal.toFixed(2) : "";

  let dynamicTitle: string;
  let dynamicDesc: string;

  if (isTelegramPage) {
    if (usdStr && eurStr) {
      dynamicTitle = `💵 دولار: ${usdStr} | 💶 يورو: ${eurStr} | قناة مؤشر الدينار`;
      dynamicDesc = `السعر اللحظي في السوق الموازي: الدولار ${usdStr} د.ل | اليورو ${eurStr} د.ل. انضم لقناة مؤشر الدينار الرسمية لمتابعة أسعار العملات والذهب لحظة بلحظة.`;
    } else if (usdStr) {
      dynamicTitle = `💵 دولار: ${usdStr} | قناة مؤشر الدينار`;
      dynamicDesc = `السعر اللحظي في السوق الموازي: الدولار ${usdStr} د.ل. انضم لقناة مؤشر الدينار الرسمية لمتابعة أسعار العملات والذهب لحظة بلحظة.`;
    } else {
      dynamicTitle = `📊 قناة مؤشر الدينار على تليجرام`;
      dynamicDesc = `انضم لمتابعة أسعار صرف الدولار واليورو والذهب في ليبيا لحظة بلحظة.`;
    }
  } else {
    if (usdStr && eurStr) {
      dynamicTitle = `💵 دولار: ${usdStr} | 💶 يورو: ${eurStr} | مؤشر الدينار`;
      dynamicDesc = `السعر الآن في السوق الموازي: الدولار ${usdStr} د.ل، واليورو ${eurStr} د.ل. تابع أسعار العملات والذهب لحظة بلحظة من السوق الموازي والمصرف المركزي.`;
    } else if (usdStr) {
      dynamicTitle = `💵 دولار: ${usdStr} | مؤشر الدينار`;
      dynamicDesc = `السعر الآن في السوق الموازي: الدولار ${usdStr} د.ل. تابع أسعار العملات والذهب لحظة بلحظة من السوق الموازي والمصرف المركزي.`;
    } else {
      dynamicTitle = `مؤشر الدينار | Dinar Index`;
      dynamicDesc = `متابعة أسعار العملات والذهب في ليبيا لحظة بلحظة من السوق الموازي والمصرف المركزي`;
    }
  }

  let html = rawHtml;

  // 1. Replace <title>
  html = html.replace(/<title>.*?<\/title>/gi, `<title>${dynamicTitle}</title>`);

  // 2. Replace standard description
  html = html.replace(/<meta\s+name=["']description["']\s+content=["'][^"']*["'][^>]*>/gi, `<meta name="description" content="${dynamicDesc}">`);

  // 3. Replace Open Graph og:title & og:description
  html = html.replace(/<meta\s+(?:property|name)=["']og:title["']\s+content=["'][^"']*["'][^>]*>/gi, `<meta property="og:title" content="${dynamicTitle}">`);
  html = html.replace(/<meta\s+(?:property|name)=["']og:description["']\s+content=["'][^"']*["'][^>]*>/gi, `<meta property="og:description" content="${dynamicDesc}">`);

  // 4. Replace Twitter twitter:title & twitter:description
  html = html.replace(/<meta\s+(?:property|name)=["']twitter:title["']\s+content=["'][^"']*["'][^>]*>/gi, `<meta name="twitter:title" content="${dynamicTitle}">`);
  html = html.replace(/<meta\s+(?:property|name)=["']twitter:description["']\s+content=["'][^"']*["'][^>]*>/gi, `<meta name="twitter:description" content="${dynamicDesc}">`);

  return html;
}
