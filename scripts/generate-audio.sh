#!/usr/bin/env bash
#
# Regenerates the prerecorded voice fixtures used by the Dictate and Use Voice
# tests. The generated WAV is committed to the repo so CI does not need `say`.
#
# Requirements (macOS dev machine): `say` and `ffmpeg` on PATH.
#
# The spoken message is read from config/bc-voice.config.json (textMessage) so the
# audio always matches the text the tests expect.
#
# Usage: ./scripts/generate-audio.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG="$ROOT/config/bc-voice.config.json"
OUT_DIR="$ROOT/fixtures/audio"
OUT_WAV="$OUT_DIR/marathon-message.wav"
VOICE="${SAY_VOICE:-Samantha}"

for bin in say ffmpeg; do
  if ! command -v "$bin" >/dev/null 2>&1; then
    echo "error: '$bin' not found on PATH (required to regenerate audio)" >&2
    exit 1
  fi
done

# Extract the textMessage value from the JSON config.
MESSAGE="$(sed -n 's/^[[:space:]]*"textMessage"[[:space:]]*:[[:space:]]*"\(.*\)",\{0,1\}$/\1/p' "$CONFIG")"
if [ -z "$MESSAGE" ]; then
  echo "error: could not read textMessage from $CONFIG" >&2
  exit 1
fi

mkdir -p "$OUT_DIR"
TMP_AIFF="$(mktemp -t bc-voice).aiff"
trap 'rm -f "$TMP_AIFF"' EXIT

echo "Speaking: $MESSAGE"
say -v "$VOICE" -o "$TMP_AIFF" "$MESSAGE"

# Chromium's --use-file-for-fake-audio-capture expects a PCM WAV and loops it with
# no gap. Voice mode's server-side VAD needs a silent tail to detect end-of-turn,
# so we append trailing silence (SILENCE_SECS). 48 kHz mono 16-bit PCM is a safe,
# widely-accepted format.
SILENCE_SECS="${SILENCE_SECS:-3}"
ffmpeg -y -loglevel error -i "$TMP_AIFF" \
  -af "apad=pad_dur=${SILENCE_SECS}" \
  -ar 48000 -ac 1 -c:a pcm_s16le "$OUT_WAV"

echo "Wrote $OUT_WAV"
