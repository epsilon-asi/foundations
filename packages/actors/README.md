# Puppeteer Actor Framework

A TypeScript framework for building website-specific Puppeteer scrapers and actors with reusable login, navigation, extraction, pagination, and human-like interaction abstractions.

The browser runtime supports three practical flows:

1. Launch installed Chrome with an existing persistent profile.
2. Attach to an already-running Chrome through a local DevTools / remote-debugging endpoint.
3. Try flow 1 first, and if Chrome reports that the profile is already running, automatically fall back to flow 2.

That third flow is the default for `existing-profile` mode. It lets the caller pass a normal Chrome profile config while still supporting multiple concurrent actors against a single debug-enabled Chrome host.

## What it gives you

- Existing Chrome profile launch via `userDataDir` and optional `--profile-directory`.
- Automatic profile-lock fallback through Puppeteer `connect()`.
- Explicit remote-debugging mode using `browserURL` or `browserWSEndpoint`.
- `browser.defaultBrowserContext()` usage instead of isolated contexts.
- Fresh tab per connected actor by default, so simultaneous automations do not fight over the same tab.
- Connected sessions call `browser.disconnect()` instead of closing the shared browser.
- Reusable `LoginFlow` for simple and multi-step username/password login when the existing profile is not already authenticated.
- `ghost-cursor` adapter behind a `HumanInteractor` interface.
- Human-like key-by-key typing at approximately 65 WPM by default, with small randomized inter-key jitter.
- Login-flow `clearFieldBeforeTyping` support that selects and deletes existing username/password field contents before typing.
- Ordered multi-step login flows for username-first/password-second forms like Apple ID, Upwork, and similar staged UIs.
- Strict TypeScript configuration and Vitest unit tests with fake browser/page/cursor fixtures.

## Install

```bash
npm install
```

## Verify

```bash
npm run check
```

This runs:

```bash
npm run typecheck
npm test
```

## Existing profile mode with automatic running-Chrome fallback

Use the parent Chrome user data directory as `userDataDir`, and use `profileDirectory` for the nested profile folder.

```ts
import { ActorRunner, exampleActor } from 'puppeteer-actor-framework';

const runner = new ActorRunner({
  config: {
    browser: {
      mode: 'existing-profile',
      userDataDir: '/Users/alex/ChromeAutomation/UserData',
      profileDirectory: 'Default',
      channel: 'chrome',
      headless: false,
      runningInstance: {
        enabled: true,
        remoteDebuggingHost: '127.0.0.1',
        remoteDebuggingPort: 9222,
        reuseExistingPage: false,
        disconnectOnFinish: true
      }
    }
  }
});

const rows = await runner.run(exampleActor, 'scrapeDashboard', { limit: 20 });
console.log(rows);
```

Behavior:

```txt
Chrome profile not already running:
  puppeteer.launch({ userDataDir, args: ['--profile-directory=Default'] })

Chrome profile already running:
  puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' })
```

`runningInstance.enabled` defaults to `true`, so this fallback happens automatically when a profile-lock launch error is detected. To disable it:

```ts
browser: {
  mode: 'existing-profile',
  userDataDir: '/Users/alex/ChromeAutomation/UserData',
  profileDirectory: 'Default',
  runningInstance: { enabled: false }
}
```

Correct profile path usage:

```txt
userDataDir:       /Users/alex/ChromeAutomation/UserData
profileDirectory: Default
```

Incorrect:

```txt
userDataDir: /Users/alex/ChromeAutomation/UserData/Default
```

## Explicit remote-debugging mode

Use this when you know Chrome is already running and you only want to attach.

```ts
const runner = new ActorRunner({
  config: {
    browser: {
      mode: 'remote-debugging',
      browserURL: 'http://127.0.0.1:9222',
      reuseExistingPage: false
    }
  }
});
```

In connect mode, `reuseExistingPage` defaults to `false`, so each actor run opens a fresh tab in the connected Chrome instance.

## Enabling Chrome's debug endpoint

Start Chrome with a local remote-debugging endpoint and a persistent automation profile. Keep the endpoint bound to `127.0.0.1` unless you have a secured tunneling setup.

### macOS

