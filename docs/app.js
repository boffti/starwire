// starwire catalog: loads data.json once, filters and renders on the client. State lives in the URL so views can be shared.
const $ = (s) => document.querySelector(s)
const PAGE = 60
const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7L12 17.3 5.8 20.9l1.6-7L2 9.2l7.1-.6z"/></svg>'
const COPY = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>'
const GH = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>'
const num = (n) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n))
// avatars straight from GitHub's image CDN: github.com/<owner>.png is a no-cache redirect, so every re-render of the
// grid went back to github.com for each card and got rate limited; the CDN answers directly and can be cached
const avatar = (owner, size) => `https://avatars.githubusercontent.com/${encodeURIComponent(owner)}?s=${size}`
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c])

import { makeIndex, fieldsFor } from "./search.js?v=3"
import { readmeFragment, followTheme } from "./readme.js?v=1"
import { count } from "./count.js?v=2"
import { signs, summary } from "./vitals.js?v=1"
import { repoPage, missingPage, showReadme, copyClone } from "./repo.js?v=2"

const data = await fetch("data.json").then((r) => r.json())
const now = Date.parse(data.updated)
// facets (docs/plans/2026-11-07-taxonomy.md in the pipeline): area > subarea, form, platform, works with, tags, alternatives
const TX = data.taxonomy ?? { areas: [], forms: [], platforms: [], worksWith: [] }
const AREA = new Map(TX.areas.map((a) => [a.id, a]))
const SUB = new Map(TX.areas.flatMap((a) => a.subs.map(([id, name]) => [`${a.id}/${id}`, name])))
const FORM = new Map(TX.forms), PLAT = new Map(TX.platforms), WITH = new Map(TX.worksWith)
const areaPairs = (r) => (r.a ? [`${r.a}/${r.sa}`, ...(r.mo ?? [])] : [])
const repos = data.repos.map((r) => ({ ...r, age: (now - Date.parse(r.p)) / 864e5 }))
// ranked search, scored against a test set in the pipeline; the index is built on the first search, not on page load
let index
const search = (q, pool) => (q.trim() ? (index ??= makeIndex(repos, fieldsFor(TX)))(q, pool) : null)
const byName = new Map(repos.map((r) => [r.r.toLowerCase(), r]))

// ---- saved for later: repo names in localStorage, oldest first. No accounts, so saves live in this browser,
// and a share link (?saved=a/b,c/d) carries them to another device or person ----
const SAVED_KEY = "starwire-saved"
const NAME = /^[\w.-]+\/[\w.-]+$/
const canon = (n) => byName.get(n.toLowerCase())?.r ?? n
function readSaved() {
  try { const v = JSON.parse(localStorage.getItem(SAVED_KEY) ?? "[]"); return Array.isArray(v) ? [...new Set(v.filter((n) => typeof n === "string" && NAME.test(n)))] : [] } catch { return [] }
}
let saved = readSaved()
let savedAt = new Map(saved.map((n, i) => [n, i]))
function setSaved(list) {
  saved = [...new Set(list)]
  savedAt = new Map(saved.map((n, i) => [n, i]))
  try { localStorage.setItem(SAVED_KEY, JSON.stringify(saved)) } catch {}
}

// ---- settings: per-browser preferences in localStorage. They pick the defaults; a link's own parameters still win,
// so a shared link shows the same thing for everyone. Versioned so later settings can be added without breaking old ones.
const PREFS_KEY = "starwire-prefs"
const DEFAULT_PREFS = { v: 1, sort: "picked", layout: "cards", topics: true, gain: true, picked: true, stardash: true, sidebar: "area", hideAI: false }
const SORTS = ["picked", "trending", "stars", "new", "active"]
function readPrefs() {
  let p = {}
  try { p = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}") ?? {} } catch {}
  const out = { ...DEFAULT_PREFS }
  if (SORTS.includes(p.sort)) out.sort = p.sort
  if (["cards", "list"].includes(p.layout)) out.layout = p.layout
  for (const k of ["topics", "gain", "picked", "stardash", "hideAI"]) if (typeof p[k] === "boolean") out[k] = p[k]
  if (["area", "form", "with"].includes(p.sidebar)) out.sidebar = p.sidebar
  return out
}
let prefs = readPrefs()
function savePrefs() { try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)) } catch {} }
// what hides with CSS: topics, gain badge and picked count on cards, and every StarDash suggestion
const applyLook = () => {
  const b = document.body.classList
  b.toggle("no-topics", !prefs.topics); b.toggle("no-gain", !prefs.gain); b.toggle("no-picked", !prefs.picked); b.toggle("no-stardash", !prefs.stardash)
}
applyLook()

const params = new URLSearchParams(location.search)
// a shared list opens as its own view, with a button to add it to your saves
const shared = [...new Set((params.get("saved") ?? "").split(",").map((n) => n.trim()).filter((n) => NAME.test(n)).map(canon))].slice(0, 500)
const sharedSet = new Set(shared)
// links from before the new categories (?c=Developer tools) open the closest new filter
const OLD_CATEGORY = {
  "AI agents": { a: "ai", sa: "agents" }, "Agent skills and MCP": { form: "agent-skill" }, "LLM tooling and local models": { a: "ai", sa: "llm-tooling" },
  "AI image, video and voice": { a: "ai", sa: "generative-media" }, "Developer tools": { a: "dev" }, "Web and frontend": { a: "web" },
  "Apps for desktop and mobile": { form: "desktop-app" }, "Self-hosted": { form: "self-hosted" }, "Data and databases": { a: "data" },
  "DevOps and cloud": { a: "infra" }, "Security and privacy": { a: "security" }, "Games and graphics": { a: "games" },
  "Hardware and robotics": { a: "hardware" }, "Learning and reference": { a: "learning" }, "Everyday utilities": { a: "system" },
}
const old = OLD_CATEGORY[params.get("c")] ?? {}
const pick = (k, map) => { const v = params.get(k) ?? old[k] ?? ""; return !map || map.has(v) ? v : "" }
const state = {
  a: pick("a", AREA), sa: "", form: pick("form", FORM), plat: pick("plat", PLAT), with: pick("with", WITH),
  f: params.get("f") ?? (shared.length ? "shared" : params.has("multi") ? "multi" : ""), q: params.get("q") ?? "",
  repo: params.get("repo") ?? "", page: params.get("page") ?? "", sort: params.get("sort") ?? (params.get("q") ? "match" : params.get("f") === "saved" ? "saved" : params.get("f") === "trending" ? "trending" : prefs.sort), lang: params.get("lang") ?? "", view: params.get("view") ?? prefs.layout, shown: PAGE,
}
{ const sa = params.get("sa") ?? old.sa; if (state.a && SUB.has(`${state.a}/${sa}`)) state.sa = sa }
// new = a new project: first picked in the last 7 days and created in the last 90 (same rule as the pipeline's README)
const isNew = (r) => (now - Date.parse(r.f)) / 864e5 <= 7 && !!r.ca && (now - Date.parse(r.ca)) / 864e5 <= 90
const VIEWS = [
  { f: "", label: "All repos", test: () => true },
  { f: "trending", label: "Trending", test: (r) => r.h > 0 },
  { f: "new", label: "New this week", test: isNew },
  { f: "multi", label: "Picked more than once", test: (r) => r.k > 1 },
  { f: "saved", label: "Saved", test: (r) => savedAt.has(r.r) },
  { f: "shared", label: "Shared list", test: (r) => sharedSet.has(r.r), hidden: true },
]

