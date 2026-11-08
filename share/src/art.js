// Picks and loads the picture for a card, best first: the repo's own social preview, the first image in its README,
// then the owner's avatar. A source that's blocked, broken, not an image or over 4 MB falls through to the next one.
// Returns { kind, src (data URI), wide }; wide pictures get the showcase layout.
const MAX = 4 * 1024 * 1024

// width and height from the first bytes of a PNG, GIF, JPEG or WebP, or from an SVG's attributes
export function imageSize(bytes, type) {
  const b = new Uint8Array(bytes), dv = new DataView(b.buffer, b.byteOffset, b.byteLength)
  if (type.includes("svg")) {
    const head = new TextDecoder().decode(b.slice(0, 4000)), tag = head.match(/<svg[^>]*>/i)?.[0] ?? ""
    const n = (k) => parseFloat(tag.match(new RegExp(`\\s${k}=["']?([\\d.]+)(px)?["'\\s>]`, "i"))?.[1])
    const vb = tag.match(/viewBox=["']\s*[\d.-]+[\s,]+[\d.-]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i)
    const w = n("width") || +vb?.[1], h = n("height") || +vb?.[2]
    return w && h ? { w, h } : null
  }
  if (b[0] === 0x89 && b[1] === 0x50) return { w: dv.getUint32(16), h: dv.getUint32(20) }
  if (b[0] === 0x47 && b[1] === 0x49) return { w: dv.getUint16(6, true), h: dv.getUint16(8, true) }
  if (b[0] === 0x52 && b[8] === 0x57) { // RIFF....WEBP
    const kind = String.fromCharCode(b[12], b[13], b[14], b[15])
    if (kind === "VP8X") return { w: 1 + (b[24] | (b[25] << 8) | (b[26] << 16)), h: 1 + (b[27] | (b[28] << 8) | (b[29] << 16)) }
    if (kind === "VP8L") { const v = dv.getUint32(21, true); return { w: 1 + (v & 0x3fff), h: 1 + ((v >> 14) & 0x3fff) } }
    if (kind === "VP8 ") return { w: dv.getUint16(26, true) & 0x3fff, h: dv.getUint16(28, true) & 0x3fff }
  }
  if (b[0] === 0xff && b[1] === 0xd8) {
    for (let i = 2; i < b.length - 9;) {
      if (b[i] !== 0xff) { i++; continue }
      const m = b[i + 1], len = dv.getUint16(i + 2)
      if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return { w: dv.getUint16(i + 7), h: dv.getUint16(i + 5) }
      i += 2 + len
    }
  }
  return null
}

const toDataUri = (bytes, type) => {
  let s = ""
  const b = new Uint8Array(bytes)
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000))
  return `data:${type};base64,${btoa(s)}`
}

async function load(url, fetchOpts) {
  try {
    const res = await fetch(url, { ...fetchOpts, headers: { "user-agent": "starwire-share (+https://starwire.foo)" } })
    const type = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase()
    if (!res.ok || !/^image\/(png|jpeg|gif|webp|svg\+xml)$/.test(type)) return null
    const bytes = await res.arrayBuffer()
    if (!bytes.byteLength || bytes.byteLength > MAX) return null
    const size = imageSize(bytes, type)
    if (!size) return null
    return { src: toDataUri(bytes, type), size }
  } catch { return null }
}

// art: [kind, url] from art.json, or undefined; fetchOpts lets the Worker ask Cloudflare to cache the source images
export async function pickArt(repo, art, fetchOpts = {}) {
  const owner = repo.split("/")[0]
  const tries = [...(art ? [art] : []), ["avatar", `https://avatars.githubusercontent.com/${encodeURIComponent(owner)}?s=400`]]
  for (const [kind, url] of tries) {
    const got = await load(url, fetchOpts)
    if (!got) continue
    const ratio = got.size.w / got.size.h
    // logos and icons too small to fill a tile would look blurry or lost; the avatar is always 400px
    if (kind === "readme" && Math.max(got.size.w, got.size.h) < 96) continue
    return { kind, src: got.src, wide: kind === "og" || (kind === "readme" && ratio >= 1.3) }
  }
  return null
}
