// Smooth redirect for real visitors
var tgUrl = "https://t.me/libya_index_dollar";

// Track real human browser click silently (does not show to visitor)
try {
  if (navigator.sendBeacon) {
    navigator.sendBeacon("/api/telegram-click", JSON.stringify({ referrer: document.referrer || "" }));
  }
} catch (e) {}

setTimeout(function() {
  try {
    window.location.replace(tgUrl);
  } catch (e) {
    window.location.href = tgUrl;
  }
}, 500);
