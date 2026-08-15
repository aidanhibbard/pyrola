#!/usr/bin/env bash
# Install linuxdeploy as a small ELF trampoline named *.AppImage.
# Tauri always passes --appimage-extract-and-run. The extracted linuxdeploy
# binary does not accept that flag. A shell script named .AppImage is also
# unusable: binfmt treats it as an AppImage and fails with ENOENT.
set -euo pipefail

export APPIMAGE_EXTRACT_AND_RUN=1

CACHE="${HOME}/.cache/tauri"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$CACHE"
cd "$CACHE"

find_exec() {
  local root="$1"
  local name="$2"
  if [[ -x "${root}/usr/bin/${name}" ]]; then
    echo "${root}/usr/bin/${name}"
    return
  fi
  if [[ -x "${root}/AppRun" ]]; then
    echo "${root}/AppRun"
    return
  fi
  echo "Could not find ${name} under ${root}" >&2
  find "${root}" -maxdepth 4 -type f | head -n 50 >&2
  exit 1
}

curl -fsSL -o linuxdeploy-x86_64.AppImage.bin \
  https://github.com/tauri-apps/binary-releases/releases/download/linuxdeploy/linuxdeploy-x86_64.AppImage
chmod +x linuxdeploy-x86_64.AppImage.bin
./linuxdeploy-x86_64.AppImage.bin --appimage-extract
rm -rf linuxdeploy-root
mv squashfs-root linuxdeploy-root
LINUXDEPLOY_BIN="$(find_exec "${CACHE}/linuxdeploy-root" linuxdeploy)"

curl -fsSL -o linuxdeploy-plugin-appimage-x86_64.AppImage.bin \
  https://github.com/linuxdeploy/linuxdeploy-plugin-appimage/releases/download/continuous/linuxdeploy-plugin-appimage-x86_64.AppImage
chmod +x linuxdeploy-plugin-appimage-x86_64.AppImage.bin
./linuxdeploy-plugin-appimage-x86_64.AppImage.bin --appimage-extract
rm -rf plugin-appimage-root
mv squashfs-root plugin-appimage-root
PLUGIN_BIN="$(find_exec "${CACHE}/plugin-appimage-root" linuxdeploy-plugin-appimage)"

echo "linuxdeploy binary: ${LINUXDEPLOY_BIN}"
echo "plugin binary: ${PLUGIN_BIN}"

gcc -O2 -o "${CACHE}/linuxdeploy-x86_64.AppImage" \
  -DREAL_PATH="\"${LINUXDEPLOY_BIN}\"" \
  "${ROOT}/scripts/linuxdeploy-trampoline.c"
gcc -O2 -o "${CACHE}/linuxdeploy-plugin-appimage-x86_64.AppImage" \
  -DREAL_PATH="\"${PLUGIN_BIN}\"" \
  "${ROOT}/scripts/linuxdeploy-trampoline.c"
cp "${CACHE}/linuxdeploy-plugin-appimage-x86_64.AppImage" "${CACHE}/linuxdeploy-plugin-appimage"
chmod +x "${CACHE}/linuxdeploy-x86_64.AppImage" \
  "${CACHE}/linuxdeploy-plugin-appimage-x86_64.AppImage" \
  "${CACHE}/linuxdeploy-plugin-appimage"

chattr +i "${CACHE}/linuxdeploy-x86_64.AppImage" \
  "${CACHE}/linuxdeploy-plugin-appimage-x86_64.AppImage" 2>/dev/null || true

echo "${CACHE}" >> "${GITHUB_PATH:-/dev/null}"

set +e
(cd /tmp && "${CACHE}/linuxdeploy-x86_64.AppImage" --appimage-extract-and-run --help)
echo "linuxdeploy trampoline help exit: $?"
set -e

echo "Prepared linuxdeploy trampoline at ${CACHE}"