```bash
mkdir -p "$HOME/.chrome-automation/user-data"

/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-address=127.0.0.1 \
  --remote-debugging-port=9222 \
  --user-data-dir="$HOME/.chrome-automation/user-data" \
  --profile-directory="Default" \
  --no-first-run \
  --no-default-browser-check
```

### Linux

```bash
mkdir -p "$HOME/.chrome-automation/user-data"

google-chrome \
  --remote-debugging-address=127.0.0.1 \
  --remote-debugging-port=9222 \
  --user-data-dir="$HOME/.chrome-automation/user-data" \
  --profile-directory="Default" \
  --no-first-run \
  --no-default-browser-check
```

### Windows PowerShell

```powershell
New-Item -ItemType Directory -Force "$env:USERPROFILE\.chrome-automation\user-data"

& "C:\Program Files\Google\Chrome\Application\chrome.exe" `
  --remote-debugging-address=127.0.0.1 `
  --remote-debugging-port=9222 `
  --user-data-dir="$env:USERPROFILE\.chrome-automation\user-data" `
  --profile-directory="Default" `
  --no-first-run `
  --no-default-browser-check
```

Verify the endpoint:

```bash
curl http://127.0.0.1:9222/json/version
```

You should see JSON containing a `webSocketDebuggerUrl`.

## CLI examples

Build first:

```bash
npm run build
```

Pass a profile and let the framework launch or connect automatically:

```bash
CHROME_USER_DATA_DIR="$HOME/.chrome-automation/user-data" \
CHROME_PROFILE_DIRECTORY="Default" \
CHROME_REMOTE_DEBUGGING_PORT="9222" \
node dist/cli/run.js example scrapeDashboard '{"limit": 10}'
```

Attach directly to an already-running Chrome:

```bash
CHROME_REMOTE_DEBUGGING_URL="http://127.0.0.1:9222" \
node dist/cli/run.js example scrapeDashboard '{"limit": 10}'
```

Run multiple actors simultaneously against the same Chrome host:

```bash
CHROME_USER_DATA_DIR="$HOME/.chrome-automation/user-data" \
CHROME_PROFILE_DIRECTORY="Default" \
node dist/cli/run.js example scrapeDashboard '{"limit": 10}' &

CHROME_USER_DATA_DIR="$HOME/.chrome-automation/user-data" \
CHROME_PROFILE_DIRECTORY="Default" \
node dist/cli/run.js example scrapeDashboard '{"limit": 20}' &

wait
```

Each connected actor opens its own page and disconnects its Puppeteer client on completion without closing Chrome.


## Human-like typing

Text entry is key-by-key by default. The framework targets approximately 65 WPM using the standard typing-speed convention of five characters per word, so the default average inter-key interval is about 185 ms. A small symmetric jitter is applied per keystroke so typing is not perfectly mechanical.

You can tune typing globally through `RuntimeConfig.interaction.typing`:

```ts
const runner = new ActorRunner({
  config: {
    browser: {
      mode: 'existing-profile',
      userDataDir: '/Users/alex/ChromeAutomation/UserData',
      profileDirectory: 'Default'
    },
    interaction: {
      typing: {
        targetWordsPerMinute: 65,
        intervalJitterMs: 18,
        minimumIntervalMs: 20
      }
    }
  }
});
```

You can also tune a specific form field or actor task:

```ts
await context.forms.fillText('#search', 'quarterly report', {
  typing: {
    targetWordsPerMinute: 65,
    intervalJitterMs: 12
  }
});
```

To disable human typing for a field and send the whole value through Puppeteer's bulk keyboard input:

```ts
await context.forms.fillText('#fast-field', 'value', {
  typing: { enabled: false }
});
```

## Login field clearing

The standardized login flow now clears username and password fields by selecting the existing contents, pressing `Backspace`, and then typing the new value. This is enabled by default.

```ts
auth: defineLoginFlow({
  loginUrl: 'https://example.com/login',
  credentials: { id: 'my-site' },
  selectors: {
    username: '#email',
    password: '#password',
    submit: 'button[type="submit"]',
    loggedInSignal: '[data-testid="account-menu"]'
  },
  behavior: {
    clearFieldBeforeTyping: true,
    typing: {
      targetWordsPerMinute: 65,
      intervalJitterMs: 18
    }
  }
})
```

Set `clearFieldBeforeTyping: false` only for unusual sites where clearing fields breaks the login widget.

## Multi-step login forms

