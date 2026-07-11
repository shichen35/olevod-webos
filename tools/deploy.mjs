/*
 * Install + launch the packaged .ipk on the TV.
 *
 *   node tools/deploy.mjs "<dev-mode-passphrase>" [path/to/app.ipk]
 *
 * Two paths, tried in order:
 *   1. Official CLI: `ares-install` + `ares-launch` against the device named
 *      by TV_DEVICE (registered via `ares-setup-device`). Preferred when the
 *      installed CLI runs on the local Node version.
 *   2. ssh2 fallback: the official CLI only supports Node 14-16 and throws on
 *      newer runtimes — SSH in ourselves, sftp the .ipk up, then luna-send-pub
 *      dev/install + applicationmanager/launch (needs `npm install` in tools/).
 *
 * Device parameters come from tools/device.mjs (TV_HOST/TV_PORT/TV_USER/
 * TV_KEY/TV_DEBUG_PORT env vars). The passphrase rotates with each Dev Mode
 * session — it is a CLI argument, never written to disk.
 */
import { spawnSync } from 'node:child_process'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { TV, APP_ID, SSH_ALGORITHMS } from './device.mjs'

const passphrase = process.argv[2] || process.env.TV_PASS || ''
const REMOTE_DIR = '/media/developer/temp/'

function findIpk() {
  const explicit = process.argv[3]
  if (explicit) return explicit
  const out = new URL('../out/', import.meta.url).pathname
  if (!existsSync(out)) throw new Error('no out/ directory — run build.sh first')
  const ipks = readdirSync(out).filter((f) => f.endsWith('.ipk')).sort()
  if (!ipks.length) throw new Error('no .ipk in out/ — run build.sh first')
  return out + ipks[ipks.length - 1]
}

// --- Path 1: official CLI -----------------------------------------------
function tryAres(ipk) {
  const opts = { stdio: 'inherit' }
  console.log(`[deploy] trying ares-install --device ${TV.device}`)
  const install = spawnSync('ares-install', ['--device', TV.device, ipk], opts)
  if (install.error || install.status !== 0) return false
  const launch = spawnSync('ares-launch', ['--device', TV.device, APP_ID], opts)
  return !launch.error && launch.status === 0
}

// --- Path 2: ssh2 fallback ------------------------------------------------
async function sshDeploy(ipk) {
  let Client
  try {
    ;({ Client } = await import('ssh2'))
  } catch {
    throw new Error('ssh2 not installed — run `npm install` inside tools/')
  }
  if (!passphrase) {
    throw new Error('ssh fallback needs the Dev Mode passphrase: node tools/deploy.mjs "<pass>"')
  }

  const exec = (conn, cmd) =>
    new Promise((resolve, reject) =>
      conn.exec(cmd, (err, stream) => {
        if (err) return reject(err)
        let out = ''
        let errOut = ''
        stream.on('data', (d) => (out += d))
        stream.stderr.on('data', (d) => (errOut += d))
        stream.on('close', (code) => resolve({ out, errOut, code }))
      }),
    )

  const conn = new Client()
  await new Promise((resolve, reject) => {
    conn.on('ready', resolve).on('error', reject)
    conn.connect({
      host: TV.host,
      port: TV.port,
      username: TV.user,
      privateKey: readFileSync(TV.key),
      passphrase,
      algorithms: SSH_ALGORITHMS,
    })
  })
  console.log(`[deploy] ssh connected to ${TV.user}@${TV.host}:${TV.port}`)

  const remoteIpk = REMOTE_DIR + 'olevod.ipk'
  await new Promise((resolve, reject) =>
    conn.sftp((err, sftp) => {
      if (err) return reject(err)
      sftp.fastPut(ipk, remoteIpk, (e) => (e ? reject(e) : resolve()))
    }),
  )
  console.log(`[deploy] uploaded ${ipk} -> ${remoteIpk}`)

  const install = await exec(
    conn,
    `luna-send-pub -n 6 -f luna://com.webos.appInstallService/dev/install ` +
      `'{"id":"${APP_ID}","ipkUrl":"${remoteIpk}","subscribe":true}'`,
  )
  if (/error|fail/i.test(install.out + install.errOut)) {
    conn.end()
    throw new Error(`install failed:\n${install.out}${install.errOut}`)
  }
  console.log('[deploy] installed')

  // Give appInstallService a beat to register the app before launching.
  await new Promise((r) => setTimeout(r, 3000))
  await exec(
    conn,
    `luna-send-pub -n 1 -f luna://com.webos.service.applicationmanager/launch '{"id":"${APP_ID}"}'`,
  )
  console.log('[deploy] launched')
  conn.end()
}

const ipk = findIpk()
if (tryAres(ipk)) {
  console.log('[deploy] done (official CLI)')
} else {
  console.log('[deploy] official CLI unavailable/failed — falling back to ssh2')
  await sshDeploy(ipk)
  console.log('[deploy] done (ssh2)')
}
