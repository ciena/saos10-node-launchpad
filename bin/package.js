#!/usr/bin/env node
/* Release packaging (no dependencies):
 *
 *   node bin/package.js [site-dir] [out-dir]      default: site release
 *
 * Turns the tree scripts/stage-site.sh stages (a `VITE_BASE=./` build) into the two shareable release assets:
 *   release/saos10-node-launchpad-v<version>.html   one self-contained file (JS, CSS and images inlined) that
 *                                              opens from disk by double-clicking — no web server needed
 *   release/saos10-node-launchpad-v<version>.zip    the staged site as-is, for hosting on any static web server
 * `npm run package` stages the site and then runs this script; release.yml attaches both to the GitHub Release. */
import { readFileSync, writeFileSync, copyFileSync, readdirSync, mkdirSync, rmSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";

const MIME = { ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp", ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf", ".otf": "font/otf" };
const ext = f => f.slice(f.lastIndexOf("."));

/** Inline every `./assets/<name>` reference of a relative-base Vite build into its index.html.
 *  `assets` maps file name -> Buffer. Throws when a reference is left unresolved or a file is unexpected. */
export function inlineHtml(html, assets) {
  for (const [name, buf] of Object.entries(assets)) {
    const ref = `./assets/${name}`, e = ext(name);
    if (e === ".js") {
      const js = buf.toString("utf8");
      if (js.includes("</script")) throw new Error(`${name} contains '</script' and cannot be inlined`);
      html = html.replace(new RegExp(`<script type="module"[^>]*\\ssrc="${ref.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}"[^>]*></script>`), () => `<script type="module">\n${js}\n</script>`);
    } else if (e === ".css") {
      const css = buf.toString("utf8");
      if (css.includes("</style")) throw new Error(`${name} contains '</style' and cannot be inlined`);
      html = html.replace(new RegExp(`<link rel="stylesheet"[^>]*\\shref="${ref.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}"[^>]*>`), () => `<style>\n${css}\n</style>`);
    } else if (MIME[e]) {
      html = html.split(ref).join(`data:${MIME[e]};base64,${buf.toString("base64")}`);
    } else throw new Error(`don't know how to inline ${name}`);
    if (html.includes(ref)) throw new Error(`${ref} is still referenced after inlining`);
  }
  const left = html.match(/\.\/assets\/[^"' )]+/);
  if (left) throw new Error(`unresolved asset reference ${left[0]} (not in the site's assets/)`);
  return html;
}

export function main(argv = process.argv.slice(2)) {
  const dist = resolve(argv[0] || "site"), out = resolve(argv[1] || "release");
  const version = JSON.parse(readFileSync("package.json", "utf8")).version;
  const index = readFileSync(join(dist, "index.html"), "utf8");
  if (!index.includes('"./assets/')) throw new Error(`${dist}/index.html was not built with VITE_BASE=./ (run 'npm run package')`);
  const assets = Object.fromEntries(readdirSync(join(dist, "assets")).map(f => [f, readFileSync(join(dist, "assets", f))]));
  const base = `saos10-node-launchpad-v${version}`;
  mkdirSync(out, { recursive: true });
  const html = join(out, `${base}.html`), zip = join(out, `${base}.zip`);
  writeFileSync(html, inlineHtml(index, assets));
  // Publish the exact preview build's offline download, before a GitHub Release exists.
  copyFileSync(html, join(dist, `${base}.html`));
  rmSync(zip, { force: true });
  execFileSync("zip", ["-qr", "-X", zip, "."], { cwd: dist, stdio: "inherit" });
  for (const f of [html, zip]) console.log(`${f}  ${(statSync(f).size / 1024).toFixed(0)} KB`);
  return 0;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) process.exit(main());
