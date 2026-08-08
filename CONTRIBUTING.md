# Contributing to Pyrola

## Pull requests

1. Fork the repo (or use a branch if you have write access).
2. Open a PR against `main`.
3. Wait for CI to pass (`CI`, `Rust audit`, `Tauri build`).
4. Request review from a [CODEOWNERS](.github/CODEOWNERS) maintainer.

Direct pushes to `main` are blocked for everyone except maintainers with ruleset bypass.

## Local checks

```bash
npm ci
npm run ci
cargo audit --file src-tauri/Cargo.lock
```

## Scope

Keep PRs focused. Match existing code style and the conventions in `AGENTS.md`.
