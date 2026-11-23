// Ellenial status alerts (23 Nov 2026).
//
// The checking itself happens in Supabase: every 10 minutes pg_cron looks at every Ellenial site
// and the outside sources they depend on (supabase/migrations/20261123130000_ops_status_checker.sql).
// This script, run by .github/workflows/status-alerts.yml every half hour, reads the result through
// one public, read-only function and tells Ellen by email when something needs her: it opens an
// issue as the github-actions bot (GitHub emails the owner; issues opened with her own key don't
// notify her). One issue per problem, never repeated; it closes itself when the problem is gone.
//
// Lunch's menu places are left to Lunch's own watchdog, which already alerts per place.
// ALERTS_DRY=1 only prints what it would do.

const SUPABASE_URL = 'https://knvrvmqdxvcatsrvkrgx.supabase.co';
// The publishable key is public by design (every Ellenial app ships it); the function it can call
// returns only the state of Ellenial's own public sites.
const PUBLISHABLE_KEY = 'sb_publishable_5e3mg1E-r-P_to34ONwRfw_FQYUwy3z';
const PREFIX = 'Ellenial alert: ';
const STALE_MINUTES = 35;
const DRY = process.env.ALERTS_DRY === '1';
const REPO = process.env.GITHUB_REPOSITORY || 'phoenixcyberpunk/ellenial';
const CC = process.env.GITHUB_REPOSITORY_OWNER ? `\n\ncc @${process.env.GITHUB_REPOSITORY_OWNER}` : '';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function readStatus() {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/ellenial_status`, {
        method: 'POST',
        headers: { apikey: PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (res.ok) return await res.json();
      console.log(`Status read failed: HTTP ${res.status}`);
    } catch (e) {
      console.log(`Status read failed: ${e.message}`);
    }
    await sleep(attempt * 5000);
  }
  return null;
}

const when = (iso) => new Date(iso).toLocaleString('sv-SE', { timeZone: 'Europe/Stockholm', dateStyle: 'short', timeStyle: 'short' });

// What needs Ellen: { key, title, body }
export function problems(rows, now = new Date()) {
  if (!rows) {
    return [{ key: 'unreachable', title: 'Status database unreachable', body: 'The alert check could not read the status from Supabase three times in a row. Supabase (Gillefeeling\'s project, which also holds Lunch\'s planner and every visit counter) may be down.' }];
  }
  const out = [];
  const tick = rows.find((r) => r.id === 'heartbeat')?.last_tick;
  if (!tick || now - new Date(tick) > STALE_MINUTES * 60000) {
    out.push({ key: 'heartbeat', title: 'Status checker stopped', body: `The checker in Supabase (pg_cron job ops-status-tick) last ran ${tick ? when(tick) : 'never'}. Until it runs again, the dashboard shows old states.` });
  }
  for (const r of rows) {
    if (r.id === 'heartbeat') continue;
    const needs =
      r.state === 'down' ||
      (r.state === 'warn' && (r.id.startsWith('domain:') || r.id.startsWith('infra|') || r.id === 'lunch:reader'));
    if (needs) out.push({ key: r.id, title: r.label, body: `**${r.state === 'down' ? 'Down' : 'Warning'}:** ${r.detail || ''}\n\nSince ${when(r.since)}.` });
  }
  return out;
}

async function gh(path, init = {}) {
  const res = await fetch(`https://api.github.com/repos/${REPO}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });
  if (!res.ok) throw new Error(`GitHub ${init.method || 'GET'} ${path}: HTTP ${res.status}`);
  return res.status === 204 ? null : res.json();
}

async function main() {
  const rows = await readStatus();
  const now = problems(rows);
  const open = (await gh('/issues?state=open&per_page=100')).filter((i) => i.title.startsWith(PREFIX) && !i.pull_request);
  const openByTitle = Object.fromEntries(open.map((i) => [i.title.slice(PREFIX.length), i]));

  for (const p of now) {
    if (openByTitle[p.title]) continue; // already told her: one issue per problem, no repeats
    console.log(`Open: ${p.title}`);
    if (!DRY) await gh('/issues', { method: 'POST', body: JSON.stringify({ title: PREFIX + p.title, body: p.body + '\n\nThis issue closes itself when it\'s fine again. The dashboard shows the details.' + CC }) });
  }
  const stillBad = new Set(now.map((p) => p.title));
  // If the status can't be read at all, don't close anything: nothing is known to be fine.
  if (!rows) return;
  for (const [title, issue] of Object.entries(openByTitle)) {
    if (stillBad.has(title)) continue;
    console.log(`Close: ${title}`);
    if (!DRY) {
      await gh(`/issues/${issue.number}/comments`, { method: 'POST', body: JSON.stringify({ body: `Fine again (${when(new Date())}).` }) });
      await gh(`/issues/${issue.number}`, { method: 'PATCH', body: JSON.stringify({ state: 'closed', state_reason: 'completed' }) });
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
