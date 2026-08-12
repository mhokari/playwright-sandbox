import { test, expect } from '@playwright/test'

const TARGET_URL = process.env.ENVIRONMENT_URL ?? 'https://d3mey6isb8np59.cloudfront.net/dsg-bc-voice/index.html'
const TEXT_MESSAGE = 'I am preparing a full marathon and want to have a pair of new shoes.'
const MIN_RESPONSE_WORDS = 8
const RESPONSE_TIMEOUT_MS = 60_000
const ACTION_TIMEOUT_MS = 15_000

function wordCount(text: string): number {
  const trimmed = text.trim()
  if (!trimmed) return 0
  return trimmed.split(/\s+/).length
}

test('Text input: typed message gets a substantive text reply', async ({ page }) => {
  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' })

  const input = page.locator('#ai-chat-input')
  const sendButton = page.locator('.action-button--send')
  const replies = page.locator('.chat-message.concierge-message .message-text')

  await input.waitFor({ state: 'visible', timeout: ACTION_TIMEOUT_MS })

  const baseline = await replies.count()

  // Type message and send
  await input.click()
  await input.fill(TEXT_MESSAGE)
  await sendButton.click({ timeout: ACTION_TIMEOUT_MS })

  // Wait for a new reply to appear
  await expect
    .poll(() => replies.count(), {
      timeout: RESPONSE_TIMEOUT_MS,
      message: 'Timed out waiting for a new assistant reply to appear',
    })
    .toBeGreaterThan(baseline)

  // Wait for reply text to stabilize (generation finished)
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
