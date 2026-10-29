import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { AppleScriptExecutor } from '../drivers.js';
import type { WindowMatcher } from '../types.js';
import { appleScriptString } from '../utils/appleScriptEscape.js';

const execFileAsync = promisify(execFile);

export class OsaScriptExecutor implements AppleScriptExecutor {
  async execute(script: string, options: { timeoutMs?: number } = {}): Promise<string> {
    const { stdout } = await execFileAsync('osascript', ['-l', 'AppleScript', '-e', script], {
      timeout: options.timeoutMs ?? 15_000,
      maxBuffer: 1024 * 1024
    });
    return stdout.trim();
  }
}

export interface MacOSAppleScriptClientOptions {
  executor?: AppleScriptExecutor;
  timeoutMs?: number;
}

function matcherCondition(matcher: WindowMatcher): string {
  const conditions: string[] = [];
  if (matcher.title !== undefined) {
    conditions.push(`name of candidateWindow is ${appleScriptString(matcher.title)}`);
  }
  if (matcher.titleIncludes !== undefined) {
    conditions.push(`name of candidateWindow contains ${appleScriptString(matcher.titleIncludes)}`);
  }
  if (matcher.role !== undefined) {
    conditions.push(`role of candidateWindow is ${appleScriptString(matcher.role)}`);
  }
  return conditions.length === 0 ? 'true' : conditions.join(' and ');
}

function processTarget(matcher: WindowMatcher, fallbackAppName: string): string {
  return appleScriptString(matcher.appName ?? fallbackAppName);
}

export class MacOSAppleScriptClient {
  private readonly executor: AppleScriptExecutor;
  private readonly timeoutMs: number;

  constructor(options: MacOSAppleScriptClientOptions = {}) {
    this.executor = options.executor ?? new OsaScriptExecutor();
    this.timeoutMs = options.timeoutMs ?? 15_000;
  }

  async execute(script: string, timeoutMs?: number): Promise<string> {
    return this.executor.execute(script, { timeoutMs: timeoutMs ?? this.timeoutMs });
  }

  async isWindowOpen(matcher: WindowMatcher, fallbackAppName = 'Google Chrome'): Promise<boolean> {
    const script = `
      tell application "System Events"
        if not (exists process ${processTarget(matcher, fallbackAppName)}) then return "false"
        tell process ${processTarget(matcher, fallbackAppName)}
          repeat with candidateWindow in windows
            if ${matcherCondition(matcher)} then return "true"
          end repeat
        end tell
      end tell
      return "false"
    `;
    return (await this.execute(script)) === 'true';
  }

  async focusWindow(matcher: WindowMatcher, fallbackAppName = 'Google Chrome'): Promise<void> {
    const script = `
      tell application ${processTarget(matcher, fallbackAppName)} to activate
      tell application "System Events"
        tell process ${processTarget(matcher, fallbackAppName)}
          repeat with candidateWindow in windows
            if ${matcherCondition(matcher)} then
              perform action "AXRaise" of candidateWindow
              return
            end if
          end repeat
        end tell
      end tell
    `;
    await this.execute(script);
  }

  async setFullscreen(matcher: WindowMatcher, fullscreen: boolean, fallbackAppName = 'Google Chrome'): Promise<void> {
    const desired = fullscreen ? 'true' : 'false';
    const script = `
      tell application ${processTarget(matcher, fallbackAppName)} to activate
      tell application "System Events"
        tell process ${processTarget(matcher, fallbackAppName)}
          repeat with candidateWindow in windows
            if ${matcherCondition(matcher)} then
              set currentFullscreen to false
              try
                set currentFullscreen to value of attribute "AXFullScreen" of candidateWindow
              end try
              if currentFullscreen is not ${desired} then
                try
                  perform action "AXPress" of (first button of candidateWindow whose subrole is "AXFullScreenButton")
                on error
                  click (first button of candidateWindow whose subrole is "AXFullScreenButton")
                end try
              end if
              return
            end if
          end repeat
        end tell
      end tell
    `;
    await this.execute(script);
  }

  async toggleFullscreen(matcher: WindowMatcher, fallbackAppName = 'Google Chrome'): Promise<void> {
    const script = `
      tell application ${processTarget(matcher, fallbackAppName)} to activate
      tell application "System Events"
        tell process ${processTarget(matcher, fallbackAppName)}
          repeat with candidateWindow in windows
            if ${matcherCondition(matcher)} then
              try
                perform action "AXPress" of (first button of candidateWindow whose subrole is "AXFullScreenButton")
              on error
                click (first button of candidateWindow whose subrole is "AXFullScreenButton")
              end try
              return
            end if
          end repeat
        end tell
      end tell
    `;
    await this.execute(script);
  }

  async minimize(matcher: WindowMatcher, fallbackAppName = 'Google Chrome'): Promise<void> {
    const script = `
      tell application "System Events"
        tell process ${processTarget(matcher, fallbackAppName)}
          repeat with candidateWindow in windows
            if ${matcherCondition(matcher)} then
              try
                perform action "AXPress" of (first button of candidateWindow whose subrole is "AXMinimizeButton")
              on error
                set value of attribute "AXMinimized" of candidateWindow to true
              end try
              return
            end if
          end repeat
        end tell
      end tell
    `;
    await this.execute(script);
  }

  async selectFileInOpenDialog(filePath: string, appName = 'Google Chrome', timeoutMs?: number): Promise<void> {
    const script = `
      set targetPath to ${appleScriptString(filePath)}
      tell application ${appleScriptString(appName)} to activate
      tell application "System Events"
        tell process ${appleScriptString(appName)}
          set frontmost to true
          set waited to 0
          repeat while waited < 100
            if (exists window 1) then exit repeat
            delay 0.1
            set waited to waited + 1
          end repeat
          keystroke "g" using {command down, shift down}
          delay 0.2
          set the clipboard to targetPath
          keystroke "v" using {command down}
          delay 0.1
          key code 36
          delay 0.2
          key code 36
        end tell
      end tell
    `;
    await this.execute(script, timeoutMs);
  }
}
