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

test('Dictate mode: spoken message is transcribed and gets a text reply', async ({ page }) => {
  // Install SpeechRecognition stub before navigation
  await page.addInitScript((text: string) => {
    class FakeSpeechRecognition {
      continuous = false
      interimResults = false
      lang = ''
      onstart: ((e: any) => void) | null = null
      onresult: ((e: any) => void) | null = null
      onend: ((e: any) => void) | null = null
      onerror: ((e: any) => void) | null = null
      private active = false

      private makeEvent(isFinal: boolean) {
        const alternative = { transcript: text, confidence: 0.98 }
        const result: any = [alternative]
        result.isFinal = isFinal
        const results: any = [result]
        return { results, resultIndex: 0 }
      }

      start() {
        if (this.active) return
        this.active = true
        setTimeout(() => {
          if (!this.active) return
          this.onstart?.({})
          this.onresult?.(this.makeEvent(false))
          this.onresult?.(this.makeEvent(true))
        }, 150)
      }
      stop() {
        if (!this.active) return
        this.active = false
        this.onend?.({})
      }
      abort() {
        if (!this.active) return
        this.active = false
        this.onend?.({})
      }
      addEventListener() {}
      removeEventListener() {}
    }
    ;(window as any).SpeechRecognition = FakeSpeechRecognition
    ;(window as any).webkitSpeechRecognition = FakeSpeechRecognition
  }, TEXT_MESSAGE)

  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' })

  const input = page.locator('#ai-chat-input')
  const micButton = page.locator('.mic-button')
  const replies = page.locator('.chat-message.concierge-message .message-text')

  await input.waitFor({ state: 'visible', timeout: ACTION_TIMEOUT_MS })

  const baseline = await replies.count()

  // Click the dictate (mic) button
  await micButton.click({ timeout: ACTION_TIMEOUT_MS })

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
