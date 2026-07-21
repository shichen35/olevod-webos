#!/usr/bin/env bash
#
# Build + package .ipk into out/.
#
#   bash build.sh
#
# Single source of truth for the app version: bump the default below and re-run.
# appinfo.json and both package.json files are synced automatically before
# packaging, so the .ipk filename, the webOS-reported version, and the
# in-app "版本" label (__APP_VERSION__) always match.
#
# Set the VERSION env var to override it without editing this file (used by CI):
#   VERSION=1.0.0 bash build.sh
VERSION="${VERSION:-1.0.0}"

set -euo pipefail
cd "$(dirname "$0")"

# 1. Sync VERSION into webOS metadata and the service manifest.
node - "$VERSION" <<'EOF'
const fs = require('fs');
const version = process.argv[2];
for (const file of [
  'app/webos-meta/appinfo.json',
  'service/com.olevod.app.service/package.json',
]) {
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  json.version = version;
  fs.writeFileSync(file, JSON.stringify(json, null, 2) + '\n');
}
EOF
# npm version also keeps package-lock.json in step.
(cd app && npm version "$VERSION" --no-git-tag-version --allow-same-version >/dev/null)

# 2. Frontend build (target chrome108, base './' — see app/vite.config.js).
(cd app && npm run build)

# 3. Merge webOS metadata (appinfo.json + icons) into the build output.
cp -r app/webos-meta/. app/dist/

# 4. Package app + service into a single .ipk.
mkdir -p out
ares-package --no-minify app/dist service/com.olevod.app.service -o out

IPK=$(ls -t out/*.ipk | head -1)
echo "packaged: ${IPK}"
