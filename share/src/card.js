// The share card for one repo, as HTML that Satori can lay out (flexbox only, every container display:flex).
// Two layouts, chosen by the picture:
// - showcase: a wide picture (the repo's own social preview, or a README banner or screenshot) across the top, our
//   info strip below
// - standard: a square-ish picture (logo, icon or the owner's avatar) in a tile on the left, our info on the right
// Only what's known is drawn: signs that don't apply, a missing gain or alternative simply aren't there.
import { signs, momentum } from "../../docs/js/vitals.js"

const C = { bg: "#0b0b0b", panel: "#121212", line: "#222222", text: "#f2f2f2", soft: "#c4c4c4", muted: "#8f8f8f", green: "#75d079", greenOk: "#73a074", amber: "#e3b341", tileLight: "#f4f4f4" }
const DOT = { good: C.green, ok: C.greenOk, low: C.amber }
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c])
const num = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}m` : n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n))
const ago = (d) => (d < 1 ? "today" : d === 1 ? "yesterday" : d < 60 ? `${d} days ago` : d < 730 ? `${Math.round(d / 30)} months ago` : `${Math.round(d / 365)} years ago`)

const STAR = `<svg width="26" height="26" viewBox="0 0 24 24"><path fill="${C.amber}" d="m12 2.5 2.9 6.2 6.8.8-5 4.7 1.3 6.7L12 17.6l-6 3.3 1.3-6.7-5-4.7 6.8-.8z"/></svg>`
const UP = `<svg width="22" height="22" viewBox="0 0 24 24"><path fill="none" stroke="${C.green}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" d="m3 17 6-6 4 4 8-8M15 7h6v6"/></svg>`
const MARK = (s) => `<div style="display:flex;width:${s}px;height:${s}px;border-radius:${Math.round(s / 4)}px;background:${C.amber};align-items:center;justify-content:center"><svg width="${Math.round(s * 0.62)}" height="${Math.round(s * 0.62)}" viewBox="0 0 24 24"><path fill="#1a1300" d="m12 2.5 2.9 6.2 6.8.8-5 4.7 1.3 6.7L12 17.6l-6 3.3 1.3-6.7-5-4.7 6.8-.8z"/></svg></div>`

// the vital signs that apply to this repo, as [label, value, level]; signs with nothing to judge are left out
export function chips(r, v, repos, today) {
  const out = [], m = momentum(r, repos)
  if (m.level !== "none") out.push([`of ${m.n} by gain`, `#${m.rank}`, m.level])
  if (!v) return out
  const s = signs(v, today)
  out.push(["Commits, 12 wks", s.activity.total ? s.activity.total.toLocaleString("en-US") : "None", s.activity.level])
  if (s.release.level !== "none") out.push(["Last release", ago(s.release.ago), s.release.level])
  if (s.issues.level !== "none") out.push(["Issues closed", `${Math.round(s.issues.pct * 100)}%`, s.issues.level])
  return out
}

function stats(r, size) {
  const items = [`<div style="display:flex;align-items:center;gap:8px">${STAR}<span style="font-weight:700;color:${C.text}">${num(r.s)}</span></div>`]
  if (r.w > 0) items.push(`<div style="display:flex;align-items:center;gap:8px;color:${C.green}">${UP}<span style="font-weight:700">+${num(r.w)}</span><span style="font-size:${size - 4}px">${esc((r.wt ?? "a week").replace(/^~?\+\S+\s*/, ""))}</span></div>`)
  if (r.g) items.push(`<div style="display:flex;align-items:center;gap:9px"><div style="display:flex;width:15px;height:15px;border-radius:8px;background:${esc(r.gc ?? C.muted)}"></div><span>${esc(r.g)}</span></div>`)
  if (r.li) items.push(`<span>${esc(r.li)}</span>`)
  return `<div style="display:flex;flex-wrap:wrap;align-items:center;gap:12px 28px;font-size:${size}px;color:${C.soft}">${items.join("")}</div>`
}

const SHORT = { "Commits, 12 wks": "commits, 12 wk", "Last release": "last release", "Issues closed": "issues closed" }
const shortAgo = (v) => v.replace(" days ago", "d ago").replace(" months ago", "mo ago").replace(" years ago", "y ago")
function signStats(cs, width, size) {
  return cs.map(([label, value, level]) => `<div style="display:flex;flex-direction:column;gap:6px;${width ? `width:${width}px;` : ""}flex-shrink:0">
    <div style="display:flex;align-items:center;gap:9px"><div style="display:flex;width:12px;height:12px;border-radius:6px;background:${DOT[level]}"></div><span style="font-size:${size}px;font-weight:700;color:${level === "low" ? C.amber : C.text}">${esc(shortAgo(value))}</span></div>
    <span style="font-size:${Math.round(size * 0.64)}px;white-space:nowrap;color:${C.muted}">${SHORT[label] ?? label}</span></div>`).join("")
}

