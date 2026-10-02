import React from "react";
import { motion, MotionValue } from "motion/react";
import { RefreshCw } from "lucide-react";

interface PullToRefreshIndicatorProps {
  pullY: MotionValue<number>;
  pullOpacity: MotionValue<number>;
  pullScale: MotionValue<number>;
  pullRotate: MotionValue<number>;
  isRefreshing: boolean;
}

export const PullToRefreshIndicator: React.FC<PullToRefreshIndicatorProps> = ({
  pullY,
  pullOpacity,
  pullScale,
  pullRotate,
  isRefreshing,
}) => {
  return (
    <motion.div
      style={{ y: pullY }}
      className="fixed top-0 left-0 right-0 z-[100] flex justify-center pointer-events-none"
    >
      <motion.div
        style={{ 
          opacity: pullOpacity,
          scale: pullScale,
          rotate: pullRotate
        }}
        className="mt-4 w-10 h-10 rounded-full bg-emerald-500 text-black shadow-lg flex items-center justify-center"
      >
        <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
      </motion.div>
    </motion.div>
  );
};
