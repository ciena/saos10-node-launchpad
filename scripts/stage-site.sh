#!/usr/bin/env sh
# Stage the static site (what GitHub Pages serves) into $1 (default: site/).
# Used by .github/workflows/pages.yml (main -> gh-pages root) and
# .github/workflows/pr-preview.yml (PR -> gh-pages/pr-preview/pr-N/), so both
# publish the identical tree. VITE_BASE=./ makes every asset path relative, so the
# same build works at / and under a subpath. Needs `npm ci` first.
set -eu
out="${1:-site}"
VITE_BASE=./ npx vite build --outDir "$out" --emptyOutDir
# Legacy Pages runs Jekyll unless this file exists; Jekyll would drop _/.-prefixed paths.
: > "$out/.nojekyll"
echo "staged $(find "$out" -type f | wc -l) files into $out/"
