// Owner avatars from GitHub's image CDN. The CDN answers reliably only by account number: asked by name it returns a
// blank placeholder for many organisations (anthropics, microsoft, kubernetes...). data.json carries each repo's owner
// number as oi; whoever loads the data calls knowOwners() once. An owner without a number falls back to its name.
// (github.com/<owner>.png would also work, but it is a no-cache redirect: every redraw of the grid went back to
// github.com for each card and got rate limited.)
const ids = new Map() // owner login, lowercase -> account number
export const knowOwners = (repos) => { for (const r of repos) if (r.oi) ids.set(r.r.split("/")[0].toLowerCase(), r.oi) }
export const avatar = (owner, size) => {
  const id = ids.get(String(owner).toLowerCase())
  return `https://avatars.githubusercontent.com/${id ? `u/${id}` : encodeURIComponent(owner)}?s=${size}`
}
