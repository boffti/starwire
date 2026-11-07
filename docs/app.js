// starwire catalog: loads data.json once, filters and renders on the client. State lives in the URL so views can be shared.
const $ = (s) => document.querySelector(s)
const PAGE = 60
const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7L12 17.3 5.8 20.9l1.6-7L2 9.2l7.1-.6z"/></svg>'
const GH = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>'
const num = (n) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n))
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c])

const data = await fetch("data.json").then((r) => r.json())
const now = Date.parse(data.updated)
const repos = data.repos.map((r) => ({ ...r, hay: `${r.r} ${r.l} ${r.g ?? ""} ${r.t.join(" ")}`.toLowerCase(), age: (now - Date.parse(r.p)) / 864e5 }))
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

const params = new URLSearchParams(location.search)
// a shared list opens as its own view, with a button to add it to your saves
const shared = [...new Set((params.get("saved") ?? "").split(",").map((n) => n.trim()).filter((n) => NAME.test(n)).map(canon))].slice(0, 500)
const sharedSet = new Set(shared)
const state = {
  f: params.get("f") ?? (shared.length ? "shared" : params.has("multi") ? "multi" : ""), c: params.get("c") ?? "", q: params.get("q") ?? "",
  repo: params.get("repo") ?? "", sort: params.get("sort") ?? (params.get("f") === "saved" ? "saved" : "picked"), lang: params.get("lang") ?? "", view: params.get("view") ?? "cards", shown: PAGE,
}
const isNew = (r) => (now - Date.parse(r.f)) / 864e5 <= 7
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
I.multi = '<path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>'
const item = (attr, key, label, count) =>
  `<button type="button" class="cat" data-${attr}="${esc(key)}" aria-current="false"><svg viewBox="0 0 24 24" aria-hidden="true">${I[key] ?? I[""]}</svg><span>${esc(label)}</span><span class="n">${count.toLocaleString("en-US")}</span></button>`
$("#views").innerHTML = "<h2>Browse</h2>" + VIEWS.filter((v) => !v.hidden).map((v) => item("f", v.f, v.label, v.f === "saved" ? saved.length : repos.filter(v.test).length)).join("")
$("#cats").innerHTML = "<h2>Categories</h2>" + [...data.categories].sort((a, b) => b.count - a.count).map((c) => item("c", c.name, c.name, c.count)).join("")

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

