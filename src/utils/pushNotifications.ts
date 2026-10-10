import { safeStorage } from './storage';

export function pushSupport() {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
  if (ios && !standalone) return 'install' as const;
  if (!window.isSecureContext || !('serviceWorker' in navigator) || !('PushManager' in window) || typeof Notification === 'undefined') return 'unsupported' as const;
  if (Notification.permission === 'denied') return 'denied' as const;
  return 'supported' as const;
}

async function registration() {
  if (pushSupport() !== 'supported') throw new Error(pushSupport() === 'install' ? 'أضف الموقع إلى الشاشة الرئيسية ثم افتحه لتفعيل الإشعارات.' : 'الإشعارات غير متاحة. راجع أذونات الجهاز والمتصفح.');
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('تعذر تجهيز خدمة الإشعارات. أعد المحاولة بعد تحديث التطبيق.')), 15000); }),
    ]);
  } finally { clearTimeout(timer); }
}

function applicationKey(value: string): Uint8Array {
  const raw = atob(value.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, character => character.charCodeAt(0));
}

async function saveSubscription(subscription: PushSubscription) {
  const response = await fetch('/api/push/subscribe', {
    method: 'POST', headers: {'Content-Type': 'application/json'}, signal: AbortSignal.timeout(15000),
    body: JSON.stringify({subscription: subscription.toJSON()}),
  });
  const result = await response.json();
  if (!response.ok || !result.success) throw new Error('تعذر حفظ اشتراك الإشعارات على الخادم. أعد المحاولة.');
}

export async function enablePush() {
  if (pushSupport() !== 'supported') throw new Error(pushSupport() === 'install' ? 'أضف الموقع إلى الشاشة الرئيسية ثم افتحه لتفعيل الإشعارات.' : 'الإشعارات غير متاحة. راجع أذونات الجهاز والمتصفح.');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error(permission === 'denied' ? 'الإشعارات محظورة. يمكنك تغيير الإذن من إعدادات الجهاز أو المتصفح.' : 'لم يتم منح إذن الإشعارات.');
  const reg = await registration();
  const response = await fetch('/api/push/public-key', {signal: AbortSignal.timeout(10000)});
  if (!response.ok) throw new Error('تعذر الاتصال بخدمة الإشعارات.');
  const {publicKey} = await response.json();
  if (!publicKey) throw new Error('خدمة الإشعارات غير مهيأة على الخادم.');
  const key = applicationKey(publicKey);
  let subscription = await reg.pushManager.getSubscription();
  const oldKey = subscription?.options.applicationServerKey;
  if (subscription && oldKey && Array.from(new Uint8Array(oldKey)).join(',') !== Array.from(key).join(',')) {
    await subscription.unsubscribe();
    subscription = null;
  }
  subscription ||= await reg.pushManager.subscribe({userVisibleOnly: true, applicationServerKey: key as BufferSource});
  await saveSubscription(subscription);
  safeStorage.setItem('pushEnabled', 'true');
  return subscription;
}

let syncPromise: Promise<boolean> | null = null;
export function syncPushSubscription() {
  if (syncPromise) return syncPromise;
  syncPromise = (async () => {
    if (pushSupport() !== 'supported' || Notification.permission !== 'granted' || safeStorage.getItem('pushEnabled') === 'false') return false;
    const reg = await registration();
    const subscription = await reg.pushManager.getSubscription();
    if (!subscription) return false;
    await saveSubscription(subscription);
    return true;
  })().finally(() => { syncPromise = null; });
  return syncPromise;
}

export async function disablePush() {
  const reg = await registration();
  const subscription = await reg.pushManager.getSubscription();
  if (subscription) {
    const data = subscription.toJSON();
    if (!await subscription.unsubscribe()) throw new Error('تعذر إيقاف الاشتراك على هذا الجهاز.');
    safeStorage.setItem('pushEnabled', 'false');
    const response = await fetch('/api/push/unsubscribe', {
      method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({subscription: data}), signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error('توقفت الإشعارات على الجهاز، لكن تعذر تنظيف الاشتراك على الخادم. أعد المحاولة.');
  }
  safeStorage.setItem('pushEnabled', 'false');
}

export async function currentPushSubscription() {
  return (await registration()).pushManager.getSubscription();
}
