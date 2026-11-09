// The share card for an alternatives page (r.starwire.foo/instead-of/<product>): "Instead of Notion", then its best
// three replacements, ranked as the site ranks them (how much of the product's checklist each covers, docs/data/fit.json).
// HTML that Satori can lay out: flexbox only, every container display:flex.

const C = { bg: "#0b0b0b", panel: "#121212", line: "#222222", text: "#f2f2f2", soft: "#c4c4c4", muted: "#8f8f8f", green: "#75d079", amber: "#e3b341" }
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c])
const num = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}m` : n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n))
const MARK = (s) => `<div style="display:flex;width:${s}px;height:${s}px;border-radius:${Math.round(s / 4)}px;background:${C.amber};align-items:center;justify-content:center"><svg width="${Math.round(s * 0.62)}" height="${Math.round(s * 0.62)}" viewBox="0 0 24 24"><path fill="#1a1300" d="m12 2.5 2.9 6.2 6.8.8-5 4.7 1.3 6.7L12 17.6l-6 3.3 1.3-6.7-5-4.7 6.8-.8z"/></svg></div>`
const STAR = `<svg width="22" height="22" viewBox="0 0 24 24"><path fill="${C.amber}" d="m12 2.5 2.9 6.2 6.8.8-5 4.7 1.3 6.7L12 17.6l-6 3.3 1.3-6.7-5-4.7 6.8-.8z"/></svg>`
const KIND = { part: "covers one part", different: "different approach" }

// the URL slug for a product: "Google Analytics" -> "google-analytics"
export const altSlug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")

// the product's alternatives in the site's order: best fit, then healthier, then more stars
export function rankAlts(name, repos, fit, healthy = () => 0) {
  const k = name.toLowerCase(), pairs = fit?.pairs?.[k] ?? {}
  const list = repos.filter((r) => (r.alt ?? []).some((a) => a.toLowerCase() === k))
  return list.map((r) => ({ r, f: pairs[r.r] }))
    .sort((a, b) => (b.f?.[0] ?? -1) - (a.f?.[0] ?? -1) || healthy(b.r) - healthy(a.r) || b.r.s - a.r.s)
}

const productSize = (n) => (n.length <= 10 ? 104 : n.length <= 14 ? 88 : n.length <= 20 ? 70 : 56)

// picks: [{ r, f, avatar }] (avatar: data URI or null), total: how many alternatives the product has on starwire
export function altCardHTML(name, picks, total) {
  const scored = picks.some((p) => p.f)
  const row = ({ r, f, avatar }, i) => {
    const [owner, repo] = r.r.split("/")
    const face = avatar
      ? `<img src="${avatar}" width="64" height="64" style="width:64px;height:64px;border-radius:16px;object-fit:cover"/>`
      : `<div style="display:flex;width:64px;height:64px;border-radius:16px;background:${C.panel};border:2px solid ${C.line}"></div>`
    const right = f
      ? `<div style="display:flex;flex-direction:column;align-items:flex-end;flex-shrink:0;width:170px"><span style="font-size:40px;font-weight:800;color:${f[1] === "drop-in" ? C.green : C.soft}">${Math.round(f[0] * 100)}%</span><span style="font-size:19px;color:${C.muted}">${esc(KIND[f[1]] ?? "fit")}</span></div>`
      : `<div style="display:flex;align-items:center;gap:8px;flex-shrink:0;width:170px;justify-content:flex-end;font-size:28px;font-weight:700">${STAR}<span>${num(r.s)}</span></div>`
    return `<div style="display:flex;align-items:center;gap:24px;padding:18px 0;${i ? `border-top:2px solid ${C.line};` : ""}">
      <span style="display:flex;width:22px;flex-shrink:0;font-size:28px;font-weight:700;color:${C.muted}">${i + 1}</span>
      ${face}
      <div style="display:flex;flex-direction:column;flex-grow:1;width:700px">
        <div style="display:flex;align-items:center;gap:16px"><span style="font-size:38px;font-weight:700;letter-spacing:-1px;white-space:nowrap">${esc(repo)}</span>${f ? `<div style="display:flex;align-items:center;gap:6px;font-size:22px;color:${C.muted}">${STAR.replace('width="22" height="22"', 'width="18" height="18"')}<span>${num(r.s)}</span></div>` : `<span style="font-size:22px;color:${C.muted}">${esc(owner)}</span>`}</div>
        <span style="margin-top:4px;font-size:23px;color:${C.soft};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;width:700px">${esc(r.l)}</span>
      </div>
      ${right}
    </div>`
  }
  const foot = `${total} open source ${total === 1 ? "alternative" : "alternatives"} on starwire${scored ? ", best fit first" : ""}`
  return `<div style="display:flex;flex-direction:column;box-sizing:border-box;width:1200px;height:630px;padding:44px 64px 38px;background:${C.bg};color:${C.text};font-family:Geist">
  <div style="display:flex;width:1072px;justify-content:space-between;align-items:flex-start">
    <div style="display:flex;flex-direction:column">
      <span style="font-size:30px;color:${C.muted}">Instead of</span>
      <span style="font-size:${productSize(name)}px;line-height:1;font-weight:800;letter-spacing:-4px;margin-top:4px">${esc(name)}</span>
    </div>
    ${MARK(56)}
  </div>
  <div style="display:flex;flex-direction:column;width:1072px;margin-top:${picks.length < 3 ? 40 : 18}px">${picks.map(row).join("")}</div>
  <div style="display:flex;width:1072px;margin-top:auto;justify-content:space-between;align-items:center;font-size:21px;color:${C.muted}">
    <span>${esc(foot)}</span><span style="font-weight:600;color:${C.soft}">starwire.foo</span>
  </div>
</div>`.replace(/>\s+</g, "><") // whitespace between tags becomes flex items that space-between spreads out
}
