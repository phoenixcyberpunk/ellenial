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
