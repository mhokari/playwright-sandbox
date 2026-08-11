import { defineConfig, devices } from '@playwright/test';
import { loadConfig } from './tests/support/config';

/**
 * See https://playwright.dev/docs/test-configuration.
 *
 * The Brand Concierge voice tests are Chromium-only: voice injection relies on
 * Chromium's fake-audio-capture launch flags, which Firefox/WebKit do not support.
 */
const bc = loadConfig();

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  /* Per-test timeout must comfortably exceed the AI response timeout. */
  timeout: bc.timeouts.responseMs + 60_000,
  use: {
    trace: 'on-first-retry',
    /* Auto-grant microphone so the dictate/voice tests never see a permission prompt. */
    permissions: ['microphone'],
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            '--use-fake-device-for-media-stream',
            '--use-fake-ui-for-media-stream',
            // The fake mic replays this WAV on loop. Both voice tests use the same file.
            `--use-file-for-fake-audio-capture=${bc.audio.voice}`,
          ],
        },
      },
    },
  ],
});