// category sidebar with Lucide-style icons, like StarDash's collections list
const I = {
  "": '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  "AI agents": '<rect x="3" y="8" width="18" height="12" rx="2"/><path d="M12 8V4H8M9 13v2M15 13v2"/>',
  "Agent skills and MCP": '<path d="M19.4 13a2 2 0 1 0 0-3H18V7a1 1 0 0 0-1-1h-3V4.6a2 2 0 1 0-3 0V6H8a1 1 0 0 0-1 1v3h1.4a2 2 0 1 1 0 3H7v4a1 1 0 0 0 1 1h3v-1.4a2 2 0 1 1 3 0V18h3a1 1 0 0 0 1-1v-4z"/>',
  "LLM tooling and local models": '<path d="M12 3l1.8 4.7 4.7 1.8-4.7 1.8L12 16l-1.8-4.7-4.7-1.8 4.7-1.8zM19 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>',
  "AI image, video and voice": '<rect x="3" y="8" width="18" height="12" rx="2"/><path d="M3 8l2.5-4.5h13L21 8M8.5 3.5 11 8M14 3.5 16.5 8"/>',
  "Developer tools": '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.4-.4-2.4z"/>',
  "Web and frontend": '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  "Apps for desktop and mobile": '<rect x="2" y="4" width="14" height="10" rx="1.5"/><path d="M6 18h6M9 14v4"/><rect x="17" y="9" width="5" height="11" rx="1"/>',
  "Self-hosted": '<rect x="3" y="4" width="18" height="7" rx="1.5"/><rect x="3" y="13" width="18" height="7" rx="1.5"/><path d="M7 7.5h.01M7 16.5h.01"/>',
  "Data and databases": '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
  "DevOps and cloud": '<path d="M17.5 19a4.5 4.5 0 1 0-1.4-8.8A6 6 0 0 0 4.5 12 3.5 3.5 0 0 0 6 19z"/>',
  "Security and privacy": '<path d="M12 22s8-3.5 8-10V5l-8-3-8 3v7c0 6.5 8 10 8 10z"/>',
  "Games and graphics": '<rect x="2" y="7" width="20" height="11" rx="4"/><path d="M7 11v4M5 13h4M15 12h.01M18 14h.01"/>',
  "Hardware and robotics": '<rect x="6" y="6" width="12" height="12" rx="1.5"/><rect x="9.5" y="9.5" width="5" height="5"/><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"/>',
  "Learning and reference": '<path d="M2 5h6a4 4 0 0 1 4 4v11a3 3 0 0 0-3-3H2zM22 5h-6a4 4 0 0 0-4 4v11a3 3 0 0 1 3-3h7z"/>',
  "Everyday utilities": '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18"/>',
}
I.trending = '<path d="M22 7l-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>'
I.new = '<path d="M12 3l1.8 4.7 4.7 1.8-4.7 1.8L12 16l-1.8-4.7-4.7-1.8 4.7-1.8z"/><path d="M5 19h.01M19 5h.01"/>'
I.saved = '<path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z"/>'
// area icons: the old category icons where they fit, new ones for the rest
Object.assign(I, {
  ai: I["AI agents"], dev: I["Developer tools"], web: I["Web and frontend"], infra: I["DevOps and cloud"], data: I["Data and databases"],
  security: I["Security and privacy"], media: I["AI image, video and voice"], games: I["Games and graphics"], hardware: I["Hardware and robotics"],
  system: I["Apps for desktop and mobile"], learning: I["Learning and reference"],
  productivity: '<path d="M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2"/>',
  communication: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  science: '<path d="M9 3h6M10 3v6L4.5 19a1.5 1.5 0 0 0 1.3 2.2h12.4a1.5 1.5 0 0 0 1.3-2.2L14 9V3"/><path d="M7 15h10"/>',
  finance: '<circle cx="12" cy="12" r="9"/><path d="M15 9.5c-.5-1-1.6-1.5-3-1.5-1.7 0-3 .9-3 2s1.3 1.7 3 2 3 .9 3 2-1.3 2-3 2c-1.4 0-2.5-.5-3-1.5M12 6v2M12 16v2"/>',
})
I.multi = '<path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>'
const item = (attr, key, label, count) =>
  `<button type="button" class="cat" data-${attr}="${esc(key)}" aria-current="false"><svg viewBox="0 0 24 24" aria-hidden="true">${I[key] ?? I[""]}</svg><span>${esc(label)}</span><span class="n">${count.toLocaleString("en-US")}</span></button>`
