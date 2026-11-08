// starwire share links, served at r.starwire.foo:
//   /owner/name           a small page carrying the repo's preview tags; people are sent on to its page on starwire
//   /owner/name/card.png  the card image chat apps show (src/card.js), cached for a day
// Data comes from the live site (data.json, vitals.json, art.json), so the cards update with the nightly refresh.
import { ImageResponse, GoogleFont, cache } from "@cf-wasm/og/workerd"
import { t } from "@cf-wasm/og/html-to-react"
import { cardHTML } from "./card.js"
import { pickArt } from "./art.js"
import { signs, summary } from "../../docs/vitals.js"

const SITE = "https://starwire.foo", SELF = "https://r.starwire.foo"
const fonts = [400, 600, 700, 800].map((weight) => new GoogleFont("Geist", { weight }))
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c])
const num = (n) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n))

// the site's data, kept in memory for 10 minutes and in Cloudflare's cache in between
let memo = { at: 0 }
async function site() {
  if (memo.data && Date.now() - memo.at < 6e5) return memo
  const get = (f) => fetch(`${SITE}/${f}`, { cf: { cacheTtl: 600, cacheEverything: true } }).then((r) => (r.ok ? r.json() : null)).catch(() => null)
  const [data, vitals, art] = await Promise.all([get("data.json"), get("vitals.json"), get("art.json")])
  if (!data) throw new Error("starwire data unavailable")
  memo = {
    at: Date.now(), data, vitals: vitals ?? {}, art: art ?? {},
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

export default {
  async fetch(req, env, ctx) {
    cache.setExecutionContext(ctx)
    const url = new URL(req.url)
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
