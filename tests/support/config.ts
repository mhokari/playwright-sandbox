import { readFileSync } from 'fs';
import { resolve, isAbsolute } from 'path';

/** Shape of config/bc-voice.config.json. */
export interface BcVoiceConfig {
  /** The page under test. */
  url: string;
  /**
   * Used for the text test, and spoken in the generated voice fixtures. If you
   * change this, regenerate the audio: ./scripts/generate-audio.sh
   */
  textMessage: string;
  /**
   * A reply passes when its word count is at least this value. The text/dictate
   * reply is often a short clarifying question (~15 words), so keep this a modest
   * floor that still distinguishes a real answer from an empty/error reply.
   */
  minResponseWords: number;
  audio: {
    /** Absolute path to the WAV fed to the fake mic in Dictate mode. */
    dictate: string;
    /** Absolute path to the WAV fed to the fake mic in Use Voice mode. */
    voice: string;
  };
  timeouts: {
    /** How long to wait for the AI response to finish generating. */
    responseMs: number;
    /** How long to wait for individual UI actions/elements. */
    actionMs: number;
  };
}

/** Repo root (two levels up from tests/support). */
export const REPO_ROOT = resolve(__dirname, '..', '..');

const CONFIG_PATH = resolve(REPO_ROOT, 'config', 'bc-voice.config.json');

function toAbs(p: string): string {
  return isAbsolute(p) ? p : resolve(REPO_ROOT, p);
}

function required<T>(value: T | undefined | null, name: string): T {
  if (value === undefined || value === null || value === '') {
    throw new Error(`bc-voice.config.json: missing required field "${name}"`);
  }
  return value;
}

let cached: BcVoiceConfig | undefined;

/** Loads, validates, and caches the config. Audio paths are resolved to absolute. */
export function loadConfig(): BcVoiceConfig {
  if (cached) return cached;

  const raw = JSON.parse(readFileSync(CONFIG_PATH, 'utf8')) as any;
  if (!raw || typeof raw !== 'object') {
    throw new Error(`bc-voice.config.json: could not parse config at ${CONFIG_PATH}`);
  }

  cached = {
    url: required<string>(raw.url, 'url'),
    textMessage: required<string>(raw.textMessage, 'textMessage'),
    minResponseWords: required<number>(raw.minResponseWords, 'minResponseWords'),
    audio: {
      dictate: toAbs(required<string>(raw.audio?.dictate, 'audio.dictate')),
      voice: toAbs(required<string>(raw.audio?.voice, 'audio.voice')),
    },
    timeouts: {
      responseMs: required<number>(raw.timeouts?.responseMs, 'timeouts.responseMs'),
      actionMs: required<number>(raw.timeouts?.actionMs, 'timeouts.actionMs'),
    },
  };
  return cached;
}

/** Word count used by the "response long enough" assertion. */
export function wordCount(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}
