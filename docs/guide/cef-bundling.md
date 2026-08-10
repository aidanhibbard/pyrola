# CEF Bundling

Optional Chromium Embedded Framework (CEF) support is gated behind the Rust
cargo feature `cef` (crates `cef` / `cef-dll-sys` v151). Default builds stay
CEF-free.

## Dev (macOS)

```bash
export CEF_PATH="$HOME/.local/share/cef"
export DYLD_FALLBACK_LIBRARY_PATH="$DYLD_FALLBACK_LIBRARY_PATH:$CEF_PATH:$CEF_PATH/Chromium Embedded Framework.framework/Libraries"

# One-time (or after upgrading the cef crate):
cargo install export-cef-dir --locked
export-cef-dir --force "$CEF_PATH"

cd src-tauri
cargo build --features cef
# Helper must sit next to the main binary (cargo places both under target/):
# target/debug/pyrola_cef_helper
```

Runtime resolution order:

1. `CEF_PATH`
2. Bundled app locations (`Contents/Frameworks` on macOS; Tauri resource dir
   or beside the exe on Windows / Linux)
3. `~/.local/share/cef` (or `%USERPROFILE%\.local\share\cef` on Windows)

## Bundle a CEF-enabled app

Default `tauri.conf.json` does **not** embed CEF (keeps non-CEF CI green).
Use a platform overlay after staging:

```bash
# macOS / Linux
chmod +x scripts/prepare-cef-bundle.sh
./scripts/prepare-cef-bundle.sh
npm run tauri build -- --features cef --config src-tauri/tauri.cef.macos.conf.json
# Linux: src-tauri/tauri.cef.linux.conf.json
```

```powershell
# Windows
.\scripts\prepare-cef-bundle.ps1
npm run tauri build -- --features cef --config src-tauri/tauri.cef.windows.conf.json
```

`prepare-cef-bundle` copies CEF into `src-tauri/cef-runtime/` (gitignored) and
stages `src-tauri/binaries/pyrola_cef_helper-<triple>` for
`bundle.externalBin`.

### Layout

| Platform | Bundle placement | Runtime lookup |
| --- | --- | --- |
| macOS | `Contents/Frameworks/Chromium Embedded Framework.framework` via `bundle.macOS.frameworks`; helper in `Contents/MacOS/` via `externalBin` | Relative to exe: `../Frameworks/...` |
| Windows | CEF DLLs / resources via `bundle.resources` (beside the exe / resource dir); helper via `externalBin` | `resource_dir` or exe dir (`libcef.dll`) |
| Linux | `.so` + locales via `bundle.resources`; helper via `externalBin` | `resource_dir` or exe dir (`libcef.so`) |

## macOS signing and notarization

CEF requires nested code signing:

1. Sign `Chromium Embedded Framework.framework` as a **single** framework
   bundle (do not individually re-sign inner dylibs with entitlements; that
   corrupts the framework `CodeResources` manifest). Prefer `ditto` when
   copying so symlinks stay intact.
2. Sign `pyrola_cef_helper` (and the main app) with Hardened Runtime.
3. Entitlements for CEF/V8 live in `src-tauri/Entitlements.cef.plist`
   (`allow-jit`, `allow-unsigned-executable-memory`,
   `disable-library-validation`). Wired only through the CEF overlay configs.
4. Notarize the outer `.app` / `.dmg` as usual.

Tauri signs nested frameworks listed under `bundle.macOS.frameworks` and
sidecars under `externalBin` when `APPLE_SIGNING_IDENTITY` (and related
secrets) are set. Release CI passes:

- `APPLE_CERTIFICATE` / `APPLE_CERTIFICATE_PASSWORD`
- `APPLE_SIGNING_IDENTITY`
- `APPLE_ID` / `APPLE_PASSWORD` / `APPLE_TEAM_ID`

Do not commit secrets. Local ad-hoc builds can omit notarization; Gatekeeper
will still complain for distribution without Developer ID + notarization.

## CI

`.github/workflows/ci.yml` keeps the default-feature jobs unchanged and adds a
`cef-build` matrix (`macos-latest`, `windows-latest`, `ubuntu-24.04`) that:

- Caches `~/.local/share/cef` (and the Windows equivalent) by OS + cef crate
  version
- Runs `cargo build --features cef --manifest-path src-tauri/Cargo.toml`

Release builds (`release.yml`) run `prepare-cef-bundle` and pass
`--features cef` plus the matching `tauri.cef.*.conf.json`.

## Spike validator

`cef-spike-validate` is gated behind `--features cef-spike` (implies `cef`) so
release/CEF CI builds with `--features cef` do not ship it in the app bundle.

## Related

- [cef-rs](https://github.com/tauri-apps/cef-rs) (`export-cef-dir`,
  `bundle-cef-app` reference utility)
- [macOS application bundle](https://v2.tauri.app/distribute/macos-application-bundle/)
- [Security posture](../security-posture.md) (browser automation controls)
- [Desktop shell](../architecture/desktop-shell.md#embedded-browser-view-stacking-macos)
  (macOS CEF-behind-webview stacking, CrAppProtocol, hit-test pass-through)
