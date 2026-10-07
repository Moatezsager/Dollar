// Comprehensive Early Self-Healing & In-App Browser Auto-Recovery
(function() {
  var isFbOrInApp = typeof navigator !== 'undefined' && /FBAN|FBAV|Messenger|Instagram|Twitter|Snapchat|Line|MicroMessenger|wv/i.test(navigator.userAgent);

  // 1. If in Facebook/Messenger In-App Browser, proactively purge buggy Service Worker & CacheStorage
  if (isFbOrInApp) {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(function(regs) {
        for (var i = 0; i < regs.length; i++) {
          regs[i].unregister();
        }
      }).catch(function() {});
    }
    if ('caches' in window) {
      window.caches.keys().then(function(keys) {
        for (var i = 0; i < keys.length; i++) {
          window.caches.delete(keys[i]);
        }
      }).catch(function() {});
    }
  }

  // 2. Catch script errors or chunk loading failures
  window.addEventListener('error', function(event) {
    var errorMsg = (event && (event.message || (event.error && event.error.message))) || '';
    if (/Loading chunk|Failed to fetch dynamically imported module|Unexpected token/i.test(errorMsg)) {
      if (!sessionStorage.getItem('dinar_chunk_reload')) {
        sessionStorage.setItem('dinar_chunk_reload', '1');
        if ('caches' in window) {
          window.caches.keys().then(function(keys) {
            Promise.all(keys.map(function(k) { return window.caches.delete(k); })).then(function() {
              window.location.reload();
            });
          });
        } else {
          window.location.reload();
        }
      }
    }
  });

  // 3. Fallback timer: if React does not mount within 3 seconds, auto-refresh once to clear stuck state
  setTimeout(function() {
    var rootEl = document.getElementById('root');
    var isStillSplash = rootEl && rootEl.querySelector('.splash-container');
    if (isStillSplash) {
      if (!sessionStorage.getItem('dinar_splash_auto_refresh')) {
        sessionStorage.setItem('dinar_splash_auto_refresh', '1');
        if ('caches' in window) {
          window.caches.keys().then(function(keys) {
            Promise.all(keys.map(function(k) { return window.caches.delete(k); })).then(function() {
              window.location.reload();
            });
          });
        } else {
          window.location.reload();
        }
        return;
      }
      var helper = document.getElementById('splash-fb-helper');
      if (helper) {
        helper.style.display = 'block';
      }
    }
  }, 3200);

  document.addEventListener('DOMContentLoaded', function() {
    var reloadBtn = document.getElementById('splash-reload-btn');
    if (reloadBtn) {
      reloadBtn.addEventListener('click', function() {
        if ('caches' in window) {
          window.caches.keys().then(function(keys) {
            Promise.all(keys.map(function(k) { return window.caches.delete(k); })).then(function() {
              window.location.reload();
            });
          });
        } else {
          window.location.reload();
        }
      });
    }
  });
})();

