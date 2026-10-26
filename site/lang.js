// Chooses English or Swedish. Everything happens on the visitor's phone: nothing is sent, logged or looked up.
// - A choice made with the EN | SV switch wins, and is remembered on this phone only (localStorage).
// - Otherwise the phone's own language setting decides: Swedish phones get /sv, everyone else English.
// - Only the English start page ever redirects. A link to /sv always opens in Swedish, so it can be shared.
// Loaded in <head> without defer, so the switch happens before the page is drawn (no flash).
(function () {
  var KEY = 'ellenial-lang';

  function remembered() {
    try {
      var v = localStorage.getItem(KEY);
      return v === 'en' || v === 'sv' ? v : null;
    } catch (e) {
      return null; // storage blocked (private mode etc.): just follow the phone
    }
  }

  function remember(lang) {
    try { localStorage.setItem(KEY, lang); } catch (e) { /* fine, nothing to remember */ }
  }

  // The first English or Swedish entry in the phone's preferred languages wins; anything else gets English.
  function phoneLanguage() {
    var list = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || ''];
    for (var i = 0; i < list.length; i++) {
      var code = String(list[i]).toLowerCase().slice(0, 2);
      if (code === 'sv' || code === 'en') return code;
    }
    return 'en';
  }

  if (document.documentElement.lang === 'en') {
    // "/?lang=en" comes from the EN button. It works even when storage is blocked, so a Swedish phone
    // that asked for English is never bounced back to Swedish. The address bar is tidied straight after.
    if (/[?&]lang=en(&|$)/.test(location.search)) {
      remember('en');
      try { history.replaceState(null, '', location.pathname + location.hash); } catch (e) {}
    } else if ((remembered() || phoneLanguage()) === 'sv') {
      location.replace('/sv' + location.hash);
    }
  }

  // Remember the switch. Listening on document works before the page has finished loading.
  document.addEventListener('click', function (e) {
    var link = e.target && e.target.closest ? e.target.closest('a[data-lang]') : null;
    if (link) remember(link.getAttribute('data-lang'));
  });
})();
