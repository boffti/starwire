// starwire share links, served at r.starwire.foo:
//   /owner/name           a small page carrying the repo's preview tags; people are sent on to its page on starwire
//   /owner/name/card.png  the card image chat apps show (src/card.js), cached for a day
//   /instead-of/notion    the same pair for an alternatives page: "Instead of Notion" and its best three (src/altcard.js)
// Data comes from the live site (data.json, vitals.json, art.json), so the cards update with the nightly refresh.
import { ImageResponse, GoogleFont, cache } from "@cf-wasm/og/workerd"
import { t } from "@cf-wasm/og/html-to-react"
import { cardHTML } from "./card.js"
import { altCardHTML, rankAlts, altSlug } from "./altcard.js"
import { pickArt } from "./art.js"
import { signs, summary } from "../../docs/js/vitals.js"

const SITE = "https://starwire.foo", SELF = "https://r.starwire.foo"
const fonts = [400, 600, 700, 800].map((weight) => new GoogleFont("Geist", { weight }))
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c])
const num = (n) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n))

// the site's data, kept in memory for 10 minutes and in Cloudflare's cache in between
let memo = { at: 0 }
async function site() {
  if (memo.data && Date.now() - memo.at < 6e5) return memo
  const one = (path) => fetch(`${SITE}/${path}`, { cf: { cacheTtl: 600, cacheEverything: true } }).then((r) => (r.ok ? r.json() : null)).catch(() => null)
  // the site's data lives in data/; the old top-level address is the fallback while a deploy rolls out
  const get = async (f) => (await one(`data/${f}`)) ?? one(f)
  const [data, vitals, art, fit] = await Promise.all([get("data.json"), get("vitals.json"), get("art.json"), get("fit.json")])
  if (!data) throw new Error("starwire data unavailable")
  memo = {
    at: Date.now(), data, vitals: vitals ?? {}, art: art ?? {}, fit: fit ?? {},
    alts: new Map(data.repos.flatMap((r) => r.alt ?? []).map((a) => [altSlug(a), a])), // slug -> product name
    byName: new Map(data.repos.map((r) => [r.r.toLowerCase(), r])),
    area: new Map(data.taxonomy.areas.flatMap((a) => a.subs.map(([id, n]) => [`${a.id}/${id}`, n]))),
  }
  return memo
}

function page(r, s) {
  const [, name] = r.r.split("/"), today = s.data.updated.slice(0, 10), v = s.vitals[r.r]
  const facts = [`${num(r.s)} stars`, r.w > 0 ? `+${num(r.w)} ${(r.wt ?? "a week").replace(/^~?\+\S+\s*/, "")}` : ""].filter(Boolean).join(", ")
  const desc = [`${facts}.`, v ? `${summary(signs(v, today))}.` : "", r.alt?.length ? `Swaps out ${r.alt.join(", ")}.` : ""].filter(Boolean).join(" ")
  const title = `${name}: ${r.l || "open source repo"}`
  const target = `${SITE}/?page=${encodeURIComponent(r.r)}`
  const img = `${SELF}/${r.r}/card.png?v=${today}`
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>${esc(title)} | starwire</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="website"><meta property="og:site_name" content="starwire">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${SELF}/${esc(r.r)}"><meta property="og:image" content="${esc(img)}">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="${esc(`${name} on starwire`)}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(desc)}"><meta name="twitter:image" content="${esc(img)}">
<link rel="canonical" href="${esc(target)}"><meta http-equiv="refresh" content="0;url=${esc(target)}">
</head><body style="background:#0b0b0b;color:#f2f2f2;font:16px system-ui;padding:40px"><a style="color:#75d079" href="${esc(target)}">Open ${esc(name)} on starwire</a></body></html>`
}

async function card(r, s, ctx) {
  const today = s.data.updated.slice(0, 10), v = s.vitals[r.r]
  const base = { v, repos: s.data.repos, today, area: s.area.get(`${r.a}/${r.sa}`) }
  const draw = (art) => ImageResponse.async(t(cardHTML(r, { ...base, art })), { width: 1200, height: 630, fonts })
  // a picture the renderer can't read falls back to the avatar, then to no picture, so a card always comes back
  const first = await pickArt(r.r, s.art[r.r], { cf: { cacheTtl: 86400, cacheEverything: true } })
  for (const art of [first, first?.kind === "avatar" ? null : await pickArt(r.r, undefined), null]) {
    try { const res = await draw(art); await res.clone().arrayBuffer(); return res } catch (e) { console.error(r.r, art?.kind, e?.message) }
  }
  throw new Error("card failed")
}

// ---- alternatives pages ----
// ties go to the healthier project, as on the site: how many of activity, releases and issues are green
const healthy = (s) => (r) => { const v = s.vitals[r.r]; if (!v) return -1; const x = signs(v, s.data.updated.slice(0, 10)); return [x.activity, x.release, x.issues].filter((y) => y.level === "good").length }

function altPage(name, s) {
  const ranked = rankAlts(name, s.data.repos, s.fit, healthy(s)), top = ranked.slice(0, 3).map((x) => x.r.r.split("/")[1])
  const list = top.length > 1 ? `${top.slice(0, -1).join(", ")} and ${top.at(-1)}` : top[0]
  const title = `Open source alternatives to ${name}`
  const desc = `${list} ${top.length > 1 ? "lead" : "leads"} the ${ranked.length} on starwire${s.fit?.products?.[name.toLowerCase()] ? `, ranked by how much of what ${name} does each one covers` : ""}.`
  const target = `${SITE}/?alt=${encodeURIComponent(name)}`, slug = altSlug(name)
  const img = `${SELF}/instead-of/${slug}/card.png?v=${s.data.updated.slice(0, 10)}`
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>${esc(title)} | starwire</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="website"><meta property="og:site_name" content="starwire">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${SELF}/instead-of/${slug}"><meta property="og:image" content="${esc(img)}">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="${esc(`Instead of ${name}: ${list}`)}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(desc)}"><meta name="twitter:image" content="${esc(img)}">
<link rel="canonical" href="${esc(target)}"><meta http-equiv="refresh" content="0;url=${esc(target)}">
</head><body style="background:#0b0b0b;color:#f2f2f2;font:16px system-ui;padding:40px"><a style="color:#75d079" href="${esc(target)}">See the open source alternatives to ${esc(name)} on starwire</a></body></html>`
}