$("#views").innerHTML = "<h2>Browse</h2>" + VIEWS.filter((v) => !v.hidden).map((v) => item("f", v.f, v.label, v.f === "saved" ? saved.length : repos.filter(v.test).length)).join("")
const visible = (r) => !(prefs.hideAI && r.ai > 0) // "Hide AI repos" in settings
let collapsed = false // the selected area's subareas are folded away; the area itself stays selected
function renderSidebar() {
  const pool = repos.filter(visible), count = (test) => pool.filter(test).length
  let html
  if (prefs.sidebar === "form") html = "<h2>Forms</h2>" + TX.forms.map(([id, name]) => [id, name, count((r) => r.fo?.includes(id))]).filter((x) => x[2]).sort((a, b) => b[2] - a[2]).map(([id, name, n]) => item("form", id, name, n)).join("")
  else if (prefs.sidebar === "with") html = "<h2>Works with</h2>" + TX.worksWith.map(([id, name]) => [id, name, count((r) => r.ww?.includes(id))]).filter((x) => x[2]).sort((a, b) => b[2] - a[2]).map(([id, name, n]) => item("with", id, name, n)).join("")
  else html = "<h2>Areas</h2>" + TX.areas.filter((a) => !(prefs.hideAI && a.id === "ai")).map((a) => [a, count((r) => areaPairs(r).some((p) => p.startsWith(a.id + "/")))]).filter((x) => x[1]).sort((x, y) => y[1] - x[1]).map(([a, n]) =>
    item("a", a.id, a.name, n) + (a.id === state.a && !collapsed ? `<div class="subs">${a.subs.map(([id, name]) => [id, name, count((r) => areaPairs(r).includes(`${a.id}/${id}`))]).filter((x) => x[2]).sort((x, y) => y[2] - x[2]).map(([id, name, k]) => `<button type="button" class="cat sub" data-sa="${esc(id)}" aria-current="false"><span>${esc(name)}</span><span class="n">${k.toLocaleString("en-US")}</span></button>`).join("")}</div>` : "")).join("")
  $("#cats").innerHTML = html
}
renderSidebar()

const langs = Object.entries(repos.reduce((a, r) => (r.g && (a[r.g] = (a[r.g] ?? 0) + 1), a), {})).sort((a, b) => b[1] - a[1])
$("#lang").innerHTML += langs.map(([l, n]) => `<option value="${esc(l)}">${esc(l)} (${n})</option>`).join("")

// the build says how much of the week a gain covers: "+255 in 1 day" (measured so far), "+700 a week", "~+700 a week" (estimate)
const gain = (r) => r.wt ?? `+${num(r.w)} a week`
const gainTitle = (r) => (gain(r).startsWith("~") ? "Estimated: the days not measured yet use the repo's average since it was created" : "Measured from our daily star counts")
const fresh = (d) => (d < 30 ? ["var(--green)", d < 1 ? "updated today" : `updated ${Math.round(d)}d ago`] : d < 365 ? ["var(--amber)", `updated ${Math.round(d / 30)}mo ago`] : ["var(--muted)", `quiet ${Math.round(d / 365)}y`])

const BOOKMARK = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${I.saved.slice(9, -3)}"/></svg>`
const saveBtn = (n) => {
  const on = savedAt.has(n), name = n.split("/")[1]
  return `<button type="button" class="save" data-save="${esc(n)}" aria-pressed="${on}" aria-label="${on ? `Remove ${esc(name)} from saved` : `Save ${esc(name)} for later`}" title="${on ? "Saved" : "Save for later"}">${BOOKMARK}</button>`
}

// "picked 3×" and "new": at the end of the stats, or beside the name in the phone list view where the stats line is full
const pills = (r) => `${r.k > 1 ? `<span class="pill picked">picked ${r.k}×</span>` : ""}${isNew(r) ? '<span class="pill new">new</span>' : ""}`

function card(r) {
  const [owner, name] = r.r.split("/")
  const [fc, ft] = fresh(r.age)
  return `<div class="repo" role="button" tabindex="0" data-r="${esc(r.r)}" aria-label="${esc(name)} details">
  <div class="head"><img src="${esc(avatar(owner, 56))}" alt="" loading="lazy" decoding="async" width="28" height="28"><div class="name"><strong>${esc(name)}</strong><span>${esc(owner)}</span></div>${pills(r) ? `<span class="head-pills">${pills(r)}</span>` : ""}${saveBtn(r.r)}<a class="jump" href="https://github.com/${esc(r.r)}" target="_blank" rel="noopener" aria-label="Open ${esc(name)} on GitHub" title="Open on GitHub">${GH}</a></div>
  <p class="line">${esc(r.l)}</p>
  ${r.t.length ? `<div class="topics">${r.t.slice(0, 3).map((t) => `<span>${esc(t)}</span>`).join("")}</div>` : ""}
  <div class="meta"><span class="stars">${STAR}${num(r.s)}</span>${r.g ? `<span class="dot" style="--c:${esc(r.gc ?? "")}">${esc(r.g)}</span>` : ""}${r.h > 0 ? `<span class="rise" title="${esc(gainTitle(r))}">${esc(gain(r))}</span>` : ""}<span class="fresh" style="--f:${fc}">${ft}</span>${pills(r)}</div>
</div>`
}

const promo = `<a class="promo" href="https://github.com/boffti/stardash" target="_blank" rel="noopener">
  <div><small>From the maker of starwire</small><strong>Keep the ones you star organized</strong><p>StarDash sorts your GitHub stars into collections, tags them with AI and tells you when tools you use ship breaking changes. Free, open source and self-hosted.</p></div>
  <span>Try StarDash for free</span>
</a>`

const sorters = {
  saved: (a, b) => (savedAt.get(b.r) ?? -1) - (savedAt.get(a.r) ?? -1),
  trending: (a, b) => b.h - a.h,
  picked: (a, b) => b.k - a.k || b.s - a.s,
  stars: (a, b) => b.s - a.s,
  new: (a, b) => b.f.localeCompare(a.f) || b.s - a.s,
  active: (a, b) => a.age - b.age,
}

// StarDash card: a random row (4th to 8th) and a random column, picked once per visit so it stays put while filtering
const PROMO_ROW = 3 + Math.floor(Math.random() * 5), PROMO_COL = Math.random()

const facetMatch = (r) =>
  (!state.a || areaPairs(r).some((p) => (state.sa ? p === `${state.a}/${state.sa}` : p.startsWith(state.a + "/")))) &&
  (!state.form || r.fo?.includes(state.form)) && (!state.plat || r.pl?.includes(state.plat)) && (!state.with || r.ww?.includes(state.with))
const anyFacet = () => state.a || state.form || state.plat || state.with

const PHONE = matchMedia("(max-width: 760px)")
PHONE.addEventListener("change", () => render())

