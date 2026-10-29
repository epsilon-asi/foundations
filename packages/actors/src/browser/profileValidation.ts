import fs from 'node:fs';
import path from 'node:path';
import { ConfigError } from '../errors/ConfigError.js';
import type { ExistingChromeProfileConfig, RemoteDebuggingChromeConfig, RemoteDebuggingEndpointConfig, RunningChromeInstanceConfig } from './RuntimeConfig.js';

export function getProfileDirectoryPath(config: ExistingChromeProfileConfig): string | undefined {
  return config.profileDirectory === undefined
    ? undefined
    : path.join(config.userDataDir, config.profileDirectory);
}

export function validateExistingProfileConfig(config: ExistingChromeProfileConfig): void {
  if (config.mode !== 'existing-profile') {
    throw new ConfigError('validateExistingProfileConfig only accepts existing-profile mode.');
  }

  if (!config.userDataDir.trim()) {
    throw new ConfigError('browser.userDataDir is required for existing-profile mode.');
  }

  if (!config.allowCreatingUserDataDir && !fs.existsSync(config.userDataDir)) {
    throw new ConfigError('Configured Chrome userDataDir does not exist. Refusing to create a new profile directory.', {
      details: { userDataDir: config.userDataDir }
    });
  }

  if (config.profileDirectory !== undefined) {
    if (path.isAbsolute(config.profileDirectory) || config.profileDirectory.includes('..')) {
      throw new ConfigError('browser.profileDirectory must be a Chrome profile folder name such as Default or Profile 1, not a path.');
    }

    const profilePath = getProfileDirectoryPath(config);
    if (profilePath !== undefined && !config.allowCreatingProfileDirectory && !fs.existsSync(profilePath)) {
      throw new ConfigError('Configured Chrome profileDirectory does not exist inside userDataDir. Refusing to create a new Chrome profile.', {
        details: { profileDirectory: config.profileDirectory, profilePath }
      });
    }
  }

  if (config.runningInstance !== undefined) {
    validateRunningChromeInstanceConfig(config.runningInstance);
  }
}

export function validateRemoteDebuggingConfig(config: RemoteDebuggingChromeConfig): void {
  if (config.mode !== 'remote-debugging') {
    throw new ConfigError('validateRemoteDebuggingConfig only accepts remote-debugging mode.');
  }

  validateRemoteDebuggingEndpointConfig(config);
}

export function validateRunningChromeInstanceConfig(config: RunningChromeInstanceConfig): void {
  validateRemoteDebuggingEndpointConfig(config);
}

function validateRemoteDebuggingEndpointConfig(config: RemoteDebuggingEndpointConfig): void {
  if (config.browserURL !== undefined && config.browserWSEndpoint !== undefined) {
    throw new ConfigError('Use either browser.browserURL or browser.browserWSEndpoint, not both.');
  }

  if (config.browserURL !== undefined && config.browserURL.trim().length === 0) {
    throw new ConfigError('browser.browserURL cannot be empty.');
  }

  if (config.browserWSEndpoint !== undefined && config.browserWSEndpoint.trim().length === 0) {
    throw new ConfigError('browser.browserWSEndpoint cannot be empty.');
  }

  if (config.remoteDebuggingPort !== undefined && (!Number.isInteger(config.remoteDebuggingPort) || config.remoteDebuggingPort < 1 || config.remoteDebuggingPort > 65_535)) {
    throw new ConfigError('browser.remoteDebuggingPort must be an integer between 1 and 65535.');
  }
}
