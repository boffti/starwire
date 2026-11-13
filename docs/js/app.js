// starwire catalog: loads data.json once, filters and renders on the client. State lives in the URL so views can be shared.
const $ = (s) => document.querySelector(s)
const PAGE = 60
const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7L12 17.3 5.8 20.9l1.6-7L2 9.2l7.1-.6z"/></svg>'
const SHARE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M12 3v13M7 8l5-5 5 5"/></svg>'
const CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 5 5 9-10"/></svg>'
const COPY = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>'
const GH = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>'
const num = (n) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n))
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c])

import { makeIndex, fieldsFor } from "./search.js"
import { readmeFragment, followTheme } from "./readme.js"
import { count } from "./count.js"
import { avatar, knowOwners } from "./avatar.js"
import { signs, summary } from "./vitals.js"
import { weight } from "./signal.js"
import { SETUP_KINDS, setupOf, setupMark } from "./setup.js"
import { LICENSE_KINDS, licenseKind, licenseText } from "./license.js"
import { repoPage, missingPage, showReadme, copyClone, altPage, altIndex, altGroups, replacesOf, stackFor, KIND } from "./repo.js"

// collections.json is written by hand (see CONTRIBUTING.md); the site works the same without it
const [data, collections] = await Promise.all([fetch("data/data.json").then((r) => r.json()), fetch("collections.json").then((r) => (r.ok ? r.json() : [])).catch(() => [])])
const now = Date.parse(data.updated)
// facets (docs/plans/2026-11-07-taxonomy.md in the pipeline): area > subarea, form, platform, works with, tags, alternatives
const TX = data.taxonomy ?? { areas: [], forms: [], platforms: [], worksWith: [] }
const AREA = new Map(TX.areas.map((a) => [a.id, a]))
const SUB = new Map(TX.areas.flatMap((a) => a.subs.map(([id, name]) => [`${a.id}/${id}`, name])))
const FORM = new Map(TX.forms), PLAT = new Map(TX.platforms), WITH = new Map(TX.worksWith), LIC = new Map(LICENSE_KINDS), SETUP = new Map(SETUP_KINDS)
const areaPairs = (r) => (r.a ? [`${r.a}/${r.sa}`, ...(r.mo ?? [])] : [])
knowOwners(data.repos)
const repos = data.repos.map((r) => ({ ...r, age: (now - Date.parse(r.p)) / 864e5 }))
// themes: the tags each repo carries (tg), which cut across areas ("local-first", "rag"). A tag is its own name; the map holds how many repos have it
const TAG = new Map()
for (const r of repos) for (const t of r.tg ?? []) TAG.set(t, (TAG.get(t) ?? 0) + 1)
// ranked search, scored against a test set in the pipeline; the index is built on the first search, not on page load
let index
const search = (q, pool) => (q.trim() ? (index ??= makeIndex(repos, fieldsFor(TX)))(q, pool) : null)
const byName = new Map(repos.map((r) => [r.r.toLowerCase(), r]))
// Collections: the open source stack for one kind of reader ("For solopreneurs"). collections.json only says who it's
// for and what they need, each need as the products people usually pay for. The repos are not hand-picked: every need
// gets the top-ranked alternative on starwire (stackFor in repo.js), so a collection updates itself as rankings move.
// Ranking needs the fit and vitals files, so the stacks are worked out the first time a collection is opened.
const COL = new Map(collections.map((c) => [c.id, c]))
let stacks = null // id -> { ...collection, picks, why, order }, once loaded
async function loadStacks() {
  vitals ??= fetch("data/vitals.json").then((x) => (x.ok ? x.json() : {})).catch(() => ({}))
  fits ??= fetch("data/fit.json").then((x) => (x.ok ? x.json() : {})).catch(() => ({}))
  const [v, f] = await Promise.all([vitals, fits]), ctx = { repos, vitals: v, fit: f, today: data.updated.slice(0, 10) }
  stacks = new Map(collections.map((c) => { const picks = stackFor(c.needs, ctx)
    return [c.id, { ...c, picks, order: new Map(picks.map((p, i) => [p.repo.r, i])),
      why: new Map(picks.map((p) => [p.repo.r, `${p.label}, in place of ${p.product}. ${p.repo.l ?? ""}`])) }] }).filter(([, c]) => c.picks.length >= 3))
}
const inCol = () => stacks?.get(state.col) // the collection being shown, if any
const lineOf = (r) => inCol()?.why.get(r.r) ?? r.l // inside a collection a repo says which need it fills

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
const DEFAULT_PREFS = { v: 2, sort: "worth", layout: "wire", topics: true, gain: true, picked: true, stardash: true, listCard: true, sidebar: "area", hideAI: false }
const SORTS = ["worth", "today", "picked", "trending", "stars", "new", "active"]
function readPrefs() {
  let p = {}
  try { p = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}") ?? {} } catch {}
  const out = { ...DEFAULT_PREFS }
  // "today" saved under v1 was the default nobody chose, so it moves to the new default; picking it again sticks
  if (SORTS.includes(p.sort) && !(p.v === 1 && p.sort === "today")) out.sort = p.sort
  if (["wire", "cards", "list"].includes(p.layout)) out.layout = p.layout
  for (const k of ["topics", "gain", "picked", "stardash", "listCard", "hideAI"]) if (typeof p[k] === "boolean") out[k] = p[k]
  if (["area", "form", "with"].includes(p.sidebar)) out.sidebar = p.sidebar
  return out
}
let prefs = readPrefs()
function savePrefs() { try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)) } catch {} }
// what hides with CSS: topics, gain badge and picked count on cards, and every StarDash suggestion
const applyLook = () => {
  const b = document.body.classList
  b.toggle("no-topics", !prefs.topics); b.toggle("no-gain", !prefs.gain); b.toggle("no-picked", !prefs.picked); b.toggle("no-stardash", !prefs.stardash); b.toggle("no-list-card", !prefs.listCard)
}
applyLook()