function render() {
  const onPage = !!state.page
  $("#repo-page").hidden = !onPage
  for (const el of document.querySelectorAll(".page > :not(#repo-page)")) el.hidden = onPage
  if (onPage) return showPage(), syncURL()
  if (shownPage) { shownPage = ""; document.title = TITLE }
  const view = VIEWS.find((v) => v.f === state.f) ?? VIEWS[0]
  let list = repos.filter((r) => visible(r) && view.test(r) && facetMatch(r) && (!state.lang || r.g === state.lang))
  const scores = search(state.q, list)
  if (scores) list = list.filter((r) => scores.has(r))
  // searching inside a view, area or filter: say how many matches the rest of the list has, so an empty or short
  // result isn't mistaken for the search failing
  const narrowed = scores && (anyFacet() || state.f || state.lang)
  const elsewhere = narrowed ? [...search(state.q, repos.filter(visible)).keys()].filter((r) => !scores.has(r)).length : 0
  $("#everywhere").hidden = !elsewhere
  $("#everywhere").textContent = `${elsewhere.toLocaleString("en-US")} more ${elsewhere === 1 ? "match" : "matches"} in all repos`
  list.sort(scores && state.sort === "match" ? (a, b) => scores.get(b) - scores.get(a) : sorters[state.sort] ?? sorters.picked)
  // saved repos that dropped off the list stay, at the end, so a save is never lost silently
  const gone = state.f === "saved" && !anyFacet() && !state.lang && !scores ? saved.filter((n) => !byName.has(n.toLowerCase())) : []
  const el = $("#results")
  const layout = PHONE.matches ? "list" : state.view // phones always get the list; cards add nothing on a narrow screen
  el.className = layout === "list" ? "list" : "cards"
  const cols = getComputedStyle(el).gridTemplateColumns.split(" ").length
  const spot = PROMO_ROW * cols + Math.floor(PROMO_COL * cols)
  // the StarDash card takes one repo's place, so a full page is 60 cells: whole rows at 3, 4, 5 or 6 columns
  const promoted = layout === "cards" && !state.q && !["saved", "shared"].includes(state.f) && Math.min(list.length, state.shown) > spot
  const shown = state.shown - (promoted ? 1 : 0)
  const page = list.slice(0, shown).map(card)
  if (list.length <= shown) page.push(...gone.map((n) => `<div class="repo gone"><div class="head"><div class="name"><strong>${esc(n.split("/")[1])}</strong><span>${esc(n.split("/")[0])}</span></div>${saveBtn(n)}</div><p class="line">No longer on the list. <a href="https://github.com/${esc(n)}" target="_blank" rel="noopener">Open on GitHub</a></p></div>`))
  if (promoted) page.splice(spot, 0, promo)
  const empty = state.f === "saved" && !saved.length
    ? `<div class="empty">Nothing saved yet. Use the bookmark on any repo to keep it here.<br>Saves stay in this browser.</div>`
    : `<div class="empty">No repos match that yet. Try fewer words or another filter.<br><button type="button" id="reset">Clear filters</button></div>`
  el.innerHTML = page.length ? page.join("") : empty
  savedBar(list.length + gone.length)
  $("#title").textContent = state.sa ? SUB.get(`${state.a}/${state.sa}`) : state.a ? AREA.get(state.a).name
    : prefs.sidebar === "form" && state.form ? FORM.get(state.form) : prefs.sidebar === "with" && state.with ? WITH.get(state.with) : view.label
  const total = list.length + gone.length
  const parts = [`${total.toLocaleString("en-US")} ${total === 1 ? "repo" : "repos"}`]
  if (anyFacet() && state.f) parts.push(view.label.toLowerCase())
  if (state.sa) parts.push(`in ${AREA.get(state.a).name}`)
  if (state.form && !(prefs.sidebar === "form" && !state.a)) parts.push(FORM.get(state.form).toLowerCase())
  if (state.plat) parts.push(`on ${PLAT.get(state.plat)}`)
  if (state.with && !(prefs.sidebar === "with" && !state.a)) parts.push(`works with ${WITH.get(state.with)}`)
  if (state.lang) parts.push(`in ${state.lang}`)
  if (prefs.hideAI) parts.push("AI repos hidden")
  if (!anyFacet() && !state.f && !state.lang && !state.q) parts.push(`updated ${new Date(now).toLocaleDateString("en-US", { month: "long", day: "numeric" })}`)
  $("#sub").textContent = parts.join(", ")
  // phones keep the filters behind one button; it shows how many are on
  const on = ["form", "plat", "with", "lang"].filter((k) => state[k]).length
  $("#filters-n").hidden = !on; $("#filters-n").textContent = on
  $("#more").hidden = list.length <= shown
  $("#more").textContent = `Show more (${(list.length - shown).toLocaleString("en-US")} left)`
  const group = prefs.sidebar === "form" ? state.form : prefs.sidebar === "with" ? state.with : state.a
  document.querySelectorAll("[data-f]").forEach((n) => n.setAttribute("aria-current", String(!group && n.dataset.f === state.f)))
  for (const k of ["a", "form", "with"]) document.querySelectorAll(`[data-${k}]`).forEach((n) => n.setAttribute("aria-current", String(n.dataset[k] === state[k] && !(k === "a" && state.sa))))
  document.querySelectorAll("[data-sa]").forEach((n) => n.setAttribute("aria-current", String(n.dataset.sa === state.sa)))
  document.querySelectorAll(".view button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.view === state.view)))
  $("#reset")?.addEventListener("click", () => set({ f: "", a: "", sa: "", form: "", plat: "", with: "", q: "", lang: "" }, true))
  syncURL()
  const place = state.a ? `area/${state.a}${state.sa ? `/${state.sa}` : ""}` : `view/${state.f || "all"}`
  if (place !== counted.place) count((counted.place = place), state.a ? "Area" : "View")
  // a search counts once the typing stops, so "pdf editor" isn't also counted as "pd" and "pdf e"
  clearTimeout(counted.t)
  const q = state.q.toLowerCase().slice(0, 60)
  if (q && q !== counted.q) counted.t = setTimeout(() => count(`search/${(counted.q = q)}`, total ? "Search" : "Search, no results"), 2000)
}
const counted = { place: "", q: "", t: 0 }

function syncURL() {
  const p = new URLSearchParams()
  for (const k of ["f", "a", "sa", "form", "plat", "with", "q", "lang", "repo", "page"]) if (state[k] && !(k === "f" && state.f === "shared")) p.set(k, state[k])
  if (state.f === "shared") p.set("saved", shared.join(","))
  if (state.sort !== "picked" && !(state.sort === "match" && state.q)) p.set("sort", state.sort)
  if (state.view !== "cards") p.set("view", state.view)
  history.replaceState(null, "", `${location.pathname}${p.size ? `?${p}` : ""}`)
}

// ---- repo page: ?page=owner/name shows the repo in the main column, sidebar and search stay ----
const TITLE = document.title
let shownPage = "", vitals
async function showPage() {
  if (shownPage === state.page) return // already drawn: keep its README and scroll position
  shownPage = state.page
  const r = byName.get(state.page.toLowerCase()), el = $("#repo-page")
  if (!r) { el.innerHTML = missingPage(state.page); document.title = TITLE; return }
  vitals ??= fetch("vitals.json").then((x) => (x.ok ? x.json() : {})).catch(() => ({}))
  const want = state.page, v = await vitals
  if (state.page !== want) return // moved on while vitals loaded
  el.innerHTML = repoPage(r, { repos, vitals: v, today: data.updated.slice(0, 10), TX, saved: savedAt.has(r.r) })
  document.title = `${r.r.split("/")[1]}: ${r.l || "open source repo"} | starwire`
  count(`page/${r.r}`, "Repo page")
}
// links inside the app (?page=, ?q=, ?a=) move within it and get a history entry, so Back returns
let moved = false
function navigate(href) {
  history.pushState(null, "", `${location.pathname}${href}`)
  moved = true
  fromURL()
}
function fromURL() {
  const p = new URLSearchParams(location.search)
  set(Object.fromEntries(["f", "a", "sa", "form", "plat", "with", "q", "lang", "page"].map((k) => [k, p.get(k) ?? ""])), true)
  scrollTo({ top: 0 })
}
addEventListener("popstate", fromURL)
const inApp = (e) => { const a = e.target.closest('a[href^="?"]'); return a && !e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0 ? a : null }

function set(patch, syncInputs) {
  const hadQ = state.q
  if (!("page" in patch)) patch = { ...patch, page: "" } // any change to the list leaves the repo page
  Object.assign(state, patch, "shown" in patch ? {} : { shown: PAGE })
  // typing a search switches to Best match; clearing it goes back to the usual order
  if (state.q && !hadQ && !("sort" in patch)) state.sort = "match", (syncInputs = true)
  if (!state.q && state.sort === "match") state.sort = ["trending", "saved"].includes(state.f) ? state.f : prefs.sort, (syncInputs = true)
  $("#sort-match").hidden = $("#sort-match").disabled = !state.q
  if (syncInputs) { $("#q").value = state.q; $("#lang").value = state.lang; $("#sort").value = state.sort; for (const k of ["form", "plat", "with"]) $(`#f-${k}`).value = state[k] }
  renderSidebar()
  render()
}

const closeMenu = () => $("#app").classList.remove("open")
$("#q").value = state.q
$("#sort-match").hidden = $("#sort-match").disabled = !state.q
$("#sort").value = state.sort
$("#lang").value = state.lang
let t
$("#q").addEventListener("input", (e) => { clearTimeout(t); t = setTimeout(() => set({ q: e.target.value.trim() }), 120) })
$("#sort").addEventListener("change", (e) => set({ sort: e.target.value }))
$("#lang").addEventListener("change", (e) => set({ lang: e.target.value }))
// Form, Platform and Works with dropdowns next to Language, with counts
for (const [k, label, map, has] of [["form", "Form", TX.forms, (r, id) => r.fo?.includes(id)], ["plat", "Platform", TX.platforms, (r, id) => r.pl?.includes(id)], ["with", "Works with", TX.worksWith, (r, id) => r.ww?.includes(id)]]) {
  const el = $(`#f-${k}`)
  el.innerHTML = `<option value="">Any</option>` + map.map(([id, name]) => [id, name, repos.filter((r) => has(r, id)).length]).filter((x) => x[2]).sort((a, b) => b[2] - a[2]).map(([id, name, n]) => `<option value="${esc(id)}">${esc(name)} (${n})</option>`).join("")
  el.value = state[k]
  el.addEventListener("change", (e) => set({ [k]: e.target.value }))
}
$("#sidebar").addEventListener("click", (e) => {
  const n = e.target.closest(".cat")
  if (!n) return
  // views and sidebar groups are one choice: picking either clears the other; clicking the selected one again goes back
  const f = "f" in n.dataset ? n.dataset.f : ""
  const sort = f === "trending" || f === "saved" ? f : ["trending", "saved"].includes(state.sort) ? prefs.sort : state.sort
  const d = n.dataset
  if ("sa" in d) set({ sa: d.sa === state.sa ? "" : d.sa })
  else if ("a" in d) {
    // clicking the selected area again folds or unfolds its subareas and keeps it selected
    collapsed = d.a === state.a && !state.sa ? !collapsed : false
    set({ a: d.a, sa: "", f: "", sort }, true)
  }
  else if ("form" in d) set({ form: d.form === state.form ? "" : d.form, f: "", sort }, true)
  else if ("with" in d) set({ with: d.with === state.with ? "" : d.with, f: "", sort }, true)
  else set({ f, a: "", sa: "", [prefs.sidebar === "form" ? "form" : prefs.sidebar === "with" ? "with" : "a"]: "", sort }, true)
  if ("a" in d && state.a) return // on phones, keep the menu open so the area's subareas can be picked
  scrollTo({ top: 0 })
  closeMenu()
})
$("#filters-btn").addEventListener("click", (e) => {
  const open = $("#filters").classList.toggle("open")
  e.currentTarget.setAttribute("aria-expanded", String(open))
})
$("#menu").addEventListener("click", () => $("#app").classList.add("open"))
$("#scrim").addEventListener("click", closeMenu)
document.querySelector(".view").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) set({ view: b.dataset.view, shown: state.shown }) })
$("#everywhere").addEventListener("click", () => set({ f: "", a: "", sa: "", form: "", plat: "", with: "", lang: "", sort: "match" }, true))
$("#more").addEventListener("click", () => set({ shown: state.shown + PAGE }))
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeMenu()
  if (e.key === "/" && document.activeElement !== $("#q")) { e.preventDefault(); $("#q").focus() }
})
$("#theme").addEventListener("click", () => {
  const dark = getComputedStyle(document.documentElement).colorScheme.includes("dark")
  document.documentElement.dataset.theme = dark ? "light" : "dark"
  try { localStorage.setItem("starwire-theme", document.documentElement.dataset.theme) } catch {}
  followTheme(panel)
})
// the line under the title in Saved and in a shared list: share your saves, or add a shared list to them
function savedBar(count) {
  const bar = $("#savedbar")
  if (state.f === "saved" && saved.length) {
    bar.innerHTML = `<span>Saves stay in this browser. A link carries them to another device.</span><button type="button" class="btn" id="share-saved">Copy share link</button>`
  } else if (state.f === "shared") {
    const add = shared.filter((n) => !savedAt.has(n)).length
    bar.innerHTML = add
      ? `<span>Someone shared ${shared.length === 1 ? "this repo" : `these ${shared.length} repos`} with you.</span><button type="button" class="btn primary" id="add-shared">Save ${add === shared.length ? (add === 1 ? "it" : `all ${add}`) : `the ${add} new`}</button>`
      : `<span>All of these are in your saved list.</span><button type="button" class="btn" id="go-saved">Go to saved</button>`
  } else return void (bar.hidden = true)
  bar.hidden = false
  if (!count && state.f === "shared") bar.querySelector("span").textContent = "None of the shared repos are on the list anymore."
}
$("#savedbar").addEventListener("click", async (e) => {
  const b = e.target.closest("button")
  if (!b) return
  if (b.id === "share-saved") {
    const url = `${location.origin}${location.pathname}?saved=${saved.join(",")}`
    try { await navigator.clipboard.writeText(url); b.textContent = "Link copied" } catch { prompt("Copy this link", url) }
    setTimeout(() => (b.textContent = "Copy share link"), 1600)
  }
  if (b.id === "add-shared") { setSaved([...saved, ...shared]); savedChanged() }
  if (b.id === "add-shared" || b.id === "go-saved") set({ f: "saved", c: "", sort: "saved" }, true)
})

