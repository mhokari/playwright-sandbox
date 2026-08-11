import { Page, Locator, expect } from '@playwright/test';
import { BcVoiceConfig, wordCount } from './config';

/**
 * Page Object for the Brand Concierge widget.
 *
 * Selectors were confirmed against the deployed widget:
 *   - text input:      #ai-chat-input
 *   - Send button:     .action-button--send   (appears once the input has text)
 *   - Use Voice button:.action-button--voice  (shown when the input is empty)
 *   - Dictate mic:     .mic-button
 *   - assistant reply: .chat-message.concierge-message .message-text
 *   - busy indicator:  text "Generating response from our knowledge base"
 */
export class ConciergePage {
  readonly page: Page;
  readonly config: BcVoiceConfig;

  readonly input: Locator;
  readonly sendButton: Locator;
  readonly voiceButton: Locator;
  readonly micButton: Locator;
  readonly replies: Locator;

  constructor(page: Page, config: BcVoiceConfig) {
    this.page = page;
    this.config = config;
    this.input = page.locator('#ai-chat-input');
    this.sendButton = page.locator('.action-button--send');
    this.voiceButton = page.locator('.action-button--voice');
    this.micButton = page.locator('.mic-button');
    this.replies = page.locator('.chat-message.concierge-message .message-text');
  }

  /**
   * Installs a fake Web Speech API so Dictate mode is deterministic.
   *
   * The real `webkitSpeechRecognition` uses a cloud service and ignores Chromium's
   * fake-audio-capture file, so it cannot be driven by an audio fixture in
   * automation. This stub emits `transcript` as the recognition result, matching how
   * the widget consumes results: `event.results[i][0].transcript` and
   * `event.results[0].isFinal`. It submits on the final result, exactly like a real
   * dictation.
   *
   * Must be called BEFORE `goto()` (init scripts run before page scripts).
   */
  async installDictationStub(transcript: string): Promise<void> {
    await this.page.addInitScript((text: string) => {
      class FakeSpeechRecognition {
        continuous = false;
        interimResults = false;
        lang = '';
        onstart: ((e: any) => void) | null = null;
        onresult: ((e: any) => void) | null = null;
        onend: ((e: any) => void) | null = null;
        onerror: ((e: any) => void) | null = null;
        // Guards against re-entrancy: the widget's onend handler calls stop() again,
        // which would recurse infinitely (stop -> onend -> stop) without this flag.
        private active = false;

        private makeEvent(isFinal: boolean) {
          const alternative = { transcript: text, confidence: 0.98 };
          const result: any = [alternative];
          result.isFinal = isFinal;
          const results: any = [result];
          return { results, resultIndex: 0 };
        }

        start() {
          if (this.active) return;
          this.active = true;
          setTimeout(() => {
            if (!this.active) return;
            this.onstart?.({});
            this.onresult?.(this.makeEvent(false));
            // The final result triggers the widget's submit + stop() (which fires onend).
            this.onresult?.(this.makeEvent(true));
          }, 150);
        }
        stop() {
          if (!this.active) return;
          this.active = false;
          this.onend?.({});
        }
        abort() {
          if (!this.active) return;
          this.active = false;
          this.onend?.({});
        }
        addEventListener() {}
        removeEventListener() {}
      }
      (window as any).SpeechRecognition = FakeSpeechRecognition;
      (window as any).webkitSpeechRecognition = FakeSpeechRecognition;
    }, transcript);
  }

  /** Navigates to the app and waits for the widget to render its input. */
  async goto(): Promise<void> {
    await this.page.goto(this.config.url, { waitUntil: 'domcontentloaded' });
    await this.input.waitFor({ state: 'visible', timeout: this.config.timeouts.actionMs });
  }

  /** Number of assistant replies currently rendered (used as a baseline). */
  async replyCount(): Promise<number> {
    return this.replies.count();
  }

  /** Test 1: type a message and click Send. */
  async typeAndSend(text: string): Promise<void> {
    await this.input.click();
    await this.input.fill(text);
    await this.sendButton.click({ timeout: this.config.timeouts.actionMs });
  }

  /** Test 2: start dictation. With the stub installed, this transcribes and submits. */
  async dictate(): Promise<void> {
    await this.micButton.click({ timeout: this.config.timeouts.actionMs });
  }

  /** Test 3: enter Use Voice mode. The fake mic streams the WAV to the backend STT. */
  async useVoice(): Promise<void> {
    await this.voiceButton.click({ timeout: this.config.timeouts.actionMs });
  }

  /**
   * Waits for a NEW assistant reply (beyond `baselineCount`) to appear and finish
   * generating, then returns its text.
   *
   * Completion is detected by text stability: the newest reply's text must stop
   * changing for `stableForMs`. This is mode-agnostic — it handles streamed text
   * replies and voice replies alike, and does not depend on the "Generating…"
   * indicator (which never clears in voice mode because the looped fixture keeps
   * starting new turns).
   */
  async waitForResponse(baselineCount: number, stableForMs = 2500): Promise<string> {
    const deadline = Date.now() + this.config.timeouts.responseMs;

    // 1) Wait for a new reply element to appear.
    await expect
      .poll(() => this.replies.count(), {
        timeout: this.config.timeouts.responseMs,
        message: 'Timed out waiting for a new assistant reply to appear',
      })
      .toBeGreaterThan(baselineCount);

    // 2) Wait for the newest reply's text to stabilize (generation finished).
    let lastText = '';
    let stableSince = 0;
    while (Date.now() < deadline) {
      const count = await this.replies.count();
      const text = count > 0 ? (await this.replies.nth(count - 1).textContent())?.trim() ?? '' : '';
      if (text && text === lastText) {
        if (stableSince === 0) stableSince = Date.now();
        if (Date.now() - stableSince >= stableForMs) return text;
      } else {
        lastText = text;
        stableSince = 0;
      }
      await this.page.waitForTimeout(500);
    }
    if (lastText) return lastText; // return best-effort text; assertion reports length
    throw new Error('Timed out waiting for the assistant reply to stabilize');
  }

  /** Asserts the reply is "long enough" per the configured word-count floor. */
  assertLongEnough(reply: string): void {
    const words = wordCount(reply);
    expect(
      words,
      `Expected reply to have at least ${this.config.minResponseWords} words, got ${words}: "${reply}"`,
    ).toBeGreaterThanOrEqual(this.config.minResponseWords);
  }
}
