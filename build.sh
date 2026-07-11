#!/usr/bin/env bash
#
# Build + package .ipk into out/.
#
#   bash build.sh
#
set -euo pipefail
cd "$(dirname "$0")"

# 1. Frontend build (target chrome108, base './' — see app/vite.config.js).
(cd app && npm run build)

# 2. Merge webOS metadata (appinfo.json + icons) into the build output.
cp -r app/webos-meta/. app/dist/

# 3. Package app + service into a single .ipk.
mkdir -p out
ares-package --no-minify app/dist service/com.olevod.app.service -o out

IPK=$(ls -t out/*.ipk | head -1)
echo "packaged: ${IPK}"