function savedChanged() {
  for (const b of document.querySelectorAll("[data-save]")) {
    const on = savedAt.has(b.dataset.save), name = b.dataset.save.split("/")[1]
    b.setAttribute("aria-pressed", String(on))
    if (b.classList.contains("btn") && !b.classList.contains("icon")) b.lastChild.textContent = on ? "Saved" : "Save" // icon-only buttons keep their icon
    else { b.title = on ? "Saved" : "Save for later"; b.setAttribute("aria-label", on ? `Remove ${name} from saved` : `Save ${name} for later`) }
  }
  const n = document.querySelector('[data-f="saved"] .n')
  if (n) n.textContent = saved.length.toLocaleString("en-US")
}
function toggleSave(n) {
  if (!savedAt.has(n)) count(`save/${n}`, "Saved")
  setSaved(savedAt.has(n) ? saved.filter((x) => x !== n) : [...saved, n])
  savedChanged()
  if (state.f === "saved" || state.f === "shared") render() // keeps the page size, so the list doesn't jump back to the top
}
// another tab saved or removed something
addEventListener("storage", (e) => { if (e.key !== SAVED_KEY) return; saved = []; setSaved(readSaved()); savedChanged(); if (state.f === "saved") render() })

// settings panel: slides in like the repo panel, every change applies at once
const settings = $("#settings")
const GEAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>'
$("#open-settings").innerHTML = GEAR
const themeNow = () => { try { return localStorage.getItem("starwire-theme") ?? "system" } catch { return "system" } }
const seg = (name, label, value, options) => `<fieldset class="s-row"><legend>${label}</legend><div class="seg">${options.map(([v, t]) => `<label><input type="radio" name="${name}" value="${v}"${v === value ? " checked" : ""}><span>${t}</span></label>`).join("")}</div></fieldset>`
const check = (name, label) => `<label class="check"><input type="checkbox" name="${name}"${prefs[name] ? " checked" : ""}>${label}</label>`
function openSettings() {
  settings.innerHTML = `
  <div class="p-head"><div class="name"><strong>Settings</strong><span>Saved in this browser</span></div>
    <button class="icon-btn s-close" type="button" aria-label="Close settings"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg></button></div>
  <form class="p-body s-body">
    ${seg("sidebar", "Sidebar shows", prefs.sidebar, [["area", "Areas"], ["form", "Forms"], ["with", "Works with"]])}
    <fieldset class="s-row"><legend>Repos</legend>${check("hideAI", "Hide AI repos (AI tools, agents and anything built around AI)")}</fieldset>
    ${seg("sort", "Default sort", prefs.sort, [["picked", "Most picked"], ["trending", "Trending"], ["stars", "Most stars"], ["new", "Newest"]])}
    <div class="s-layout">${seg("layout", "Default layout", prefs.layout, [["cards", "Cards"], ["list", "List"]])}</div>
    ${seg("theme", "Theme", themeNow(), [["system", "System"], ["light", "Light"], ["dark", "Dark"]])}
    <fieldset class="s-row"><legend>On each repo card</legend>${check("topics", "Topics")}${check("gain", "Stars gained")}${check("picked", "How many times it was picked")}</fieldset>
    <fieldset class="s-row"><legend>StarDash</legend>${check("stardash", "Show suggestions for StarDash, our tool for organizing your own stars")}</fieldset>
    <div class="s-foot"><button class="btn" type="button" id="s-reset">Reset to defaults</button></div>
  </form>`
  settings.hidden = false
  document.body.classList.add("has-panel")
  settings.querySelector(".s-close").focus()
}
function closeSettings() {
  if (settings.hidden) return
  settings.hidden = true
  if (panel.hidden) document.body.classList.remove("has-panel")
  $("#open-settings").focus()
}
function setTheme(t) {
  try { t === "system" ? localStorage.removeItem("starwire-theme") : localStorage.setItem("starwire-theme", t) } catch {}
  t === "system" ? delete document.documentElement.dataset.theme : (document.documentElement.dataset.theme = t)
  followTheme(panel)
}
$("#open-settings").addEventListener("click", openSettings)
settings.addEventListener("click", (e) => {
  if (e.target.closest(".s-close")) return closeSettings()
  if (e.target.closest("#s-reset")) {
    prefs = { ...DEFAULT_PREFS }; savePrefs(); applyLook(); setTheme("system"); renderSidebar()
    set({ sort: ["trending", "saved"].includes(state.f) ? state.sort : prefs.sort, view: prefs.layout }, true)
    openSettings()
  }
})
settings.addEventListener("change", (e) => {
  const { name, value, checked, type } = e.target
  if (name === "theme") return setTheme(value)
  prefs[name] = type === "checkbox" ? checked : value
  savePrefs(); applyLook()
  // a new default sort or layout applies to what's on screen now too, except in Trending and Saved, which keep their own order
  if (name === "sort" && !["trending", "saved"].includes(state.f)) set({ sort: value }, true)
  if (name === "layout") set({ view: value, shown: state.shown })
  if (name === "sidebar") set({ a: "", sa: "", form: "", with: "" }, true)
  if (name === "hideAI") set({}, true)
})
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeSettings() })

