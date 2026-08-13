import { test, expect } from '@playwright/test'

const TARGET_URL = process.env.ENVIRONMENT_URL ?? 'https://d3mey6isb8np59.cloudfront.net/dsg-bc-voice/index.html'
const ACTION_TIMEOUT_MS = 15_000

test('BC Voice – Use Voice Mode', async ({ page }) => {
  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' })

  // Wait for the page to be ready
  await expect(page.locator('#ai-chat-input')).toBeVisible({ timeout: ACTION_TIMEOUT_MS })

  // Click the voice button (white/gray/blue state)
  const voiceButton = page.locator('.action-button--voice')
  await voiceButton.click()

  // Wait until the button becomes .action-button--voice-active,
  // indicating the app is actively accepting microphone input.
  // Only then does Chrome's fake audio capture get consumed by the backend STT.
  const activeVoiceButton = page.locator('.action-button--voice-active')
  await expect(activeVoiceButton).toBeVisible({ timeout: ACTION_TIMEOUT_MS })

  // Also verify via aria-label for extra confidence
  await expect(activeVoiceButton).toHaveAttribute('aria-label', 'Stop voice mode')

  // Now the marathon-message.wav is being streamed as mic input.
  // Wait for a substantive reply from the assistant (8+ words).
  const replyLocator = page.locator('.chat-message.concierge-message .message-text')
  await expect(replyLocator.last()).toContainText(/(\w+[\s]+){7,}\w+/, {
    timeout: 60_000,
  })
})
