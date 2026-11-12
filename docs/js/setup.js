// Setup: how much know-how a project takes to get running, for readers who don't run servers. Five plain kinds on
// three levels, read from how the project is packaged (its form labels in data.json), easiest route first.
// It describes packaging and is not tested by us: nobody here installed 3,700 projects.
// One fact the labels can't give comes from the pipeline: ho, set when the project's makers also run a hosted version
// you sign up for ("f" it has a free plan, "p" paid only, "y" price not stated). That is the easy route for a project
// that would otherwise need a server. Judged from each project's README and website, for repos with an alternative.
// Run `node docs/js/setup.js` to check the rules.

// [id, label, level 1-3, what it means]
const KINDS = [
  ["app", "Install like an app", 1, "Download it and open it. No server, no terminal."],
  ["hosted", "Hosted version", 1, "Its makers run it for you: sign up on the project's site."],
  ["web", "Runs in a browser", 2, "Opens in a browser, but you may have to start it yourself."],
  ["cli", "Uses the terminal", 2, "Installed and run by typing commands."],
  ["server", "Needs a server", 3, "Someone technical sets it up on a server, usually with Docker."],
  ["code", "For developers", 3, "A building block for people who write code."],
]
export const SETUP_KINDS = KINDS.map(([id, label]) => [id, label])
const BY = new Map(KINDS.map(([id, label, level, text]) => [id, { id, label, level, text }]))

// what the hosted version costs, said on the label itself: a paid plan must never read as free
const PRICE = { f: ["Hosted, free plan", "It has a free plan."], p: ["Hosted, paid", "The hosted version is paid."], y: ["Hosted version", "Check its site for the price."] }
// fo: a repo's form labels; ho: its hosted-version fact. Returns { id, label, level, text }, or null without form labels.
export function setupOf(fo, ho) {
  const f = new Set(fo ?? [])
  const id = ["desktop-app", "mobile-app", "extension"].some((x) => f.has(x)) ? "app" : f.has("self-hosted") ? "server" : f.has("web-app") ? "web" : f.has("cli") ? "cli" : f.size ? "code" : null
  if (PRICE[ho] && (id === "server" || id === "web")) return { ...BY.get("hosted"), label: PRICE[ho][0], text: `${BY.get("hosted").text} ${PRICE[ho][1]} ${id === "server" ? "Running it yourself needs a server." : "You can also run it yourself."}` }
  return id && BY.get(id)
}
// the three-bar meter and label, used wherever a setup level is shown
export const setupMark = (s) => `<span class="su lv-${s.level}"><span class="su-bars" role="img" aria-label="Setup effort ${s.level} of 3"><i></i><i></i><i></i></span><b>${s.label}</b></span>`

if (typeof process !== "undefined" && import.meta.url === `file://${process.argv[1]}`) {
  const { strict: assert } = await import("node:assert")
  const id = (...fo) => setupOf(fo)?.id ?? null
  // the easiest route wins: an app you can download beats the server it can also run on
  assert.deepEqual([id("desktop-app"), id("mobile-app", "extension"), id("desktop-app", "self-hosted"), id("web-app", "desktop-app")], Array(4).fill("app"))
  assert.deepEqual([id("self-hosted", "web-app"), id("self-hosted", "cli"), id("library", "self-hosted")], Array(3).fill("server"))
  assert.deepEqual([id("web-app"), id("web-app", "library"), id("cli"), id("cli", "mcp-server"), id("library"), id("agent-skill"), id()], ["web", "web", "cli", "cli", "code", "code", null])
  // a hosted version is the easy route for a server or browser project, and says what it costs; an app stays an app
  assert.deepEqual([setupOf(["self-hosted"], "f").label, setupOf(["web-app"], "p").label, setupOf(["self-hosted"], "y").level, setupOf(["desktop-app", "self-hosted"], "f").id, setupOf(["cli"], "f").id, setupOf(["self-hosted"], "x").id],
    ["Hosted, free plan", "Hosted, paid", 1, "app", "cli", "server"])
  assert.ok(setupOf(["self-hosted"], "p").text.includes("paid") && setupOf(["self-hosted"], "p").text.includes("needs a server"))
  assert.deepEqual([setupOf(["desktop-app"]).level, setupOf(["cli"]).level, setupOf(["self-hosted"]).level], [1, 2, 3])
  console.log("setup rules ok")
}
