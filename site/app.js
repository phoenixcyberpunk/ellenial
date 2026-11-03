// The "Share your idea" button: shows a friendly note until there's a real way to receive ideas.
(function () {
  var btn = document.getElementById('ideaBtn');
  var msg = document.getElementById('ideaMsg');
  if (!btn || !msg) return;
  btn.addEventListener('click', function () {
    var open = msg.hidden;
    msg.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
  });
})();

// Auto / Light / Dark in the footer, from the shared Ellenial pattern (ellenial-theme.js).
// The choice is saved on this phone only; nothing is sent anywhere.
(function () {
  var slot = document.getElementById('themeSlot');
  if (!slot || !window.EllenialTheme) return;
  var d = slot.dataset;
  slot.replaceWith(window.EllenialTheme.control({
    label: d.label, autoHint: d.hint, separator: ' · ',
    labels: { auto: d.auto, light: d.light, dark: d.dark }
  }));
})();
