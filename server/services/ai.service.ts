import { GoogleGenAI, Type } from "@google/genai";
import { appConfig } from '../config';

const aiProcessedTexts = new Set<string>();

export async function extractRatesWithAI(text: string, channel: string): Promise<{ code: string, value: number, date?: string }[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return [];
  
  const cacheKey = channel + "_" + text.substring(0, 30) + text.length;
  if (aiProcessedTexts.has(cacheKey)) return [];
  aiProcessedTexts.add(cacheKey);
  
  if (aiProcessedTexts.size > 1000) {
    const arr = Array.from(aiProcessedTexts);
    aiProcessedTexts.clear();
    arr.slice(500).forEach(k => aiProcessedTexts.add(k));
  }

  const currencyTerms = appConfig.terms.filter(t => !t.id.startsWith("GOLD_") && t.id !== "GOLD");
  const termIds = currencyTerms.map(t => t.id).join(", ");
  
  const prompt = `أنت خبير مالي في ليبيا. استخرج أسعار العملات الأجنبية فقط من النص التالي، والذي تم نشره في قناة "${channel}".
تنبيه هام: لا تقم باستخراج أي أسعار للذهب أو المعادن (مثل كسر 18، كسر 21، مسبوك، ليرة، عيار)، حيث تتم إدارة الذهب يدوياً فقط.
النص:
${text}

المطلوب:
إرجاع مصفوفة JSON تحتوي على كائنات بصيغة:
[
  { "code": "USD", "value": 9.10 }
]

تعليمات هامة جداً (يجب اتباعها بالحرف):
1. السعر المطلوب هو دائماً: (كم يساوي 1 من العملة الأجنبية بالدينار الليبي).
2. **قواعد خاصة بقناة libya_dollar للجنيه المصري (EGP) والدينار التونسي (TND)**:
   - في بعض القنوات تُكتب الصيغة هكذا: "دينار.ليبي = 0.33 دينار.تونسي" أو "دينار.ليبي = 5.40 جنيه.مصري".
   - هذا يعني أن الدينار الليبي الواحد يشتري 0.33 تونسي، ويشتري 5.40 مصري.
   - لحساب سعر (1 دينار تونسي كم يساوي ليبي)، يجب عليك قسمة 1 على 0.33 (1 ÷ 0.33 = 3.03). هذا هو الرقم الذي يجب إرجاعه لـ TND. إياك أن تُرجع 0.33 أو 5.40 للتونسي!
   - لحساب سعر (1 جنيه مصري كم يساوي ليبي)، يجب عليك قسمة 1 على الرقم المعطى للمصري (مثال: 1 ÷ 5.40 = 0.185). هذا هو الرقم الذي يجب إرجاعه لـ EGP.
   - الخلاصة: إذا كان الرقم المكتوب أمام التونسي أو المصري يمثل كم يشتري الدينار الليبي الواحد من هذه العملة، فيجب عليك قسمة الرقم 1 على هذا الرقم لاستخراج السعر الصحيح بالدينار الليبي.
   - مستحيل أن يكون التونسي بـ 5.45 أو المصري بـ 0.33! التونسي دائماً في نطاق 2.8 إلى 3.5، والمصري دائماً في نطاق 0.15 إلى 0.25.
3. **تجاهل الذهب**: لا تقم باستخراج أي أسعار للذهب (لا GOLD_ ولا كسر ولا مسبوك ولا ليرات).
4. رموز العملات المسموحة فقط هي: ${termIds}.
5. لا تقم أبداً بإضافة عملات أو معادن غير موجودة في القائمة.
6. كلمة (صكوك) لوحدها تعني الدولار بصكوك (استخدم الرمز USD_CHECKS).`;

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              code: { type: Type.STRING },
              value: { type: Type.NUMBER }
            },
            required: ["code", "value"]
          }
        }
      }
    });

    if (response.text) {
      const parsed = JSON.parse(response.text);
      if (Array.isArray(parsed) && parsed.length > 0) {
        console.log(`[Scraper-AI] AI extracted rates from ${channel}: `, JSON.stringify(parsed));
        return parsed.filter(item => {
          if (item.code === "GOLD" || item.code.startsWith("GOLD_")) return false;
          const term = appConfig.terms.find(t => t.id === item.code);
          return term && typeof item.value === 'number' && item.value >= term.min && item.value <= term.max;
        });
      }
    }
  } catch (e) {
    console.error(`[Scraper-AI] Error calling AI for ${channel}: `, e);
  }
  return [];
}
