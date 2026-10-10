import React, {useEffect, useRef, useState} from 'react';
import {AnimatePresence, motion, useReducedMotion} from 'motion/react';
import {RefreshCw, X} from 'lucide-react';
import {onUpdateAvailable, purgeAllCachesAndReload} from '../utils/autoUpdater';

const UPDATE_DELAY = 3;

export const AutoUpdateBanner: React.FC = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [countdown, setCountdown] = useState(UPDATE_DELAY);
  const [isUpdating, setIsUpdating] = useState(false);
  const updatingRef = useRef(false);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const showUpdate = () => setUpdateAvailable(true);
    const unsubscribe = onUpdateAvailable(showUpdate);
    window.addEventListener('dinar:update-available', showUpdate);
    return () => {
      unsubscribe();
      window.removeEventListener('dinar:update-available', showUpdate);
    };
  }, []);

  useEffect(() => {
    if (!updateAvailable || isUpdating) return;
    const timer = setInterval(() => setCountdown(previous => Math.max(0, previous - 1)), 1000);
    return () => clearInterval(timer);
  }, [updateAvailable, isUpdating]);

  const triggerUpdate = async () => {
    if (updatingRef.current) return;
    updatingRef.current = true;
    setIsUpdating(true);
    await purgeAllCachesAndReload();
  };

  useEffect(() => {
    if (updateAvailable && countdown === 0) triggerUpdate();
  }, [updateAvailable, countdown]);

  const dismiss = () => {
    setUpdateAvailable(false);
    setCountdown(UPDATE_DELAY);
  };

  return <AnimatePresence>
    {updateAvailable && <motion.aside
      className="update-notice" dir="rtl" aria-labelledby="update-notice-title"
      initial={{opacity: 0, y: reduceMotion ? 0 : 12}}
      animate={{opacity: 1, y: 0}}
      exit={{opacity: 0, y: reduceMotion ? 0 : 8}}
      transition={{duration: reduceMotion ? 0 : 0.18}}
    >
      <div className="update-notice-header">
        <img src="/icon-192.png" alt="" width={38} height={38} />
        <div role="status" aria-atomic="true">
          <h2 id="update-notice-title">{isUpdating ? 'جارٍ تحديث الواجهة' : 'تحديث جديد للواجهة'}</h2>
        </div>
        <button type="button" className="update-notice-dismiss" aria-label="إغلاق تنبيه التحديث"
          title="إغلاق تنبيه التحديث" disabled={isUpdating} onClick={dismiss}><X size={19} aria-hidden="true" /></button>
      </div>
      <div className="update-notice-actions">
        <p className="update-notice-countdown">
          {isUpdating ? 'يُطبّق التحديث الآن…' : <>
            <span>التحديث التلقائي خلال</span>
            <span className="update-notice-time"><output aria-live="off">{countdown}</output><span>{countdown === 1 ? 'ثانية' : 'ثوانٍ'}</span></span>
          </>}
        </p>
        <button type="button" className="update-notice-primary" onClick={triggerUpdate} disabled={isUpdating}>
          <RefreshCw size={18} className={isUpdating ? 'update-notice-spinner' : ''} aria-hidden="true" />
          <span>{isUpdating ? 'جارٍ التحديث' : 'تحديث الآن'}</span>
        </button>
      </div>
      {!isUpdating && <div className="update-notice-progress" role="progressbar" aria-label="الوقت المتبقي للتحديث"
        aria-valuemin={0} aria-valuemax={UPDATE_DELAY} aria-valuenow={countdown} aria-valuetext={countdown + (countdown === 1 ? ' ثانية' : ' ثوانٍ')}>
        <span style={{transform: 'scaleX(' + countdown / UPDATE_DELAY + ')'}} />
      </div>}
    </motion.aside>}
  </AnimatePresence>;
};
