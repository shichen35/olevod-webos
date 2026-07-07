# T23 webOS Packaging and Deployment

> Milestone D | Depends on: T22 | Deliverable: `app/webos-meta/`, `build.sh`,
> `tools/deploy.mjs`, `tools/device.mjs`

## Goal

A single command that takes the source code all the way to the TV:
`vite build` -> merge webOS metadata -> `ares-package` produces an `.ipk`
-> deploy over SSH, install, and launch.

## References

- Skill: `.claude/skills/webos-tv-app-skill` §4 (appinfo essentials,
  deployment pitfalls)
- LG's official CLI (`@webos-tools/cli`) standard flow: `ares-package` ->
  `ares-setup-device` -> `ares-novacom --getkey` -> `ares-install` ->
  `ares-launch`

## Requirements

1. **webos-meta/appinfo.json**: `id: com.olevod.app`, `type: web`,
   `main: index.html`, `title: "欧乐影视" (Ole Video)`, `version` (semver),
   `vendor`, `uiRevision: 2`, `resolution: "1920x1080"`,
   **`disableBackHistoryAPI: true`** (otherwise Back exits the app
   immediately), `requiredPermissions: ["all"]`. Icons: `icon.png` at
   80x80 and `largeIcon.png` at 130x130 — these must be genuine PNGs
   (generate them from a source image with sips/ImageMagick).
2. **build.sh**: `vite build` -> `cp webos-meta/* dist/` ->
   `ares-package --no-minify dist service/com.olevod.app.service` produces
   `com.olevod.app_1.0.0_all.ipk`. `--no-deploy` only packages; passing a
   passphrase argument continues on to deploy + launch.
3. **tools/deploy.mjs**: prefer the official
   `ares-setup-device` -> `ares-install` -> `ares-launch` flow; in practice
   the official CLI doesn't run on some newer Node versions (it only
   supports Node 14-16), in which case fall back to an equivalent flow
   built with the `ssh2` library: SSH (with
   `algorithms.serverHostKey: ['ssh-rsa']`, since the TV uses an old host
   key type) -> sftp upload of the `.ipk` -> `luna-send-pub` calls to
   `dev/install` -> `applicationmanager/launch`.
4. **tools/device.mjs**: device parameters centralized in environment
   variables `TV_HOST / TV_PORT / TV_USER / TV_KEY / TV_PASS /
   TV_DEBUG_PORT`; the passphrase is passed via CLI argument and never
   written to disk. Document that **the Dev Mode passphrase rotates** — if
   SSH auth fails, re-read the passphrase from the Developer Mode app and
   re-fetch the key with `ares-novacom --getkey`.
5. Add a "Build and Deploy" section to the project's root README: dependencies,
   commands, and Dev Mode prerequisites.

## Explicitly out of scope

- CI/store submission workflow; automatic version bumping.

## Acceptance criteria

- [ ] `bash build.sh --no-deploy` produces an `.ipk`; unpacking it confirms
      it contains both the frontend build output and the service;
- [ ] `bash build.sh <passphrase>` installs and launches on the TV in one
      command;
- [ ] Pressing Back on the TV does not exit the app (confirms
      `disableBackHistoryAPI` is working and the app's own Back chain
      handles it);
- [ ] The icon displays correctly in the TV launcher.
