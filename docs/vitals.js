// Vital signs: the pipeline measures them (scripts/vitals.mjs) into vitals.json; these rules turn the numbers into
// a level per sign. good / ok / low are colours, never grades shown as words; "none" means there's nothing to judge.
// The same rules are written out on how.html#vitals. Run `node docs/vitals.js` to check them.

const DAY = 864e5
export const days = (from, to) => Math.round((Date.parse(to) - Date.parse(from)) / DAY)

// v: one repo's vitals ({ release, weeks, opened, closed, gfi, guide }); today: ISO date
export function signs(v, today) {
  const total = v.weeks.reduce((a, b) => a + b, 0), active = v.weeks.filter(Boolean).length
  const ago = v.release ? days(v.release[1], today) : null
  const few = v.opened < 5 && v.closed < 5
  const pct = Math.min(1, v.closed / Math.max(v.opened, 1))
  return {
    activity: { total, active, level: active >= 6 ? "good" : total ? "ok" : "low" },
    release: { ago, tag: v.release?.[0], date: v.release?.[1], level: ago == null ? "none" : ago <= 90 ? "good" : ago <= 365 ? "ok" : "low" },
    issues: { pct, opened: v.opened, closed: v.closed, level: few ? "none" : pct >= 0.6 ? "good" : pct >= 0.3 ? "ok" : "low" },
  }
}

// rank by measured star gain among the repos in the same subarea; top quarter is good
export function momentum(r, repos) {
  if (r.w == null || !r.a) return { level: "none" }
  const peers = repos.filter((x) => x.a === r.a && x.sa === r.sa && x.w != null).sort((a, b) => b.w - a.w)
  const rank = peers.indexOf(r) + 1, n = peers.length
  return { rank, n, level: rank <= Math.max(1, Math.ceil(n / 4)) ? "good" : rank <= Math.ceil(n * 0.6) ? "ok" : "low" }
}

// one plain line for the side panel: what the numbers say, no verdict words
export function summary(s) {
  const a = s.activity.level === "good" ? "Steady commits" : s.activity.total ? `${s.activity.total} commits in 12 weeks` : "No commits in 12 weeks"
  const r = s.release.ago == null ? "no releases" : `last release ${s.release.ago < 1 ? "today" : s.release.ago === 1 ? "yesterday" : `${s.release.ago} days ago`}`
  const i = s.issues.level === "none" ? "few new issues" : `${Math.round(s.issues.pct * 100)}% of new issues closed`
  return `${a}, ${r}, ${i}`
}

if (typeof process !== "undefined" && import.meta.url === `file://${process.argv[1]}`) {
  const { strict: assert } = await import("node:assert")
  const busy = signs({ release: ["v1", "2026-10-22"], weeks: [35, 27, 40, 18, 22, 34, 32, 20, 17, 13, 33, 44], opened: 222, closed: 164 }, "2026-11-07")
  assert.deepEqual([busy.activity.level, busy.release.level, busy.issues.level, busy.release.ago], ["good", "good", "good", 16])
  const quiet = signs({ release: null, weeks: Array(12).fill(0), opened: 2, closed: 0 }, "2026-11-07")
  assert.deepEqual([quiet.activity.level, quiet.release.level, quiet.issues.level], ["low", "none", "none"])
  const lagging = signs({ release: ["v0", "2025-01-01"], weeks: [0, 0, 3, 0, 0, 0, 0, 0, 1, 0, 0, 0], opened: 40, closed: 8 }, "2026-11-07")
  assert.deepEqual([lagging.activity.level, lagging.release.level, lagging.issues.level], ["ok", "low", "low"])
  assert.equal(signs({ release: null, weeks: Array(12).fill(1), opened: 10, closed: 30 }, "2026-11-07").issues.pct, 1) // old issues closed count, capped
  const rs = Array.from({ length: 8 }, (_, i) => ({ a: "dev", sa: "apis", w: 80 - i * 10 }))
  assert.deepEqual([momentum(rs[0], rs).level, momentum(rs[3], rs).level, momentum(rs[7], rs).level, momentum(rs[1], rs).rank], ["good", "ok", "low", 2])
  assert.equal(summary(busy), "Steady commits, last release 16 days ago, 74% of new issues closed")
  console.log("vitals rules ok")
}
