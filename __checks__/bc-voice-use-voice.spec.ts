import { test, expect } from '@playwright/test'
import path from 'path'

const TARGET_URL = process.env.ENVIRONMENT_URL ?? 'https://d3mey6isb8np59.cloudfront.net/dsg-bc-voice/index.html'
const MIN_RESPONSE_WORDS = 8
const RESPONSE_TIMEOUT_MS = 60_000
const ACTION_TIMEOUT_MS = 15_000

// The WAV fixture is bundled alongside this spec
export const AUDIO_FILE = path.join(__dirname, 'marathon-message.wav')

function wordCount(text: string): number {
  const trimmed = text.trim()
  if (!trimmed) return 0
  return trimmed.split(/\s+/).length
}

test('Use Voice mode: spoken message via fake mic gets a substantive reply', async ({ page }) => {
  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' })

  const input = page.locator('#ai-chat-input')
  const voiceButton = page.locator('.action-button--voice')
  const replies = page.locator('.chat-message.concierge-message .message-text')

  await input.waitFor({ state: 'visible', timeout: ACTION_TIMEOUT_MS })

  const baseline = await replies.count()

  // Click "Use Voice" button - the fake mic streams the WAV to backend STT
  await voiceButton.click({ timeout: ACTION_TIMEOUT_MS })

  // Wait for a new reply to appear
  await expect
    .poll(() => replies.count(), {
      timeout: RESPONSE_TIMEOUT_MS,
      message: 'Timed out waiting for a new assistant reply to appear',
    })
    .toBeGreaterThan(baseline)

  // Wait for reply text to stabilize
  const deadline = Date.now() + RESPONSE_TIMEOUT_MS
  let lastText = ''
  let stableSince = 0
  const stableForMs = 2500

  while (Date.now() < deadline) {
    const count = await replies.count()
    const text = count > 0 ? (await replies.nth(count - 1).textContent())?.trim() ?? '' : ''
    if (text && text === lastText) {
      if (stableSince === 0) stableSince = Date.now()
      if (Date.now() - stableSince >= stableForMs) break
    } else {
      lastText = text
      stableSince = 0
    }
    await page.waitForTimeout(500)
  }

  // Assert the reply is long enough
  const words = wordCount(lastText)
  expect(
    words,
    `Expected reply to have at least ${MIN_RESPONSE_WORDS} words, got ${words}: "${lastText}"`,
  ).toBeGreaterThanOrEqual(MIN_RESPONSE_WORDS)
})
