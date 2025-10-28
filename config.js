// Configurable API base URL for Chillhouse
// Defaults:
// - localhost -> http://localhost:3000
// - otherwise -> existing Render service (replace when new backend is ready)
;(function(){
  var isLocalhost = /^(localhost|127\.0\.0\.1)/.test(location.hostname);
  if (typeof window.CHILLHOUSE_API_BASE === 'undefined' || !window.CHILLHOUSE_API_BASE) {
    // Prefer same-origin backend when served by Node/Express or Render
    window.CHILLHOUSE_API_BASE = (location.protocol.indexOf('http') === 0)
      ? location.origin
      : (isLocalhost ? 'http://localhost:3000' : 'https://gigachad-mess.onrender.com');
  }
  if (typeof window.CHILLHOUSE_APP_NAME === 'undefined' || !window.CHILLHOUSE_APP_NAME) {
    window.CHILLHOUSE_APP_NAME = 'Chillhouse';
  }
})();