render()

// ---- repo panel: README preview, facts, star trend, similar repos ----
const panel = $("#panel")
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => followTheme(panel))

function similar(r) {
  // same subarea counts most, then same area, shared tags, shared tools and forms; stars break ties
  const pairs = areaPairs(r), tags = new Set([...(r.tg ?? []), ...r.t]), ww = new Set(r.ww ?? []), fo = new Set(r.fo ?? [])
  return repos
    .filter((x) => x !== r && visible(x))
    .map((x) => {
      const xp = areaPairs(x)
      const place = xp[0] && xp[0] === pairs[0] ? 6 : xp.some((p) => pairs.includes(p)) ? 4 : xp.some((p) => pairs.some((q) => q.split("/")[0] === p.split("/")[0])) ? 2 : 0
      const shared = [...(x.tg ?? []), ...x.t].filter((t) => tags.has(t)).length * 2 + (x.ww ?? []).filter((w) => ww.has(w)).length + (x.fo ?? []).filter((f) => fo.has(f)).length * 0.5
      return [x, place ? place + shared + x.k * 0.3 + Math.log10(x.s + 1) : 0]
    })
    .filter(([, sc]) => sc > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([x]) => x)
}

function trend(hs) {
  if (hs.length < 2) return `<p class="muted">Star history starts with this list, so the chart fills in over the next few updates.</p>`
  const ys = hs.map((h) => h[1]), lo = Math.min(...ys), hi = Math.max(...ys), w = 320, h = 64
  const pts = hs.map(([, s], i) => `${((i / (hs.length - 1)) * w).toFixed(1)},${(h - 4 - ((s - lo) / (hi - lo || 1)) * (h - 8)).toFixed(1)}`).join(" ")
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-label="Stars from ${num(lo)} to ${num(hi)}"><polyline points="${pts}"/></svg><p class="muted">${num(lo)} to ${num(hi)} stars, ${esc(hs[0][0])} to ${esc(hs.at(-1)[0])}</p>`
}

async function readme(r) {
  const el = panel.querySelector(".readme")
  try {
    const { md, frag } = await readmeFragment(r.r)
    if (state.repo !== r.r) return // the user moved on while it loaded
    if (!md) { el.innerHTML = `<p class="muted">This repo has no README to preview.</p>`; return }
    el.replaceChildren(frag)
    if (md.length > 15000) el.insertAdjacentHTML("beforeend", `<p><a href="https://github.com/${esc(r.r)}#readme" target="_blank" rel="noopener">Read the rest on GitHub</a></p>`)
    // long READMEs start collapsed; the panel stays the only thing that scrolls
    if (el.scrollHeight > el.clientHeight + 4) {
      el.classList.add("long")
      el.insertAdjacentHTML("afterend", `<button type="button" class="btn more-readme">Show the full README</button>`)
    }
  } catch {
    el.innerHTML = `<p class="muted">Couldn't load the README. <a href="https://github.com/${esc(r.r)}#readme" target="_blank" rel="noopener">Read it on GitHub</a>.</p>`
  }
}

