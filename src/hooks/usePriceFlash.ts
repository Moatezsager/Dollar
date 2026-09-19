import { useState, useEffect, useRef } from 'react';

export function usePriceFlash(currentValue: number) {
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);
  const prevValueRef = useRef(currentValue);

  useEffect(() => {
    if (currentValue !== prevValueRef.current) {
      if (currentValue > prevValueRef.current) {
        setFlash('up'); // Price went up (usually red)
      } else {
        setFlash('down'); // Price went down (usually green)
      }
      
      prevValueRef.current = currentValue;
      
      const timer = setTimeout(() => {
        setFlash(null);
      }, 1500); // Flash duration
      
      return () => clearTimeout(timer);
    }
  }, [currentValue]);

  return flash;
}