// a static alternatives page (/alternatives/notion/, written by the pipeline's build) names its product in <body data-alt>:
// carry on as ?alt= so the app works as everywhere else; the page's canonical link keeps the clean address for search
if (document.body.dataset.alt) { history.replaceState(null, "", `/?alt=${encodeURIComponent(document.body.dataset.alt)}`); delete document.body.dataset.alt; document.title = "starwire" }
// a static landing page (/open-source/databases/, also from the build) names its filters in <body data-list>, the same way.
// Its title stays until the reader moves on, since it describes exactly this list
let landed = document.body.dataset.list != null
if (landed) { history.replaceState(null, "", `/?${document.body.dataset.list}`); delete document.body.dataset.list }
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
  a: pick("a", AREA), sa: "", form: pick("form", FORM), plat: pick("plat", PLAT), with: pick("with", WITH), tag: pick("tag", TAG), lic: pick("lic", LIC), setup: pick("setup", SETUP), col: pick("col", new Map([...COL, ["all"]])),
  f: params.get("f") ?? (shared.length ? "shared" : params.has("multi") ? "multi" : ""), q: params.get("q") ?? "",
  repo: params.get("repo") ?? "", page: params.get("page") ?? "", alt: params.get("alt") ?? "", sort: params.get("sort") ?? (params.get("q") ? "match" : viewSort(params.get("f")) || prefs.sort), lang: params.get("lang") ?? "", view: params.get("view") ?? prefs.layout, shown: PAGE,
}
{ const sa = params.get("sa") ?? old.sa; if (state.a && SUB.has(`${state.a}/${sa}`)) state.sa = sa }
// new = a new project: first picked in the last 7 days and created in the last 90 (same rule as the pipeline's README)
const isNew = (r) => (now - Date.parse(r.f)) / 864e5 <= 7 && !!r.ca && (now - Date.parse(r.ca)) / 864e5 <= 90
// Hidden gems: trending repos still under 1,000 stars, the same cut the weekly email uses for its hidden gem
const GEM_STARS = 1000
// views that come with their own order: Trending and Hidden gems by heat, Saved by when you saved it
function viewSort(f) { return f === "gems" ? "trending" : f === "trending" || f === "saved" ? f : "" }
const VIEWS = [
  { f: "", label: "All repos", test: () => true },
  { f: "trending", label: "Trending", test: (r) => r.h > 0 },
  { f: "gems", label: "Hidden gems", test: (r) => r.h > 0 && r.s < GEM_STARS },
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
  `<button type="button" class="cat" data-${attr}="${esc(key)}" aria-current="false" title="${esc(label)}"><svg viewBox="0 0 24 24" aria-hidden="true">${I[key] ?? I[attr] ?? I[""]}</svg><span>${esc(label)}</span><span class="n">${count.toLocaleString("en-US")}</span></button>`
I.alt = '<path d="M4 7h13l-3-3M20 17H7l3 3"/>'
I.col = '<path d="M12 3 3 8l9 5 9-5-9-5z"/><path d="m3 13 9 5 9-5M3 18l9 5 9-5" opacity=".55"/>'
I.gems = '<path d="M6 3h12l4 6-10 12L2 9z"/><path d="M2 9h20M8 9l4 12 4-12M8 9l4-6 4 6"/>'
const ALTS = altGroups(repos)
const visible = (r) => !(prefs.hideAI && r.ai > 0) // "Hide AI repos" in settings
let collapsed = false // the selected area's subareas are folded away; the area itself stays selected
function renderSidebar() {
  const pool = repos.filter(visible), count = (test) => pool.filter(test).length
  // ways to discover first, then Alternatives, and Saved last: it's the reader's own list, not another cut of ours
  $("#views").innerHTML = "<h2>Browse</h2>" + VIEWS.filter((v) => !v.hidden && v.f !== "saved").map((v) => item("f", v.f, v.label, count(v.test))).join("")
    + item("alt", "all", "Alternatives", ALTS.size) + (COL.size ? item("col", "all", "Collections", COL.size) : "") + item("f", "saved", "Saved", saved.length)
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
  <p class="line">${esc(lineOf(r))}</p>
  ${r.t.length ? `<div class="topics">${r.t.slice(0, 3).map((t) => `<span>${esc(t)}</span>`).join("")}</div>` : ""}
  <div class="meta"><span class="stars">${STAR}${num(r.s)}</span>${r.g ? `<span class="dot" style="--c:${esc(r.gc ?? "")}">${esc(r.g)}</span>` : ""}${r.h > 0 ? `<span class="rise" title="${esc(gainTitle(r))}">${esc(gain(r))}</span>` : ""}<span class="fresh" style="--f:${fc}">${ft}</span>${pills(r)}</div>
</div>`
}

// ---- ranked wire: momentum is the unit. Stars per day from the daily history: day(r) is the latest interval,
// day(r, 1) the one before it, so a rank can be compared with yesterday's
const TODAY = data.updated.slice(0, 10)
function day(r, back = 0) {
  const hs = r.hs ?? [], a = hs.at(-2 - back), b = hs.at(-1 - back)
  if (!a || !b) return null
  return (b[1] - a[1]) / Math.max(1, Math.round((Date.parse(b[0]) - Date.parse(a[0])) / 864e5))
}
const dayText = (r) => { const d = day(r); return d == null ? "" : `${d < 0 ? "" : "+"}${num(Math.round(d))}` }
function spark(hs, w = 120, h = 32, cls = "wspark") {
  if (hs.length < 2) return `<span class="${cls} none" aria-hidden="true"></span>`
  const t0 = Date.parse(hs[0][0]), span = Date.parse(hs.at(-1)[0]) - t0 || 1
  const ys = hs.map((x) => x[1]), lo = Math.min(...ys), hi = Math.max(...ys)
  const pts = hs.map(([d, v]) => [((Date.parse(d) - t0) / span) * w, h - 3 - ((v - lo) / (hi - lo || 1)) * (h - 6)])
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ")
  return `<svg class="${cls}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><polygon points="0,${h} ${line} ${w},${h}"/><polyline points="${line}"/></svg>`
}
// rank change: position by a score now vs the day before, within the list on screen. Most stars today ranks by stars
// per day; Trending by heat, with the pipeline's heat as of yesterday in hy (none = wasn't trending, so "new")
let moves = null
const MOVE_SCORES = { worth: (r, back) => worth(r, back), today: (r, back) => day(r, back), trending: (r, back) => (back ? r.hy : r.h) || null }
function rankMoves(list, score) {
  const pos = (f) => new Map(list.filter((r) => f(r) != null).sort((a, b) => f(b) - f(a)).map((r, i) => [r.r, i]))
  const now = pos((r) => score(r, 0)), then = pos((r) => score(r, 1))
  return (r) => { const a = now.get(r.r), b = then.get(r.r); return a == null ? "" : b == null ? `<i class="mv new">new</i>` : b > a ? `<i class="mv up">▲${b - a}</i>` : b < a ? `<i class="mv down">▼${a - b}</i>` : `<i class="mv same">=</i>` }
}
// What a row is for: saying what the repo is and what you'd use it for, not how its stars moved. Beside the summary
// sit two lines from its labels: the kind of thing it is and where it runs, then the most useful of what it replaces,
// what it plugs into, or what it is about. Stars shrink to one column: the count, and today's gain beneath it.
// the row's own short names for the forms: the filter's full names ("Library or framework") don't fit two to a line
const KIND_SHORT = { "self-hosted": "Self-hosted", cli: "Command line", library: "Library", "agent-skill": "Agent skill", extension: "Extension", model: "Model", template: "Template", reference: "Guide" }
function facts(r) {
  const pl = (r.pl ?? []).filter((p) => p !== "docker").map((p) => PLAT.get(p)).filter(Boolean), all = ["macos", "windows", "linux"].every((p) => r.pl?.includes(p))
  const where = all && pl.length === 3 ? "Mac, Windows, Linux" : pl.slice(0, 3).join(", ")
  const kind = [(r.fo ?? []).map((f) => KIND_SHORT[f] ?? FORM.get(f)).filter(Boolean).join(", "), where].filter(Boolean).join(" · ")
  const more = r.alt?.length ? `<b>Replaces</b> ${esc(r.alt.slice(0, 2).join(", "))}`
    : r.ww?.length ? `<b>Works with</b> ${esc(r.ww.slice(0, 2).map((w) => WITH.get(w)).filter(Boolean).join(", "))}`
    : r.tg?.length ? esc(r.tg.slice(0, 3).map((t) => t.replace(/-/g, " ")).join(" · ")) : r.g ? esc(r.g) : ""
  return `<div class="facts"><span>${esc(kind)}</span>${more ? `<small>${more}</small>` : ""}</div>`
}
function row(r, i) {
  const [owner, name] = r.r.split("/"), d = day(r), today = r.hs?.at(-1)?.[0] === TODAY
  return `<div class="repo wrow${i < 3 ? " top" : ""}" role="button" tabindex="0" data-r="${esc(r.r)}" aria-label="${esc(name)} details">
  <span class="rank">${i + 1}${moves ? moves(r) : ""}</span>
  <img src="${esc(avatar(owner, 56))}" alt="" loading="lazy" decoding="async" width="28" height="28">
  <div class="name"><strong>${esc(name)}</strong><span>${esc(owner)}${pills(r) ? ` ${pills(r)}` : ""}</span></div>
  <p class="line">${esc(lineOf(r))}</p>
  ${facts(r)}
  <div class="tot"><span class="stars">${STAR}${num(r.s)}</span>${d != null && Math.round(d) ? `<small class="up">${dayText(r)} ${today ? "today" : "a day"}</small>` : r.h > 0 ? `<small title="${esc(gainTitle(r))}">${esc(gain(r))}</small>` : ""}</div>
  ${saveBtn(r.r)}<a class="jump" href="https://github.com/${esc(r.r)}" target="_blank" rel="noopener" aria-label="Open ${esc(name)} on GitHub" title="Open on GitHub">${GH}</a>
</div>`
}
const DATE = new Date(now).toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" })
// above the list: its first repo on the plain views, named for the order in use; the area's top three of the week inside an area
const LEAD_TITLE = { worth: `Most worth a look on ${DATE}`, today: `Biggest mover on ${DATE}`, trending: "Trending hardest this week", picked: "Picked by the most sources", stars: "Most stars on starwire", new: "Newest pick", active: "Most recently updated", saved: "Your latest save" }
function lead(list) {
  const el = $("#lead")
  if (state.q || state.form || state.plat || state.with || state.tag || state.lic || state.setup || state.lang || ["saved", "shared"].includes(state.f)) return (el.hidden = true)
  if (state.a) {
    const top = list.filter((r) => r.w > 0).sort((a, b) => b.w - a.w).slice(0, 3)
    if (top.length < 3) return (el.hidden = true)
    el.className = "lead movers"
    el.innerHTML = `<h2>Rising fastest in ${esc(state.sa ? SUB.get(`${state.a}/${state.sa}`) : AREA.get(state.a).name)} this week</h2><div class="mv-row">${top.map((r, i) => { const [o, n] = r.r.split("/"); return `<a class="mv-tile" href="?page=${esc(r.r)}"><span class="n">${i + 1}</span><img src="${esc(avatar(o, 56))}" alt="" width="28" height="28" loading="lazy"><span class="who"><b>${esc(n)}</b><small>${esc(r.l)}</small></span>${spark(r.hs ?? [], 96, 28)}<span class="g"><b>+${num(r.w)}</b><small>${/ a week$/.test(gain(r)) ? "this week" : esc(gain(r).replace(/^~?\+\S+ /, ""))}</small></span></a>` }).join("")}</div>`
    return (el.hidden = false)
  }
  const r = list[0] // the list is already in the chosen order, so the hero is always its first row
  if (!r) return (el.hidden = true)
  const [owner, name] = r.r.split("/"), hs = r.hs ?? []
  el.className = "lead spot"
  el.innerHTML = `<div class="spot-text">
    <h2><b class="spot-no">1</b>${LEAD_TITLE[state.sort] ?? "First on the list"}${moves ? moves(r) : ""}</h2>
    <a class="spot-name" href="?page=${esc(r.r)}"><img src="${esc(avatar(owner, 96))}" alt="" width="44" height="44"><span><b>${esc(name)}</b><small>${esc(owner)}${pills(r) ? ` ${pills(r)}` : ""}</small></span></a>
    <p>${esc(r.l)}</p>
    ${facts(r)}
    <ul class="spot-stats">${day(r) != null ? `<li><b>${dayText(r)}</b> stars today</li>` : ""}${r.h > 0 ? `<li><b>${esc(gain(r).replace(/ a week$/, ""))}</b> ${/ a week$/.test(gain(r)) ? "this week" : ""}</li>` : ""}<li><b>${num(r.s)}</b> stars in all</li></ul>
    <p class="spot-vitals" hidden></p>
    <div class="spot-acts"><a class="btn" href="?page=${esc(r.r)}">See the repo</a>${saveBtn(r.r)}<a class="jump" href="https://github.com/${esc(r.r)}" target="_blank" rel="noopener" aria-label="Open ${esc(name)} on GitHub" title="Open on GitHub">${GH}</a></div>
  </div>
  <figure class="spot-chart">${spark(hs, 480, 150, "bigspark")}<figcaption><span>${num(hs[0]?.[1] ?? r.s)} stars, ${esc(hs[0]?.[0] ?? "")}</span><span>${num(r.s)} stars, ${esc(hs.at(-1)?.[0] ?? "")}</span></figcaption></figure>`
  el.hidden = false
  vitals ??= fetch("data/vitals.json").then((x) => (x.ok ? x.json() : {})).catch(() => ({}))
  vitals.then((v) => { const p = el.querySelector(".spot-vitals"); if (v[r.r] && p && el.contains(p)) { p.textContent = `${summary(signs(v[r.r], TODAY))}.`; p.hidden = false } })
  return "spot" // tells the list its first repo is shown here, so it starts at number two
}

const promo = `<a class="promo" href="https://github.com/boffti/stardash" target="_blank" rel="noopener">
  <div><small>A separate app from the maker of starwire</small><strong>Keep the ones you star organized</strong><p>StarDash sorts your GitHub stars into collections, tags them with AI and tells you when tools you use ship breaking changes. Free, open source and self-hosted.</p></div>
  <span>Try StarDash for free</span>
</a>`

// Doorways: most visits are the home list and nothing else, so the plain "All repos" list carries three full-width
// cards into the parts of the site a sidebar link doesn't sell: alternatives, a collection and a hidden gem. The
// collection and the gem change with the day's data. Placed after rows 2, 5 and 8 of cards (items 6, 16 and 28 of a
// list), so the top of the list stays repos. ponytail: fixed spots and a daily rotation; make them smarter only if
// the door/ events show which ones get used.
const DOOR_ROWS = [2, 5, 8], DOOR_ITEMS = [6, 16, 28]
function doors() {
  const n = Math.floor(Date.parse(TODAY) / 864e5), out = []
  const top = [...ALTS.values()].sort((a, b) => b.repos.length - a.repos.length).slice(0, 8)
  if (top.length >= 4) out.push(`<section class="door" aria-label="Open source alternatives"><div class="door-text"><small>Alternatives</small><strong>Open source instead of&hellip;</strong><p>Pick a product you pay for and see what could replace it, ranked by how much of it each one covers.</p></div>
    <div class="door-chips">${top.map((g) => `<a href="?alt=${encodeURIComponent(g.name)}" data-door="alt">${esc(g.name)}<b>${g.repos.length}</b></a>`).join("")}<a class="door-all" href="?alt=all" data-door="alt">All ${ALTS.size} products</a></div></section>`)
  const c = collections.length && collections[n % collections.length]
  if (c) out.push(`<section class="door" aria-label="A collection"><div class="door-text"><small>Collection of the day</small><strong>${esc(c.title)}</strong><p>${esc(c.intro)}</p></div>
    <div class="door-chips">${c.needs.slice(0, 6).map(([need]) => `<span>${esc(need)}</span>`).join("")}<a class="door-all" href="?col=${esc(c.id)}" data-door="col">See the ${c.needs.length}-part stack</a><a class="door-all" href="?col=all" data-door="col">All ${collections.length} collections</a></div></section>`)
  const gems = repos.filter((r) => r.h > 0 && r.s < GEM_STARS).sort((a, b) => b.h - a.h), g = gems[n % Math.min(gems.length, 10)]
  if (g) { const [owner, name] = g.r.split("/")
    out.push(`<section class="door" aria-label="A hidden gem"><div class="door-text"><small>Hidden gem of the day</small><strong class="door-repo"><img src="${esc(avatar(owner, 64))}" alt="" width="32" height="32" loading="lazy">${esc(name)}<i>${esc(owner)}</i></strong><p>${esc(g.l ?? "")}</p></div>
    <div class="door-chips"><span>${STAR}${num(g.s)} stars</span>${g.wt ? `<span>${esc(g.wt)}</span>` : ""}<a class="door-all" href="?page=${esc(g.r)}" data-door="gem">See the repo</a><a class="door-all" href="?f=gems" data-door="gem">All ${gems.length} hidden gems</a></div></section>`) }
  return out
}

// On a wide window the list has room to spare, so the doorways move out of it into a bar on the right that stays in
// view while the list scrolls. Narrower windows and phones keep them between the rows. The wrapper is made here, not
// in index.html, so pages drawn before it existed (a cached page, a landing page not rebuilt yet) get it too.
const RAIL_MIN = 1400 // px the list column and bar need between them
const railWrap = document.createElement("div"), railEl = document.createElement("aside")
railWrap.className = "with-rail"; railEl.id = "doorbar"; railEl.hidden = true; railEl.setAttribute("aria-label", "More on starwire")
$("#results").before(railWrap)
{ const main = document.createElement("div"); main.className = "rail-main"; main.append($("#results"), document.querySelector(".more-wrap")); railWrap.append(main, railEl) }
const railFits = () => railWrap.clientWidth >= RAIL_MIN
function rail(on) {
  railWrap.classList.toggle("on", on); railEl.hidden = !on
  if (on && !railEl.firstChild) { const d = doors(); railEl.innerHTML = [d.at(-1), ...d.slice(0, -1)].join("") } // the hidden gem, last in the list, leads the bar
  return on
}
let railFit = null // draw again when the window crosses the width where the bar fits
new ResizeObserver(() => { const fit = railFits(); if (railFit !== null && fit !== railFit && !state.page && !state.alt) render(); railFit = fit }).observe(railWrap)

// Worth a look: stars per day, kept in full by a repo that passes every signal check and cut for each one it fails
// The gain is scaled by the repo's size, the way Trending's heat is (gain / sqrt(stars + 100)), so 300 stars a day on a
// 2,000-star repo outranks 600 a day on one with 300,000: a find, not a fixture.
const worth = (r, back = 0) => { const d = day(r, back); return d == null ? null : (d / Math.sqrt(r.s + 100)) * (r.sg ??= weight(r, TODAY)) }
const sorters = {
  worth: (a, b) => (worth(b) ?? -1) - (worth(a) ?? -1) || b.h - a.h,
  saved: (a, b) => (savedAt.get(b.r) ?? -1) - (savedAt.get(a.r) ?? -1),
  today: (a, b) => (day(b) ?? -1) - (day(a) ?? -1) || b.h - a.h,
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
  (!state.form || r.fo?.includes(state.form)) && (!state.plat || r.pl?.includes(state.plat)) && (!state.with || r.ww?.includes(state.with)) && (!state.tag || r.tg?.includes(state.tag)) && (!state.lic || licenseKind(r.li) === state.lic) && (!state.setup || setupOf(r.fo, r.ho)?.id === state.setup) && (!inCol() || inCol().order.has(r.r))
const anyFacet = () => state.a || state.form || state.plat || state.with || state.tag || state.lic || state.setup

const PHONE = matchMedia("(max-width: 760px)")
PHONE.addEventListener("change", () => render())

// the index of collections: one card each, with the faces of what's inside
function showCollections() {
  document.body.dataset.cols = "all" // the sort, filters and layout controls mean nothing here: style.css hides them
  $("#title").textContent = "Collections"
  $("#sub").textContent = `The open source stack for ${stacks.size} kinds of work. Each need gets the top-ranked alternative to the product people usually pay for.`
  for (const id of ["#lead", "#more", "#everywhere", "#alt-hint"]) $(id).hidden = true
  document.querySelectorAll("[data-f], [data-a], [data-sa], [data-form], [data-with]").forEach((n) => n.setAttribute("aria-current", "false"))
  const el = $("#results")
  el.className = "cols"
  el.innerHTML = [...stacks.values()].map((c) => `<a class="col-card" href="?col=${esc(c.id)}">
    <strong>${esc(c.title)}</strong><p>${esc(c.intro)}</p>
    <span class="col-faces">${c.picks.slice(0, 8).map((p) => `<img src="${esc(avatar(p.repo.r.split("/")[0], 56))}" alt="" width="26" height="26" loading="lazy" decoding="async">`).join("")}<small>${c.picks.length} tools</small></span></a>`).join("")
  syncURL()
  if (counted.place !== "collections") count((counted.place = "collections"), "Collections")
}
// one collection: the stack, need by need. Each row is a job to be done, the product people usually pay for, and the
// open source project that takes its place, with how well it fits. A need nothing covers well is shown as a gap.
function showCollection(c) {
  document.body.dataset.cols = "one"
  $("#title").textContent = c.title
  $("#sub").textContent = c.intro
  for (const id of ["#lead", "#more", "#everywhere", "#alt-hint"]) $(id).hidden = true
  document.querySelectorAll("[data-f], [data-a], [data-sa], [data-form], [data-with]").forEach((n) => n.setAttribute("aria-current", "false"))
  const by = new Map(c.picks.map((p) => [p.label, p])), repos = c.picks.map((p) => p.repo)
  const easy = repos.filter((r) => setupOf(r.fo, r.ho)?.level === 1).length, open = repos.filter((r) => licenseKind(r.li) === "open").length
  const facts = [[`${c.picks.length} of ${c.needs.length}`, "needs covered"], [c.picks.reduce((n, p) => n + p.n, 0), "alternatives compared"], [open, open === 1 ? "open source license" : "open source licenses"], [`${easy} of ${c.picks.length}`, "need no server or terminal"]]
  const pick = (p) => { const r = p.repo, [owner, name] = r.r.split("/"), su = setupOf(r.fo, r.ho)
    const os = (r.pl ?? []).filter((x) => x !== "docker").map((x) => PLAT.get(x)).filter(Boolean).join(", ")
    return `<div class="repo st-pick" role="button" tabindex="0" data-r="${esc(r.r)}" aria-label="${esc(name)} details">
      <div class="head"><img src="${esc(avatar(owner, 80))}" alt="" loading="lazy" decoding="async" width="40" height="40"><div class="name"><strong>${esc(name)}</strong><span>${esc(owner)}</span></div>${saveBtn(r.r)}<a class="jump" href="https://github.com/${esc(r.r)}" target="_blank" rel="noopener" aria-label="Open ${esc(name)} on GitHub" title="Open on GitHub">${GH}</a></div>
      <p class="line">${esc(r.l ?? "")}</p>
      ${su ? `<p class="st-setup">${setupMark(su)}<span>${su.text}${su.id === "app" && os ? ` ${esc(os)}.` : ""}</span></p>` : ""}
      <div class="meta">${p.f ? `<span class="st-fit"><b>${KIND[p.f[1]]}</b> covers ${Math.round(p.f[0] * 100)}%</span>` : ""}<span class="stars">${STAR}${num(r.s)}</span><span>${esc(licenseText(r.li))}</span>${(r.fo ?? []).length ? `<span>${r.fo.map((f) => esc(FORM.get(f))).join(", ")}</span>` : ""}</div></div>` }
  const gap = (products) => { const g = products.map((x) => ALTS.get(x.toLowerCase())).find(Boolean)
    return `<div class="st-gap"><b>No pick yet.</b> Nothing on starwire covers enough of ${esc(g?.name ?? products[0])} and is established enough to recommend. ${g ? `<a href="?alt=${encodeURIComponent(g.name)}">See the ${g.repos.length} ${g.repos.length === 1 ? "option" : "options"} we list</a>` : `<a href="https://github.com/boffti/starwire/issues/new?template=submit.yml" target="_blank" rel="noopener">Suggest a repo</a>`}</div>` }
  const el = $("#results")
  el.className = "stack"
  el.innerHTML = `<dl class="st-facts">${facts.map(([n, k]) => `<div><dt>${k}</dt><dd>${n}</dd></div>`).join("")}</dl>
    <ol class="st-rows">${c.needs.map(([label, ...products], i) => { const p = by.get(label)
      return `<li class="st-row${p ? "" : " gap"}"><div class="st-need"><span class="st-n">${String(i + 1).padStart(2, "0")}</span><div><h2>${esc(label)}</h2>
        ${p ? `<p>In place of <a href="?alt=${encodeURIComponent(p.product)}">${esc(p.product)}</a>${p.n > 1 ? `<a class="st-all" href="?alt=${encodeURIComponent(p.product)}">Compare all ${p.n}</a>` : ""}</p>` : `<p>Usually ${esc(products.slice(0, 2).join(" or "))}</p>`}</div></div>
        ${p ? pick(p) : gap(products)}</li>` }).join("")}</ol>
    <p class="st-note">Each need gets the top-ranked open source alternative to the product people usually pay for, as long as it has 100 stars and passes half of its <a href="how.html#signal">signal checks</a>, so the stack changes as the rankings do. <a href="how.html#fit">How fit is scored</a> &middot; <a href="how.html#setup">How setup is read</a> &middot; <a href="?col=all">All collections</a></p>`
  syncURL()
  const place = `collection/${c.id}`
  if (place !== counted.place) count((counted.place = place), "Collection")
}
function render() {
  const onPage = !!(state.page || state.alt)
  rail(false) // the list below turns it back on when this is the plain home list on a wide window
  $("#repo-page").hidden = !onPage
  for (const el of document.querySelectorAll(".page > :not(#repo-page)")) el.hidden = onPage
  document.querySelectorAll("[data-alt]").forEach((n) => n.setAttribute("aria-current", String(!!state.alt)))
  if (onPage) { if (state.alt) document.querySelectorAll("[data-f]").forEach((n) => n.setAttribute("aria-current", "false")); return showPage(), syncURL() }
  if (shownPage) { shownPage = ""; document.title = TITLE }
  document.querySelectorAll("[data-col]").forEach((n) => n.setAttribute("aria-current", String(!!state.col)))
  if (state.col && !stacks) return void loadStacks().then(render) // the stacks need two more files; draw when they're in
  if (state.col === "all") return showCollections()
  if (inCol() && !state.q) return showCollection(inCol()) // a search from inside a collection falls through to the plain list
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
  const col = inCol() // a collection keeps the order it was written in
  document.body.dataset.cols = col ? "one" : ""
  list.sort(scores && state.sort === "match" ? (a, b) => scores.get(b) - scores.get(a) : col ? (a, b) => col.order.get(a.r) - col.order.get(b.r) : sorters[state.sort] ?? sorters.picked)
  // saved repos that dropped off the list stay, at the end, so a save is never lost silently
  const gone = state.f === "saved" && !anyFacet() && !state.lang && !scores ? saved.filter((n) => !byName.has(n.toLowerCase())) : []
  const el = $("#results")
  const layout = PHONE.matches ? "list" : col ? "cards" : state.view // phones always get the list; cards add nothing on a narrow screen. A collection is cards, the layout with room for why each repo is in it
  el.className = layout
  moves = layout === "wire" && !col && MOVE_SCORES[state.sort] && !scores ? rankMoves(list, MOVE_SCORES[state.sort]) : null
  let heroed = false // the hero is number one: when it shows the list's first repo, the list itself starts at two
  if (state.view === "wire" && !col) heroed = lead(list) === "spot"; else $("#lead").hidden = true // phones get the list rows, but keep the lead
  const home = !col && !state.f && !state.q && !anyFacet() && !state.lang, railOn = rail(home && railFits()) // before the columns are counted: the bar narrows the list
  const cols = getComputedStyle(el).gridTemplateColumns.split(" ").length
  const spot = PROMO_ROW * cols + Math.floor(PROMO_COL * cols)
  // the StarDash card takes one repo's place, so a full page is 60 cells: whole rows at 3, 4, 5 or 6 columns
  const promoted = layout === "cards" && !state.q && !["saved", "shared"].includes(state.f) && Math.min(list.length, state.shown) > spot
  const shown = state.shown - (promoted ? 1 : 0)
  const page = list.slice(0, shown).map(layout === "wire" ? row : card)
  if (heroed) page.shift()
  if (list.length <= shown) page.push(...gone.map((n) => `<div class="repo gone"><div class="head"><div class="name"><strong>${esc(n.split("/")[1])}</strong><span>${esc(n.split("/")[0])}</span></div>${saveBtn(n)}</div><p class="line">No longer on the list. <a href="https://github.com/${esc(n)}" target="_blank" rel="noopener">Open on GitHub</a></p></div>`))
  if (promoted) page.splice(spot, 0, promo)
  // doorways on the plain home list only: in the bar when it is showing, else between the rows, last one first so each lands on a whole row
  if (home && !railOn) { const at = layout === "cards" ? DOOR_ROWS.map((r) => r * cols) : DOOR_ITEMS
    doors().map((d, i) => [at[i], d]).reverse().forEach(([i, d]) => { if (page.length > i) page.splice(i, 0, d) }) }
  const empty = state.f === "saved" && !saved.length
    ? `<div class="empty">Nothing saved yet. Use the bookmark on any repo to keep it here.<br>Saves stay in this browser.</div>`
    : `<div class="empty">No repos match that yet. Try fewer words or another filter.<br><button type="button" id="reset">Clear filters</button></div>`
  el.innerHTML = page.length ? page.join("") : empty
  savedBar(list.length + gone.length)
  $("#title").textContent = col ? col.title : state.sa ? SUB.get(`${state.a}/${state.sa}`) : state.a ? AREA.get(state.a).name
    : prefs.sidebar === "form" && state.form ? FORM.get(state.form) : prefs.sidebar === "with" && state.with ? WITH.get(state.with) : view.label
  const total = list.length + gone.length
  const parts = [`${total.toLocaleString("en-US")} ${total === 1 ? "repo" : "repos"}`]
  if (anyFacet() && state.f) parts.push(view.label.toLowerCase())
  if (state.sa) parts.push(`in ${AREA.get(state.a).name}`)
  if (state.form && !(prefs.sidebar === "form" && !state.a)) parts.push(FORM.get(state.form).toLowerCase())
  if (state.plat) parts.push(`on ${PLAT.get(state.plat)}`)
  if (state.with && !(prefs.sidebar === "with" && !state.a)) parts.push(`works with ${WITH.get(state.with)}`)
  if (state.tag) parts.push(`tagged ${state.tag}`)
  if (state.lic) parts.push(LIC.get(state.lic).toLowerCase())
  if (state.setup) parts.push(`setup: ${SETUP.get(state.setup).toLowerCase()}`)
  if (state.lang) parts.push(`in ${state.lang}`)
  if (prefs.hideAI) parts.push("AI repos hidden")
  if (!anyFacet() && !state.f && !state.lang && !state.q) parts.push(`updated ${new Date(now).toLocaleDateString("en-US", { month: "long", day: "numeric" })}`)
  $("#sub").textContent = col ? col.intro : parts.join(", ")
  // "postman alternative", "alternatives to notion" or just "figma": point at that product's alternatives page
  const want = state.q.toLowerCase().replace(/\b(open[ -]?source|self[ -]?hosted|free|alternatives?|replacements?|to|for|like|vs)\b/g, " ").replace(/\s+/g, " ").trim()
  const g = want && ALTS.get(want), hint = $("#alt-hint")
  hint.hidden = !g
  if (g) { hint.href = `?alt=${encodeURIComponent(g.name)}`; hint.textContent = `See all ${g.repos.length} open source ${g.repos.length === 1 ? "alternative" : "alternatives"} to ${g.name}` }
  // phones keep the filters behind one button; it shows how many are on
  const on = ["form", "plat", "with", "tag", "lic", "setup", "lang"].filter((k) => state[k]).length
  $("#filters-n").hidden = !on; $("#filters-n").textContent = on
  $("#more").hidden = list.length <= shown
  $("#more").textContent = `Show more (${(list.length - shown).toLocaleString("en-US")} left)`
  const group = prefs.sidebar === "form" ? state.form : prefs.sidebar === "with" ? state.with : state.a
  document.querySelectorAll("[data-f]").forEach((n) => n.setAttribute("aria-current", String(!group && !state.col && n.dataset.f === state.f)))
  for (const k of ["a", "form", "with"]) document.querySelectorAll(`[data-${k}]`).forEach((n) => n.setAttribute("aria-current", String(n.dataset[k] === state[k] && !(k === "a" && state.sa))))
  document.querySelectorAll("[data-sa]").forEach((n) => n.setAttribute("aria-current", String(n.dataset.sa === state.sa)))
  document.querySelectorAll(".view button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.view === state.view)))
  $("#reset")?.addEventListener("click", () => set({ f: "", a: "", sa: "", form: "", plat: "", with: "", tag: "", lic: "", setup: "", q: "", lang: "" }, true))
  syncURL()
  const place = col ? `collection/${col.id}` : state.a ? `area/${state.a}${state.sa ? `/${state.sa}` : ""}` : `view/${state.f || "all"}`
  if (place !== counted.place) count((counted.place = place), col ? "Collection" : state.a ? "Area" : "View")
  // a search counts once the typing stops, so "pdf editor" isn't also counted as "pd" and "pdf e"
  clearTimeout(counted.t)
  const q = state.q.toLowerCase().slice(0, 60)
  if (q && q !== counted.q) counted.t = setTimeout(() => count(`search/${(counted.q = q)}`, total ? "Search" : "Search, no results"), 2000)
}
const counted = { place: "", q: "", t: 0 }

function syncURL() {
  const p = new URLSearchParams()
  for (const k of ["f", "a", "sa", "form", "plat", "with", "tag", "lic", "setup", "col", "q", "lang", "repo", "page", "alt"]) if (state[k] && !(k === "f" && state.f === "shared")) p.set(k, state[k])
  if (state.f === "shared") p.set("saved", shared.join(","))
  // left out only when it's what this browser falls back to on load, so a reload lands where you were
  if (state.sort !== prefs.sort && !(state.sort === "match" && state.q)) p.set("sort", state.sort)
  if (state.view !== prefs.layout) p.set("view", state.view)
  history.replaceState(null, "", `${location.pathname}${p.size ? `?${p}` : ""}`)
}

// ---- repo page: ?page=owner/name shows the repo in the main column, sidebar and search stay ----
const TITLE = landed ? "starwire" : document.title
let shownPage = "", vitals, fits
async function showPage() {
  const key = state.alt ? `alt:${state.alt}` : state.page
  if (shownPage === key) return // already drawn: keep its README and scroll position
  shownPage = key
  const el = $("#repo-page")
  el.classList.toggle("wide", state.alt === "all")
  vitals ??= fetch("data/vitals.json").then((x) => (x.ok ? x.json() : {})).catch(() => ({}))
  fits ??= fetch("data/fit.json").then((x) => (x.ok ? x.json() : {})).catch(() => ({}))
  if (state.alt === "all") { const [v, f] = await Promise.all([vitals, fits]); if (shownPage !== key) return; el.innerHTML = altIndex({ repos, vitals: v, fit: f, today: data.updated.slice(0, 10), TX }); document.title = `Open source alternatives | starwire`; return count("alt/all", "Alternatives") }
  if (state.alt) {
    const [v, f] = await Promise.all([vitals, fits])
    if (shownPage !== key) return
    if (!stacks) await loadStacks() // the page ends with the collections this product is part of
    if (shownPage !== key) return
    el.innerHTML = altPage(state.alt, { repos, vitals: v, fit: f, today: data.updated.slice(0, 10), TX, cols: [...stacks.values()] })
    document.title = `Open source alternatives to ${state.alt} | starwire`
    return count(`alt/${state.alt.toLowerCase()}`, "Alternatives page")
  }
  const r = byName.get(state.page.toLowerCase())
  if (!r) { el.innerHTML = missingPage(state.page); document.title = TITLE; return }
  if (r.alt?.length) fits ??= fetch("data/fit.json").then((x) => (x.ok ? x.json() : {})).catch(() => ({}))
  const want = state.page, [v, f] = await Promise.all([vitals, r.alt?.length ? fits : {}])
  if (state.page !== want) return // moved on while vitals loaded
  el.innerHTML = repoPage(r, { repos, vitals: v, fit: f, today: data.updated.slice(0, 10), TX, saved: savedAt.has(r.r) })
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
  set(Object.fromEntries(["f", "a", "sa", "form", "plat", "with", "tag", "lic", "setup", "col", "q", "lang", "page", "alt"].map((k) => [k, p.get(k) ?? ""])), true)
  scrollTo({ top: 0 })
}
addEventListener("popstate", fromURL)
const inApp = (e) => { const a = e.target.closest('a[href^="?"]'); return a && !e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0 ? a : null }

function set(patch, syncInputs) {
  if (landed) { landed = false; document.title = TITLE }
  const hadQ = state.q
  if (state.col && !("col" in patch) && ["f", "a", "sa", "form", "with"].some((k) => k in patch)) patch = { ...patch, col: "" } // moving to another view or area leaves the collection
  if (!("page" in patch || "alt" in patch)) patch = { ...patch, page: "", alt: "" } // any change to the list leaves the repo page
  Object.assign(state, patch, "shown" in patch ? {} : { shown: PAGE })
  // typing a search switches to Best match; clearing it goes back to the usual order
  if (state.q && !hadQ && !("sort" in patch)) state.sort = "match", (syncInputs = true)
  if (!state.q && state.sort === "match") state.sort = viewSort(state.f) || prefs.sort, (syncInputs = true)
  $("#sort-match").hidden = $("#sort-match").disabled = !state.q
  if (syncInputs) { $("#q").value = state.q; $("#lang").value = state.lang; $("#sort").value = state.sort; for (const k of ["form", "plat", "with", "tag", "lic", "setup"]) $(`#f-${k}`).value = state[k] }
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
// Theme: the 25 most used tags first, then the rest by name, since nobody scans 99 options sorted by count
{
  const el = $("#f-tag"), byCount = [...TAG].sort((a, b) => b[1] - a[1]), opt = ([t, n]) => `<option value="${esc(t)}">${esc(t)} (${n})</option>`
  el.innerHTML = `<option value="">Any</option><optgroup label="Most used">${byCount.slice(0, 25).map(opt).join("")}</optgroup><optgroup label="More">${byCount.slice(25).sort((a, b) => a[0].localeCompare(b[0])).map(opt).join("")}</optgroup>`
  el.value = state.tag
  el.addEventListener("change", (e) => set({ tag: e.target.value }))
}
// License: what the license file allows, in four kinds (rules in license.js)
{
  const el = $("#f-lic")
  el.innerHTML = `<option value="">Any</option>` + LICENSE_KINDS.map(([id, name]) => [id, name, repos.filter((r) => licenseKind(r.li) === id).length]).filter((x) => x[2]).map(([id, name, n]) => `<option value="${id}">${name} (${n})</option>`).join("")
  el.value = state.lic
  el.addEventListener("change", (e) => set({ lic: e.target.value }))
}
// Setup: how much know-how it takes to get running, easiest first (rules in setup.js)
{
  // pages drawn before this filter existed (a cached page, or a landing page not rebuilt yet) get the dropdown added
  if (!$("#f-setup")) $("#f-lic").closest("label").insertAdjacentHTML("afterend", '<label class="select"><span>Setup</span><select id="f-setup"></select></label>')
  const el = $("#f-setup")
  el.innerHTML = `<option value="">Any</option>` + SETUP_KINDS.map(([id, name]) => [id, name, repos.filter((r) => setupOf(r.fo, r.ho)?.id === id).length]).filter((x) => x[2]).map(([id, name, n]) => `<option value="${id}">${name} (${n})</option>`).join("")
  el.value = state.setup
  el.addEventListener("change", (e) => set({ setup: e.target.value }))
}
$("#sidebar").addEventListener("click", (e) => {
  const n = e.target.closest(".cat")
  if (!n) return
  // views and sidebar groups are one choice: picking either clears the other; clicking the selected one again goes back
  const f = "f" in n.dataset ? n.dataset.f : ""
  const sort = viewSort(f) || (["trending", "saved"].includes(state.sort) ? prefs.sort : state.sort)
  const d = n.dataset
  if ("alt" in d) { closeMenu(); return navigate("?alt=all") }
  if ("col" in d) { closeMenu(); scrollTo({ top: 0 }); return set({ col: "all", f: "", a: "", sa: "", form: "", with: "", q: "" }, true) }
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
// the filters open as a panel over the page; it stays open while you set several, and closes on a click elsewhere or Escape
const filtersOpen = (open) => { $("#filters").classList.toggle("open", open); $("#filters-btn").setAttribute("aria-expanded", String(open)) }
$("#filters-btn").addEventListener("click", () => filtersOpen(!$("#filters").classList.contains("open")))
document.addEventListener("click", (e) => { if ($("#filters").classList.contains("open") && !e.target.closest("#filters, #filters-btn")) filtersOpen(false) })
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && $("#filters").classList.contains("open")) { filtersOpen(false); $("#filters-btn").focus() } })
$("#menu").addEventListener("click", () => $("#app").classList.add("open"))
$("#scrim").addEventListener("click", closeMenu)
document.querySelector(".view").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; prefs.layout = b.dataset.view; savePrefs(); set({ view: b.dataset.view, shown: state.shown }) }) // the layout you pick is remembered, like the setting
$("#everywhere").addEventListener("click", () => set({ f: "", a: "", sa: "", form: "", plat: "", with: "", tag: "", lic: "", setup: "", lang: "", sort: "match" }, true))
$("#more").addEventListener("click", () => set({ shown: state.shown + PAGE }))
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeMenu()
  if (e.key === "/" && document.activeElement !== $("#q")) { e.preventDefault(); $("#q").focus() }
})
// collapsed sidebar: an icon strip, so the grid gets room for another column; remembered in this browser
function setRail(on) {
  document.documentElement.classList.toggle("rail", on)
  $("#rail").setAttribute("aria-pressed", String(on))
  $("#rail").setAttribute("aria-label", on ? "Expand sidebar" : "Collapse sidebar")
  $("#rail").title = `${on ? "Expand" : "Collapse"} sidebar (${MAC ? "⌘B" : "Ctrl+B"})`
  try { on ? localStorage.setItem("starwire-rail", "1") : localStorage.removeItem("starwire-rail") } catch {}
}
const MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
const toggleRail = () => { setRail(!document.documentElement.classList.contains("rail")); if (!state.page) render() }
setRail(document.documentElement.classList.contains("rail"))
$("#rail").addEventListener("click", toggleRail)
// Cmd+B on a Mac, Ctrl+B elsewhere; only where the strip exists (desktop widths), and never while editing rich text
document.addEventListener("keydown", (e) => {
  if (e.key.toLowerCase() !== "b" || e.shiftKey || e.altKey || !(MAC ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey)) return
  if (!matchMedia("(min-width: 901px)").matches || e.target.closest?.("textarea, [contenteditable]")) return
  e.preventDefault()
  toggleRail()
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
// a dropdown for settings with too many options to fit one segmented row
const dropdown = (name, label, value, options) => `<fieldset class="s-row"><legend>${label}</legend><label class="select"><select name="${name}" aria-label="${label}">${options.map(([v, t]) => `<option value="${v}"${v === value ? " selected" : ""}>${t}</option>`).join("")}</select></label></fieldset>`
const check = (name, label) => `<label class="check"><input type="checkbox" name="${name}"${prefs[name] ? " checked" : ""}>${label}</label>`
function openSettings() {
  settings.innerHTML = `
  <div class="p-head"><div class="name"><strong>Settings</strong><span>Saved in this browser</span></div>
    <button class="icon-btn s-close" type="button" aria-label="Close settings"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg></button></div>
  <form class="p-body s-body">
    ${seg("sidebar", "Sidebar shows", prefs.sidebar, [["area", "Areas"], ["form", "Forms"], ["with", "Works with"]])}
    <fieldset class="s-row"><legend>Repos</legend>${check("hideAI", "Hide AI repos (AI tools, agents and anything built around AI)")}</fieldset>
    ${dropdown("sort", "Default sort", prefs.sort, [["worth", "Worth a look"], ["today", "Most stars today"], ["picked", "Most picked"], ["trending", "Trending"], ["stars", "Most stars"], ["new", "Newest picks"]])}
    <div class="s-layout">${seg("layout", "Default layout", prefs.layout, [["wire", "Ranked"], ["cards", "Cards"], ["list", "List"]])}</div>
    ${seg("theme", "Theme", themeNow(), [["system", "System"], ["light", "Light"], ["dark", "Dark"]])}
    <fieldset class="s-row"><legend>On each repo card</legend>${check("topics", "Topics")}${check("gain", "Stars gained")}${check("picked", "How many times it was picked")}</fieldset>
    <fieldset class="s-row"><legend>Sidebar</legend>${check("listCard", "Show the card linking to the list on GitHub")}</fieldset>
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
    set({ sort: viewSort(state.f) ? state.sort : prefs.sort, view: prefs.layout }, true)
    openSettings()
  }
})
settings.addEventListener("change", (e) => {
  const { name, value, checked, type } = e.target
  if (name === "theme") return setTheme(value)
  prefs[name] = type === "checkbox" ? checked : value
  savePrefs(); applyLook()
  // a new default sort or layout applies to what's on screen now too, except in Trending and Saved, which keep their own order
  if (name === "sort" && !viewSort(state.f)) set({ sort: value }, true)
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
    ["Themes", (r.tg ?? []).map((x) => chip(`data-go-tag="${esc(x)}"`, x)).join("")],
    ["Replaces", (r.alt ?? []).map((a) => `<a class="lab" href="?alt=${encodeURIComponent(a)}" data-fit-for="${esc(a.toLowerCase())}">${esc(a)}</a>`).join("")],
  ].filter(([, v]) => v)
  return `<div class="p-labels">${rows.map(([k, v]) => `<div><span class="k">${k}</span><span class="v">${v}</span></div>`).join("")}${r.alt?.length ? `<p class="p-alt p-fit" hidden></p>` : ""}${r.ai ? `<p class="p-alt">${r.ai === 2 ? "AI tool" : "Uses AI"}</p>` : ""}</div>`
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
    ["License", licenseText(r.li)],
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
      <button class="btn" type="button" data-share="${esc(r.r)}">${SHARE}<span>Share</span></button>
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
    <a class="p-promo" href="https://github.com/boffti/stardash" target="_blank" rel="noopener">Starring this? <strong>StarDash</strong>, a separate app from the maker of starwire, keeps your GitHub stars organized and tells you when they ship breaking changes. Free, open source and self-hosted.</a>
  </div>`
  panel.hidden = false
  document.body.classList.add("has-panel")
  panel.scrollTop = 0
  state.repo = r.r
  if (push) setRepoParam(r.r)
  readme(r)
  panelVitals(r)
  panelFit(r)
}

// share link: r.starwire.foo/<owner>/<name> shows a card with the repo's picture and vital signs in chat apps and
// sends people to the repo's page here (share/ in this repo). Phones get the share sheet, elsewhere the link is copied.
async function share(name, b) {
  const url = `https://r.starwire.foo/${name}`
  count(`share/${name}`, "Shared")
  if (navigator.share && matchMedia("(pointer: coarse)").matches) return navigator.share({ url, title: name.startsWith("instead-of/") ? `Open source alternatives to ${document.querySelector("#repo-page h1")?.textContent.replace(/^Open source alternatives to /, "") ?? ""}` : `${name.split("/")[1]} on starwire` }).catch(() => {})
  try { await navigator.clipboard.writeText(url) } catch { return void prompt("Copy this link", url) }
  const was = b.innerHTML
  b.innerHTML = b.querySelector("span") ? `${CHECK}<span>Link copied</span>` : CHECK
  setTimeout(() => (b.innerHTML = was), 1600)
}

// how well it replaces each product, under the Replaces chips: "82% of Notion, #3 of 9"; fit.json loads only when needed
async function panelFit(r) {
  if (!r.alt?.length) return
  vitals ??= fetch("data/vitals.json").then((x) => (x.ok ? x.json() : {})).catch(() => ({}))
  fits ??= fetch("data/fit.json").then((x) => (x.ok ? x.json() : {})).catch(() => ({}))
  const [v, f] = await Promise.all([vitals, fits]), el = panel.querySelector(".p-fit")
  if (state.repo !== r.r || !el) return
  const items = replacesOf(r, { repos, vitals: v, fit: f, today: data.updated.slice(0, 10) })
  const parts = items.map(({ name, f: x, rank, n }) => `${x ? `${Math.round(x[0] * 100)}% of ${name}` : name}${n > 1 ? `, #${rank} of ${n}` : ""}`)
  if (!parts.length) return
  el.textContent = `Fit: ${parts.join("; ")}.`
  el.hidden = false
}

// the vital signs in one plain line; vitals.json loads on the first panel or page opened, not with the list
async function panelVitals(r) {
  vitals ??= fetch("data/vitals.json").then((x) => (x.ok ? x.json() : {})).catch(() => ({}))
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
$("#lead").addEventListener("click", (e) => { // the hero's save button, and its links without a reload
  const sv = e.target.closest("[data-save]"); if (sv) return toggleSave(sv.dataset.save)
  const a = inApp(e); if (a) { e.preventDefault(); navigate(a.getAttribute("href")) }
})
railEl.addEventListener("click", (e) => { const a = inApp(e); if (a) { e.preventDefault(); if (a.dataset.door) count(`door/${a.dataset.door}`, "Doorway"); navigate(a.getAttribute("href")) } })
$("#results").addEventListener("click", (e) => { const a = e.target.closest(".col-card, .stack, .door") && inApp(e); if (a) { e.preventDefault(); if (a.dataset.door) count(`door/${a.dataset.door}`, "Doorway"); navigate(a.getAttribute("href")) } }) // a collection opens without a reload
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
    set({ f: "", a: d.goA ?? "", sa: d.goSa ?? "", form: d.goForm ?? "", plat: d.goPlat ?? "", with: d.goWith ?? "", tag: d.goTag ?? "" }, true)
    return scrollTo({ top: 0 })
  }
  const sim = e.target.closest(".sim")
  if (sim) return openPanel(sim.dataset.r)
  const more = e.target.closest(".more-readme")
  if (more) { panel.querySelector(".readme").classList.add("open"); more.remove(); return }
  const sh = e.target.closest("[data-share]")
  if (sh) return share(sh.dataset.share, sh)
  const copy = e.target.closest("[data-copy]")
  if (copy) {
    const ico = copy.querySelector(".clone-ico")
    try { await navigator.clipboard.writeText(copy.dataset.copy); ico.textContent = "Copied" } catch { return } // no clipboard: the command is right there to select
    setTimeout(() => (ico.innerHTML = COPY), 1600)
  }
})
$("#alt-hint").addEventListener("click", (e) => { const a = inApp(e); if (a) { e.preventDefault(); navigate(a.getAttribute("href")) } })
$("#repo-page").addEventListener("input", (e) => {
  if (!("altFilter" in e.target.dataset)) return
  const q = e.target.value.trim().toLowerCase(), rows = $("#repo-page").querySelectorAll(".sw-row")
  for (const t of rows) t.hidden = !!q && !t.dataset.name.includes(q)
  for (const g of $("#repo-page").querySelectorAll(".sw-group")) g.hidden = !g.querySelector(".sw-row:not([hidden])")
  $("#repo-page").querySelector("[data-alt-none]").hidden = [...rows].some((t) => !t.hidden)
})
$("#repo-page").addEventListener("click", async (e) => {
  const a = inApp(e)
  if (a) { e.preventDefault(); return navigate(a.getAttribute("href")) }
  const b = e.target.closest("button")
  if (!b) return
  if ("back" in b.dataset) return moved ? history.back() : set({ page: "", alt: "" }, true)
  if ("save" in b.dataset) return toggleSave(b.dataset.save)
  if ("clone" in b.dataset || "badge" in b.dataset) return copyClone(b)
  if ("share" in b.dataset) return share(b.dataset.share, b)
  if ("readme" in b.dataset) return showReadme($("#repo-page"), b)
})
$("#pscrim").addEventListener("click", () => { closePanel(); closeSettings() })
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !panel.hidden) closePanel() })
if (state.repo) openPanel(state.repo, false)
if (params.has("settings")) openSettings()