// the repo's facets in the panel; each chip filters the list to repos like it
function labels(r) {
  if (!r.a) return ""
  const chip = (attrs, text) => `<button type="button" class="lab" ${attrs}>${esc(text)}</button>`
  const place = areaPairs(r).map((p) => { const [a, sa] = p.split("/"); return chip(`data-go-a="${esc(a)}" data-go-sa="${esc(sa)}"`, `${AREA.get(a)?.name} › ${SUB.get(p)}`) })
  const rows = [
    ["Area", place.join("")],
    ["Form", (r.fo ?? []).map((x) => chip(`data-go-form="${esc(x)}"`, FORM.get(x))).join("")],
    ["Runs on", (r.pl ?? []).map((x) => chip(`data-go-plat="${esc(x)}"`, PLAT.get(x))).join("")],
    ["Works with", (r.ww ?? []).map((x) => chip(`data-go-with="${esc(x)}"`, WITH.get(x))).join("")],
  ].filter(([, v]) => v)
  return `<div class="p-labels">${rows.map(([k, v]) => `<div><span class="k">${k}</span><span class="v">${v}</span></div>`).join("")}${r.alt?.length ? `<p class="p-alt">Open source alternative to ${r.alt.map(esc).join(", ")}</p>` : ""}${r.ai ? `<p class="p-alt">${r.ai === 2 ? "AI tool" : "Uses AI"}</p>` : ""}</div>`
}

