import { test } from '@playwright/test';
import { loadConfig } from './support/config';
import { ConciergePage } from './support/concierge.page';

const config = loadConfig();

/**
 * E2E tests for the Voice in Brand Concierge project.
 *
 * Chromium-only (see playwright.config.ts). Each test drives one input/output mode
 * against the deployed widget and verifies the AI reply is "long enough".
 */

test.describe('Brand Concierge — Voice', () => {
  // Test 1: Text input. User types text; service responds in text only.
  test('Text input: typed message gets a substantive text reply', async ({ page }) => {
    const concierge = new ConciergePage(page, config);
    await concierge.goto();

    const baseline = await concierge.replyCount();
    await concierge.typeAndSend(config.textMessage);

    const reply = await concierge.waitForResponse(baseline);
    concierge.assertLongEnough(reply);
  });

  // Test 2: Dictate mode. User speaks; service responds in text only.
  // The Web Speech API can't be driven by an audio file in automation, so a
  // deterministic SpeechRecognition stub emits the configured message as the
  // transcript (installed before navigation).
  test('Dictate mode: spoken message is transcribed and gets a text reply', async ({ page }) => {
    const concierge = new ConciergePage(page, config);
    await concierge.installDictationStub(config.textMessage);
    await concierge.goto();

    const baseline = await concierge.replyCount();
    await concierge.dictate();

    const reply = await concierge.waitForResponse(baseline);
    concierge.assertLongEnough(reply);
  });

  // Test 3: Use Voice mode. User speaks (real fake-mic audio streamed to the backend
  // STT); service responds in text and voice. We verify the text reply is long enough.
  test('Use Voice mode: spoken message via fake mic gets a substantive reply', async ({ page }) => {
    const concierge = new ConciergePage(page, config);
    await concierge.goto();

    const baseline = await concierge.replyCount();
    await concierge.useVoice();

    const reply = await concierge.waitForResponse(baseline);
    concierge.assertLongEnough(reply);
  });
});
