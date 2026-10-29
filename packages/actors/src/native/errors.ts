export class NativeAutomationError extends Error {
  constructor(message: string, readonly meta: Record<string, unknown> = {}) {
    super(message);
    this.name = 'NativeAutomationError';
  }
}

export class UnsupportedPlatformError extends NativeAutomationError {
  constructor(platform: NodeJS.Platform) {
    super(`Native automation is not supported on platform: ${platform}.`, { platform });
    this.name = 'UnsupportedPlatformError';
  }
}

export class NativeDependencyError extends NativeAutomationError {
  constructor(packageName: string, cause?: unknown) {
    super(
      `Native automation dependency ${packageName} is not available. Install the optional native automation peer dependencies before using this feature.`,
      cause === undefined ? { packageName } : { packageName, cause }
    );
    this.name = 'NativeDependencyError';
  }
}

export class NativeWindowNotFoundError extends NativeAutomationError {
  constructor(meta: Record<string, unknown>) {
    super('Native window was not found.', meta);
    this.name = 'NativeWindowNotFoundError';
  }
}

export class NativeImageNotFoundError extends NativeAutomationError {
  constructor(meta: Record<string, unknown>) {
    super('Native image/template was not found on screen.', meta);
    this.name = 'NativeImageNotFoundError';
  }
}

export class NativeFileDialogError extends NativeAutomationError {
  constructor(message: string, meta: Record<string, unknown> = {}) {
    super(message, meta);
    this.name = 'NativeFileDialogError';
  }
}

export class CoordinateCalibrationError extends NativeAutomationError {
  constructor(message: string, meta: Record<string, unknown> = {}) {
    super(message, meta);
    this.name = 'CoordinateCalibrationError';
  }
}
