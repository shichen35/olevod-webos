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
2. **build.sh**: `npm run build` in `app/` ->
   `cp -r app/webos-meta/. app/dist/` ->
   `ares-package --no-minify app/dist service/com.olevod.app.service -o out`
   produces `out/com.olevod.app_1.0.0_all.ipk`. With `--no-deploy` (or no
   argument at all) it only packages; passing the Dev Mode passphrase as
   the argument continues on to `tools/deploy.mjs` for install + launch.
3. **tools/deploy.mjs**: prefer the official CLI — `ares-install` +
   `ares-launch` against the device registered via `ares-setup-device`
   (name from `TV_DEVICE`); in practice the official CLI doesn't run on
   some newer Node versions (it only supports Node 14-16), in which case
   fall back to an equivalent flow built with the `ssh2` library: SSH (with
   `algorithms.serverHostKey: ['ssh-rsa']`, since the TV uses an old host
   key type) -> sftp upload of the `.ipk` to `/media/developer/temp/` ->
   `luna-send-pub` calls to `dev/install` -> `applicationmanager/launch`.
4. **tools/device.mjs**: device parameters centralized in environment
   variables `TV_HOST / TV_PORT / TV_USER / TV_KEY / TV_DEBUG_PORT /
   TV_DEVICE`; the passphrase is passed via CLI argument (or transiently
   via `TV_PASS` for scripted runs) and never written to disk. Document
   that **the Dev Mode passphrase rotates** — if SSH auth fails, re-read
   the passphrase from the Developer Mode app and re-fetch the key with
   `ares-novacom --device tv --getkey`.
5. The project's root README has a "Build and Deploy (webOS)" section:
   dependencies (`@webos-tools/cli`), commands, and Dev Mode prerequisites.

## Explicitly out of scope

- CI/store submission workflow; automatic version bumping.

## Acceptance criteria

- [ ] `bash build.sh --no-deploy` produces an `.ipk` in `out/`; unpacking it confirms
      it contains both the frontend build output and the service;
- [ ] `bash build.sh <passphrase>` installs and launches on the TV in one
      command;
- [ ] Pressing Back on the TV does not exit the app (confirms
      `disableBackHistoryAPI` is working and the app's own Back chain
      handles it);
- [ ] The icon displays correctly in the TV launcher.
