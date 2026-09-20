import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import Admin from './Admin.tsx';
import ErrorBoundary from './components/ErrorBoundary.tsx';
import { safeStorage } from './utils/storage.ts';
import './index.css';

import { logErrorToServer } from './utils/logger';

// Global error handlers
window.addEventListener('error', (event) => {
  logErrorToServer(event.error || event.message, 'Global Error Handler');
});

window.addEventListener('unhandledrejection', (event) => {
  logErrorToServer(event.reason, 'Unhandled Promise Rejection');
});

// Register unified Service Worker (Caching + Push)
// Avoid registering inside in-app WebViews (Facebook, Instagram) where module SWs can cause blank screens
try {
  const isFbOrInApp = typeof navigator !== 'undefined' && /FBAN|FBAV|Instagram|Twitter|Snapchat|Line|MicroMessenger|wv/i.test(navigator.userAgent);
  if ('serviceWorker' in navigator && window.self === window.top && !isFbOrInApp) {
    navigator.serviceWorker.register('/push-sw.js', { scope: '/' })
      .then(reg => {
        console.log('[SW] Unified Service Worker Registered. Scope:', reg.scope);
      })
      .catch(err => {
        console.warn('[SW] Service Worker registration notice:', err?.message || err);
      });
  }
} catch (swErr) {
  console.warn('[SW] Service Worker initialization error:', swErr);
}

const path = window.location.pathname;

if (path === '/setup-device-auth-8899') {
  try {
    safeStorage.setItem('admin_device_token', 'authorized_device_token_xyz');
  } catch (e) {
    console.warn("Storage not available", e);
  }
  window.location.href = '/admin-panel-secure';
}

const rootEl = document.getElementById('root');
if (rootEl) {
  try {
    createRoot(rootEl).render(
      <StrictMode>
        <ErrorBoundary>
          {path === '/admin-panel-secure' ? <Admin /> : <App />}
        </ErrorBoundary>
      </StrictMode>,
    );
  } catch (renderErr) {
    console.error('Fatal render error:', renderErr);
    logErrorToServer(renderErr, 'main.tsx createRoot');
    rootEl.innerHTML = `
      <div style="min-height:100vh;background-color:#091121;display:flex;align-items:center;justify-content:center;color:#fff;text-align:center;padding:20px;font-family:sans-serif;" dir="rtl">
        <div style="background:rgba(15,23,42,0.9);border:1px solid #334155;border-radius:24px;padding:24px;max-width:400px;width:100%;">
          <h2 style="font-size:18px;margin-bottom:12px;">حدث خطأ في تحميل التطبيق</h2>
          <p style="color:#94a3b8;font-size:14px;margin-bottom:20px;">يرجى إعادة تحميل الصفحة أو فتح الرابط في متصفح خارجي مثل Chrome أو Safari.</p>
          <button onclick="window.location.reload()" style="background:#10b981;color:#000;border:none;padding:10px 24px;border-radius:12px;font-weight:bold;cursor:pointer;">إعادة المحاولة</button>
        </div>
      </div>
    `;
  }
}

