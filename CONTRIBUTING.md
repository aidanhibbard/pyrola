# Contributing to pyrola

Thank you for your interest in contributing! This document explains how to get
involved. By participating, you agree to abide by our
[Code of Conduct](./CODE_OF_CONDUCT.md).

## Where GitHub looks for these files

GitHub's [community profile](https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions/about-community-profiles-for-public-repositories)
checks the **repository root** for:

| File | Purpose |
| --- | --- |
| `CONTRIBUTING.md` | How to contribute (this file) |
| `CODE_OF_CONDUCT.md` | Community standards |

Optional but recommended in `.github/`: issue templates, pull request template,
and `SECURITY.md` for security reports.

## Ways to contribute

- **Bug reports**: open an issue with reproduction steps, OS, and relevant provider/MCP setup.
- **Feature requests**: open an issue describing the use case before large PRs.
- **Documentation**: fixes and clarifications in `README.md` and `docs/`.
- **Code**: bug fixes, tests, and features via pull request.

## Development setup

Requirements: **Node.js** matching `.nvmrc` (CI uses Node 26.x), **npm**, and a Rust toolchain for the Tauri shell.

```bash
git clone https://github.com/aidanhibbard/pyrola.git
cd pyrola
npm ci
```

### App

```bash
# Vite frontend
npm run dev

# Tauri desktop shell
npm run tauri dev
```

### Quality checks

Run these before opening a PR:

```bash
npm run ci              # lint, type-check, npm audit, build
npm run audit:rust      # cargo audit on src-tauri/Cargo.lock
npm run test:unit       # Vitest (when touching covered code)
```

CI also runs a Tauri build job. Match existing style and the conventions in `AGENTS.md`.

### Docs site

```bash
npm run vp:dev
npm run vp:build
```

## Pull request process

1. Fork the repo and create a branch from `main`.
2. Make focused changes; avoid unrelated drive-by edits.
3. Add or update tests when changing harness, tools, or other covered behaviour.
4. Update `docs/` or `README.md` when behaviour or public surfaces change.
5. Ensure `npm run ci` passes (and Rust audit when you touch `src-tauri`).
6. Open a PR against `main` and fill out the [PR template](.github/pull_request_template.md).
7. Wait for required checks (`CI`, `Rust audit`, `Tauri build`) and a [CODEOWNERS](.github/CODEOWNERS) review.

Direct pushes to `main` are blocked for everyone except maintainers with ruleset bypass.

Breaking changes should be called out in the PR description.

## Project layout

| Path | Description |
| --- | --- |
| `src/` | Vue app (views, components, composables, services) |
| `src/services/harness/` | Agent harness and tool loop |
| `src-tauri/` | Tauri / Rust shell |
| `src/prompts/` | System and tool guidance prompts |
| `docs/` | VitePress documentation |
| `media/` | README screenshots and assets |

## Commit messages

Use clear, imperative subject lines (e.g. `fix: clear MCP trust on fingerprint change`).
Conventional prefixes (`feat:`, `fix:`, `docs:`, `chore:`) are welcome but not
required.

## Releases

Maintainers handle releases. Contributors do not need to publish builds.

## Questions

Open a GitHub issue. For conduct concerns, see
[CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md).
