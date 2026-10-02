import { useState } from "react";
import { toPng } from "html-to-image";
import { HistoryPoint } from "../types/rates";

export function useShareImage(
  history: HistoryPoint[],
  triggerHaptic: (pattern?: number | number[]) => void,
  addToast: (title: string, message: string, type?: 'info' | 'up' | 'down') => void
) {
  const [isGeneratingShareImage, setIsGeneratingShareImage] = useState(false);
  const [shareData, setShareData] = useState<any>(null);

  const handleShareCardImage = async (code: string, name: string, price: number, isGold = false) => {
    setIsGeneratingShareImage(true);
    triggerHaptic(10);
    try {
      // Calculate stats for the last 24h
      const now = new Date();
      const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const values = history
        .filter(h => new Date(h.time) >= cutoff)
        .map(h => {
          if (isGold) return h.ratesParallel?.[code] || (h as any).rates?.gold?.karat18 || 0;
          if (code === 'USD_CASH') return h.usdParallel || h.ratesParallel?.USD || 0;
          if (code === 'USD_CHECKS') return h.ratesParallel?.USD_CHECKS || h.ratesParallel?.USD_JBANK || h.ratesParallel?.USD_NCB || 0;
          return h.ratesParallel?.[code] || 0;
        })
        .filter(v => v > 0);

      const max = values.length > 0 ? Math.max(...values) : price;
      const min = values.length > 0 ? Math.min(...values) : price;
      const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : price;
      const trend = price >= (values[0] || price) ? 'up' : 'down';

      setShareData({ code, name, price, max, min, avg, trend, isGold });

      // Wait a tick for any DOM element
      await new Promise(resolve => setTimeout(resolve, 100));

      const node = document.getElementById('share-card-node');
      if (node) {
        const dataUrl = await toPng(node, { cacheBust: true, pixelRatio: 3, quality: 1 });
        
        // Try web share first
        if (navigator.share) {
          const response = await fetch(dataUrl);
          const blob = await response.blob();
          const file = new File([blob], 'share.png', { type: 'image/png' });
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
              title: 'مؤشر الدينار',
              text: `سعر ${name} الآن: ${price.toFixed(2)} د.ل`,
              files: [file]
            });
            setIsGeneratingShareImage(false);
            setShareData(null);
            return;
          }
        }
        
        // Fallback to download
        const link = document.createElement('a');
        link.download = `dinar-index-${code}.png`;
        link.href = dataUrl;
        link.click();
        addToast('تم الحفظ', 'تم حفظ صورة السعر بنجاح', 'info');
      }
    } catch (err) {
      console.error(err);
      addToast('خطأ', 'فشل إنشاء الصورة للمشاركة', 'down');
    }
    setIsGeneratingShareImage(false);
    setShareData(null);
  };

  return {
    isGeneratingShareImage,
    shareData,
    handleShareCardImage,
  };
}
