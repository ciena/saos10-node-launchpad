import { test } from "node:test";
import assert from "node:assert/strict";
import { inlineHtml, main } from "./package.js";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const html = `<html><head>
<link rel="icon" href="./assets/logo-abc.svg" type="image/svg+xml" />
<script type="module" crossorigin src="./assets/index-abc.js"></script>
<link rel="stylesheet" crossorigin href="./assets/index-abc.css">
</head><body></body></html>`;
const assets = { "index-abc.js": Buffer.from("console.log(1)"), "index-abc.css": Buffer.from("body{margin:0}"), "logo-abc.svg": Buffer.from("<svg/>") };

test("inlines script, stylesheet and images and leaves no ./assets/ reference", () => {
  const out = inlineHtml(html, assets);
  assert.match(out, /<script type="module">\nconsole\.log\(1\)\n<\/script>/);
  assert.match(out, /<style>\nbody\{margin:0\}\n<\/style>/);
  assert.match(out, /href="data:image\/svg\+xml;base64,PHN2Zy8\+"/);
  assert.doesNotMatch(out, /\.\/assets\//);
});

test("fails on a reference that has no asset, or an asset that cannot be inlined", () => {
  assert.throws(() => inlineHtml(html, { ...assets, "index-abc.js": undefined, }), /cannot be inlined|toString/);
  assert.throws(() => inlineHtml(html.replace("index-abc.css", "missing.css"), assets), /unresolved asset reference \.\/assets\/missing\.css/);
  assert.throws(() => inlineHtml(html, { ...assets, "data.bin": Buffer.alloc(1) }), /don't know how to inline data\.bin/);
  assert.throws(() => inlineHtml(html, { ...assets, "index-abc.js": Buffer.from("a='</script>'") }), /contains '<\/script'/);
});

test("publishes the identical offline HTML in the site, Release assets and ZIP", () => {
  const dir = mkdtempSync(join(tmpdir(), "snl-package-"));
  try {
    const site = join(dir, "site"), out = join(dir, "release");
    mkdirSync(join(site, "assets"), { recursive: true });
    mkdirSync(out);
    writeFileSync(join(out, "saos10-node-launchpad-v0.0.1.html"), "previous HTML");
    writeFileSync(join(out, "saos10-node-launchpad-v0.0.1.zip"), "previous ZIP");
    writeFileSync(join(site, "index.html"), html);
    for (const [name, data] of Object.entries(assets)) writeFileSync(join(site, "assets", name), data);
    main([site, out]);
    const { version } = JSON.parse(readFileSync("package.json", "utf8"));
    const file = `saos10-node-launchpad-v${version}.html`;
    const expected = inlineHtml(html, assets);
    assert.equal(readFileSync(join(out, file), "utf8"), expected);
    assert.equal(readFileSync(join(site, file), "utf8"), expected);
    assert.equal(execFileSync("unzip", ["-p", join(out, `saos10-node-launchpad-v${version}.zip`), file], { encoding: "utf8" }), expected);
    assert.equal(readFileSync(join(out, "saos10-node-launchpad-v0.0.1.html"), "utf8"), "previous HTML");
    assert.equal(readFileSync(join(out, "saos10-node-launchpad-v0.0.1.zip"), "utf8"), "previous ZIP");
    writeFileSync(join(site, "stale.txt"), "remove before repackaging");
    main([site, out]);
    rmSync(join(site, "stale.txt"));
    main([site, out]);
    assert.ok(!execFileSync("unzip", ["-Z1", join(out, `saos10-node-launchpad-v${version}.zip`)], { encoding: "utf8" }).includes("stale.txt"));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