async function altCard(name, s) {
  const ranked = rankAlts(name, s.data.repos, s.fit, healthy(s))
  const opts = { cf: { cacheTtl: 86400, cacheEverything: true } }
  const picks = await Promise.all(ranked.slice(0, 3).map(async (p) => ({ ...p, avatar: (await pickArt(p.r.r, undefined, opts))?.src ?? null })))
  const draw = (ps) => ImageResponse.async(t(altCardHTML(name, ps, ranked.length)), { width: 1200, height: 630, fonts })
  // an avatar the renderer can't read: draw the card again without pictures
  for (const ps of [picks, picks.map((p) => ({ ...p, avatar: null }))]) {
    try { const res = await draw(ps); await res.clone().arrayBuffer(); return res } catch (e) { console.error(name, e?.message) }
  }
  throw new Error("alt card failed")
}

export default {
  async fetch(req, env, ctx) {
    cache.setExecutionContext(ctx)
    const url = new URL(req.url)
    const a = url.pathname.match(/^\/instead-of\/([a-z0-9-]+)(\/card\.png)?\/?$/i)
    if (a) {
      const s = await site(), name = s.alts.get(a[1].toLowerCase())
      if (!name) return Response.redirect(`${SITE}/?alt=all`, 302)
      if (!a[2]) return new Response(altPage(name, s), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=600" } })
      const key = new Request(url.toString()), hit = await caches.default.match(key)
      if (hit) return hit
      const png = await altCard(name, s)
      const res = new Response(png.body, { headers: { "content-type": "image/png", "cache-control": "public, max-age=86400" } })
      ctx.waitUntil(caches.default.put(key, res.clone()))
      return res
    }
    const m = url.pathname.match(/^\/([A-Za-z0-9-]+)\/([A-Za-z0-9_.-]+?)(\/card\.png)?\/?$/)
    if (!m) return Response.redirect(SITE, 302)
    const s = await site()
    const r = s.byName.get(`${m[1]}/${m[2]}`.toLowerCase())
    if (!r) return Response.redirect(`${SITE}/?page=${encodeURIComponent(`${m[1]}/${m[2]}`)}`, 302)
    if (!m[3]) return new Response(page(r, s), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=600" } })
    const key = new Request(url.toString()), hit = await caches.default.match(key)
    if (hit) return hit
    const png = await card(r, s, ctx)
    const res = new Response(png.body, { headers: { "content-type": "image/png", "cache-control": "public, max-age=86400" } })
    ctx.waitUntil(caches.default.put(key, res.clone()))
    return res
  },
}