Some sites do not show the password field until after the username step. For those cases, keep `selectors.loggedInSignal` and define an ordered `steps` array. The simple `selectors.username/password/submit` fields become optional because the steps provide each field and button.

```ts
auth: defineLoginFlow({
  loginUrl: 'https://example.com/login',
  credentials: {
    id: 'staged-site',
    usernameEnv: 'STAGED_SITE_USERNAME',
    passwordEnv: 'STAGED_SITE_PASSWORD'
  },
  selectors: {
    loggedInSignal: '[data-testid="account-menu"]',
    errorMessage: '[data-testid="login-error"]'
  },
  behavior: {
    clearFieldBeforeTyping: true,
    errorTimeoutMs: 750,
    typing: {
      targetWordsPerMinute: 65,
      intervalJitterMs: 18
    }
  },
  steps: [
    {
      type: 'fill',
      name: 'username',
      selector: '#username',
      credential: 'username'
    },
    {
      type: 'click',
      name: 'continue to password',
      selector: 'button[type="submit"]',
      waitForSelector: '#password',
      waitForSelectorTimeoutMs: 10_000
    },
    {
      type: 'fill',
      name: 'password',
      selector: '#password',
      credential: 'password'
    },
    {
      type: 'click',
      name: 'submit password',
      selector: 'button[type="submit"]',
      submit: true,
      waitForNavigation: true,
      navigationOptions: { waitUntil: 'domcontentloaded' }
    }
  ]
})
```

The `click` step can wait for the next stage with `waitForSelector`. If `selectors.errorMessage` is configured, the framework checks for that error after click/wait steps, so an invalid username can fail cleanly before the password field ever appears.

Each fill step can override the global login behavior:

```ts
steps: [
  {
    type: 'fill',
    selector: '#username',
    credential: 'username',
    clearFieldBeforeTyping: true
  },
  {
    type: 'fill',
    selector: '#password',
    credential: 'password',
    clearFieldBeforeTyping: false,
    typing: { targetWordsPerMinute: 72, intervalJitterMs: 10 }
  }
]
```

The `submit: true` flag marks the final button step, so existing `beforeSubmit` and `afterSubmit` hooks still run around that click. For unusual login screens, a step can also provide `before` and `after` hooks, or you can insert a custom hook step:

```ts
steps: [
  { type: 'fill', selector: '#email', credential: 'username' },
  { type: 'click', selector: '#continue', waitForSelector: '#password' },
  {
    type: 'hook',
    name: 'accept optional prompt',
    run: async context => {
      if (await context.page.exists('#remember-device', { timeout: 500 })) {
        await context.cursor.click('#remember-device');
      }
    }
  },
  { type: 'fill', selector: '#password', credential: 'password' },
  { type: 'click', selector: '#sign-in', submit: true }
]
```

## Creating a site actor

```ts
import { defineActor, defineLoginFlow } from 'puppeteer-actor-framework';

export const mySiteActor = defineActor({
  id: 'my-site',
  baseUrl: 'https://example.com',
  auth: defineLoginFlow({
    loginUrl: 'https://example.com/login',
    credentials: {
      id: 'my-site',
      usernameEnv: 'MY_SITE_USERNAME',
      passwordEnv: 'MY_SITE_PASSWORD'
    },
    selectors: {
      username: '#email',
      password: '#password',
      submit: 'button[type="submit"]',
      loggedInSignal: '[data-testid="account-menu"]'
    }
  }),
  tasks: {
    scrapeDashboard: async context => {
      await context.nav.goto('/dashboard');
      return context.extract.textList('[data-testid="dashboard-row"]');
    }
  }
});
```

## Important operational notes

Chrome can lock a profile while it is already open. This framework responds by connecting to the local debug endpoint when `runningInstance.enabled` is true.

Recent Chrome versions require a non-standard `--user-data-dir` when using remote debugging. The recommended setup is a dedicated persistent automation profile, such as:

```txt
~/.chrome-automation/user-data
```

Log into the required sites once in that Chrome window, then reuse the profile for automation.

Do not expose the remote debugging port publicly. Bind it to `127.0.0.1` unless you have a separately secured tunnel. Use this for legitimate automation and scraping you are authorized to perform; this project does not include CAPTCHA bypassing, stealth evasion, credential harvesting, or anti-bot circumvention logic.
