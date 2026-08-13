# Brand Concierge — Voice E2E tests

Playwright end-to-end tests for the "Voice in Brand Concierge" project. They exercise
three input/output modes against the deployed widget and check that the AI reply is
"long enough" (a configurable word-count floor).

| # | Test | Input | Output |
|---|------|-------|--------|
| 1 | Text input   | typed text                | text |
| 2 | Dictate mode | voice (Web Speech API)    | text |
| 3 | Use Voice    | voice (streamed to backend STT) | text + voice |

## Running

```sh
npm install
npx playwright install chromium   # first time only
npm test                          # runs all three tests
npm run test:headed               # watch them run
```

The suite is **Chromium-only**: voice injection relies on Chromium's
`--use-file-for-fake-audio-capture` launch flag, which Firefox/WebKit don't support.

## Configuration

All tunables live in [`config/bc-voice.config.json`](config/bc-voice.config.json):
the target URL, the text/voice message, the minimum response word count, the audio
fixture paths, and timeouts. Change them there without touching test code (field
docs are on the `BcVoiceConfig` interface in `tests/support/config.ts`).

## Voice fixtures

The prerecorded voice WAV is committed under `fixtures/audio/`. Regenerate it (e.g.
after changing `textMessage`) with:

```sh
npm run gen-audio
```

This uses macOS `say` + `ffmpeg` (`scripts/generate-audio.sh`). The committed WAV
keeps CI portable on machines without `say`. The file is speech followed by a few
seconds of trailing silence — Use Voice mode's server-side voice-activity detection
needs that silent tail to detect end-of-turn, because Chromium loops the fake-mic
file with no gap.

## How each mode is driven

- **Text** — fills `#ai-chat-input` and clicks Send.
- **Use Voice** — clicks "Use Voice"; the fake mic streams the WAV to the backend,
  which transcribes it. This is a true audio-file-driven test.
- **Dictate** — the dictate button uses the browser Web Speech API
  (`webkitSpeechRecognition`), which uses a cloud service and **ignores** the
  fake-audio file in automation. So the test installs a small `SpeechRecognition`
  stub that emits the configured message as the transcript, matching exactly how the
  widget consumes results (`event.results[i][0].transcript`, `results[0].isFinal`).
  The widget then submits normally. The stub is the only reliable way to drive Web
  Speech dictation headlessly; it verifies the dictate → transcribe → submit → reply
  flow deterministically.

## Layout

```
config/bc-voice.config.json       # all tunables
fixtures/audio/marathon-message.wav
scripts/generate-audio.sh         # regenerates the WAV
tests/support/config.ts           # loads + validates the config
tests/support/concierge.page.ts   # Page Object
tests/bc-voice.spec.ts            # the 3 tests
```
