#!/usr/bin/env bash
# Stage CEF binaries for Tauri bundling (macOS / Linux).
# Requires CEF_PATH (or ~/.local/share/cef from export-cef-dir).
# Also builds and stages pyrola_cef_helper for bundle.externalBin.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC_TAURI="$ROOT/src-tauri"
CEF_PATH="${CEF_PATH:-${HOME}/.local/share/cef}"
DEST="$SRC_TAURI/cef-runtime"
BINARIES="$SRC_TAURI/binaries"
PROFILE="${CEF_BUNDLE_PROFILE:-release}"

if [[ ! -d "$CEF_PATH" ]]; then
  echo "CEF_PATH not found: $CEF_PATH" >&2
  echo "Install with: cargo install export-cef-dir && export-cef-dir --force \"\$HOME/.local/share/cef\"" >&2
  exit 1
fi

rm -rf "$DEST"
mkdir -p "$DEST" "$BINARIES"

OS="$(uname -s)"
case "$OS" in
  Darwin)
    FRAMEWORK="$CEF_PATH/Chromium Embedded Framework.framework"
    if [[ ! -d "$FRAMEWORK" ]]; then
      echo "Missing framework at $FRAMEWORK" >&2
      exit 1
    fi
    # ditto preserves symlinks (required for codesign of nested frameworks)
    ditto "$FRAMEWORK" "$DEST/Chromium Embedded Framework.framework"
    ;;
  Linux)
    # Flat CEF layout: shared libs + locales + pak/dat next to the binary.
    if command -v rsync >/dev/null 2>&1; then
      rsync -a \
        --exclude='include' \
        --exclude='cmake' \
        --exclude='libcef_dll' \
        --exclude='CMakeLists.txt' \
        --exclude='*.a' \
        "$CEF_PATH/" "$DEST/"
    else
      cp -a "$CEF_PATH"/. "$DEST/"
      rm -rf "$DEST/include" "$DEST/cmake" "$DEST/libcef_dll" "$DEST/CMakeLists.txt"
    fi
    ;;
  *)
    echo "Unsupported OS for this script: $OS (use scripts/prepare-cef-bundle.ps1 on Windows)" >&2
    exit 1
    ;;
esac

TARGET_TRIPLE="${CARGO_BUILD_TARGET:-$(rustc -vV | awk '/^host:/{print $2}')}"
FEATURES=(--features cef --bin pyrola_cef_helper --manifest-path "$SRC_TAURI/Cargo.toml")
BUILD_ARGS=()
if [[ -n "${CARGO_BUILD_TARGET:-}" ]]; then
  BUILD_ARGS+=(--target "$CARGO_BUILD_TARGET")
fi
BUILD_ARGS+=("${FEATURES[@]}")
if [[ "$PROFILE" == "release" ]]; then
  cargo build --release "${BUILD_ARGS[@]}"
  if [[ -n "${CARGO_BUILD_TARGET:-}" ]]; then
    HELPER_SRC="$SRC_TAURI/target/${CARGO_BUILD_TARGET}/release/pyrola_cef_helper"
  else
    HELPER_SRC="$SRC_TAURI/target/release/pyrola_cef_helper"
  fi
else
  cargo build "${BUILD_ARGS[@]}"
  if [[ -n "${CARGO_BUILD_TARGET:-}" ]]; then
    HELPER_SRC="$SRC_TAURI/target/${CARGO_BUILD_TARGET}/debug/pyrola_cef_helper"
  else
    HELPER_SRC="$SRC_TAURI/target/debug/pyrola_cef_helper"
  fi
fi

if [[ ! -f "$HELPER_SRC" ]]; then
  echo "Helper binary missing at $HELPER_SRC" >&2
  exit 1
fi

cp "$HELPER_SRC" "$BINARIES/pyrola_cef_helper-${TARGET_TRIPLE}"
chmod +x "$BINARIES/pyrola_cef_helper-${TARGET_TRIPLE}"

echo "Staged CEF runtime at $DEST"
echo "Staged helper as $BINARIES/pyrola_cef_helper-${TARGET_TRIPLE}"
echo "Use: npm run tauri build -- --features cef --config src-tauri/tauri.cef.macos.conf.json"
# (Linux / Windows overlays: src-tauri/tauri.cef.linux.conf.json / tauri.cef.windows.conf.json)
