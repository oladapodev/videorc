import { dirname, resolve } from 'node:path'

export function defaultPackagedAppExecutable({ repoRoot, platform = process.platform } = {}) {
  if (!repoRoot) {
    throw new Error('repoRoot is required.')
  }
  if (platform === 'darwin') {
    return resolve(repoRoot, 'apps/desktop/release/mac-arm64/Videorc.app/Contents/MacOS/Videorc')
  }
  if (platform === 'win32') {
    return resolve(repoRoot, 'apps/desktop/release/win-unpacked/Videorc.exe')
  }
  if (platform === 'linux') {
    return resolve(repoRoot, 'apps/desktop/release/linux-unpacked/videorc')
  }
  throw new Error(`Packaged app smoke test does not support ${platform}.`)
}

export function bundledFfmpegPathForPackagedApp({ appExecutable, platform = process.platform } = {}) {
  if (!appExecutable) {
    throw new Error('appExecutable is required.')
  }
  if (platform === 'darwin') {
    return resolve(dirname(appExecutable), '..', 'Resources', 'ffmpeg', 'bin', 'ffmpeg')
  }
  if (platform === 'win32') {
    return resolve(dirname(appExecutable), 'resources', 'ffmpeg', 'bin', 'ffmpeg.exe')
  }
  if (platform === 'linux') {
    return resolve(dirname(appExecutable), 'resources', 'ffmpeg', 'bin', 'ffmpeg')
  }
  throw new Error(`Packaged app smoke test does not support ${platform}.`)
}

export function assertPackagedSmokePlatform(platform = process.platform) {
  if (platform !== 'darwin' && platform !== 'win32' && platform !== 'linux') {
    throw new Error(`Packaged app smoke test supports macOS, Windows, and Linux only, not ${platform}.`)
  }
}
