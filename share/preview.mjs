// Render real share cards on this machine, with the same code the Worker runs, to check them before deploying.
// usage: node preview.mjs [out-dir] [owner/name ...]   (reads ../docs/data.json, and pictures and vitals from the
// pipeline checkout next to this repo when it's there, else ../docs/vitals.json)
import fs from "node:fs"
import { ImageResponse, GoogleFont } from "@cf-wasm/og/node"
import { t } from "@cf-wasm/og/html-to-react"
import { cardHTML } from "./src/card.js"
import { pickArt } from "./src/art.js"

const [out = "cards", ...names] = process.argv.slice(2)
const data = JSON.parse(fs.readFileSync("../docs/data.json", "utf8"))
const pipe = "../../starwire-pipeline/data/vitals.json"
const vitals = fs.existsSync(pipe) ? JSON.parse(fs.readFileSync(pipe, "utf8")).repos : JSON.parse(fs.readFileSync("../docs/vitals.json", "utf8"))
const AREA = new Map(data.taxonomy.areas.flatMap((a) => a.subs.map(([id, n]) => [`${a.id}/${id}`, n])))
const fonts = [400, 600, 700, 800].map((weight) => new GoogleFont("Geist", { weight }))
fs.mkdirSync(out, { recursive: true })

for (const name of names) {
  const r = data.repos.find((x) => x.r.toLowerCase() === name.toLowerCase())
  if (!r) { console.log(name, "not listed"); continue }
  const v = vitals[r.r], art = await pickArt(r.r, v?.art ?? undefined)
  const html = cardHTML(r, { v, repos: data.repos, today: data.updated.slice(0, 10), area: AREA.get(`${r.a}/${r.sa}`), art })
  const res = await ImageResponse.async(t(html), { width: 1200, height: 630, fonts })
  const file = `${out}/${r.r.replace("/", "__")}.png`
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()))
  console.log(file, art.kind, art.wide ? "showcase" : "standard")
}
