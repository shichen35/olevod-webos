# T24 CDP Debug Toolchain

> Milestone D | Depends on: T23 | Deliverable:
> `tools/{debug,screenshot,drive,sh}.mjs` (+ optional watch/netcap)

## Goal

Establish a "get data first, then fix code" workflow for on-device
troubleshooting: an SSH tunnel to the TV's `127.0.0.1:9998` (Chrome
DevTools Protocol) over WebSocket, covering logs, performance metrics,
screenshots, remote-control key injection, and remote shell access.

## References

- Skill: `.claude/skills/webos-tv-app-skill` §5 and
  `reference/debug-toolchain.md` (full scripts)
- Shortcut: prefer `ares-inspect -d <device> -a com.olevod.app` when it
  works; on some devices DevTools shows a blank page, in which case fall
  back to the CDP-over-SSH toolchain built in this task.

## Requirements

1. **debug.mjs**: console messages + uncaught exceptions +
   `Performance.getMetrics` (JSHeapUsedSize / Nodes / LayoutCount /
   RecalcStyleCount / TaskDuration) + DOM/focusable element counts. Outputs
   a one-shot snapshot, used by T25 to establish a baseline.
2. **screenshot.mjs**: saves a PNG via `Page.captureScreenshot`. Document
   that **the hardware video plane can't be captured** (the video area
   shows up as white/black) — to verify playback, check whether
   `<video>.currentTime` is advancing instead.
3. **drive.mjs**: injects direction key/OK/Back sequences via
   `Input.dispatchKeyEvent` (e.g. `"down,down,ok"`) and takes a screenshot
   afterward — supports unattended, self-driven walkthroughs.
4. **sh.mjs**: runs arbitrary commands over SSH (`journalctl`, `ls`,
   reading service log files, etc).
5. (Optional) **watch.mjs** for long-running monitoring of `<video>` state,
   and **netcap.mjs** for reading segment request timing from the proxy
   logs — useful for playback troubleshooting, can be added later if
   needed.
6. All scripts reuse the device configuration already centralized in
   `tools/device.mjs` (`TV.debugPort` from `TV_DEBUG_PORT`, default 9998,
   plus the `ssh-rsa` host-key algorithm ssh2 needs); `tools/package.json`
   already declares the `ssh2` and `ws` dependencies for the SSH tunnel and
   the CDP WebSocket. There are no npm scripts — everything runs as
   `node tools/<script>.mjs`. The connection layer (SSH tunnel + CDP
   WebSocket) is factored into one shared module rather than duplicated in
   every script.
7. Document two CDP blind spots: native HLS segment requests don't show up
   in the CDP Network domain (check the proxy logs instead); and the
   service's `console.log` output doesn't reach journald (the service
   writes to `/tmp/olevod-service.log` instead).

## Explicitly out of scope

- Automated test framework; performance regression CI.

## Acceptance criteria

- [ ] All four scripts run successfully once against a deployed app: get
      console output and metrics, capture a UI screenshot, see focus move
      in a screenshot after key injection, and get output back from a
      remote command;
- [ ] Disconnects/timeouts produce a clear error (never hang silently);
- [ ] The root README documents the debugging scripts — one line per
      script describing its purpose plus an example command (its
      Development section already points at the CDP-over-SSH toolchain in
      `tools/`).
