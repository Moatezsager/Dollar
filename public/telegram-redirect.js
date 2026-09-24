// Smooth redirect for real visitors
var tgUrl = "https://t.me/libya_index_dollar";

// Track real human browser click silently (does not show to visitor)
try {
  var payload = JSON.stringify({ referrer: document.referrer || "" });
  var sent = false;
  if (navigator.sendBeacon) {
    var blob = new Blob([payload], { type: "application/json" });
    sent = navigator.sendBeacon("/api/telegram-click", blob);
  }
  if (!sent && typeof fetch === "function") {
    fetch("/api/telegram-click", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true
    }).catch(function() {});
  }
} catch (e) {}

setTimeout(function() {
  try {
    window.location.replace(tgUrl);
  } catch (e) {
    window.location.href = tgUrl;
  }
}, 500);
