# Brand Concierge Voice — E2E Test Suite Design

Date: 2026-08-10
Author: Masa Hokari

## Goal

Add Playwright E2E tests for the "Voice in Brand Concierge" project covering three
input/output modes against the deployed widget:

1. **Text input** — user types text, service responds in text only.
2. **Dictate mode** — user speaks (voice), service responds in text only.
3. **Use Voice mode** — user speaks (voice), service responds in text and voice.

All three verify that the AI reply is "long enough" (min word count).

## Decisions

- **Browser scope:** Chromium-only for all three tests. Voice injection relies on
  Chromium launch flags (`--use-file-for-fake-audio-capture`) that Firefox/WebKit
  do not support, so the whole suite runs on Chromium for consistency.
- **Audio files:** Pre-generated WAVs are committed to the repo. A committed script
  regenerates them via `say` + `ffmpeg`. This keeps CI portable (Linux CI has no `say`).
- **Assertion:** Reply "long enough" == word count of the latest assistant message
  `>= minResponseWords` (configurable in YAML).
- **Config:** Test URL, text message, word-count threshold, audio file paths, and
  timeouts live in a YAML config file.

## File layout

```
config/bc-voice.config.yaml          # all tunables
fixtures/audio/marathon-message.wav  # committed prerecorded voice (16-bit PCM WAV)
scripts/generate-audio.sh            # regenerates the WAV via say + ffmpeg
tests/support/config.ts              # loads + validates the YAML into a typed object
tests/support/concierge.page.ts      # Page Object: selectors + actions
tests/bc-voice.spec.ts               # the 3 tests
playwright.config.ts                 # chromium project + fake-audio flags + mic permission
package.json                         # add js-yaml; add gen-audio + test scripts
```

## Config schema (`config/bc-voice.config.yaml`)

```yaml
url: "https://d3mey6isb8np59.cloudfront.net/dsg-bc-voice/index.html"
textMessage: "I am preparing a full marathon and want to have a pair of new shoes."
minResponseWords: 20
audio:
  dictate: "fixtures/audio/marathon-message.wav"
  voice:   "fixtures/audio/marathon-message.wav"
timeouts:
  responseMs: 60000
  actionMs:   15000
```

Both dictate and voice default to the same generated file but are independently
configurable.

## Voice injection

The chromium project is launched with:

- `--use-fake-device-for-media-stream`
- `--use-fake-ui-for-media-stream` (auto-accepts the mic permission prompt)
- `--use-file-for-fake-audio-capture=<absolute path to WAV>`

Context is granted `permissions: ['microphone']`. The fake-audio path is resolved
from `config.audio.voice` at config-load time (both voice tests use the same file).

Audio is generated with:

```sh
say -v Samantha -o out.aiff "<textMessage>"
ffmpeg -y -i out.aiff -ar 48000 -ac 1 -c:a pcm_s16le fixtures/audio/marathon-message.wav
```

## Page Object (`ConciergePage`)

- `goto()` — navigate to `config.url`, wait for the widget to mount.
- `typeAndSend(text)` — fill `#ai-chat-input`, click the Send button.
- `dictate()` — click the mic (dictate) button, wait for the transcript to appear in
  the input, then Send if the app does not auto-send.
- `useVoice()` — click the "Use Voice" button, enter voice mode.
- `waitForResponse()` — wait until the "Generating response from our knowledge base"
  indicator disappears and an assistant message is present (bounded by
  `timeouts.responseMs`).
- `lastResponseText()` — return the text of the latest assistant message.

Assertion helper: `wordCount(text) >= config.minResponseWords`.

## Tests (`tests/bc-voice.spec.ts`)

1. **Text input** — `goto` → `typeAndSend(textMessage)` → `waitForResponse` → assert word count.
2. **Dictate mode** — `goto` → `dictate()` → `waitForResponse` → assert word count.
3. **Use Voice mode** — `goto` → `useVoice()` → `waitForResponse` → assert word count.

## Error handling

- Generous `responseMs` timeout for LLM latency.
- `waitForResponse` explicitly waits for the "Generating…" indicator to disappear so
  we never assert on a partial reply.
- Clear failure messages when the reply is empty or below the word threshold.

## Known unknowns (resolved during implementation against the live page)

The app is a minified widget. Confirmed: `#ai-chat-input`, localization keys for
Send/mic aria-labels, the "Use Voice" / "Start voice mode" button, and voice-mode
states. To confirm by running against the live page and adjust the Page Object
selectors only (design unchanged):

- Exact aria-label strings for Send / mic buttons.
- Assistant-message container selector.
- Exact "Generating response from our knowledge base" text / indicator.
- Whether dictate auto-sends or needs a manual Send click.