function openPanel(name, push = true) {
  const r = byName.get(name.toLowerCase())
  if (!r) return closePanel()
  count(`repo/${r.r}`, "Repo panel")
  const [owner, repo] = r.r.split("/")
  const [fc, ft] = fresh(r.age)
  const facts = [
    ["Stars", num(r.s)],
    r.h > 0 ? ["Stars gained", gain(r)] : null,
    ["Forks", num(r.fk ?? 0)],
    ["License", r.li ?? "None listed"],
    ["Language", r.g ?? "Mixed"],
    r.ca ? ["Created", new Date(r.ca).toLocaleDateString("en-US", { month: "short", year: "numeric" })] : null,
    r.k > 1 ? ["Picked", `${r.k} times`] : null,
  ].filter(Boolean)
  panel.innerHTML = `
  <div class="p-head">
    <img src="${esc(avatar(owner, 80))}" alt="" width="40" height="40">
    <div class="name"><strong>${esc(repo)}</strong><span>${esc(owner)}</span></div>
    <button class="icon-btn p-close" type="button" aria-label="Close details"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
  </div>
  <div class="p-body">
    <p class="p-line">${esc(r.l)}</p>
    <p class="p-vitals" hidden></p>
    <div class="p-actions">
      <a class="btn primary" href="https://github.com/${esc(r.r)}" target="_blank" rel="noopener">${GH}Open on GitHub</a>
      <a class="btn" href="?page=${encodeURIComponent(r.r)}">Full page</a>
      ${r.hp ? `<a class="btn" href="${esc(r.hp)}" target="_blank" rel="noopener">Website</a>` : ""}
      <button class="btn save-btn" type="button" data-save="${esc(r.r)}" aria-pressed="${savedAt.has(r.r)}">${BOOKMARK}${savedAt.has(r.r) ? "Saved" : "Save"}</button>
    </div>
    <button class="clone" type="button" data-copy="git clone https://github.com/${esc(r.r)}.git" aria-label="Copy the git clone command"><code>git clone https://github.com/${esc(r.r)}.git</code><span class="clone-ico">${COPY}</span></button>
    <dl class="p-facts">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join("")}<div><dt>Activity</dt><dd><span class="fresh" style="--f:${fc}">${ft}</span></dd></div></dl>
    ${labels(r)}
    ${r.t.length ? `<div class="topics">${r.t.map((t) => `<span>${esc(t)}</span>`).join("")}</div>` : ""}
    <section><h3>Stars over time</h3>${trend(r.hs ?? [])}</section>
    <section><h3>README</h3><div class="readme"><p class="muted">Loading README…</p></div></section>
    <section><h3>Similar${r.a ? ` in ${esc(SUB.get(`${r.a}/${r.sa}`))}` : ""}</h3><div class="p-similar">${similar(r).map((x) => `<button type="button" class="sim" data-r="${esc(x.r)}"><img src="${esc(avatar(x.r.split("/")[0], 40))}" alt="" width="20" height="20" loading="lazy" decoding="async"><span><strong>${esc(x.r.split("/")[1])}</strong><small>${esc(x.l)}</small></span><em>${STAR}${num(x.s)}</em></button>`).join("")}</div></section>
    <a class="p-promo" href="https://github.com/boffti/stardash" target="_blank" rel="noopener">Starring this? <strong>StarDash</strong> keeps your GitHub stars organized and tells you when they ship breaking changes. Free, open source and self-hosted.</a>
  </div>`
  panel.hidden = false
  document.body.classList.add("has-panel")
  panel.scrollTop = 0
  state.repo = r.r
  if (push) setRepoParam(r.r)
  readme(r)
  panelVitals(r)
}

// the vital signs in one plain line; vitals.json loads on the first panel or page opened, not with the list
async function panelVitals(r) {
  vitals ??= fetch("vitals.json").then((x) => (x.ok ? x.json() : {})).catch(() => ({}))
  const v = (await vitals)[r.r], el = panel.querySelector(".p-vitals")
  if (!v || state.repo !== r.r || !el) return
  const s = signs(v, data.updated.slice(0, 10))
  el.textContent = `${summary(s)}.`
  el.classList.toggle("low", [s.activity, s.release, s.issues].some((x) => x.level === "low")) // amber dot, same rule as the page
  el.hidden = false
}

// only the repo param changes, so the grid isn't re-rendered under the panel
function setRepoParam(v) {
  const u = new URL(location.href)
  v ? u.searchParams.set("repo", v) : u.searchParams.delete("repo")
  history.replaceState(null, "", u.pathname + u.search)
}

function closePanel() {
  if (panel.hidden) return
  panel.hidden = true
  if (settings.hidden) document.body.classList.remove("has-panel")
  const was = state.repo
  state.repo = ""
  setRepoParam("")
  document.querySelector(`.repo[data-r="${CSS.escape(was)}"]`)?.focus()
}

$("#results").addEventListener("click", (e) => {
  if (e.target.closest(".jump") || e.target.closest(".gone a")) return // the GitHub icon opens GitHub
  const sv = e.target.closest("[data-save]")
  if (sv) return toggleSave(sv.dataset.save)
  const c = e.target.closest(".repo[data-r]")
  if (!c) return
  if (e.metaKey || e.ctrlKey) return void window.open(`https://github.com/${c.dataset.r}`, "_blank", "noopener")
  openPanel(c.dataset.r)
})
$("#results").addEventListener("auxclick", (e) => { const c = e.target.closest(".repo[data-r]"); if (c && e.button === 1 && !e.target.closest(".jump, [data-save]")) window.open(`https://github.com/${c.dataset.r}`, "_blank", "noopener") })
$("#results").addEventListener("keydown", (e) => { const c = e.target.closest(".repo[data-r]"); if (c && (e.key === "Enter" || e.key === " ") && e.target === c) { e.preventDefault(); openPanel(c.dataset.r) } })
panel.addEventListener("click", async (e) => {
  const full = inApp(e)
  if (full) { e.preventDefault(); closePanel(); return navigate(full.getAttribute("href")) }
  if (e.target.closest(".p-close")) return closePanel()
  const sv = e.target.closest("[data-save]")
  if (sv) return toggleSave(sv.dataset.save)
  const go = e.target.closest(".lab")
  if (go) {
    const d = go.dataset
    closePanel()
    set({ f: "", a: d.goA ?? "", sa: d.goSa ?? "", form: d.goForm ?? "", plat: d.goPlat ?? "", with: d.goWith ?? "" }, true)
    return scrollTo({ top: 0 })
  }
  const sim = e.target.closest(".sim")
  if (sim) return openPanel(sim.dataset.r)
  const more = e.target.closest(".more-readme")
  if (more) { panel.querySelector(".readme").classList.add("open"); more.remove(); return }
  const copy = e.target.closest("[data-copy]")
  if (copy) {
    const ico = copy.querySelector(".clone-ico")
    try { await navigator.clipboard.writeText(copy.dataset.copy); ico.textContent = "Copied" } catch { return } // no clipboard: the command is right there to select
    setTimeout(() => (ico.innerHTML = COPY), 1600)
  }
})
$("#repo-page").addEventListener("click", async (e) => {
  const a = inApp(e)
  if (a) { e.preventDefault(); return navigate(a.getAttribute("href")) }
  const b = e.target.closest("button")
  if (!b) return
  if ("back" in b.dataset) return moved ? history.back() : set({ page: "" }, true)
  if ("save" in b.dataset) return toggleSave(b.dataset.save)
  if ("clone" in b.dataset) return copyClone(b)
  if ("readme" in b.dataset) return showReadme($("#repo-page"), b)
})
$("#pscrim").addEventListener("click", () => { closePanel(); closeSettings() })
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !panel.hidden) closePanel() })
if (state.repo) openPanel(state.repo, false)
if (params.has("settings")) openSettings()
