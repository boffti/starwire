// Signal: five plain checks on whether a repo's attention is likely to be earned. "Worth a look", the default order,
// is stars gained per day weighted by them, so a repo that passes all five keeps its full gain and one that passes
// none keeps a quarter. Nothing is hidden: a low-signal repo sinks, and every other sort ignores this.
// The same rules are written out on how.html#signal. Run `node docs/js/signal.js` to check them.
// r: a repo from data.json ({ k picks, ca created, p pushed, s stars, fk forks, hs [[day, stars]] }); today: ISO date
const DAY = 864e5, since = (d, today) => (Date.parse(today) - Date.parse(d)) / DAY

// [id, what it asks, passed]: true, false, or null when there is too little to judge (left out of the share)
export function checks(r, today) {
  const hs = r.hs ?? [], gains = hs.slice(1).map((x, i) => x[1] - hs[i][1]), total = gains.reduce((a, b) => a + b, 0)
  return [
    ["picked", "Picked by more than one source", r.k >= 2],
    ["aged", "Older than 90 days", r.ca ? since(r.ca, today) >= 90 : null],
    ["active", "Code pushed in the last 30 days", r.p ? since(r.p, today) <= 30 : null],
    // people who use a project fork it; stars with almost no forks are attention, not use. Small repos are too noisy to say
    ["forks", "Forked by at least 3 in 100 of its stargazers", r.s >= 200 ? r.fk / r.s >= 0.03 : null],
    // one day holding most of the week's stars is a spike, not a trend
    ["steady", "Stars spread over the week, not one day", gains.length >= 4 && total >= 50 ? Math.max(...gains) <= 0.6 * total : null],
  ]
}
export function signal(r, today) {
  const judged = checks(r, today).filter((c) => c[2] != null)
  return judged.length ? judged.filter((c) => c[2]).length / judged.length : 0
}
export const FLOOR = 0.25
export const weight = (r, today) => FLOOR + (1 - FLOOR) * signal(r, today)

if (typeof process !== "undefined" && import.meta.url === `file://${process.argv[1]}`) {
  const { strict: assert } = await import("node:assert")
  const T = "2026-11-11", week = (...s) => s.map((n, i) => [`2026-11-0${i + 5}`, n])
  const proven = { k: 3, ca: "2024-01-01", p: "2026-11-10", s: 5000, fk: 400, hs: week(4700, 4760, 4820, 4880, 4940, 5000) }
  assert.deepEqual(checks(proven, T).map((c) => c[2]), [true, true, true, true, true])
  assert.equal(weight(proven, T), 1)
  // ten days old, one source, 6,000 stars with 20 forks, nearly all of them on one day
  const hype = { k: 1, ca: "2026-11-01", p: "2026-10-01", s: 6000, fk: 20, hs: week(100, 200, 5700, 5800, 5900, 6000) }
  assert.deepEqual(checks(hype, T).map((c) => c[2]), [false, false, false, false, false])
  assert.equal(weight(hype, T), FLOOR)
  // a small quiet repo: forks and star shape aren't judged, so it is scored on the three that are
  const small = { k: 2, ca: "2025-01-01", p: "2026-11-01", s: 80, fk: 0, hs: week(78, 79, 79, 80) }
  assert.deepEqual(checks(small, T).map((c) => c[2]), [true, true, true, null, null])
  assert.equal(signal(small, T), 1)
  assert.equal(signal({ k: 1, s: 10, fk: 0 }, T), 0)
  console.log("signal rules ok")
}
