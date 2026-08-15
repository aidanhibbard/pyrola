#!/usr/bin/env bash
# Extract linuxdeploy and its AppImage plugin so Tauri can bundle without FUSE.
# GitHub-hosted Ubuntu 24.04 runners cannot mount AppImages.
set -euo pipefail

export APPIMAGE_EXTRACT_AND_RUN=1

CACHE="${HOME}/.cache/tauri"
mkdir -p "$CACHE"
cd "$CACHE"

curl -fsSL -o linuxdeploy-x86_64.AppImage \
  https://github.com/tauri-apps/binary-releases/releases/download/linuxdeploy/linuxdeploy-x86_64.AppImage
chmod +x linuxdeploy-x86_64.AppImage
./linuxdeploy-x86_64.AppImage --appimage-extract
rm -rf linuxdeploy-root
mv squashfs-root linuxdeploy-root

curl -fsSL -o linuxdeploy-plugin-appimage-x86_64.AppImage \
  https://github.com/linuxdeploy/linuxdeploy-plugin-appimage/releases/download/continuous/linuxdeploy-plugin-appimage-x86_64.AppImage
chmod +x linuxdeploy-plugin-appimage-x86_64.AppImage
./linuxdeploy-plugin-appimage-x86_64.AppImage --appimage-extract
rm -rf plugin-appimage-root
mv squashfs-root plugin-appimage-root

cat > linuxdeploy-x86_64.AppImage <<EOF
#!/usr/bin/env bash
export APPIMAGE_EXTRACT_AND_RUN=1
export PATH="${CACHE}:\${PATH}"
exec "${CACHE}/linuxdeploy-root/AppRun" "\$@"
EOF
chmod +x linuxdeploy-x86_64.AppImage

cat > linuxdeploy-plugin-appimage-x86_64.AppImage <<EOF
#!/usr/bin/env bash
export APPIMAGE_EXTRACT_AND_RUN=1
exec "${CACHE}/plugin-appimage-root/AppRun" "\$@"
EOF
chmod +x linuxdeploy-plugin-appimage-x86_64.AppImage

# Keep Tauri from re-downloading AppImages over the FUSE-less wrappers.
chattr +i linuxdeploy-x86_64.AppImage linuxdeploy-plugin-appimage-x86_64.AppImage 2>/dev/null || true

echo "${CACHE}" >> "${GITHUB_PATH:-/dev/null}"
echo "Prepared linuxdeploy at ${CACHE} without FUSE"
