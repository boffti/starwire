// Ranked search over the catalog: field-weighted BM25 over lightly stemmed words, with prefix matching on the word
// being typed, one-typo tolerance on longer words and a short synonym list. Pure functions, so the pipeline's eval
// script (scripts/search-eval.mjs) scores it against a test set of queries.
// ponytail: plain scan of a few thousand repos per keystroke (a few ms); an inverted index only if the list grows 10x.

const WEIGHT = { name: 4, owner: 2, tags: 3, alt: 3, facets: 2, line: 1.5, lang: 1 }
const K1 = 1.2, B = 0.6
// words that say nothing about what a repo does here: everything is open source, and "X alternative" is answered by the alternatives field
const FILLER = new Set("a an the for to of in on with and or by vs alternative alternatives replacement replace like similar open source opensource oss free app apps tool tools best good".split(" "))
const ALT_INTENT = /\b(alternatives?|replacements?|replace|vs|like)\b/
// ponytail: a short hand list; grow it from the test set's misses, not from guesses
const SYN = { postgres: ["postgresql"], pg: ["postgresql"], k8s: ["kubernetes"], js: ["javascript"], ts: ["typescript"], py: ["python"], gui: ["desktop", "client", "ui"], db: ["database"], ml: ["machine-learning"], md: ["markdown"], cli: ["command-line", "terminal"], selfhosted: ["self-hosted"] }

// crude suffix stripping, the same on both sides so "editor", "editing" and "edits" all become "edit"
export const stem = (t) => {
  if (t.length < 5 || /[^a-z]/.test(t)) return t
  for (const s of ["ing", "ies", "es", "ed", "er", "or", "s"]) if (t.endsWith(s) && t.length - s.length >= 4 && !t.endsWith("ss")) return s === "ies" ? t.slice(0, -3) + "y" : t.slice(0, -s.length)
  return t
}

// text -> words. Keeps + # . - inside a word (c++, c#, node.js, self-hosted); `pieces` also adds the parts and the
// joined form, so a part of a hyphenated name or the name without hyphens both find it
export function tokens(s, pieces = true) {
  const out = []
  // camelCase names are indexed whole as well as split into their words
  const text = String(s ?? ""), camel = pieces ? (text.match(/\b[a-z0-9]+[A-Z][A-Za-z0-9]*\b/g) ?? []).map((w) => w.toLowerCase()) : []
  out.push(...camel)
  for (const w of text.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase().split(/[^a-z0-9+#.\-_]+/)) {
    const t = w.replace(/^[.\-_]+|[.\-_]+$/g, "")
    if (!t) continue
    out.push(t)
    if (pieces && /[.\-_]/.test(t)) out.push(...t.split(/[.\-_]+/).filter(Boolean), t.replace(/[.\-_]+/g, ""))
  }
  return out
}

// one insertion, deletion, substitution or swap of neighbours
function oneEdit(a, b) {
  if (Math.abs(a.length - b.length) > 1) return false
  let i = 0
  while (i < a.length && a[i] === b[i]) i++
  if (a.length === b.length) return a.slice(i + 1) === b.slice(i + 1) || (a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2))
  return a.length > b.length ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1)
}

// the text of each field for a repo, from data.json's short keys and its taxonomy (names for area, form, etc.)
export function fieldsFor(tx) {
  const area = new Map(tx.areas.map((a) => [a.id, a.name])), sub = new Map(tx.areas.flatMap((a) => a.subs.map(([id, n]) => [`${a.id}/${id}`, n])))
  const form = new Map(tx.forms), plat = new Map(tx.platforms), withs = new Map(tx.worksWith)
  return (r) => ({
    name: r.r.split("/")[1], owner: r.r.split("/")[0], line: r.l, lang: r.g ?? "",
    tags: [...(r.t ?? []), ...(r.tg ?? [])].join(" "), alt: (r.alt ?? []).join(" "),
    facets: [...(r.a ? [`${r.a}/${r.sa}`, ...(r.mo ?? [])] : []).map((p) => `${area.get(p.split("/")[0]) ?? ""} ${sub.get(p) ?? ""}`),
      ...(r.fo ?? []).map((x) => form.get(x)), ...(r.pl ?? []).map((x) => plat.get(x)), ...(r.ww ?? []).map((x) => withs.get(x))].join(" "),
  })
}

