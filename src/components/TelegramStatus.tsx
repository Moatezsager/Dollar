import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';

export const TelegramStatus = () => {
  const [status, setStatus] = useState<{ isConnected: boolean; lastFetchTime: number } | null>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch('/api/telegram/status');
        if (!response.ok) return;
        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) return;
        const data = await response.json();
        setStatus(data);
      } catch (error) {
        console.error('Failed to fetch telegram status:', error);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 30000); // Poll every 30 seconds
    return () => clearInterval(interval);
  }, []);

  if (!status) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
      <motion.div
        animate={{ opacity: [1, 0.5, 1] }}
        transition={{ duration: 2, repeat: Infinity }}
        className={`w-2 h-2 rounded-full ${status.isConnected ? 'bg-emerald-500' : 'bg-red-500'}`}
      />
      <span className="text-xs text-zinc-400">
        {status.isConnected 
          ? status.lastFetchTime > 0 
            ? `آخر جلب: ${formatDistanceToNow(new Date(status.lastFetchTime), { locale: ar, addSuffix: true })}`
            : 'متصل'
          : 'غير متصل'}
      </span>
    </div>
  );
};
