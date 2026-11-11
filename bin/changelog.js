#!/usr/bin/env node
/* Changelog tooling (no dependencies):
 *
 *   node bin/changelog.js check                 package.json version == top release of CHANGELOG.md, headings well-formed
 *   node bin/changelog.js unreleased            print the [Unreleased] section body
 *   node bin/changelog.js pr-body [base-ref]    print a PR description: the changelog lines this branch adds vs base (default origin/main)
 *   node bin/changelog.js notes [x.y.z]         print the body of that release's section (default: package.json's version) — the GitHub Release notes
 *   node bin/changelog.js release-check [base]  every PR cuts a release: package.json's version must be above base's (default origin/main),
 *                                              be the top dated release of CHANGELOG.md, and leave [Unreleased] empty
 *
 * `check` runs in CI on every push and PR; `pr-body` is what the PR workflow writes into the PR
 * description, so the reviewer and the merge commit see exactly what the changelog says; `notes` is what release.yml
 * puts in the GitHub Release. */
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const HEADING = /^## \[([^\]]+)\](?:\s+-\s+(\d{4}-\d{2}-\d{2}))?\s*$/;
const SEMVER = /^\d+\.\d+\.\d+$/;

/** Parse the changelog into [{name, date, line, body}] in file order. */
export function parseChangelog(text) {
  const lines = text.split("\n"), sections = [];
  lines.forEach((l, i) => { const m = l.match(HEADING); if (m) sections.push({ name: m[1], date: m[2] || null, line: i + 1, start: i + 1 }); });
  sections.forEach((s, k) => { s.body = lines.slice(s.start, k + 1 < sections.length ? sections[k + 1].line - 1 : lines.length).join("\n").replace(/^\n+|\n+$/g, ""); });
  return sections;
}

const cmp = (a, b) => { const x = a.split(".").map(Number), y = b.split(".").map(Number); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i]; return 0; };

/** Problems with a changelog + package version pair; [] when everything agrees. */
export function checkChangelog(text, packageVersion) {
  const errors = [], secs = parseChangelog(text);
  if (!secs.length) return ["CHANGELOG.md has no '## [..]' headings"];
  if (secs[0].name !== "Unreleased") errors.push(`the first heading must be '## [Unreleased]' (found '## [${secs[0].name}]' at line ${secs[0].line})`);
  const releases = secs.filter(s => s.name !== "Unreleased");
  if (!releases.length) { errors.push("no release heading '## [x.y.z] - YYYY-MM-DD' found"); return errors; }
  releases.forEach(r => {
    if (!SEMVER.test(r.name)) errors.push(`line ${r.line}: release '${r.name}' is not x.y.z`);
    if (!r.date) errors.push(`line ${r.line}: release ${r.name} has no ' - YYYY-MM-DD' date`);
    else if (Number.isNaN(Date.parse(r.date))) errors.push(`line ${r.line}: release ${r.name} has an invalid date ${r.date}`);
    if (!r.body) errors.push(`line ${r.line}: release ${r.name} is empty`);
  });
  for (let i = 1; i < releases.length; i++) if (SEMVER.test(releases[i - 1].name) && SEMVER.test(releases[i].name) && cmp(releases[i - 1].name, releases[i].name) <= 0) errors.push(`line ${releases[i].line}: ${releases[i].name} must be lower than ${releases[i - 1].name} above it`);
  if (!SEMVER.test(packageVersion || "")) errors.push(`package.json version '${packageVersion}' is not x.y.z`);
  else if (SEMVER.test(releases[0].name) && releases[0].name !== packageVersion) errors.push(`package.json version ${packageVersion} does not match the top changelog release ${releases[0].name} (line ${releases[0].line}); bump package.json or cut the release in CHANGELOG.md`);
  return errors;
}

/** The changelog lines a branch adds relative to `base` (added lines of the diff, without the '+'), as markdown. */
export function changelogDiff(base = "origin/main", cwd = process.cwd()) {
  const out = execFileSync("git", ["diff", `${base}...HEAD`, "--", "CHANGELOG.md"], { cwd, encoding: "utf8" });
  return out.split("\n").filter(l => l.startsWith("+") && !l.startsWith("+++")).map(l => l.slice(1)).join("\n").replace(/^\n+|\n+$/g, "");
}

