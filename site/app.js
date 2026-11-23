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
