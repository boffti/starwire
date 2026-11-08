// README previews, shared by the repo panel (app.js) and the repo page (repo.js): fetched from GitHub, cached for a
// day, rendered with marked and sanitized with DOMPurify, links and images pointed back into the repo
let libs
export const loadLibs = () =>
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
export function followTheme(root) {
  const dark = siteDark()
  for (const s of root.querySelectorAll("source[media]")) {
    s.dataset.media ??= s.getAttribute("media")
    if (!/prefers-color-scheme/i.test(s.dataset.media)) continue
    s.setAttribute("media", s.dataset.media.replace(/\(\s*prefers-color-scheme\s*:\s*(dark|light)\s*\)/gi, (_, v) => ((v.toLowerCase() === "dark") === dark ? "(min-width: 0px)" : "(min-width: 99999px)")))
  }
}

// READMEs are kept for a day in the browser's Cache Storage, and so is "no README", so reopening a repo
// (or flicking between similar ones) doesn't go back to GitHub, or probe five file names again
const README_DAY = 864e5
export async function readmeText(repo) {
  const key = `${location.origin}/__readme/${repo}`
  let cache
  try { cache = await caches.open("starwire-readme-v1") } catch {} // no Cache Storage (old browser, private mode): just fetch
  const hit = await cache?.match(key).catch(() => null)
  if (hit && Date.now() - Number(hit.headers.get("x-saved")) < README_DAY) return hit.status === 204 ? "" : hit.text()
  let md = ""
  for (const f of ["README.md", "readme.md", "Readme.md", "README.MD", "README"]) {
    const res = await fetch(`https://raw.githubusercontent.com/${repo}/HEAD/${f}`)
    if (res.ok) { md = await res.text(); break }
    if (res.status !== 404) throw new Error(`README ${res.status}`) // rate limited or down: don't remember that as "no README"
  }
  // only what the preview uses (it shows 15000 characters and a "read the rest" link past that)
  cache?.put(key, new Response(md ? md.slice(0, 15001) : null, { status: md ? 200 : 204, headers: { "x-saved": String(Date.now()) } })).catch(() => {})
  return md
}

// the README as a sanitized fragment ready to insert, or md "" when the repo has none
export async function readmeFragment(repo) {
  await loadLibs()
  const md = await readmeText(repo)
  if (!md) return { md, frag: null }
  const r = { r: repo }
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
  return { md, frag }
}
