import { readFileSync } from 'fs';
import { resolve, isAbsolute } from 'path';
import yaml from 'js-yaml';

/** Shape of config/bc-voice.config.yaml. */
export interface BcVoiceConfig {
  url: string;
  textMessage: string;
  minResponseWords: number;
  audio: {
    /** Absolute path to the WAV fed to the fake mic in Dictate mode. */
    dictate: string;
    /** Absolute path to the WAV fed to the fake mic in Use Voice mode. */
    voice: string;
  };
  timeouts: {
    responseMs: number;
    actionMs: number;
  };
}

/** Repo root (two levels up from tests/support). */
export const REPO_ROOT = resolve(__dirname, '..', '..');

const CONFIG_PATH = resolve(REPO_ROOT, 'config', 'bc-voice.config.yaml');

function toAbs(p: string): string {
  return isAbsolute(p) ? p : resolve(REPO_ROOT, p);
}

function required<T>(value: T | undefined | null, name: string): T {
  if (value === undefined || value === null || value === '') {
    throw new Error(`bc-voice.config.yaml: missing required field "${name}"`);
  }
  return value;
}

let cached: BcVoiceConfig | undefined;

/** Loads, validates, and caches the YAML config. Audio paths are resolved to absolute. */
export function loadConfig(): BcVoiceConfig {
  if (cached) return cached;

  const raw = yaml.load(readFileSync(CONFIG_PATH, 'utf8')) as any;
  if (!raw || typeof raw !== 'object') {
    throw new Error(`bc-voice.config.yaml: could not parse config at ${CONFIG_PATH}`);
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