const nameSize = (name, big) => (name.length <= 12 ? big : name.length <= 16 ? big * 0.78 : name.length <= 22 ? big * 0.62 : big * 0.5)

// art: { kind: "og" | "readme" | "avatar", src: data URI, wide: boolean }, or null to draw the starwire mark instead
export function cardHTML(r, { v, repos, today, area, art }) {
  const [owner, name] = r.r.split("/")
  const cs = chips(r, v, repos, today)
  const footer = r.alt?.length ? `Swaps out ${r.alt[0]}` : area ?? ""
  return art?.wide ? showcase(r, owner, name, cs, footer, art) : standard(r, owner, name, cs, footer, art)
}

function standard(r, owner, name, cs, footer, art) {
  const tile = !art ? MARK(170) : art.kind === "avatar"
    ? `<img src="${art.src}" width="380" height="380" style="width:380px;height:380px;object-fit:cover"/>`
    : `<img src="${art.src}" width="300" height="300" style="width:300px;height:300px;object-fit:contain"/>`
  return `<div style="display:flex;box-sizing:border-box;width:1200px;height:630px;padding:56px 56px 48px;gap:48px;background:${C.bg};color:${C.text};font-family:Geist">
  <div style="display:flex;width:380px;height:380px;flex-shrink:0;border-radius:32px;overflow:hidden;align-items:center;justify-content:center;background:${art?.kind === "readme" ? C.tileLight : C.panel};border:2px solid ${C.line}">${tile}</div>
  <div style="display:flex;flex-direction:column;flex-grow:1;flex-shrink:1;width:640px">
    <span style="flex-shrink:0;font-size:${nameSize(name, 84)}px;line-height:1.05;font-weight:800;letter-spacing:-3px">${esc(name)}</span>
    <span style="flex-shrink:0;margin-top:10px;font-size:26px;color:${C.muted}">${esc(owner)}</span>
    ${r.l ? `<span style="flex-shrink:0;margin-top:18px;font-size:${cs.length ? 31 : 36}px;line-height:1.28;color:#dcdcdc">${esc(r.l)}</span>` : ""}
    <div style="display:flex;flex-shrink:0;margin-top:20px">${stats(r, 26)}</div>
    <div style="display:flex;flex-shrink:0;gap:12px;margin-top:auto;padding-top:22px;border-top:2px solid ${C.line}">${signStats(cs, 148, 30)}</div>
    <div style="display:flex;flex-shrink:0;justify-content:space-between;align-items:center;margin-top:20px;font-size:22px;color:${C.muted}">
      <span style="width:470px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(footer)}</span>
      <div style="display:flex;align-items:center;gap:10px;font-weight:600;color:${C.soft}">${MARK(32)}<span>starwire</span></div>
    </div>
  </div>
</div>`
}

// the strip under a wide picture: chat apps shrink a card to about half size, so few things, drawn large
function showcase(r, owner, name, cs, footer, art) {
  const sub = [owner, footer].filter(Boolean).map((t, i) => `<span style="${i ? "flex-shrink:1;overflow:hidden;text-overflow:ellipsis" : "flex-shrink:0"}">${esc(t)}</span>`).join(`<span style="flex-shrink:0;color:#4a4a4a">/</span>`)
  const two = [...cs.filter((c) => c[0] !== "Commits, 12 wks"), ...cs.filter((c) => c[0] === "Commits, 12 wks")].slice(0, 2) // commits mean least to a passer-by
  return `<div style="display:flex;flex-direction:column;width:1200px;height:630px;background:${C.bg};color:${C.text};font-family:Geist">
  <div style="display:flex;width:1200px;height:390px;overflow:hidden;background:${art.kind === "readme" ? C.tileLight : C.panel}">
    <img src="${art.src}" width="1200" height="390" style="width:1200px;height:390px;${art.kind === "og" ? "object-fit:cover;object-position:center top" : "object-fit:contain;padding:28px 40px 20px"}"/>
  </div>
  <div style="display:flex;box-sizing:border-box;width:1200px;flex-grow:1;align-items:center;gap:40px;padding:0 52px;border-top:2px solid ${C.line}">
    <div style="display:flex;flex-direction:column;flex-grow:1;flex-shrink:1;width:560px;gap:12px">
      <span style="font-size:${nameSize(name, 70)}px;line-height:1.05;font-weight:800;letter-spacing:-2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(name)}</span>
      ${stats({ ...r, g: null, li: null }, 32)}
      <div style="display:flex;gap:14px;font-size:26px;color:${C.muted};white-space:nowrap;overflow:hidden">${sub}</div>
    </div>
    <div style="display:flex;flex-shrink:0;gap:48px">${signStats(two, null, 40)}</div>
  </div>
</div>`
}