function card(r) {
  const [owner, name] = r.r.split("/")
  const [fc, ft] = fresh(r.age)
  return `<div class="repo" role="button" tabindex="0" data-r="${esc(r.r)}" aria-label="${esc(name)} details">
  <div class="head"><img src="https://github.com/${esc(owner)}.png?size=56" alt="" loading="lazy" width="28" height="28"><div class="name"><strong>${esc(name)}</strong><span>${esc(owner)}</span></div>${saveBtn(r.r)}<a class="jump" href="https://github.com/${esc(r.r)}" target="_blank" rel="noopener" aria-label="Open ${esc(name)} on GitHub" title="Open on GitHub">${GH}</a></div>
  <p class="line">${esc(r.l)}</p>
  ${r.t.length ? `<div class="topics">${r.t.slice(0, 3).map((t) => `<span>${esc(t)}</span>`).join("")}</div>` : ""}
  <div class="meta"><span class="stars">${STAR}${num(r.s)}</span>${r.g ? `<span class="dot" style="--c:${esc(r.gc ?? "")}">${esc(r.g)}</span>` : ""}${r.h > 0 ? `<span class="rise" title="${esc(gainTitle(r))}">${esc(gain(r))}</span>` : ""}<span class="fresh" style="--f:${fc}">${ft}</span>${r.k > 1 ? `<span class="pill picked">picked ${r.k}×</span>` : ""}${isNew(r) ? '<span class="pill new">new</span>' : ""}</div>
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

function render() {
  const words = state.q.toLowerCase().split(/\s+/).filter(Boolean)
  const view = VIEWS.find((v) => v.f === state.f) ?? VIEWS[0]
  const list = repos
    .filter((r) => view.test(r) && (!state.c || r.c === state.c) && (!state.lang || r.g === state.lang) && words.every((w) => r.hay.includes(w)))
    .sort(sorters[state.sort] ?? sorters.picked)
  // saved repos that dropped off the list stay, at the end, so a save is never lost silently
  const gone = state.f === "saved" && !state.c && !state.lang && !words.length ? saved.filter((n) => !byName.has(n.toLowerCase())) : []
  const page = list.slice(0, state.shown).map(card)
  if (list.length <= state.shown) page.push(...gone.map((n) => `<div class="repo gone"><div class="head"><div class="name"><strong>${esc(n.split("/")[1])}</strong><span>${esc(n.split("/")[0])}</span></div>${saveBtn(n)}</div><p class="line">No longer on the list. <a href="https://github.com/${esc(n)}" target="_blank" rel="noopener">Open on GitHub</a></p></div>`))
  const el = $("#results")
  el.className = state.view === "list" ? "list" : "cards"
  const cols = getComputedStyle(el).gridTemplateColumns.split(" ").length
  const spot = PROMO_ROW * cols + Math.floor(PROMO_COL * cols)
  if (state.view === "cards" && page.length > spot && !state.q && !["saved", "shared"].includes(state.f)) page.splice(spot, 0, promo)
  const empty = state.f === "saved" && !saved.length
    ? `<div class="empty">Nothing saved yet. Use the bookmark on any repo to keep it here.<br>Saves stay in this browser.</div>`
    : `<div class="empty">No repos match that yet. Try fewer words or another category.<br><button type="button" id="reset">Clear filters</button></div>`
  el.innerHTML = page.length ? page.join("") : empty
  savedBar(list.length + gone.length)
  $("#title").textContent = state.c || view.label
  const total = list.length + gone.length
  const parts = [`${total.toLocaleString("en-US")} ${total === 1 ? "repo" : "repos"}`]
  if (state.c && state.f) parts.push(view.label.toLowerCase())
  if (state.lang) parts.push(`in ${state.lang}`)
  if (!state.c && !state.f && !state.lang && !state.q) parts.push(`updated ${new Date(now).toLocaleDateString("en-US", { month: "long", day: "numeric" })}`)
  $("#sub").textContent = parts.join(", ")
  $("#more").hidden = list.length <= state.shown
  $("#more").textContent = `Show more (${(list.length - state.shown).toLocaleString("en-US")} left)`
  document.querySelectorAll("[data-f]").forEach((n) => n.setAttribute("aria-current", String(!state.c && n.dataset.f === state.f)))
  document.querySelectorAll("[data-c]").forEach((n) => n.setAttribute("aria-current", String(n.dataset.c === state.c)))
  document.querySelectorAll(".view button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.view === state.view)))
  $("#reset")?.addEventListener("click", () => set({ f: "", c: "", q: "", lang: "" }, true))
  const p = new URLSearchParams()
  for (const k of ["f", "c", "q", "lang", "repo"]) if (state[k] && !(k === "f" && state.f === "shared")) p.set(k, state[k])
  if (state.f === "shared") p.set("saved", shared.join(","))
  if (state.sort !== "picked") p.set("sort", state.sort)
  if (state.view !== "cards") p.set("view", state.view)
  history.replaceState(null, "", `${location.pathname}${p.size ? `?${p}` : ""}`)
}

function set(patch, syncInputs) {
  Object.assign(state, patch, "shown" in patch ? {} : { shown: PAGE })
  if (syncInputs) { $("#q").value = state.q; $("#lang").value = state.lang; $("#sort").value = state.sort }
  render()
}

const closeMenu = () => $("#app").classList.remove("open")
$("#q").value = state.q
$("#sort").value = state.sort
$("#lang").value = state.lang
let t
$("#q").addEventListener("input", (e) => { clearTimeout(t); t = setTimeout(() => set({ q: e.target.value.trim() }), 120) })
$("#sort").addEventListener("change", (e) => set({ sort: e.target.value }))
$("#lang").addEventListener("change", (e) => set({ lang: e.target.value }))
$("#sidebar").addEventListener("click", (e) => {
  const n = e.target.closest(".cat")
  if (!n) return
  // views and categories are one choice: picking either clears the other, and clicking the selected category again goes back to all repos
  const f = "f" in n.dataset ? n.dataset.f : ""
  const sort = f === "trending" || f === "saved" ? f : ["trending", "saved"].includes(state.sort) ? "picked" : state.sort
  set("f" in n.dataset ? { f, c: "", sort } : { c: n.dataset.c === state.c ? "" : n.dataset.c, f: "", sort }, true)
  scrollTo({ top: 0 })
  closeMenu()
})
$("#menu").addEventListener("click", () => $("#app").classList.add("open"))
$("#scrim").addEventListener("click", closeMenu)
document.querySelector(".view").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) set({ view: b.dataset.view, shown: state.shown }) })
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
    if (b.classList.contains("btn")) b.lastChild.textContent = on ? "Saved" : "Save"
    else { b.title = on ? "Saved" : "Save for later"; b.setAttribute("aria-label", on ? `Remove ${name} from saved` : `Save ${name} for later`) }
  }
  const n = document.querySelector('[data-f="saved"] .n')
  if (n) n.textContent = saved.length.toLocaleString("en-US")
}
function toggleSave(n) {
  setSaved(savedAt.has(n) ? saved.filter((x) => x !== n) : [...saved, n])
  savedChanged()
  if (state.f === "saved" || state.f === "shared") render() // keeps the page size, so the list doesn't jump back to the top
}
// another tab saved or removed something
addEventListener("storage", (e) => { if (e.key !== SAVED_KEY) return; saved = []; setSaved(readSaved()); savedChanged(); if (state.f === "saved") render() })

render()

// ---- repo panel: README preview, facts, star trend, similar repos ----
const panel = $("#panel")
let libs
const loadLibs = () =>
  (libs ??= Promise.all(
    // pinned versions with Subresource Integrity: the browser refuses a file that doesn't match its hash,
    // so a tampered CDN copy can't replace DOMPurify, which is what keeps README previews safe.
    // Hashes are the ones cdnjs publishes for these versions; update both when a version changes.
    [
      ["https://cdnjs.cloudflare.com/ajax/libs/marked/12.0.2/marked.min.js", "sha512-xeUh+KxNyTufZOje++oQHstlMQ8/rpyzPuM+gjMFYK3z5ILJGE7l2NvYL+XfliKURMpBIKKp1XoPN/qswlSMFA=="],
      ["https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.1.6/purify.min.js", "sha512-jB0TkTBeQC9ZSkBqDhdmfTv1qdfbWpGE72yJ/01Srq6hEzZIz2xkz1e57p9ai7IeHMwEG7HpzG6NdptChif5Pg=="],
    ].map(
      ([src, integrity]) => new Promise((ok, fail) => document.head.append(Object.assign(document.createElement("script"), { src, integrity, crossOrigin: "anonymous", referrerPolicy: "no-referrer", onload: ok, onerror: fail }))),
    ),
  ))

// A README <picture> picks its logo with prefers-color-scheme, which is the OS setting. Follow the
// site's theme instead, so a light site never gets the white logo. Only that one feature is swapped
// for an always-true or always-false query, so any other condition in the media query still applies.
const siteDark = () => getComputedStyle(document.documentElement).colorScheme.includes("dark")
function followTheme(root) {
  const dark = siteDark()
  for (const s of root.querySelectorAll("source[media]")) {
    s.dataset.media ??= s.getAttribute("media")
    if (!/prefers-color-scheme/i.test(s.dataset.media)) continue
    s.setAttribute("media", s.dataset.media.replace(/\(\s*prefers-color-scheme\s*:\s*(dark|light)\s*\)/gi, (_, v) => ((v.toLowerCase() === "dark") === dark ? "(min-width: 0px)" : "(min-width: 99999px)")))
  }
}
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => followTheme(panel))

function similar(r) {
  const tags = new Set(r.t)
  return repos
    .filter((x) => x !== r && x.c === r.c)
    .map((x) => [x, x.t.filter((t) => tags.has(t)).length * 3 + x.k + Math.log10(x.s + 1)])
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
    await loadLibs()
    let md
    for (const f of ["README.md", "readme.md", "Readme.md", "README.MD", "README"]) {
      const res = await fetch(`https://raw.githubusercontent.com/${r.r}/HEAD/${f}`)
      if (res.ok) { md = await res.text(); break }
    }
    if (state.repo !== r.r) return // the user moved on while it loaded
    if (!md) { el.innerHTML = `<p class="muted">This repo has no README to preview.</p>`; return }
    // fix the URLs on the sanitized fragment, before it is inserted: an inserted <img> or <picture>
    // starts fetching at once, and a relative path would hit starwire.foo and 404
    const frag = DOMPurify.sanitize(marked.parse(md.slice(0, 15000)), { RETURN_DOM_FRAGMENT: true })
    // relative links and images point into the repo
    for (const a of frag.querySelectorAll("a[href]")) {
      const h = a.getAttribute("href")
      if (!/^(https?:|mailto:|#)/.test(h)) a.href = `https://github.com/${r.r}/blob/HEAD/${h.replace(/^\.?\//, "")}`
      a.target = "_blank"; a.rel = "noopener"
    }
    const raw = (u) => (/^(https?:|data:|\/\/)/.test(u) ? u : `https://raw.githubusercontent.com/${r.r}/HEAD/${u.replace(/^\.?\//, "")}`)
    for (const img of frag.querySelectorAll("img[src]")) {
      img.setAttribute("src", raw(img.getAttribute("src")))
      img.loading = "lazy"
    }
    // <picture><source srcset> wins over the <img> inside it (dark mode READMEs use it for a dark logo), so it needs the same
    for (const s of frag.querySelectorAll("[srcset]")) {
      const v = s.getAttribute("srcset").trim()
      if (v) s.setAttribute("srcset", v.split(/\s*,\s+/).map((c) => { const [u, ...d] = c.split(/\s+/); return [raw(u), ...d].join(" ") }).join(", "))
    }
    followTheme(frag)
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

function openPanel(name, push = true) {
  const r = byName.get(name.toLowerCase())
  if (!r) return closePanel()
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
    <img src="https://github.com/${esc(owner)}.png?size=80" alt="" width="40" height="40">
    <div class="name"><strong>${esc(repo)}</strong><span>${esc(owner)}</span></div>
    <button class="icon-btn p-close" type="button" aria-label="Close details"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
  </div>
  <div class="p-body">
    <p class="p-line">${esc(r.l)}</p>
    <div class="p-actions">
      <a class="btn primary" href="https://github.com/${esc(r.r)}" target="_blank" rel="noopener">${GH}Open on GitHub</a>
      ${r.hp ? `<a class="btn" href="${esc(r.hp)}" target="_blank" rel="noopener">Website</a>` : ""}
      <button class="btn save-btn" type="button" data-save="${esc(r.r)}" aria-pressed="${savedAt.has(r.r)}">${BOOKMARK}${savedAt.has(r.r) ? "Saved" : "Save"}</button>
      <button class="btn" type="button" data-copy="git clone https://github.com/${esc(r.r)}.git">Copy git clone</button>
    </div>
    <dl class="p-facts">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join("")}<div><dt>Activity</dt><dd><span class="fresh" style="--f:${fc}">${ft}</span></dd></div></dl>
    ${r.t.length ? `<div class="topics">${r.t.map((t) => `<span>${esc(t)}</span>`).join("")}</div>` : ""}
    <section><h3>Stars over time</h3>${trend(r.hs ?? [])}</section>
    <section><h3>README</h3><div class="readme"><p class="muted">Loading README…</p></div></section>
    <section><h3>Similar in ${esc(r.c)}</h3><div class="p-similar">${similar(r).map((x) => `<button type="button" class="sim" data-r="${esc(x.r)}"><img src="https://github.com/${esc(x.r.split("/")[0])}.png?size=40" alt="" width="20" height="20" loading="lazy"><span><strong>${esc(x.r.split("/")[1])}</strong><small>${esc(x.l)}</small></span><em>${STAR}${num(x.s)}</em></button>`).join("")}</div></section>
    <a class="p-promo" href="https://github.com/boffti/stardash" target="_blank" rel="noopener">Starring this? <strong>StarDash</strong> keeps your GitHub stars organized and tells you when they ship breaking changes. Free, open source and self-hosted.</a>
  </div>`
  panel.hidden = false
  document.body.classList.add("has-panel")
  panel.scrollTop = 0
  state.repo = r.r
  if (push) setRepoParam(r.r)
  readme(r)
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
  document.body.classList.remove("has-panel")
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
  if (e.target.closest(".p-close")) return closePanel()
  const sv = e.target.closest("[data-save]")
  if (sv) return toggleSave(sv.dataset.save)
  const sim = e.target.closest(".sim")
  if (sim) return openPanel(sim.dataset.r)
  const more = e.target.closest(".more-readme")
  if (more) { panel.querySelector(".readme").classList.add("open"); more.remove(); return }
  const copy = e.target.closest("[data-copy]")
  if (copy) { try { await navigator.clipboard.writeText(copy.dataset.copy); copy.textContent = "Copied" } catch { copy.textContent = copy.dataset.copy } setTimeout(() => (copy.textContent = "Copy git clone"), 1600) }
})
$("#pscrim").addEventListener("click", closePanel)
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !panel.hidden) closePanel() })
if (state.repo) openPanel(state.repo, false)
