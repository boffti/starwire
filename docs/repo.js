// The repo page (?page=owner/name) and the alternatives pages (?alt=Product, ?alt=all), shown inside the main app: vital signs, how it compares with its alternatives,
// what it replaces and how to start. app.js owns the URL, saves and counting; this module only draws the page.
import { signs, momentum } from "./vitals.js?v=1"
import { readmeFragment } from "./readme.js?v=1"

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c])
const num = (n) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n))
const avatar = (owner, size) => `https://avatars.githubusercontent.com/${encodeURIComponent(owner)}?s=${size}`
const ago = (d) => (d < 1 ? "today" : d === 1 ? "yesterday" : d < 60 ? `${d} days ago` : d < 730 ? `${Math.round(d / 30)} months ago` : `${Math.round(d / 365)} years ago`)
const svg = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`
const I = {
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z"/>',
  up: '<path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  fork: '<circle cx="6" cy="5" r="2"/><circle cx="18" cy="5" r="2"/><circle cx="12" cy="19" r="2"/><path d="M6 7v2a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3V7M12 12v5"/>',
  law: '<path d="M12 3v18M5 7h14M7 7l-3 7h6zM17 7l-3 7h6z"/>',
  screen: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
  pulse: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
  tag: '<path d="M20 12 12 4H4v8l8 8z"/><circle cx="8" cy="8" r="1.5"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  save: '<path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z"/>',
  down: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  hand: '<path d="M7 11V5a2 2 0 0 1 4 0v5M11 10V4a2 2 0 0 1 4 0v6M15 10V6a2 2 0 0 1 4 0v8a7 7 0 0 1-7 7h-1a7 7 0 0 1-6-3.4L3 14a2 2 0 0 1 3.4-2L7 13"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  share: '<path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M12 3v13M7 8l5-5 5 5"/>',
  doc: '<path d="M4 4h12l4 4v12H4z"/><path d="M8 12h8M8 16h5"/>',
}
const GH = '<svg viewBox="0 0 24 24" aria-hidden="true" style="fill:currentColor;stroke:none"><path d="M12 2a10 10 0 0 0-3.2 19.5c.5.1.7-.2.7-.5v-1.7c-2.8.6-3.4-1.3-3.4-1.3-.5-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.6 2.4 1.1 3 .9.1-.7.4-1.1.6-1.4-2.2-.3-4.6-1.1-4.6-5 0-1.1.4-2 1-2.7-.1-.3-.4-1.3.1-2.7 0 0 .8-.3 2.8 1a9.6 9.6 0 0 1 5 0c1.9-1.3 2.8-1 2.8-1 .5 1.4.2 2.4.1 2.7.6.7 1 1.6 1 2.7 0 3.9-2.4 4.7-4.6 5 .4.3.7.9.7 1.9V21c0 .3.2.6.7.5A10 10 0 0 0 12 2z"/></svg>'

let r, repos, vitals, today, AREA, SUB, FORM, PLAT, fit = {}

// repo + { repos, vitals, today, TX, saved } -> the page's HTML
export function repoPage(repo, ctx) {
  r = repo; ({ repos, vitals, today } = ctx)
  AREA = new Map(ctx.TX.areas.map((a) => [a.id, a.name])); SUB = new Map(ctx.TX.areas.flatMap((a) => a.subs.map(([id, n]) => [`${a.id}/${id}`, n])))
  FORM = new Map(ctx.TX.forms); PLAT = new Map(ctx.TX.platforms)
  return render(ctx.saved)
}

const BACK = `<button type="button" class="rp-back" data-back>${svg('<path d="m15 18-6-6 6-6"/>').replace("<svg", '<svg style="fill:none;stroke:currentColor;stroke-width:2"')}Back to the list</button>`
export const missingPage = (name) => `<div class="rp-top">${BACK}</div><p class="rp-missing">${name ? `${esc(name)} isn't on starwire.` : "No repo picked."} <a href="https://github.com/boffti/starwire/issues/new?template=submit-repo.yml" target="_blank" rel="noopener">Submit it</a> if it should be.</p>`

function render(saved) {
  const [owner, name] = r.r.split("/")
  const v = vitals[r.r], s = v ? signs(v, today) : null, m = momentum(r, repos)
  const crumbs = r.a ? `<nav class="rp-crumbs" aria-label="Where it sits"><a href="?a=${esc(r.a)}">${esc(AREA.get(r.a))}</a><span aria-hidden="true">/</span><a href="?a=${esc(r.a)}&amp;sa=${esc(r.sa)}">${esc(SUB.get(`${r.a}/${r.sa}`))}</a></nav>` : ""

  const stats = [
    `<li class="star">${svg(I.star)}<span><b>${num(r.s)}</b> stars</span></li>`,
    r.w > 0 ? `<li class="up">${svg(I.up)}<span><b>+${num(r.w)}</b> ${esc((r.wt ?? "a week").replace(/^~?\+\S+\s*/, ""))}</span></li>` : "",
    r.fk ? `<li>${svg(I.fork)}${num(r.fk)} forks</li>` : "",
    r.g ? `<li><span class="dot" style="background:${esc(r.gc ?? "var(--muted)")}"></span>${esc(r.g)}</li>` : "",
    r.li ? `<li>${svg(I.law)}${esc(r.li)}</li>` : "",
    r.pl?.length ? `<li>${svg(I.screen)}${r.pl.map((p) => esc(PLAT.get(p))).join(", ")}</li>` : "",
  ].join("")

  return `<div class="rp-top">${BACK}${crumbs}</div>
  <section class="hero">
    <img src="${esc(avatar(owner, 144))}" alt="" width="72" height="72">
    <div class="who">
      <h1>${esc(name)} <small>by ${esc(owner)}</small></h1>
      ${r.l ? `<p class="line">${esc(r.l)}</p>` : ""}
      <ul class="stats">${stats}</ul>
    </div>
    <div class="acts">
      <a class="btn primary" href="https://github.com/${esc(r.r)}" target="_blank" rel="noopener">${GH}GitHub</a>
      ${r.hp ? `<a class="btn" href="${esc(r.hp)}" target="_blank" rel="noopener">Website</a>` : ""}
      <button type="button" class="btn icon" data-share="${esc(r.r)}" aria-label="Copy a share link" title="Share">${svg(I.share).replace("<svg", '<svg style="fill:none;stroke:currentColor;stroke-width:2"')}</button>
      <button type="button" class="btn icon" data-save="${esc(r.r)}" aria-pressed="${saved}" aria-label="${saved ? "Remove from saved" : "Save for later"}" title="${saved ? "Saved" : "Save for later"}">${svg(I.save).replace("<svg", '<svg style="fill:none;stroke:currentColor;stroke-width:2"')}</button>
    </div>
  </section>
  ${vitalsSection(s, m, v)}
  ${compareSection()}
  <div class="pair">${swapCard()}${startCard(v)}</div>
  <div class="tail">
    <div class="topics">${r.t.map((t) => `<span>${esc(t)}</span>`).join("")}</div>
    <button type="button" class="btn" data-readme style="height:44px">${svg(I.doc).replace("<svg", '<svg style="fill:none;stroke:currentColor;stroke-width:2"')}Show README</button>
  </div>
  <section class="rp-readme" hidden><h2>README</h2><div class="readme" style="margin-top:14px"></div></section>`
}

function vitalsSection(s, m, v) {
  if (!s) return `<section aria-labelledby="vs"><h2 id="vs">Vital signs</h2><p class="foot-note">Not measured yet. Every repo is checked once a week, so this fills in within a few days.</p></section>`
  const levels = [m.level, s.activity.level, s.release.level, s.issues.level].filter((l) => l !== "none")
  const good = levels.filter((l) => l === "good").length
  const chip = good === levels.length ? `<span class="chip good">Healthy on all ${levels.length === 4 ? "four" : levels.length}</span>` : `<span class="chip">${good} of ${levels.length} healthy</span>`
  const max = Math.max(...v.weeks, 1)
  const tiles = [
    m.level !== "none" ? `<div class="tile lvl-${m.level}"><div class="k"><span>Momentum</span>${svg(I.up)}</div>
      <div class="v">#${m.rank} <small>of ${m.n}</small></div>
      <div class="rankbar" role="img" aria-label="Number ${m.rank} of ${m.n} by star gain"><span style="left:${((m.rank - 1) / Math.max(m.n - 1, 1)) * 100}%"></span></div>
      <div class="n">by star gain in ${esc(SUB.get(`${r.a}/${r.sa}`))}</div></div>` : "",
    `<div class="tile lvl-${s.activity.level}"><div class="k"><span>Activity</span>${svg(I.pulse)}</div>
      <div class="v">${s.activity.total.toLocaleString("en-US")} <small>${s.activity.total === 1 ? "commit" : "commits"}</small></div>
      <div class="weeks" role="img" aria-label="Commits per week for 12 weeks: ${v.weeks.join(", ")}">${v.weeks.map((w) => `<span style="height:${(w / max) * 100}%"></span>`).join("")}</div>
      <div class="n">last 12 weeks, ${s.activity.active === 12 ? "every week active" : `${s.activity.active} of 12 weeks active`}</div></div>`,
    `<div class="tile lvl-${s.release.level}"><div class="k"><span>Releases</span>${svg(I.tag)}</div>
      ${s.release.ago == null ? `<div class="v">None</div><div class="n">no releases on GitHub, which some projects never use</div>` : `
      <div class="v">${s.release.ago < 2 ? esc(ago(s.release.ago)) : `${s.release.ago < 60 ? s.release.ago : Math.round(s.release.ago / (s.release.ago < 730 ? 30 : 365))} <small>${s.release.ago < 60 ? "days" : s.release.ago < 730 ? "months" : "years"} ago</small>`}</div>
      <div class="timeline" role="img" aria-label="Latest release ${esc(s.release.tag)}"><i><b style="left:${Math.max(4, 100 - Math.min(s.release.ago, 365) / 3.65)}%"></b></i>today</div>
      <div class="n">${esc(s.release.tag)}, ${new Date(s.release.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: s.release.ago > 300 ? "numeric" : undefined, timeZone: "UTC" })}</div>`}</div>`,
    `<div class="tile lvl-${s.issues.level}"><div class="k"><span>Issues</span>${svg(I.check)}</div>
      ${s.issues.level === "none" ? `<div class="v">${s.issues.opened} <small>new</small></div><div class="n">issues opened in 90 days, too few to read much into</div>` : `
      <div class="ring"><svg viewBox="0 0 56 56" role="img" aria-label="${Math.round(s.issues.pct * 100)} percent of new issues closed"><circle cx="28" cy="28" r="22" fill="none" stroke="var(--raise)" stroke-width="7"/><circle cx="28" cy="28" r="22" fill="none" stroke="var(--c)" stroke-width="7" stroke-linecap="round" stroke-dasharray="${(s.issues.pct * 138.2).toFixed(1)} 138.2" transform="rotate(-90 28 28)"/></svg><div class="v">${Math.round(s.issues.pct * 100)}%</div></div>
      <div class="n">${s.issues.closed} closed, ${s.issues.opened} opened in 90 days</div>`}</div>`,
  ].join("")
  return `<section aria-labelledby="vs"><div class="sec-head"><h2 id="vs">Vital signs</h2>${chip}</div><div class="tiles">${tiles}</div>
    <p class="foot-note">From GitHub, checked weekly. Star history started Nov 6, 2026. <a href="how.html#vitals">How we read these</a></p></section>`
}

// repos that replace the same tools, else its neighbours in the same subarea; this one first
function peers() {
  const alts = new Set((r.alt ?? []).map((a) => a.toLowerCase()))
  let p = repos.filter((x) => x !== r && (x.alt ?? []).some((a) => alts.has(a.toLowerCase())))
  if (p.length < 2) p = [...new Set([...p, ...repos.filter((x) => x !== r && r.a && x.a === r.a && x.sa === r.sa)])]
  return p.sort((a, b) => b.s - a.s).slice(0, 3)
}

function compareSection() {
  const rows = [r, ...peers()]
  if (rows.length < 2) return ""
  const commits = (x) => vitals[x.r]?.weeks.reduce((a, b) => a + b, 0)
  const max = Math.max(...rows.map((x) => commits(x) ?? 0), 1)
  const rel = (x) => { const v = vitals[x.r]; if (!v) return "Not measured"; const s = signs(v, today); return s.release.ago == null ? "None" : ago(s.release.ago) }
  return `<section aria-labelledby="cmp"><h2 id="cmp">How it compares</h2><div class="cmp"><table>
    <thead><tr><th scope="col">Repo</th><th scope="col">Stars</th><th scope="col" style="width:14rem">Commits, 12 weeks</th><th scope="col">Last release</th><th scope="col">Form</th><th scope="col">License</th></tr></thead>
    <tbody>${rows.map((x) => { const c = commits(x); return `<tr class="${x === r ? "me" : ""}">
      <th scope="row">${x === r ? `${esc(x.r.split("/")[1])}<small>this repo</small>` : `<a class="rp-name" href="?page=${encodeURIComponent(x.r)}">${esc(x.r.split("/")[1])}</a>`}</th>
      <td>${num(x.s)}</td>
      <td>${c == null ? "Not measured" : `<div class="bar"><span style="width:${(c / max) * 9}rem"></span>${c.toLocaleString("en-US")}</div>`}</td>
      <td>${rel(x)}</td>
      <td>${(x.fo ?? []).map((f) => esc(FORM.get(f))).join(", ") || "Not labelled"}</td>
      <td>${esc(x.li ?? "None listed")}</td></tr>` }).join("")}</tbody></table></div></section>`
}

// ---- alternatives: ?alt=Postman lists every repo that replaces it, ?alt=all lists the products ----
const altKey = (a) => a.toLowerCase()
export function altGroups(list) {
  const g = new Map()
  for (const x of list) for (const a of x.alt ?? []) { const k = altKey(a); if (!g.has(k)) g.set(k, { name: a, repos: [] }); g.get(k).repos.push(x) }
  return g
}
// fit: how much of the product's checklist a repo covers (scripts/fit.mjs in the pipeline). [score, kind, marks, quotes]
const KIND = { "drop-in": "Replaces it", part: "Covers one part", different: "Same job, different way" }
const fitOf = (g, x) => fit.pairs?.[altKey(g.name)]?.[x.r]
const byFit = (g) => (a, b) => (fitOf(g, b)?.[0] ?? -1) - (fitOf(g, a)?.[0] ?? -1) || healthy(b) - healthy(a) || b.s - a.s
const covered = (m) => [...m].reduce((n, c) => n + (c === "y" ? 1 : c === "p" ? 0.5 : 0), 0)
const healthy = (x) => { const v = vitals[x.r]; if (!v) return -1; const s = signs(v, today); return [s.activity, s.release, s.issues].filter((y) => y.level === "good").length }

export function altPage(name, ctx) {
  ({ repos, vitals, today } = ctx); FORM = new Map(ctx.TX.forms); fit = ctx.fit ?? {}
  const groups = altGroups(repos), g = groups.get(altKey(name))
  const crumbs = `<nav class="rp-crumbs" aria-label="Where it sits"><a href="?alt=all">Alternatives</a></nav>`
  if (!g) return `<div class="rp-top">${BACK}${crumbs}</div><p class="rp-missing">No open source alternatives to ${esc(name)} on starwire yet. <a href="?q=${encodeURIComponent(name)}">Search for ${esc(name)}</a> or <a href="?alt=all">see every product</a>.</p>`
  // best fit first (how much of the checklist it covers), then the healthiest, then most stars
  const rows = [...g.repos].sort(byFit(g)), P = fit.products?.[altKey(g.name)]
  const jobs = P?.jobs ?? []
  const dots = (f) => `<span class="fit-dots">${jobs.map(([j, w], i) => `<i class="m-${f[2][i]}${w === 2 ? " core" : ""}" title="${esc(`${j}: ${f[2][i] === "y" ? "yes" : f[2][i] === "p" ? "partly" : "not shown"}${f[3][i] ? `. "${f[3][i]}"` : ""}`)}"></i>`).join("")}</span>`
  const fitCell = (x) => { const f = fitOf(g, x); return f ? `<span class="fit"><b>${Math.round(f[0] * 100)}%</b><small>${KIND[f[1]]}</small></span>${dots(f)}` : `<span class="muted">Not checked yet</span>` }
  const commits = (x) => vitals[x.r]?.weeks.reduce((a, b) => a + b, 0)
  const max = Math.max(...rows.map((x) => commits(x) ?? 0), 1)
  const cell = (x) => { const v = vitals[x.r]; if (!v) return ["Not measured", "Not measured"]; const s = signs(v, today)
    return [s.release.ago == null ? "None" : ago(s.release.ago), s.issues.level === "none" ? "Too few" : `<span class="lvl-${s.issues.level}"><i class="dot"></i>${Math.round(s.issues.pct * 100)}%</span>`] }
  // other products these repos also replace, for the next click
  const near = new Map()
  for (const x of rows) for (const a of x.alt ?? []) if (altKey(a) !== altKey(g.name)) near.set(altKey(a), groups.get(altKey(a)))
  const related = [...near.values()].sort((a, b) => b.repos.length - a.repos.length).slice(0, 8)
  return `<div class="rp-top">${BACK}${crumbs}</div>
  <section class="hero alt-hero"><div class="who">
    <h1>Open source alternatives to ${esc(g.name)}</h1>
    <p class="line">${rows.length === 1 ? "One project on starwire does the same job." : `${rows.length} projects on starwire do the same job.`} ${P ? `Ranked by how much of what ${esc(g.name)} does each one covers, read from its README and website. Ties go to the healthiest.` : "The healthiest come first: steady commits, recent releases and issues getting closed."}</p>
  </div></section>
  ${P ? `<section class="jobs" aria-labelledby="jobs"><h2 id="jobs">What ${esc(g.name)} does</h2><ol class="job-list">${jobs.map(([j, w]) => `<li class="${w === 2 ? "core" : ""}">${esc(j)}${w === 2 ? "<small>core</small>" : ""}</li>`).join("")}</ol><p class="foot-note">Each dot in the table is one job, in this order. Square dots are core jobs and count double. Full means yes, half means partly. Hover a dot for the line behind it. <a href="how.html#fit">How we score this</a></p></section>` : ""}
  <section aria-label="Alternatives to ${esc(g.name)}"><div class="cmp alt-table"><table>
    <thead><tr><th scope="col">Project</th>${P ? `<th scope="col">Covers</th>` : ""}<th scope="col">Stars</th><th scope="col" style="width:12rem">Commits, 12 weeks</th><th scope="col">Last release</th><th scope="col">Issues closed</th><th scope="col">Form</th><th scope="col">License</th></tr></thead>
    <tbody>${rows.map((x) => { const c = commits(x), [rel, iss] = cell(x), [owner, nm] = x.r.split("/"); return `<tr>
      <th scope="row"><a class="alt-name" href="?page=${encodeURIComponent(x.r)}"><img src="${esc(avatar(owner, 56))}" alt="" width="28" height="28" loading="lazy" decoding="async"><span><b>${esc(nm)}</b><small>${esc(x.l || owner)}</small></span></a></th>
      ${P ? `<td data-k="Covers">${fitCell(x)}</td>` : ""}<td data-k="Stars"><span class="s">${num(x.s)}</span>${x.w > 0 ? `<small class="w">+${num(x.w)}</small>` : ""}</td>
      <td data-k="Commits, 12 weeks">${c == null ? "Not measured" : `<div class="bar"><span style="width:${(c / max) * 7}rem"></span>${c.toLocaleString("en-US")}</div>`}</td>
      <td data-k="Last release">${rel}</td><td data-k="Issues closed">${iss}</td>
      <td data-k="Form">${(x.fo ?? []).map((f) => esc(FORM.get(f))).join(", ") || "Not labelled"}</td>
      <td data-k="License">${esc(x.li ?? "None listed")}</td></tr>` }).join("")}</tbody></table></div>
    <p class="foot-note">Vital signs from GitHub, checked weekly. <a href="how.html#vitals">How we read these</a></p></section>
  ${related.length ? `<section aria-labelledby="also"><h2 id="also">These also replace</h2><div class="alt-chips">${related.map((x) => `<a href="?alt=${encodeURIComponent(x.name)}">${esc(x.name)}<span>${x.repos.length}</span></a>`).join("")}</div></section>` : ""}`
}

// the index is a swap list: "Instead of Notion, use AFFiNE, litpage, AppFlowy", grouped by the area most of each
// product's alternatives sit in. Best fit first; ones that only cover part of the product, or do it differently, are dimmed.
// Scores stay on the product pages, where projects are compared.
export function altIndex(ctx) {
  ({ repos, vitals, today } = ctx); fit = ctx.fit ?? {}
  const areaName = new Map((ctx.TX?.areas ?? []).map((a) => [a.id, a.name]))
  const all = [...altGroups(repos).values()]
  const areaOf = (g) => { const n = new Map(); for (const x of g.repos) if (x.a) n.set(x.a, (n.get(x.a) ?? 0) + 1); return [...n].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "other" }
  const groups = new Map()
  for (const g of all) { const a = areaOf(g); if (!groups.has(a)) groups.set(a, []); groups.get(a).push(g) }
  const order = [...groups].sort((a, b) => b[1].length - a[1].length).map(([a, gs]) => [a, gs.sort((x, y) => y.repos.length - x.repos.length || x.name.localeCompare(y.name))])
  const pick = (g, x) => { const f = fitOf(g, x), [owner, nm] = x.r.split("/"), weak = f && (f[1] !== "drop-in" || f[0] < 0.5)
    return `<a class="sw-pick${weak ? " weak" : ""}" href="?page=${encodeURIComponent(x.r)}"${weak ? ` title="${esc(KIND[f[1]])}"` : ""}><img src="${esc(avatar(owner, 40))}" alt="" width="18" height="18" loading="lazy" decoding="async"><span>${esc(nm)}</span></a>` }
  const row = (g) => { const top = [...g.repos].sort(byFit(g)), more = top.length - 3
    return `<li class="sw-row" data-name="${esc([g.name, ...g.repos.map((x) => x.r.split("/")[1])].join(" ").toLowerCase())}">
      <a class="sw-prod" href="?alt=${encodeURIComponent(g.name)}">${esc(g.name)}</a>
      <span class="sw-use">${top.slice(0, 3).map((x) => pick(g, x)).join("")}${more > 0 ? `<a class="sw-more" href="?alt=${encodeURIComponent(g.name)}" aria-label="All ${top.length} alternatives to ${esc(g.name)}">+${more}</a>` : ""}</span></li>` }
  return `<div class="rp-top">${BACK}</div>
  <section class="hero alt-hero"><div class="who">
    <h1>Open source alternatives</h1>
    <p class="line">${all.length} products you might pay for, and the open source projects on starwire that do the same job. The best fit comes first. Faded names cover only part of the product.</p>
  </div></section>
  <section aria-label="Products"><input type="search" class="alt-filter" placeholder="Find a product or project, like Notion or penpot" aria-label="Find a product or project" data-alt-filter>
    <div class="swaplist" role="presentation"><div class="sw-cols" aria-hidden="true"><span>Instead of</span><span>Use</span></div>
    ${order.map(([a, gs]) => `<section class="sw-group" aria-label="${esc(areaName.get(a) ?? "Other")}"><h2>${esc(areaName.get(a) ?? "Other")}</h2><ul>${gs.map(row).join("")}</ul></section>`).join("")}</div>
    <p class="rp-missing" hidden data-alt-none>No product or project by that name yet.</p></section>`
}

function swapCard() {
  if (!r.alt?.length) return ""
  const first = r.alt[0], n = repos.filter((x) => (x.alt ?? []).some((a) => a.toLowerCase() === first.toLowerCase())).length
  return `<section class="card" aria-labelledby="swap"><h2 id="swap">Swap out</h2>
    <div class="swap">${r.alt.slice(0, 3).map((a) => `<a href="?alt=${encodeURIComponent(a)}">${esc(a)}</a>`).join("")}${svg(I.arrow)}<span class="to">${esc(r.r.split("/")[1])}</span></div>
    ${n > 1 ? `<p style="margin:14px 0 0;font-size:14px"><a href="?alt=${encodeURIComponent(first)}">All ${n} ${esc(first)} alternatives</a></p>` : ""}</section>`
}

function startCard(v) {
  const icon = (d) => svg(d).replace("<svg", '<svg style="fill:none;stroke:currentColor;stroke-width:2"')
  return `<section class="card" aria-labelledby="start"><h2 id="start">Get started</h2><div class="start">
    ${v?.release ? `<a href="https://github.com/${esc(r.r)}/releases/latest" target="_blank" rel="noopener">${icon(I.down)}Download</a>` : ""}
    <button type="button" data-clone>${icon(I.copy)}<span>Copy clone</span></button>
    <a href="https://github.com/${esc(r.r)}/contribute" target="_blank" rel="noopener">${icon(I.hand)}<span>${v?.gfi ? `<b>${v.gfi}</b> first ${v.gfi === 1 ? "issue" : "issues"}` : "Contribute"}</span></a>
  </div></section>`
}

export async function copyClone(b) {
  const label = b.querySelector("span"), cmd = `git clone https://github.com/${r.r}.git`
  try { await navigator.clipboard.writeText(cmd); label.textContent = "Copied" } catch { label.textContent = cmd }
  setTimeout(() => (label.textContent = "Copy clone"), 1600)
}

export async function showReadme(root, b) {
  const sec = root.querySelector(".rp-readme"), el = sec.querySelector(".readme"), repo = r.r
  sec.hidden = false; b.remove()
  el.innerHTML = `<p class="muted">Loading README…</p>`
  try {
    const { md, frag } = await readmeFragment(repo)
    if (repo !== r?.r) return // moved to another repo while it loaded
    if (!md) el.innerHTML = `<p class="muted">This repo has no README.</p>`
    else { el.replaceChildren(frag); if (md.length > 15000) el.insertAdjacentHTML("beforeend", `<p><a href="https://github.com/${esc(repo)}#readme" target="_blank" rel="noopener">Read the rest on GitHub</a></p>`) }
  } catch { el.innerHTML = `<p class="muted">Couldn't load the README. <a href="https://github.com/${esc(repo)}#readme" target="_blank" rel="noopener">Read it on GitHub</a>.</p>` }
}
