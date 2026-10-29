export interface ValidationIssue {
  severity: 'error' | 'warning';
  path: string;
  message: string;
}

export class SlackKitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SlackKitError';
  }
}

export class SlackKitValidationError extends SlackKitError {
  readonly issues: ValidationIssue[];

  constructor(issues: ValidationIssue[]) {
    super(issues.map((issue) => `${issue.path}: ${issue.message}`).join('; '));
    this.name = 'SlackKitValidationError';
    this.issues = issues;
  }
}
