#!/usr/bin/env node
/**
 * Prepare CEF runtime + helper, then `tauri build --features cef` with the
 * platform overlay config. Default `tauri.conf.json` stays CEF-free.
 */
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const isWin = process.platform === 'win32'

const prepare = isWin
  ? {
      cmd: 'powershell',
      args: [
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        join(root, 'scripts', 'prepare-cef-bundle.ps1'),
      ],
    }
  : {
      cmd: 'bash',
      args: [join(root, 'scripts', 'prepare-cef-bundle.sh')],
    }

const prepareResult = spawnSync(prepare.cmd, prepare.args, {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
})
if (prepareResult.status !== 0) {
  process.exit(prepareResult.status ?? 1)
}

const config =
  process.platform === 'darwin'
    ? 'src-tauri/tauri.cef.macos.conf.json'
    : process.platform === 'win32'
      ? 'src-tauri/tauri.cef.windows.conf.json'
      : 'src-tauri/tauri.cef.linux.conf.json'

const extraArgs = process.argv.slice(2)
const npmCmd = isWin ? 'npm.cmd' : 'npm'
const buildResult = spawnSync(
  npmCmd,
  ['run', 'tauri', '--', 'build', '--features', 'cef', '--config', config, ...extraArgs],
  {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
    shell: isWin,
  },
)
process.exit(buildResult.status ?? 1)
