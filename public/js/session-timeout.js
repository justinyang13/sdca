// session-timeout.js — idle sign-out for the portal and the admin area.
// The server ends a session after N idle minutes (cookie + store expiry renew on every response).
// This script warns two minutes before, lets the user stay signed in, and moves to the sign-in page when time is up.
(function () {
  var el = document.querySelector('[data-session-timeout]');
  if (!el) return;
  var minutes = Number(el.getAttribute('data-session-timeout')) || 30;
  var ping = el.getAttribute('data-ping');
  var zh = el.getAttribute('data-lang') === 'zh';
  var WARN_MS = Math.min(2, Math.max(1, minutes / 4)) * 60000;
  var limit = minutes * 60000;
  var last = Date.now();        // last activity we know the server has seen
  var lastPing = Date.now();
  var banner = null; var tick = null;

  function text(en, zhText) { return zh ? zhText : en; }
  function expire() {
    try { document.cookie = 'sdca_timedout=1; path=/; max-age=300; SameSite=Lax'; } catch (e) { /* ignore */ }
    window.location.href = window.location.pathname + window.location.search;   // server sends us to sign in and returns here afterwards
  }
  function hide() { if (banner) { banner.remove(); banner = null; } }
  function keepAlive() {
    lastPing = Date.now();
    return fetch(ping, { credentials: 'same-origin', cache: 'no-store', redirect: 'manual' }).then(function (r) {
      if (r.status === 204) { last = Date.now(); hide(); } else expire();
    }).catch(function () { /* offline: keep counting */ });
  }
  function show(msLeft) {
    if (!banner) {
      banner = document.createElement('div');
      banner.setAttribute('role', 'alertdialog'); banner.setAttribute('aria-live', 'assertive');
      banner.className = 'idle-banner';
      var msg = document.createElement('span'); msg.className = 'idle-msg';
      var btn = document.createElement('button'); btn.type = 'button'; btn.className = 'btn btn-primary';
      btn.textContent = text('Stay signed in', '保持登入');
      btn.addEventListener('click', keepAlive);
      banner.appendChild(msg); banner.appendChild(btn); document.body.appendChild(banner);
      btn.focus();
    }
    var s = Math.max(0, Math.ceil(msLeft / 1000)); var mm = Math.floor(s / 60); var ss = String(s % 60).padStart(2, '0');
    banner.querySelector('.idle-msg').textContent = text('You will be signed out in ' + mm + ':' + ss + ' because of inactivity.', '因閒置過久，將在 ' + mm + ':' + ss + ' 後自動登出。');
  }
  function onActivity() {
    var now = Date.now();
    if (banner) return;                       // while the warning is up, only the button counts
    last = now;                               // the user is active; tell the server at most once a minute
    if (now - lastPing > 60000) keepAlive();
  }
  ['click', 'keydown', 'touchstart', 'scroll'].forEach(function (ev) { window.addEventListener(ev, onActivity, { passive: true }); });
  tick = setInterval(function () {
    var idle = Date.now() - last;
    if (idle >= limit) { clearInterval(tick); expire(); } else if (idle >= limit - WARN_MS) show(limit - idle);
  }, 1000);
})();
