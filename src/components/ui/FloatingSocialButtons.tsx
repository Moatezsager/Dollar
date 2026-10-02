import React from "react";
import { motion } from "motion/react";
import { Send, Facebook } from "lucide-react";

interface FloatingSocialButtonsProps {
  isInstallPromptVisible: boolean;
}

export const FloatingSocialButtons: React.FC<FloatingSocialButtonsProps> = ({ isInstallPromptVisible }) => {
  return (
    <>
      {/* Telegram Floating Action Button */}
      <motion.a
        href="https://t.me/libya_index_dollar"
        target="_blank"
        rel="noopener noreferrer"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 20, delay: 1 }}
        whileHover={{ scale: 1.1, y: -4 }}
        whileTap={{ scale: 0.9 }}
        className={`fixed left-6 z-[999] md:flex hidden items-center justify-center w-14 h-14 bg-[#24A1DE] text-white rounded-full shadow-[0_8px_30px_rgb(36,161,222,0.4)] hover:shadow-[0_8px_40px_rgb(36,161,222,0.6)] border border-slate-700/50 group overflow-hidden transition-all duration-500 ${isInstallPromptVisible ? 'bottom-56 md:bottom-52' : 'bottom-48 md:bottom-24'}`}
      >
        <div className="absolute inset-0 bg-gradient-to-tr from-black/10 to-transparent"></div>
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.2)_0%,transparent_100%)]"></div>
        <Send className="w-6 h-6 relative z-10 mr-1 -mt-0.5 group-hover:scale-110 transition-transform duration-300" />
      </motion.a>

      {/* Facebook Floating Action Button */}
      <motion.a
        href="https://www.facebook.com/profile.php?id=61593953519936"
        target="_blank"
        rel="noopener noreferrer"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 20, delay: 1.1 }}
        whileHover={{ scale: 1.1, y: -4 }}
        whileTap={{ scale: 0.9 }}
        className={`fixed left-6 z-[999] md:flex hidden items-center justify-center w-14 h-14 bg-[#1877F2] text-white rounded-full shadow-[0_8px_30px_rgb(24,119,242,0.4)] hover:shadow-[0_8px_40px_rgb(24,119,242,0.6)] border border-slate-700/50 group overflow-hidden transition-all duration-500 ${isInstallPromptVisible ? 'bottom-36 md:bottom-32' : 'bottom-28 md:bottom-6'}`}
      >
        <div className="absolute inset-0 bg-gradient-to-tr from-black/10 to-transparent"></div>
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.2)_0%,transparent_100%)]"></div>
        <Facebook className="w-6 h-6 relative z-10 group-hover:scale-110 transition-transform duration-300" />
      </motion.a>
    </>
  );
};