// Command palette (Cmd or Ctrl + K): one box that finds repos and sets any view, area, theme, filter or sort.
// A filter picked here is added to what is already on, so "local-first" then "Rust" gives both; views start over.
{
  const dlg = $("#cmdk"), inp = $("#cmdk-q"), out = $("#cmdk-list"), opener = $("#cmdk-open")
  const clear = { f: "", a: "", sa: "", form: "", plat: "", with: "", tag: "", lic: "", setup: "", col: "", lang: "", q: "" }
  let all = null, items = [], at = 0
  const commands = () => (all ??= [
    ...VIEWS.filter((v) => !v.hidden).map((v) => ({ kind: "View", label: v.label, run: () => set({ ...clear, f: v.f, ...(viewSort(v.f) ? { sort: viewSort(v.f) } : {}) }, true) })),
    ...TX.areas.flatMap((a) => [{ kind: "Area", label: a.name, run: () => set({ a: a.id, sa: "" }, true) }, ...a.subs.map(([id, name]) => ({ kind: "Area", label: `${a.name} › ${name}`, run: () => set({ a: a.id, sa: id }, true) }))]),
    ...[...TAG].map(([t, n]) => ({ kind: "Theme", label: t, n, run: () => set({ tag: t }, true) })),
    ...TX.forms.map(([id, name]) => ({ kind: "Form", label: name, run: () => set({ form: id }, true) })),
    ...TX.platforms.map(([id, name]) => ({ kind: "Platform", label: name, run: () => set({ plat: id }, true) })),
    ...TX.worksWith.map(([id, name]) => ({ kind: "Works with", label: name, run: () => set({ with: id }, true) })),
    ...[...COL.values()].map((c) => ({ kind: "Collection", label: c.title, run: () => set({ ...clear, col: c.id }, true) })),
    ...LICENSE_KINDS.map(([id, name]) => ({ kind: "License", label: name, run: () => set({ lic: id }, true) })),
    ...SETUP_KINDS.map(([id, name]) => ({ kind: "Setup", label: name, run: () => set({ setup: id }, true) })),
    ...langs.map(([l, n]) => ({ kind: "Language", label: l, n, run: () => set({ lang: l }, true) })),
    ...[...ALTS.values()].map((g) => ({ kind: "Instead of", label: g.name, n: g.repos.length, run: () => set({ alt: g.name }) })),
    ...[...$("#sort").options].filter((o) => !o.hidden).map((o) => ({ kind: "Sort by", label: o.textContent, run: () => set({ sort: o.value }, true) })),
    { kind: "Action", label: "Clear all filters", run: () => set(clear, true) },
  ])
  // 0 the label is the query, 1 it starts with it, 2 every word appears somewhere in "kind label"; -1 no match.
  // Words that name the kind ("theme rag", "language rust") are set aside before the label is compared.
  const rank = (c, words) => {
    const label = c.label.toLowerCase(), kind = c.kind.toLowerCase()
    if (!words.every((w) => `${kind} ${label}`.includes(w))) return -1
    const rest = words.filter((w) => !kind.includes(w))
    return !rest.length ? 1 : label === rest.join(" ") ? 0 : label.startsWith(rest[0]) ? 1 : 2
  }
  function draw() {
    const q = inp.value.trim(), words = q.toLowerCase().split(/\s+/).filter(Boolean)
    if (!q) {
      // nothing typed: the views, a way back if filters are on, and the biggest themes as a hint of what can be typed
      const on = anyFacet() || state.f || state.lang || state.q
      items = [...commands().filter((c) => c.kind === "View" || (c.kind === "Action" && on)), ...commands().filter((c) => c.kind === "Theme").sort((a, b) => b.n - a.n).slice(0, 6)]
    } else {
      const hits = commands().map((c) => [rank(c, words), c]).filter((x) => x[0] >= 0).sort((a, b) => a[0] - b[0] || (b[1].n ?? 0) - (a[1].n ?? 0)).slice(0, 8)
      const found = search(q, repos.filter(visible))
      const rs = [...(found ?? [])].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([r]) => ({ kind: "Repo", label: r.r, sub: r.l, run: () => openPanel(r.r) }))
      // filters named by the query first, then repos, then looser filter matches, then the full search
      items = [...hits.filter((x) => x[0] < 2).map((x) => x[1]), ...rs, ...hits.filter((x) => x[0] === 2).map((x) => x[1]), { kind: "Search", label: `All repos matching “${q}”`, run: () => set({ ...clear, q }, true) }]
    }
    at = 0
    out.innerHTML = items.map((c, i) => `<li role="option" id="cmdk-${i}" data-i="${i}" aria-selected="${i === 0}"><span class="k">${esc(c.kind)}</span><span class="l">${esc(c.label)}${c.sub ? `<small>${esc(c.sub)}</small>` : ""}</span>${c.n ? `<span class="n">${c.n.toLocaleString("en-US")}</span>` : ""}</li>`).join("")
    inp.setAttribute("aria-activedescendant", "cmdk-0")
  }
  const move = (to) => {
    out.children[at]?.setAttribute("aria-selected", "false")
    at = (to + items.length) % items.length
    out.children[at].setAttribute("aria-selected", "true")
    out.children[at].scrollIntoView({ block: "nearest" })
    inp.setAttribute("aria-activedescendant", `cmdk-${at}`)
  }
  const go = (i) => { const c = items[i]; if (!c) return; dlg.close(); c.run(); scrollTo({ top: 0 }) }
  const open = () => { inp.value = ""; draw(); dlg.showModal() }
  opener.textContent = /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘K" : "Ctrl K"
  opener.addEventListener("click", (e) => { e.preventDefault(); open() })
  inp.addEventListener("input", draw)
  dlg.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); move(at + 1) }
    else if (e.key === "ArrowUp") { e.preventDefault(); move(at - 1) }
    else if (e.key === "Enter") { e.preventDefault(); go(at) }
  })
  out.addEventListener("click", (e) => { const li = e.target.closest("li"); if (li) go(+li.dataset.i) })
  dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close() }) // a click on the dimmed backdrop
  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); dlg.open ? dlg.close() : open() }
  })
}

