// Setup: how much know-how a project takes to get running, for readers who don't run servers. Five plain kinds on
// three levels, read from how the project is packaged (its form labels in data.json), easiest route first.
// It describes packaging and is not tested by us: nobody here installed 3,700 projects.
// ponytail: labels only. Whether a self-hosted project also sells a hosted version isn't in the data; that needs the
// pipeline to read each README, and would move some "Needs a server" projects to the easy end.
// Run `node docs/js/setup.js` to check the rules.

// [id, label, level 1-3, what it means]
const KINDS = [
  ["app", "Install like an app", 1, "Download it and open it. No server, no terminal."],
  ["web", "Runs in a browser", 2, "Opens in a browser, but you may have to start it yourself."],
  ["cli", "Uses the terminal", 2, "Installed and run by typing commands."],
  ["server", "Needs a server", 3, "Someone technical sets it up on a server, usually with Docker."],
  ["code", "For developers", 3, "A building block for people who write code."],
]
export const SETUP_KINDS = KINDS.map(([id, label]) => [id, label])
const BY = new Map(KINDS.map(([id, label, level, text]) => [id, { id, label, level, text }]))

// fo: a repo's form labels. Returns { id, label, level, text }, or null when the repo has no form labels.
export function setupOf(fo) {
  const f = new Set(fo ?? [])
  const id = ["desktop-app", "mobile-app", "extension"].some((x) => f.has(x)) ? "app" : f.has("self-hosted") ? "server" : f.has("web-app") ? "web" : f.has("cli") ? "cli" : f.size ? "code" : null
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
  assert.deepEqual([setupOf(["desktop-app"]).level, setupOf(["cli"]).level, setupOf(["self-hosted"]).level], [1, 2, 3])
  console.log("setup rules ok")
}
