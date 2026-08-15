#!/usr/bin/env bash
# Extract linuxdeploy and its AppImage plugin so Tauri can bundle without FUSE.
# GitHub-hosted Ubuntu 24.04 runners cannot mount AppImages.
set -euo pipefail

export APPIMAGE_EXTRACT_AND_RUN=1

CACHE="${HOME}/.cache/tauri"
mkdir -p "$CACHE"
cd "$CACHE"

find_exec() {
  local root="$1"
  local name="$2"
  if [[ -x "${root}/AppRun" ]]; then
    echo "${root}/AppRun"
    return
  fi
  if [[ -x "${root}/usr/bin/${name}" ]]; then
    echo "${root}/usr/bin/${name}"
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

cat > linuxdeploy-x86_64.AppImage <<EOF
#!/usr/bin/env bash
export APPIMAGE_EXTRACT_AND_RUN=1
export PATH="${CACHE}:\${PATH}"
args=()
for arg in "\$@"; do
  if [[ "\$arg" != "--appimage-extract-and-run" ]]; then
    args+=("\$arg")
  fi
done
exec "${LINUXDEPLOY_BIN}" "\${args[@]}"
EOF
chmod +x linuxdeploy-x86_64.AppImage

cat > linuxdeploy-plugin-appimage-x86_64.AppImage <<EOF
#!/usr/bin/env bash
export APPIMAGE_EXTRACT_AND_RUN=1
args=()
for arg in "\$@"; do
  if [[ "\$arg" != "--appimage-extract-and-run" ]]; then
    args+=("\$arg")
  fi
done
exec "${PLUGIN_BIN}" "\${args[@]}"
EOF
chmod +x linuxdeploy-plugin-appimage-x86_64.AppImage

cp linuxdeploy-plugin-appimage-x86_64.AppImage linuxdeploy-plugin-appimage
chmod +x linuxdeploy-plugin-appimage

chattr +i linuxdeploy-x86_64.AppImage linuxdeploy-plugin-appimage-x86_64.AppImage 2>/dev/null || true

echo "${CACHE}" >> "${GITHUB_PATH:-/dev/null}"
echo "Prepared linuxdeploy at ${CACHE} without FUSE"