// Collapsed sidebar: hovering an icon (or tabbing to it) shows its name beside it at once, with its count. The
// browser's own title tooltip takes about a second, which is too slow when icons are all there is to go on.
{
  const side = document.querySelector(".sidebar"), tip = Object.assign(document.createElement("div"), { className: "rail-tip", hidden: true })
  document.body.append(tip)
  let held = null // the item whose title is parked while our label shows, so the browser's tooltip doesn't appear as well
  const hide = () => { tip.hidden = true; if (held) { held.title = held.dataset.t; held = null } }
  const show = (e) => {
    const el = e.target.closest(".cat, .side-link")
    if (!el || !document.documentElement.classList.contains("rail")) return hide()
    if (el === held) return
    hide()
    const box = el.getBoundingClientRect(), n = el.querySelector(".n")?.textContent
    tip.textContent = (el.querySelector("span")?.textContent ?? "") + (n ? `  ${n}` : "")
    tip.style.top = `${box.top + box.height / 2}px`
    tip.style.left = `${box.right + 10}px`
    tip.hidden = false
    if (el.title) { el.dataset.t = el.title; el.removeAttribute("title"); held = el }
  }
  side.addEventListener("pointerover", show)
  side.addEventListener("focusin", show)
  side.addEventListener("pointerleave", hide)
  side.addEventListener("focusout", hide)
  side.addEventListener("click", hide)
}
