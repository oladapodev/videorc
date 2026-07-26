#!/usr/bin/env bash
set -euo pipefail

# Intent: stage a redistribution-safe, self-contained LGPL FFmpeg toolchain for
# Debian packages. Benefit: users do not need a system FFmpeg install and CI
# packages the same ffmpeg/ffprobe pair that the Linux preflight validates.
FFMPEG_SERIES="${VIDEORC_FFMPEG_LINUX_SERIES:-8.1}"
ASSET="ffmpeg-n${FFMPEG_SERIES}-latest-linux64-lgpl-${FFMPEG_SERIES}.tar.xz"
BASE_URL="https://github.com/BtbN/FFmpeg-Builds/releases/latest/download"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK_DIR="${REPO_ROOT}/vendor/ffmpeg/_build/linux-x64"
CURRENT_DIR="${REPO_ROOT}/vendor/ffmpeg/current"
ARCHIVE="${WORK_DIR}/${ASSET}"
CHECKSUMS="${WORK_DIR}/checksums.sha256"
EXTRACT_DIR="${WORK_DIR}/extract"

mkdir -p "${WORK_DIR}"
rm -rf "${EXTRACT_DIR}" "${CURRENT_DIR}"
mkdir -p "${EXTRACT_DIR}" "${CURRENT_DIR}/bin"

curl --fail --location --retry 5 --output "${ARCHIVE}" "${BASE_URL}/${ASSET}"
curl --fail --location --retry 5 --output "${CHECKSUMS}" "${BASE_URL}/checksums.sha256"

(
  cd "${WORK_DIR}"
  grep " ${ASSET}$" checksums.sha256 | sha256sum --check
)

tar --extract --xz --file "${ARCHIVE}" --directory "${EXTRACT_DIR}"
FFMPEG_PATH="$(find "${EXTRACT_DIR}" -type f -path '*/bin/ffmpeg' -print -quit)"
FFPROBE_PATH="$(find "${EXTRACT_DIR}" -type f -path '*/bin/ffprobe' -print -quit)"
LICENSE_PATH="$(find "${EXTRACT_DIR}" -type f -iname 'LICENSE.txt' -print -quit)"

if [[ -z "${FFMPEG_PATH}" || -z "${FFPROBE_PATH}" || -z "${LICENSE_PATH}" ]]; then
  echo "fetch-ffmpeg-linux: archive is missing ffmpeg, ffprobe, or LICENSE.txt" >&2
  exit 1
fi

install -m 0755 "${FFMPEG_PATH}" "${CURRENT_DIR}/bin/ffmpeg"
install -m 0755 "${FFPROBE_PATH}" "${CURRENT_DIR}/bin/ffprobe"
install -m 0644 "${LICENSE_PATH}" "${CURRENT_DIR}/LICENSE.txt"

SOURCE_SHA256="$(sha256sum "${ARCHIVE}" | cut -d ' ' -f 1)"
cat >"${CURRENT_DIR}/SOURCE.txt" <<EOF
FFmpeg binary distribution: ${BASE_URL}/${ASSET}
Asset SHA-256: ${SOURCE_SHA256}
Upstream build project: https://github.com/BtbN/FFmpeg-Builds
FFmpeg source: https://ffmpeg.org/
EOF

"${CURRENT_DIR}/bin/ffmpeg" -hide_banner -buildconf >"${CURRENT_DIR}/BUILD-CONFIG.txt" 2>&1
cat >"${CURRENT_DIR}/NOTICE.txt" <<EOF
Videorc bundles the LGPL build of FFmpeg distributed by BtbN/FFmpeg-Builds.
License details are in LICENSE.txt; exact binary provenance is in SOURCE.txt.
EOF

echo "fetch-ffmpeg-linux: staged ${ASSET} at vendor/ffmpeg/current"
