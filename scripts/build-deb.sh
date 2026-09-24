#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Verify required tools
for tool in dpkg-deb node npm npx; do
  if ! command -v "${tool}" > /dev/null 2>&1; then
    echo "Error: Required tool '${tool}' is not installed."
    exit 1
  fi
done

cd "${ROOT_DIR}"

VERSION="$(node -p "require('./package.json').version || '0.1.0'")"
ARCH="amd64"
PKG_NAME="sourcehub"
BUILD_DIR="${ROOT_DIR}/build/deb"
STAGING_DIR="${BUILD_DIR}/${PKG_NAME}_${VERSION}_${ARCH}"
OUTPUT_DIR="${ROOT_DIR}/dist-deb"
OUTPUT_DEB="${OUTPUT_DIR}/${PKG_NAME}_${VERSION}_${ARCH}.deb"

echo "=========================================="
echo " Building Debian Release Package for SourceHub"
echo " Package: ${PKG_NAME}"
echo " Version: ${VERSION}"
echo " Arch:    ${ARCH}"
echo "=========================================="

# 1. Clean previous build directories
echo ""
echo "--> Cleaning staging and output directories..."
rm -rf "${BUILD_DIR}"
mkdir -p "${STAGING_DIR}" "${OUTPUT_DIR}"

# 2. Build production React 19 frontend
echo ""
echo "--> Building frontend with Vite..."
npm run build

# 3. Bundle backend server with esbuild into standalone server.mjs
echo ""
echo "--> Bundling backend daemon with esbuild..."
mkdir -p "${STAGING_DIR}/usr/lib/sourcehub"
npx esbuild server/index.ts \
  --bundle \
  --platform=node \
  --target=node22 \
  --format=esm \
  --banner:js="import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" \
  --outfile="${STAGING_DIR}/usr/lib/sourcehub/server.mjs" \
  --external:node:*

# 4. Copy compiled frontend into /usr/lib/sourcehub/dist
echo ""
echo "--> Staging frontend assets in /usr/lib/sourcehub/dist..."
cp -r "${ROOT_DIR}/dist" "${STAGING_DIR}/usr/lib/sourcehub/"

# 5. Stage CLI launcher script in /usr/bin/sourcehub
echo ""
echo "--> Staging CLI executable in /usr/bin/sourcehub..."
install -Dm755 "${ROOT_DIR}/bin/sourcehub-cli" "${STAGING_DIR}/usr/bin/sourcehub"

# 6. Stage desktop entry and scalable SVG icon
echo ""
echo "--> Staging XDG desktop entry and application icon..."
install -Dm644 "${ROOT_DIR}/assets/sourcehub.desktop" "${STAGING_DIR}/usr/share/applications/sourcehub.desktop"
install -Dm644 "${ROOT_DIR}/public/sourcehub.svg" "${STAGING_DIR}/usr/share/icons/hicolor/scalable/apps/sourcehub.svg"

# 7. Stage systemd user service unit
echo ""
echo "--> Staging systemd user service in /usr/lib/systemd/user/..."
install -Dm644 "${ROOT_DIR}/assets/sourcehub.service" "${STAGING_DIR}/usr/lib/systemd/user/sourcehub.service"

# 8. Stage default system configuration
echo ""
echo "--> Staging configuration in /etc/sourcehub/..."
install -Dm644 "${ROOT_DIR}/assets/sourcehub.conf" "${STAGING_DIR}/etc/sourcehub/sourcehub.conf"

# 9. Create DEBIAN control and maintainer scripts
echo ""
echo "--> Generating Debian package metadata (DEBIAN/control)..."
mkdir -p "${STAGING_DIR}/DEBIAN"

cat <<EOF > "${STAGING_DIR}/DEBIAN/control"
Package: ${PKG_NAME}
Version: ${VERSION}
Section: devel
Priority: optional
Architecture: ${ARCH}
Depends: nodejs (>= 22.0.0), git (>= 2.30.0)
Recommends: xdg-utils, curl
Maintainer: Nicholas <nick040791@gmail.com>
Homepage: https://github.com/Nick040791/SourceHub
Description: Self-hosted git forge, local CI runner, and AI coding agent
 SourceHub turns any directory of local git repositories into a comprehensive,
 high-performance development forge served locally over the web and LAN.
 Features full source control workbench, PR & merge conflict engine,
 declarative YAML workflow CI runner, and autonomous AI coding agent.
EOF

cat <<EOF > "${STAGING_DIR}/DEBIAN/conffiles"
/etc/sourcehub/sourcehub.conf
EOF

cat <<'EOF' > "${STAGING_DIR}/DEBIAN/postinst"
#!/bin/sh
set -e

if [ "$1" = "configure" ]; then
    # Update desktop application database
    if which update-desktop-database >/dev/null 2>&1; then
        update-desktop-database -q /usr/share/applications || true
    fi

    # Update icon cache
    if which gtk-update-icon-cache >/dev/null 2>&1; then
        gtk-update-icon-cache -q -t -f /usr/share/icons/hicolor || true
    fi

    # Reload systemd daemon if active
    if [ -d /run/systemd/system ]; then
        systemctl daemon-reload || true
    fi
fi

exit 0
EOF

cat <<'EOF' > "${STAGING_DIR}/DEBIAN/prerm"
#!/bin/sh
set -e

if [ "$1" = "remove" ] || [ "$1" = "deconfigure" ]; then
    # Gracefully stop running server instances
    pkill -f "/usr/lib/sourcehub/server.mjs" 2>/dev/null || true
fi

exit 0
EOF

cat <<'EOF' > "${STAGING_DIR}/DEBIAN/postrm"
#!/bin/sh
set -e

if [ "$1" = "remove" ] || [ "$1" = "purge" ]; then
    if which update-desktop-database >/dev/null 2>&1; then
        update-desktop-database -q /usr/share/applications || true
    fi

    if which gtk-update-icon-cache >/dev/null 2>&1; then
        gtk-update-icon-cache -q -t -f /usr/share/icons/hicolor || true
    fi

    if [ -d /run/systemd/system ]; then
        systemctl daemon-reload || true
    fi
fi

exit 0
EOF

chmod 755 "${STAGING_DIR}/DEBIAN/postinst" "${STAGING_DIR}/DEBIAN/prerm" "${STAGING_DIR}/DEBIAN/postrm"
chmod 644 "${STAGING_DIR}/DEBIAN/control" "${STAGING_DIR}/DEBIAN/conffiles"

# 10. Build Debian package with dpkg-deb
echo ""
echo "--> Building .deb package with dpkg-deb..."
dpkg-deb --build --root-owner-group "${STAGING_DIR}" "${OUTPUT_DEB}"

# 11. Generate SHA256 checksum
echo ""
echo "--> Generating SHA256 checksum..."
cd "${OUTPUT_DIR}"
sha256sum "$(basename "${OUTPUT_DEB}")" > "$(basename "${OUTPUT_DEB}").sha256"

# 12. Report results
echo ""
echo "=========================================="
echo " Debian package built successfully!"
echo " Package:  ${OUTPUT_DEB}"
echo " Checksum: ${OUTPUT_DEB}.sha256"
echo " Size:     $(du -h "${OUTPUT_DEB}" | cut -f1)"
echo "=========================================="
dpkg-deb -I "${OUTPUT_DEB}"
