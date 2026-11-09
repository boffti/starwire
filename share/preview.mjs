// Render real share cards on this machine, with the same code the Worker runs, to check them before deploying.
// usage: node preview.mjs [out-dir] [owner/name | alt:Product ...]   (reads ../docs/data/data.json, and pictures and vitals from the
// pipeline checkout next to this repo when it's there, else ../docs/data/vitals.json)
import fs from "node:fs"
import { ImageResponse, GoogleFont } from "@cf-wasm/og/node"
import { t } from "@cf-wasm/og/html-to-react"
import { cardHTML } from "./src/card.js"
import { pickArt } from "./src/art.js"
import { altCardHTML, rankAlts, altSlug } from "./src/altcard.js"

const [out = "cards", ...names] = process.argv.slice(2)
const data = JSON.parse(fs.readFileSync("../docs/data/data.json", "utf8"))
const pipe = "../../starwire-pipeline/data/vitals.json"
const vitals = fs.existsSync(pipe) ? JSON.parse(fs.readFileSync(pipe, "utf8")).repos : JSON.parse(fs.readFileSync("../docs/data/vitals.json", "utf8"))
const AREA = new Map(data.taxonomy.areas.flatMap((a) => a.subs.map(([id, n]) => [`${a.id}/${id}`, n])))
const fonts = [400, 600, 700, 800].map((weight) => new GoogleFont("Geist", { weight }))
fs.mkdirSync(out, { recursive: true })

const fit = fs.existsSync("../docs/data/fit.json") ? JSON.parse(fs.readFileSync("../docs/data/fit.json", "utf8")) : {}
for (const name of names) {
  if (name.startsWith("alt:")) { // an alternatives card
    const product = name.slice(4), ranked = rankAlts(product, data.repos, fit)
    if (!ranked.length) { console.log(product, "has no alternatives"); continue }
    const picks = await Promise.all(ranked.slice(0, 3).map(async (p) => ({ ...p, avatar: (await pickArt(p.r.r, undefined))?.src ?? null })))
    const res = await ImageResponse.async(t(altCardHTML(ranked[0].r.alt.find((a) => a.toLowerCase() === product.toLowerCase()) ?? product, picks, ranked.length)), { width: 1200, height: 630, fonts })
    const file = `${out}/instead-of__${altSlug(product)}.png`
    fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()))
    console.log(file)
    continue
  }
  const r = data.repos.find((x) => x.r.toLowerCase() === name.toLowerCase())
  if (!r) { console.log(name, "not listed"); continue }
  const v = vitals[r.r], art = await pickArt(r.r, v?.art ?? undefined)
  const html = cardHTML(r, { v, repos: data.repos, today: data.updated.slice(0, 10), area: AREA.get(`${r.a}/${r.sa}`), art })
  const res = await ImageResponse.async(t(html), { width: 1200, height: 630, fonts })
  const file = `${out}/${r.r.replace("/", "__")}.png`
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()))
  console.log(file, art.kind, art.wide ? "showcase" : "standard")
}
