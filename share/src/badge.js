// The README badge for a listed repo, served at r.starwire.foo/<owner>/<name>/badge.svg.
// It says the best true thing we can about the repo today, so it changes with the nightly refresh.
// The ladder, first rung that holds:
//   1 "#3 in Databases"           top ten by stars in its subarea
//   2 "Rising #2 in Databases"    top five in its subarea by this week's gain for its size (the Trending score)
//   3 "Hidden gem"                on the Trending list with under 1,000 stars
//   4 "+38% this week"            grew a tenth or more this week, by at least ten stars
//   5 "#4 under 1k in Databases"  top ten among the under-1,000-star repos in its subarea (from 10 stars up)
//   6 "Spotted at 47 ★"           the stars it had the day it was first picked: true from day one, better with age
//   7 "Listed"                    when we don't know that number yet
// Rungs 2 to 6 are there for small repos, which rung 1 alone never reaches. A subarea needs MIN_PEERS repos
// (or MIN_PEERS small ones, for rung 5) before a rank in it means anything.
// Run `node share/src/badge.js` to check the rules.

const TOP = 10, RISING = 5, MIN_PEERS = 5, SMALL = 1000, FLOOR = 10
const num = (n) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n))

// r: the repo; repos: every listed repo; subName: Map "area/sub" -> name
// fields: a, sa (area, subarea), s (stars), w (stars gained this week), h (Trending score, 0 when not trending), sp (stars when first picked)
export function badgeText(r, repos, subName) {
  const name = subName.get(`${r.a}/${r.sa}`)
  const peers = name ? repos.filter((x) => x.a === r.a && x.sa === r.sa) : []
  const place = (list, score) => list.filter((x) => score(x) > score(r)).length + 1 // ties share the better place
  if (peers.length >= MIN_PEERS) {
    const rank = place(peers, (x) => x.s)
    if (rank <= TOP) return `#${rank} in ${name}`
    if (r.h > 0) { const k = place(peers, (x) => x.h ?? 0); if (k <= RISING) return `Rising #${k} in ${name}` }
  }
  if (r.h > 0 && r.s < SMALL) return "Hidden gem"
  const before = r.s - (r.w ?? 0) // a repo whose every star came this week has no "before" to grow from
  if (r.w >= 10 && before > 0 && r.w / before >= 0.1) return `+${Math.round((r.w / before) * 100)}% this week`
  if (r.s < SMALL && r.s >= FLOOR) { // below the floor a rank is mostly ties
    const small = peers.filter((x) => x.s < SMALL)
    if (small.length >= MIN_PEERS) { const k = place(small, (x) => x.s); if (k <= TOP) return `#${k} under 1k in ${name}` }
  }
  if (r.sp === 0) return "Spotted before its first star"
  if (r.sp > 0) return `Spotted at ${num(r.sp)} ★`
  return "Listed"
}

// Verdana 11px advance widths, close enough to size the pill: narrow, wide and everything else
const width = (s) => [...s].reduce((w, c) => w + (/[ilI.,:;!|' ]/.test(c) ? 3.8 : /[mwMW&@#%]/.test(c) ? 9.6 : /[A-Z0-9]/.test(c) ? 7.4 : 6.5), 0)
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c])

// two-tone, the shape most README badges have: a dark "★ starwire" then the claim in starwire's gold
export function badgeSVG(text) {
  // bold runs about 7% wider than the table; textLength then makes any renderer fit the words to the pill
  const len = Math.round(width(text) * 1.07), left = 72, right = len + 16, w = left + right
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="20" role="img" aria-label="starwire: ${esc(text)}"><title>starwire: ${esc(text)}</title>` +
    `<clipPath id="r"><rect width="${w}" height="20" rx="3"/></clipPath><g clip-path="url(#r)"><rect width="${left}" height="20" fill="#21262d"/><rect x="${left}" width="${right}" height="20" fill="#e3b341"/></g>` +
    `<g font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11" text-anchor="middle"><text x="${left / 2}" y="14" fill="#e6edf3"><tspan fill="#e3b341">★</tspan> starwire</text>` +
    `<text x="${left + right / 2}" y="14" fill="#0d1117" font-weight="bold" textLength="${len}" lengthAdjust="spacingAndGlyphs">${esc(text)}</text></g></svg>`
}

if (typeof process !== "undefined" && import.meta.url === `file://${process.argv[1]}`) {
  const { strict: assert } = await import("node:assert")
  const sub = new Map([["data/db", "Databases"], ["data/tiny", "Tiny"]])
  // 12 big databases (2,000 to 13,000 stars) and 12 small ones (10 to 120)
  const big = Array.from({ length: 12 }, (_, i) => ({ r: `o/big${i}`, a: "data", sa: "db", s: 13000 - i * 1000, h: 0, w: 0 }))
  const small = Array.from({ length: 12 }, (_, i) => ({ r: `o/small${i}`, a: "data", sa: "db", s: 120 - i * 10, h: 0, w: 0, sp: 5 }))
  const all = [...big, ...small, { r: "o/t", a: "data", sa: "tiny", s: 9, h: 0, w: 0, sp: 0 }]
  const t = (r, list = all) => badgeText(r, list, sub)
  assert.equal(t(big[0]), "#1 in Databases")
  assert.equal(t(big[9]), "#10 in Databases")
  assert.equal(t(big[10]), "Listed") // 11th by stars, not small, nothing else known
  const hot = { ...small[11], h: 3, w: 4 }, withHot = all.map((x) => (x.r === hot.r ? hot : x))
  assert.equal(t(hot, withHot), "Rising #1 in Databases") // the smallest repo wins rung 2
  assert.equal(t({ r: "o/gem", a: "x", sa: "y", s: 300, h: 2, w: 5 }), "Hidden gem") // no subarea name: no rank, still a gem
  assert.equal(t({ ...big[11], w: 400 }), "+25% this week") // 2,000 stars, 400 of them this week
  assert.equal(t({ r: "o/new", a: "x", sa: "y", s: 5000, w: 5000, h: 0 }), "Listed") // all its stars came this week: no % to state
  assert.equal(t(small[0]), "#1 under 1k in Databases")
  assert.equal(t(small[9]), "#10 under 1k in Databases")
  assert.equal(t(small[10]), "Spotted at 5 ★")
  assert.equal(t({ ...small[0], s: 9 }, all.filter((x) => x.s >= 2000)), "Spotted at 5 ★") // 9 stars: under the floor, no rank
  assert.equal(t(all.at(-1)), "Spotted before its first star") // a subarea of one gets no rank
  assert.equal(t({ ...big[10], sp: 46892 }), "Spotted at 47k ★")
  assert.ok(badgeSVG("#3 in R&D <x>").includes("#3 in R&amp;D &lt;x&gt;"))
  console.log("badge rules ok")
}
