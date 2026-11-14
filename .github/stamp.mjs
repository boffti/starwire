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

// The repo's own star count on the top bar's GitHub button, looked up once per deploy and written into every page, so
// visitors' browsers never call GitHub. A failed lookup leaves the pages as they are (index.html carries the last hand-set number).
const num = (k) => (k >= 1000 ? `${(k / 1000).toFixed(k >= 10000 ? 0 : 1)}k` : String(k))
const stars = await fetch("https://api.github.com/repos/boffti/starwire", { headers: process.env.GH_TOKEN ? { authorization: `Bearer ${process.env.GH_TOKEN}` } : {} })
  .then((r) => (r.ok ? r.json() : null)).then((j) => j?.stargazers_count).catch(() => null)
let starred = 0
if (Number.isInteger(stars)) for (const f of all.filter((f) => f.endsWith(".html"))) {
  const s = fs.readFileSync(f, "utf8"), t = s.replace(/(<span>Source<\/span>)(?:<span class="gh-n">[^<]*<\/span>)?(<\/a>)/, `$1<span class="gh-n">${num(stars)}</span>$2`)
  if (t !== s) { fs.writeFileSync(f, t); starred++ }
}
console.log(Number.isInteger(stars) ? `wrote ${num(stars)} stars on ${starred} pages` : "star count not available, pages left as they are")
console.log(`stamped ${n} references with v=${v} (${code.length} code files)`)
