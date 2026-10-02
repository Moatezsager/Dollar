import { useState } from "react";
import { useMotionValue, useTransform, animate } from "motion/react";

export function usePullToRefresh(onRefresh: () => void, triggerHaptic: (pattern?: number | number[]) => void) {
  const pullY = useMotionValue(0);
  const pullOpacity = useTransform(pullY, [0, 80], [0, 1]);
  const pullScale = useTransform(pullY, [0, 80], [0.5, 1]);
  const pullRotate = useTransform(pullY, [0, 80], [0, 360]);

  const [startY, setStartY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY === 0) {
      setStartY(e.touches[0].clientY);
      setIsDragging(true);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const currentY = e.touches[0].clientY;
    const diff = currentY - startY;
    if (diff > 0) {
      pullY.set(Math.min(diff * 0.5, 100)); // Add resistance
    }
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    if (pullY.get() > 80) {
      triggerHaptic(20);
      onRefresh();
    }
    animate(pullY, 0, { type: "spring", stiffness: 300, damping: 20 });
  };

  return {
    pullY,
    pullOpacity,
    pullScale,
    pullRotate,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  };
}
