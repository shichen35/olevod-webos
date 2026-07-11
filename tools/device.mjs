/*
 * Device parameters for every tool in tools/ — one place, all overridable via
 * environment variables. The Dev Mode passphrase is NEVER stored here or on
 * disk: it rotates each developer-mode session, so it always arrives as a CLI
 * argument (or transiently via TV_PASS for scripted runs).
 *
 * If SSH auth fails: re-read the current passphrase from the TV's Developer
 * Mode app and re-fetch the key with `ares-novacom --device tv --getkey`.
 */
export const TV = {
  host: process.env.TV_HOST || '192.168.1.100',
  port: Number(process.env.TV_PORT || 9922),
  user: process.env.TV_USER || 'prisoner',
  // Private key fetched by `ares-novacom --getkey`.
  key: process.env.TV_KEY || `${process.env.HOME}/.ssh/tv_webos`,
  // Chromium remote-debugging port on the TV (CDP tools, T24).
  debugPort: Number(process.env.TV_DEBUG_PORT || 9998),
  // Device name registered with `ares-setup-device` (official-CLI path).
  device: process.env.TV_DEVICE || 'tv',
}

export const APP_ID = 'com.olevod.app'
export const SERVICE_ID = 'com.olevod.app.service'

// The TV presents an old ssh-rsa host key; ssh2 must opt into it explicitly.
export const SSH_ALGORITHMS = { serverHostKey: ['ssh-rsa'] }
