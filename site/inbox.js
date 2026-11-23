/*
  ellenial.app/inbox – Ellen's feedback inbox (23 Nov 2026). Plain script, no build step.
  - Opened with Ellen's inbox key (password manager). No email, no account, no sign-in service.
  - The key is kept for this tab only (sessionStorage) and sent with each inbox call over HTTPS;
    the database stores only its hash.
*/
(function () {
  'use strict';

  var LIVE_HOST = 'ellenial.app';
  var SUPA = 'https://knvrvmqdxvcatsrvkrgx.supabase.co';
  var API_KEY = 'sb_publishable_5e3mg1E-r-P_to34ONwRfw_FQYUwy3z';
  var SESSION = 'ellenial-inbox-key';
  var KINDS = { idea: 'An idea', broken: "Something's broken", kind: 'Feedback' };
  var APPS = { lunch: 'Lunch', weather: 'Weather', maps: 'Maps', quiz: 'Quiz', 'party-games': 'Party games',
    poll: 'Poll', bingo: 'Bingo', present: 'Present', split: 'Split', gillefeeling: 'Gillefeeling',
    site: 'ellenial.app', 'new': 'Something new' };

  var $ = function (id) { return document.getElementById(id); };
  var live = location.hostname === LIVE_HOST;
  var demo = false;
  var messages = [];   // { id, kind, app, message, created_at, kept }

  function show(view) {
    ['vUnlock', 'vInbox'].forEach(function (v) { $(v).hidden = v !== view; });
    if (view === 'vUnlock') $('ibKey').focus();
  }
  function say(text) { $('ibUnlockMsg').textContent = text || ''; $('ibUnlockMsg').hidden = !text; }
  function getKey() { try { return sessionStorage.getItem(SESSION); } catch (e) { return null; } }
  function setKey(k) { try { k ? sessionStorage.setItem(SESSION, k) : sessionStorage.removeItem(SESSION); } catch (e) { /* ignore */ } }

  function close(msg) {
    setKey(null); messages = []; demo = false;
    $('ibList').textContent = ''; $('ibCount').textContent = '';
    show('vUnlock'); say(msg);
  }

  function rpc(name, body) {
    return fetch(SUPA + '/rest/v1/rpc/' + name, {
      method: 'POST',
      headers: { apikey: API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body), credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store'
    }).then(function (r) {
      return r.text().then(function (t) {
        if (r.ok) return t ? JSON.parse(t) : null;
        var m = ''; try { m = JSON.parse(t).message || ''; } catch (e) { /* not JSON */ }
        throw new Error(m || 'http_' + r.status);
      });
    });
  }
  function fail(e) {
    var m = String(e && e.message);
    if (m.indexOf('not_allowed') >= 0) close('That key doesn’t open the inbox.');
    else say('Something went wrong: ' + m);
  }

  function load(key) {
    say('Opening…');
    rpc('ellenial_feedback_inbox', { p_key: key }).then(function (rows) {
      setKey(key); say(''); messages = rows || []; show('vInbox'); render();
    }, fail);
  }

  $('fUnlock').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var key = $('ibKey').value.trim();
    $('ibKey').value = '';
    if (key) load(key);
  });

  function when(iso) {
    var d = new Date(iso), now = new Date();
    var time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    if (d.toDateString() === now.toDateString()) return 'today ' + time;
    var y = new Date(now); y.setDate(now.getDate() - 1);
    if (d.toDateString() === y.toDateString()) return 'yesterday ' + time;
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }

  function button(label, cls, onClick) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'btn ' + cls; b.textContent = label;
    b.addEventListener('click', onClick);
    return b;
  }

  function render() {
    var showKept = (document.querySelector('input[name="show"]:checked') || {}).value === 'kept';
    var fresh = messages.filter(function (m) { return !m.kept; }).length;
    $('ibCount').textContent = fresh ? fresh + ' new' : '';

    // App filter: only apps that have messages.
    var sel = $('ibApp'), current = sel.value;
    var used = Object.keys(messages.reduce(function (a, m) { a[m.app] = 1; return a; }, {}));
    sel.length = 1;
    used.forEach(function (id) { var o = document.createElement('option'); o.value = id; o.textContent = APPS[id] || id; sel.appendChild(o); });
    sel.value = used.indexOf(current) >= 0 ? current : '';
    var app = sel.value;

    var list = $('ibList');
    list.textContent = '';
    var shown = messages.filter(function (m) { return m.kept === showKept && (!app || m.app === app); });
    if (!shown.length) {
      var p = document.createElement('p'); p.className = 'ib-empty';
      p.textContent = showKept ? 'Nothing kept.' : 'No new messages.';
      list.appendChild(p); return;
    }
    shown.forEach(function (m) {
      var card = document.createElement('article'); card.className = 'ib-card';
      var meta = document.createElement('span'); meta.className = 'ib-meta';
      meta.textContent = (KINDS[m.kind] || m.kind) + ' · ' + (APPS[m.app] || m.app) + ' · ' + when(m.created_at);
      // Visitors' text is only ever shown as text, never as HTML.
      var text = document.createElement('p'); text.className = 'ib-text'; text.textContent = m.message;
      var row = document.createElement('div'); row.className = 'ib-row';
      if (!m.kept) row.appendChild(button('Keep', 'fb-send', function () { act('keep', m); }));
      var del = button('Done, delete', 'fb-ghost', function () {
        // Two taps, so a slip of the thumb can't delete anything.
        if (del.dataset.armed) { act('delete', m); return; }
        del.dataset.armed = '1'; del.textContent = 'Tap again to delete';
        setTimeout(function () { delete del.dataset.armed; del.textContent = 'Done, delete'; }, 3000);
      });
      row.appendChild(del);
      card.appendChild(meta); card.appendChild(text); card.appendChild(row);
      list.appendChild(card);
    });
  }

  function act(what, m) {
    var done = function () {
      if (what === 'keep') m.kept = true;
      else messages = messages.filter(function (x) { return x !== m; });
      render();
    };
    if (demo) { done(); return; }
    var key = getKey();
    if (!key) { close('Enter the key again.'); return; }
    rpc(what === 'keep' ? 'ellenial_feedback_keep' : 'ellenial_feedback_delete', { p_key: key, p_id: m.id }).then(done, fail);
  }

  Array.prototype.forEach.call(document.querySelectorAll('input[name="show"]'), function (r) { r.addEventListener('change', render); });
  $('ibApp').addEventListener('change', render);
  $('ibSignOut').addEventListener('click', function () { close(''); });

  // ---- Preview with sample messages (never on the live site) ----
  if (!live) {
    $('ibPreview').hidden = false;
    $('ibDemo').addEventListener('click', function () {
      demo = true;
      var h = 3600 * 1000, now = Date.now();
      messages = [
        { id: 'a', kind: 'broken', app: 'weather', created_at: new Date(now - h).toISOString(), kept: false, message: '[Sample] A visitor’s message about what went wrong would show here.' },
        { id: 'b', kind: 'idea', app: 'lunch', created_at: new Date(now - 26 * h).toISOString(), kept: false, message: '[Sample] A visitor’s idea would show here.\nLine breaks are kept.' },
        { id: 'c', kind: 'kind', app: 'site', created_at: new Date(now - 60 * h).toISOString(), kept: true, message: '[Sample] Feedback would show here.' }
      ];
      show('vInbox'); render();
    });
  }

  // ---- Start: reopen if this tab already has the key ----
  var saved = getKey();
  if (saved && live) load(saved); else show('vUnlock');
})();
