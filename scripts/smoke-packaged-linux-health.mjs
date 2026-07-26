#!/usr/bin/env node

import { existsSync, mkdirSync } from 'node:fs'
import { cpus, tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { readdirSync } from 'node:fs'

const outputDirectory = resolve(
  process.env.VIDEORC_SMOKE_OUTPUT_DIR ?? join(tmpdir(), `videorc-linux-health-${Date.now()}`)
)
mkdirSync(outputDirectory, { recursive: true })

function resolvePackagedAppExecutable() {
  if (process.env.VIDEORC_PACKAGED_APP_EXECUTABLE) {
    return process.env.VIDEORC_PACKAGED_APP_EXECUTABLE
  }

  const candidates = [
    'apps/desktop/release/linux-unpacked/videorc',
    'apps/desktop/release/linux-unpacked/Videorc',
    'apps/desktop/release/videorc'
  ]
  return candidates.find((candidate) => existsSync(candidate))
}

const appExecutable = resolvePackagedAppExecutable()
if (!appExecutable) {
  console.error('VIDEORC_PACKAGED_APP_EXECUTABLE must be set or resolvable for Linux packaged health smoke.')
  process.exit(1)
}

const smokeScriptArgs = [
  resolve(process.cwd(), 'scripts', 'smoke-packaged-app.mjs'),
  '--require-bundled-ffmpeg'
]
// Intent: GitHub runners have no interactive Linux display. Benefit: CI still
// launches and records with the real packaged Electron app under an isolated X
// server, while developer machines continue using their existing display.
const smokeCommand = process.env.CI === 'true' ? 'xvfb-run' : 'node'
const smokeArgs =
  process.env.CI === 'true' ? ['--auto-servernum', 'node', ...smokeScriptArgs] : smokeScriptArgs

const smoke = spawnSync(
  smokeCommand,
  smokeArgs,
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      VIDEORC_PACKAGED_APP_EXECUTABLE: appExecutable,
      VIDEORC_SMOKE_OUTPUT_DIR: outputDirectory,
      VIDEORC_SMOKE_TIMEOUT_MS: process.env.VIDEORC_SMOKE_TIMEOUT_MS ?? '120000',
      VIDEORC_SMOKE_RECORDING_MS: process.env.VIDEORC_SMOKE_RECORDING_MS ?? '4000',
      VIDEORC_SMOKE_VIDEO_WIDTH: '1280',
      VIDEORC_SMOKE_VIDEO_HEIGHT: '720',
      VIDEORC_SMOKE_VIDEO_FPS: '30',
      VIDEORC_SMOKE_VIDEO_BITRATE_KBPS: '4000',
      VIDEORC_PACKAGED_SMOKE_NO_SANDBOX: process.env.CI === 'true' ? '1' : '0'
    }
  }
)
if (smoke.status !== 0) {
  process.exit(smoke.status ?? 1)
}

const artifacts = readdirSync(outputDirectory).filter((entry) => /\.(mp4|mkv|mov|flv|webm)$/.test(entry))
if (artifacts.length === 0) {
  console.error(`no packaged recording artifact found under ${outputDirectory}`)
  process.exit(1)
}

const ffprobe = process.env.VIDEORC_SMOKE_FFPROBE_PATH || 'ffprobe'
if (!existsSync(ffprobe)) {
  console.error(`ffprobe not found: ${ffprobe}`)
  process.exit(1)
}

for (const fileName of artifacts) {
  const filePath = join(outputDirectory, fileName)
  const check = spawnSync(ffprobe, ['-v', 'error', '-show_format', '-show_streams', filePath], {
    stdio: 'pipe'
  })
  if (check.status !== 0) {
    console.error(`ffprobe validation failed for ${filePath}`)
    process.exit(check.status ?? 1)
  }
}

console.log(`linux-packaged-health: ok (${artifacts.length} artifacts) on ${cpus().length}-core host`)
