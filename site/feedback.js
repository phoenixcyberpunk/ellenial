/*
  ellenial.app – the /feedback form (23 Nov 2026). Plain script, no build step.
  - Sends three things: the kind, the app and the message. Nothing else: no name field, no email,
    no cookie, no id. (Plain text by Ellen's choice, 23 Nov: a message written to her is meant for her eyes.)
  - Only the live site sends. On previews and local tests the form works but says nothing is sent.
  - ?app=<id> preselects the app (for the "Feedback" link in each app's footer).
  - On the home page the form opens inside the feedback card (no new page); "Close" folds it back.
    Without scripts, the card's button is a plain link to /feedback.
*/
(function () {
  'use strict';

  var LIVE_HOST = 'ellenial.app';
  var BASE = 'https://knvrvmqdxvcatsrvkrgx.supabase.co/rest/v1/rpc/';
  // Public by design: with this key a visitor can only send a message.
  var API_KEY = 'sb_publishable_5e3mg1E-r-P_to34ONwRfw_FQYUwy3z';
  var MAX = 1000;

  var form = document.getElementById('fbForm');
  if (!form) return;
  var live = location.hostname === LIVE_HOST;
  var $ = function (id) { return document.getElementById(id); };
  var msg = $('fbMsg'), count = $('fbCount'), err = $('fbError'), send = $('fbSend'), app = $('fbApp');
  var sendLabel = send.textContent;

  if (!live) $('fbPreview').hidden = false;
  var inCard = !!$('fbInline');
  var hideOnDone = function (hidden) {
    Array.prototype.forEach.call(document.querySelectorAll('[data-fb-hide-on-done]'), function (el) { el.hidden = hidden; });
  };

  // Preselect the app from ?app=lunch
  try {
    var wanted = new URLSearchParams(location.search).get('app');
    if (wanted && app.querySelector('option[value="' + wanted.replace(/[^a-z0-9-]/g, '') + '"]')) app.value = wanted;
    else if (inCard) app.value = 'site';
  } catch (e) { /* old browser: keep the default */ }

  function updateCount() {
    var n = msg.value.length;
    count.textContent = n + ' / ' + MAX;
    count.classList.toggle('near', n > MAX - 100);
  }
  msg.addEventListener('input', updateCount);
  updateCount();

  function showError(text) { err.textContent = text; err.hidden = !text; }

  function rpc(name, body) {
    return fetch(BASE + name, {
      method: 'POST',
      headers: { apikey: API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
      credentials: 'omit',
      referrerPolicy: 'no-referrer'
    }).then(function (r) {
      return r.text().then(function (t) {
        if (r.ok) return t ? JSON.parse(t) : null;
        var m = ''; try { m = JSON.parse(t).message || ''; } catch (e) { /* not JSON */ }
        var e2 = new Error(m || 'http_' + r.status); throw e2;
      });
    });
  }

  function kindLabel(kind) {
    var input = form.querySelector('input[name="kind"][value="' + kind + '"]');
    return input ? input.nextElementSibling.textContent : kind;
  }

  function done(kind) {
    $('fbSummary').textContent = kindLabel(kind) + ' · ' + app.options[app.selectedIndex].text;
    $('fbFormView').hidden = true;
    hideOnDone(true);
    var view = $('fbDoneView');
    view.hidden = false;
    view.focus({ preventScroll: true });
    if (inCard) $('feedback').scrollIntoView({ block: 'start' });
    else window.scrollTo(0, 0);
  }

  function reset() {
    msg.value = '';
    updateCount();
    showError('');
    $('fbDoneView').hidden = true;
    $('fbFormView').hidden = false;
    hideOnDone(false);
  }

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    showError('');
    var text = msg.value.trim();
    var kind = (form.querySelector('input[name="kind"]:checked') || {}).value || 'idea';
    if (!text) { showError(form.dataset.errEmpty); msg.focus(); return; }
    if (text.length > MAX) text = text.slice(0, MAX);

    // A filled-in trap means a robot: pretend it went fine, send nothing.
    if ($('fbWebsite').value) { done(kind); return; }
    if (!live) { done(kind); return; }

    send.disabled = true;
    send.textContent = form.dataset.sending;
    rpc('ellenial_feedback_send', { p_kind: kind, p_app: app.value, p_message: text })
      .then(function () { done(kind); })
      .catch(function (e) {
        var m = String(e && e.message);
        showError(m.indexOf('rate_limited') >= 0 ? form.dataset.errLimit
          : m.indexOf('inbox_full') >= 0 ? form.dataset.errFull
          : form.dataset.errFail);
      })
      .then(function () { send.disabled = false; send.textContent = sendLabel; });
  });

  $('fbAgain').addEventListener('click', function () { reset(); msg.focus(); });

  // Home page: open and close the form inside the card.
  if (inCard) {
    var openBtn = $('fbOpen'), back = $('fbBack');
    var setOpen = function (open) {
      $('fbIntro').hidden = open;
      $('fbInline').hidden = !open;
      openBtn.setAttribute('aria-expanded', String(open));
    };
    openBtn.addEventListener('click', function (ev) {
      ev.preventDefault();
      setOpen(true);
      msg.focus({ preventScroll: true });
    });
    // Hero badge (25 Nov 2026): open the form in the card and bring the card into view.
    var badge = $('fbBadge');
    if (badge) badge.addEventListener('click', function (ev) {
      ev.preventDefault();
      setOpen(true);
      $('feedback').scrollIntoView({ behavior: 'smooth', block: 'start' });
      msg.focus({ preventScroll: true });
    });
    back.textContent = back.dataset.close;
    back.addEventListener('click', function (ev) {
      ev.preventDefault();
      reset();
      setOpen(false);
      $('feedback').scrollIntoView({ block: 'start' });
      openBtn.focus({ preventScroll: true });
    });
  }
})();