/** A PR description from the changelog diff (or the [Unreleased] section when the diff is empty). */
export function prBody(text, base = "origin/main", cwd = process.cwd()) {
  const diff = changelogDiff(base, cwd);
  const body = diff || (parseChangelog(text).find(s => s.name === "Unreleased") || {}).body || "";
  return `## Changelog\n\n${body}\n`;
}

/** Problems with a PR that must cut a release: `version` (package.json on the branch) must be x.y.z and above
 *  `baseVersion` (package.json on the base branch), the changelog's top release must be `version` with a date,
 *  and [Unreleased] must be empty (its lines were promoted into the release). [] when the PR is release-ready. */
export function checkRelease(text, version, baseVersion) {
  const errors = checkChangelog(text, version);
  if (errors.length) return errors;
  const secs = parseChangelog(text), unreleased = secs.find(s => s.name === "Unreleased"), top = secs.find(s => s.name !== "Unreleased");
  if (!SEMVER.test(baseVersion || "")) errors.push(`base package.json version '${baseVersion}' is not x.y.z`);
  else if (cmp(version, baseVersion) <= 0) errors.push(`package.json version ${version} must be above ${baseVersion} on the base branch: every PR cuts a release, bump it (patch for fixes, minor for features)`);
  if (top.name !== version) errors.push(`the top changelog release is ${top.name}, not ${version}`);
  if (unreleased && unreleased.body) errors.push(`line ${unreleased.line}: [Unreleased] must be empty at merge; rename it to '## [${version}] - YYYY-MM-DD' and start a fresh empty [Unreleased] above it`);
  return errors;
}

/** The body of release `version`'s section, or null when the changelog has no such release. */
export function releaseNotes(text, version) {
  const s = parseChangelog(text).find(s => s.name === version);
  return s ? s.body : null;
}

export function main(argv = process.argv.slice(2)) {
  const cmd = argv[0] || "check";
  const text = readFileSync("CHANGELOG.md", "utf8");
  if (cmd === "check") {
    const version = JSON.parse(readFileSync("package.json", "utf8")).version;
    const errors = checkChangelog(text, version);
    for (const e of errors) console.error(`::error file=CHANGELOG.md::${e}`);
    if (!errors.length) console.log(`CHANGELOG.md release ${parseChangelog(text).find(s => s.name !== "Unreleased").name} matches package.json ${version}`);
    return errors.length ? 1 : 0;
  }
  if (cmd === "unreleased") { console.log((parseChangelog(text).find(s => s.name === "Unreleased") || {}).body || ""); return 0; }
  if (cmd === "pr-body") { process.stdout.write(prBody(text, argv[1] || "origin/main")); return 0; }
  if (cmd === "notes") {
    const version = argv[1] || JSON.parse(readFileSync("package.json", "utf8")).version, notes = releaseNotes(text, version);
    if (notes === null) { console.error(`CHANGELOG.md has no '## [${version}] - YYYY-MM-DD' section`); return 1; }
    console.log(notes); return 0;
  }
  if (cmd === "release-check") {
    const base = argv[1] || "origin/main", version = JSON.parse(readFileSync("package.json", "utf8")).version;
    let baseVersion = "";
    try { baseVersion = JSON.parse(execFileSync("git", ["show", `${base}:package.json`], { encoding: "utf8" })).version; }
    catch { console.error(`::error::cannot read package.json on ${base}`); return 1; }
    const errors = checkRelease(text, version, baseVersion);
    for (const e of errors) console.error(`::error file=CHANGELOG.md::${e}`);
    if (!errors.length) console.log(`release-ready: ${baseVersion} -> ${version}, CHANGELOG.md top release ${version}, [Unreleased] empty`);
    return errors.length ? 1 : 0;
  }
  console.error("usage: changelog.js check | unreleased | pr-body [base-ref] | notes [x.y.z] | release-check [base-ref]");
  return 2;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) process.exit(main());
