// Early error and timeout fail-safe
window.addEventListener('error', function() {
  var sub = document.getElementById('splash-sub');
  var helper = document.getElementById('splash-fb-helper');
  if (sub && helper) {
    sub.innerText = 'يرجى فتح الرابط في متصفح خارجي (Chrome أو Safari)';
    helper.style.display = 'block';
  }
});

setTimeout(function() {
  var helper = document.getElementById('splash-fb-helper');
  if (helper && document.getElementById('splash-sub')) {
    helper.style.display = 'block';
  }
}, 4500);

document.addEventListener('DOMContentLoaded', function() {
  var reloadBtn = document.getElementById('splash-reload-btn');
  if (reloadBtn) {
    reloadBtn.addEventListener('click', function() {
      window.location.reload();
    });
  }
});