// repos + fields(r) -> search(query, pool?) -> Map(repo -> score), best first when sorted by score
export function makeIndex(repos, fields) {
  const raw = repos.map((r) => {
    const f = fields(r), tf = {}, len = {}
    for (const k in WEIGHT) {
      const m = (tf[k] = new Map()), ts = tokens(f[k]).map(stem)
      len[k] = ts.length
      for (const t of ts) m.set(t, (m.get(t) ?? 0) + 1)
    }
    return { r, tf, len, text: ` ${tokens(`${f.name} ${f.line} ${f.tags}`, false).join(" ")} `, hay: `${r.r} ${f.line} ${f.tags}`.toLowerCase() }
  })
  const avg = Object.fromEntries(Object.keys(WEIGHT).map((k) => [k, raw.reduce((s, d) => s + d.len[k], 0) / raw.length || 1]))
  // per repo: word -> [BM25 weight outside the alternatives field, weight inside it], so a query only walks the
  // repo's own few dozen words instead of every index word a prefix expands to
  const docs = raw.map(({ r, tf, len, text, hay }) => {
    const terms = new Map()
    for (const k in WEIGHT) for (const [t, n] of tf[k]) {
      const v = terms.get(t) ?? [0, 0], s = (WEIGHT[k] * n * (K1 + 1)) / (n + K1 * (1 - B + (B * len[k]) / avg[k]))
      v[k === "alt" ? 1 : 0] += s
      terms.set(t, v)
    }
    return { r, terms, text, hay }
  })
  const df = new Map()
  for (const d of docs) for (const t of d.terms.keys()) df.set(t, (df.get(t) ?? 0) + 1)
  const vocab = [...df.keys()]
  const idf = (t) => Math.log(1 + (docs.length - df.get(t) + 0.5) / (df.get(t) + 0.5))

  // a query word -> the index words it may match, each with idf x a discount for synonyms, prefixes and typos
  const expand = (raw, last) => {
    const w = stem(raw), m = new Map()
    const add = (t, v) => df.has(t) && m.set(t, Math.max(m.get(t) ?? 0, v))
    add(w, 1); add(raw, 1)
    for (const x of SYN[raw] ?? []) add(stem(x), 0.9)
    const exact = m.size > 0
    for (const v of vocab) {
      if (m.has(v)) continue
      if (!SYN[raw] && (last ? raw.length >= 2 : raw.length >= 4) && v.startsWith(raw)) m.set(v, raw.length < 4 ? 0.3 : last ? 0.7 : 0.5)
      // a typo only counts when the word itself isn't in the index
      else if (!exact && raw.length >= 5 && v.length >= 4 && oneEdit(w, v)) m.set(v, 0.4)
    }
    for (const [t, v] of m) m.set(t, v * idf(t))
    return m
  }

  function run(ex, allow, miss, altBoost, phrase) {
    const out = new Map()
    for (const d of docs) {
      if (allow && !allow.has(d.r)) continue
      let total = 0, missed = 0
      for (const m of ex) {
        let best = 0
        for (const [t, [s, alt]] of d.terms) {
          const g = m.get(t)
          if (g) best = Math.max(best, (s + alt * altBoost) * g)
        }
        if (!best && ++missed > miss) { total = 0; break }
        total += best
      }
      if (!total) continue
      if (phrase && d.text.includes(phrase)) total *= 1.5 // the words side by side, as typed
      // popularity only breaks near-ties: a tenfold star count is worth about 25% more
      out.set(d.r, total * (1 + 0.25 * Math.log10(1 + (d.r.s ?? 0))) * (1 + 0.05 * Math.min(d.r.k ?? 0, 5)))
    }
    return out
  }

  // last resort, the old site's behaviour: every typed word appears somewhere inside the name, line or tags
  function substring(q, allow) {
    const w = q.toLowerCase().split(/\s+/).filter(Boolean), out = new Map()
    for (const d of docs) if ((!allow || allow.has(d.r)) && w.every((x) => d.hay.includes(x))) out.set(d.r, 1 + Math.log10(1 + (d.r.s ?? 0)))
    return out
  }

  // every word must match somewhere; when that leaves under 5 repos, repos missing one word come back below them
  return function search(q, pool) {
    const all = [...new Set(tokens(q, false))], kept = all.filter((w) => !FILLER.has(w))
    const words = kept.length ? kept : all
    if (!words.length) return null
    const typing = !/\s$/.test(q)
    const ex = words.map((w) => expand(w, typing && w === all.at(-1)))
    const allow = pool ? new Set(pool) : null, altBoost = ALT_INTENT.test(q.toLowerCase()) ? 4 : 1
    const phrase = words.length > 1 ? ` ${words.join(" ")} ` : ""
    const strict = run(ex, allow, 0, altBoost, phrase)
    if (!strict.size && ex.length < 2) return substring(q, allow)
    if (strict.size >= 5 || ex.length < 2) return strict
    // partial matches go below every full one, keeping their own order
    const part = run(ex, allow, 1, altBoost, phrase), top = Math.max(0, ...[...part].filter(([r]) => !strict.has(r)).map((x) => x[1]))
    const cut = strict.size ? Math.min(...strict.values()) * 0.9 : top
    for (const [r, v] of part) if (!strict.has(r)) strict.set(r, (v / (top || 1)) * cut)
    return strict
  }
}
