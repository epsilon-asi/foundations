import type { ClearFieldStrategy } from './FieldClearer.js';
import type { HumanTypingOptions } from './HumanTyping.js';

export interface HumanClickOptions {
  waitForSelector?: boolean;
  timeoutMs?: number;
  cursorOptions?: Record<string, unknown>;
}

export interface HumanMoveOptions {
  timeoutMs?: number;
  cursorOptions?: Record<string, unknown>;
}

export interface HumanTypeOptions {
  /** Legacy Puppeteer keyboard delay. Used as key-hold delay for human typing, or bulk delay when human typing is disabled. */
  delayMs?: number;
  clear?: boolean;
  /** Defaults to selecting the field contents and pressing Backspace before typing. */
  clearMethod?: ClearFieldStrategy;
  clickBeforeTyping?: boolean;
  timeoutMs?: number;
  /** Human-like key-by-key typing configuration. Enabled by default at approximately 65 WPM. */
  typing?: HumanTypingOptions;
}

export interface HumanInteractor {
  click(selector: string, options?: HumanClickOptions): Promise<void>;
  move(selector: string, options?: HumanMoveOptions): Promise<void>;
  type(selector: string, value: string, options?: HumanTypeOptions): Promise<void>;
  scrollIntoView(selector: string): Promise<void>;
}
