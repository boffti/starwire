// The README badge for a listed repo, served at r.starwire.foo/<owner>/<name>/badge.svg.
// It says the best true thing we can about the repo today, so it changes with the nightly refresh:
//   "#3 in Databases"      top ten by stars in its subarea (subareas with at least MIN_PEERS repos)
//   "Trending this week"   on the Trending list
//   "Picked 3 times"       picked by more than one source
//   "Listed"               everything else, and any repo we don't know
// Run `node share/src/badge.js` to check the rules.

const TOP = 10, MIN_PEERS = 5

// r: the repo (or undefined); repos: every listed repo; subName: Map "area/sub" -> name
export function badgeText(r, repos, subName) {
  if (!r) return "Listed"
  const name = subName.get(`${r.a}/${r.sa}`)
  if (name) {
    const peers = repos.filter((x) => x.a === r.a && x.sa === r.sa)
    const rank = peers.filter((x) => x.s > r.s).length + 1 // ties share the better rank
    if (peers.length >= MIN_PEERS && rank <= TOP) return `#${rank} in ${name}`
  }
  if (r.h > 0) return "Trending this week"
  if (r.k > 1) return `Picked ${r.k} times`
  return "Listed"
}

// Verdana 11px advance widths, close enough to size the pill: narrow, wide and everything else
const width = (s) => [...s].reduce((w, c) => w + (/[ilI.,:;!|' ]/.test(c) ? 3.8 : /[mwMW&@#%]/.test(c) ? 9.6 : /[A-Z0-9]/.test(c) ? 7.4 : 6.5), 0)
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c])

// two-tone, the shape most README badges have: a dark "★ starwire" then the claim in starwire's gold
export function badgeSVG(text) {
  const left = 72, right = Math.round(width(text) + 16), w = left + right
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="20" role="img" aria-label="starwire: ${esc(text)}"><title>starwire: ${esc(text)}</title>` +
    `<clipPath id="r"><rect width="${w}" height="20" rx="3"/></clipPath><g clip-path="url(#r)"><rect width="${left}" height="20" fill="#21262d"/><rect x="${left}" width="${right}" height="20" fill="#e3b341"/></g>` +
    `<g font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11" text-anchor="middle"><text x="${left / 2}" y="14" fill="#e6edf3"><tspan fill="#e3b341">★</tspan> starwire</text>` +
    `<text x="${left + right / 2}" y="14" fill="#0d1117" font-weight="bold">${esc(text)}</text></g></svg>`
}

if (typeof process !== "undefined" && import.meta.url === `file://${process.argv[1]}`) {
  const { strict: assert } = await import("node:assert")
  const sub = new Map([["data/db", "Databases"], ["data/tiny", "Tiny"]])
  const db = Array.from({ length: 12 }, (_, i) => ({ r: `o/db${i}`, a: "data", sa: "db", s: 1200 - i * 100, h: 0, k: 1 }))
  const tiny = [{ r: "o/t", a: "data", sa: "tiny", s: 9, h: 0, k: 3 }]
  const all = [...db, ...tiny, { r: "o/hot", a: "x", sa: "y", s: 5, h: 2, k: 1 }, { r: "o/plain", a: "x", sa: "y", s: 5, h: 0, k: 1 }]
  assert.equal(badgeText(db[0], all, sub), "#1 in Databases")
  assert.equal(badgeText(db[9], all, sub), "#10 in Databases")
  assert.equal(badgeText(db[10], all, sub), "Listed") // 11th: no rank shown
  assert.equal(badgeText({ ...db[10], h: 1 }, all, sub), "Trending this week")
  assert.equal(badgeText(tiny[0], all, sub), "Picked 3 times") // a subarea of one doesn't get a rank
  assert.equal(badgeText(all.at(-2), all, sub), "Trending this week")
  assert.equal(badgeText(all.at(-1), all, sub), "Listed")
  assert.equal(badgeText(undefined, all, sub), "Listed")
  assert.ok(badgeSVG("#3 in R&D <x>").includes("#3 in R&amp;D &lt;x&gt;"))
  console.log("badge rules ok")
}
