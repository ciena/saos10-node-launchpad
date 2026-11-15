# SAOS10 Node Launchpad

SAOS10 Node Launchpad (SNL) is a browser-based quickstart guide and configuration assistant for Ciena SAOS 10 nodes. It includes initial-access guidance, reusable configuration examples, Ethernet service and IP interface builders, SAT configuration, a CLI cheatsheet, and visual explanations of packet flow.

The app generates configuration text; it does not connect to, configure, or control a device. Review all generated commands, platform assumptions, warnings, and service impact before use.

## Use the app

Open the deployed GitHub Pages site or download the standalone HTML from the repository's Releases page. The standalone file can be opened locally. Most functions work offline. Online Config Validator checks are disabled unless an approved service URL is provided through the build environment variable `VITE_TRANSLATOR_URL`; do not submit passwords, keys, or other sensitive configuration.

## Guides and tools

- **Initial login** and **Golden Configs** provide editable examples. Replace placeholders and review the result for your environment.
- **L2 EVC Builder** and **IP Interface Creator** generate configuration text and verification/removal commands.
- **SAT Benchmark** creates generator and reflector configurations.
- **CLI Cheatsheet** is searchable and lets each user add, export, and import browser-local notes.
- **SAOS Fundamentals** explains core SAOS objects and the packet path.

Browser preferences, drafts, and personal cheatsheet entries remain in the browser. Shared URLs can contain configuration inputs; share them only with intended recipients.

## Develop

Requires Node.js 22.

```bash
npm ci
npm run dev
npm run typecheck
npm test
npm run package
```

`npm run package` builds the Pages tree in `site/` and standalone HTML/ZIP assets in `release/`. The workflows run checks and publish versioned release assets. Pages deployment and PR previews are disabled unless the repository Actions variable `PAGES_DEPLOY_ENABLED` is set to `true` after the site visibility is approved.

PR previews require the repository Actions variable `PAGES_BASE_URL` to be set to the confirmed public Pages base URL. Do not copy an internal Pages hostname into that setting.

## Content, privacy, and licensing

Examples use placeholders for environment-specific values. Do not add credentials, customer configuration, private addresses, internal URLs, lab logs, hardware results, or internal workbook exports to this repository. Before sharing a generated configuration or cheatsheet export, remove any sensitive values.

The SAOS Fundamentals page adapts material from [ciena/saos-labs](https://github.com/ciena/saos-labs) under Apache-2.0; attribution is shown in the app and the license text is included with the source and standalone build. The bundled OpenDyslexic fonts retain their SIL Open Font License notice.

The project is licensed under Apache-2.0; see [LICENSE](https://github.com/ciena/saos10-node-launchpad/blob/main/LICENSE). Confirm Ciena's content and branding approvals before publishing.
