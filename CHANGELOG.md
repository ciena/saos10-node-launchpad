# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.0.4] - 2026-11-19

### Added

- Accept VLAN ranges and comma-separated lists in the EVC Builder. Consolidate consecutive IDs into range classifiers and show supported input examples.
- Add a theme-aware GitHub button that links to the public project and a "Download standalone HTML" tooltip on the Download HTML button.

## [1.0.3] - 2026-11-16

### Changed

- Replaced the CLI Cheatsheet suggestion download with an Add tip to GitHub button that opens a prefilled issue in the public repository for review.

## [1.0.2] - 2026-11-15

### Added

- Added the Apache License 2.0 as the project license.

## [1.0.1] - 2026-11-15

### Changed

- Organized the CLI Cheatsheet by topic, with command-only copy controls and clearer prose.
- Updated guide formatting and made NTP and manual timing selections mutually exclusive.
- Hardened build, preview, and release workflows while retaining opt-in publication.

### Fixed

- Corrected guide examples, descriptions, and placeholder handling while preserving public-safe guidance.

## [1.0.0] - 2026-11-11

### Added

- Added guided initial login, Golden Configs, SAOS Fundamentals, CLI reference, and configuration builders for Ethernet services, IP interfaces, and SAT.
- Added packet-walk and configuration visualizations, including browser-local settings and cheatsheet entries.

### Changed

- Started a fresh public release history for the v1.0.0 launch.
- Reworked public examples to use placeholders rather than environment-specific addresses or credentials.
- Made remote configuration validation opt-in through an Actions variable; it is disabled by default.
- Made Pages deployments and previews opt-in until site visibility is approved.

### Fixed

- Improved cross-browser rendering by using ASCII-safe punctuation in user-facing content and diagrams.
