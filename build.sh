#!/usr/bin/env bash
#
# Build + package + optional deploy.
#
#   bash build.sh --no-deploy        # build + package .ipk into out/ only
#   bash build.sh "<passphrase>"     # ... then install + launch on the TV
#                                    #     (passphrase = Dev Mode app, rotates)
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

# 4. Optional deploy.
ARG="${1:-}"
if [[ -z "${ARG}" || "${ARG}" == "--no-deploy" ]]; then
  [[ -z "${ARG}" ]] && echo "no passphrase given — skipping deploy (pass the Dev Mode passphrase to install+launch)"
  exit 0
fi
node tools/deploy.mjs "${ARG}" "${IPK}"
