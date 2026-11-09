// Copies the site (docs/) to the folder GitHub Pages publishes and stamps every reference to the site's own code
// with one version, a hash of all of it, so browsers fetch fresh files after each change. The source keeps plain
// names (js/app.js, css/style.css, from "./repo.js"), so nobody bumps ?v= by hand and branches don't conflict on it.
// usage: node .github/stamp.mjs docs _site
import fs from "node:fs"
import path from "node:path"
import { createHash } from "node:crypto"

const [src = "docs", out = "_site"] = process.argv.slice(2)
fs.rmSync(out, { recursive: true, force: true })
fs.cpSync(src, out, { recursive: true })
const files = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? files(path.join(dir, d.name)) : [path.join(dir, d.name)]))
const all = files(out), code = all.filter((f) => /[\\/](js|css)[\\/][^\\/]+\.(js|css)$/.test(f)).sort()
const h = createHash("sha1")
for (const f of code) h.update(f).update(fs.readFileSync(f))
const v = h.digest("hex").slice(0, 10)
let n = 0
const stamp = (f, re) => { const s = fs.readFileSync(f, "utf8"), t = s.replace(re, (m, p1, p2) => (n++, `${p1}?v=${v}${p2}`)); if (t !== s) fs.writeFileSync(f, t) }
for (const f of all) {
  if (f.endsWith(".html")) stamp(f, /((?:src|href)="(?:\/)?(?:js|css)\/[\w.-]+\.(?:js|css))(")/g)
  else if (code.includes(f) && f.endsWith(".js")) stamp(f, /(from "\.\/[\w.-]+\.js)(")/g)
}
console.log(`stamped ${n} references with v=${v} (${code.length} code files)`)
