// Usage counts, shared by every page, so the next feature rests on what people actually do: GoatCounter, no cookies, no personal data,
// skips localhost and does nothing at all under Do Not Track or Global Privacy Control. Counts the page load, searches
// (marked when nothing matched), the view or area picked, saves, repos opened in the panel and clicks through to
// GitHub; how.html#counts tells visitors the same.
// Paths are kind/detail (search/pdf editor, repo/owner/name) with the kind as the title, so typing "repo/" in
// GoatCounter's filter shows one kind at a time; GoatCounter has no event properties to group by. Events wait in a queue until the script has loaded.
const queued = []
const optOut = navigator.doNotTrack === "1" || navigator.globalPrivacyControl === true
export const count = (path, title = path) => optOut ? 0 : window.goatcounter?.count ? window.goatcounter.count({ path, title, event: true }) : queued.push([path, title])
if (!optOut) {
  const gc = Object.assign(document.createElement("script"), { async: true, src: "https://gc.zgo.at/count.js" })
  gc.dataset.goatcounter = "https://starwire.goatcounter.com/count"
  gc.dataset.goatcounterSettings = '{"no_onload":true}' // the URL can carry a saved list; count the bare page instead
  gc.onload = () => { window.goatcounter.count?.({ path: location.pathname }); queued.splice(0).forEach(([p, t]) => count(p, t)) }
  document.head.append(gc)
}
document.addEventListener("click", (e) => { const a = e.target.closest('a[href^="https://github.com/"]'); if (a) count(`github/${new URL(a.href).pathname.split("/").slice(1, 3).join("/")}`, "Opened on GitHub") })
