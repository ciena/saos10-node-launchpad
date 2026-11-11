import { test } from "node:test";
import assert from "node:assert/strict";
import { checkRelease, releaseNotes } from "./changelog.js";

const ready = `# Changelog

## [Unreleased]

## [1.1.0] - 2026-10-20

### Added
- Something.

## [1.0.0] - 2026-10-05

### Added
- Initial.
`;

test("a PR that bumped the version, dated the release and emptied [Unreleased] is release-ready", () => {
  assert.deepEqual(checkRelease(ready, "1.1.0", "1.0.0"), []);
  assert.equal(releaseNotes(ready, "1.1.0"), "### Added\n- Something.");
  assert.equal(releaseNotes(ready, "2.0.0"), null);
});

test("an unchanged or lower version is rejected", () => {
  assert.match(checkRelease(ready.replace("1.1.0", "1.0.0").replace("## [1.0.0] - 2026-10-05", "## [0.9.0] - 2026-10-05"), "1.0.0", "1.0.0").join(), /must be above 1\.0\.0/);
  assert.match(checkRelease(ready, "1.1.0", "1.2.0").join(), /must be above 1\.2\.0/);
});

test("lines left under [Unreleased] are rejected", () => {
  const text = ready.replace("## [Unreleased]\n", "## [Unreleased]\n\n### Fixed\n- Forgot to promote this.\n");
  assert.match(checkRelease(text, "1.1.0", "1.0.0").join(), /\[Unreleased\] must be empty at merge/);
});

test("package.json and the top changelog release must agree (checkChangelog errors come first)", () => {
  assert.match(checkRelease(ready, "1.2.0", "1.0.0").join(), /does not match the top changelog release 1\.1\.0/);
});
