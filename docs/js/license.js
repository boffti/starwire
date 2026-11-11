// What a repo's license lets you do, in four plain kinds. `li` is GitHub's id for the license file: an SPDX id,
// "Other" when there is a license file GitHub can't match to a known one, or null when there is no license file.
// The kinds state what was found, not a verdict: a custom license can turn out to be fully open, so read it.
// Run `node docs/js/license.js` to check the rules.

// ids that publish the source but limit use, changes or selling (not open source by the OSI's definition)
const LIMITED = /^(BUSL|SSPL|Elastic|PolyForm|FSL|Parity)|-NC\b|-ND\b|Commons-Clause/i

export const LICENSE_KINDS = [["open", "Open source"], ["limited", "Source available"], ["custom", "Custom license"], ["none", "No license"]]
export const licenseKind = (li) => (!li ? "none" : li === "Other" ? "custom" : LIMITED.test(li) ? "limited" : "open")
export const licenseText = (li) => (!li ? "None listed" : li === "Other" ? "Custom license" : li)

if (typeof process !== "undefined" && import.meta.url === `file://${process.argv[1]}`) {
  const { strict: assert } = await import("node:assert")
  assert.deepEqual(["MIT", "AGPL-3.0", "CC0-1.0", "CC-BY-SA-4.0", "MPL-2.0"].map(licenseKind), Array(5).fill("open"))
  assert.deepEqual(["BUSL-1.1", "SSPL-1.0", "Elastic-2.0", "CC-BY-NC-ND-3.0", "CC-BY-NC-4.0", "CC-BY-ND-4.0", "PolyForm-Noncommercial-1.0.0"].map(licenseKind), Array(7).fill("limited"))
  assert.deepEqual([licenseKind("Other"), licenseKind(null), licenseKind(undefined)], ["custom", "none", "none"])
  assert.deepEqual([licenseText("MIT"), licenseText("Other"), licenseText(null)], ["MIT", "Custom license", "None listed"])
  console.log("license rules ok")
}
