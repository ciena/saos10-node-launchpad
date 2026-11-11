# Contributing

Contributions should improve the public, customer-facing Launchpad without introducing internal-only information.

## Before opening a pull request

- Use a branch and open a PR against `main`; do not commit directly to `main`.
- Add a concise, public-safe entry to `CHANGELOG.md`, update `package.json` and `package-lock.json`, and leave `[Unreleased]` empty when cutting a release.
- Keep the top dated release version aligned with `package.json`. CI checks the changelog and release version.
- Run `npm run changelog:check`, `npm run changelog:release-check`, `npm run typecheck`, `npm test`, and `npm run package`.
- Review the complete diff, including screenshots and generated files. Do not add credentials, customer/device data, private addresses, internal URLs, lab reports, workbook exports, or unapproved third-party content.
- Keep the two approved shell-command examples only in their designated CLI Cheatsheet sections; use generic placeholders for all example values.

## Releases and Pages

Merging a versioned PR to `main` publishes the versioned standalone HTML and ZIP as a GitHub Release. Pages and PR previews require `PAGES_DEPLOY_ENABLED=true`; previews also require the repository Actions variable `PAGES_BASE_URL`. Set these variables only after the Pages site and its visibility are approved. Online config validation remains disabled unless the `TRANSLATOR_URL` Actions variable is set to an approved endpoint.

Do not publish until Ciena has confirmed the repository owner, visibility, content rights, branding, and project license.
